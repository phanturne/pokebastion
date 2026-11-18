import { STRUCTURE_SPECS } from '../data/pokemon';
import {
  GRID_COLS,
  GRID_ROWS,
  GridStructure,
  MovementType,
  TileKind,
} from '../types';

export interface GridPoint {
  gx: number;
  gy: number;
}

export type PortalSide = 'north' | 'south' | 'west' | 'east';

export interface SpawnPortal {
  id: string;
  side: PortalSide;
  cells: GridPoint[];
}

const CORE_X = Math.floor(GRID_COLS / 2) - 1; // 13
const CORE_Y = Math.floor(GRID_ROWS / 2) - 1; // 8
const SPAWN_MIN_Y = CORE_Y - 1; // 7
const SPAWN_MAX_Y = CORE_Y + 2; // 10

export const CORE_CELLS: GridPoint[] = [
  { gx: CORE_X, gy: CORE_Y },
  { gx: CORE_X + 1, gy: CORE_Y },
  { gx: CORE_X, gy: CORE_Y + 1 },
  { gx: CORE_X + 1, gy: CORE_Y + 1 },
];

export const SPAWN_WEST: GridPoint[] = [
  { gx: 0, gy: SPAWN_MIN_Y },
  { gx: 0, gy: SPAWN_MIN_Y + 1 },
  { gx: 0, gy: SPAWN_MIN_Y + 2 },
  { gx: 0, gy: SPAWN_MAX_Y },
];

export const SPAWN_EAST: GridPoint[] = [
  { gx: GRID_COLS - 1, gy: SPAWN_MIN_Y },
  { gx: GRID_COLS - 1, gy: SPAWN_MIN_Y + 1 },
  { gx: GRID_COLS - 1, gy: SPAWN_MIN_Y + 2 },
  { gx: GRID_COLS - 1, gy: SPAWN_MAX_Y },
];

const DIRS: readonly GridPoint[] = [
  { gx: 1, gy: 0 },
  { gx: -1, gy: 0 },
  { gx: 0, gy: 1 },
  { gx: 0, gy: -1 },
];

const DIRS_8: readonly (GridPoint & { cost: number })[] = [
  { gx: 1, gy: 0, cost: 1 },
  { gx: -1, gy: 0, cost: 1 },
  { gx: 0, gy: 1, cost: 1 },
  { gx: 0, gy: -1, cost: 1 },
  { gx: 1, gy: 1, cost: Math.SQRT2 },
  { gx: 1, gy: -1, cost: Math.SQRT2 },
  { gx: -1, gy: 1, cost: Math.SQRT2 },
  { gx: -1, gy: -1, cost: Math.SQRT2 },
];

const WATER_MOATS: readonly GridPoint[] = [];

