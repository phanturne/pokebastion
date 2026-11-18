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
});
