import { PokemonBranch } from '../types';

export interface BasicAttackDamageInput {
  baseAtk: number;
  speciesId: string;
  hitCount: number;
  branchSpecial?: PokemonBranch['special'];
  heldItems: readonly string[];
  targetHp: number;
  targetMaxHp: number;
  targetHasStatus: boolean;
}

export interface BasicAttackDamageResult {
  damage: number;
  isCrit: boolean;
  ultCharge: number;
  lifestealHeal: number;
  chainDamage: number;
}

export function computeBasicAttackDamage(
  input: BasicAttackDamageInput,
): BasicAttackDamageResult {
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

  return {
    damage,
    isCrit,
    ultCharge,
    lifestealHeal,
    chainDamage,
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
