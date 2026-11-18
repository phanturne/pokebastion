import { describe, expect, it } from 'vitest';
import {
  BASE_AP_KILL_THRESHOLD,
  TEMPORAL_GEAR_KILL_THRESHOLD,
  chebyshevDist,
  generateRewardChoices,
  getApKillThreshold,
  getBountyGold,
  getEffectiveAtk,
  getEffectiveAttackIntervalMs,
  getEffectiveMaxHp,
  getEffectiveMoveRange,
  getEffectiveStructureMaxHp,
  getMovementCost,
  getRepairCost,
  getSellRefund,
} from '../src/engine/rules';

describe('Game Rules, AP Movement & Economy', () => {
  it('computes two-ring AP movement costs during COMBAT and 0 AP during PREP', () => {
    expect(chebyshevDist(2, 3, 4, 5)).toBe(2);
    // Same tile is invalid (null)
    expect(getMovementCost(2, 3, 2, 3, 2, 'COMBAT')).toBeNull();
    // Prep is free
    expect(getMovementCost(0, 0, 10, 8, 2, 'PREP')).toBe(0);
    // Standard ring (1..moveRange) = 1 AP
    expect(getMovementCost(5, 5, 7, 6, 2, 'COMBAT')).toBe(1);
    // Extended ring (moveRange+1..2*moveRange) = 2 AP
    expect(getMovementCost(5, 5, 8, 5, 2, 'COMBAT')).toBe(2);
    expect(getMovementCost(5, 5, 9, 5, 2, 'COMBAT')).toBe(2);
    // Out of range (> 2*moveRange) = null
    expect(getMovementCost(5, 5, 10, 5, 2, 'COMBAT')).toBeNull();
  });

  it('applies upgrades and artifacts to unit & structure stats', () => {
    expect(getEffectiveMoveRange(2, [])).toBe(2);
    expect(getEffectiveMoveRange(2, ['swift_boots'])).toBe(3);

    expect(getEffectiveMaxHp('0025', [])).toBe(140);
    expect(getEffectiveMaxHp('0025', ['thick_hide'])).toBe(
      Math.round(140 * 1.3),
    );

    expect(getEffectiveAtk('0025', [])).toBe(26);
    expect(getEffectiveAtk('0025', ['sharp_claws'], true)).toBe(
      Math.round(26 * 1.35),
    );

    expect(getEffectiveAttackIntervalMs('0025', [])).toBe(900);
    expect(getEffectiveAttackIntervalMs('0025', ['arcane_conduit'])).toBe(720);

    expect(
      getEffectiveStructureMaxHp('wood_wall', ['fortification_core']),
    ).toBe(168);
    expect(
      getEffectiveStructureMaxHp('berry_bush', ['fortification_core']),
    ).toBe(150);
  });

  it('calculates sell refunds, repair costs, and AP/bounty artifacts', () => {
    expect(getSellRefund('wood_wall')).toBe(14); // 70% of 20
    expect(getRepairCost('stone_wall')).toBe(25); // 50% of 50
    expect(getRepairCost('stone_wall', 150, 300)).toBe(13); // proportional 50% missing
    expect(getRepairCost('stone_wall', 300, 300)).toBe(0);
    expect(getApKillThreshold([])).toBe(BASE_AP_KILL_THRESHOLD);
    expect(getApKillThreshold(['temporal_gear'])).toBe(
      TEMPORAL_GEAR_KILL_THRESHOLD,
    );
    expect(getBountyGold(20, ['commanders_insignia'])).toBe(25);
  });

  it('generates 3 unique reward choices without duplicating owned upgrades/artifacts', () => {
    const ownedSpecies = new Set([
      '0025',
      '0004',
      '0001',
      '0143',
      '0007',
      '0074',
    ]);
    const choices = generateRewardChoices(
      ownedSpecies,
      ['sharp_claws'],
      ['temporal_gear'],
      () => 0.42,
    );

    expect(choices).toHaveLength(3);
    const ids = new Set(choices.map((c) => c.id));
    expect(ids.size).toBe(3);
    expect(ids.has('sharp_claws')).toBe(false);
    expect(ids.has('temporal_gear')).toBe(false);
    expect(choices.some((c) => c.kind === 'recruit')).toBe(true);
  });
});
