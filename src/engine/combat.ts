import { HELD_ITEMS, POKEMON_SPECIES } from '../data/pokemon';
import {
  MovementType,
  PokemonBranch,
  PokemonSubclass,
  TARGET_PRIORITIES,
  TargetPriority,
} from '../types';
import { getPotentialBonuses } from './progression';
import { getSpeciesKit } from './kits';
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
  heldItems: string[] = [],
): number {
  const base = getEffectiveRange(speciesId, branchId, upgrades, heldItems);
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
  const artifactMult = hasCommandersInsignia ? 1.35 : 1;
  const bonuses = getPotentialBonuses(potential);
  return Math.round(baseBounty * artifactMult * bonuses.killGoldMult);
}

/**
 * ★5 subclass passives handled in pure combat math:
 * - Bastion, Sniper, Chain, Healer, Elemental AoE, Displacer, Artillery (+10% AoE dmg),
 *   Status (computeStatusDurationMs), Duelist, Interceptor, Ambusher, Rapid-Fire, Juggernaut.
 * Scene-level hooks required for: Wallguard (adjacent structure DR), Cleave (splash),
 * Buffer (aura +5% ATK/SPD), Tactician (ally ult charge aura), Hazard Setter (hazard dmg/duration),
 * and Artillery (+20% splash radius).
 */
