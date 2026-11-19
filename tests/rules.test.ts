import { describe, expect, it } from 'vitest';
import { POKEMON_SPECIES, REWARD_POOL } from '../src/data/pokemon';
import {
  BASE_AP_KILL_THRESHOLD,
  DRAFT_BUDGET,
  MAX_ACTIVE_UNITS,
  MAX_RESERVE_UNITS,
  TEMPORAL_GEAR_KILL_THRESHOLD,
  canDraftSpecies,
  chebyshevDist,
  computeProjectileLaunch,
  generateRewardChoices,
  getApKillThreshold,
  getBountyGold,
  getDraftCost,
  getEffectiveAtk,
  getEffectiveAttackIntervalMs,
  getEffectiveDef,
  getEffectiveMaxHp,
  getEffectiveMoveRange,
  getEffectiveRange,
  getEffectiveStructureMaxHp,
  getMovementCost,
  getRepairCost,
  getSellRefund,
  isInCircularRange,
  isShopAfterWave,
} from '../src/engine/rules';

describe('Game Rules, AP Movement & Economy', () => {
  it('computes 1 AP map-wide movement during COMBAT and 0 AP during PREP', () => {
    expect(chebyshevDist(2, 3, 4, 5)).toBe(2);
    // Same tile is invalid (null)
    expect(getMovementCost(2, 3, 2, 3, 2, 'COMBAT')).toBeNull();
    // Prep is free
    expect(getMovementCost(0, 0, 10, 8, 2, 'PREP')).toBe(0);
    // Any other tile during COMBAT costs 1 AP regardless of distance
    expect(getMovementCost(5, 5, 7, 6, 2, 'COMBAT')).toBe(1);
    expect(getMovementCost(5, 5, 25, 15, 1, 'COMBAT')).toBe(1);
  });

  it('applies upgrades and artifacts to unit & structure stats', () => {
    expect(getEffectiveMoveRange(2, [])).toBe(2);

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

  it('evaluates circular attack range (including range-1 diagonals, excluding square corners)', () => {
    // range = 1: cardinal and diagonal neighbors are inside radius 1.5
    expect(isInCircularRange(5, 5, 6, 5, 1)).toBe(true);
    expect(isInCircularRange(5, 5, 6, 6, 1)).toBe(true);
    expect(isInCircularRange(5, 5, 7, 5, 1)).toBe(false);

    // range = 2: (2,0) and (2,1) are inside radius 2.5, corner (2,2) is outside
    expect(isInCircularRange(5, 5, 7, 5, 2)).toBe(true);
    expect(isInCircularRange(5, 5, 7, 6, 2)).toBe(true);
    expect(isInCircularRange(5, 5, 7, 7, 2)).toBe(false);

    // range = 3: (2,2) is inside radius 3.5, (3,2) and (3,3) are outside
    expect(isInCircularRange(5, 5, 7, 7, 3)).toBe(true);
    expect(isInCircularRange(5, 5, 8, 7, 3)).toBe(false);
    expect(isInCircularRange(5, 5, 8, 8, 3)).toBe(false);

    expect(isInCircularRange(5, 5, 5, 5, -1)).toBe(false);
  });

  it('computes muzzle-offset projectile spawn and angle toward target', () => {
    // Shooting diagonally down-right (45 deg)
    const diag = computeProjectileLaunch(100, 100, 200, 200, 16);
    expect(diag.rotation).toBeCloseTo(Math.PI / 4, 6);
    expect(diag.startX).toBeCloseTo(100 + Math.SQRT1_2 * 16, 4);
    expect(diag.startY).toBeCloseTo(100 + Math.SQRT1_2 * 16, 4);

    // Shooting straight up (-90 deg)
    const up = computeProjectileLaunch(100, 100, 100, 20, 16);
    expect(up.rotation).toBeCloseTo(-Math.PI / 2, 6);
    expect(up.startX).toBeCloseTo(100, 6);
    expect(up.startY).toBeCloseTo(84, 6);

    // Clamps offset when target is very close so spawn doesn't overshoot target
    const close = computeProjectileLaunch(100, 100, 110, 100, 16);
    expect(close.startX).toBeCloseTo(105, 6);
    expect(close.startY).toBeCloseTo(100, 6);

    // Zero-distance edge case returns finite fallback without NaN
    const same = computeProjectileLaunch(50, 60, 50, 60, 16);
    expect(same).toEqual({ startX: 50, startY: 60, rotation: 0 });
  });

  it('handles repair cost floor, unknown species fallbacks, and exhausted reward pools', () => {
    // 5g minimum floor on tiny damage (1/300 missing on 50g stone_wall)
    expect(getRepairCost('stone_wall', 299, 300)).toBe(5);
    // Overhealed or invalid maxHp edge cases
    expect(getRepairCost('stone_wall', 320, 300)).toBe(0);
    expect(getRepairCost('stone_wall', 100, 0)).toBe(25);

    // Non-wall structures ignore fortification_core; stone_wall gets 1.4x
    expect(
      getEffectiveStructureMaxHp('stone_wall', ['fortification_core']),
    ).toBe(420);
    expect(
      getEffectiveStructureMaxHp('berry_bush', ['fortification_core']),
    ).toBe(150);

    // Unknown speciesId fallbacks & unboosted bounty
    expect(getEffectiveMaxHp('9999', [])).toBe(100);
    expect(getEffectiveAtk('9999', [])).toBe(20);
    expect(getEffectiveAttackIntervalMs('9999', [])).toBe(1000);
    expect(getBountyGold(20, [])).toBe(20);

    // Exhausted recruit pool still fills 3 upgrade/artifact choices
    const allSpecies = new Set(Object.keys(POKEMON_SPECIES));
    const poolOnly = generateRewardChoices(allSpecies, [], [], () => 0.1);
    expect(poolOnly).toHaveLength(3);
    expect(poolOnly.every((c) => c.kind !== 'recruit')).toBe(true);

    // Fully exhausted pool returns empty array
    const allUpgrades = REWARD_POOL.filter((r) => r.kind === 'upgrade').map(
      (r) => r.id,
    );
    const allArtifacts = REWARD_POOL.filter((r) => r.kind === 'artifact').map(
      (r) => r.id,
    );
    const exhausted = generateRewardChoices(
      allSpecies,
      allUpgrades,
      allArtifacts,
      () => 0.5,
    );
    expect(exhausted).toEqual([]);
  });

  it('enforces 10-point starter draft budget and branch/held-item modifiers', () => {
    const starters = ['0007', '0004', '0001']; // 3 + 3 + 3 = 9 pts
    expect(getDraftCost(starters)).toBe(9);
    expect(canDraftSpecies(starters, '0007', DRAFT_BUDGET)).toBe(false); // duplicate
    expect(canDraftSpecies(starters, '0074', DRAFT_BUDGET)).toBe(false); // 9 + 2 > 10

    // Branch + held item stacking
    expect(
      getEffectiveAtk('0004', [], false, 'charmander_charizard', [
        'bloodthirsty_edge',
      ]),
    ).toBe(Math.round(24 * 1.3 * 1.15));
    expect(
      getEffectiveDef('0007', 'squirtle_bastion', ['guardian_charm']),
    ).toBe(18 + 8 + 5);
    expect(getEffectiveRange('0007', 'squirtle_blastoise')).toBe(3);
    expect(
      getEffectiveMaxHp('0007', [], 'squirtle_bastion', ['guardian_charm']),
    ).toBe(Math.round(220 * 1.3 * 1.2));

    // Branch reward option is offered when unbranched active units exist
    const withBranch = generateRewardChoices(
      new Set(['0007', '0004', '0001']),
      [],
      [],
      () => 0.1,
      [{ uid: 'u1', speciesId: '0007' }],
    );
    expect(withBranch.some((c) => c.kind === 'branch')).toBe(true);
    expect(withBranch).toHaveLength(3);
  });

  it('covers moveRange branch bonus, attackInterval stacking, def/range fallbacks, draft limits, and minor upgrade deduplication', () => {
    // getEffectiveMoveRange with branch.moveRangeBonus + matching minor upgrade
    expect(
      getEffectiveMoveRange(
        2,
        ['specialist_nimble_step'],
        { id: 'test_b', name: 'Test', desc: 'Test', moveRangeBonus: 2 },
        '0094',
      ),
    ).toBe(5);

    // getEffectiveAttackIntervalMs with artifact + branch.attackIntervalMult + heldItems
    expect(
      getEffectiveAttackIntervalMs(
        '0448',
        ['arcane_conduit'],
        'lucario_steel',
        ['storm_conductor'],
      ),
    ).toBe(Math.round(850 * 0.8 * 0.8 * 0.87));

    // getEffectiveRange & getEffectiveDef stacking + unknown speciesId fallbacks
    expect(getEffectiveRange('9999')).toBe(1);
    expect(getEffectiveDef('9999')).toBe(0);
    expect(
      getEffectiveDef(
        '0007',
        'squirtle_bastion',
        ['guardian_charm'],
        ['defender_iron_plate'],
      ),
    ).toBe(18 + 8 + 5 + 5);
    expect(
      getEffectiveRange('0448', 'lucario_sphere', ['marksman_eagle_eye']),
    ).toBe(2); // marksman_eagle_eye does not apply to Brawler Lucario

    // canDraftSpecies at MAX_ACTIVE_UNITS and unknown speciesId, plus getDraftCost unknown
    expect(
      canDraftSpecies(
        ['0007', '0004', '0001', '0025', '0074', '0143'],
        '0094',
        100,
        MAX_ACTIVE_UNITS,
      ),
    ).toBe(false);
    expect(canDraftSpecies([], '9999')).toBe(false);
    expect(getDraftCost(['9999', '0007'])).toBe(3);

    // getRepairCost negative HP clamping
    expect(getRepairCost('stone_wall', -50, 300)).toBe(25);

    // generateRewardChoices minor upgrade deduplication across multiple same-class species
    const allSpecies = new Set(Object.keys(POKEMON_SPECIES));
    const allBaseUpgrades = REWARD_POOL.filter((r) => r.kind === 'upgrade').map(
      (r) => r.id,
    );
    const allBaseArtifacts = REWARD_POOL.filter(
      (r) => r.kind === 'artifact',
    ).map((r) => r.id);
    const deduped = generateRewardChoices(
      allSpecies,
      allBaseUpgrades,
      allBaseArtifacts,
      () => 0.3,
      [],
      true,
    );
    expect(deduped).toHaveLength(3);
    expect(new Set(deduped.map((c) => c.id)).size).toBe(3);

    // 6 active, 3 reserve cap + recruit suppression when reserve is full
    expect(MAX_ACTIVE_UNITS).toBe(6);
    expect(MAX_RESERVE_UNITS).toBe(3);
    const noRecruitChoices = generateRewardChoices(
      new Set(['0001', '0004']),
      [],
      [],
      () => 0.25,
      [],
      false,
      false,
    );
    expect(noRecruitChoices.some((c) => c.kind === 'recruit')).toBe(false);

    // Every 5th wave (before final wave) triggers Merchant Shop
    expect(isShopAfterWave(1, 10)).toBe(false);
    expect(isShopAfterWave(4, 10)).toBe(false);
    expect(isShopAfterWave(5, 10)).toBe(true);
    expect(isShopAfterWave(6, 10)).toBe(false);
    expect(isShopAfterWave(10, 10)).toBe(false);
  });
});
