import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFINITIONS,
  CLASS_MINOR_UPGRADE_MAP,
  CLASS_MINOR_UPGRADES,
  SUBCLASS_DEFINITIONS,
} from '../src/data/classes';
import { POKEMON_SPECIES, REWARD_POOL } from '../src/data/pokemon';
import {
  doesMinorUpgradeMatchSpecies,
  generateRewardChoices,
  getEffectiveAtk,
  getEffectiveAttackIntervalMs,
  getEffectiveDef,
  getEffectiveMaxHp,
  getEffectiveRange,
  getEligibleMinorUpgrades,
} from '../src/engine/rules';
import { PokemonClass } from '../src/types';

describe('Classes, Subclasses, and Minor Upgrades', () => {
  it('defines all 6 classes with 3 unique subclasses each (18 total)', () => {
    const classes = Object.keys(CLASS_DEFINITIONS) as PokemonClass[];
    expect(classes).toHaveLength(6);

    const seenSubclasses = new Set<string>();
    for (const cls of classes) {
      const def = CLASS_DEFINITIONS[cls];
      expect(def.subclasses).toHaveLength(3);
      for (const sub of def.subclasses) {
        expect(seenSubclasses.has(sub)).toBe(false);
        seenSubclasses.add(sub);
        expect(SUBCLASS_DEFINITIONS[sub]).toBeDefined();
        expect(SUBCLASS_DEFINITIONS[sub].parentClass).toBe(cls);
      }
    }
    expect(seenSubclasses.size).toBe(18);
    expect(Object.keys(SUBCLASS_DEFINITIONS)).toHaveLength(18);
  });

  it('defines 30 unique minor upgrades (2 per class + 1 per subclass) with valid modifiers', () => {
    expect(CLASS_MINOR_UPGRADES).toHaveLength(30);
    const ids = new Set<string>();

    for (const u of CLASS_MINOR_UPGRADES) {
      expect(ids.has(u.id)).toBe(false);
      ids.add(u.id);
      expect(CLASS_DEFINITIONS[u.targetClass]).toBeDefined();
      if (u.targetSubclass) {
        expect(SUBCLASS_DEFINITIONS[u.targetSubclass].parentClass).toBe(
          u.targetClass,
        );
      }
      const hasModifier =
        u.hpMult !== undefined ||
        u.atkMult !== undefined ||
        u.defBonus !== undefined ||
        u.rangeBonus !== undefined ||
        u.attackIntervalMult !== undefined ||
        u.ultChargeMult !== undefined;
      expect(hasModifier).toBe(true);
    }
  });

  it('matches single-class, dual-class, and subclass-specific minor upgrades', () => {
    const dualBlasterSupport = {
      pokeClass: 'Blaster' as const,
      secondaryClass: 'Support' as const,
      subclass: 'Chain' as const,
    };
    const eligible = getEligibleMinorUpgrades(dualBlasterSupport);
    const eligibleIds = eligible.map((u) => u.id);

    // Draws class-wide upgrades from BOTH Blaster and Support + Chain subclass
    expect(eligibleIds).toContain('blaster_volatile_spark');
    expect(eligibleIds).toContain('support_soothing_aura');
    expect(eligibleIds).toContain('blaster_chain_arc');
    // Excludes other subclasses
    expect(eligibleIds).not.toContain('blaster_aoe_overload');
    expect(eligibleIds).not.toContain('support_healer_grace');

    // Excludes already-owned upgrades
    const afterOwned = getEligibleMinorUpgrades(dualBlasterSupport, [
      'blaster_volatile_spark',
    ]);
    expect(afterOwned.map((u) => u.id)).not.toContain('blaster_volatile_spark');

    expect(
      doesMinorUpgradeMatchSpecies(
        CLASS_MINOR_UPGRADES.find((u) => u.id === 'defender_iron_plate')!,
        dualBlasterSupport,
      ),
    ).toBe(false);
  });

  it('applies matching class minor upgrades in effective stat calculators', () => {
    // 0007 Squirtle is Defender (maxHp 220, atk 20, def 18, range 2, interval 1050, moveRange 2)
    // 0004 Charmander is Blaster (maxHp 150, atk 24, def 9, range 3, interval 1000, moveRange 2)
    const upgrades = [
      'defender_iron_plate', // Defender: +20% HP, +5 DEF
      'blaster_volatile_spark', // Blaster: +18% ATK
      'marksman_eagle_eye', // Marksman: +1 Range (should NOT apply to Squirtle or Charmander)
      'blaster_quick_cast', // Blaster: *0.87 interval
      'specialist_nimble_step', // Specialist: +10% Attack Speed
    ];

    expect(getEffectiveMaxHp('0007', upgrades)).toBe(Math.round(220 * 1.2));
    expect(getEffectiveDef('0007', null, [], upgrades)).toBe(18 + 5);
    expect(getEffectiveRange('0007', null, upgrades)).toBe(2);

    expect(getEffectiveAtk('0004', upgrades)).toBe(Math.round(24 * 1.18));
    expect(getEffectiveAttackIntervalMs('0004', [], null, [], upgrades)).toBe(
      Math.round(1000 * 0.87),
    );
    expect(getEffectiveAttackIntervalMs('0094', [], null, [], upgrades)).toBe(
      Math.round(POKEMON_SPECIES['0094'].attackIntervalMs * 0.91),
    ); // Gengar is Specialist
  });

  it('can include eligible class minor upgrades in generateRewardChoices when enabled', () => {
    const allSpecies = new Set(Object.keys(POKEMON_SPECIES));
    const baseUpgrades = REWARD_POOL.filter((r) => r.kind === 'upgrade').map(
      (r) => r.id,
    );
    const baseArtifacts = REWARD_POOL.filter((r) => r.kind === 'artifact').map(
      (r) => r.id,
    );

    const choices = generateRewardChoices(
      allSpecies,
      baseUpgrades,
      baseArtifacts,
      () => 0.25,
      [],
      true,
    );
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.every((c) => c.kind === 'upgrade' && c.targetClass)).toBe(
      true,
    );
  });

  it('maintains 1:1 lookup integrity in CLASS_MINOR_UPGRADE_MAP', () => {
    expect(Object.keys(CLASS_MINOR_UPGRADE_MAP)).toHaveLength(
      CLASS_MINOR_UPGRADES.length,
    );
    for (const u of CLASS_MINOR_UPGRADES) {
      expect(CLASS_MINOR_UPGRADE_MAP[u.id]).toBe(u);
    }
  });
});
