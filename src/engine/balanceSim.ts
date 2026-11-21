import { getEvolutionTargets } from '../data/evolutions';
import { ARTIFACT_CATALOG, HELD_ITEM_CATALOG } from '../data/items';
import { MAP_BY_ID, createGridForMap } from '../data/maps';
import {
  ENEMY_SPECIES,
  INITIAL_ACTIVE_IDS,
  POKEMON_SPECIES,
} from '../data/pokemon';
import { RUN_DIFFICULTY_BY_ID, getWavesForRun } from '../data/waves';
import {
  GRID_COLS,
  GRID_ROWS,
  type GridStructure,
  type PokemonRarity,
  type RunDifficulty,
  type TileKind,
} from '../types';
import {
  computeBasicAttackDamage,
  computeEnemyAttackDamage,
  computeKillBounty,
  computeStartingUlt,
  computeUltPower,
  computeUnitAtk,
  computeUnitAttackIntervalMs,
  computeUnitDef,
  computeUnitMaxHp,
  computeUnitRange,
  selectEnemyTarget,
  selectUnitTarget,
} from './combat';
import { getSpeciesKit } from './kits';
import {
  CORE_CELLS,
  type GridPoint,
  type SpawnPortal,
  findEnemyPathToTarget,
  findNearestBlockingWall,
  findPath,
  findWallbreakerPath,
  isNoBuildTile,
  rollWavePortals,
  rotateWavePortals,
} from './pathfinding';
import {
  canDraftSpecies,
  canUnitEnterWater,
  generateRewardChoices,
  getBountyWaveMult,
  getEffectiveStructureMaxHp,
  getHealCost,
  getReviveCost,
  getStructureBuildCost,
  isInCircularRange,
} from './rules';
import { getSpeciesAttackType, getSpeciesTypes } from './typeChart';

/** Deterministic Mulberry32 PRNG in [0, 1). */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SpeciesEfficiencyMetric {
  id: string;
  name: string;
  rarity: PokemonRarity;
  draftCost: number;
  maxHp: number;
  atk: number;
  def: number;
  range: number;
  attackIntervalMs: number;
  dps: number;
  ehp: number;
  dpsPerCost: number;
  ehpPerCost: number;
}

/** Computes baseline DPS, EHP, and cost-efficiency for every playable species. */
export function computeSpeciesEfficiency(): SpeciesEfficiencyMetric[] {
  return Object.values(POKEMON_SPECIES).map((spec) => {
    const maxHp = computeUnitMaxHp(spec.id, []);
    const atk = computeUnitAtk(spec.id, []);
    const def = computeUnitDef(spec.id);
    const range = computeUnitRange(spec.id);
    const attackIntervalMs = computeUnitAttackIntervalMs(spec.id, []);
    const dps = (atk * 1000) / Math.max(1, attackIntervalMs);
    const ehp = maxHp * (1 + def * 0.04);
    const cost = Math.max(1, spec.draftCost);
    return {
      id: spec.id,
      name: spec.name,
      rarity: spec.rarity ?? 'Common',
      draftCost: spec.draftCost,
      maxHp,
      atk,
      def,
      range,
      attackIntervalMs,
      dps,
      ehp,
      dpsPerCost: dps / cost,
      ehpPerCost: ehp / cost,
    };
  });
}

export interface WaveCurveMetric {
  wave: number;
  isBoss: boolean;
  enemyCount: number;
  totalEnemyHp: number;
  totalEnemyDps: number;
  totalBounty: number;
}

/** Computes scaled enemy EHP/DPS/bounty totals per wave for a map and difficulty. */
export function computeWaveCurveMetrics(
  mapId: string,
  difficulty: RunDifficulty,
): WaveCurveMetric[] {
  const diff = RUN_DIFFICULTY_BY_ID[difficulty];
  const waves = getWavesForRun(mapId, difficulty);
  return waves.map((w) => {
    let enemyCount = 0;
    let totalEnemyHp = 0;
    let totalEnemyDps = 0;
    let totalBounty = 0;
    let isBoss = false;
    const waveBountyMult = getBountyWaveMult(w.wave);

    for (const g of w.spawns) {
      const spec = ENEMY_SPECIES[g.speciesId];
      if (!spec) continue;
      if (g.isBoss) isBoss = true;
      const hp = Math.round(
        spec.maxHp * diff.enemyHpMult * (g.isBoss ? 3.5 : 1),
      );
      const atk = Math.round(
        spec.atk * diff.enemyAtkMult * (g.isBoss ? 1.6 : 1),
      );
      const intervalMs = spec.attackIntervalMs ?? 1000;
      const bounty = Math.round(
        computeKillBounty(spec.bounty, false) *
          waveBountyMult *
          diff.bountyMult *
          (g.isBoss ? 3 : 1),
      );
      enemyCount += g.count;
      totalEnemyHp += hp * g.count;
      totalEnemyDps += ((atk * 1000) / Math.max(1, intervalMs)) * g.count;
      totalBounty += bounty * g.count;
    }

    return {
      wave: w.wave,
      isBoss,
      enemyCount,
      totalEnemyHp,
      totalEnemyDps,
      totalBounty,
    };
  });
}

export type BotStrategy = 'balanced' | 'greedy' | 'random';

export interface BalanceSimOptions {
  mapId?: string;
  difficulty?: RunDifficulty;
  strategy?: BotStrategy;
  seed?: number;
  maxWavesToSim?: number;
  draftIds?: readonly string[];
  heldItemsBySlot?: readonly (readonly string[])[];
  startingArtifacts?: readonly string[];
}