const TREE_TILES: readonly GridPoint[] = [
  // NW corner forest cluster
  { gx: 0, gy: 0 },
  { gx: 1, gy: 0 },
  { gx: 2, gy: 0 },
  { gx: 3, gy: 0 },
  { gx: 0, gy: 1 },
  { gx: 1, gy: 1 },
  { gx: 2, gy: 1 },
  { gx: 3, gy: 1 },
  { gx: 0, gy: 2 },
  { gx: 1, gy: 2 },
  { gx: 2, gy: 2 },
  // NE corner forest cluster
  { gx: GRID_COLS - 1, gy: 0 },
  { gx: GRID_COLS - 2, gy: 0 },
  { gx: GRID_COLS - 3, gy: 0 },
  { gx: GRID_COLS - 4, gy: 0 },
  { gx: GRID_COLS - 1, gy: 1 },
  { gx: GRID_COLS - 2, gy: 1 },
  { gx: GRID_COLS - 3, gy: 1 },
  { gx: GRID_COLS - 4, gy: 1 },
  { gx: GRID_COLS - 1, gy: 2 },
  { gx: GRID_COLS - 2, gy: 2 },
  { gx: GRID_COLS - 3, gy: 2 },
  // SW corner forest cluster
  { gx: 0, gy: GRID_ROWS - 1 },
  { gx: 1, gy: GRID_ROWS - 1 },
  { gx: 2, gy: GRID_ROWS - 1 },
  { gx: 3, gy: GRID_ROWS - 1 },
  { gx: 0, gy: GRID_ROWS - 2 },
  { gx: 1, gy: GRID_ROWS - 2 },
  { gx: 2, gy: GRID_ROWS - 2 },
  { gx: 3, gy: GRID_ROWS - 2 },
  { gx: 0, gy: GRID_ROWS - 3 },
  { gx: 1, gy: GRID_ROWS - 3 },
  { gx: 2, gy: GRID_ROWS - 3 },
  // SE corner forest cluster
  { gx: GRID_COLS - 1, gy: GRID_ROWS - 1 },
  { gx: GRID_COLS - 2, gy: GRID_ROWS - 1 },
  { gx: GRID_COLS - 3, gy: GRID_ROWS - 1 },
  { gx: GRID_COLS - 4, gy: GRID_ROWS - 1 },
  { gx: GRID_COLS - 1, gy: GRID_ROWS - 2 },
  { gx: GRID_COLS - 2, gy: GRID_ROWS - 2 },
  { gx: GRID_COLS - 3, gy: GRID_ROWS - 2 },
  { gx: GRID_COLS - 4, gy: GRID_ROWS - 2 },
  { gx: GRID_COLS - 1, gy: GRID_ROWS - 3 },
  { gx: GRID_COLS - 2, gy: GRID_ROWS - 3 },
  { gx: GRID_COLS - 3, gy: GRID_ROWS - 3 },
  // North & South mid-woods groves (leaving wide open portal stretches in between)
  { gx: 6, gy: 2 },
  { gx: 7, gy: 2 },
  { gx: 7, gy: 1 },
  { gx: 8, gy: 1 },
  { gx: GRID_COLS - 7, gy: 2 },
  { gx: GRID_COLS - 8, gy: 2 },
  { gx: GRID_COLS - 8, gy: 1 },
  { gx: GRID_COLS - 9, gy: 1 },
  { gx: 6, gy: GRID_ROWS - 3 },
  { gx: 7, gy: GRID_ROWS - 3 },
  { gx: 7, gy: GRID_ROWS - 2 },
  { gx: 8, gy: GRID_ROWS - 2 },
  { gx: GRID_COLS - 7, gy: GRID_ROWS - 3 },
  { gx: GRID_COLS - 8, gy: GRID_ROWS - 3 },
  { gx: GRID_COLS - 8, gy: GRID_ROWS - 2 },
  { gx: GRID_COLS - 9, gy: GRID_ROWS - 2 },
  // Organic 4-tree groves flanking the West & East approaches
  { gx: 7, gy: 5 },
  { gx: 8, gy: 5 },
  { gx: 9, gy: 5 },
  { gx: 8, gy: 6 },
  { gx: 7, gy: 12 },
  { gx: 8, gy: 12 },
  { gx: 9, gy: 12 },
  { gx: 8, gy: 11 },
  { gx: 18, gy: 5 },
  { gx: 19, gy: 5 },
  { gx: 20, gy: 5 },
  { gx: 19, gy: 6 },
  { gx: 18, gy: 12 },
  { gx: 19, gy: 12 },
  { gx: 20, gy: 12 },
  { gx: 19, gy: 11 },
  // Mid-field tactical tree pillars
  { gx: 5, gy: 5 },
  { gx: GRID_COLS - 6, gy: 5 },
  { gx: 5, gy: GRID_ROWS - 6 },
  { gx: GRID_COLS - 6, gy: GRID_ROWS - 6 },
  { gx: 10, gy: 3 },
  { gx: GRID_COLS - 11, gy: 3 },
  { gx: 10, gy: GRID_ROWS - 4 },
  { gx: GRID_COLS - 11, gy: GRID_ROWS - 4 },
];

