import { describe, expect, it } from 'vitest';
import {
  CORE_CELLS,
  SPAWN_EAST,
  SPAWN_WEST,
  createBaseGrid,
  findNearestBlockingWall,
  findPath,
  isNoBuildTile,
} from '../src/engine/pathfinding';
import { GridStructure } from '../src/types';

function makeWall(uid: string, gx: number, gy: number, ruined = false): GridStructure {
  return {
    uid,
    kind: 'wood_wall',
    gx,
    gy,
    hp: ruined ? 0 : 120,
    maxHp: 120,
    ruined,
  };
}

describe('A* Pathfinding & Grid Rules', () => {
  it('finds an open ground path from West and East spawns to the 2x2 Core', () => {
    const grid = createBaseGrid();
    const westPath = findPath(SPAWN_WEST[1], grid, new Set(), 'ground');
    const eastPath = findPath(SPAWN_EAST[1], grid, new Set(), 'ground');

    expect(westPath).not.toBeNull();
    expect(eastPath).not.toBeNull();
    const lastWest = westPath![westPath!.length - 1];
    expect(CORE_CELLS.some((c) => c.gx === lastWest.gx && c.gy === lastWest.gy)).toBe(true);
  });

  it('detours around partial walls and returns null when completely sealed', () => {
    const grid = createBaseGrid();
    const partial = new Set(['4,4', '4,5', '4,6', '4,7']);
    const detour = findPath({ gx: 0, gy: 5 }, grid, partial, 'ground');
    expect(detour).not.toBeNull();
    expect(detour!.some((p) => partial.has(`${p.gx},${p.gy}`))).toBe(false);

    const sealed = new Set<string>();
    for (let y = 0; y < 12; y++) sealed.add(`3,${y}`);
    expect(findPath({ gx: 0, gy: 5 }, grid, sealed, 'ground')).toBeNull();
  });

  it('allows burrowers (Diglett) under walls but blocks them on water moats', () => {
    const grid = createBaseGrid();
    const sealed = new Set<string>();
    for (let y = 0; y < 12; y++) sealed.add(`3,${y}`);

    const burrowPath = findPath({ gx: 0, gy: 5 }, grid, sealed, 'burrow');
    expect(burrowPath).not.toBeNull();
    // Water moats are at (5,5) and (5,6)
    expect(burrowPath!.some((p) => p.gx === 5 && (p.gy === 5 || p.gy === 6))).toBe(false);
  });

  it('allows flyers (Zubat) over both walls and water', () => {
    const grid = createBaseGrid();
    const sealed = new Set<string>();
    for (let y = 0; y < 12; y++) sealed.add(`3,${y}`);

    const flyPath = findPath({ gx: 0, gy: 5 }, grid, sealed, 'fly');
    expect(flyPath).not.toBeNull();
    expect(flyPath!.length).toBeGreaterThan(0);
  });

  it('finds the nearest standing blocking wall when all routes are sealed', () => {
    const grid = createBaseGrid();
    const walls: GridStructure[] = [];
    for (let y = 0; y < 12; y++) {
      walls.push(makeWall(`w_${y}`, 3, y, false));
    }
    const target = findNearestBlockingWall({ gx: 0, gy: 5 }, grid, walls);
    expect(target).not.toBeNull();
    expect(target!.gx).toBe(3);
    expect(target!.gy).toBe(5);
  });

  it('enforces no-build rules on core, spawns, water, and 1-tile spawn buffers', () => {
    const grid = createBaseGrid();
    expect(isNoBuildTile(8, 5, grid)).toBe(true); // Core
    expect(isNoBuildTile(0, 5, grid)).toBe(true); // West spawn
    expect(isNoBuildTile(1, 5, grid)).toBe(true); // West spawn buffer
    expect(isNoBuildTile(16, 6, grid)).toBe(true); // East spawn buffer
    expect(isNoBuildTile(5, 5, grid)).toBe(true); // Water moat
    expect(isNoBuildTile(3, 5, grid)).toBe(false); // Valid buildable tile
  });
});
