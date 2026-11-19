import { POKEMON_SPECIES } from '../data/pokemon';
import type {
  EggTier,
  MapDifficulty,
  PokemonRarity,
  PokemonSubclass,
} from '../types';

export const MAX_POTENTIAL = 5;

export const UNLOCK_SHARD_COST: Record<PokemonRarity, number> = {
  Common: 5,
  Uncommon: 15,
  Rare: 30,
  Epic: 60,
  Legendary: 100,
};

export const POTENTIAL_UPGRADE_COSTS: readonly [
  number,
  number,
  number,
  number,
  number,
] = [15, 30, 50, 75, 100];

export const POTENTIAL_TIER_DESCRIPTIONS: readonly [
  string,
  string,
  string,
  string,
  string,
] = [
  '+12% Max HP & +12% ATK',
  '+15% Attack Speed',
  '+15% Gold bounty on kills',
  'Start combat with 40% Ult',
  'Subclass Passive',
];

export const SUBCLASS_PASSIVE_DESCS: Record<PokemonSubclass, string> = {
  Bastion: '+12% DEF and +10% damage reduction while blocking.',
  Wallguard: 'Adjacent structures take 20% less damage.',
  Juggernaut: 'Reflects 15% of melee damage taken.',
  Duelist: '+15% damage against single targets and bosses.',
  Cleave: 'Basic attacks deal +20% splash damage to nearby foes.',
  Interceptor: '+1 Move Range and +15% damage to leaking enemies.',
  Sniper: '+15% Crit chance and +20% damage to flying enemies.',
  'Rapid-Fire': 'Every 5th attack fires an extra bolt.',
  Artillery: '+20% splash radius and +10% AoE damage.',
  'Elemental AoE': '+15% elemental AoE damage.',
  Chain: 'Chain hits deal +15% more bounce damage.',
  Status: 'Status effects last 25% longer.',
  Healer: '+20% healing output to allied units.',
  Buffer: 'Aura buffs grant an extra +5% ATK & Speed.',
  Tactician: '+15% Ult charge rate for nearby allies.',
  'Hazard Setter': 'Hazards deal +20% damage and last 1 extra wave.',
  Displacer: 'Knockback and slow effects are 25% stronger.',
  Ambusher: 'First attack after moving deals +35% damage.',
};

export const EGG_HATCH_RATES: Record<EggTier, Record<PokemonRarity, number>> = {
  common: {
    Common: 65,
    Uncommon: 25,
    Rare: 8,
    Epic: 1.5,
    Legendary: 0.5,
  },
  rare: {
    Common: 0,
    Uncommon: 40,
    Rare: 42,
    Epic: 15,
    Legendary: 3,
  },
  master: {
    Common: 0,
    Uncommon: 0,
    Rare: 0,
    Epic: 70,
    Legendary: 30,
  },
};

export const EGG_DUPLICATE_SHARDS: Record<PokemonRarity, number> = {
  Common: 10,
  Uncommon: 15,
  Rare: 20,
  Epic: 30,
  Legendary: 40,
};

export const RECRUIT_SHARDS = 5;
export const VICTORY_SQUAD_SHARDS = 5;

export const FIRST_CLEAR_EGGS: Record<
  MapDifficulty,
  Partial<Record<EggTier, number>>
> = {
  Beginner: { rare: 1 },
  Intermediate: { rare: 1, common: 1 },
  Advanced: { master: 1 },
  Expert: { master: 1, rare: 1 },
};

export const PITY_WIN_THRESHOLD = 4;
export const REPEAT_WIN_EGG_DROP_CHANCE = 0.25;

export interface AchievementSpec {
  id: string;
  title: string;
  desc: string;
  rewardEggs: Partial<Record<EggTier, number>>;
}

