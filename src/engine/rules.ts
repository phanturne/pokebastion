import { CLASS_MINOR_UPGRADES, CLASS_MINOR_UPGRADE_MAP } from '../data/classes';
import {
  HELD_ITEMS,
  POKEMON_SPECIES,
  REWARD_POOL,
  STRUCTURE_SPECS,
} from '../data/pokemon';
import {
  GamePhase,
  MinorUpgradeSpec,
  PokemonBranch,
  PokemonSpecies,
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

export function doesMinorUpgradeMatchSpecies(
  upgrade: MinorUpgradeSpec,
  species: Pick<PokemonSpecies, 'pokeClass' | 'secondaryClass' | 'subclass'>,
): boolean {
  const matchesClass =
    species.pokeClass === upgrade.targetClass ||
    species.secondaryClass === upgrade.targetClass;
  if (!matchesClass) return false;
  if (upgrade.targetSubclass && species.subclass !== upgrade.targetSubclass) {
    return false;
  }
  return true;
}

export function getEligibleMinorUpgrades(
  species: Pick<PokemonSpecies, 'pokeClass' | 'secondaryClass' | 'subclass'>,
  ownedUpgradeIds: string[] = [],
): MinorUpgradeSpec[] {
  return CLASS_MINOR_UPGRADES.filter(
    (u) =>
      !ownedUpgradeIds.includes(u.id) &&
      doesMinorUpgradeMatchSpecies(u, species),
  );
}

function getMatchingMinorUpgrades(
  speciesId: string,
  upgrades: string[],
): MinorUpgradeSpec[] {
  const sp = POKEMON_SPECIES[speciesId];
  if (!sp || upgrades.length === 0) return [];
  const matched: MinorUpgradeSpec[] = [];
  for (const id of upgrades) {
    const spec = CLASS_MINOR_UPGRADE_MAP[id];
    if (spec && doesMinorUpgradeMatchSpecies(spec, sp)) {
      matched.push(spec);
    }
  }
  return matched;
}

export function getEffectiveMoveRange(
  baseMoveRange: number,
  upgrades: string[],
  branch?: PokemonBranch,
  speciesId?: string,
): number {
  let bonus = branch?.moveRangeBonus ?? 0;
  if (speciesId) {
    for (const u of getMatchingMinorUpgrades(speciesId, upgrades)) {
      if (u.moveRangeBonus) bonus += u.moveRangeBonus;
    }
  }
  return baseMoveRange + bonus;
}

/**
 * Returns the AP cost to move from (fromX, fromY) to (toX, toY), or null if same tile.
 * During PREP phase, any reachable tile costs 0 AP;
 * during COMBAT, moving to any valid tile costs 1 AP.
 */
export function getMovementCost(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  _moveRange: number,
  phase: GamePhase,
): number | null {
  if (fromX === toX && fromY === toY) return null;
  if (phase === 'PREP') return 0;
  return 1;
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
  for (const u of getMatchingMinorUpgrades(speciesId, upgrades)) {
    if (u.hpMult) mult *= u.hpMult;
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
  for (const u of getMatchingMinorUpgrades(speciesId, upgrades)) {
    if (u.atkMult) mult *= u.atkMult;
  }
  return Math.round(base * mult);
}

export function getEffectiveDef(
  speciesId: string,
  branchId: string | null = null,
  heldItems: string[] = [],
  upgrades: string[] = [],
): number {
  let def = POKEMON_SPECIES[speciesId]?.def ?? 0;
  const branch = getBranchSpec(speciesId, branchId);
  if (branch?.defBonus) def += branch.defBonus;
  for (const itemId of heldItems) {
    const item = HELD_ITEMS[itemId];
    if (item?.defBonus) def += item.defBonus;
  }
  for (const u of getMatchingMinorUpgrades(speciesId, upgrades)) {
    if (u.defBonus) def += u.defBonus;
  }
  return def;
}

export function getEffectiveRange(
  speciesId: string,
  branchId: string | null = null,
  upgrades: string[] = [],
): number {
  let range = POKEMON_SPECIES[speciesId]?.range ?? 1;
  const branch = getBranchSpec(speciesId, branchId);
  if (branch?.rangeBonus) range += branch.rangeBonus;
  for (const u of getMatchingMinorUpgrades(speciesId, upgrades)) {
    if (u.rangeBonus) range += u.rangeBonus;
  }
  return range;
}

export function getEffectiveAttackIntervalMs(
  speciesId: string,
  artifacts: string[],
  branchId: string | null = null,
  heldItems: string[] = [],
  upgrades: string[] = [],
): number {
  let interval = POKEMON_SPECIES[speciesId]?.attackIntervalMs ?? 1000;
  if (artifacts.includes('arcane_conduit')) interval *= 0.8;
  const branch = getBranchSpec(speciesId, branchId);
  if (branch?.attackIntervalMult) interval *= branch.attackIntervalMult;
  for (const itemId of heldItems) {
    const item = HELD_ITEMS[itemId];
    if (item?.attackIntervalMult) interval *= item.attackIntervalMult;
  }
  for (const u of getMatchingMinorUpgrades(speciesId, upgrades)) {
    if (u.attackIntervalMult) interval *= u.attackIntervalMult;
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
  includeClassMinorUpgrades = false,
): RewardOption[] {
  const availableRewards: RewardOption[] = REWARD_POOL.filter(
    (r) =>
      (r.kind === 'upgrade' && !ownedUpgrades.includes(r.id)) ||
      (r.kind === 'artifact' && !ownedArtifacts.includes(r.id)),
  );

  if (includeClassMinorUpgrades) {
    const minorPool = new Map<string, RewardOption>();
    for (const speciesId of ownedSpeciesIds) {
      const sp = POKEMON_SPECIES[speciesId];
      if (!sp) continue;
      for (const u of getEligibleMinorUpgrades(sp, ownedUpgrades)) {
        if (!minorPool.has(u.id)) {
          minorPool.set(u.id, {
            id: u.id,
            kind: 'upgrade',
            title: u.title,
            desc: u.desc,
            targetClass: u.targetClass,
          });
        }
      }
    }
    availableRewards.push(...minorPool.values());
  }

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
