import { describe, expect, it } from 'vitest';
import { ARTIFACT_CATALOG, HELD_ITEM_CATALOG } from '../src/data/items';
import { HELD_ITEMS, REWARD_POOL } from '../src/data/pokemon';
import { PokemonRarity } from '../src/types';

const VALID_RARITIES: PokemonRarity[] = [
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
];

describe('Held Item & Artifact Catalogs', () => {
  it('defines 24 held items across all 5 rarities with valid sprite slugs', () => {
    const items = Object.values(HELD_ITEM_CATALOG);
    expect(items).toHaveLength(24);

    const seenRarities = new Set<PokemonRarity>();
    for (const item of items) {
      expect(VALID_RARITIES).toContain(item.rarity);
      seenRarities.add(item.rarity);
      expect(item.cost).toBeGreaterThan(0);
      expect(item.spriteSlug).toMatch(/^[a-z0-9-]+$/);
      const hasEffect =
        item.atkMult !== undefined ||
        item.hpMult !== undefined ||
        item.defBonus !== undefined ||
        item.attackIntervalMult !== undefined ||
        item.special !== undefined;
      expect(hasEffect).toBe(true);
    }
    expect(seenRarities.size).toBe(5);
  });

  it('defines 18 artifacts across all 5 rarities with valid sprite slugs', () => {
    const artifacts = Object.values(ARTIFACT_CATALOG);
    expect(artifacts).toHaveLength(18);

    const seenRarities = new Set<PokemonRarity>();
    for (const art of artifacts) {
      expect(VALID_RARITIES).toContain(art.rarity);
      seenRarities.add(art.rarity);
      expect(art.spriteSlug).toMatch(/^[a-z0-9-]+$/);
      expect(art.desc.length).toBeGreaterThan(0);
    }
    expect(seenRarities.size).toBe(5);
  });

  it('includes all existing prototype held items and artifacts', () => {
    for (const id of Object.keys(HELD_ITEMS)) {
      expect(HELD_ITEM_CATALOG[id]).toBeDefined();
      expect(HELD_ITEM_CATALOG[id].cost).toBe(HELD_ITEMS[id].cost);
    }

    for (const r of REWARD_POOL) {
      if (r.kind === 'artifact') {
        expect(ARTIFACT_CATALOG[r.id]).toBeDefined();
      }
    }
  });
});
