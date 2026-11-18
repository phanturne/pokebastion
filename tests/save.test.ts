import { describe, expect, it } from 'vitest';
import {
  SAVE_STORAGE_KEY,
  createDefaultSave,
  getUnlockedIds,
  isPokemonUnlocked,
  loadPlayerSave,
  persistPlayerSave,
  unlockPokemon,
} from '../src/engine/save';

describe('PlayerSave & Unlock State', () => {
  it('seeds Bulbasaur, Charmander, and Squirtle as unlocked by default', () => {
    const save = createDefaultSave();
    expect(isPokemonUnlocked(save, '0001')).toBe(true);
    expect(isPokemonUnlocked(save, '0004')).toBe(true);
    expect(isPokemonUnlocked(save, '0007')).toBe(true);
    expect(isPokemonUnlocked(save, '0025')).toBe(false);
    expect(getUnlockedIds(save).sort()).toEqual(['0001', '0004', '0007']);
  });

  it('unlocks new species and preserves future shiny/mastery fields across save/load', () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };

    const save = loadPlayerSave(mockStorage);
    expect(unlockPokemon(save, '0025')).toBe(true);
    expect(unlockPokemon(save, '0025')).toBe(false);
    save.pokemon['0025'].shiny = true;
    save.pokemon['0025'].mastery = 42;
    persistPlayerSave(save, mockStorage);

    const reloaded = loadPlayerSave(mockStorage);
    expect(isPokemonUnlocked(reloaded, '0025')).toBe(true);
    expect(reloaded.pokemon['0025'].shiny).toBe(true);
    expect(reloaded.pokemon['0025'].mastery).toBe(42);
    expect(isPokemonUnlocked(reloaded, '0001')).toBe(true);
  });

  it('falls back safely on corrupt storage', () => {
    const corruptStorage = {
      getItem: (k: string) => (k === SAVE_STORAGE_KEY ? '{bad json' : null),
    };
    const save = loadPlayerSave(corruptStorage);
    expect(getUnlockedIds(save).sort()).toEqual(['0001', '0004', '0007']);
  });

  it('handles null/missing storage, invalid schemas, starter protection, throwing setItem, and custom starters', () => {
    // null storage and missing key
    expect(getUnlockedIds(loadPlayerSave(null)).sort()).toEqual([
      '0001',
      '0004',
      '0007',
    ]);
    expect(
      getUnlockedIds(loadPlayerSave({ getItem: () => null })).sort(),
    ).toEqual(['0001', '0004', '0007']);

    // wrong version & non-object pokemon
    expect(
      getUnlockedIds(
        loadPlayerSave({
          getItem: () => JSON.stringify({ version: 2, pokemon: {} }),
        }),
      ).sort(),
    ).toEqual(['0001', '0004', '0007']);
    expect(
      getUnlockedIds(
        loadPlayerSave({
          getItem: () => JSON.stringify({ version: 1, pokemon: 'bad' }),
        }),
      ).sort(),
    ).toEqual(['0001', '0004', '0007']);

    // invalid entry ignored & starter unlocked: false cannot lock a starter
    const withInvalid = loadPlayerSave({
      getItem: () =>
        JSON.stringify({
          version: 1,
          pokemon: {
            '0001': { unlocked: false },
            '0025': 'invalid_entry',
            '0150': { unlocked: true, shiny: true },
          },
        }),
    });
    expect(isPokemonUnlocked(withInvalid, '0001')).toBe(true);
    expect(isPokemonUnlocked(withInvalid, '0025')).toBe(false);
    expect(isPokemonUnlocked(withInvalid, '0150')).toBe(true);

    // persistPlayerSave with null storage or throwing setItem
    expect(() => persistPlayerSave(withInvalid, null)).not.toThrow();
    expect(() =>
      persistPlayerSave(withInvalid, {
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      }),
    ).not.toThrow();

    // createDefaultSave with custom starters
    const custom = createDefaultSave(['0025', '0150']);
    expect(getUnlockedIds(custom).sort()).toEqual(['0025', '0150']);
  });
});
