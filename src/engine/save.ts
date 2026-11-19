import { POKEMON_SPECIES, STARTER_UNLOCKED_IDS } from '../data/pokemon';
import type {
  EggHatchResult,
  EggTier,
  MapDifficulty,
  PokemonProgress,
  RunMetaReward,
} from '../types';
import {
  ACHIEVEMENTS,
  EGG_DUPLICATE_SHARDS,
  FIRST_CLEAR_EGGS,
  MAX_POTENTIAL,
  PITY_WIN_THRESHOLD,
  REPEAT_WIN_EGG_DROP_CHANCE,
  VICTORY_SQUAD_SHARDS,
  getPotentialUpgradeCost,
  getSpeciesRarity,
  getUnlockShardCost,
  pickSpeciesForEgg,
  rollEggRarity,
} from './progression';

export const SAVE_STORAGE_KEY = 'pokebastion:save_v1';

export interface PokemonSaveEntry {
  unlocked: boolean;
  shiny?: boolean;
  mastery?: number;
  shards?: number;
}

export interface PlayerSave {
  version: 1;
  pokemon: Record<string, PokemonSaveEntry>;
  universalShards?: number;
  eggs?: Record<EggTier, number>;
  pityWins?: number;
  clearedMaps?: string[];
  achievements?: string[];
  wins?: number;
}

export interface RunVictoryParams {
  mapId: string;
  difficulty: MapDifficulty;
  squadSpeciesIds: string[];
  coreHp: number;
  coreMaxHp: number;
  rng?: () => number;
}

function emptyEggs(): Record<EggTier, number> {
  return { common: 0, rare: 0, master: 0 };
}

function ensureEggs(save: PlayerSave): Record<EggTier, number> {
  if (!save.eggs) {
    save.eggs = emptyEggs();
  }
  return save.eggs;
}

function addEggs(
  eggs: Record<EggTier, number>,
  delta: Partial<Record<EggTier, number>>,
): void {
  for (const tier of ['common', 'rare', 'master'] as const) {
    const count = delta[tier] ?? 0;
    if (count > 0) {
      eggs[tier] = (eggs[tier] ?? 0) + count;
    }
  }
}

export function createDefaultSave(
  starterIds: readonly string[] = STARTER_UNLOCKED_IDS,
): PlayerSave {
  const pokemon: Record<string, PokemonSaveEntry> = {};
  for (const id of starterIds) {
    pokemon[id] = { unlocked: true };
  }
  return {
    version: 1,
    pokemon,
    universalShards: 0,
    eggs: emptyEggs(),
    pityWins: 0,
    clearedMaps: [],
    achievements: [],
    wins: 0,
  };
}

export function isPokemonUnlocked(
  save: PlayerSave,
  speciesId: string,
): boolean {
  return Boolean(save.pokemon[speciesId]?.unlocked);
}

export function getUnlockedIds(save: PlayerSave): string[] {
  return Object.entries(save.pokemon)
    .filter(([, entry]) => entry.unlocked)
    .map(([id]) => id);
}

export function unlockPokemon(save: PlayerSave, speciesId: string): boolean {
  const existing = save.pokemon[speciesId];
  if (existing?.unlocked) return false;
  save.pokemon[speciesId] = { ...existing, unlocked: true };
  return true;
}

export function buildPokemonProgressMap(
  save: PlayerSave,
): Record<string, PokemonProgress> {
  const out: Record<string, PokemonProgress> = {};
  const ids = new Set([
    ...Object.keys(POKEMON_SPECIES),
    ...Object.keys(save.pokemon),
  ]);
  for (const id of ids) {
    const entry = save.pokemon[id];
    out[id] = {
      unlocked: Boolean(entry?.unlocked),
      shards: entry?.shards ?? 0,
      potential: Math.max(
        0,
        Math.min(MAX_POTENTIAL, Math.floor(entry?.mastery ?? 0)),
      ),
    };
  }
  return out;
}

export function addShardsToSpecies(
  save: PlayerSave,
  speciesId: string,
  amount: number,
): { speciesShardsAdded: number; universalShardsAdded: number } {
  if (amount <= 0) {
    return { speciesShardsAdded: 0, universalShardsAdded: 0 };
  }
  const entry = save.pokemon[speciesId] ?? { unlocked: false };
  const potential = entry.mastery ?? 0;
  if (entry.unlocked && potential >= MAX_POTENTIAL) {
    save.universalShards = (save.universalShards ?? 0) + amount;
    return { speciesShardsAdded: 0, universalShardsAdded: amount };
  }
  save.pokemon[speciesId] = {
    ...entry,
    shards: (entry.shards ?? 0) + amount,
  };
  return { speciesShardsAdded: amount, universalShardsAdded: 0 };
}