export const ACHIEVEMENTS: readonly AchievementSpec[] = [
  {
    id: 'first_victory',
    title: 'First Bastion',
    desc: 'Win your first run on any map.',
    rewardEggs: { common: 1 },
  },
  {
    id: 'perfect_core',
    title: 'Untouched Core',
    desc: 'Win a run with 100% Core HP remaining.',
    rewardEggs: { rare: 1 },
  },
  {
    id: 'budget_squad',
    title: 'Budget Squad',
    desc: 'Win a run using only Common and Uncommon Pokémon.',
    rewardEggs: { rare: 1 },
  },
  {
    id: 'defender_bastion',
    title: 'Iron Bastion',
    desc: 'Win a run with 3 or more Defender Pokémon in your squad.',
    rewardEggs: { rare: 1 },
  },
  {
    id: 'veteran_5',
    title: 'Bastion Veteran',
    desc: 'Achieve 5 total victories.',
    rewardEggs: { master: 1 },
  },
  {
    id: 'expert_clear',
    title: 'Master Tactician',
    desc: 'Clear an Expert difficulty map.',
    rewardEggs: { master: 1 },
  },
];

export interface PotentialBonuses {
  hpMult: number;
  atkMult: number;
  attackIntervalMult: number;
  killGoldMult: number;
  startingUltRatio: number;
  subclassPassive: PokemonSubclass | null;
}

const RARITY_ORDER: readonly PokemonRarity[] = [
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
];

export function getSpeciesRarity(speciesId: string): PokemonRarity {
  return POKEMON_SPECIES[speciesId]?.rarity ?? 'Rare';
}

export function getUnlockShardCost(speciesId: string): number {
  return UNLOCK_SHARD_COST[getSpeciesRarity(speciesId)];
}

export function getPotentialUpgradeCost(
  currentPotential: number,
): number | null {
  if (
    !Number.isInteger(currentPotential) ||
    currentPotential < 0 ||
    currentPotential >= MAX_POTENTIAL
  ) {
    return null;
  }
  return POTENTIAL_UPGRADE_COSTS[currentPotential] ?? null;
}

export function getPotentialBonuses(
  potential: number,
  subclass?: PokemonSubclass,
): PotentialBonuses {
  const level = Math.max(0, Math.min(MAX_POTENTIAL, Math.floor(potential)));
  return {
    hpMult: level >= 1 ? 1.12 : 1,
    atkMult: level >= 1 ? 1.12 : 1,
    attackIntervalMult: level >= 2 ? 1 / 1.15 : 1,
    killGoldMult: level >= 3 ? 1.15 : 1,
    startingUltRatio: level >= 4 ? 0.4 : 0,
    subclassPassive: level >= 5 ? (subclass ?? null) : null,
  };
}

export function rollEggRarity(
  tier: EggTier,
  rng: () => number = Math.random,
): PokemonRarity {
  const rates = EGG_HATCH_RATES[tier];
  const roll = Math.max(0, Math.min(0.999999999, rng())) * 100;
  let cumulative = 0;
  for (const rarity of RARITY_ORDER) {
    cumulative += rates[rarity];
    if (roll < cumulative) {
      return rarity;
    }
  }
  // Fallback to the highest non-zero rarity in this tier
  for (let i = RARITY_ORDER.length - 1; i >= 0; i--) {
    const rarity = RARITY_ORDER[i];
    if (rates[rarity] > 0) return rarity;
  }
  return 'Common';
}

export function pickSpeciesForEgg(
  rarity: PokemonRarity,
  save: { pokemon: Record<string, { unlocked?: boolean }> },
  rng: () => number = Math.random,
): string {
  const allIds = Object.keys(POKEMON_SPECIES);
  const matching = allIds.filter((id) => getSpeciesRarity(id) === rarity);
  const pool = matching.length > 0 ? matching : allIds;
  const unowned = pool.filter((id) => !save.pokemon[id]?.unlocked);
  const candidates = unowned.length > 0 ? unowned : pool;
  const idx = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(rng() * candidates.length)),
  );
  return candidates[idx];
}
