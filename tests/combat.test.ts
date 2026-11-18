import { describe, expect, it } from 'vitest';
import {
  computeBasicAttackDamage,
  computeEnemyAttackDamage,
} from '../src/engine/combat';

describe('combat damage & effect math', () => {
  it('applies Lucario 4th-hit crit and branch 5th-hit crit_boost', () => {
    const base = computeBasicAttackDamage({
      baseAtk: 40,
      speciesId: '0448',
      hitCount: 3,
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
    });
    expect(base.isCrit).toBe(false);
    expect(base.damage).toBe(40);

    const lucarioCrit = computeBasicAttackDamage({
      baseAtk: 40,
      speciesId: '0448',
      hitCount: 4,
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
    });
    expect(lucarioCrit.isCrit).toBe(true);
    expect(lucarioCrit.damage).toBe(70);

    const branchCrit = computeBasicAttackDamage({
      baseAtk: 40,
      speciesId: '0025',
      hitCount: 5,
      branchSpecial: 'crit_boost',
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
    });
    expect(branchCrit.isCrit).toBe(true);
    expect(branchCrit.damage).toBe(64);
    expect(branchCrit.ultCharge).toBeCloseTo(16.5);
  });

  it('applies Gengar status bonus, bloodthirsty_edge execute, lifesteal, and chain damage', () => {
    const res = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0094',
      hitCount: 1,
      branchSpecial: 'lifesteal',
      heldItems: ['bloodthirsty_edge', 'storm_conductor'],
      targetHp: 40,
      targetMaxHp: 100,
      targetHasStatus: true,
    });
    // 100 * 1.35 = 135; 135 * 1.35 = 182.25 -> 182
    expect(res.damage).toBe(182);
    expect(res.lifestealHeal).toBe(46);
    expect(res.chainDamage).toBe(73);
  });

  it('applies DEF scaling, Snorlax stationary reduction, guardian_charm, and thorns', () => {
    const res = computeEnemyAttackDamage({
      enemyAtk: 40,
      unitDef: 40,
      unitSpeciesId: '0143',
      unitStationaryMs: 500,
      unitHeldItems: ['guardian_charm'],
      unitAdjacentToStructure: true,
      unitBranchSpecial: 'thorns',
    });
    // 40 * (40 / 80) = 20 -> *0.75 = 15 -> *0.75 = 11.25 -> 11; thorns 25% = 3
    expect(res.damage).toBe(11);
    expect(res.reflectedThorns).toBe(3);
  });

  it('clamps minimum enemy damage to 2', () => {
    const res = computeEnemyAttackDamage({
      enemyAtk: 1,
      unitDef: 500,
      unitSpeciesId: '0001',
      unitStationaryMs: 0,
      unitHeldItems: [],
      unitAdjacentToStructure: false,
    });
    expect(res.damage).toBe(2);
    expect(res.reflectedThorns).toBe(0);
  });
});
