import { describe, expect, it } from 'vitest';
import { POKEMON_SPECIES } from '../src/data/pokemon';
import {
  computeBasicAttackDamage,
  computeEnemyAttackDamage,
  computeKillBounty,
  computeSlowDurationMs,
  computeStartingUlt,
  computeStatusDurationMs,
  computeUltPower,
  computeUnitAtk,
  computeUnitAttackIntervalMs,
  computeUnitDef,
  computeUnitMaxHp,
  computeUnitRange,
  isEnemyInAttackRange,
  selectEnemyTarget,
  selectUnitTarget,
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
    // 100 * 1.35 = 135; 135 * 1.25 = 168.75 -> 169; lifesteal 25% = 42; chain 25% = 42
    expect(res.damage).toBe(169);
    expect(res.lifestealHeal).toBe(42);
    expect(res.chainDamage).toBe(42);
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
    // 40 * (40 / 80) = 20 -> *0.75 = 15 -> *0.82 = 12.3 -> 12; thorns 25% = 3
    expect(res.damage).toBe(12);
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
    expect(computeKillBounty(20, true, 3)).toBe(Math.round(20 * 1.35 * 1.15));

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

  it('checks melee vs ranged enemy attack range', () => {
    expect(isEnemyInAttackRange(5, 5, 6, 5, 1)).toBe(true);
    expect(isEnemyInAttackRange(5, 5, 6, 6, 1)).toBe(false); // diagonal out of melee
    expect(isEnemyInAttackRange(5, 5, 8, 8, 3)).toBe(true); // Chebyshev <= 3
    expect(isEnemyInAttackRange(5, 5, 9, 5, 3)).toBe(false);
  });

  it('selects enemy targets: prioritizes nearby units over Core, aggros within radius, respects ignoresUnits', () => {
    const coreCells = [
      { gx: 13, gy: 8 },
      { gx: 14, gy: 8 },
    ];

    // Unit in melee range takes priority over adjacent Core
    const atCoreWithUnit = selectEnemyTarget({
      gx: 12,
      gy: 8,
      range: 1,
      units: [
        { uid: 'u1', gx: 12, gy: 7, hp: 100 },
        { uid: 'u2', gx: 12, gy: 9, hp: 60 },
      ],
      coreCells,
    });
    expect(atCoreWithUnit.attackUnitUid).toBe('u2'); // same dist, lower HP
    expect(atCoreWithUnit.attackCoreCell).toBeNull();

    // Ranged enemy attacks unit in range (Chebyshev <= 3)
    const rangedAttack = selectEnemyTarget({
      gx: 5,
      gy: 5,
      range: 3,
      units: [
        { uid: 'far', gx: 8, gy: 8, hp: 40 },
        { uid: 'near', gx: 7, gy: 5, hp: 120 },
      ],
      coreCells,
    });
    expect(rangedAttack.attackUnitUid).toBe('near');

    // No unit in attack range, but unit within aggro radius (<= 3)
    const aggro = selectEnemyTarget({
      gx: 5,
      gy: 5,
      range: 1,
      aggroRadius: 3,
      units: [{ uid: 'u3', gx: 8, gy: 7, hp: 80 }],
      coreCells,
    });
    expect(aggro.attackUnitUid).toBeNull();
    expect(aggro.aggroUnitUid).toBe('u3');

    // Ranged enemy in range of Core prioritizes Core unless a unit is within 1 cell
    const rangedAtCoreFarUnit = selectEnemyTarget({
      gx: 11,
      gy: 8,
      range: 3,
      units: [{ uid: 'far', gx: 9, gy: 8, hp: 40 }],
      coreCells,
    });
    expect(rangedAtCoreFarUnit.attackUnitUid).toBeNull();
    expect(rangedAtCoreFarUnit.attackCoreCell).toEqual({ gx: 13, gy: 8 });

    const rangedAtCoreCloseUnit = selectEnemyTarget({
      gx: 11,
      gy: 8,
      range: 3,
      units: [{ uid: 'close', gx: 11, gy: 7, hp: 100 }],
      coreCells,
    });
    expect(rangedAtCoreCloseUnit.attackUnitUid).toBe('close');
    expect(rangedAtCoreCloseUnit.attackCoreCell).toBeNull();

    // Default aggroRadius is 1 cell (units 2+ cells away do not pull melee aggro)
    const noFarAggro = selectEnemyTarget({
      gx: 5,
      gy: 5,
      range: 1,
      units: [{ uid: 'u3', gx: 7, gy: 5, hp: 80 }],
      coreCells,
    });
    expect(noFarAggro.aggroUnitUid).toBeNull();

    // ignoresUnits skips units and attacks Core in range
    const ignore = selectEnemyTarget({
      gx: 12,
      gy: 8,
      range: 1,
      ignoresUnits: true,
      units: [{ uid: 'u1', gx: 12, gy: 7, hp: 10 }],
      coreCells,
    });
    expect(ignore.attackUnitUid).toBeNull();
    expect(ignore.aggroUnitUid).toBeNull();
    expect(ignore.attackCoreCell).toEqual({ gx: 13, gy: 8 });
  });

  it('ground/burrow melee enemies ignore flying units while ranged and flying enemies target them', () => {
    const coreCells = [{ gx: 13, gy: 8 }];
    const units = [{ uid: 'fly1', gx: 12, gy: 8, hp: 100, isFlying: true }];

    // Ground melee ignores flying unit in range and aggro radius
    const groundMelee = selectEnemyTarget({
      gx: 11,
      gy: 8,
      range: 1,
      aggroRadius: 3,
      movementType: 'ground',
      units,
      coreCells,
    });
    expect(groundMelee.attackUnitUid).toBeNull();
    expect(groundMelee.aggroUnitUid).toBeNull();

    // Burrow melee also ignores flying unit
    const burrowMelee = selectEnemyTarget({
      gx: 11,
      gy: 8,
      range: 1,
      aggroRadius: 3,
      movementType: 'burrow',
      units,
      coreCells,
    });
    expect(burrowMelee.attackUnitUid).toBeNull();
    expect(burrowMelee.aggroUnitUid).toBeNull();

    // Ranged ground enemy (range > 1) can target flying unit when Core is out of range
    const groundRanged = selectEnemyTarget({
      gx: 9,
      gy: 8,
      range: 3,
      movementType: 'ground',
      units,
      coreCells,
    });
    expect(groundRanged.attackUnitUid).toBe('fly1');

    // Flying melee enemy can target flying unit
    const flyingMelee = selectEnemyTarget({
      gx: 11,
      gy: 8,
      range: 1,
      movementType: 'fly',
      units,
      coreCells,
    });
    expect(flyingMelee.attackUnitUid).toBe('fly1');
  });

  it('applies elemental type multipliers to both unit and enemy attacks', () => {
    const unitSuper = computeBasicAttackDamage({
      baseAtk: 40,
      speciesId: '0004',
      hitCount: 1,
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
      attackType: 'Fire',
      defenderTypes: ['Grass'],
    });
    expect(unitSuper.damage).toBe(60);
    expect(unitSuper.effectivenessTier).toBe('super');
    expect(unitSuper.effectivenessMultiplier).toBe(1.5);

    const unitExtremely = computeBasicAttackDamage({
      baseAtk: 40,
      speciesId: '0007',
      hitCount: 1,
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
      attackType: 'Water',
      defenderTypes: ['Rock', 'Ground'],
    });
    expect(unitExtremely.damage).toBe(80);
    expect(unitExtremely.effectivenessTier).toBe('extremely');
    expect(unitExtremely.effectivenessMultiplier).toBe(2.0);

    const unitImmune = computeBasicAttackDamage({
      baseAtk: 40,
      speciesId: '0025',
      hitCount: 1,
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
      attackType: 'Electric',
      defenderTypes: ['Ground'],
    });
    expect(unitImmune.damage).toBe(14);
    expect(unitImmune.effectivenessTier).toBe('very_ineffective');
    expect(unitImmune.effectivenessMultiplier).toBe(0.35);

    const enemySuper = computeEnemyAttackDamage({
      enemyAtk: 40,
      unitDef: 40,
      unitSpeciesId: '0001',
      unitStationaryMs: 0,
      unitHeldItems: [],
      unitAdjacentToStructure: false,
      attackType: 'Fire',
      defenderTypes: ['Grass'],
    });
    expect(enemySuper.damage).toBe(30);
    expect(enemySuper.effectivenessTier).toBe('super');
    expect(enemySuper.effectivenessMultiplier).toBe(1.5);

    const enemyNotVery = computeEnemyAttackDamage({
      enemyAtk: 40,
      unitDef: 40,
      unitSpeciesId: '0007',
      unitStationaryMs: 0,
      unitHeldItems: [],
      unitAdjacentToStructure: false,
      attackType: 'Fire',
      defenderTypes: ['Water'],
    });
    expect(enemyNotVery.damage).toBe(10);
    expect(enemyNotVery.effectivenessTier).toBe('not_very');
    expect(enemyNotVery.effectivenessMultiplier).toBe(0.5);
  });
});

