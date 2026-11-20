import { POKEMON_SPECIES } from '../data/pokemon';
import {
  MovementType,
  PokemonBranch,
  PokemonSubclass,
  TARGET_PRIORITIES,
  TargetPriority,
} from '../types';
import { getPotentialBonuses } from './progression';
import {
  getEffectiveAtk,
  getEffectiveAttackIntervalMs,
  getEffectiveDef,
  getEffectiveMaxHp,
  getEffectiveRange,
} from './rules';
import {
  EffectivenessTier,
  PokemonElementType,
  computeTypeEffectiveness,
  getSpeciesTypes,
} from './typeChart';

export { TARGET_PRIORITIES };
export type { TargetPriority };

export const TARGET_PRIORITY_LABELS: Record<TargetPriority, string> = {
  first: 'First',
  last: 'Last',
  close: 'Close',
  strong: 'Strong',
  advantageous: 'Advantageous',
};

function getSpeciesPotentialBonuses(
  speciesId: string,
  potential = 0,
  subclass?: PokemonSubclass,
) {
  return getPotentialBonuses(
    potential,
    subclass ?? POKEMON_SPECIES[speciesId]?.subclass,
  );
}

export function computeUnitMaxHp(
  speciesId: string,
  upgrades: string[],
  branchId: string | null = null,
  heldItems: string[] = [],
  potential = 0,
  subclass?: PokemonSubclass,
): number {
  const base = getEffectiveMaxHp(speciesId, upgrades, branchId, heldItems);
  const bonuses = getSpeciesPotentialBonuses(speciesId, potential, subclass);
  const bastionHpMult = bonuses.subclassPassive === 'Bastion' ? 1.1 : 1;
  return Math.round(base * bonuses.hpMult * bastionHpMult);
}

export function computeUnitAtk(
  speciesId: string,
  upgrades: string[],
  hasBulbasaurAura = false,
  branchId: string | null = null,
  heldItems: string[] = [],
  potential = 0,
): number {
  const base = getEffectiveAtk(
    speciesId,
    upgrades,
    hasBulbasaurAura,
    branchId,
    heldItems,
  );
  const bonuses = getSpeciesPotentialBonuses(speciesId, potential);
  return Math.round(base * bonuses.atkMult);
}

export function computeUnitDef(
  speciesId: string,
  branchId: string | null = null,
  heldItems: string[] = [],
  upgrades: string[] = [],
  potential = 0,
  subclass?: PokemonSubclass,
): number {
  const base = getEffectiveDef(speciesId, branchId, heldItems, upgrades);
  const bonuses = getSpeciesPotentialBonuses(speciesId, potential, subclass);
  return base + (bonuses.subclassPassive === 'Bastion' ? 5 : 0);
}

export function computeUnitRange(
  speciesId: string,
  branchId: string | null = null,
  upgrades: string[] = [],
  potential = 0,
  subclass?: PokemonSubclass,
): number {
  const base = getEffectiveRange(speciesId, branchId, upgrades);
  const bonuses = getSpeciesPotentialBonuses(speciesId, potential, subclass);
  return base + (bonuses.subclassPassive === 'Sniper' ? 1 : 0);
}

export function computeUnitAttackIntervalMs(
  speciesId: string,
  artifacts: string[],
  branchId: string | null = null,
  heldItems: string[] = [],
  upgrades: string[] = [],
  potential = 0,
): number {
  const base = getEffectiveAttackIntervalMs(
    speciesId,
    artifacts,
    branchId,
    heldItems,
    upgrades,
  );
  const bonuses = getSpeciesPotentialBonuses(speciesId, potential);
  return Math.round(base * bonuses.attackIntervalMult);
}

export function computeStartingUlt(ultMax: number, potential = 0): number {
  const bonuses = getPotentialBonuses(potential);
  return Math.round(ultMax * bonuses.startingUltRatio);
}

export function computeKillBounty(
  baseBounty: number,
  hasCommandersInsignia: boolean,
  potential = 0,
): number {
  const artifactMult = hasCommandersInsignia ? 1.25 : 1;
  const bonuses = getPotentialBonuses(potential);
  return Math.round(baseBounty * artifactMult * bonuses.killGoldMult);
}