export interface BalanceSimResult {
  mapId: string;
  difficulty: RunDifficulty;
  strategy: BotStrategy;
  seed: number;
  victory: boolean;
  waveReached: number;
  maxWaves: number;
  coreHp: number;
  coreMaxHp: number;
  goldRemaining: number;
  totalGoldEarned: number;
  totalKills: number;
  totalCoreDamageTaken: number;
  damageBySpecies: Record<string, number>;
}

interface SimUnit {
  uid: string;
  speciesId: string;
  gx: number;
  gy: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  range: number;
  attackIntervalMs: number;
  attackCooldownMs: number;
  ultCharge: number;
  ultMax: number;
  hitCount: number;
  stationaryMs: number;
  heldItems: string[];
}

interface SimWall extends GridStructure {
  key: string;
}

interface SimEnemy {
  uid: string;
  speciesId: string;
  gx: number;
  gy: number;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  range: number;
  attackIntervalMs: number;
  attackCooldownMs: number;
  bounty: number;
  isBoss: boolean;
  ignoresUnits: boolean;
  movementType: 'ground' | 'burrow' | 'fly';
  path: GridPoint[];
  pathIdx: number;
  repathTimerMs: number;
  slowTimerMs: number;
  stunTimerMs: number;
}

interface PendingSpawn {
  spawnAtMs: number;
  speciesId: string;
  isBoss: boolean;
  spawnCell: GridPoint;
}

const SIM_DT_MS = 100;
const MAX_WAVE_DURATION_MS = 180_000;

function pickDraftIds(strategy: BotStrategy, rng: () => number): string[] {
  const pool = Object.values(POKEMON_SPECIES).filter((s) => s.draftCost <= 6);
  const picked: string[] =
    strategy === 'balanced' ? [...INITIAL_ACTIVE_IDS] : [];
  const budget = 14;
  const maxUnits = 6;
  const sorted =
    strategy === 'random'
      ? [...pool].sort(() => rng() - 0.5)
      : strategy === 'balanced'
        ? [...pool].sort((a, b) => {
            const aRanged = a.range >= 2.5 ? 1 : 0;
            const bRanged = b.range >= 2.5 ? 1 : 0;
            if (aRanged !== bRanged) return bRanged - aRanged;
            return b.range - a.range || a.draftCost - b.draftCost;
          })
        : [...pool].sort((a, b) => a.draftCost - b.draftCost);

  for (const s of sorted) {
    if (canDraftSpecies(picked, s.id, budget, maxUnits)) {
      picked.push(s.id);
    }
    if (picked.length >= maxUnits) break;
  }
  return picked.length > 0 ? picked : [...INITIAL_ACTIVE_IDS];
}

function getUnitTargetPriority(
  speciesId: string,
): 'first' | 'strong' | 'advantageous' {
  const spec = POKEMON_SPECIES[speciesId];
  if (!spec) return 'first';
  if (
    spec.subclass === 'Sniper' ||
    spec.subclass === 'Artillery' ||
    spec.range >= 4
  ) {
    return 'strong';
  }
  if (spec.subclass === 'Elemental AoE' || spec.subclass === 'Chain') {
    return 'advantageous';
  }
  return 'first';
}

function findPlacementSpots(
  grid: TileKind[][],
  speciesIds: readonly string[],
  rng: () => number,
  strategy: BotStrategy,
  portals: readonly SpawnPortal[] = [],
): GridPoint[] {
  const coreCenterX =
    CORE_CELLS.reduce((s, c) => s + c.gx, 0) / CORE_CELLS.length;
  const coreCenterY =
    CORE_CELLS.reduce((s, c) => s + c.gy, 0) / CORE_CELLS.length;

  const pathCells: GridPoint[] = [];
  const emptyWalls = new Set<string>();
  for (const portal of portals) {
    const cell = portal.cells[0];
    if (!cell) continue;
    const p = findPath(cell, grid, emptyWalls, 'ground');
    if (p) pathCells.push(...p);
  }

  const candidates: GridPoint[] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const tile = grid[y][x];
      if (tile === 'core' || tile === 'tree' || tile === 'spawn') continue;
      if (isNoBuildTile(x, y, grid)) continue;
      candidates.push({ gx: x, gy: y });
    }
  }

  candidates.sort((a, b) => {
    const da = Math.hypot(a.gx - coreCenterX, a.gy - coreCenterY);
    const db = Math.hypot(b.gx - coreCenterX, b.gy - coreCenterY);
    return da - db;
  });

  const used = new Set<string>();
  const spots: GridPoint[] = [];

  for (const speciesId of speciesIds) {
    const spec = POKEMON_SPECIES[speciesId];
    const unitRange = spec?.range ?? 2;
    const isMelee = spec?.isMelee || unitRange <= 1.5;
    const waterOk = canUnitEnterWater(speciesId);
    const valid = candidates.filter((p) => {
      if (used.has(`${p.gx},${p.gy}`)) return false;
      const tile = grid[p.gy][p.gx];
      if (tile === 'water' && !waterOk) return false;
      return true;
    });
    if (valid.length === 0) {
      spots.push({ gx: CORE_CELLS[0].gx - 2, gy: CORE_CELLS[0].gy });
      continue;
    }

    let chosen: GridPoint;
    if (strategy === 'random' || pathCells.length === 0) {
      const pickIdx =
        strategy === 'random'
          ? Math.floor(rng() * Math.min(valid.length, 40))
          : 0;
      chosen = valid[pickIdx];
    } else {
      let bestScore = -Infinity;
      chosen = valid[0];
      for (const tile of valid) {
        let coverage = 0;
        let minPathDist = Infinity;
        for (const pc of pathCells) {
          const d = Math.hypot(tile.gx - pc.gx, tile.gy - pc.gy);
          if (d < minPathDist) minPathDist = d;
          if (isInCircularRange(tile.gx, tile.gy, pc.gx, pc.gy, unitRange)) {
            coverage++;
          }
        }
        const roleBonus = isMelee
          ? minPathDist <= 1.5
            ? 20
            : -minPathDist * 3
          : minPathDist >= 1.4 && minPathDist <= unitRange
            ? 15
            : minPathDist < 1.4
              ? -10
              : -minPathDist * 2;
        const score = coverage + roleBonus;
        if (score > bestScore) {
          bestScore = score;
          chosen = tile;
        }
      }
    }

    used.add(`${chosen.gx},${chosen.gy}`);
    spots.push(chosen);
  }
  return spots;
}

