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

export const CORE_CELLS: GridPoint[] = [
  { gx: 8, gy: 5 },
  { gx: 9, gy: 5 },
  { gx: 8, gy: 6 },
  { gx: 9, gy: 6 },
];

export const SPAWN_WEST: GridPoint[] = [
  { gx: 0, gy: 4 },
  { gx: 0, gy: 5 },
  { gx: 0, gy: 6 },
  { gx: 0, gy: 7 },
];

export const SPAWN_EAST: GridPoint[] = [
  { gx: 17, gy: 4 },
  { gx: 17, gy: 5 },
  { gx: 17, gy: 6 },
  { gx: 17, gy: 7 },
];

const DIRS: readonly GridPoint[] = [
  { gx: 1, gy: 0 },
  { gx: -1, gy: 0 },
  { gx: 0, gy: 1 },
  { gx: 0, gy: -1 },
];

const WATER_MOATS: readonly GridPoint[] = [
  { gx: 5, gy: 5 },
  { gx: 5, gy: 6 },
  { gx: 12, gy: 5 },
  { gx: 12, gy: 6 },
];

function key(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

function inBounds(gx: number, gy: number): boolean {
  return gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS;
}

function isCoreCell(gx: number, gy: number): boolean {
  return (gx === 8 || gx === 9) && (gy === 5 || gy === 6);
}

function minCoreDist(gx: number, gy: number): number {
  let best = Infinity;
  for (const c of CORE_CELLS) {
    const d = Math.abs(gx - c.gx) + Math.abs(gy - c.gy);
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

  // Main horizontal lanes (y = 5, 6) and center ring around the 2x2 core
  for (let gx = 1; gx < GRID_COLS - 1; gx++) {
    grid[5][gx] = 'dirt';
    grid[6][gx] = 'dirt';
  }
  for (let gy = 4; gy <= 7; gy++) {
    for (let gx = 7; gx <= 10; gx++) {
      grid[gy][gx] = 'dirt';
    }
  }

  for (const w of WATER_MOATS) {
    grid[w.gy][w.gx] = 'water';
  }
  for (const c of CORE_CELLS) {
    grid[c.gy][c.gx] = 'core';
  }
  for (const s of SPAWN_WEST) {
    grid[s.gy][s.gx] = 'spawn';
  }
  for (const s of SPAWN_EAST) {
    grid[s.gy][s.gx] = 'spawn';
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
  if (tiles[gy][gx] === 'water') return false;
  if (movementType === 'ground' && blockedWalls.has(key(gx, gy))) return false;
  return true;
}

/**
 * 4-directional A* from `start` to the nearest Bastion Core cell.
 * Returns the full path (including `start` and core tile), or `null` if blocked.
 */
export function findPath(
  start: GridPoint,
  tiles: TileKind[][],
  blockedWalls: Set<string>,
  movementType: MovementType,
): GridPoint[] | null {
  if (!inBounds(start.gx, start.gy)) return null;
  if (isCoreCell(start.gx, start.gy)) return [{ gx: start.gx, gy: start.gy }];

  // Nearest core cell to start, used only as a tiny tie-breaker for straight-ish paths
  let refCore = CORE_CELLS[0];
  let refDist = Infinity;
  for (const c of CORE_CELLS) {
    const d = Math.abs(start.gx - c.gx) + Math.abs(start.gy - c.gy);
    if (d < refDist) {
      refDist = d;
      refCore = c;
    }
  }
  const dxStart = start.gx - refCore.gx;
  const dyStart = start.gy - refCore.gy;

  const totalCells = GRID_COLS * GRID_ROWS;
  const gScore = new Float64Array(totalCells).fill(Infinity);
  const fScore = new Float64Array(totalCells).fill(Infinity);
  const cameFrom = new Int32Array(totalCells).fill(-1);
  const closed = new Uint8Array(totalCells);

  const idx = (gx: number, gy: number) => gy * GRID_COLS + gx;
  const startIdx = idx(start.gx, start.gy);

  gScore[startIdx] = 0;
  fScore[startIdx] = minCoreDist(start.gx, start.gy);

  const open: number[] = [startIdx];

  while (open.length > 0) {
    // Grid has at most 216 cells, so linear scan is fast and allocation-free.
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

    if (isCoreCell(cx, cy)) {
      const path: GridPoint[] = [];
      let cur = current;
      while (cur !== -1) {
        path.push({ gx: cur % GRID_COLS, gy: Math.floor(cur / GRID_COLS) });
        cur = cameFrom[cur];
      }
      path.reverse();
      return path;
    }

    const baseG = gScore[current] + 1;
    for (const d of DIRS) {
      const nx = cx + d.gx;
      const ny = cy + d.gy;
      if (!isPassable(nx, ny, tiles, blockedWalls, movementType)) continue;

      const nIdx = idx(nx, ny);
      if (closed[nIdx]) continue;

      if (baseG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = baseG;
        const dx1 = nx - refCore.gx;
        const dy1 = ny - refCore.gy;
        const cross = Math.abs(dx1 * dyStart - dxStart * dy1);
        fScore[nIdx] = baseG + minCoreDist(nx, ny) + cross * 0.0001;
        open.push(nIdx);
      }
    }
  }

  return null;
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
      if (!inBounds(nx, ny) || tiles[ny][nx] === 'water') continue;
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
  const candidates: Array<{ structure: GridStructure; dist: number; total: number }> = [];

  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const nextDist = distFromStart[cur.gy][cur.gx] + 1;
    for (const d of DIRS) {
      const nx = cur.gx + d.gx;
      const ny = cur.gy + d.gy;
      if (!inBounds(nx, ny) || tiles[ny][nx] === 'water') continue;
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
      if (!inBounds(nx, ny) || tiles[ny][nx] === 'water') continue;
      if (fallbackDist[ny][nx] !== -1) continue;
      const wall = wallMap.get(key(nx, ny));
      if (wall) return wall;
      fallbackDist[ny][nx] = nextDist;
      fq.push({ gx: nx, gy: ny });
    }
  }

  return null;
}

/**
 * Returns true if structures cannot be placed at `(gx, gy)`.
 * Blocks out-of-bounds, core, spawn, water moat tiles, and the 1-tile spawn buffer.
 */
export function isNoBuildTile(gx: number, gy: number, tiles: TileKind[][]): boolean {
  if (!inBounds(gx, gy)) return true;
  const tile = tiles[gy][gx];
  if (tile === 'core' || tile === 'spawn' || tile === 'water') return true;
  if ((gx === 1 || gx === 16) && gy >= 4 && gy <= 7) return true;
  return false;
}
