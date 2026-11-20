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

const WATER_MOATS: readonly GridPoint[] = [
  // West C-shaped moat (2 tiles thick on flanks, meeting N/S roads; bridged at gy = 8..9)
  { gx: 8, gy: 5 },
  { gx: 9, gy: 5 },
  { gx: 10, gy: 5 },
  { gx: 11, gy: 5 },
  { gx: 12, gy: 5 },
  { gx: 8, gy: 6 },
  { gx: 9, gy: 6 },
  { gx: 10, gy: 6 },
  { gx: 8, gy: 7 },
  { gx: 9, gy: 7 },
  { gx: 8, gy: 10 },
  { gx: 9, gy: 10 },
  { gx: 8, gy: 11 },
  { gx: 9, gy: 11 },
  { gx: 10, gy: 11 },
  { gx: 8, gy: 12 },
  { gx: 9, gy: 12 },
  { gx: 10, gy: 12 },
  { gx: 11, gy: 12 },
  { gx: 12, gy: 12 },
  // East C-shaped moat (2 tiles thick on flanks, meeting N/S roads; bridged at gy = 8..9)
  { gx: 15, gy: 5 },
  { gx: 16, gy: 5 },
  { gx: 17, gy: 5 },
  { gx: 18, gy: 5 },
  { gx: 19, gy: 5 },
  { gx: 17, gy: 6 },
  { gx: 18, gy: 6 },
  { gx: 19, gy: 6 },
  { gx: 18, gy: 7 },
  { gx: 19, gy: 7 },
  { gx: 18, gy: 10 },
  { gx: 19, gy: 10 },
  { gx: 17, gy: 11 },
  { gx: 18, gy: 11 },
  { gx: 19, gy: 11 },
  { gx: 15, gy: 12 },
  { gx: 16, gy: 12 },
  { gx: 17, gy: 12 },
  { gx: 18, gy: 12 },
  { gx: 19, gy: 12 },
];

const TREE_TILES: readonly GridPoint[] = [
  // NW corner & north-west woods
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
  { gx: 4, gy: 0 },
  { gx: 5, gy: 0 },
  { gx: 6, gy: 0 },
  { gx: 7, gy: 0 },
  { gx: 8, gy: 0 },
  { gx: 9, gy: 0 },
  { gx: 5, gy: 1 },
  { gx: 6, gy: 1 },
  { gx: 8, gy: 1 },
  { gx: 9, gy: 1 },
  // NE corner & north-east woods
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
  { gx: GRID_COLS - 5, gy: 0 },
  { gx: GRID_COLS - 6, gy: 0 },
  { gx: GRID_COLS - 7, gy: 0 },
  { gx: GRID_COLS - 8, gy: 0 },
  { gx: GRID_COLS - 9, gy: 0 },
  { gx: GRID_COLS - 10, gy: 0 },
  { gx: GRID_COLS - 6, gy: 1 },
  { gx: GRID_COLS - 7, gy: 1 },
  { gx: GRID_COLS - 9, gy: 1 },
  { gx: GRID_COLS - 10, gy: 1 },
  // SW corner & south-west woods
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
  { gx: 4, gy: GRID_ROWS - 1 },
  { gx: 5, gy: GRID_ROWS - 1 },
  { gx: 6, gy: GRID_ROWS - 1 },
  { gx: 7, gy: GRID_ROWS - 1 },
  { gx: 8, gy: GRID_ROWS - 1 },
  { gx: 9, gy: GRID_ROWS - 1 },
  { gx: 5, gy: GRID_ROWS - 2 },
  { gx: 6, gy: GRID_ROWS - 2 },
  { gx: 8, gy: GRID_ROWS - 2 },
  { gx: 9, gy: GRID_ROWS - 2 },
  // SE corner & south-east woods
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
  { gx: GRID_COLS - 5, gy: GRID_ROWS - 1 },
  { gx: GRID_COLS - 6, gy: GRID_ROWS - 1 },
  { gx: GRID_COLS - 7, gy: GRID_ROWS - 1 },
  { gx: GRID_COLS - 8, gy: GRID_ROWS - 1 },
  { gx: GRID_COLS - 9, gy: GRID_ROWS - 1 },
  { gx: GRID_COLS - 10, gy: GRID_ROWS - 1 },
  { gx: GRID_COLS - 6, gy: GRID_ROWS - 2 },
  { gx: GRID_COLS - 7, gy: GRID_ROWS - 2 },
  { gx: GRID_COLS - 9, gy: GRID_ROWS - 2 },
  { gx: GRID_COLS - 10, gy: GRID_ROWS - 2 },
  // West & East perimeter woods (leaving wide portal lanes at gy = 7..10)
  { gx: 0, gy: 3 },
  { gx: 1, gy: 3 },
  { gx: 0, gy: 4 },
  { gx: 1, gy: 4 },
  { gx: 0, gy: 5 },
  { gx: 0, gy: 12 },
  { gx: 0, gy: 13 },
  { gx: 1, gy: 13 },
  { gx: 0, gy: 14 },
  { gx: 1, gy: 14 },
  { gx: GRID_COLS - 1, gy: 3 },
  { gx: GRID_COLS - 2, gy: 3 },
  { gx: GRID_COLS - 1, gy: 4 },
  { gx: GRID_COLS - 2, gy: 4 },
  { gx: GRID_COLS - 1, gy: 5 },
  { gx: GRID_COLS - 1, gy: 12 },
  { gx: GRID_COLS - 1, gy: 13 },
  { gx: GRID_COLS - 2, gy: 13 },
  { gx: GRID_COLS - 1, gy: 14 },
  { gx: GRID_COLS - 2, gy: 14 },
];