export function computeUltPower(
  baseAtk: number,
  ultMult: number,
  isHeal: boolean,
  potential = 0,
  subclass?: PokemonSubclass,
  kitPowerMult = 1,
): number {
  const bonuses = getPotentialBonuses(potential, subclass);
  if (isHeal) {
    const healMult = bonuses.subclassPassive === 'Healer' ? 1.25 : 1;
    return Math.round(baseAtk * 2.5 * ultMult * healMult * kitPowerMult);
  }
  const aoeMult =
    bonuses.subclassPassive === 'Elemental AoE'
      ? 1.15
      : bonuses.subclassPassive === 'Artillery'
        ? 1.1
        : 1;
  return Math.round(baseAtk * 2.2 * ultMult * aoeMult * kitPowerMult);
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

export function computeStatusDurationMs(
  baseDurationMs: number,
  potential = 0,
  subclass?: PokemonSubclass,
): number {
  const bonuses = getPotentialBonuses(potential, subclass);
  const statusMult = bonuses.subclassPassive === 'Status' ? 1.25 : 1;
  return Math.round(baseDurationMs * statusMult);
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
  targetIsBoss?: boolean;
  targetIsLeaking?: boolean;
  isFirstAttackAfterMove?: boolean;
  weaknessPolicyActive?: boolean;
  attackType?: PokemonElementType;
  defenderTypes?: readonly PokemonElementType[];
}

export interface BasicAttackDamageResult {
  damage: number;
  isCrit: boolean;
  extraBolt: boolean;
  ultCharge: number;
  lifestealHeal: number;
  chainDamage: number;
  chainTargets: number;
  slowFactor?: number;
  slowDurationMs?: number;
  inflictBurn?: boolean;
  recoilPct?: number;
  effectivenessTier: EffectivenessTier;
  effectivenessMultiplier: number;
}

export function computeBasicAttackDamage(
  input: BasicAttackDamageInput,
): BasicAttackDamageResult {
  const kit = getSpeciesKit(input.speciesId);
  const bonuses = getPotentialBonuses(
    input.potential ?? 0,
    input.subclass ?? POKEMON_SPECIES[input.speciesId]?.subclass,
  );
  let damage = input.baseAtk;
  let isCrit = false;

  let critMult = 1;
  if (
    kit.critEveryN &&
    input.hitCount > 0 &&
    input.hitCount % kit.critEveryN === 0
  ) {
    critMult = Math.max(critMult, kit.critMult ?? 1.75);
  }
  if (
    input.branchSpecial === 'crit_boost' &&
    input.hitCount > 0 &&
    input.hitCount % 5 === 0
  ) {
    critMult = Math.max(critMult, 1.6);
  }
  if (
    input.heldItems.includes('scope_lens') &&
    input.hitCount > 0 &&
    input.hitCount % 4 === 0
  ) {
    critMult = Math.max(critMult, 1.65);
  }
  if (critMult > 1) {
    damage = Math.round(damage * critMult);
    isCrit = true;
  }

  if (input.weaknessPolicyActive) {
    damage = Math.round(damage * 1.2);
  }

  if (kit.statusBonusDmgPct && input.targetHasStatus) {
    damage = Math.round(damage * (1 + kit.statusBonusDmgPct));
  }

  if (kit.executeBonusDmgPct && input.targetHp < input.targetMaxHp * 0.5) {
    damage = Math.round(damage * (1 + kit.executeBonusDmgPct));
  }

  if (kit.armorPiercePct) {
    damage = Math.round(damage * (1 + kit.armorPiercePct * 0.6));
  }

  const antiAirPct =
    (kit.antiAirBonusPct ?? 0) +
    (bonuses.subclassPassive === 'Sniper' ? 0.2 : 0);
  if (antiAirPct > 0 && input.targetMovementType === 'fly') {
    damage = Math.round(damage * (1 + antiAirPct));
  }

  if (bonuses.subclassPassive === 'Duelist' && input.targetIsBoss) {
    damage = Math.round(damage * 1.15);
  }

  if (bonuses.subclassPassive === 'Interceptor' && input.targetIsLeaking) {
    damage = Math.round(damage * 1.15);
  }

  if (bonuses.subclassPassive === 'Ambusher' && input.isFirstAttackAfterMove) {
    damage = Math.round(damage * 1.35);
  }

  if (
    input.heldItems.includes('bloodthirsty_edge') &&
    input.targetHp < input.targetMaxHp * 0.5
  ) {
    damage = Math.round(damage * 1.25);
  }

  if (
    input.heldItems.includes('sacred_crown') &&
    (input.targetIsBoss || input.targetHasStatus)
  ) {
    damage = Math.round(damage * 1.25);
  }

  const eff =
    input.attackType && input.defenderTypes && input.defenderTypes.length > 0
      ? computeTypeEffectiveness(input.attackType, input.defenderTypes)
      : { multiplier: 1.0, tier: 'neutral' as EffectivenessTier };
  if (eff.multiplier !== 1.0) {
    damage = Math.max(1, Math.round(damage * eff.multiplier));
  }

  if (
    input.heldItems.includes('expert_belt') &&
    (eff.multiplier > 1 || input.targetIsBoss)
  ) {
    damage = Math.round(damage * 1.2);
  }

  if (input.heldItems.includes('weakness_policy') && eff.multiplier > 1) {
    damage = Math.round(damage * 1.25);
  }

  let itemUltMult = 1;
  for (const itemId of input.heldItems) {
    const mult = HELD_ITEMS[itemId]?.ultChargeMult;
    if (mult) itemUltMult *= mult;
  }
  const ultCharge = kit.ultChargeOnHitTaken
    ? 0
    : 15 * (1 + (kit.ultChargeBonusPct ?? 0)) * itemUltMult;
  const lifestealPct = Math.max(
    input.branchSpecial === 'lifesteal' ? 0.25 : 0,
    input.heldItems.includes('shell_bell') ? 0.12 : 0,
    kit.onHitLifestealPct ?? 0,
  );
  const lifestealHeal =
    lifestealPct > 0 ? Math.max(1, Math.round(damage * lifestealPct)) : 0;

  const branchChain = input.branchSpecial === 'chain_hit';
  const hasGriseous = input.heldItems.includes('griseous_core');
  const hasStorm = input.heldItems.includes('storm_conductor');
  const itemChainRatio = hasGriseous ? 0.35 : hasStorm ? 0.25 : 0;
  const itemChainTargets = hasGriseous ? 2 : hasStorm ? 1 : 0;
  const kitChain = kit.onHitChain;
  const hasChain = branchChain || itemChainTargets > 0 || Boolean(kitChain);
  const chainRatio = Math.max(
    branchChain ? 0.4 : 0,
    itemChainRatio,
    kitChain?.dmgRatio ?? 0,
  );
  const chainDamage = hasChain
    ? Math.max(1, Math.round(damage * chainRatio))
    : 0;
  const baseTargets = Math.max(
    branchChain ? 1 : 0,
    itemChainTargets,
    kitChain?.targets ?? 0,
  );
  const chainTargets = hasChain
    ? bonuses.subclassPassive === 'Chain'
      ? Math.max(2, baseTargets)
      : baseTargets
    : 0;

  const extraBolt =
    bonuses.subclassPassive === 'Rapid-Fire' &&
    input.hitCount > 0 &&
    input.hitCount % 5 === 0;

  const kingsRockFlinch =
    input.heldItems.includes('kings_rock') &&
    input.hitCount > 0 &&
    input.hitCount % 3 === 0;

  return {
    damage,
    isCrit,
    extraBolt,
    ultCharge,
    lifestealHeal,
    chainDamage,
    chainTargets,
    slowFactor: kingsRockFlinch ? 0.4 : undefined,
    slowDurationMs: kingsRockFlinch ? 1500 : undefined,
    inflictBurn: hasGriseous || undefined,
    recoilPct: input.heldItems.includes('life_orb') ? 0.04 : undefined,
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
  unitPotential?: number;
  unitSubclass?: PokemonSubclass;
  isMelee?: boolean;
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
  const kit = getSpeciesKit(input.unitSpeciesId);
  const bonuses = getSpeciesPotentialBonuses(
    input.unitSpeciesId,
    input.unitPotential ?? 0,
    input.unitSubclass,
  );
  let damage = Math.max(
    2,
    Math.round(input.enemyAtk * (40 / (40 + input.unitDef))),
  );

  if (kit.stationaryDrPct && input.unitStationaryMs >= 500) {
    damage = Math.max(2, Math.round(damage * (1 - kit.stationaryDrPct)));
  }

  if (
    input.unitHeldItems.includes('guardian_charm') &&
    input.unitAdjacentToStructure
  ) {
    damage = Math.max(2, Math.round(damage * 0.82));
  }

  const eff =
    input.attackType && input.defenderTypes && input.defenderTypes.length > 0
      ? computeTypeEffectiveness(input.attackType, input.defenderTypes)
      : { multiplier: 1.0, tier: 'neutral' as EffectivenessTier };
  if (eff.multiplier !== 1.0) {
    damage = Math.max(2, Math.round(damage * eff.multiplier));
  }

  const juggernautThorns =
    bonuses.subclassPassive === 'Juggernaut' && input.isMelee !== false
      ? 0.15
      : 0;
  const itemThorns =
    input.unitHeldItems.includes('rocky_helmet') ||
    input.unitHeldItems.includes('lustrous_aegis')
      ? 0.25
      : 0;
  const thornsPct = Math.max(
    input.unitBranchSpecial === 'thorns' ? 0.25 : 0,
    kit.thornsPct ?? 0,
    juggernautThorns,
    itemThorns,
  );
  const reflectedThorns =
    thornsPct > 0 ? Math.max(2, Math.round(damage * thornsPct)) : 0;

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