function refreshUnitStats(
  u: SimUnit,
  ownedUpgrades: readonly string[],
  ownedArtifacts: readonly string[],
): void {
  const prevMaxHp = u.maxHp;
  const spec = POKEMON_SPECIES[u.speciesId];
  u.maxHp = computeUnitMaxHp(
    u.speciesId,
    [...ownedUpgrades],
    null,
    u.heldItems,
    0,
    undefined,
    [...ownedArtifacts],
  );
  u.hp = Math.min(u.maxHp, u.hp + Math.max(0, u.maxHp - prevMaxHp));
  u.atk = computeUnitAtk(
    u.speciesId,
    [...ownedUpgrades],
    false,
    null,
    u.heldItems,
    0,
    [...ownedArtifacts],
  );
  u.def = computeUnitDef(
    u.speciesId,
    null,
    u.heldItems,
    [...ownedUpgrades],
    0,
    undefined,
    [...ownedArtifacts],
  );
  u.range = computeUnitRange(
    u.speciesId,
    null,
    [...ownedUpgrades],
    0,
    undefined,
    u.heldItems,
  );
  u.attackIntervalMs = computeUnitAttackIntervalMs(
    u.speciesId,
    [...ownedArtifacts],
    null,
    u.heldItems,
    [...ownedUpgrades],
  );
  u.ultMax = spec?.ultMax ?? 100;
}

function createSimUnit(
  uid: string,
  speciesId: string,
  gx: number,
  gy: number,
  ownedUpgrades: readonly string[],
  ownedArtifacts: readonly string[],
  heldItems: readonly string[] = [],
): SimUnit {
  const spec = POKEMON_SPECIES[speciesId];
  const ultMax = spec?.ultMax ?? 100;
  const items = [...heldItems];
  const maxHp = computeUnitMaxHp(
    speciesId,
    [...ownedUpgrades],
    null,
    items,
    0,
    undefined,
    [...ownedArtifacts],
  );
  return {
    uid,
    speciesId,
    gx,
    gy,
    hp: maxHp,
    maxHp,
    atk: computeUnitAtk(speciesId, [...ownedUpgrades], false, null, items, 0, [
      ...ownedArtifacts,
    ]),
    def: computeUnitDef(
      speciesId,
      null,
      items,
      [...ownedUpgrades],
      0,
      undefined,
      [...ownedArtifacts],
    ),
    range: computeUnitRange(
      speciesId,
      null,
      [...ownedUpgrades],
      0,
      undefined,
      items,
    ),
    attackIntervalMs: computeUnitAttackIntervalMs(
      speciesId,
      [...ownedArtifacts],
      null,
      items,
      [...ownedUpgrades],
    ),
    attackCooldownMs: 0,
    ultCharge: computeStartingUlt(ultMax),
    ultMax,
    hitCount: 0,
    stationaryMs: 0,
    heldItems: items,
  };
}

/**
 * Runs a deterministic headless match simulation using `src/engine/` combat,
 * targeting, pathfinding, and economy rules.
 *
 * shortcut: v1 headless sim omits active support structures and held-item triggers; add if testing item/structure balance
 */
