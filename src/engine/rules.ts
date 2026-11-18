import {
  HELD_ITEMS,
  POKEMON_SPECIES,
  REWARD_POOL,
  STRUCTURE_SPECS,
} from '../data/pokemon';
import {
  GamePhase,
  PokemonBranch,
  RewardOption,
  StructureKind,
} from '../types';

export const HEAL_COST = 15;
export const REVIVE_COST = 35;
export const SELL_REFUND_RATE = 0.7;
export const REPAIR_COST_RATE = 0.5;
export const BASE_AP_KILL_THRESHOLD = 6;
export const TEMPORAL_GEAR_KILL_THRESHOLD = 4;
export const WAVE_AP_RECOVERY = 3;
export const DRAFT_BUDGET = 10;
export const MAX_ACTIVE_UNITS = 6;
export const MAX_HELD_ITEMS = 3;

export function getDraftCost(speciesIds: string[]): number {
  return speciesIds.reduce(
    (sum, id) => sum + (POKEMON_SPECIES[id]?.draftCost ?? 0),
    0,
  );
}

export function canDraftSpecies(
  currentIds: string[],
  speciesId: string,
  budget = DRAFT_BUDGET,
  maxUnits = MAX_ACTIVE_UNITS,
): boolean {
  const sp = POKEMON_SPECIES[speciesId];
  if (!sp) return false;
  if (currentIds.includes(speciesId)) return false;
  if (currentIds.length >= maxUnits) return false;
  return getDraftCost(currentIds) + sp.draftCost <= budget;
}

export function getBranchSpec(
  speciesId: string,
  branchId: string | null,
): PokemonBranch | undefined {
  if (!branchId) return undefined;
  return POKEMON_SPECIES[speciesId]?.branches.find((b) => b.id === branchId);
}

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
  branch?: PokemonBranch,
): number {
  return (
    baseMoveRange +
    (upgrades.includes('swift_boots') ? 1 : 0) +
    (branch?.moveRangeBonus ?? 0)
  );
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
  branchId: string | null = null,
  heldItems: string[] = [],
): number {
  const base = POKEMON_SPECIES[speciesId]?.maxHp ?? 100;
  let mult = upgrades.includes('thick_hide') ? 1.3 : 1;
  const branch = getBranchSpec(speciesId, branchId);
  if (branch?.hpMult) mult *= branch.hpMult;
  for (const itemId of heldItems) {
    const item = HELD_ITEMS[itemId];
    if (item?.hpMult) mult *= item.hpMult;
  }
  return Math.round(base * mult);
}

export function getEffectiveAtk(
  speciesId: string,
  upgrades: string[],
  hasBulbasaurAura = false,
  branchId: string | null = null,
  heldItems: string[] = [],
): number {
  const base = POKEMON_SPECIES[speciesId]?.atk ?? 20;
  let mult = 1;
  if (upgrades.includes('sharp_claws')) mult += 0.25;
  if (hasBulbasaurAura) mult += 0.1;
  const branch = getBranchSpec(speciesId, branchId);
  if (branch?.atkMult) mult *= branch.atkMult;
  for (const itemId of heldItems) {
    const item = HELD_ITEMS[itemId];
    if (item?.atkMult) mult *= item.atkMult;
  }
  return Math.round(base * mult);
}

export function getEffectiveDef(
  speciesId: string,
  branchId: string | null = null,
  heldItems: string[] = [],
): number {
  let def = POKEMON_SPECIES[speciesId]?.def ?? 0;
  const branch = getBranchSpec(speciesId, branchId);
  if (branch?.defBonus) def += branch.defBonus;
  for (const itemId of heldItems) {
    const item = HELD_ITEMS[itemId];
    if (item?.defBonus) def += item.defBonus;
  }
  return def;
}

export function getEffectiveRange(
  speciesId: string,
  branchId: string | null = null,
): number {
  const base = POKEMON_SPECIES[speciesId]?.range ?? 1;
  const branch = getBranchSpec(speciesId, branchId);
  return base + (branch?.rangeBonus ?? 0);
}

export function getEffectiveAttackIntervalMs(
  speciesId: string,
  artifacts: string[],
  branchId: string | null = null,
  heldItems: string[] = [],
): number {
  let interval = POKEMON_SPECIES[speciesId]?.attackIntervalMs ?? 1000;
  if (artifacts.includes('arcane_conduit')) interval *= 0.8;
  const branch = getBranchSpec(speciesId, branchId);
  if (branch?.attackIntervalMult) interval *= branch.attackIntervalMult;
  for (const itemId of heldItems) {
    const item = HELD_ITEMS[itemId];
    if (item?.attackIntervalMult) interval *= item.attackIntervalMult;
  }
  return Math.round(interval);
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
  unbranchedUnits: Array<{ uid: string; speciesId: string }> = [],
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

  if (unbranchedUnits.length > 0) {
    const pickedUnit = shuffle(unbranchedUnits)[0];
    const sp = POKEMON_SPECIES[pickedUnit.speciesId];
    if (sp) {
      choices.push({
        id: `branch_${pickedUnit.uid}`,
        kind: 'branch',
        title: `Specialize ${sp.name}`,
        desc: `Choose 1 of 3 evolution/specialization branches for ${sp.name}.`,
        speciesId: pickedUnit.speciesId,
        unitUid: pickedUnit.uid,
      });
    }
  }

  if (unownedSpecies.length > 0 && choices.length < 3) {
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

/**
 * Checks whether grid coordinate `(bx, by)` falls inside the circular attack
 * perimeter of radius `range + 0.5` tiles centered on `(ax, ay)`.
 */
export function isInCircularRange(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  range: number,
): boolean {
  if (range < 0) return false;
  const dx = bx - ax;
  const dy = by - ay;
  const r = range + 0.5;
  return dx * dx + dy * dy <= r * r;
}

export interface ProjectileLaunch {
  startX: number;
  startY: number;
  rotation: number;
}

/**
 * Computes a muzzle-offset spawn point and rotation angle (radians, 0 = +x)
 * from `(sx, sy)` toward `(tx, ty)`, clamped so it never overshoots the target.
 */
export function computeProjectileLaunch(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  muzzleOffset = 16,
): ProjectileLaunch {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    return { startX: sx, startY: sy, rotation: 0 };
  }
  const rotation = Math.atan2(dy, dx);
  const offset = Math.min(Math.max(0, muzzleOffset), dist * 0.5);
  return {
    startX: sx + Math.cos(rotation) * offset,
    startY: sy + Math.sin(rotation) * offset,
    rotation,
  };
}
