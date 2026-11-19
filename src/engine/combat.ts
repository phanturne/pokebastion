import { POKEMON_SPECIES } from '../data/pokemon';
import { MovementType, PokemonBranch, PokemonSubclass } from '../types';
import { getPotentialBonuses } from './progression';
import {
  getEffectiveAtk,
  getEffectiveAttackIntervalMs,
  getEffectiveDef,
  getEffectiveMaxHp,
  getEffectiveRange,
} from './rules';

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
}

export interface BasicAttackDamageResult {
  damage: number;
  isCrit: boolean;
  ultCharge: number;
  lifestealHeal: number;
  chainDamage: number;
  chainTargets: number;
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
}

export interface EnemyAttackDamageResult {
  damage: number;
  reflectedThorns: number;
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

  const reflectedThorns =
    input.unitBranchSpecial === 'thorns'
      ? Math.max(2, Math.round(damage * 0.25))
      : 0;

  return { damage, reflectedThorns };
}
