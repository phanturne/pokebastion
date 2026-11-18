import { STARTER_UNLOCKED_IDS } from '../data/pokemon';

export const SAVE_STORAGE_KEY = 'pokebastion:save_v1';

export interface PokemonSaveEntry {
  unlocked: boolean;
  shiny?: boolean;
  mastery?: number;
}

export interface PlayerSave {
  version: 1;
  pokemon: Record<string, PokemonSaveEntry>;
}

export function createDefaultSave(
  starterIds: readonly string[] = STARTER_UNLOCKED_IDS,
): PlayerSave {
  const pokemon: Record<string, PokemonSaveEntry> = {};
  for (const id of starterIds) {
    pokemon[id] = { unlocked: true };
  }
  return { version: 1, pokemon };
}

export function isPokemonUnlocked(
  save: PlayerSave,
  speciesId: string,
): boolean {
  return Boolean(save.pokemon[speciesId]?.unlocked);
}

export function getUnlockedIds(save: PlayerSave): string[] {
  return Object.entries(save.pokemon)
    .filter(([, entry]) => entry.unlocked)
    .map(([id]) => id);
}

export function unlockPokemon(save: PlayerSave, speciesId: string): boolean {
  const existing = save.pokemon[speciesId];
  if (existing?.unlocked) return false;
  save.pokemon[speciesId] = { ...existing, unlocked: true };
  return true;
}

export function loadPlayerSave(
  storage?: Pick<Storage, 'getItem'> | null,
  starterIds: readonly string[] = STARTER_UNLOCKED_IDS,
): PlayerSave {
  const save = createDefaultSave(starterIds);
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return save;

  try {
    const raw = store.getItem(SAVE_STORAGE_KEY);
    if (!raw) return save;
    const parsed = JSON.parse(raw) as Partial<PlayerSave>;
    if (
      parsed.version !== 1 ||
      !parsed.pokemon ||
      typeof parsed.pokemon !== 'object'
    ) {
      return save;
    }
    for (const [id, entry] of Object.entries(parsed.pokemon)) {
      if (entry && typeof entry === 'object') {
        save.pokemon[id] = {
          unlocked:
            Boolean(entry.unlocked) || Boolean(save.pokemon[id]?.unlocked),
          ...(entry.shiny !== undefined ? { shiny: Boolean(entry.shiny) } : {}),
          ...(typeof entry.mastery === 'number'
            ? { mastery: entry.mastery }
            : {}),
        };
      }
    }
  } catch {
    // Ignore corrupt or restricted storage and fall back to starter defaults.
  }
  return save;
}

export function persistPlayerSave(
  save: PlayerSave,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  const store =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return;
  try {
    store.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Ignore storage quota/security errors in restricted contexts.
  }
}