function key(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

function inBounds(gx: number, gy: number): boolean {
  return gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS;
}

function isCoreCell(gx: number, gy: number): boolean {
  return (
    (gx === CORE_X || gx === CORE_X + 1) && (gy === CORE_Y || gy === CORE_Y + 1)
  );
}

function minCoreDist(gx: number, gy: number): number {
  let best = Infinity;
  for (const c of CORE_CELLS) {
    const dx = Math.abs(gx - c.gx);
    const dy = Math.abs(gy - c.gy);
    const d = Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Creates the 18x12 base battlefield grid indexed as `tiles[gy][gx]`.
 */
export function createBaseGrid(): TileKind[][] {
  const grid: TileKind[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, (): TileKind => 'grass'),
  );

  for (const w of WATER_MOATS) {
    grid[w.gy][w.gx] = 'water';
  }
  for (const t of TREE_TILES) {
    grid[t.gy][t.gx] = 'tree';
  }
  for (const c of CORE_CELLS) {
    grid[c.gy][c.gx] = 'core';
  }

  return grid;
}

function isPassable(
  gx: number,
  gy: number,
  tiles: TileKind[][],
  blockedWalls: Set<string>,
  movementType: MovementType,
): boolean {
  if (!inBounds(gx, gy)) return false;
  if (movementType === 'fly') return true;
  if (tiles[gy][gx] === 'water' || tiles[gy][gx] === 'tree') return false;
  if (movementType === 'ground' && blockedWalls.has(key(gx, gy))) return false;
  return true;
}

function isUnitPassable(
  gx: number,
  gy: number,
  tiles: TileKind[][],
  blockedStructures: Set<string>,
): boolean {
  if (!inBounds(gx, gy)) return false;
  const tile = tiles[gy][gx];
  if (tile === 'water' || tile === 'tree' || tile === 'core') return false;
  if (blockedStructures.has(key(gx, gy))) return false;
  return true;
}

function runAStar(
  start: GridPoint,
  canStep: (gx: number, gy: number) => boolean,
  isGoal: (gx: number, gy: number) => boolean,
  heuristic: (gx: number, gy: number) => number,
  refPoint: GridPoint,
): GridPoint[] | null {
  if (!inBounds(start.gx, start.gy)) return null;
  if (isGoal(start.gx, start.gy)) return [{ gx: start.gx, gy: start.gy }];

  const dxStart = start.gx - refPoint.gx;
  const dyStart = start.gy - refPoint.gy;

  const totalCells = GRID_COLS * GRID_ROWS;
  const gScore = new Float64Array(totalCells).fill(Infinity);
  const fScore = new Float64Array(totalCells).fill(Infinity);
  const cameFrom = new Int32Array(totalCells).fill(-1);
  const closed = new Uint8Array(totalCells);

  const idx = (gx: number, gy: number) => gy * GRID_COLS + gx;
  const startIdx = idx(start.gx, start.gy);

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(start.gx, start.gy);

  const open: number[] = [startIdx];

  while (open.length > 0) {
    let bestPos = 0;
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < fScore[open[bestPos]]) {
        bestPos = i;
      }
    }
    const current = open[bestPos];
    open.splice(bestPos, 1);

    if (closed[current]) continue;
    closed[current] = 1;

    const cx = current % GRID_COLS;
    const cy = Math.floor(current / GRID_COLS);

    if (isGoal(cx, cy)) {
      const path: GridPoint[] = [];
      let cur = current;
      while (cur !== -1) {
        path.push({ gx: cur % GRID_COLS, gy: Math.floor(cur / GRID_COLS) });
        cur = cameFrom[cur];
      }
      path.reverse();
      return path;
    }

    for (const d of DIRS_8) {
      const nx = cx + d.gx;
      const ny = cy + d.gy;
      if (!canStep(nx, ny)) continue;
      // Prevent diagonal corner-cutting through solid obstacles
      if (d.gx !== 0 && d.gy !== 0) {
        if (!canStep(cx + d.gx, cy) || !canStep(cx, cy + d.gy)) {
          continue;
        }
      }

      const nIdx = idx(nx, ny);
      if (closed[nIdx]) continue;

      const nextG = gScore[current] + d.cost;
      if (nextG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = nextG;
        const dx1 = nx - refPoint.gx;
        const dy1 = ny - refPoint.gy;
        const cross = Math.abs(dx1 * dyStart - dxStart * dy1);
        fScore[nIdx] = nextG + heuristic(nx, ny) + cross * 0.0001;
        open.push(nIdx);
      }
    }
  }

  return null;
}

/**
 * 8-directional A* from `start` to the nearest Bastion Core cell.
 * Returns the full path (including `start` and core tile), or `null` if blocked.
 */
export function findPath(
  start: GridPoint,
  tiles: TileKind[][],
  blockedWalls: Set<string>,
  movementType: MovementType,
): GridPoint[] | null {
  let refCore = CORE_CELLS[0];
  let refDist = Infinity;
  for (const c of CORE_CELLS) {
    const d = Math.abs(start.gx - c.gx) + Math.abs(start.gy - c.gy);
    if (d < refDist) {
      refDist = d;
      refCore = c;
    }
  }

  return runAStar(
    start,
    (gx, gy) => isPassable(gx, gy, tiles, blockedWalls, movementType),
    isCoreCell,
    minCoreDist,
    refCore,
  );
}

/**
 * 8-directional A* for a player Pokémon walking from `start` to `target`.
 * Avoids water, trees, core tiles, and active structures; allies can be walked through.
 */