describe('selectUnitTarget (BTD6-style targeting priority)', () => {
  const candidates = [
    {
      uid: 'e1',
      gx: 5,
      gy: 5,
      hp: 80,
      speciesId: '0019', // Normal
      coreProgressDist: 6,
    },
    {
      uid: 'e2',
      gx: 2,
      gy: 2,
      hp: 150,
      speciesId: '0001', // Grass/Poison
      coreProgressDist: 10,
    },
    {
      uid: 'e3',
      gx: 4,
      gy: 4,
      hp: 40,
      speciesId: '0074', // Rock/Ground
      coreProgressDist: 3,
    },
  ];

  it('returns null when no living candidates exist', () => {
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        candidates: [],
      }),
    ).toBeNull();
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        candidates: [{ ...candidates[0], hp: 0 }],
      }),
    ).toBeNull();
  });

  it('defaults to first (lowest coreProgressDist) with lowest hp tie-breaker', () => {
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        candidates,
      })?.uid,
    ).toBe('e3');

    const tied = [
      { ...candidates[0], uid: 'a', coreProgressDist: 4, hp: 90 },
      { ...candidates[1], uid: 'b', coreProgressDist: 4, hp: 45 },
    ];
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        priority: 'first',
        candidates: tied,
      })?.uid,
    ).toBe('b');
  });

  it('supports last (highest coreProgressDist) with lowest hp tie-breaker', () => {
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        priority: 'last',
        candidates,
      })?.uid,
    ).toBe('e2');

    const tied = [
      { ...candidates[0], uid: 'a', coreProgressDist: 10, hp: 90 },
      { ...candidates[1], uid: 'b', coreProgressDist: 10, hp: 45 },
    ];
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        priority: 'last',
        candidates: tied,
      })?.uid,
    ).toBe('b');
  });

  it('supports close (lowest Euclidean distance) with lowest coreProgressDist tie-breaker', () => {
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        priority: 'close',
        candidates,
      })?.uid,
    ).toBe('e2');

    const tied = [
      { ...candidates[0], uid: 'a', gx: 3, gy: 2, coreProgressDist: 8 },
      { ...candidates[1], uid: 'b', gx: 2, gy: 3, coreProgressDist: 3 },
    ];
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        priority: 'close',
        candidates: tied,
      })?.uid,
    ).toBe('b');
  });

  it('supports strong (highest hp) with lowest coreProgressDist tie-breaker', () => {
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        priority: 'strong',
        candidates,
      })?.uid,
    ).toBe('e2');

    const tied = [
      { ...candidates[0], uid: 'a', hp: 120, coreProgressDist: 7 },
      { ...candidates[1], uid: 'b', hp: 120, coreProgressDist: 2 },
    ];
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        priority: 'strong',
        candidates: tied,
      })?.uid,
    ).toBe('b');
  });

  it('supports advantageous (highest type effectiveness) with lowest coreProgressDist tie-breaker', () => {
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        priority: 'advantageous',
        candidates,
      })?.uid,
    ).toBe('e3');

    const tied = [
      { ...candidates[0], uid: 'a', speciesId: '0019', coreProgressDist: 9 },
      { ...candidates[1], uid: 'b', speciesId: '0019', coreProgressDist: 2 },
    ];
    expect(
      selectUnitTarget({
        unitGx: 2,
        unitGy: 2,
        attackType: 'Water',
        priority: 'advantageous',
        candidates: tied,
      })?.uid,
    ).toBe('b');
  });

  it('does not trigger modulo crit or Rapid-Fire extra bolt when hitCount is 0', () => {
    const lucarioZero = computeBasicAttackDamage({
      baseAtk: 40,
      speciesId: '0448',
      hitCount: 0,
      branchSpecial: 'crit_boost',
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
      potential: 5,
      subclass: 'Rapid-Fire',
    });
    expect(lucarioZero.isCrit).toBe(false);
    expect(lucarioZero.extraBolt).toBe(false);
    expect(lucarioZero.damage).toBe(40);
  });

  it('applies Duelist, Interceptor, Ambusher, Rapid-Fire, Artillery, Status, and Juggernaut ★5 passives', () => {
    // Duelist ★5: +15% vs bosses
    const duelist = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 1,
      heldItems: [],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
      potential: 5,
      subclass: 'Duelist',
      targetIsBoss: true,
    });
    expect(duelist.damage).toBe(115);

    // Interceptor ★5: +15% vs leaking enemies
    const interceptor = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 1,
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
      potential: 5,
      subclass: 'Interceptor',
      targetIsLeaking: true,
    });
    expect(interceptor.damage).toBe(115);

    // Ambusher ★5: +35% on first attack after moving
    const ambusher = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 1,
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
      potential: 5,
      subclass: 'Ambusher',
      isFirstAttackAfterMove: true,
    });
    expect(ambusher.damage).toBe(135);

    // Rapid-Fire ★5: extra bolt on every 5th attack
    const rapid4 = computeBasicAttackDamage({
      baseAtk: 40,
      speciesId: '0025',
      hitCount: 4,
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
      potential: 5,
      subclass: 'Rapid-Fire',
    });
    const rapid5 = computeBasicAttackDamage({
      baseAtk: 40,
      speciesId: '0025',
      hitCount: 5,
      heldItems: [],
      targetHp: 100,
      targetMaxHp: 100,
      targetHasStatus: false,
      potential: 5,
      subclass: 'Rapid-Fire',
    });
    expect(rapid4.extraBolt).toBe(false);
    expect(rapid5.extraBolt).toBe(true);

    // Artillery ★5 (+10% AoE ult), Status ★5 (+25% status duration)
    expect(computeUltPower(100, 1, false, 5, 'Artillery')).toBe(242);
    expect(computeStatusDurationMs(2000, 4, 'Status')).toBe(2000);
    expect(computeStatusDurationMs(2000, 5, 'Status')).toBe(2500);

    // Juggernaut ★5: reflects 15% of melee damage taken, not ranged
    const juggernautMelee = computeEnemyAttackDamage({
      enemyAtk: 100,
      unitDef: 0,
      unitSpeciesId: '0001',
      unitStationaryMs: 0,
      unitHeldItems: [],
      unitAdjacentToStructure: false,
      unitPotential: 5,
      unitSubclass: 'Juggernaut',
      isMelee: true,
    });
    expect(juggernautMelee.damage).toBe(100);
    expect(juggernautMelee.reflectedThorns).toBe(15);

    const juggernautRanged = computeEnemyAttackDamage({
      enemyAtk: 100,
      unitDef: 0,
      unitSpeciesId: '0001',
      unitStationaryMs: 0,
      unitHeldItems: [],
      unitAdjacentToStructure: false,
      unitPotential: 5,
      unitSubclass: 'Juggernaut',
      isMelee: false,
    });
    expect(juggernautRanged.reflectedThorns).toBe(0);
  });
});

