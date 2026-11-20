import fs from 'node:fs';
import path from 'node:path';
import {
  EVOLUTION_NEXT,
  getBaseFamilyId,
  getEvolutionTargets,
} from '../src/data/evolutions';
import { describe, expect, it } from 'vitest';
import {
  EVOLUTION_NEXT,
  getBaseFamilyId,
  getEvolutionTargets,
} from '../src/data/evolutions';
import {
  BGM_ASSETS,
  getSpeciesAttackSfx,
  getSpeciesUltSfx,
  SFX_ASSETS,
} from '../src/audio/sfx';
import {
  EVOLUTION_NEXT,
  getBaseFamilyId,
  getEvolutionTargets,
} from '../src/data/evolutions';
import {
  ENEMY_SPECIES,
  HELD_ITEMS,
  INITIAL_ACTIVE_IDS,
  INITIAL_RESERVE_IDS,
  POKEMON_SPECIES,
  REWARD_POOL,
  STARTER_UNLOCKED_IDS,
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

  it('has 152 playable Pokémon (Gen 1 + Lucario) with valid PMD sprites and PVFX keys', () => {
    const species = Object.values(POKEMON_SPECIES);
    expect(species).toHaveLength(152);

    for (const sp of species) {
      expect(pokeManifest[sp.id]).toBeDefined();
      expect(pokeManifest[sp.id].Walk).not.toBeNull();
      expect(pokeManifest[sp.id].Idle).not.toBeNull();
      expect(pokeManifest[sp.id].Attack).not.toBeNull();
      expect(
        fs.existsSync(path.join(PUBLIC_ASSETS, 'pokemon', sp.id, 'Normal.png')),
      ).toBe(true);

      expect(vfxManifest[sp.basicVfx]).toBeDefined();
      expect(vfxManifest[sp.impactVfx]).toBeDefined();
      expect(vfxManifest[sp.ultVfx]).toBeDefined();

      expect(sp.draftCost).toBeGreaterThan(0);
      expect(sp.branches).toHaveLength(3);
      const branchIds = new Set(sp.branches.map((b) => b.id));
      expect(branchIds.size).toBe(3);
    }
  });

  it('has 13 enemy species (base + evolved + ranged) with valid PMD sprites, PVFX hit keys, and 10 waves', () => {
    const enemies = Object.values(ENEMY_SPECIES);
    expect(enemies).toHaveLength(13);

    for (const en of enemies) {
      const spriteKey = en.spriteId ?? en.id;
      expect(pokeManifest[spriteKey]).toBeDefined();
      expect(vfxManifest[en.hitVfx]).toBeDefined();
      if (en.projectileVfx) {
        expect(vfxManifest[en.projectileVfx]).toBeDefined();
      }
      if (en.range !== undefined) {
        expect(Number.isFinite(en.range) && en.range >= 1).toBe(true);
      }
      if (en.attackIntervalMs !== undefined) {
        expect(
          Number.isFinite(en.attackIntervalMs) && en.attackIntervalMs > 0,
        ).toBe(true);
      }
    }

    expect(WAVE_DEFINITIONS).toHaveLength(10);
    for (const wave of WAVE_DEFINITIONS) {
      expect(wave.spawns.length).toBeGreaterThan(0);
      for (const grp of wave.spawns) {
        expect(ENEMY_SPECIES[grp.speciesId]).toBeDefined();
        expect(grp.count).toBeGreaterThan(0);
      }
    }
  });

  it('has valid starters, held items, structure specs, and reward pool', () => {
    for (const id of [
      ...INITIAL_ACTIVE_IDS,
      ...INITIAL_RESERVE_IDS,
      ...STARTER_UNLOCKED_IDS,
    ]) {
      expect(POKEMON_SPECIES[id]).toBeDefined();
    }
    for (const id of ['0007', '0004', '0001']) {
      expect(POKEMON_SPECIES[id].draftCost).toBe(3);
      expect(POKEMON_SPECIES[id].unlockedStarter).toBe(true);
    }
    expect(Object.keys(HELD_ITEMS)).toHaveLength(3);
    expect(Object.keys(STRUCTURE_SPECS)).toHaveLength(9);
    for (const kind of Object.keys(STRUCTURE_SPECS)) {
      expect(
        fs.existsSync(path.join(PUBLIC_ASSETS, 'structures', `${kind}.png`)),
      ).toBe(true);
    }
    expect(REWARD_POOL.length).toBeGreaterThanOrEqual(6);
  });

  it('has all SFX and BGM assets on disk and valid species SFX mappings', () => {
    const publicRoot = path.resolve(__dirname, '../public');
    for (const relPath of [
      ...Object.values(SFX_ASSETS),
      ...Object.values(BGM_ASSETS),
    ]) {
      expect(fs.existsSync(path.join(publicRoot, relPath))).toBe(true);
    }
    for (const sp of Object.values(POKEMON_SPECIES)) {
      expect(SFX_ASSETS[getSpeciesAttackSfx(sp.id)]).toBeDefined();
      expect(SFX_ASSETS[getSpeciesUltSfx(sp.id)]).toBeDefined();
    }
  });

  it('ensures all active species, enemies, items, and rewards have valid finite stats and unique IDs', () => {
    for (const sp of Object.values(POKEMON_SPECIES)) {
      expect(Number.isFinite(sp.maxHp) && sp.maxHp > 0).toBe(true);
      expect(Number.isFinite(sp.atk) && sp.atk > 0).toBe(true);
      expect(Number.isFinite(sp.range) && sp.range > 0).toBe(true);
      expect(
        Number.isFinite(sp.attackIntervalMs) && sp.attackIntervalMs > 0,
      ).toBe(true);
      expect(sp.branches.length).toBeGreaterThan(0);
    }
    for (const enemy of Object.values(ENEMY_SPECIES)) {
      expect(Number.isFinite(enemy.maxHp) && enemy.maxHp > 0).toBe(true);
      expect(Number.isFinite(enemy.atk) && enemy.atk > 0).toBe(true);
      expect(Number.isFinite(enemy.speed) && enemy.speed > 0).toBe(true);
    }
    const rewardIds = new Set<string>();
    for (const reward of REWARD_POOL) {
      expect(rewardIds.has(reward.id)).toBe(false);
      rewardIds.add(reward.id);
      expect(reward.desc.length).toBeGreaterThan(0);
    }
  });

  it('has valid Gen 1 evolution chains and unified family branches', () => {
    for (const [fromId, targets] of Object.entries(EVOLUTION_NEXT)) {
      expect(POKEMON_SPECIES[fromId]).toBeDefined();
      expect(targets.length).toBeGreaterThan(0);
      expect(getEvolutionTargets(fromId)).toEqual(targets);
      for (const toId of targets) {
        expect(POKEMON_SPECIES[toId]).toBeDefined();
        const baseId = getBaseFamilyId(toId);
        expect(POKEMON_SPECIES[baseId]).toBeDefined();
        expect(POKEMON_SPECIES[toId].branches).toEqual(
          POKEMON_SPECIES[baseId].branches,
        );
      }
    }
    expect(getBaseFamilyId('0003')).toBe('0001');
    expect(getBaseFamilyId('0135')).toBe('0133');
    expect(getBaseFamilyId('0001')).toBe('0001');
  });
});
