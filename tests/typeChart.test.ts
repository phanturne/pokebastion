import { describe, expect, it } from 'vitest';
import { ENEMY_SPECIES, POKEMON_SPECIES } from '../src/data/pokemon';
import {
  POKEMON_ELEMENT_TYPES,
  computeTypeEffectiveness,
  getSpeciesAttackType,
  getSpeciesTypes,
} from '../src/engine/typeChart';

describe('typeChart', () => {
  it('assigns valid element types to every playable and enemy species', () => {
    const validTypes = new Set<string>(POKEMON_ELEMENT_TYPES);

    for (const id of Object.keys(POKEMON_SPECIES)) {
      const types = getSpeciesTypes(id);
      expect(types.length).toBeGreaterThanOrEqual(1);
      for (const t of types) {
        expect(validTypes.has(t)).toBe(true);
      }
      expect(validTypes.has(getSpeciesAttackType(id))).toBe(true);
    }

    for (const id of Object.keys(ENEMY_SPECIES)) {
      const types = getSpeciesTypes(id);
      expect(types.length).toBeGreaterThanOrEqual(1);
      for (const t of types) {
        expect(validTypes.has(t)).toBe(true);
      }
      expect(validTypes.has(getSpeciesAttackType(id))).toBe(true);
    }
  });

  it('uses Flying attack type for Normal/Flying birds', () => {
    expect(getSpeciesAttackType('0016')).toBe('Flying');
    expect(getSpeciesAttackType('0018')).toBe('Flying');
    expect(getSpeciesAttackType('0021')).toBe('Flying');
    expect(getSpeciesAttackType('0083')).toBe('Flying');
  });

  it.each([
    ['Water', ['Rock', 'Ground'], 2.0, 'extremely'],
    ['Electric', ['Water', 'Flying'], 2.0, 'extremely'],
    ['Fire', ['Grass'], 1.5, 'super'],
    ['Electric', ['Water'], 1.5, 'super'],
    ['Fire', ['Normal'], 1.0, 'neutral'],
    ['Fire', ['Water', 'Grass'], 1.0, 'neutral'],
    ['Fire', ['Water'], 0.5, 'not_very'],
    ['Grass', ['Poison'], 0.5, 'not_very'],
    ['Grass', ['Fire', 'Flying'], 0.35, 'very_ineffective'],
    ['Fighting', ['Poison', 'Flying'], 0.35, 'very_ineffective'],
    ['Electric', ['Ground'], 0.35, 'very_ineffective'],
    ['Normal', ['Ghost'], 0.35, 'very_ineffective'],
    ['Ground', ['Flying'], 0.35, 'very_ineffective'],
  ] as const)(
    '%s vs %j -> %sx (%s)',
    (attackType, defenderTypes, expectedMult, expectedTier) => {
      const res = computeTypeEffectiveness(attackType, defenderTypes);
      expect(res.multiplier).toBe(expectedMult);
      expect(res.tier).toBe(expectedTier);
    },
  );
});