export function inBounds(gx: number, gy: number): boolean {
  return gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS;
}

function toBlockedMask(blocked: Set<string>): Uint8Array {
  const mask = new Uint8Array(GRID_COLS * GRID_ROWS);
  for (const s of blocked) {
    const comma = s.indexOf(',');
    if (comma === -1) continue;
    const gx = Number(s.slice(0, comma));
    const gy = Number(s.slice(comma + 1));
    if (Number.isInteger(gx) && Number.isInteger(gy) && inBounds(gx, gy)) {
      mask[gy * GRID_COLS + gx] = 1;
    }
  }
  return mask;
}

function isBorderTile(gx: number, gy: number): boolean {
  return (
    gx < BORDER_NO_BUILD_DEPTH ||
    gx >= GRID_COLS - BORDER_NO_BUILD_DEPTH ||
    gy < BORDER_NO_BUILD_DEPTH ||
    gy >= GRID_ROWS - BORDER_NO_BUILD_DEPTH
  );
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

  // Outer dirt road loop + N/S/E/W crossroads matching Viridian Outpost layout
  for (let gx = 4; gx <= 23; gx++) {
    grid[3][gx] = 'dirt';
    grid[14][gx] = 'dirt';
  }
  for (let gy = 3; gy <= 14; gy++) {
    grid[gy][4] = 'dirt';
    grid[gy][23] = 'dirt';
  }
  for (let gy = 0; gy < GRID_ROWS; gy++) {
    grid[gy][CORE_X] = 'dirt';
    grid[gy][CORE_X + 1] = 'dirt';
  }
  for (let gx = 0; gx < GRID_COLS; gx++) {
    grid[CORE_Y][gx] = 'dirt';
    grid[CORE_Y + 1][gx] = 'dirt';
  }

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
  blockedMask: Uint8Array,
  movementType: MovementType,
): boolean {
  if (!inBounds(gx, gy)) return false;
  if (movementType === 'fly') {
    return blockedMask.length === 0 || blockedMask[gy * GRID_COLS + gx] === 0;
  }
  if (tiles[gy][gx] === 'water' || tiles[gy][gx] === 'tree') return false;
  if (movementType === 'ground' && blockedMask[gy * GRID_COLS + gx] !== 0) {
    return false;
  }
  return true;
}

