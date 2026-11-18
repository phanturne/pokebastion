import { describe, expect, it } from 'vitest';
import {
  CORE_CELLS,
  SPAWN_EAST,
  SPAWN_WEST,
  createBaseGrid,
  findNearestBlockingWall,
  findPath,
  isNoBuildTile,
  isPortalBufferTile,
  rollWavePortals,
} from '../src/engine/pathfinding';
import { GridStructure } from '../src/types';

function makeWall(
  uid: string,
  gx: number,
  gy: number,
  ruined = false,
): GridStructure {
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
    expect(
      CORE_CELLS.some((c) => c.gx === lastWest.gx && c.gy === lastWest.gy),
    ).toBe(true);
  });

  it('detours around partial walls and returns null when completely sealed', () => {
    const grid = createBaseGrid();
    const partial = new Set(['4,7', '4,8', '4,9', '4,10']);
    const detour = findPath(SPAWN_WEST[1], grid, partial, 'ground');
    expect(detour).not.toBeNull();
    expect(detour!.some((p) => partial.has(`${p.gx},${p.gy}`))).toBe(false);

    const sealed = new Set<string>();
    for (let y = 0; y < grid.length; y++) sealed.add(`3,${y}`);
    expect(findPath(SPAWN_WEST[1], grid, sealed, 'ground')).toBeNull();
  });

  it('uses diagonal steps on open terrain without cutting corners through diagonal walls', () => {
    const grid = createBaseGrid();
    const diagPath = findPath({ gx: 10, gy: 0 }, grid, new Set(), 'ground');
    expect(diagPath).not.toBeNull();
    const hasDiagonal = diagPath!.some(
      (pt, i) =>
        i > 0 && pt.gx !== diagPath![i - 1].gx && pt.gy !== diagPath![i - 1].gy,
    );
    expect(hasDiagonal).toBe(true);

    // Diagonal wall seam around Core must still seal completely (no corner-cutting)
    const diagSealed = new Set<string>();
    for (let y = 0; y < grid.length; y++) {
      diagSealed.add(`${4},${y}`);
      if (y + 1 < grid.length) diagSealed.add(`${5},${y}`);
    }
    // Single diagonal staircase wall at x=3..4:
    const staircase = new Set<string>();
    for (let y = 0; y < grid.length; y++) {
      staircase.add(`3,${y}`);
    }
    // Remove (3,5) and block (4,5) + (3,6) + (4,4) so only diagonal seam exists
    staircase.delete('3,5');
    staircase.add('4,5');
    staircase.add('4,4');
    staircase.add('4,6');
    expect(findPath(SPAWN_WEST[1], grid, staircase, 'ground')).toBeNull();
  });

  it('allows burrowers (Diglett) under walls but blocks them on water moats', () => {
    const grid = createBaseGrid();
    const sealed = new Set<string>();
    for (let y = 0; y < grid.length; y++) sealed.add(`3,${y}`);

    const burrowPath = findPath(SPAWN_WEST[1], grid, sealed, 'burrow');
    expect(burrowPath).not.toBeNull();
    // Water moats are at (8,8) and (8,9)
    expect(burrowPath!.some((p) => grid[p.gy][p.gx] === 'water')).toBe(false);
  });

  it('allows flyers (Zubat) over both walls and water', () => {
    const grid = createBaseGrid();
    const sealed = new Set<string>();
    for (let y = 0; y < grid.length; y++) sealed.add(`3,${y}`);

    const flyPath = findPath(SPAWN_WEST[1], grid, sealed, 'fly');
    expect(flyPath).not.toBeNull();
    expect(flyPath!.length).toBeGreaterThan(0);
  });

  it('finds the nearest standing blocking wall when all routes are sealed', () => {
    const grid = createBaseGrid();
    const walls: GridStructure[] = [];
    for (let y = 0; y < grid.length; y++) {
      walls.push(makeWall(`w_${y}`, 3, y, false));
    }
    const target = findNearestBlockingWall(SPAWN_WEST[1], grid, walls);
    expect(target).not.toBeNull();
    expect(target!.gx).toBe(3);
    expect(target!.gy).toBe(SPAWN_WEST[1].gy);
  });

  it('enforces no-build rules on core, 2-tile outer border, active portals, and trees', () => {
    const grid = createBaseGrid();
    const portals = [
      { id: 'p_w', side: 'west' as const, cells: SPAWN_WEST.slice(0, 2) },
    ];
    expect(
      isNoBuildTile(CORE_CELLS[0].gx, CORE_CELLS[0].gy, grid, portals),
    ).toBe(true); // Core
    expect(
      isNoBuildTile(SPAWN_WEST[1].gx, SPAWN_WEST[1].gy, grid, portals),
    ).toBe(true); // Active portal
    expect(isNoBuildTile(1, 8, grid, portals)).toBe(true); // 2-tile outer border (west)
    expect(isNoBuildTile(14, 1, grid, portals)).toBe(true); // 2-tile outer border (north)
    expect(isNoBuildTile(26, 8, grid, portals)).toBe(true); // 2-tile outer border (east)
    expect(isNoBuildTile(8, 5, grid, portals)).toBe(true); // Impassable grove tree
    expect(isNoBuildTile(1, 1, grid, portals)).toBe(true); // Impassable corner tree
    expect(isNoBuildTile(2, 8, grid, portals)).toBe(false); // Inner buildable tile
  });

  it('blocks ground and burrow enemies on tree tiles while flyers pass over', () => {
    const grid = createBaseGrid();
    // Surround (3, 8) or verify tree tile (5, 5) is avoided by ground & burrow
    const groundPath = findPath(SPAWN_WEST[1], grid, new Set(), 'ground');
    const burrowPath = findPath(SPAWN_WEST[1], grid, new Set(), 'burrow');
    expect(groundPath).not.toBeNull();
    expect(burrowPath).not.toBeNull();
    expect(groundPath!.some((p) => grid[p.gy][p.gx] === 'tree')).toBe(false);
    expect(burrowPath!.some((p) => grid[p.gy][p.gx] === 'tree')).toBe(false);
  });

  it('rolls randomized wave portals on open border tiles with 1-tile no-build buffers', () => {
    const grid = createBaseGrid();
    const w1Portals = rollWavePortals(1, grid, [], () => 0.35);
    const w3Portals = rollWavePortals(3, grid, [], () => 0.65);

    expect(w1Portals).toHaveLength(2);
    expect(w3Portals).toHaveLength(3);
    expect(new Set(w3Portals.map((p) => p.side)).size).toBe(3);

    for (const p of w3Portals) {
      expect(p.cells.length).toBeGreaterThanOrEqual(2);
      for (const c of p.cells) {
        expect(grid[c.gy][c.gx]).not.toBe('tree');
        expect(isNoBuildTile(c.gx, c.gy, grid, w3Portals)).toBe(true);
        expect(isPortalBufferTile(c.gx, c.gy, w3Portals)).toBe(true);
      }
    }
  });
});