export function unlockSpeciesWithShards(
  save: PlayerSave,
  speciesId: string,
  useUniversal = true,
): boolean {
  if (isPokemonUnlocked(save, speciesId)) return false;
  const cost = getUnlockShardCost(speciesId);
  const entry = save.pokemon[speciesId] ?? { unlocked: false };
  const speciesShards = entry.shards ?? 0;
  const universalShards = useUniversal ? (save.universalShards ?? 0) : 0;
  if (speciesShards + universalShards < cost) return false;

  const fromSpecies = Math.min(speciesShards, cost);
  const fromUniversal = cost - fromSpecies;
  save.pokemon[speciesId] = {
    ...entry,
    unlocked: true,
    shards: speciesShards - fromSpecies,
  };
  if (fromUniversal > 0) {
    save.universalShards = (save.universalShards ?? 0) - fromUniversal;
  }
  return true;
}

export function upgradeSpeciesPotential(
  save: PlayerSave,
  speciesId: string,
  useUniversal = true,
): boolean {
  if (!isPokemonUnlocked(save, speciesId)) return false;
  const entry = save.pokemon[speciesId];
  const currentPotential = entry.mastery ?? 0;
  const cost = getPotentialUpgradeCost(currentPotential);
  if (cost === null) return false;

  const speciesShards = entry.shards ?? 0;
  const universalShards = useUniversal ? (save.universalShards ?? 0) : 0;
  if (speciesShards + universalShards < cost) return false;

  const fromSpecies = Math.min(speciesShards, cost);
  const fromUniversal = cost - fromSpecies;
  save.pokemon[speciesId] = {
    ...entry,
    mastery: currentPotential + 1,
    shards: speciesShards - fromSpecies,
  };
  if (fromUniversal > 0) {
    save.universalShards = (save.universalShards ?? 0) - fromUniversal;
  }
  return true;
}

export function hatchEggFromSave(
  save: PlayerSave,
  tier: EggTier,
  rng: () => number = Math.random,
): EggHatchResult | null {
  const eggs = ensureEggs(save);
  const count = eggs[tier] ?? 0;
  if (count <= 0) return null;

  eggs[tier] = count - 1;
  const rarity = rollEggRarity(tier, rng);
  const speciesId = pickSpeciesForEgg(rarity, save, rng);
  const wasNewUnlock = !isPokemonUnlocked(save, speciesId);

  if (wasNewUnlock) {
    unlockPokemon(save, speciesId);
    return {
      eggTier: tier,
      speciesId,
      rarity,
      wasNewUnlock: true,
      shardsAwarded: 0,
      universalShardsAwarded: 0,
    };
  }

  const dupAmount = EGG_DUPLICATE_SHARDS[rarity];
  const { speciesShardsAdded, universalShardsAdded } = addShardsToSpecies(
    save,
    speciesId,
    dupAmount,
  );
  return {
    eggTier: tier,
    speciesId,
    rarity,
    wasNewUnlock: false,
    shardsAwarded: speciesShardsAdded,
    universalShardsAwarded: universalShardsAdded,
  };
}

function isAchievementEarned(
  achievementId: string,
  save: PlayerSave,
  params: RunVictoryParams,
  uniqueSpecies: string[],
): boolean {
  switch (achievementId) {
    case 'first_victory':
      return (save.wins ?? 0) >= 1;
    case 'perfect_core':
      return params.coreMaxHp > 0 && params.coreHp >= params.coreMaxHp;
    case 'budget_squad':
      return (
        uniqueSpecies.length > 0 &&
        uniqueSpecies.every((id) => {
          const r = getSpeciesRarity(id);
          return r === 'Common' || r === 'Uncommon';
        })
      );
    case 'defender_bastion': {
      const defenders = uniqueSpecies.filter((id) => {
        const spec = POKEMON_SPECIES[id];
        return (
          spec?.pokeClass === 'Defender' || spec?.secondaryClass === 'Defender'
        );
      });
      return defenders.length >= 3;
    }
    case 'veteran_5':
      return (save.wins ?? 0) >= 5;
    case 'expert_clear':
      return params.difficulty === 'Expert';
    default:
      return false;
  }
}