export function computeUltPower(
  baseAtk: number,
  ultMult: number,
  isHeal: boolean,
  potential = 0,
  subclass?: PokemonSubclass,
): number {
  const bonuses = getPotentialBonuses(potential, subclass);
  if (isHeal) {
    const healMult = bonuses.subclassPassive === 'Healer' ? 1.25 : 1;
    return Math.round(baseAtk * 2.5 * ultMult * healMult);
  }
  const aoeMult = bonuses.subclassPassive === 'Elemental AoE' ? 1.15 : 1;
  return Math.round(baseAtk * 2.2 * ultMult * aoeMult);
}

export function computeSlowDurationMs(
  baseDurationMs: number,
  potential = 0,
  subclass?: PokemonSubclass,
): number {
  const bonuses = getPotentialBonuses(potential, subclass);
  const slowMult = bonuses.subclassPassive === 'Displacer' ? 1.25 : 1;
  return Math.round(baseDurationMs * slowMult);
}

export interface BasicAttackDamageInput {
  baseAtk: number;
  speciesId: string;
  hitCount: number;
  branchSpecial?: PokemonBranch['special'];
  heldItems: readonly string[];
  targetHp: number;
  targetMaxHp: number;
  targetHasStatus: boolean;
  potential?: number;
  subclass?: PokemonSubclass;
  targetMovementType?: MovementType;
  attackType?: PokemonElementType;
  defenderTypes?: readonly PokemonElementType[];
}

export interface BasicAttackDamageResult {
  damage: number;
  isCrit: boolean;
  ultCharge: number;
  lifestealHeal: number;
  chainDamage: number;
  chainTargets: number;
  effectivenessTier: EffectivenessTier;
  effectivenessMultiplier: number;
}

export function computeBasicAttackDamage(
  input: BasicAttackDamageInput,
): BasicAttackDamageResult {
  const bonuses = getPotentialBonuses(
    input.potential ?? 0,
    input.subclass ?? POKEMON_SPECIES[input.speciesId]?.subclass,
  );
  let damage = input.baseAtk;
  let isCrit = false;

  if (input.speciesId === '0448' && input.hitCount % 4 === 0) {
    damage = Math.round(damage * 1.75);
    isCrit = true;
  } else if (input.branchSpecial === 'crit_boost' && input.hitCount % 5 === 0) {
    damage = Math.round(damage * 1.6);
    isCrit = true;
  }

  if (input.speciesId === '0094' && input.targetHasStatus) {
    damage = Math.round(damage * 1.35);
  }

  if (
    bonuses.subclassPassive === 'Sniper' &&
    input.targetMovementType === 'fly'
  ) {
    damage = Math.round(damage * 1.2);
  }

  if (
    input.heldItems.includes('bloodthirsty_edge') &&
    input.targetHp < input.targetMaxHp * 0.5
  ) {
    damage = Math.round(damage * 1.35);
  }

  const eff =
    input.attackType && input.defenderTypes && input.defenderTypes.length > 0
      ? computeTypeEffectiveness(input.attackType, input.defenderTypes)
      : { multiplier: 1.0, tier: 'neutral' as EffectivenessTier };
  if (eff.multiplier !== 1.0) {
    damage = Math.max(1, Math.round(damage * eff.multiplier));
  }

  const ultCharge = 15 * (input.speciesId === '0025' ? 1.1 : 1);
  const lifestealHeal =
    input.branchSpecial === 'lifesteal'
      ? Math.max(1, Math.round(damage * 0.25))
      : 0;
  const hasChain =
    input.branchSpecial === 'chain_hit' ||
    input.heldItems.includes('storm_conductor');
  const chainDamage = hasChain ? Math.max(1, Math.round(damage * 0.4)) : 0;
  const chainTargets = hasChain
    ? bonuses.subclassPassive === 'Chain'
      ? 2
      : 1
    : 0;

  return {
    damage,
    isCrit,
    ultCharge,
    lifestealHeal,
    chainDamage,
    chainTargets,
    effectivenessTier: eff.tier,
    effectivenessMultiplier: eff.multiplier,
  };
}

export interface EnemyAttackDamageInput {
  enemyAtk: number;
  unitDef: number;
  unitSpeciesId: string;
  unitStationaryMs: number;
  unitHeldItems: readonly string[];
  unitAdjacentToStructure: boolean;
  unitBranchSpecial?: PokemonBranch['special'];
  attackType?: PokemonElementType;
  defenderTypes?: readonly PokemonElementType[];
}

