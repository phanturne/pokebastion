import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ENEMY_SPECIES,
  INITIAL_ACTIVE_IDS,
  INITIAL_RESERVE_IDS,
  POKEMON_SPECIES,
  REWARD_POOL,
  STRUCTURE_SPECS,
  WAVE_DEFINITIONS,
} from '../src/data/pokemon';

const PUBLIC_ASSETS = path.resolve(__dirname, '../public/assets');

describe('Data & Asset Manifest Integrity', () => {
  const vfxManifest = JSON.parse(
    fs.readFileSync(path.join(PUBLIC_ASSETS, 'vfx/manifest.json'), 'utf8'),
  ) as Record<
    string,
    { frames: number; frameWidth: number; frameHeight: number }
  >;

  const pokeManifest = JSON.parse(
    fs.readFileSync(path.join(PUBLIC_ASSETS, 'pokemon/manifest.json'), 'utf8'),
  ) as Record<string, { Walk: unknown; Idle: unknown; Attack: unknown }>;

  it('has 10 playable Pokémon with valid PMD sprites and PVFX keys', () => {
    const species = Object.values(POKEMON_SPECIES);
    expect(species).toHaveLength(10);

    for (const sp of species) {
      expect(pokeManifest[sp.id]).toBeDefined();
      expect(pokeManifest[sp.id].Walk).not.toBeNull();
      expect(pokeManifest[sp.id].Idle).not.toBeNull();
      expect(pokeManifest[sp.id].Attack).not.toBeNull();

      expect(vfxManifest[sp.basicVfx]).toBeDefined();
      expect(vfxManifest[sp.impactVfx]).toBeDefined();
      expect(vfxManifest[sp.ultVfx]).toBeDefined();
    }
  });

  it('has 4 enemy species with valid PMD sprites, PVFX hit keys, and wave references', () => {
    const enemies = Object.values(ENEMY_SPECIES);
    expect(enemies).toHaveLength(4);

    for (const en of enemies) {
      expect(pokeManifest[en.id]).toBeDefined();
      expect(vfxManifest[en.hitVfx]).toBeDefined();
    }

    expect(WAVE_DEFINITIONS).toHaveLength(3);
    for (const wave of WAVE_DEFINITIONS) {
      expect(wave.spawns.length).toBeGreaterThan(0);
      for (const grp of wave.spawns) {
        expect(ENEMY_SPECIES[grp.speciesId]).toBeDefined();
        expect(grp.count).toBeGreaterThan(0);
      }
    }
  });

  it('has valid initial squad, structure specs, and reward pool', () => {
    for (const id of [...INITIAL_ACTIVE_IDS, ...INITIAL_RESERVE_IDS]) {
      expect(POKEMON_SPECIES[id]).toBeDefined();
    }
    expect(Object.keys(STRUCTURE_SPECS)).toHaveLength(4);
    expect(REWARD_POOL.length).toBeGreaterThanOrEqual(6);
  });
});
