import { describe, expect, it } from 'vitest';
import { createGridForMap } from '../src/data/maps';
import { computeBasicAttackDamage } from '../src/engine/combat';
import {
  findNearestBlockingWall,
  findPath,
  SPAWN_WEST,
} from '../src/engine/pathfinding';
import { GridStructure } from '../src/types';

describe('engine performance budgets', () => {
  it('runs 1,000 walled A* + nearest-wall queries within budget', () => {
    const tiles = createGridForMap('viridian_outpost');
    const blocked = new Set<string>();
    const structures: GridStructure[] = [];
    for (let gy = 4; gy <= 13; gy++) {
      blocked.add(`10,${gy}`);
      structures.push({
        uid: `w_${gy}`,
        kind: 'wood_wall',
        gx: 10,
        gy,
        hp: 200,
        maxHp: 200,
        ruined: false,
      });
    }
    const start = SPAWN_WEST[0];

    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      const path = findPath(start, tiles, blocked, 'ground');
      expect(path).not.toBeNull();
      const wall = findNearestBlockingWall(start, tiles, structures);
      expect(wall).not.toBeNull();
    }
    const elapsedMs = performance.now() - t0;
    expect(elapsedMs).toBeLessThan(1500);
  });

  it('runs 10,000 combat damage calculations within budget', () => {
    const t0 = performance.now();
    let total = 0;
    for (let i = 1; i <= 10_000; i++) {
      const res = computeBasicAttackDamage({
        baseAtk: 42,
        speciesId: '0448',
        hitCount: i,
        branchSpecial: 'lifesteal',
        heldItems: ['bloodthirsty_edge', 'storm_conductor'],
        targetHp: 40,
        targetMaxHp: 100,
        targetHasStatus: true,
      });
      total += res.damage;
    }
    const elapsedMs = performance.now() - t0;
    expect(total).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(250);
  });
});