export interface EnemyAttackDamageResult {
  damage: number;
  reflectedThorns: number;
  effectivenessTier: EffectivenessTier;
  effectivenessMultiplier: number;
}

export function computeEnemyAttackDamage(
  input: EnemyAttackDamageInput,
): EnemyAttackDamageResult {
  let damage = Math.max(
    2,
    Math.round(input.enemyAtk * (40 / (40 + input.unitDef))),
  );

  if (input.unitSpeciesId === '0143' && input.unitStationaryMs >= 500) {
    damage = Math.max(2, Math.round(damage * 0.75));
  }

  if (
    input.unitHeldItems.includes('guardian_charm') &&
    input.unitAdjacentToStructure
  ) {
    damage = Math.max(2, Math.round(damage * 0.75));
  }

  const eff =
    input.attackType && input.defenderTypes && input.defenderTypes.length > 0
      ? computeTypeEffectiveness(input.attackType, input.defenderTypes)
      : { multiplier: 1.0, tier: 'neutral' as EffectivenessTier };
  if (eff.multiplier !== 1.0) {
    damage = Math.max(2, Math.round(damage * eff.multiplier));
  }

  const reflectedThorns =
    input.unitBranchSpecial === 'thorns'
      ? Math.max(2, Math.round(damage * 0.25))
      : 0;

  return {
    damage,
    reflectedThorns,
    effectivenessTier: eff.tier,
    effectivenessMultiplier: eff.multiplier,
  };
}

export interface EnemyTargetUnit {
  uid: string;
  gx: number;
  gy: number;
  hp: number;
  isFlying?: boolean;
}

export interface EnemyTargetGridPoint {
  gx: number;
  gy: number;
}

export interface SelectEnemyTargetInput {
  gx: number;
  gy: number;
  range?: number;
  aggroRadius?: number;
  ignoresUnits?: boolean;
  movementType?: MovementType;
  units: readonly EnemyTargetUnit[];
  coreCells: readonly EnemyTargetGridPoint[];
}

export interface EnemyTargetDecision {
  attackUnitUid: string | null;
  aggroUnitUid: string | null;
  attackCoreCell: EnemyTargetGridPoint | null;
}

/**
 * Checks whether target `(bx, by)` is within an enemy's attack range from `(ax, ay)`.
 * Melee (`range <= 1`) uses Manhattan distance `<= 1`; ranged (`range > 1`) uses Chebyshev distance `<= range`.
 */
export function isEnemyInAttackRange(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  range = 1,
): boolean {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return range > 1 ? Math.max(dx, dy) <= range : dx + dy <= 1;
}

function pickNearestLowestHpUnit(
  gx: number,
  gy: number,
  units: readonly EnemyTargetUnit[],
  predicate: (u: EnemyTargetUnit) => boolean,
): EnemyTargetUnit | null {
  let best: EnemyTargetUnit | null = null;
  let bestDist = Infinity;
  let bestHp = Infinity;
  for (const u of units) {
    if (u.hp <= 0 || !predicate(u)) continue;
    const dist = Math.hypot(u.gx - gx, u.gy - gy);
    if (
      dist < bestDist - 1e-6 ||
      (Math.abs(dist - bestDist) <= 1e-6 && u.hp < bestHp)
    ) {
      bestDist = dist;
      bestHp = u.hp;
      best = u;
    }
  }
  return best;
}

/**
 * Selects an enemy's target:
 * 1) Unless `ignoresUnits`, prioritize living units within 1 cell over the Core.
 * 2) If a Core cell is in attack range, attack it (unless overridden by step 1).
 * 3) Unless `ignoresUnits`, attack nearest (then lowest HP) living unit in attack range,
 *    or aggro onto nearest living unit within `aggroRadius` (default 1 cell).
 */
