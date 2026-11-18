import { POKEMON_SPECIES, REWARD_POOL, STRUCTURE_SPECS } from '../data/pokemon';
import { GamePhase, RewardOption, StructureKind } from '../types';

export const HEAL_COST = 15;
export const REVIVE_COST = 35;
export const SELL_REFUND_RATE = 0.7;
export const REPAIR_COST_RATE = 0.5;
export const BASE_AP_KILL_THRESHOLD = 6;
export const TEMPORAL_GEAR_KILL_THRESHOLD = 4;
export const WAVE_AP_RECOVERY = 3;

export function chebyshevDist(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function getEffectiveMoveRange(
  baseMoveRange: number,
  upgrades: string[],
): number {
  return baseMoveRange + (upgrades.includes('swift_boots') ? 1 : 0);
}

/**
 * Returns the AP cost to move from (fromX, fromY) to (toX, toY), or null if out of range / same tile.
 * During PREP phase, any reachable tile within 2x move range (or whole map) costs 0 AP;
 * during COMBAT, Standard Ring (<= moveRange) costs 1 AP and Extended Ring (<= 2 * moveRange) costs 2 AP.
 */
export function getMovementCost(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  moveRange: number,
  phase: GamePhase,
): number | null {
  const dist = chebyshevDist(fromX, fromY, toX, toY);
  if (dist === 0) return null;
  if (phase === 'PREP') return 0;
  if (dist <= moveRange) return 1;
  if (dist <= moveRange * 2) return 2;
  return null;
}

export function getEffectiveMaxHp(
  speciesId: string,
  upgrades: string[],
): number {
  const base = POKEMON_SPECIES[speciesId]?.maxHp ?? 100;
  return upgrades.includes('thick_hide') ? Math.round(base * 1.3) : base;
}

export function getEffectiveAtk(
  speciesId: string,
  upgrades: string[],
  hasBulbasaurAura = false,
): number {
  const base = POKEMON_SPECIES[speciesId]?.atk ?? 20;
  let mult = 1;
  if (upgrades.includes('sharp_claws')) mult += 0.25;
  if (hasBulbasaurAura) mult += 0.1;
  return Math.round(base * mult);
}

export function getEffectiveAttackIntervalMs(
  speciesId: string,
  artifacts: string[],
): number {
  const base = POKEMON_SPECIES[speciesId]?.attackIntervalMs ?? 1000;
  return artifacts.includes('arcane_conduit') ? Math.round(base * 0.8) : base;
}

export function getEffectiveStructureMaxHp(
  kind: StructureKind,
  artifacts: string[],
): number {
  const base = STRUCTURE_SPECS[kind].maxHp;
  const isWall = kind === 'wood_wall' || kind === 'stone_wall';
  if (isWall && artifacts.includes('fortification_core')) {
    return Math.round(base * 1.4);
  }
  return base;
}

export function getSellRefund(kind: StructureKind): number {
  return Math.round(STRUCTURE_SPECS[kind].cost * SELL_REFUND_RATE);
}

export function getRepairCost(
  kind: StructureKind,
  hp?: number,
  maxHp?: number,
): number {
  const base = STRUCTURE_SPECS[kind].cost;
  if (hp === undefined || maxHp === undefined || maxHp <= 0) {
    return Math.round(base * REPAIR_COST_RATE);
  }
  const missingRatio = Math.max(0, Math.min(1, (maxHp - hp) / maxHp));
  if (missingRatio <= 0) return 0;
  return Math.max(5, Math.ceil(base * REPAIR_COST_RATE * missingRatio));
}

export function getApKillThreshold(artifacts: string[]): number {
  return artifacts.includes('temporal_gear')
    ? TEMPORAL_GEAR_KILL_THRESHOLD
    : BASE_AP_KILL_THRESHOLD;
}

export function getBountyGold(baseBounty: number, artifacts: string[]): number {
  return artifacts.includes('commanders_insignia')
    ? Math.round(baseBounty * 1.25)
    : baseBounty;
}

/**
 * Generates up to 3 distinct roguelike reward choices between waves,
 * prioritizing unowned upgrades/artifacts and offering 1 unrecruited Pokémon when available.
 */
export function generateRewardChoices(
  ownedSpeciesIds: Set<string>,
  ownedUpgrades: string[],
  ownedArtifacts: string[],
  rng: () => number = Math.random,
): RewardOption[] {
  const availableRewards = REWARD_POOL.filter(
    (r) =>
      (r.kind === 'upgrade' && !ownedUpgrades.includes(r.id)) ||
      (r.kind === 'artifact' && !ownedArtifacts.includes(r.id)),
  );

  const shuffle = <T>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const unownedSpecies = Object.values(POKEMON_SPECIES).filter(
    (sp) => !ownedSpeciesIds.has(sp.id),
  );

  const choices: RewardOption[] = [];
  const shuffledPool = shuffle(availableRewards);

  if (unownedSpecies.length > 0) {
    const pick = shuffle(unownedSpecies)[0];
    choices.push({
      id: `recruit_${pick.id}`,
      kind: 'recruit',
      title: `Recruit ${pick.name}`,
      desc: `${pick.pokeClass} — ${pick.ultName}: ${pick.ultDesc}`,
      speciesId: pick.id,
    });
  }

  for (const item of shuffledPool) {
    if (choices.length >= 3) break;
    choices.push(item);
  }

  return choices;
}
