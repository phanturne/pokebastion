import { describe, expect, it } from 'vitest';
import { SUBCLASS_DEFINITIONS } from '../src/data/classes';
import { POKEMON_SPECIES } from '../src/data/pokemon';
import {
  ACHIEVEMENTS,
  EGG_DUPLICATE_SHARDS,
  EGG_HATCH_RATES,
  FIRST_CLEAR_EGGS,
  MAX_POTENTIAL,
  PITY_WIN_THRESHOLD,
  POTENTIAL_TIER_DESCRIPTIONS,
  POTENTIAL_UPGRADE_COSTS,
  RECRUIT_SHARDS,
  SUBCLASS_PASSIVE_DESCS,
  UNLOCK_SHARD_COST,
  VICTORY_SQUAD_SHARDS,
  getPotentialBonuses,
  getPotentialUpgradeCost,
  getSpeciesRarity,
  getUnlockShardCost,
  pickSpeciesForEgg,
  rollEggRarity,
} from '../src/engine/progression';
import { createDefaultSave, unlockPokemon } from '../src/engine/save';
import type { EggTier, PokemonSubclass } from '../src/types';

describe('Progression Constants & Helpers', () => {
  it('defines unlock costs by rarity and defaults undefined rarity (e.g. Lucario 0448) to Rare', () => {
    expect(UNLOCK_SHARD_COST).toEqual({
      Common: 5,
      Uncommon: 15,
      Rare: 30,
      Epic: 60,
      Legendary: 100,
    });
    expect(getSpeciesRarity('0448')).toBe('Rare');
    expect(getUnlockShardCost('0448')).toBe(30);
    expect(getSpeciesRarity('0019')).toBe('Common');
    expect(getUnlockShardCost('0019')).toBe(5);
    expect(getSpeciesRarity('0150')).toBe('Legendary');
    expect(getUnlockShardCost('0150')).toBe(100);
  });

  it('defines 5 potential tiers, upgrade costs, and all 18 subclass passives', () => {
    expect(MAX_POTENTIAL).toBe(5);
    expect(POTENTIAL_UPGRADE_COSTS).toEqual([15, 30, 50, 75, 100]);
    expect(POTENTIAL_TIER_DESCRIPTIONS).toHaveLength(5);

    expect(getPotentialUpgradeCost(0)).toBe(15);
    expect(getPotentialUpgradeCost(4)).toBe(100);
    expect(getPotentialUpgradeCost(5)).toBeNull();
    expect(getPotentialUpgradeCost(-1)).toBeNull();

    const allSubclasses = Object.keys(
      SUBCLASS_DEFINITIONS,
    ) as PokemonSubclass[];
    expect(allSubclasses).toHaveLength(18);
    for (const sc of allSubclasses) {
      expect(typeof SUBCLASS_PASSIVE_DESCS[sc]).toBe('string');
      expect(SUBCLASS_PASSIVE_DESCS[sc].length).toBeGreaterThan(0);
    }
  });

  it('computes structured potential bonuses for tiers 0..5', () => {
    expect(getPotentialBonuses(0, 'Bastion')).toEqual({
      hpMult: 1,
      atkMult: 1,
      attackIntervalMult: 1,
      killGoldMult: 1,
      startingUltRatio: 0,
      subclassPassive: null,
    });

    const p3 = getPotentialBonuses(3, 'Sniper');
    expect(p3.hpMult).toBe(1.12);
    expect(p3.atkMult).toBe(1.12);
    expect(p3.attackIntervalMult).toBeCloseTo(1 / 1.15);
    expect(p3.killGoldMult).toBe(1.15);
    expect(p3.startingUltRatio).toBe(0);
    expect(p3.subclassPassive).toBeNull();

    const p5 = getPotentialBonuses(5, 'Sniper');
    expect(p5.startingUltRatio).toBe(0.4);
    expect(p5.subclassPassive).toBe('Sniper');
  });

  it('has egg hatch rates summing to 100% for every egg tier', () => {
    for (const tier of ['common', 'rare', 'master'] as EggTier[]) {
      const rates = EGG_HATCH_RATES[tier];
      const total = Object.values(rates).reduce((sum, n) => sum + n, 0);
      expect(total).toBeCloseTo(100, 6);
    }
  });

  it('rolls egg rarities deterministically with custom rng', () => {
    expect(rollEggRarity('common', () => 0)).toBe('Common');
    expect(rollEggRarity('common', () => 0.65)).toBe('Uncommon');
    expect(rollEggRarity('common', () => 0.999)).toBe('Legendary');

    expect(rollEggRarity('rare', () => 0)).toBe('Uncommon');
    expect(rollEggRarity('rare', () => 0.45)).toBe('Rare');
    expect(rollEggRarity('rare', () => 0.98)).toBe('Legendary');

    expect(rollEggRarity('master', () => 0.5)).toBe('Epic');
    expect(rollEggRarity('master', () => 0.8)).toBe('Legendary');
  });

  it('picks unowned species first for eggs and falls back when all of that rarity are owned', () => {
    const save = createDefaultSave([]);
    const legendaryIds = Object.keys(POKEMON_SPECIES).filter(
      (id) => getSpeciesRarity(id) === 'Legendary',
    );
    expect(legendaryIds.length).toBeGreaterThan(1);

    // Unlock all legendaries except the last one
    for (let i = 0; i < legendaryIds.length - 1; i++) {
      unlockPokemon(save, legendaryIds[i]);
    }
    const lastUnowned = legendaryIds[legendaryIds.length - 1];
    expect(pickSpeciesForEgg('Legendary', save, () => 0)).toBe(lastUnowned);

    // Now unlock the last one too -> falls back to picking from all legendaries
    unlockPokemon(save, lastUnowned);
    const picked = pickSpeciesForEgg('Legendary', save, () => 0);
    expect(legendaryIds).toContain(picked);
  });

  it('defines shard rewards, first-clear eggs, pity threshold, and achievements', () => {
    expect(RECRUIT_SHARDS).toBe(5);
    expect(VICTORY_SQUAD_SHARDS).toBe(5);
    expect(PITY_WIN_THRESHOLD).toBe(4);
    expect(EGG_DUPLICATE_SHARDS.Common).toBe(10);
    expect(EGG_DUPLICATE_SHARDS.Legendary).toBe(40);
    expect(FIRST_CLEAR_EGGS.Beginner).toEqual({ rare: 1 });
    expect(FIRST_CLEAR_EGGS.Expert).toEqual({ master: 1, rare: 1 });
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(5);
  });
});
