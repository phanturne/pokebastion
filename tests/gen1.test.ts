import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GEN1_ENEMIES, GEN1_POKEMON } from '../src/data/gen1';
import { ENEMY_SPECIES, POKEMON_SPECIES } from '../src/data/pokemon';

const PUBLIC_ASSETS = path.resolve(__dirname, '../public/assets');

describe('Gen 1 Catalog Integrity', () => {
  const vfxManifest = JSON.parse(
    fs.readFileSync(path.join(PUBLIC_ASSETS, 'vfx/manifest.json'), 'utf8'),
  ) as Record<string, unknown>;

  it('defines all 151 Gen 1 playable Pokémon with 3 unique branches and valid VFX', () => {
    const playable = Object.values(GEN1_POKEMON);
    expect(playable).toHaveLength(151);

    const branchIds = new Set<string>();
    for (let dex = 1; dex <= 151; dex++) {
      const id = String(dex).padStart(4, '0');
      const sp = GEN1_POKEMON[id];
      expect(sp).toBeDefined();
      expect(sp.draftCost).toBeGreaterThanOrEqual(1);
      expect(sp.draftCost).toBeLessThanOrEqual(6);
      expect(sp.maxHp).toBeGreaterThan(0);
      expect(sp.atk).toBeGreaterThan(0);
      expect(sp.attackIntervalMs).toBeGreaterThanOrEqual(500);
      expect(sp.branches).toHaveLength(3);
      for (const b of sp.branches) {
        expect(branchIds.has(b.id)).toBe(false);
        branchIds.add(b.id);
      }
      expect(vfxManifest[sp.basicVfx]).toBeDefined();
      expect(vfxManifest[sp.impactVfx]).toBeDefined();
      expect(vfxManifest[sp.ultVfx]).toBeDefined();
    }
    expect(branchIds.size).toBe(453);
  });

  it('defines all 151 Gen 1 enemy kits with valid movement types and hit VFX', () => {
    const enemies = Object.values(GEN1_ENEMIES);
    expect(enemies).toHaveLength(151);

    for (let dex = 1; dex <= 151; dex++) {
      const id = String(dex).padStart(4, '0');
      const en = GEN1_ENEMIES[id];
      expect(en).toBeDefined();
      expect(en.maxHp).toBeGreaterThan(0);
      expect(en.atk).toBeGreaterThan(0);
      expect(en.speed).toBeGreaterThan(0);
      expect(en.bounty).toBeGreaterThan(0);
      expect(['ground', 'burrow', 'fly']).toContain(en.movementType);
      expect(vfxManifest[en.hitVfx]).toBeDefined();
    }
  });

  it('preserves existing Gen 1 anchor species stats from src/data/pokemon.ts', () => {
    for (const [id, anchor] of Object.entries(POKEMON_SPECIES)) {
      if (Number(id) > 151) continue;
      const gen1 = GEN1_POKEMON[id];
      expect(gen1.maxHp).toBe(anchor.maxHp);
      expect(gen1.atk).toBe(anchor.atk);
      expect(gen1.def).toBe(anchor.def);
      expect(gen1.pokeClass).toBe(anchor.pokeClass);
      expect(gen1.draftCost).toBe(anchor.draftCost);
      expect(gen1.branches).toEqual(anchor.branches);
    }

    for (const [id, anchor] of Object.entries(ENEMY_SPECIES)) {
      if (Number(id) > 151) continue;
      const gen1 = GEN1_ENEMIES[id];
      expect(gen1.maxHp).toBe(anchor.maxHp);
      expect(gen1.atk).toBe(anchor.atk);
      expect(gen1.speed).toBe(anchor.speed);
      expect(gen1.movementType).toBe(anchor.movementType);
      expect(gen1.bounty).toBe(anchor.bounty);
    }
  });
});