export function findUnitPath(
  start: GridPoint,
  target: GridPoint,
  tiles: TileKind[][],
  blockedStructures: Set<string>,
): GridPoint[] | null {
  if (!isUnitPassable(target.gx, target.gy, tiles, blockedStructures)) {
    return null;
  }
  return runAStar(
    start,
    (gx, gy) => isUnitPassable(gx, gy, tiles, blockedStructures),
    (gx, gy) => gx === target.gx && gy === target.gy,
    (gx, gy) => Math.hypot(gx - target.gx, gy - target.gy),
    target,
  );
}

/**
 * Fallback used when all ground routes to the Core are blocked.
 * Finds the closest reachable standing ground-blocking wall along a route toward the Core.
 */
export function findNearestBlockingWall(
  start: GridPoint,
  tiles: TileKind[][],
  structures: GridStructure[],
): GridStructure | null {
  if (!inBounds(start.gx, start.gy)) return null;

  const wallMap = new Map<string, GridStructure>();
  for (const s of structures) {
    if (!s.ruined && s.hp > 0 && STRUCTURE_SPECS[s.kind].blocksGround) {
      wallMap.set(key(s.gx, s.gy), s);
    }
  }
  if (wallMap.size === 0) return null;

  const startWall = wallMap.get(key(start.gx, start.gy));
  if (startWall) return startWall;

  // 1. BFS from CORE_CELLS ignoring walls (respecting water) to get distance-to-core per tile.
  const INF = 1_000_000;
  const distToCore = Array.from({ length: GRID_ROWS }, () =>
    new Int32Array(GRID_COLS).fill(INF),
  );
  const coreQueue: GridPoint[] = [];
  for (const c of CORE_CELLS) {
    distToCore[c.gy][c.gx] = 0;
    coreQueue.push(c);
  }
  for (let head = 0; head < coreQueue.length; head++) {
    const cur = coreQueue[head];
    const nextDist = distToCore[cur.gy][cur.gx] + 1;
    for (const d of DIRS) {
      const nx = cur.gx + d.gx;
      const ny = cur.gy + d.gy;
      if (
        !inBounds(nx, ny) ||
        tiles[ny][nx] === 'water' ||
        tiles[ny][nx] === 'tree'
      )
        continue;
      if (nextDist < distToCore[ny][nx]) {
        distToCore[ny][nx] = nextDist;
        coreQueue.push({ gx: nx, gy: ny });
      }
    }
  }

  // 2. BFS from `start` through open tiles to collect all directly reachable blocking walls.
  const distFromStart = Array.from({ length: GRID_ROWS }, () =>
    new Int32Array(GRID_COLS).fill(-1),
  );
  distFromStart[start.gy][start.gx] = 0;
  const queue: GridPoint[] = [{ gx: start.gx, gy: start.gy }];
  const candidates: Array<{
    structure: GridStructure;
    dist: number;
    total: number;
  }> = [];

  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const nextDist = distFromStart[cur.gy][cur.gx] + 1;
    for (const d of DIRS) {
      const nx = cur.gx + d.gx;
      const ny = cur.gy + d.gy;
      if (
        !inBounds(nx, ny) ||
        tiles[ny][nx] === 'water' ||
        tiles[ny][nx] === 'tree'
      )
        continue;
      if (distFromStart[ny][nx] !== -1) continue;

      distFromStart[ny][nx] = nextDist;
      const wall = wallMap.get(key(nx, ny));
      if (wall) {
        candidates.push({
          structure: wall,
          dist: nextDist,
          total: nextDist + distToCore[ny][nx],
        });
      } else {
        queue.push({ gx: nx, gy: ny });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.total - b.total || a.dist - b.dist);
    return candidates[0].structure;
  }

  // Fallback if no candidate found via open BFS: pick nearest standing wall along a wall-ignoring BFS from start.
  const fallbackDist = Array.from({ length: GRID_ROWS }, () =>
    new Int32Array(GRID_COLS).fill(-1),
  );
  fallbackDist[start.gy][start.gx] = 0;
  const fq: GridPoint[] = [{ gx: start.gx, gy: start.gy }];
  for (let head = 0; head < fq.length; head++) {
    const cur = fq[head];
    const nextDist = fallbackDist[cur.gy][cur.gx] + 1;
    for (const d of DIRS) {
      const nx = cur.gx + d.gx;
      const ny = cur.gy + d.gy;
      if (
        !inBounds(nx, ny) ||
        tiles[ny][nx] === 'water' ||
        tiles[ny][nx] === 'tree'
      )
        continue;
      if (fallbackDist[ny][nx] !== -1) continue;
      const wall = wallMap.get(key(nx, ny));
      if (wall) return wall;
      fallbackDist[ny][nx] = nextDist;
      fq.push({ gx: nx, gy: ny });
    }
  }

  return null;
}

