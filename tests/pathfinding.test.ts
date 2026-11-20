import { describe, expect, it } from 'vitest';
import {
  CORE_CELLS,
  SPAWN_EAST,
  SPAWN_WEST,
  createBaseGrid,
  findNearestBlockingWall,
  findPath,
  findUnitPath,
  isNoBuildTile,
  isPortalBufferTile,
  rollWavePortals,
  rotateWavePortals,
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

  it('handles findPath boundary cases (core start, out-of-bounds, impassable start)', () => {
    const grid = createBaseGrid();
    // Starting on a core cell returns single-element path
    expect(findPath(CORE_CELLS[0], grid, new Set(), 'ground')).toEqual([
      CORE_CELLS[0],
    ]);
    // Out-of-bounds start returns null
    expect(findPath({ gx: -1, gy: 5 }, grid, new Set(), 'ground')).toBeNull();
    // Completely boxed-in ground unit returns null while fly escapes over walls
    const boxed = new Set([
      '4,4',
      '5,4',
      '6,4',
      '4,5',
      '6,5',
      '4,6',
      '5,6',
      '6,6',
    ]);
    expect(findPath({ gx: 5, gy: 5 }, grid, boxed, 'ground')).toBeNull();
    expect(findPath({ gx: 5, gy: 5 }, grid, boxed, 'fly')).not.toBeNull();
  });

  it('ignores ruined or non-blocking structures in findNearestBlockingWall and checks OOB/water no-build', () => {
    const grid = createBaseGrid();
    const ruinedWall = makeWall('w_ruined', 3, SPAWN_WEST[1].gy, true);
    const nonBlocking: GridStructure = {
      uid: 'bush_1',
      kind: 'berry_bush',
      gx: 3,
      gy: SPAWN_WEST[1].gy + 1,
      hp: 150,
      maxHp: 150,
      ruined: false,
    };
    expect(
      findNearestBlockingWall(SPAWN_WEST[1], grid, [ruinedWall, nonBlocking]),
    ).toBeNull();
    expect(
      findNearestBlockingWall({ gx: -1, gy: 0 }, grid, [
        makeWall('w1', 3, 5, false),
      ]),
    ).toBeNull();

    // Out-of-bounds and water tiles are no-build
    expect(isNoBuildTile(-1, 5, grid)).toBe(true);
    expect(isNoBuildTile(999, 5, grid)).toBe(true);
    grid[5][5] = 'water';
    expect(isNoBuildTile(5, 5, grid)).toBe(true);

    // Portal buffer is 1-tile Manhattan only (not diagonal)
    const portals = [
      { id: 'p_w', side: 'west' as const, cells: [{ gx: 0, gy: 8 }] },
    ];
    expect(isPortalBufferTile(1, 8, portals)).toBe(true);
    expect(isPortalBufferTile(1, 9, portals)).toBe(false);
  });

  it('rolls 2-cell portals on Wave 1 and 3-cell portals on Wave 2+', () => {
    const grid = createBaseGrid();
    const w1 = rollWavePortals(1, grid, [], () => 0.25);
    const w2 = rollWavePortals(2, grid, [], () => 0.25);
    expect(w1.every((p) => p.cells.length === 2)).toBe(true);
    expect(w2.every((p) => p.cells.length === 3)).toBe(true);
  });

  it('finds unit walking paths around structures/core and returns null when walled off', () => {
    const grid = createBaseGrid();
    const blocked = new Set<string>(['6,7', '6,8', '6,9']);
    const path = findUnitPath(
      { gx: 5, gy: 8 },
      { gx: 7, gy: 8 },
      grid,
      blocked,
    );
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ gx: 5, gy: 8 });
    expect(path![path!.length - 1]).toEqual({ gx: 7, gy: 8 });
    expect(path!.some((p) => blocked.has(`${p.gx},${p.gy}`))).toBe(false);
    expect(path!.some((p) => grid[p.gy][p.gx] === 'core')).toBe(false);

    // Completely enclosed destination returns null
    const enclosed = new Set<string>([
      '6,7',
      '7,7',
      '8,7',
      '6,8',
      '8,8',
      '6,9',
      '7,9',
      '8,9',
    ]);
    expect(
      findUnitPath({ gx: 5, gy: 8 }, { gx: 7, gy: 8 }, grid, enclosed),
    ).toBeNull();
    expect(
      findUnitPath({ gx: 5, gy: 8 }, { gx: 1, gy: 8 }, grid, new Set()),
    ).toBeNull();
    expect(
      findUnitPath({ gx: 5, gy: 8 }, { gx: 5, gy: 1 }, grid, new Set()),
    ).toBeNull();
  });

  it('handles findNearestBlockingWall startWall, tie-breaking, and unreachable water-island cases', () => {
    const grid = createBaseGrid();
    const startWall = makeWall('w_start', 5, 8);
    expect(
      findNearestBlockingWall({ gx: 5, gy: 8 }, grid, [
        startWall,
        makeWall('w_other', 6, 8),
      ]),
    ).toBe(startWall);

    // Tie-breaking: w_near (dist 1, total 1+7=8) beats w_far (dist 2, total 2+6=8)
    // Start at (5,8), Core is at (13..14, 8..9): (6,8) has dist 1 + distToCore 7 = 8; (7,8) if reachable would be 2+6=8,
    // so place w_near at (6,8) and w_detour at (4,8) (dist 1 + distToCore 9 = 10) or two walls at equal total:
    // Start at (5,8): (6,8) has dist=1, dCore=7 (total=8). (5,7) has dist=1, dCore=8 (total=9).
    // If we start at (6,8) and place walls at (7,8) [dist=1, dCore=6, total=7] and (6,7) [dist=1, dCore=7, total=8]:
    const wCloser = makeWall('w_closer', 7, 8);
    const wSide = makeWall('w_side', 6, 7);
    expect(
      findNearestBlockingWall({ gx: 6, gy: 8 }, grid, [wSide, wCloser]),
    ).toBe(wCloser);

    // Unreachable wall when start is sealed off by water returns null
    const waterGrid = createBaseGrid();
    waterGrid[7][5] = 'water';
    waterGrid[9][5] = 'water';
    waterGrid[8][4] = 'water';
    waterGrid[8][6] = 'water';
    expect(
      findNearestBlockingWall({ gx: 5, gy: 8 }, waterGrid, [
        makeWall('w_far', 10, 8),
      ]),
    ).toBeNull();
  });

  it('avoids standing structures in rollWavePortals and falls back when all borders are blocked', () => {
    const grid = createBaseGrid();
    const blocker: GridStructure = makeWall('w_border', 0, 8);
    const portals = rollWavePortals(1, grid, [blocker], () => 0.5);
    for (const p of portals) {
      expect(p.cells.some((c) => c.gx === 0 && c.gy === 8)).toBe(false);
    }

    // Block all border tiles with trees so no candidate groups exist -> falls back to SPAWN_WEST
    const blockedGrid = createBaseGrid();
    for (let x = 0; x < blockedGrid[0].length; x++) {
      blockedGrid[0][x] = 'tree';
      blockedGrid[blockedGrid.length - 1][x] = 'tree';
    }
    for (let y = 0; y < blockedGrid.length; y++) {
      blockedGrid[y][0] = 'tree';
      blockedGrid[y][blockedGrid[0].length - 1] = 'tree';
    }
    const fallback = rollWavePortals(3, blockedGrid, [], () => 0.5);
    expect(fallback).toEqual([
      {
        id: 'portal_3_west',
        side: 'west',
        cells: SPAWN_WEST.slice(0, 2),
      },
    ]);
  });

  it('handles findUnitPath start === target, out-of-bounds, and diagonal corner-cutting', () => {
    const grid = createBaseGrid();
    expect(
      findUnitPath({ gx: 5, gy: 8 }, { gx: 5, gy: 8 }, grid, new Set()),
    ).toEqual([{ gx: 5, gy: 8 }]);
    expect(
      findUnitPath({ gx: -1, gy: 8 }, { gx: 5, gy: 8 }, grid, new Set()),
    ).toBeNull();
    expect(
      findUnitPath({ gx: 5, gy: 8 }, { gx: 99, gy: 8 }, grid, new Set()),
    ).toBeNull();

    // Diagonal corner-cutting: block (6,8) and (5,7) so unit at (5,8) cannot step diagonally to (6,7)
    const cornerBlocked = new Set(['6,8', '5,7']);
    const path = findUnitPath(
      { gx: 5, gy: 8 },
      { gx: 6, gy: 7 },
      grid,
      cornerBlocked,
    );
    expect(path).not.toBeNull();
    // Must not go directly from (5,8) to (6,7) in 1 step
    expect(path!.length).toBeGreaterThan(2);
  });

  it('rotates 1 portal every 2 waves in rotateWavePortals', () => {
    const grid = createBaseGrid();
    const w1 = rotateWavePortals(1, [], grid, [], () => 0.25);
    expect(w1).toHaveLength(2);

    // Wave 2 keeps Wave 1 portals unchanged
    const w2 = rotateWavePortals(2, w1, grid, [], () => 0.75);
    expect(w2).toEqual(w1);

    // Wave 3 expands to 3 portals without moving Wave 1-2 portals
    const w3 = rotateWavePortals(3, w2, grid, [], () => 0.5);
    expect(w3).toHaveLength(3);
    expect(w3.slice(0, 2)).toEqual(w2);
    expect(new Set(w3.map((p) => p.side)).size).toBe(3);

    // Wave 4 keeps all 3 portals
    const w4 = rotateWavePortals(4, w3, grid, [], () => 0.5);
    expect(w4).toEqual(w3);

    // Wave 5 drops the oldest portal (w4[0]), keeps w4[1..2], and opens 1 new portal
    const w5 = rotateWavePortals(5, w4, grid, [], () => 0.5);
    expect(w5).toHaveLength(3);
    expect(w5.slice(0, 2)).toEqual(w4.slice(1));
    expect(w5[2].id).not.toBe(w4[0].id);
  });

  it('allows water placement and pathfinding when allowWater is true, and supports structure pass-through', () => {
    const grid = createBaseGrid();
    grid[8][6] = 'water';
    grid[7][6] = 'water';
    grid[9][6] = 'water';
    grid[5][8] = 'tree';
    const portals = [{ id: 'p1', side: 'west' as const, cells: SPAWN_WEST }];

    // Water tile blocked by default, allowed with allowWater = true
    expect(isNoBuildTile(6, 8, grid, portals)).toBe(true);
    expect(isNoBuildTile(6, 8, grid, portals, true)).toBe(false);
    // Core, tree, border, and portal buffer remain blocked even when allowWater = true
    expect(
      isNoBuildTile(CORE_CELLS[0].gx, CORE_CELLS[0].gy, grid, portals, true),
    ).toBe(true);
    expect(isNoBuildTile(8, 5, grid, portals, true)).toBe(true); // tree
    expect(isNoBuildTile(1, 8, grid, portals, true)).toBe(true); // border
    expect(isNoBuildTile(1, 7, grid, portals, true)).toBe(true); // portal buffer

    // Non-water unit cannot stop on water tile
    expect(
      findUnitPath({ gx: 5, gy: 8 }, { gx: 6, gy: 8 }, grid, new Set(), false),
    ).toBeNull();

    // Water unit can stop on and walk through water tiles
    const waterDestPath = findUnitPath(
      { gx: 5, gy: 8 },
      { gx: 6, gy: 8 },
      grid,
      new Set(),
      true,
    );
    expect(waterDestPath).toEqual([
      { gx: 5, gy: 8 },
      { gx: 6, gy: 8 },
    ]);

    const acrossWater = findUnitPath(
      { gx: 5, gy: 8 },
      { gx: 7, gy: 8 },
      grid,
      new Set(),
      true,
    );
    expect(acrossWater).toEqual([
      { gx: 5, gy: 8 },
      { gx: 6, gy: 8 },
      { gx: 7, gy: 8 },
    ]);

    // Structure pass-through: passing empty blockedStructures lets allied units walk through structure tiles
    const passThroughPath = findUnitPath(
      { gx: 5, gy: 10 },
      { gx: 7, gy: 10 },
      grid,
      new Set(),
    );
    expect(passThroughPath).toEqual([
      { gx: 5, gy: 10 },
      { gx: 6, gy: 10 },
      { gx: 7, gy: 10 },
    ]);
  });

  it('blocks flying enemy paths on tiles occupied by allied flying units', () => {
    const grid = createBaseGrid();
    const flyBlocked = new Set(['11,8', '11,7', '11,9']);
    const path = findPath(
      { gx: 10, gy: 8 },
      grid,
      new Set(),
      'fly',
      flyBlocked,
    );
    expect(path).not.toBeNull();
    const pathKeys = new Set(path!.map((p) => `${p.gx},${p.gy}`));
    expect(pathKeys.has('11,8')).toBe(false);
    expect(pathKeys.has('11,7')).toBe(false);
    expect(pathKeys.has('11,9')).toBe(false);

    // Without flyBlocked, a ground wall doesn't block flyers
    const unblocked = findPath(
      { gx: 10, gy: 8 },
      grid,
      new Set(['11,8']),
      'fly',
    );
    expect(unblocked).not.toBeNull();
  });
});
