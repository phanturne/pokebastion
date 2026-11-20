import { describe, expect, it } from 'vitest';
import { POKEMON_SPECIES } from '../src/data/pokemon';
import {
  EGG_DUPLICATE_SHARDS,
  PITY_WIN_THRESHOLD,
  VICTORY_SQUAD_SHARDS,
  getSpeciesRarity,
} from '../src/engine/progression';
import {
  SAVE_STORAGE_KEY,
  addShardsToSpecies,
  applyRunVictoryRewards,
  buildPokemonProgressMap,
  createDefaultSave,
  getUnlockedIds,
  hatchEggFromSave,
  isPokemonUnlocked,
  loadPlayerSave,
  persistPlayerSave,
  unlockPokemon,
  unlockSpeciesWithShards,
  upgradeSpeciesPotential,
} from '../src/engine/save';

describe('PlayerSave & Unlock State', () => {
  it('seeds Bulbasaur, Charmander, and Squirtle as unlocked by default', () => {
    const save = createDefaultSave();
    expect(isPokemonUnlocked(save, '0001')).toBe(true);
    expect(isPokemonUnlocked(save, '0004')).toBe(true);
    expect(isPokemonUnlocked(save, '0007')).toBe(true);
    expect(isPokemonUnlocked(save, '0025')).toBe(false);
    expect(getUnlockedIds(save).sort()).toEqual(['0001', '0004', '0007']);
  });

  it('unlocks new species and preserves future shiny/mastery fields across save/load', () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };

    const save = loadPlayerSave(mockStorage);
    expect(unlockPokemon(save, '0025')).toBe(true);
    expect(unlockPokemon(save, '0025')).toBe(false);
    save.pokemon['0025'].shiny = true;
    save.pokemon['0025'].mastery = 4;
    persistPlayerSave(save, mockStorage);

    const reloaded = loadPlayerSave(mockStorage);
    expect(isPokemonUnlocked(reloaded, '0025')).toBe(true);
    expect(reloaded.pokemon['0025'].shiny).toBe(true);
    expect(reloaded.pokemon['0025'].mastery).toBe(4);
    expect(isPokemonUnlocked(reloaded, '0001')).toBe(true);
  });

  it('falls back safely on corrupt storage', () => {
    const corruptStorage = {
      getItem: (k: string) => (k === SAVE_STORAGE_KEY ? '{bad json' : null),
    };
    const save = loadPlayerSave(corruptStorage);
    expect(getUnlockedIds(save).sort()).toEqual(['0001', '0004', '0007']);
  });

  it('handles null/missing storage, invalid schemas, starter protection, throwing setItem, and custom starters', () => {
    // null storage and missing key
    expect(getUnlockedIds(loadPlayerSave(null)).sort()).toEqual([
      '0001',
      '0004',
      '0007',
    ]);
    expect(
      getUnlockedIds(loadPlayerSave({ getItem: () => null })).sort(),
    ).toEqual(['0001', '0004', '0007']);

    // wrong version & non-object pokemon
    expect(
      getUnlockedIds(
        loadPlayerSave({
          getItem: () => JSON.stringify({ version: 2, pokemon: {} }),
        }),
      ).sort(),
    ).toEqual(['0001', '0004', '0007']);
    expect(
      getUnlockedIds(
        loadPlayerSave({
          getItem: () => JSON.stringify({ version: 1, pokemon: 'bad' }),
        }),
      ).sort(),
    ).toEqual(['0001', '0004', '0007']);

    // invalid entry ignored & starter unlocked: false cannot lock a starter
    const withInvalid = loadPlayerSave({
      getItem: () =>
        JSON.stringify({
          version: 1,
          pokemon: {
            '0001': { unlocked: false },
            '0025': 'invalid_entry',
            '0150': { unlocked: true, shiny: true },
          },
        }),
    });
    expect(isPokemonUnlocked(withInvalid, '0001')).toBe(true);
    expect(isPokemonUnlocked(withInvalid, '0025')).toBe(false);
    expect(isPokemonUnlocked(withInvalid, '0150')).toBe(true);

    // persistPlayerSave with null storage or throwing setItem
    expect(() => persistPlayerSave(withInvalid, null)).not.toThrow();
    expect(() =>
      persistPlayerSave(withInvalid, {
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      }),
    ).not.toThrow();

    // createDefaultSave with custom starters
    const custom = createDefaultSave(['0025', '0150']);
    expect(getUnlockedIds(custom).sort()).toEqual(['0025', '0150']);
  });
});