export function isPortalBufferTile(
  gx: number,
  gy: number,
  portals: readonly SpawnPortal[],
): boolean {
  for (const p of portals) {
    for (const c of p.cells) {
      if (Math.abs(gx - c.gx) + Math.abs(gy - c.gy) <= 1) return true;
    }
  }
  return false;
}

/**
 * Rolls 2 (Waves 1-2) or 3 (Wave 3+) randomized 2-3 tile spawn portals along
 * the outer map borders, avoiding trees, water, core, and standing structures.
 */
export function rollWavePortals(
  wave: number,
  tiles: TileKind[][],
  structures: readonly GridStructure[],
  rng: () => number = Math.random,
): SpawnPortal[] {
  const occupied = new Set(
    structures.filter((s) => !s.ruined).map((s) => key(s.gx, s.gy)),
  );
  const isOpenBorder = (gx: number, gy: number) => {
    if (!inBounds(gx, gy)) return false;
    const t = tiles[gy][gx];
    return (
      t !== 'tree' &&
      t !== 'water' &&
      t !== 'core' &&
      !occupied.has(key(gx, gy))
    );
  };

  const candidatesForSide = (side: PortalSide): GridPoint[][] => {
    const groups: GridPoint[][] = [];
    const span = wave >= 2 ? 3 : 2;
    if (side === 'west' || side === 'east') {
      const gx = side === 'west' ? 0 : GRID_COLS - 1;
      for (let y = 2; y <= GRID_ROWS - 2 - span; y++) {
        const cells: GridPoint[] = [];
        let ok = true;
        for (let dy = 0; dy < span; dy++) {
          if (!isOpenBorder(gx, y + dy)) {
            ok = false;
            break;
          }
          cells.push({ gx, gy: y + dy });
        }
        if (ok) groups.push(cells);
      }
    } else {
      const gy = side === 'north' ? 0 : GRID_ROWS - 1;
      for (let x = 4; x <= GRID_COLS - 4 - span; x++) {
        const cells: GridPoint[] = [];
        let ok = true;
        for (let dx = 0; dx < span; dx++) {
          if (!isOpenBorder(x + dx, gy)) {
            ok = false;
            break;
          }
          cells.push({ gx: x + dx, gy });
        }
        if (ok) groups.push(cells);
      }
    }
    return groups;
  };

  const allSides: PortalSide[] = ['west', 'east', 'north', 'south'];
  for (let i = allSides.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allSides[i], allSides[j]] = [allSides[j], allSides[i]];
  }

  const targetCount = wave >= 3 ? 3 : 2;
  const portals: SpawnPortal[] = [];
  for (const side of allSides) {
    if (portals.length >= targetCount) break;
    const groups = candidatesForSide(side);
    if (groups.length === 0) continue;
    const cells = groups[Math.floor(rng() * groups.length)];
    portals.push({ id: `portal_${wave}_${side}`, side, cells });
  }

  return portals.length > 0
    ? portals
    : [
        {
          id: `portal_${wave}_west`,
          side: 'west',
          cells: [...SPAWN_WEST.slice(0, 2)],
        },
      ];
}

/**
 * Returns true if structures cannot be placed at `(gx, gy)`.
 * Blocks out-of-bounds, core, spawn, water, tree tiles, and 1-tile active portal buffers.
 */
export const BORDER_NO_BUILD_DEPTH = 2;

export function isNoBuildTile(
  gx: number,
  gy: number,
  tiles: TileKind[][],
  portals?: readonly SpawnPortal[],
): boolean {
  if (!inBounds(gx, gy)) return true;
  if (
    gx < BORDER_NO_BUILD_DEPTH ||
    gx >= GRID_COLS - BORDER_NO_BUILD_DEPTH ||
    gy < BORDER_NO_BUILD_DEPTH ||
    gy >= GRID_ROWS - BORDER_NO_BUILD_DEPTH
  ) {
    return true;
  }
  const tile = tiles[gy][gx];
  if (
    tile === 'core' ||
    tile === 'spawn' ||
    tile === 'water' ||
    tile === 'tree'
  )
    return true;
  if (portals) {
    return isPortalBufferTile(gx, gy, portals);
  }
  return false;
}