function isUnitPassable(
  gx: number,
  gy: number,
  tiles: TileKind[][],
  blockedMask: Uint8Array,
  allowWater = false,
): boolean {
  if (!inBounds(gx, gy) || isBorderTile(gx, gy)) return false;
  const tile = tiles[gy][gx];
  if ((tile === 'water' && !allowWater) || tile === 'tree' || tile === 'core') {
    return false;
  }
  if (blockedMask[gy * GRID_COLS + gx] !== 0) return false;
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

  const startIdx = start.gy * GRID_COLS + start.gx;

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(start.gx, start.gy);

  const heap: number[] = [startIdx];
  const push = (node: number): void => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fScore[heap[i]] >= fScore[heap[p]]) break;
      const tmp = heap[i];
      heap[i] = heap[p];
      heap[p] = tmp;
      i = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      const n = heap.length;
      while (true) {
        const l = (i << 1) + 1;
        if (l >= n) break;
        const r = l + 1;
        const best = r < n && fScore[heap[r]] < fScore[heap[l]] ? r : l;
        if (fScore[heap[best]] >= fScore[heap[i]]) break;
        const tmp = heap[i];
        heap[i] = heap[best];
        heap[best] = tmp;
        i = best;
      }
    }
    return top;
  };

  while (heap.length > 0) {
    const current = pop();

    if (closed[current]) continue;
    closed[current] = 1;

    const cx = current % GRID_COLS;
    const cy = (current / GRID_COLS) | 0;

    if (isGoal(cx, cy)) {
      const path: GridPoint[] = [];
      let cur = current;
      while (cur !== -1) {
        path.push({ gx: cur % GRID_COLS, gy: (cur / GRID_COLS) | 0 });
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

      const nIdx = ny * GRID_COLS + nx;
      if (closed[nIdx]) continue;

      const nextG = gScore[current] + d.cost;
      if (nextG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = nextG;
        const dx1 = nx - refPoint.gx;
        const dy1 = ny - refPoint.gy;
        const cross = Math.abs(dx1 * dyStart - dxStart * dy1);
        fScore[nIdx] = nextG + heuristic(nx, ny) + cross * 0.0001;
        push(nIdx);
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
  flyBlocked?: Set<string>,
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

  const blockedMask =
    movementType === 'ground'
      ? toBlockedMask(blockedWalls)
      : movementType === 'fly' && flyBlocked && flyBlocked.size > 0
        ? toBlockedMask(flyBlocked)
        : new Uint8Array(0);

  return runAStar(
    start,
    (gx, gy) => isPassable(gx, gy, tiles, blockedMask, movementType),
    isCoreCell,
    minCoreDist,
    refCore,
  );
}

/**
 * 8-directional A* from `start` to a specific `target` tile for an enemy aggroing a unit.
 * Allows stepping onto `target` even if occupied by a flying unit.
 */
export function findEnemyPathToTarget(
  start: GridPoint,
  target: GridPoint,
  tiles: TileKind[][],
  blockedWalls: Set<string>,
  movementType: MovementType,
  flyBlocked?: Set<string>,
): GridPoint[] | null {
  const blockedMask =
    movementType === 'ground'
      ? toBlockedMask(blockedWalls)
      : movementType === 'fly' && flyBlocked && flyBlocked.size > 0
        ? toBlockedMask(flyBlocked)
        : new Uint8Array(0);

  return runAStar(
    start,
    (gx, gy) =>
      (gx === target.gx && gy === target.gy) ||
      isPassable(gx, gy, tiles, blockedMask, movementType),
    (gx, gy) => gx === target.gx && gy === target.gy,
    (gx, gy) => Math.hypot(gx - target.gx, gy - target.gy),
    target,
  );
}

/**
 * 8-directional A* for a player Pokémon walking from `start` to `target`.
 * Avoids trees, core tiles, active structures, and (unless `allowWater`) water; allies can be walked through.
 */
export function findUnitPath(
  start: GridPoint,
  target: GridPoint,
  tiles: TileKind[][],
  blockedStructures: Set<string>,
  allowWater = false,
): GridPoint[] | null {
  const blockedMask = toBlockedMask(blockedStructures);
  if (!isUnitPassable(target.gx, target.gy, tiles, blockedMask, allowWater)) {
    return null;
  }
  return runAStar(
    start,
    (gx, gy) => isUnitPassable(gx, gy, tiles, blockedMask, allowWater),
    (gx, gy) => gx === target.gx && gy === target.gy,
    (gx, gy) => Math.hypot(gx - target.gx, gy - target.gy),
    target,
  );
}

function bfs4(
  seeds: readonly GridPoint[],
  tiles: TileKind[][],
  onVisit?: (idx: number, dist: number) => 'enqueue' | 'skip' | 'stop',
): Int32Array {
  const dist = new Int32Array(GRID_COLS * GRID_ROWS).fill(-1);
  const queue: number[] = [];
  for (const s of seeds) {
    const sIdx = s.gy * GRID_COLS + s.gx;
    if (dist[sIdx] === -1) {
      dist[sIdx] = 0;
      queue.push(sIdx);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % GRID_COLS;
    const cy = (cur / GRID_COLS) | 0;
    const nextDist = dist[cur] + 1;
    for (const d of DIRS) {
      const nx = cx + d.gx;
      const ny = cy + d.gy;
      if (
        !inBounds(nx, ny) ||
        tiles[ny][nx] === 'water' ||
        tiles[ny][nx] === 'tree'
      ) {
        continue;
      }
      const nIdx = ny * GRID_COLS + nx;
      if (dist[nIdx] !== -1) continue;
      dist[nIdx] = nextDist;
      const action = onVisit ? onVisit(nIdx, nextDist) : 'enqueue';
      if (action === 'stop') return dist;
      if (action === 'enqueue') queue.push(nIdx);
    }
  }
  return dist;
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

  const wallMap = new Map<number, GridStructure>();
  for (const s of structures) {
    if (!s.ruined && s.hp > 0 && STRUCTURE_SPECS[s.kind].blocksGround) {
      wallMap.set(s.gy * GRID_COLS + s.gx, s);
    }
  }
  if (wallMap.size === 0) return null;

  const startWall = wallMap.get(start.gy * GRID_COLS + start.gx);
  if (startWall) return startWall;

  // 1. BFS from CORE_CELLS ignoring walls (respecting water/trees) to get distance-to-core per tile.
  const INF = 1_000_000;
  const distToCore = bfs4(CORE_CELLS, tiles);

  // 2. BFS from `start` through open tiles to track the best directly reachable blocking wall.
  let bestWall: GridStructure | null = null;
  let bestTotal = Infinity;
  let bestDist = Infinity;

  bfs4([start], tiles, (nIdx, nextDist) => {
    const wall = wallMap.get(nIdx);
    if (wall) {
      const dCore = distToCore[nIdx] === -1 ? INF : distToCore[nIdx];
      const total = nextDist + dCore;
      if (total < bestTotal || (total === bestTotal && nextDist < bestDist)) {
        bestTotal = total;
        bestDist = nextDist;
        bestWall = wall;
      }
      return 'skip';
    }
    return 'enqueue';
  });

  if (bestWall) return bestWall;

  // 3. Fallback if no candidate found via open BFS: pick nearest standing wall along a wall-ignoring BFS from start.
  let fallbackWall: GridStructure | null = null;
  bfs4([start], tiles, (nIdx) => {
    const wall = wallMap.get(nIdx);
    if (wall) {
      fallbackWall = wall;
      return 'stop';
    }
    return 'enqueue';
  });

  return fallbackWall;
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

function buildPortalCandidates(
  wave: number,
  tiles: TileKind[][],
  structures: readonly GridStructure[],
): (side: PortalSide) => GridPoint[][] {
  const occupied = new Uint8Array(GRID_COLS * GRID_ROWS);
  for (const s of structures) {
    if (!s.ruined && inBounds(s.gx, s.gy)) {
      occupied[s.gy * GRID_COLS + s.gx] = 1;
    }
  }
  const isOpenBorder = (gx: number, gy: number) => {
    if (!inBounds(gx, gy)) return false;
    const t = tiles[gy][gx];
    return (
      t !== 'tree' &&
      t !== 'water' &&
      t !== 'core' &&
      occupied[gy * GRID_COLS + gx] === 0
    );
  };

  return (side: PortalSide): GridPoint[][] => {
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
}

function shuffledSides(rng: () => number): PortalSide[] {
  const sides: PortalSide[] = ['west', 'east', 'north', 'south'];
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }
  return sides;
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
  const candidatesForSide = buildPortalCandidates(wave, tiles, structures);
  const targetCount = wave >= 3 ? 3 : 2;
  const portals: SpawnPortal[] = [];
  for (const side of shuffledSides(rng)) {
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
 * Rolling 1-portal rotation: keeps portals fixed on even waves, expands to 3
 * portals on Wave 3 without moving existing ones, and on odd waves >= 5 drops
 * the oldest portal (`currentPortals[0]`) and opens 1 new portal.
 */
export function rotateWavePortals(
  wave: number,
  currentPortals: readonly SpawnPortal[],
  tiles: TileKind[][],
  structures: readonly GridStructure[],
  rng: () => number = Math.random,
): SpawnPortal[] {
  if (wave <= 1 || currentPortals.length === 0) {
    return rollWavePortals(wave, tiles, structures, rng);
  }
  if (wave % 2 === 0) {
    return [...currentPortals];
  }

  const targetCount = wave >= 3 ? 3 : 2;
  const kept =
    currentPortals.length < targetCount
      ? [...currentPortals]
      : currentPortals.slice(1);
  const usedSides = new Set(kept.map((p) => p.side));
  const candidatesForSide = buildPortalCandidates(wave, tiles, structures);
  const sides = shuffledSides(rng);
  const orderedSides = [
    ...sides.filter((s) => !usedSides.has(s)),
    ...sides.filter((s) => usedSides.has(s)),
  ];

  for (const side of orderedSides) {
    const groups = candidatesForSide(side).filter(
      (cells) =>
        !kept.some((p) =>
          p.cells.some((pc) =>
            cells.some((c) => c.gx === pc.gx && c.gy === pc.gy),
          ),
        ),
    );
    if (groups.length === 0) continue;
    const cells = groups[Math.floor(rng() * groups.length)];
    return [...kept, { id: `portal_${wave}_${side}`, side, cells }];
  }

  return [...currentPortals];
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
  allowWater = false,
): boolean {
  if (!inBounds(gx, gy) || isBorderTile(gx, gy)) return true;
  const tile = tiles[gy][gx];
  if (
    tile === 'core' ||
    tile === 'spawn' ||
    (tile === 'water' && !allowWater) ||
    tile === 'tree'
  ) {
    return true;
  }
  if (portals) {
    return isPortalBufferTile(gx, gy, portals);
  }
  return false;
}
