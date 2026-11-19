import { describe, expect, it } from 'vitest';
import { POKEMON_SPECIES } from '../src/data/pokemon';
import {
  computeBasicAttackDamage,
  computeEnemyAttackDamage,
  computeKillBounty,
  computeSlowDurationMs,
  computeStartingUlt,
  computeUltPower,
  computeUnitAtk,
  computeUnitAttackIntervalMs,
  computeUnitDef,
  computeUnitMaxHp,
  computeUnitRange,
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

  it('applies Potential ★1-★4 stat, attack speed, kill gold, and starting ult bonuses', () => {
    const baseHp = computeUnitMaxHp('0025', []);
    const baseAtk = computeUnitAtk('0025', []);
    const baseInterval = computeUnitAttackIntervalMs('0025', []);

    expect(computeUnitMaxHp('0025', [], null, [], 1)).toBe(
      Math.round(baseHp * 1.12),
    );
    expect(computeUnitAtk('0025', [], false, null, [], 1)).toBe(
      Math.round(baseAtk * 1.12),
    );

    // ★2 adds +15% attack speed (interval * 1 / 1.15)
    expect(computeUnitAttackIntervalMs('0025', [], null, [], [], 1)).toBe(
      baseInterval,
    );
    expect(computeUnitAttackIntervalMs('0025', [], null, [], [], 2)).toBe(
      Math.round(baseInterval / 1.15),
    );

    // ★3 adds +15% kill gold
    expect(computeKillBounty(20, false, 2)).toBe(20);
    expect(computeKillBounty(20, false, 3)).toBe(23);
    expect(computeKillBounty(20, true, 3)).toBe(Math.round(20 * 1.25 * 1.15));

    // ★4 starts combat with 40% ult
    expect(computeStartingUlt(100, 3)).toBe(0);
    expect(computeStartingUlt(100, 4)).toBe(40);
  });

  it('applies Potential ★5 subclass passives cleanly', () => {
    const bastion = POKEMON_SPECIES['0007'];
    const sniper = POKEMON_SPECIES['0025'];

    // Bastion ★5: +5 DEF & +10% HP (on top of ★1 +12% HP)
    expect(computeUnitDef(bastion.id, null, [], [], 4, 'Bastion')).toBe(
      bastion.def,
    );
    expect(computeUnitDef(bastion.id, null, [], [], 5, 'Bastion')).toBe(
      bastion.def + 5,
    );
    expect(computeUnitMaxHp(bastion.id, [], null, [], 5, 'Bastion')).toBe(
      Math.round(bastion.maxHp * 1.12 * 1.1),
    );

    // Sniper ★5: +1 range & +20% damage vs flying
    expect(computeUnitRange(sniper.id, null, [], 4, 'Sniper')).toBe(
      sniper.range,
    );
    expect(computeUnitRange(sniper.id, null, [], 5, 'Sniper')).toBe(
      sniper.range + 1,
    );
    const vsFly = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: sniper.id,
      hitCount: 1,
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
      potential: 5,
      subclass: 'Sniper',
      targetMovementType: 'fly',
    });
    expect(vsFly.damage).toBe(120);

    // Chain ★5: +1 chain target
    const chainRes = computeBasicAttackDamage({
      baseAtk: 50,
      speciesId: '0025',
      hitCount: 1,
      branchSpecial: 'chain_hit',
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
      potential: 5,
      subclass: 'Chain',
    });
    expect(chainRes.chainTargets).toBe(2);

    // Elemental AoE ★5 (+15% ult), Healer ★5 (+25% heal), Displacer ★5 (+25% slow)
    expect(computeUltPower(100, 1, false, 4, 'Elemental AoE')).toBe(220);
    expect(computeUltPower(100, 1, false, 5, 'Elemental AoE')).toBe(253);
    expect(computeUltPower(100, 1, true, 4, 'Healer')).toBe(250);
    expect(computeUltPower(100, 1, true, 5, 'Healer')).toBe(313);
    expect(computeSlowDurationMs(2000, 4, 'Displacer')).toBe(2000);
    expect(computeSlowDurationMs(2000, 5, 'Displacer')).toBe(2500);
  });
});