export function selectEnemyTarget(
  input: SelectEnemyTargetInput,
): EnemyTargetDecision {
  const range = input.range ?? 1;
  const aggroRadius = input.aggroRadius ?? 1;
  const canTargetFlying = input.movementType === 'fly' || range > 1;

  let bestCore: EnemyTargetGridPoint | null = null;
  let bestCoreDist = Infinity;
  for (const c of input.coreCells) {
    if (!isEnemyInAttackRange(input.gx, input.gy, c.gx, c.gy, range)) continue;
    const dist = Math.hypot(c.gx - input.gx, c.gy - input.gy);
    if (dist < bestCoreDist) {
      bestCoreDist = dist;
      bestCore = c;
    }
  }

  if (!input.ignoresUnits) {
    const closeUnit = pickNearestLowestHpUnit(
      input.gx,
      input.gy,
      input.units,
      (u) =>
        (canTargetFlying || !u.isFlying) &&
        Math.max(Math.abs(u.gx - input.gx), Math.abs(u.gy - input.gy)) <= 1 &&
        isEnemyInAttackRange(input.gx, input.gy, u.gx, u.gy, range),
    );
    if (closeUnit) {
      return {
        attackUnitUid: closeUnit.uid,
        aggroUnitUid: null,
        attackCoreCell: null,
      };
    }

    if (bestCore) {
      return {
        attackUnitUid: null,
        aggroUnitUid: null,
        attackCoreCell: bestCore,
      };
    }

    const attackUnit = pickNearestLowestHpUnit(
      input.gx,
      input.gy,
      input.units,
      (u) =>
        (canTargetFlying || !u.isFlying) &&
        isEnemyInAttackRange(input.gx, input.gy, u.gx, u.gy, range),
    );
    if (attackUnit) {
      return {
        attackUnitUid: attackUnit.uid,
        aggroUnitUid: null,
        attackCoreCell: null,
      };
    }

    const aggroUnit = pickNearestLowestHpUnit(
      input.gx,
      input.gy,
      input.units,
      (u) =>
        (canTargetFlying || !u.isFlying) &&
        Math.max(Math.abs(u.gx - input.gx), Math.abs(u.gy - input.gy)) <=
          aggroRadius,
    );
    if (aggroUnit) {
      return {
        attackUnitUid: null,
        aggroUnitUid: aggroUnit.uid,
        attackCoreCell: null,
      };
    }
  }

  return {
    attackUnitUid: null,
    aggroUnitUid: null,
    attackCoreCell: bestCore,
  };
}

export interface UnitTargetCandidate {
  uid: string;
  gx: number;
  gy: number;
  hp: number;
  speciesId: string;
  coreProgressDist: number;
}

/**
 * Selects the best target for a unit according to its BTD6-style targeting priority.
 */
export function selectUnitTarget(input: {
  unitGx: number;
  unitGy: number;
  attackType: PokemonElementType;
  priority?: TargetPriority;
  candidates: readonly UnitTargetCandidate[];
}): UnitTargetCandidate | null {
  const priority: TargetPriority = input.priority ?? 'first';
  let best: UnitTargetCandidate | null = null;
  let bestPrimary = 0;
  let bestSecondary = 0;

  for (const c of input.candidates) {
    if (c.hp <= 0) continue;

    let primary: number;
    let secondary: number;
    let higherIsBetter: boolean;

    switch (priority) {
      case 'last':
        primary = c.coreProgressDist;
        secondary = c.hp;
        higherIsBetter = true;
        break;
      case 'close':
        primary = Math.hypot(c.gx - input.unitGx, c.gy - input.unitGy);
        secondary = c.coreProgressDist;
        higherIsBetter = false;
        break;
      case 'strong':
        primary = c.hp;
        secondary = c.coreProgressDist;
        higherIsBetter = true;
        break;
      case 'advantageous':
        primary = computeTypeEffectiveness(
          input.attackType,
          getSpeciesTypes(c.speciesId),
        ).multiplier;
        secondary = c.coreProgressDist;
        higherIsBetter = true;
        break;
      case 'first':
      default:
        primary = c.coreProgressDist;
        secondary = c.hp;
        higherIsBetter = false;
        break;
    }

    if (!best) {
      best = c;
      bestPrimary = primary;
      bestSecondary = secondary;
      continue;
    }

    const isBetterPrimary = higherIsBetter
      ? primary > bestPrimary + 1e-6
      : primary < bestPrimary - 1e-6;
    const isTiedPrimary = Math.abs(primary - bestPrimary) <= 1e-6;

    if (isBetterPrimary || (isTiedPrimary && secondary < bestSecondary)) {
      best = c;
      bestPrimary = primary;
      bestSecondary = secondary;
    }
  }

  return best;
}
