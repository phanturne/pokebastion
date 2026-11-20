import { describe, expect, it } from 'vitest';
import { MAP_CATALOG } from '../src/data/maps';
import { ENEMY_SPECIES } from '../src/data/pokemon';
import {
  RUN_DIFFICULTIES,
  RUN_DIFFICULTY_BY_ID,
  getWavesForRun,
} from '../src/data/waves';

describe('waves and run difficulty presets', () => {
  it('defines 4 run difficulties with monotonic wave counts and modifiers', () => {
    expect(RUN_DIFFICULTIES.map((d) => d.id)).toEqual([
      'easy',
      'normal',
      'hard',
      'expert',
    ]);
    expect(RUN_DIFFICULTY_BY_ID.easy.maxWaves).toBe(20);
    expect(RUN_DIFFICULTY_BY_ID.normal.maxWaves).toBe(30);
    expect(RUN_DIFFICULTY_BY_ID.hard.maxWaves).toBe(40);
    expect(RUN_DIFFICULTY_BY_ID.expert.maxWaves).toBe(50);

    for (let i = 1; i < RUN_DIFFICULTIES.length; i++) {
      const prev = RUN_DIFFICULTIES[i - 1];
      const curr = RUN_DIFFICULTIES[i];
      expect(curr.maxWaves).toBeGreaterThan(prev.maxWaves);
      expect(curr.coreMaxHp).toBeLessThan(prev.coreMaxHp);
      expect(curr.startingGold).toBeLessThan(prev.startingGold);
      expect(curr.bountyMult).toBeLessThan(prev.bountyMult);
      expect(curr.enemyHpMult).toBeGreaterThan(prev.enemyHpMult);
      expect(curr.enemyAtkMult).toBeGreaterThan(prev.enemyAtkMult);
      expect(curr.enemySpeedMult).toBeGreaterThan(prev.enemySpeedMult);
    }
  });

  it('builds valid sequential waves for every map and difficulty', () => {
    for (const map of MAP_CATALOG) {
      for (const diff of RUN_DIFFICULTIES) {
        const waves = getWavesForRun(map.id, diff.id);
        expect(waves).toHaveLength(diff.maxWaves);
        waves.forEach((w, idx) => {
          expect(w.wave).toBe(idx + 1);
          expect(w.spawns.length).toBeGreaterThan(0);
          for (const grp of w.spawns) {
            expect(ENEMY_SPECIES[grp.speciesId]).toBeDefined();
            expect(grp.count).toBeGreaterThan(0);
            expect(grp.intervalMs).toBeGreaterThan(0);
          }
          if (w.wave % 10 === 0) {
            const hasBoss = w.spawns.some(
              (s) =>
                s.isBoss === true && map.waveTheme.boss.includes(s.speciesId),
            );
            expect(hasBoss).toBe(true);
          }
        });
      }
    }
  });

  it('gives different maps distinct enemy rosters in their waves', () => {
    const collectEnemies = (mapId: string) =>
      new Set(
        getWavesForRun(mapId, 'normal').flatMap((w) =>
          w.spawns.map((s) => s.speciesId),
        ),
      );

    const viridian = collectEnemies('viridian_outpost');
    const cerulean = collectEnemies('cerulean_creek');
    const lavender = collectEnemies('lavender_hollow');
    const victory = collectEnemies('victory_road');

    expect(cerulean.has('0076')).toBe(false); // no Golem on Cerulean Creek
    expect(lavender.has('0082')).toBe(false); // no Magneton on Lavender Hollow
    expect(victory.has('0019')).toBe(false); // no Rattata on Victory Road
    expect(viridian.size).toBe(Object.keys(ENEMY_SPECIES).length);
  });

  it('delays burrowing enemies until wave 4 and flying enemies until wave 8', () => {
    for (const map of MAP_CATALOG) {
      const waves = getWavesForRun(map.id, 'normal');
      for (const w of waves.slice(0, 3)) {
        for (const grp of w.spawns) {
          expect(ENEMY_SPECIES[grp.speciesId].movementType).toBe('ground');
        }
      }
      for (const w of waves.slice(0, 7)) {
        for (const grp of w.spawns) {
          expect(ENEMY_SPECIES[grp.speciesId].movementType).not.toBe('fly');
        }
      }
    }
  });
});