export function simulateRun(options: BalanceSimOptions = {}): BalanceSimResult {
  const mapId = options.mapId ?? 'viridian_outpost';
  if (!MAP_BY_ID[mapId]) {
    throw new Error(`Unknown mapId: ${mapId}`);
  }
  const difficulty: RunDifficulty = options.difficulty ?? 'normal';
  const strategy: BotStrategy = options.strategy ?? 'balanced';
  const seed = options.seed ?? 1337;
  const rng = seededRng(seed);

  const diff = RUN_DIFFICULTY_BY_ID[difficulty];
  const grid = createGridForMap(mapId);
  const allWaves = getWavesForRun(mapId, difficulty);
  const maxWaves = Math.min(
    allWaves.length,
    options.maxWavesToSim ?? allWaves.length,
  );

  let portals: SpawnPortal[] = rollWavePortals(1, grid, [], rng);
  const draftIds = options.draftIds
    ? [...options.draftIds]
    : pickDraftIds(strategy, rng);
  const spots = findPlacementSpots(grid, draftIds, rng, strategy, portals);

  const ownedUpgrades: string[] = [];
  const ownedArtifacts: string[] = [...(options.startingArtifacts ?? [])];
  const units: SimUnit[] = draftIds.map((speciesId, idx) =>
    createSimUnit(
      `u_${idx}_${speciesId}`,
      speciesId,
      spots[idx].gx,
      spots[idx].gy,
      ownedUpgrades,
      ownedArtifacts,
      options.heldItemsBySlot?.[idx] ?? [],
    ),
  );

  let coreHp = diff.coreMaxHp;
  let gold = diff.startingGold;
  let totalGoldEarned = diff.startingGold;
  let totalKills = 0;
  let totalCoreDamageTaken = 0;
  let waveReached = 0;
  const damageBySpecies: Record<string, number> = {};
  const walls = new Map<string, SimWall>();
  const wallKeys = new Set<string>();
  let nextUnitIdx = units.length;

  // Candidate wall ring ~3 tiles from Core for balanced/greedy bots
  const wallCandidates: GridPoint[] = [];
  if (strategy !== 'random') {
    const cx = CORE_CELLS.reduce((s, c) => s + c.gx, 0) / CORE_CELLS.length;
    const cy = CORE_CELLS.reduce((s, c) => s + c.gy, 0) / CORE_CELLS.length;
    for (let y = 2; y < GRID_ROWS - 2; y++) {
      for (let x = 2; x < GRID_COLS - 2; x++) {
        const t = grid[y][x];
        if (t === 'core' || t === 'tree' || t === 'spawn' || t === 'water')
          continue;
        if (isNoBuildTile(x, y, grid)) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d >= 2.5 && d <= 4.5) wallCandidates.push({ gx: x, gy: y });
      }
    }
    wallCandidates.sort(
      (a, b) =>
        Math.hypot(a.gx - cx, a.gy - cy) - Math.hypot(b.gx - cx, b.gy - cy),
    );
  }

  for (let wIdx = 0; wIdx < maxWaves; wIdx++) {
    const waveDef = allWaves[wIdx];
    waveReached = waveDef.wave;

    // Spend surplus gold on defensive walls before wave (keep 30g reserve)
    if (strategy !== 'random' && walls.size < 8) {
      const kind: 'wood_wall' | 'stone_wall' =
        gold >= 80 ? 'stone_wall' : 'wood_wall';
      const cost = getStructureBuildCost(kind, walls.size);
      for (const spot of wallCandidates) {
        if (walls.size >= 8 || gold < cost + 20) break;
        const key = `${spot.gx},${spot.gy}`;
        if (walls.has(key)) continue;
        if (units.some((u) => u.gx === spot.gx && u.gy === spot.gy)) continue;
        gold -= cost;
        const maxHp = getEffectiveStructureMaxHp(kind, ownedArtifacts);
        walls.set(key, {
          uid: `w_${key}`,
          key,
          gx: spot.gx,
          gy: spot.gy,
          kind,
          hp: maxHp,
          maxHp,
          ruined: false,
        });
        wallKeys.add(key);
      }
    }

    if (waveDef.wave > 1) {
      portals = rotateWavePortals(waveDef.wave, portals, grid, [], rng);
    }

    const portalCells = portals.flatMap((p) => p.cells);
    const spawnQueue: PendingSpawn[] = [];
    let cursorMs = 0;
    let spawnCellCursor = 0;
    for (const group of waveDef.spawns) {
      for (let i = 0; i < group.count; i++) {
        const spawnCell = portalCells[spawnCellCursor % portalCells.length];
        spawnCellCursor++;
        spawnQueue.push({
          spawnAtMs: cursorMs,
          speciesId: group.speciesId,
          isBoss: Boolean(group.isBoss),
          spawnCell,
        });
        cursorMs += group.intervalMs;
      }
    }
    spawnQueue.sort((a, b) => a.spawnAtMs - b.spawnAtMs);

    const enemies: SimEnemy[] = [];
    let spawnIdx = 0;
    let elapsedMs = 0;
    let enemyUidCounter = 0;
    const waveBountyMult = getBountyWaveMult(waveDef.wave);

    while (
      coreHp > 0 &&
      elapsedMs < MAX_WAVE_DURATION_MS &&
      (spawnIdx < spawnQueue.length || enemies.length > 0)
    ) {
      while (
        spawnIdx < spawnQueue.length &&
        spawnQueue[spawnIdx].spawnAtMs <= elapsedMs
      ) {
        const next = spawnQueue[spawnIdx++];
        const spec = ENEMY_SPECIES[next.speciesId];
        if (!spec) continue;
        const maxHp = Math.round(
          spec.maxHp * diff.enemyHpMult * (next.isBoss ? 3.5 : 1),
        );
        const atk = Math.round(
          spec.atk * diff.enemyAtkMult * (next.isBoss ? 1.6 : 1),
        );
        const bounty = Math.round(
          computeKillBounty(spec.bounty, false) *
            waveBountyMult *
            diff.bountyMult *
            (next.isBoss ? 3 : 1),
        );
        const path = findPath(
          next.spawnCell,
          grid,
          wallKeys,
          spec.movementType,
        ) ??
          findWallbreakerPath(next.spawnCell, grid, [...walls.values()])
            ?.path ?? [next.spawnCell, CORE_CELLS[0]];
        enemies.push({
          uid: `e_${waveDef.wave}_${enemyUidCounter++}`,
          speciesId: spec.id,
          gx: next.spawnCell.gx,
          gy: next.spawnCell.gy,
          hp: maxHp,
          maxHp,
          atk,
          speed: spec.speed * diff.enemySpeedMult,
          range: spec.range ?? 1,
          attackIntervalMs: spec.attackIntervalMs ?? 1000,
          attackCooldownMs: 0,
          bounty,
          isBoss: next.isBoss,
          ignoresUnits: Boolean(spec.ignoresUnits),
          movementType: spec.movementType,
          path,
          pathIdx: 0,
          repathTimerMs: 400,
          slowTimerMs: 0,
          stunTimerMs: 0,
        });
      }

      // Step enemies
      const livingUnits = units.filter((u) => u.hp > 0);
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        e.attackCooldownMs = Math.max(0, e.attackCooldownMs - SIM_DT_MS);
        e.slowTimerMs = Math.max(0, e.slowTimerMs - SIM_DT_MS);
        e.stunTimerMs = Math.max(0, e.stunTimerMs - SIM_DT_MS);
        e.repathTimerMs -= SIM_DT_MS;
        if (e.stunTimerMs > 0) continue;

        const targetDecision = selectEnemyTarget({
          gx: Math.round(e.gx),
          gy: Math.round(e.gy),
          range: e.range,
          ignoresUnits: e.ignoresUnits,
          movementType: e.movementType,
          units: livingUnits.map((u) => ({
            uid: u.uid,
            gx: u.gx,
            gy: u.gy,
            hp: u.hp,
          })),
          coreCells: CORE_CELLS,
        });

        if (targetDecision.attackUnitUid) {
          const targetUnit = livingUnits.find(
            (u) => u.uid === targetDecision.attackUnitUid,
          );
          if (targetUnit && e.attackCooldownMs <= 0) {
            e.attackCooldownMs = e.attackIntervalMs;
            const res = computeEnemyAttackDamage({
              enemyAtk: e.atk,
              unitDef: targetUnit.def,
              unitSpeciesId: targetUnit.speciesId,
              unitStationaryMs: targetUnit.stationaryMs,
              unitHeldItems: targetUnit.heldItems,
              unitAdjacentToStructure: false,
              isMelee: e.range <= 1,
              attackType: getSpeciesAttackType(e.speciesId),
              defenderTypes: getSpeciesTypes(targetUnit.speciesId),
            });
            targetUnit.hp = Math.max(0, targetUnit.hp - res.damage);
            if (res.reflectedThorns > 0) {
              e.hp = Math.max(0, e.hp - res.reflectedThorns);
            }
          }
          continue;
        }

        if (targetDecision.attackCoreCell) {
          if (e.attackCooldownMs <= 0) {
            e.attackCooldownMs = e.attackIntervalMs;
            coreHp = Math.max(0, coreHp - e.atk);
            totalCoreDamageTaken += e.atk;
          }
          continue;
        }

        if (targetDecision.aggroUnitUid && e.repathTimerMs <= 0) {
          const aggroUnit = livingUnits.find(
            (u) => u.uid === targetDecision.aggroUnitUid,
          );
          if (aggroUnit) {
            const aggroPath = findEnemyPathToTarget(
              { gx: Math.round(e.gx), gy: Math.round(e.gy) },
              { gx: aggroUnit.gx, gy: aggroUnit.gy },
              grid,
              wallKeys,
              e.movementType,
            );
            if (aggroPath && aggroPath.length > 0) {
              e.path = aggroPath;
              e.pathIdx = 0;
            }
            e.repathTimerMs = 400;
          }
        }

        // Ground enemies attack adjacent blocking wall if their next step is walled
        if (e.movementType === 'ground' && e.pathIdx < e.path.length) {
          const wp = e.path[e.pathIdx];
          const wpKey = `${wp.gx},${wp.gy}`;
          const wall =
            walls.get(wpKey) ??
            (() => {
              const adj = findNearestBlockingWall(
                { gx: Math.round(e.gx), gy: Math.round(e.gy) },
                grid,
                [...walls.values()],
              );
              return adj ? walls.get(`${adj.gx},${adj.gy}`) : undefined;
            })();
          if (
            wall &&
            Math.abs(wall.gx - Math.round(e.gx)) +
              Math.abs(wall.gy - Math.round(e.gy)) <=
              1
          ) {
            if (e.attackCooldownMs <= 0) {
              e.attackCooldownMs = e.attackIntervalMs;
              wall.hp = Math.max(0, wall.hp - e.atk);
              if (wall.hp <= 0) {
                walls.delete(wall.key);
                wallKeys.delete(wall.key);
              }
            }
            continue;
          }
        }

        const stepTiles =
          (e.speed * (e.slowTimerMs > 0 ? 0.6 : 1) * SIM_DT_MS) / 1000;
        let remaining = stepTiles;
        while (remaining > 0 && e.pathIdx < e.path.length) {
          const wp = e.path[e.pathIdx];
          const dx = wp.gx - e.gx;
          const dy = wp.gy - e.gy;
          const dist = Math.hypot(dx, dy);
          if (dist <= remaining) {
            e.gx = wp.gx;
            e.gy = wp.gy;
            e.pathIdx++;
            remaining -= dist;
          } else {
            e.gx += (dx / dist) * remaining;
            e.gy += (dy / dist) * remaining;
            remaining = 0;
          }
        }
      }

      // Step units
      for (const u of units) {
        if (u.hp <= 0) continue;
        u.stationaryMs += SIM_DT_MS;
        u.attackCooldownMs = Math.max(0, u.attackCooldownMs - SIM_DT_MS);
        if (u.attackCooldownMs > 0) continue;

        const candidates = enemies
          .filter(
            (e) =>
              e.hp > 0 && isInCircularRange(u.gx, u.gy, e.gx, e.gy, u.range),
          )
          .map((e) => ({
            uid: e.uid,
            gx: e.gx,
            gy: e.gy,
            hp: e.hp,
            speciesId: e.speciesId,
            coreProgressDist: e.path.length - e.pathIdx,
          }));

        if (candidates.length === 0) continue;

        const atkType = getSpeciesAttackType(u.speciesId);
        const target = selectUnitTarget({
          unitGx: u.gx,
          unitGy: u.gy,
          attackType: atkType,
          priority: getUnitTargetPriority(u.speciesId),
          candidates,
        });
        if (!target) continue;

        const enemy = enemies.find((e) => e.uid === target.uid);
        if (!enemy) continue;

        u.attackCooldownMs = u.attackIntervalMs;
        u.hitCount++;
        const kit = getSpeciesKit(u.speciesId);

        // Cast Ultimate when charged
        if (u.ultCharge >= u.ultMax) {
          u.ultCharge = 0;
          const isHeal = kit.ultMode === 'heal_aoe';
          const ultPower = computeUltPower(
            u.atk,
            2.2,
            isHeal,
            0,
            POKEMON_SPECIES[u.speciesId]?.subclass,
            kit.ultPowerMult,
          );
          const ultRadius = kit.ultRadius ?? 2.5;
          if (isHeal) {
            for (const ally of units) {
              if (
                ally.hp > 0 &&
                isInCircularRange(u.gx, u.gy, ally.gx, ally.gy, ultRadius)
              ) {
                ally.hp = Math.min(ally.maxHp, ally.hp + ultPower);
              }
            }
          } else if (kit.ultMode === 'sniper') {
            enemy.hp = Math.max(0, enemy.hp - ultPower);
            damageBySpecies[u.speciesId] =
              (damageBySpecies[u.speciesId] ?? 0) + ultPower;
            if (kit.ultStunMs) {
              enemy.stunTimerMs = Math.max(enemy.stunTimerMs, kit.ultStunMs);
            }
          } else {
            for (const other of enemies) {
              if (
                other.hp > 0 &&
                isInCircularRange(
                  enemy.gx,
                  enemy.gy,
                  other.gx,
                  other.gy,
                  ultRadius,
                )
              ) {
                other.hp = Math.max(0, other.hp - ultPower);
                damageBySpecies[u.speciesId] =
                  (damageBySpecies[u.speciesId] ?? 0) + ultPower;
                if (kit.ultStunMs) {
                  other.stunTimerMs = Math.max(
                    other.stunTimerMs,
                    kit.ultStunMs,
                  );
                }
                if (kit.ultSlowMs) {
                  other.slowTimerMs = Math.max(
                    other.slowTimerMs,
                    kit.ultSlowMs,
                  );
                }
              }
            }
          }
          continue;
        }

        const dmgRes = computeBasicAttackDamage({
          baseAtk: u.atk,
          speciesId: u.speciesId,
          hitCount: u.hitCount,
          heldItems: u.heldItems,
          targetHp: enemy.hp,
          targetMaxHp: enemy.maxHp,
          targetHasStatus: enemy.slowTimerMs > 0,
          targetMovementType: enemy.movementType,
          targetIsBoss: enemy.isBoss,
          attackType: atkType,
          defenderTypes: getSpeciesTypes(enemy.speciesId),
        });
        enemy.hp = Math.max(0, enemy.hp - dmgRes.damage);
        damageBySpecies[u.speciesId] =
          (damageBySpecies[u.speciesId] ?? 0) + dmgRes.damage;
        u.ultCharge = Math.min(u.ultMax, u.ultCharge + dmgRes.ultCharge);
        if (dmgRes.lifestealHeal > 0) {
          u.hp = Math.min(u.maxHp, u.hp + dmgRes.lifestealHeal);
        }
        if (dmgRes.chainDamage > 0 && dmgRes.chainTargets > 0) {
          let chained = 0;
          for (const other of enemies) {
            if (
              other.uid !== enemy.uid &&
              other.hp > 0 &&
              chained < dmgRes.chainTargets
            ) {
              if (
                isInCircularRange(enemy.gx, enemy.gy, other.gx, other.gy, 3)
              ) {
                other.hp = Math.max(0, other.hp - dmgRes.chainDamage);
                damageBySpecies[u.speciesId] =
                  (damageBySpecies[u.speciesId] ?? 0) + dmgRes.chainDamage;
                chained++;
              }
            }
          }
        }
        if (kit.onHitSplash) {
          const splashDmg = Math.max(
            1,
            Math.round(dmgRes.damage * kit.onHitSplash.dmgRatio),
          );
          for (const other of enemies) {
            if (
              other.uid !== enemy.uid &&
              other.hp > 0 &&
              isInCircularRange(
                enemy.gx,
                enemy.gy,
                other.gx,
                other.gy,
                kit.onHitSplash.radius,
              )
            ) {
              other.hp = Math.max(0, other.hp - splashDmg);
              damageBySpecies[u.speciesId] =
                (damageBySpecies[u.speciesId] ?? 0) + splashDmg;
            }
          }
        }
        if (dmgRes.slowDurationMs && dmgRes.slowDurationMs > 0) {
          enemy.slowTimerMs = Math.max(
            enemy.slowTimerMs,
            dmgRes.slowDurationMs,
          );
        }
      }

      // Reap killed enemies
      for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].hp <= 0) {
          gold += enemies[i].bounty;
          totalGoldEarned += enemies[i].bounty;
          totalKills++;
          enemies.splice(i, 1);
        }
      }

      elapsedMs += SIM_DT_MS;
    }

    if (coreHp <= 0) {
      return {
        mapId,
        difficulty,
        strategy,
        seed,
        victory: false,
        waveReached,
        maxWaves: allWaves.length,
        coreHp: 0,
        coreMaxHp: diff.coreMaxHp,
        goldRemaining: gold,
        totalGoldEarned,
        totalKills,
        totalCoreDamageTaken,
        damageBySpecies,
      };
    }

    // Between-wave bot economy: heal/revive fainted units & pick upgrades
    const healCost = getHealCost(waveDef.wave);
    const reviveCost = getReviveCost(waveDef.wave);
    for (const u of units) {
      if (u.hp <= 0 && gold >= reviveCost) {
        gold -= reviveCost;
        u.hp = Math.round(u.maxHp * 0.5);
      } else if (u.hp > 0 && u.hp < u.maxHp * 0.6 && gold >= healCost) {
        gold -= healCost;
        u.hp = u.maxHp;
      }
    }

    const evolvableUnits = units.flatMap((u) => {
      const targets = getEvolutionTargets(u.speciesId);
      return targets.length > 0
        ? [{ uid: u.uid, speciesId: u.speciesId, targetSpeciesId: targets[0] }]
        : [];
    });
    const choices = generateRewardChoices(
      new Set(units.map((u) => u.speciesId)),
      ownedUpgrades,
      ownedArtifacts,
      rng,
      [],
      true,
      units.length < 8,
      evolvableUnits,
    );
    const chosen =
      choices.find((c) => c.kind === 'evolve') ??
      choices.find((c) => c.kind === 'recruit') ??
      choices.find((c) => c.kind === 'artifact') ??
      choices.find((c) => c.kind === 'upgrade');

    if (chosen?.kind === 'evolve' && chosen.unitUid && chosen.targetSpeciesId) {
      const u = units.find((unit) => unit.uid === chosen.unitUid);
      if (u) {
        u.speciesId = chosen.targetSpeciesId;
        refreshUnitStats(u, ownedUpgrades, ownedArtifacts);
      }
    } else if (
      chosen?.kind === 'recruit' &&
      chosen.speciesId &&
      units.length < 8
    ) {
      const spot = findPlacementSpots(
        grid,
        [chosen.speciesId],
        rng,
        strategy,
      )[0];
      units.push(
        createSimUnit(
          `u_${nextUnitIdx++}_${chosen.speciesId}`,
          chosen.speciesId,
          spot.gx,
          spot.gy,
          ownedUpgrades,
          ownedArtifacts,
        ),
      );
    } else if (chosen?.kind === 'artifact') {
      ownedArtifacts.push(chosen.id);
      for (const u of units) refreshUnitStats(u, ownedUpgrades, ownedArtifacts);
    } else if (chosen?.kind === 'upgrade') {
      ownedUpgrades.push(chosen.id);
      for (const u of units) refreshUnitStats(u, ownedUpgrades, ownedArtifacts);
    }
  }

  return {
    mapId,
    difficulty,
    strategy,
    seed,
    victory: waveReached >= allWaves.length && coreHp > 0,
    waveReached,
    maxWaves: allWaves.length,
    coreHp,
    coreMaxHp: diff.coreMaxHp,
    goldRemaining: gold,
    totalGoldEarned,
    totalKills,
    totalCoreDamageTaken,
    damageBySpecies,
  };
}