describe('Expanded Held Items Combat Effects', () => {
  it('applies Scope Lens 4th-hit crit, Shell Bell lifesteal, and Life Orb recoil', () => {
    const scope3 = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 3,
      heldItems: ['scope_lens'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
    });
    expect(scope3.isCrit).toBe(false);
    expect(scope3.damage).toBe(100);

    const scope4 = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 4,
      heldItems: ['scope_lens'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
    });
    expect(scope4.isCrit).toBe(true);
    expect(scope4.damage).toBe(165);

    const scopeAndBranch20 = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 20,
      branchSpecial: 'crit_boost',
      heldItems: ['scope_lens'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
    });
    expect(scopeAndBranch20.isCrit).toBe(true);
    expect(scopeAndBranch20.damage).toBe(165);

    const shellBell = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 1,
      heldItems: ['shell_bell'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
    });
    expect(shellBell.lifestealHeal).toBe(12);

    const lifeOrb = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 1,
      heldItems: ['life_orb'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
    });
    expect(lifeOrb.recoilPct).toBe(0.04);
  });

  it('applies Wise Glasses ult charge, Kings Rock slow + ult charge, and Griseous Core 2-target chain + burn', () => {
    const wise = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0001',
      hitCount: 1,
      heldItems: ['wise_glasses'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
    });
    expect(wise.ultCharge).toBeCloseTo(15 * 1.15);

    const kings3 = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0001',
      hitCount: 3,
      heldItems: ['kings_rock'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
    });
    expect(kings3.ultCharge).toBeCloseTo(15 * 1.25);
    expect(kings3.slowFactor).toBe(0.4);
    expect(kings3.slowDurationMs).toBe(1500);

    const griseous = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 1,
      heldItems: ['griseous_core'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
    });
    expect(griseous.chainTargets).toBe(2);
    expect(griseous.chainDamage).toBe(35);
    expect(griseous.inflictBurn).toBe(true);
  });

  it('applies Expert Belt, Weakness Policy, and Adamant Orb (sacred_crown) conditional bonuses', () => {
    const expertSe = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 1,
      heldItems: ['expert_belt'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
      attackType: 'Electric',
      defenderTypes: ['Water'],
    });
    expect(expertSe.damage).toBe(Math.round(150 * 1.2));

    const expertBoss = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 1,
      heldItems: ['expert_belt'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
      targetIsBoss: true,
    });
    expect(expertBoss.damage).toBe(120);

    const weaknessSeSurge = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 1,
      heldItems: ['weakness_policy'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: false,
      weaknessPolicyActive: true,
      attackType: 'Electric',
      defenderTypes: ['Water'],
    });
    // 100 * 1.2 (active) = 120; * 1.5 (SE) = 180; * 1.25 (WP SE) = 225
    expect(weaknessSeSurge.damage).toBe(225);

    const adamantStatus = computeBasicAttackDamage({
      baseAtk: 100,
      speciesId: '0025',
      hitCount: 1,
      heldItems: ['sacred_crown'],
      targetHp: 500,
      targetMaxHp: 500,
      targetHasStatus: true,
    });
    expect(adamantStatus.damage).toBe(125);
  });

  it('applies Rocky Helmet and Lustrous Orb 25% thorns reflection', () => {
    const rocky = computeEnemyAttackDamage({
      enemyAtk: 100,
      unitDef: 0,
      unitSpeciesId: '0025',
      unitStationaryMs: 0,
      unitHeldItems: ['rocky_helmet'],
      unitAdjacentToStructure: false,
    });
    expect(rocky.reflectedThorns).toBe(25);

    const lustrous = computeEnemyAttackDamage({
      enemyAtk: 100,
      unitDef: 0,
      unitSpeciesId: '0025',
      unitStationaryMs: 0,
      unitHeldItems: ['lustrous_aegis'],
      unitAdjacentToStructure: false,
    });
    expect(lustrous.reflectedThorns).toBe(25);
  });
});
