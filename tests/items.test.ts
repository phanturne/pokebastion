import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARTIFACT_CATALOG, HELD_ITEM_CATALOG } from '../src/data/items';
import { HELD_ITEMS, REWARD_POOL } from '../src/data/pokemon';
import {
  getEffectiveAtk,
  getEffectiveAttackIntervalMs,
  getEffectiveDef,
  getEffectiveMaxHp,
  getEffectiveRange,
} from '../src/engine/rules';
import { computeUnitRange } from '../src/engine/combat';
import { HELD_ITEM_ICONS } from '../src/ui/hudShared';
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
        item.rangeBonus !== undefined ||
        item.attackIntervalMult !== undefined ||
        item.ultChargeMult !== undefined ||
        item.special !== undefined;
      expect(hasEffect).toBe(true);
    }
    expect(seenRarities.size).toBe(5);
  });

  it('defines 17 artifacts across all 5 rarities with valid sprite slugs', () => {
    const artifacts = Object.values(ARTIFACT_CATALOG);
    expect(artifacts).toHaveLength(17);

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

  it('exposes all 24 held items through HELD_ITEMS and applies stat modifiers', () => {
    expect(Object.keys(HELD_ITEMS)).toHaveLength(24);

    // Zoom Lens adds +1 range
    const baseRange = getEffectiveRange('0025', null, [], []);
    expect(getEffectiveRange('0025', null, [], ['zoom_lens'])).toBe(
      baseRange + 1,
    );
    expect(
      computeUnitRange('0025', null, [], 0, undefined, ['zoom_lens']),
    ).toBe(baseRange + 1);

    // Eviolite doubles HP/DEF bonus when species can evolve (0001 Bulbasaur -> 0002)
    // vs fully evolved (0003 Venusaur)
    const bulbaBaseHp = getEffectiveMaxHp('0001', [], null, []);
    const bulbaEvioliteHp = getEffectiveMaxHp('0001', [], null, ['eviolite']);
    expect(bulbaEvioliteHp).toBe(Math.round(bulbaBaseHp * 1.3));
    expect(getEffectiveDef('0001', null, ['eviolite'])).toBe(
      getEffectiveDef('0001', null, []) + 16,
    );

    const venuBaseHp = getEffectiveMaxHp('0003', [], null, []);
    const venuEvioliteHp = getEffectiveMaxHp('0003', [], null, ['eviolite']);
    expect(venuEvioliteHp).toBe(Math.round(venuBaseHp * 1.15));
    expect(getEffectiveDef('0003', null, ['eviolite'])).toBe(
      getEffectiveDef('0003', null, []) + 8,
    );

    // Muscle Band gives +14% ATK on melee (0068 Machamp) and +6% on ranged (0025 Pikachu)
    const machampBase = getEffectiveAtk('0068', [], false, null, []);
    expect(getEffectiveAtk('0068', [], false, null, ['muscle_band'])).toBe(
      Math.round(machampBase * 1.14),
    );

    const pikaBase = getEffectiveAtk('0025', [], false, null, []);
    expect(getEffectiveAtk('0025', [], false, null, ['muscle_band'])).toBe(
      Math.round(pikaBase * 1.06),
    );
  });

  it('has a downloaded PokeAPI sprite file and HUD icon for every held item', () => {
    const itemsDir = path.resolve(process.cwd(), 'public/assets/items');
    for (const item of Object.values(HELD_ITEM_CATALOG)) {
      const spritePath = path.join(itemsDir, `${item.spriteSlug}.png`);
      expect(fs.existsSync(spritePath)).toBe(true);
      expect(HELD_ITEM_ICONS[item.id]).toContain(
        `assets/items/${item.spriteSlug}.png`,
      );
    }
  });

  it('applies Choice Band/Scarf tradeoffs, Quick Claw, Metal Coat, Leftovers, and Focus Sash stats', () => {
    const baseAtk = getEffectiveAtk('0025', [], false, null, []);
    const baseInt = getEffectiveAttackIntervalMs('0025', [], null, [], []);
    const baseHp = getEffectiveMaxHp('0025', [], null, []);
    const baseDef = getEffectiveDef('0025', null, []);

    expect(getEffectiveAtk('0025', [], false, null, ['choice_band'])).toBe(
      Math.round(baseAtk * 1.32),
    );
    expect(
      getEffectiveAttackIntervalMs('0025', [], null, ['choice_band'], []),
    ).toBe(Math.round(baseInt * 1.1));

    expect(getEffectiveAtk('0025', [], false, null, ['choice_scarf'])).toBe(
      Math.round(baseAtk * 0.9),
    );
    expect(
      getEffectiveAttackIntervalMs('0025', [], null, ['choice_scarf'], []),
    ).toBe(Math.round(baseInt * 0.78));

    expect(
      getEffectiveAttackIntervalMs('0025', [], null, ['quick_claw'], []),
    ).toBe(Math.round(baseInt * 0.9));

    expect(getEffectiveDef('0025', null, ['iron_plate_vest'])).toBe(
      baseDef + 6,
    );
    expect(getEffectiveMaxHp('0025', [], null, ['leftovers'])).toBe(
      Math.round(baseHp * 1.25),
    );
    expect(getEffectiveMaxHp('0025', [], null, ['focus_sash'])).toBe(
      Math.round(baseHp * 1.2),
    );
    expect(getEffectiveDef('0025', null, ['focus_sash'])).toBe(baseDef + 10);
  });

  it('enforces strictly increasing price tiers across held item rarities', () => {
    const byRarity = (r: PokemonRarity) =>
      Object.values(HELD_ITEM_CATALOG)
        .filter((i) => i.rarity === r)
        .map((i) => i.cost);

    expect(Math.max(...byRarity('Common'))).toBeLessThan(
      Math.min(...byRarity('Uncommon')),
    );
    expect(Math.max(...byRarity('Uncommon'))).toBeLessThan(
      Math.min(...byRarity('Rare')),
    );
    expect(Math.max(...byRarity('Rare'))).toBeLessThan(
      Math.min(...byRarity('Epic')),
    );
    expect(Math.max(...byRarity('Epic'))).toBeLessThan(
      Math.min(...byRarity('Legendary')),
    );
  });
});