describe('Shards, Potential, Eggs, Pity & Run Victory Rewards', () => {
  it('adds shards to species and overflows to universalShards when unlocked and at ★5 potential', () => {
    const save = createDefaultSave();
    // Locked species accumulates species shards
    expect(addShardsToSpecies(save, '0025', 10)).toEqual({
      speciesShardsAdded: 10,
      universalShardsAdded: 0,
    });
    expect(save.pokemon['0025'].shards).toBe(10);
    expect(save.universalShards).toBe(0);

    // Unlocked species below ★5 accumulates species shards
    expect(addShardsToSpecies(save, '0001', 12)).toEqual({
      speciesShardsAdded: 12,
      universalShardsAdded: 0,
    });
    expect(save.pokemon['0001'].shards).toBe(12);

    // Unlocked species at ★5 overflows to universalShards
    save.pokemon['0001'].mastery = 5;
    expect(addShardsToSpecies(save, '0001', 8)).toEqual({
      speciesShardsAdded: 0,
      universalShardsAdded: 8,
    });
    expect(save.pokemon['0001'].shards).toBe(12);
    expect(save.universalShards).toBe(8);
  });

  it('unlocks species with species shards + universal shards and upgrades potential ★0..★5', () => {
    const save = createDefaultSave();
    // '0025' (Pikachu) is Uncommon -> unlock cost 25
    addShardsToSpecies(save, '0025', 20);
    save.universalShards = 10;

    // Without universal shards, 20 < 25 -> fails
    expect(unlockSpeciesWithShards(save, '0025', false)).toBe(false);
    // With universal shards, 20 + 5 -> succeeds
    expect(unlockSpeciesWithShards(save, '0025', true)).toBe(true);
    expect(isPokemonUnlocked(save, '0025')).toBe(true);
    expect(save.pokemon['0025'].shards).toBe(0);
    expect(save.universalShards).toBe(5);
    // Cannot unlock again
    expect(unlockSpeciesWithShards(save, '0025', true)).toBe(false);

    // Upgrade potential ★0 -> ★1 costs 15
    expect(upgradeSpeciesPotential(save, '0025', true)).toBe(false);
    addShardsToSpecies(save, '0025', 12); // 12 species + 5 universal = 17 >= 15
    expect(upgradeSpeciesPotential(save, '0025', true)).toBe(true);
    expect(save.pokemon['0025'].mastery).toBe(1);
    expect(save.pokemon['0025'].shards).toBe(0);
    expect(save.universalShards).toBe(2);

    // Upgrade ★1 -> ★5
    save.universalShards = 15 + 30 + 50 + 75 + 100;
    expect(upgradeSpeciesPotential(save, '0025', true)).toBe(true); // ★2 (30)
    expect(upgradeSpeciesPotential(save, '0025', true)).toBe(true); // ★3 (50)
    expect(upgradeSpeciesPotential(save, '0025', true)).toBe(true); // ★4 (75)
    expect(upgradeSpeciesPotential(save, '0025', true)).toBe(true); // ★5 (100)
    expect(save.pokemon['0025'].mastery).toBe(5);
    // Cannot upgrade past ★5
    expect(upgradeSpeciesPotential(save, '0025', true)).toBe(false);

    const progress = buildPokemonProgressMap(save);
    expect(progress['0025']).toEqual({
      unlocked: true,
      shards: 0,
      potential: 5,
    });
  });

  it('hatches eggs unowned-first and converts duplicates to shards (or universal overflow)', () => {
    const save = createDefaultSave([]);
    expect(hatchEggFromSave(save, 'master')).toBeNull();

    save.eggs = { common: 0, rare: 0, master: 2 };
    // rng() = 0.8 -> Master Egg rolls Legendary (70..100)
    const first = hatchEggFromSave(save, 'master', () => 0.8);
    expect(first).not.toBeNull();
    expect(first!.rarity).toBe('Legendary');
    expect(first!.wasNewUnlock).toBe(true);
    expect(first!.shardsAwarded).toBe(0);
    expect(save.eggs.master).toBe(1);
    expect(isPokemonUnlocked(save, first!.speciesId)).toBe(true);

    // Unlock all remaining Legendaries and set them to ★5 to verify duplicate + overflow
    const legendaries = Object.keys(POKEMON_SPECIES).filter(
      (id) => getSpeciesRarity(id) === 'Legendary',
    );
    for (const id of legendaries) {
      unlockPokemon(save, id);
      save.pokemon[id].mastery = 5;
    }
    const dup = hatchEggFromSave(save, 'master', () => 0.8);
    expect(dup).not.toBeNull();
    expect(dup!.wasNewUnlock).toBe(false);
    expect(dup!.shardsAwarded).toBe(0);
    expect(dup!.universalShardsAwarded).toBe(EGG_DUPLICATE_SHARDS.Legendary);
    expect(save.universalShards).toBe(EGG_DUPLICATE_SHARDS.Legendary);
  });

  it('awards first-clear eggs, squad shards, repeat-win pity counter, and achievements on victory', () => {
    const save = createDefaultSave();
    // First clear on Beginner with Common/Uncommon squad and full Core HP
    const r1 = applyRunVictoryRewards(save, {
      mapId: 'route_1',
      difficulty: 'Beginner',
      squadSpeciesIds: ['0001', '0004', '0007'], // all Uncommon
      coreHp: 20,
      coreMaxHp: 20,
      rng: () => 0.99,
    });
    expect(r1.firstClear).toBe(true);
    expect(r1.shardsBySpecies).toEqual({
      '0001': VICTORY_SQUAD_SHARDS,
      '0004': VICTORY_SQUAD_SHARDS,
      '0007': VICTORY_SQUAD_SHARDS,
    });
    expect(r1.newAchievements).toContain('first_victory');
    expect(r1.newAchievements).toContain('perfect_core');
    expect(r1.newAchievements).toContain('budget_squad');
    expect(save.clearedMaps).toEqual(['route_1']);
    expect(save.pityWins).toBe(0);
    // Beginner first clear (1 rare) + first_victory (1 common) + perfect_core (1 rare) + budget_squad (1 rare)
    expect(r1.eggsEarned).toEqual({ common: 1, rare: 3, master: 0 });

    // Repeat wins without random drop increment pityWins up to PITY_WIN_THRESHOLD (4)
    for (let i = 1; i < PITY_WIN_THRESHOLD; i++) {
      const r = applyRunVictoryRewards(save, {
        mapId: 'route_1',
        difficulty: 'Beginner',
        squadSpeciesIds: ['0001'],
        coreHp: 10,
        coreMaxHp: 20,
        rng: () => 0.99, // miss random drop (>= 0.25)
      });
      expect(r.firstClear).toBe(false);
      expect(r.pityTriggered).toBe(false);
      expect(r.newAchievements).toEqual([]);
      expect(save.pityWins).toBe(i);
    }

    // 4th miss triggers pity Rare Egg and veteran_5 achievement (5th total win)
    const rPity = applyRunVictoryRewards(save, {
      mapId: 'route_1',
      difficulty: 'Beginner',
      squadSpeciesIds: ['0001'],
      coreHp: 10,
      coreMaxHp: 20,
      rng: () => 0.99,
    });
    expect(rPity.pityTriggered).toBe(true);
    expect(save.pityWins).toBe(0);
    expect(rPity.newAchievements).toEqual(['veteran_5']);
    expect(rPity.eggsEarned).toEqual({ common: 0, rare: 1, master: 1 });
  });

  it('converts leftover species shards into universalShards when reaching ★5', () => {
    const save = createDefaultSave(['0001']);
    save.pokemon['0001'] = { unlocked: true, mastery: 4, shards: 125 };
    save.universalShards = 5;

    expect(upgradeSpeciesPotential(save, '0001')).toBe(true);
    expect(save.pokemon['0001'].mastery).toBe(5);
    expect(save.pokemon['0001'].shards).toBe(0);
    // ★4 -> ★5 costs 100 shards; 25 leftover converted to universalShards
    expect(save.universalShards).toBe(30);
  });

  it('validates, floors, and clamps mastery and shards in loadPlayerSave', () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    store.set(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        pokemon: {
          '0001': { unlocked: true, mastery: 99.7, shards: 14.9 },
          '0004': { unlocked: true, mastery: -2, shards: -5 },
          '0007': { unlocked: true, mastery: null, shards: null },
        },
      }),
    );

    const loaded = loadPlayerSave(mockStorage);
    expect(loaded.pokemon['0001'].mastery).toBe(5);
    expect(loaded.pokemon['0001'].shards).toBe(14);
    expect(loaded.pokemon['0004'].mastery).toBeUndefined();
    expect(loaded.pokemon['0004'].shards).toBeUndefined();
    expect(loaded.pokemon['0007'].mastery).toBeUndefined();
    expect(loaded.pokemon['0007'].shards).toBeUndefined();
  });
});