export function applyRunVictoryRewards(
  save: PlayerSave,
  params: RunVictoryParams,
): RunMetaReward {
  const rng = params.rng ?? Math.random;
  const eggs = ensureEggs(save);
  save.clearedMaps = save.clearedMaps ?? [];
  save.achievements = save.achievements ?? [];
  save.wins = (save.wins ?? 0) + 1;

  const uniqueSpecies = Array.from(new Set(params.squadSpeciesIds));
  const shardsBySpecies: Record<string, number> = {};
  let universalShardsAwarded = 0;

  for (const speciesId of uniqueSpecies) {
    const { speciesShardsAdded, universalShardsAdded } = addShardsToSpecies(
      save,
      speciesId,
      VICTORY_SQUAD_SHARDS,
    );
    if (speciesShardsAdded > 0) {
      shardsBySpecies[speciesId] =
        (shardsBySpecies[speciesId] ?? 0) + speciesShardsAdded;
    }
    universalShardsAwarded += universalShardsAdded;
  }

  const eggsEarned = emptyEggs();
  const firstClear = !save.clearedMaps.includes(params.mapId);
  let pityTriggered = false;

  if (firstClear) {
    save.clearedMaps.push(params.mapId);
    const firstClearReward = FIRST_CLEAR_EGGS[params.difficulty];
    addEggs(eggs, firstClearReward);
    addEggs(eggsEarned, firstClearReward);
  } else {
    const isHighTier =
      params.difficulty === 'Advanced' || params.difficulty === 'Expert';
    if (rng() < REPEAT_WIN_EGG_DROP_CHANCE) {
      const dropTier: EggTier = isHighTier ? 'rare' : 'common';
      addEggs(eggs, { [dropTier]: 1 });
      addEggs(eggsEarned, { [dropTier]: 1 });
      save.pityWins = 0;
    } else {
      save.pityWins = (save.pityWins ?? 0) + 1;
      if (save.pityWins >= PITY_WIN_THRESHOLD) {
        const pityTier: EggTier = isHighTier ? 'master' : 'rare';
        addEggs(eggs, { [pityTier]: 1 });
        addEggs(eggsEarned, { [pityTier]: 1 });
        save.pityWins = 0;
        pityTriggered = true;
      }
    }
  }

  const newAchievements: string[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (save.achievements.includes(ach.id)) continue;
    if (isAchievementEarned(ach.id, save, params, uniqueSpecies)) {
      save.achievements.push(ach.id);
      newAchievements.push(ach.id);
      addEggs(eggs, ach.rewardEggs);
      addEggs(eggsEarned, ach.rewardEggs);
    }
  }

  return {
    shardsBySpecies,
    universalShardsAwarded,
    eggsEarned,
    newAchievements,
    firstClear,
    pityTriggered,
  };
}

function parseNonNegInt(val: unknown, fallback = 0): number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0
    ? Math.floor(val)
    : fallback;
}

function parseStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === 'string');
}

export function loadPlayerSave(
  storage?: Pick<Storage, 'getItem'> | null,
  starterIds: readonly string[] = STARTER_UNLOCKED_IDS,
): PlayerSave {
  const save = createDefaultSave(starterIds);
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return save;

  try {
    const raw = store.getItem(SAVE_STORAGE_KEY);
    if (!raw) return save;
    const parsed = JSON.parse(raw) as Partial<PlayerSave>;
    if (
      parsed.version !== 1 ||
      !parsed.pokemon ||
      typeof parsed.pokemon !== 'object'
    ) {
      return save;
    }
    for (const [id, entry] of Object.entries(parsed.pokemon)) {
      if (entry && typeof entry === 'object') {
        save.pokemon[id] = {
          unlocked:
            Boolean(entry.unlocked) || Boolean(save.pokemon[id]?.unlocked),
          ...(entry.shiny !== undefined ? { shiny: Boolean(entry.shiny) } : {}),
          ...(typeof entry.mastery === 'number'
            ? { mastery: entry.mastery }
            : {}),
          ...(typeof entry.shards === 'number' &&
          Number.isFinite(entry.shards) &&
          entry.shards >= 0
            ? { shards: entry.shards }
            : {}),
        };
      }
    }
    save.universalShards = parseNonNegInt(parsed.universalShards);
    save.pityWins = parseNonNegInt(parsed.pityWins);
    save.wins = parseNonNegInt(parsed.wins);
    save.clearedMaps = parseStringArray(parsed.clearedMaps);
    save.achievements = parseStringArray(parsed.achievements);
    if (parsed.eggs && typeof parsed.eggs === 'object') {
      save.eggs = {
        common: parseNonNegInt(parsed.eggs.common),
        rare: parseNonNegInt(parsed.eggs.rare),
        master: parseNonNegInt(parsed.eggs.master),
      };
    }
  } catch {
    // Ignore corrupt or restricted storage and fall back to starter defaults.
  }
  return save;
}

export function persistPlayerSave(
  save: PlayerSave,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return;
  try {
    store.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Ignore storage quota/security errors in restricted contexts.
  }
}