/** Formats a concise Markdown balance report across species, waves, and bot runs. */
export function formatBalanceReport(): string {
  const eff = computeSpeciesEfficiency().sort(
    (a, b) => b.dpsPerCost - a.dpsPerCost,
  );
  const medianDpsPerCost = eff[Math.floor(eff.length / 2)].dpsPerCost;
  const top5 = eff.slice(0, 5);
  const bottom5 = eff.slice(-5).reverse();

  const lines: string[] = [
    '=== Pokebastion Automated Balance Report ===',
    `Species evaluated: ${eff.length} | Median DPS/cost: ${medianDpsPerCost.toFixed(2)}`,
    'Top 5 DPS/cost:',
    ...top5.map(
      (s) =>
        `  - ${s.name} (${s.rarity}, cost ${s.draftCost}): ${s.dpsPerCost.toFixed(2)} DPS/cost (${s.dps.toFixed(1)} DPS)`,
    ),
    'Bottom 5 DPS/cost:',
    ...bottom5.map(
      (s) =>
        `  - ${s.name} (${s.rarity}, cost ${s.draftCost}): ${s.dpsPerCost.toFixed(2)} DPS/cost (${s.dps.toFixed(1)} DPS)`,
    ),
    '',
    'Headless Bot Simulations (Viridian Outpost, 3 seeds each):',
  ];

  const deathWaves = new Map<number, number>();
  for (const difficulty of ['easy', 'normal', 'hard', 'expert'] as const) {
    for (const strategy of ['balanced', 'greedy', 'random'] as const) {
      const runs = [1, 2, 3].map((seed) =>
        simulateRun({ mapId: 'viridian_outpost', difficulty, strategy, seed }),
      );
      for (const r of runs) {
        if (!r.victory) {
          deathWaves.set(
            r.waveReached,
            (deathWaves.get(r.waveReached) ?? 0) + 1,
          );
        }
      }
      const winRate =
        (runs.filter((r) => r.victory).length / runs.length) * 100;
      const avgWave = runs.reduce((s, r) => s + r.waveReached, 0) / runs.length;
      const avgKills = runs.reduce((s, r) => s + r.totalKills, 0) / runs.length;
      lines.push(
        `  - ${difficulty.padEnd(6)} | ${strategy.padEnd(8)} | win=${winRate.toFixed(0)}% | avgWave=${avgWave.toFixed(1)}/${runs[0].maxWaves} | avgKills=${avgKills.toFixed(0)}`,
      );
    }
  }
  const topDeaths = [...deathWaves.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (topDeaths.length > 0) {
    lines.push(
      '',
      'Top Wave Mortality Hotspots: ' +
        topDeaths.map(([w, c]) => `W${w} (${c} deaths)`).join(', '),
    );
  }
  lines.push('', runMonteCarloAudit(80));
  return lines.join('\n');
}

interface MarginalStat {
  id: string;
  label: string;
  withCount: number;
  deltaWaves: number;
}

function computeMarginalTable(
  records: Array<{ score: number; ids: Set<string> }>,
  labelFn: (id: string) => string,
  minCount = 3,
): MarginalStat[] {
  const allIds = new Set<string>();
  for (const r of records) {
    for (const id of r.ids) allIds.add(id);
  }
  const out: MarginalStat[] = [];
  for (const id of allIds) {
    let withSum = 0;
    let withCount = 0;
    let withoutSum = 0;
    let withoutCount = 0;
    for (const r of records) {
      if (r.ids.has(id)) {
        withSum += r.score;
        withCount++;
      } else {
        withoutSum += r.score;
        withoutCount++;
      }
    }
    if (withCount < minCount || withoutCount < minCount) continue;
    out.push({
      id,
      label: labelFn(id),
      withCount,
      deltaWaves: withSum / withCount - withoutSum / withoutCount,
    });
  }
  return out.sort((a, b) => b.deltaWaves - a.deltaWaves);
}

/**
 * Runs randomized-draft Monte Carlo simulations (random squad + items + artifact)
 * and computes marginal wave impact per entity plus top-performing synergies.
 */
export function runMonteCarloAudit(numRuns = 180): string {
  const itemIds = Object.keys(HELD_ITEM_CATALOG);
  const artifactIds = Object.keys(ARTIFACT_CATALOG);
  const records: Array<{
    score: number;
    species: Set<string>;
    items: Set<string>;
    artifacts: Set<string>;
    pairs: string[];
  }> = [];

  for (let i = 0; i < numRuns; i++) {
    const rng = seededRng(50_000 + i);
    const draftIds = pickDraftIds('random', rng);
    const itemA = itemIds[Math.floor(rng() * itemIds.length)];
    const itemB = itemIds[Math.floor(rng() * itemIds.length)];
    const art = artifactIds[Math.floor(rng() * artifactIds.length)];
    const res = simulateRun({
      mapId: 'viridian_outpost',
      difficulty: 'easy',
      strategy: 'balanced',
      seed: 50_000 + i,
      maxWavesToSim: 8,
      draftIds,
      heldItemsBySlot: [[itemA], [itemB]],
      startingArtifacts: [art],
    });
    const score = res.waveReached + res.totalKills * 0.01;
    records.push({
      score,
      species: new Set(draftIds),
      items: new Set([itemA, itemB]),
      artifacts: new Set([art]),
      pairs: [
        `${POKEMON_SPECIES[draftIds[0]]?.name ?? draftIds[0]} + ${HELD_ITEM_CATALOG[itemA]?.name ?? itemA}`,
        `${POKEMON_SPECIES[draftIds[1] ?? draftIds[0]]?.name ?? draftIds[0]} + ${HELD_ITEM_CATALOG[itemB]?.name ?? itemB}`,
      ],
    });
  }

  const speciesStats = computeMarginalTable(
    records.map((r) => ({ score: r.score, ids: r.species })),
    (id) =>
      `${POKEMON_SPECIES[id]?.name ?? id} (c${POKEMON_SPECIES[id]?.draftCost ?? '?'})`,
  );
  const itemStats = computeMarginalTable(
    records.map((r) => ({ score: r.score, ids: r.items })),
    (id) =>
      `${HELD_ITEM_CATALOG[id]?.name ?? id} (${HELD_ITEM_CATALOG[id]?.cost ?? '?'}g)`,
  );
  const artifactStats = computeMarginalTable(
    records.map((r) => ({ score: r.score, ids: r.artifacts })),
    (id) => ARTIFACT_CATALOG[id]?.name ?? id,
  );

  const sortedByScore = [...records].sort((a, b) => b.score - a.score);
  const topDecile = sortedByScore.slice(
    0,
    Math.max(5, Math.floor(numRuns * 0.2)),
  );
  const pairCounts = new Map<string, number>();
  for (const r of topDecile) {
    for (const p of r.pairs) pairCounts.set(p, (pairCounts.get(p) ?? 0) + 1);
  }
  const topPairs = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const fmtTopBottom = (title: string, list: MarginalStat[]): string[] => {
    if (list.length === 0) return [`${title}: (insufficient samples)`];
    const top = list.slice(0, 3);
    const bot = list.slice(-3).reverse();
    return [
      `${title} (marginal score Δ vs. runs without):`,
      ...top.map(
        (s) =>
          `  + ${s.label}: ${s.deltaWaves >= 0 ? '+' : ''}${s.deltaWaves.toFixed(2)} (n=${s.withCount})`,
      ),
      ...bot.map(
        (s) =>
          `  - ${s.label}: ${s.deltaWaves >= 0 ? '+' : ''}${s.deltaWaves.toFixed(2)} (n=${s.withCount})`,
      ),
    ];
  };

  return [
    `Monte Carlo Marginal Attribution (${numRuns} randomized runs, Easy W1-12):`,
    ...fmtTopBottom('Pokemon', speciesStats),
    ...fmtTopBottom('Held Items', itemStats),
    ...fmtTopBottom('Artifacts', artifactStats),
    'Top-20% Run Synergies (Species + Item): ' +
      topPairs.map(([p, c]) => `${p} (${c}x)`).join(', '),
  ].join('\n');
}
