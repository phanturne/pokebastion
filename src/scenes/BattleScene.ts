import Phaser from 'phaser';
import { ensureSpeciesSpritesLoaded } from './BootScene';
import {
  CORE_HP_BAR_WIDTH,
  PortalVisualState,
  refreshPortalVisuals,
  renderBastionCore,
  renderGridAndMarkers,
  renderTerrain,
  TerrainRenderRefs,
} from './terrainRenderer';
import {
  getSpeciesAttackSfx,
  getSpeciesUltSfx,
  SfxKey,
  SfxPlayer,
} from '../audio/sfx';
import { MAP_BY_ID, createGridForMap } from '../data/maps';
import {
  ENEMY_SPECIES,
  HELD_ITEMS,
  POKEMON_SPECIES,
  STARTER_UNLOCKED_IDS,
  STRUCTURE_SPECS,
  WAVE_DEFINITIONS,
  WaveDefinition,
} from '../data/pokemon';
import {
  computeBasicAttackDamage,
  computeEnemyAttackDamage,
  computeKillBounty,
  computeSlowDurationMs,
  computeStartingUlt,
  computeUltPower,
  computeUnitAtk,
  computeUnitAttackIntervalMs,
  computeUnitDef,
  computeUnitMaxHp as computeCombatUnitMaxHp,
  computeUnitRange,
} from '../engine/combat';
import { getUnlockShardCost, RECRUIT_SHARDS } from '../engine/progression';
import {
  addShardsToSpecies,
  applyRunVictoryRewards,
  buildPokemonProgressMap,
  getUnlockedIds,
  hatchEggFromSave,
  isPokemonUnlocked,
  loadPlayerSave,
  persistPlayerSave,
  PlayerSave,
  unlockSpeciesWithShards as unlockSpeciesWithShardsFromSave,
  upgradeSpeciesPotential as upgradeSpeciesPotentialFromSave,
} from '../engine/save';
import {
  CORE_CELLS,
  findNearestBlockingWall,
  findPath,
  findUnitPath,
  GridPoint,
  isNoBuildTile,
  rollWavePortals,
  rotateWavePortals,
  SpawnPortal,
} from '../engine/pathfinding';
import {
  canDraftSpecies,
  computeProjectileLaunch,
  DRAFT_BUDGET,
  generateRewardChoices as buildRewardChoices,
  getBranchSpec,
  getDraftCost,
  getEffectiveMoveRange,
  getRepairCost,
  getSellRefund,
  HEAL_COST,
  isInCircularRange,
  isShopAfterWave,
  MAX_ACTIVE_UNITS,
  MAX_HELD_ITEMS,
  MAX_RESERVE_UNITS,
  REVIVE_COST,
} from '../engine/rules';
import {
  ActiveUnit,
  EggHatchResult,
  EggTier,
  GRID_COLS,
  GRID_ROWS,
  GamePhase,
  GameSnapshot,
  GridStructure,
  RewardOption,
  StructureKind,
  TILE_SIZE,
  TileKind,
} from '../types';

const CANVAS_WIDTH = GRID_COLS * TILE_SIZE;
const CANVAS_HEIGHT = GRID_ROWS * TILE_SIZE;

const PREP_INITIAL_POSITIONS: readonly GridPoint[] = [
  { gx: 12, gy: 7 },
  { gx: 15, gy: 7 },
  { gx: 12, gy: 10 },
  { gx: 15, gy: 10 },
  { gx: 11, gy: 8 },
  { gx: 16, gy: 9 },
];

const INITIAL_GOLD = 140;
const INITIAL_AP = 8;
const MAX_AP = 10;
const CORE_MAX_HP = 1000;
const BERRY_HEAL_PER_SEC = 8;
const BARREL_DAMAGE = 120;
const BARREL_RADIUS = 1.8;
const ULT_RADIUS = 1.5;
const MAX_FLOATING_TEXTS = 28;
const MAX_TRANSIENT_VFX = 60;

interface UnitEntity {
  data: ActiveUnit;
  sprite: Phaser.GameObjects.Sprite;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  ultBarFill: Phaser.GameObjects.Rectangle;
  stationaryMs: number;
  isAttackAnimPlaying: boolean;
  movePath: GridPoint[];
  moveTarget: GridPoint | null;
}

interface StructureEntity {
  data: GridStructure;
  sprite: Phaser.GameObjects.Image;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
}

interface EnemyEntity {
  uid: string;
  speciesId: string;
  x: number;
  y: number;
  gx: number;
  gy: number;
  hp: number;
  maxHp: number;
  facingDir: number;
  attackCooldownMs: number;
  burnTimerMs: number;
  burnDps: number;
  burnTickMs: number;
  slowTimerMs: number;
  stunTimerMs: number;
  hitFlashTimerMs: number;
  path: GridPoint[];
  targetWallUid: string | null;
  repathTimerMs: number;
  sprite: Phaser.GameObjects.Sprite;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
}

interface SpawnEntry {
  spawnAtMs: number;
  speciesId: string;
  point: GridPoint;
}

function isHealUltSpecies(speciesId: string): boolean {
  return speciesId === '0001' || speciesId === '0012';
}

function tileCenterX(gx: number): number {
  return gx * TILE_SIZE + TILE_SIZE / 2;
}

function tileCenterY(gy: number): number {
  return gy * TILE_SIZE + TILE_SIZE / 2;
}

function worldToGrid(x: number, y: number): GridPoint {
  return {
    gx: Phaser.Math.Clamp(Math.floor(x / TILE_SIZE), 0, GRID_COLS - 1),
    gy: Phaser.Math.Clamp(Math.floor(y / TILE_SIZE), 0, GRID_ROWS - 1),
  };
}

function keyOf(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

function manhattanDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function chebyshevDist(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/**
 * Maps vector `(dx, dy)` in screen coordinates (+x East, +y South) to PMD 8-direction row:
 * 0=S, 1=SE, 2=E, 3=NE, 4=N, 5=NW, 6=W, 7=SW.
 */
function vectorToPmdDir(dx: number, dy: number, fallback = 0): number {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return fallback;
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return (((2 - octant) % 8) + 8) % 8;
}

const E2E_FAST_WAVES: WaveDefinition[] = [
  {
    wave: 1,
    title: 'E2E Skirmish I',
    desc: 'Fast deterministic wave for E2E verification.',
    spawns: [{ speciesId: '0019', count: 2, side: 'west', intervalMs: 200 }],
  },
  {
    wave: 2,
    title: 'E2E Skirmish II',
    desc: 'Fast deterministic wave for E2E verification.',
    spawns: [{ speciesId: '0019', count: 2, side: 'east', intervalMs: 200 }],
  },
];

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getSearchParams(): URLSearchParams | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search);
}

export class BattleScene extends Phaser.Scene {
  private tiles: TileKind[][] = [];
  private selectedMapId = 'viridian_outpost';
  private terrainRefs: TerrainRenderRefs = {};
  private phase: GamePhase = 'HOME';
  private playerSave: PlayerSave = loadPlayerSave();
  private readonly rng: () => number = (() => {
    const raw = getSearchParams()?.get('seed');
    if (raw === null || raw === undefined || raw === '') return Math.random;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? createSeededRng(parsed) : Math.random;
  })();
  private readonly activeWaves: WaveDefinition[] =
    getSearchParams()?.get('e2eMap') === '1'
      ? E2E_FAST_WAVES
      : WAVE_DEFINITIONS;
  private wave = 1;
  private readonly maxWaves = this.activeWaves.length;
  private coreHp = CORE_MAX_HP;
  private coreMaxHp = CORE_MAX_HP;
  private gold = INITIAL_GOLD;
  private ap = INITIAL_AP;
  private maxAp = MAX_AP;
  private kills = 0;
  private speedMult: 1 | 2 = 1;
  private paused = false;
  private slowMo = false;
  private screenShakeEnabled = true;

  private selectedTool: StructureKind | 'sell_struct' | null = null;
  private selectedUnitUid: string | null = null;
  private selectedStructureUid: string | null = null;
  private movingStructureUid: string | null = null;
  private aimingUltUnitUid: string | null = null;

  private units: UnitEntity[] = [];
  private reserveIds: string[] = [];
  private draftIds: string[] = [];
  private heldItemInventory: string[] = [];
  private structures: StructureEntity[] = [];
  private enemies: EnemyEntity[] = [];
  private spawnQueue: SpawnEntry[] = [];
  private spawnQueueIndex = 0;
  private isUpdatingEnemies = false;
  private enemiesDirty = false;
  private inCombatFrame = false;
  private snapshotDirty = false;

  private artifacts: string[] = [];
  private upgrades: string[] = [];
  private rewardChoices: RewardOption[] = [];
  private pendingBranchUnitUid: string | null = null;
  private statusMessage = 'Prepare your defenses and position Pokémon.';

  private waveElapsedMs = 0;
  private berryHealTimerMs = 0;
  private nextUidCounter = 1;
  private hoverTile: GridPoint | null = null;
  private hoveredUnitUid: string | null = null;
  private hoveredEnemyUid: string | null = null;
  private hoveredStructUid: string | null = null;
  private lastPointerScreenX = -1;
  private lastPointerScreenY = -1;
  private lastCamScrollX = Number.NaN;
  private lastCamScrollY = Number.NaN;
  private lastCamZoom = Number.NaN;
  private readonly reprojWorldPoint = new Phaser.Math.Vector2();
  private ultHighlightRefreshTimerMs = 0;
  private combatSnapshotCooldownMs = 0;
  private hadSpeculativeWallPreview = false;
  private isDraggingCamera = false;
  private canDragCamera = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartScrollX = 0;
  private dragStartScrollY = 0;
  private panKeys?: {
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private coreHpBarFill!: Phaser.GameObjects.Rectangle;
  private coreSprite?: Phaser.GameObjects.Image;
  private coreHitFlashTimerMs = 0;
  private lastCoreShakeAtMs = 0;
  private activePortals: SpawnPortal[] = [];
  private portalVisualState!: PortalVisualState;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private pathPreviewGraphics!: Phaser.GameObjects.Graphics;
  private pathPreviewStaticGraphics!: Phaser.GameObjects.Graphics;
  private cachedDashSegments: Array<{
    color: number;
    x1: number;
    y1: number;
    ux: number;
    uy: number;
    dist: number;
  }> = [];
  private pathDashOffset = 0;
  private pathDashTickMs = 0;
  private buildGhostSprite!: Phaser.GameObjects.Image;
  private moveCostBadge!: Phaser.GameObjects.Text;
  private ultCasterRing!: Phaser.GameObjects.Arc;
  private hoverReadoutContainer!: Phaser.GameObjects.Container;
  private hoverReadoutBg!: Phaser.GameObjects.Rectangle;
  private hoverReadoutText!: Phaser.GameObjects.Text;
  private lastHoverReadoutText = '';
  private lastHoverReadoutVisible = false;
  private transientVfx: Phaser.GameObjects.GameObject[] = [];
  private floatingTexts: Phaser.GameObjects.Text[] = [];
  private sfx!: SfxPlayer;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    (window as unknown as { __battleScene?: BattleScene }).__battleScene = this;
    this.registry.set('battleScene', this);
    this.sfx = new SfxPlayer(this);

    this.terrainRefs = { terrainLayer: this.add.group() };
    this.tiles = createGridForMap(this.selectedMapId);
    this.renderTerrain();
    this.portalVisualState = {
      portalGraphics: renderGridAndMarkers(this),
      portalMarkers: [],
      portalTween: null,
    };
    this.coreHpBarFill = renderBastionCore(this);
    this.coreSprite = this.children.list.find(
      (obj): obj is Phaser.GameObjects.Image =>
        obj instanceof Phaser.GameObjects.Image &&
        obj.texture.key === 'tex:core',
    );

    this.highlightGraphics = this.add.graphics().setDepth(2);
    this.pathPreviewGraphics = this.add.graphics().setDepth(3);
    this.pathPreviewStaticGraphics = this.add.graphics().setDepth(3);
    this.buildGhostSprite = this.add
      .image(0, 0, 'tex:wood_wall')
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setDepth(4)
      .setAlpha(0.55)
      .setVisible(false);
    this.ultCasterRing = this.add
      .circle(0, 0, TILE_SIZE * 0.56, 0xfbbf24, 0.1)
      .setStrokeStyle(2.5, 0xfbbf24, 0.95)
      .setDepth(6)
      .setVisible(false);
    this.moveCostBadge = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#22d3ee',
        backgroundColor: '#020617cc',
        padding: { left: 5, right: 5, top: 2, bottom: 2 },
      })
      .setDepth(10)
      .setVisible(false);

    this.hoverReadoutBg = this.add
      .rectangle(0, 0, 120, 24, 0x020617, 0.86)
      .setOrigin(0, 1)
      .setStrokeStyle(1, 0x334155, 0.95);
    this.hoverReadoutText = this.add
      .text(8, -5, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f8fafc',
      })
      .setOrigin(0, 1);
    this.hoverReadoutContainer = this.add
      .container(10, this.scale.height - 10, [
        this.hoverReadoutBg,
        this.hoverReadoutText,
      ])
      .setDepth(100)
      .setScrollFactor(0)
      .setVisible(false);

    const borderPx = 14 * TILE_SIZE;
    const worldW = CANVAS_WIDTH + borderPx * 2;
    const worldH = CANVAS_HEIGHT + borderPx * 2;
    const getMinZoom = (w: number, h: number) =>
      Math.max(w / worldW, h / worldH, 0.95);

    const cam = this.cameras.main;
    cam.setBounds(-borderPx, -borderPx, worldW, worldH);
    cam.setZoom(
      Math.max(getMinZoom(this.scale.width, this.scale.height), 1.65),
    );
    cam.centerOn(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.hoverReadoutContainer.setPosition(10, gameSize.height - 10);
      const minZ = getMinZoom(gameSize.width, gameSize.height);
      if (cam.zoom < minZ) {
        cam.setZoom(minZ);
      }
    });

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: unknown,
        _deltaX: number,
        deltaY: number,
      ) => {
        if (!this.isCameraInputAllowed()) return;
        const minZ = getMinZoom(this.scale.width, this.scale.height);
        const oldZoom = cam.zoom;
        const nextZoom = Phaser.Math.Clamp(oldZoom - deltaY * 0.001, minZ, 2.5);
        if (nextZoom === oldZoom) return;
        cam.setZoom(nextZoom);
        cam.scrollX +=
          (pointer.x - cam.x - cam.width * cam.originX) *
          (1 / oldZoom - 1 / nextZoom);
        cam.scrollY +=
          (pointer.y - cam.y - cam.height * cam.originY) *
          (1 / oldZoom - 1 / nextZoom);
      },
    );

    if (this.input.keyboard) {
      this.panKeys = {
        w: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W, false),
        a: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
        s: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S, false),
        d: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
        up: this.input.keyboard.addKey(
          Phaser.Input.Keyboard.KeyCodes.UP,
          false,
        ),
        left: this.input.keyboard.addKey(
          Phaser.Input.Keyboard.KeyCodes.LEFT,
          false,
        ),
        down: this.input.keyboard.addKey(
          Phaser.Input.Keyboard.KeyCodes.DOWN,
          false,
        ),
        right: this.input.keyboard.addKey(
          Phaser.Input.Keyboard.KeyCodes.RIGHT,
          false,
        ),
      };
    }

    this.initNewRunState();
  }

  update(time: number, delta: number): void {
    const clampedDelta = Math.min(delta, 50);
    if (this.panKeys && this.isCameraInputAllowed()) {
      const cam = this.cameras.main;
      const panSpeed = (360 / cam.zoom) * (clampedDelta / 1000);
      const isPlainDown = (k: Phaser.Input.Keyboard.Key): boolean =>
        k.isDown && !k.ctrlKey && !k.metaKey;
      if (isPlainDown(this.panKeys.a) || isPlainDown(this.panKeys.left)) {
        cam.scrollX -= panSpeed;
      }
      if (isPlainDown(this.panKeys.d) || isPlainDown(this.panKeys.right)) {
        cam.scrollX += panSpeed;
      }
      if (isPlainDown(this.panKeys.w) || isPlainDown(this.panKeys.up)) {
        cam.scrollY -= panSpeed;
      }
      if (isPlainDown(this.panKeys.s) || isPlainDown(this.panKeys.down)) {
        cam.scrollY += panSpeed;
      }
    }
    const timeScale =
      this.phase === 'COMBAT'
        ? this.paused
          ? 0
          : this.slowMo
            ? 0.35
            : this.speedMult
        : 1;
    this.anims.globalTimeScale = timeScale;
    this.tweens.timeScale = timeScale;

    if (this.phase === 'COMBAT' && this.paused) {
      return;
    }

    if (this.coreHitFlashTimerMs > 0) {
      this.coreHitFlashTimerMs = Math.max(
        0,
        this.coreHitFlashTimerMs - clampedDelta,
      );
      if (this.coreHitFlashTimerMs === 0 && this.coreSprite?.isTinted) {
        this.coreSprite.setTint(0xffffff);
        this.coreSprite.clearTint();
      }
    }

    if (this.coreHp > 0 && this.coreHp / this.coreMaxHp <= 0.25) {
      const pulse = 0.55 + 0.45 * Math.sin(time * 0.01);
      this.coreHpBarFill.setAlpha(pulse);
    } else if (this.coreHpBarFill.alpha !== 1) {
      this.coreHpBarFill.setAlpha(1);
    }

    if (this.aimingUltUnitUid) {
      const caster = this.units.find(
        (u) => u.data.uid === this.aimingUltUnitUid,
      );
      if (caster && !caster.data.fainted) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 0.008);
        this.ultCasterRing
          .setPosition(caster.sprite.x, caster.sprite.y)
          .setScale(0.92 + pulse * 0.18)
          .setAlpha(0.6 + pulse * 0.4)
          .setVisible(true);
      } else {
        this.ultCasterRing.setVisible(false);
      }
    } else {
      this.ultCasterRing.setVisible(false);
    }

    if (this.phase === 'PREP') {
      if (this.cachedDashSegments.length > 0) {
        this.pathDashOffset = (this.pathDashOffset + clampedDelta * 0.028) % 14;
        this.pathDashTickMs += clampedDelta;
        if (this.pathDashTickMs >= 75) {
          this.pathDashTickMs %= 75;
          this.renderPreviewDashes();
        }
      }
      this.syncPointerHoverAfterCameraMove(false);
      return;
    }

    if (this.phase !== 'COMBAT') return;

    const prevSec = Math.floor(this.waveElapsedMs / 1000);
    const simDtMs = clampedDelta * timeScale;
    this.waveElapsedMs += simDtMs;
    if (Math.floor(this.waveElapsedMs / 1000) !== prevSec) {
      this.snapshotDirty = true;
    }

    this.inCombatFrame = true;
    try {
      this.processSpawnQueue();
      this.updateBerryBushes(simDtMs);
      this.updateEnemies(simDtMs);
      this.updateUnits(simDtMs);
    } finally {
      this.inCombatFrame = false;
    }

    if (this.aimingUltUnitUid) {
      this.ultHighlightRefreshTimerMs += clampedDelta;
    } else {
      this.ultHighlightRefreshTimerMs = 0;
    }
    const allowThrottledUltRefresh =
      Boolean(this.aimingUltUnitUid) && this.ultHighlightRefreshTimerMs >= 100;
    if (allowThrottledUltRefresh) {
      this.ultHighlightRefreshTimerMs = 0;
    }
    this.syncPointerHoverAfterCameraMove(allowThrottledUltRefresh);

    if (this.coreHp <= 0) {
      this.handleDefeat();
      return;
    }

    if (
      this.spawnQueueIndex >= this.spawnQueue.length &&
      this.enemies.length === 0
    ) {
      this.handleWaveComplete();
      return;
    }

    if (this.combatSnapshotCooldownMs > 0) {
      this.combatSnapshotCooldownMs = Math.max(
        0,
        this.combatSnapshotCooldownMs - clampedDelta,
      );
    }
    if (this.snapshotDirty && this.combatSnapshotCooldownMs <= 0) {
      this.combatSnapshotCooldownMs = 100;
      this.emitSnapshot();
    }
  }

  // ---------------------------------------------------------------------------
  // Public Controller API
  // ---------------------------------------------------------------------------

  public getSnapshot(): GameSnapshot {
    return {
      phase: this.phase,
      wave: this.wave,
      maxWaves: this.maxWaves,
      waveElapsedMs: this.waveElapsedMs,
      coreHp: Math.max(0, Math.round(this.coreHp)),
      coreMaxHp: this.coreMaxHp,
      gold: this.gold,
      ap: this.ap,
      maxAp: this.maxAp,
      kills: this.kills,
      speedMult: this.speedMult,
      paused: this.paused,
      muted: this.sfx?.isMuted() ?? false,
      screenShakeEnabled: this.screenShakeEnabled,
      selectedTool: this.selectedTool,
      selectedUnitUid: this.selectedUnitUid,
      selectedStructureUid: this.selectedStructureUid,
      movingStructureUid: this.movingStructureUid,
      aimingUltUnitUid: this.aimingUltUnitUid,
      activeUnits: this.units.map((u) => ({
        ...u.data,
        heldItems: [...u.data.heldItems],
      })),
      reserveIds: [...this.reserveIds],
      draftIds: [...this.draftIds],
      unlockedIds: getUnlockedIds(this.playerSave),
      selectedMapId: this.selectedMapId,
      draftBudget: DRAFT_BUDGET,
      heldItemInventory: [...this.heldItemInventory],
      structures: this.structures.map((s) => ({ ...s.data })),
      artifacts: [...this.artifacts],
      upgrades: [...this.upgrades],
      rewardChoices: this.rewardChoices.map((r) => ({ ...r })),
      pendingBranchUnitUid: this.pendingBranchUnitUid,
      statusMessage: this.statusMessage,
      pokemonProgress: buildPokemonProgressMap(this.playerSave),
      universalShards: this.playerSave.universalShards ?? 0,
      eggs: {
        common: this.playerSave.eggs?.common ?? 0,
        rare: this.playerSave.eggs?.rare ?? 0,
        master: this.playerSave.eggs?.master ?? 0,
      },
      pityWins: this.playerSave.pityWins ?? 0,
      achievements: [...(this.playerSave.achievements ?? [])],
      clearedMaps: [...(this.playerSave.clearedMaps ?? [])],
    };
  }

  public selectTool(tool: StructureKind | 'sell_struct' | null): void {
    if (this.phase !== 'PREP' && tool !== null) {
      this.setStatus(
        'Structures can only be built, moved, or sold during Prep.',
      );
      return;
    }
    this.selectedTool = this.selectedTool === tool ? null : tool;
    this.movingStructureUid = null;
    this.aimingUltUnitUid = null;
    if (this.selectedTool !== null) {
      this.selectedUnitUid = null;
      this.selectedStructureUid = null;
    }
    this.refreshPathPreview();
    this.refreshHighlights();
    this.refreshHoverReadout();
    this.emitSnapshot();
  }

  public cancelAction(): void {
    this.selectedTool = null;
    this.selectedUnitUid = null;
    this.selectedStructureUid = null;
    this.movingStructureUid = null;
    this.aimingUltUnitUid = null;
    this.paused = false;
    this.slowMo = false;
    const normalScale = this.phase === 'COMBAT' ? this.speedMult : 1;
    this.anims.globalTimeScale = normalScale;
    this.tweens.timeScale = normalScale;
    this.refreshPathPreview();
    this.refreshHighlights();
    this.refreshHoverReadout();
    this.emitSnapshot();
  }

  public sellStructureByUid(uid: string): void {
    const entity = this.structures.find((s) => s.data.uid === uid);
    if (entity) {
      this.sellStructure(entity);
    }
  }

  public selectUnit(uid: string | null): void {
    if (this.phase !== 'PREP' && this.phase !== 'COMBAT') return;

    this.aimingUltUnitUid = null;
    this.selectedStructureUid = null;
    this.movingStructureUid = null;

    if (uid === null) {
      this.selectedUnitUid = null;
      this.slowMo = false;
      this.refreshHighlights();
      this.emitSnapshot();
      return;
    }

    const unit = this.units.find((u) => u.data.uid === uid);
    if (!unit) return;

    if (this.phase === 'COMBAT' && unit.data.fainted) {
      this.setStatus(
        `${POKEMON_SPECIES[unit.data.speciesId].name} is fainted.`,
      );
      return;
    }

    const hadTool = this.selectedTool !== null;
    this.selectedTool = null;
    this.selectedUnitUid = uid;
    this.slowMo = this.phase === 'COMBAT';
    if (hadTool) {
      this.refreshPathPreview();
      this.refreshHoverReadout();
    }
    this.refreshHighlights();
    this.emitSnapshot();
  }

  public startWave(): void {
    if (this.phase !== 'PREP') return;

    this.phase = 'COMBAT';
    this.selectedTool = null;
    this.selectedUnitUid = null;
    this.selectedStructureUid = null;
    this.movingStructureUid = null;
    this.aimingUltUnitUid = null;
    this.paused = false;
    this.slowMo = false;
    this.waveElapsedMs = 0;
    this.berryHealTimerMs = 0;
    for (const u of this.units) {
      u.data.damageDealt = 0;
      u.data.damageTaken = 0;
      u.data.healingDone = 0;
      const startUlt = computeStartingUlt(
        u.data.ultMax,
        this.getSpeciesPotential(u.data.speciesId),
      );
      if (u.data.ult < startUlt) {
        u.data.ult = startUlt;
        this.updateUnitBars(u);
      }
    }

    this.buildSpawnQueue();
    this.cachedDashSegments = [];
    this.pathPreviewGraphics.clear();
    this.pathPreviewStaticGraphics.clear();
    this.refreshHighlights();
    this.sfx.play('wave_start', 0);

    const waveDef = this.activeWaves[this.wave - 1];
    this.setStatus(
      waveDef ? `${waveDef.title} begun!` : `Wave ${this.wave} begun!`,
    );
  }

  public togglePause(): void {
    if (this.phase !== 'COMBAT') return;
    this.paused = !this.paused;
    this.sfx.play('ui_click', 0);
    this.setStatus(this.paused ? 'Combat paused.' : 'Combat resumed.');
  }

  public toggleSpeed(): void {
    this.speedMult = this.speedMult === 1 ? 2 : 1;
    this.sfx.play('ui_click', 0);
    this.emitSnapshot();
  }

  public toggleMute(): void {
    this.sfx.toggleMute();
    this.emitSnapshot();
  }

  public toggleScreenShake(): void {
    this.screenShakeEnabled = !this.screenShakeEnabled;
    this.emitSnapshot();
  }

  public playUiSfx(
    key: Extract<SfxKey, 'ui_click' | 'ui_confirm' | 'ui_select' | 'coin'>,
  ): void {
    this.sfx.play(key, 40);
  }

  public toggleAutoUlt(uid: string): void {
    const unit = this.units.find((u) => u.data.uid === uid);
    if (!unit) return;
    unit.data.autoUlt = !unit.data.autoUlt;
    this.emitSnapshot();
  }

  public triggerUlt(uid: string): void {
    if (this.phase !== 'COMBAT') {
      this.setStatus('Ultimates can only be used during combat.');
      return;
    }
    const unit = this.units.find((u) => u.data.uid === uid);
    if (!unit || unit.data.fainted) return;
    if (unit.data.ult < unit.data.ultMax) {
      this.setStatus(
        `${POKEMON_SPECIES[unit.data.speciesId].name}'s Ultimate is not ready.`,
      );
      return;
    }

    this.selectedTool = null;
    this.selectedUnitUid = null;
    this.selectedStructureUid = null;
    this.aimingUltUnitUid = uid;
    this.slowMo = true;
    this.refreshHighlights();
    this.refreshHoverReadout();
    this.setStatus(
      `Click a tile to cast ${POKEMON_SPECIES[unit.data.speciesId].ultName} (Right-click to cancel).`,
    );
  }

  private repairSingleStructure(entity: StructureEntity, cost: number): void {
    this.gold -= cost;
    entity.data.hp = entity.data.maxHp;
    entity.data.ruined = false;
    entity.sprite.setTexture(`tex:${entity.data.kind}`);
    this.updateStructureBar(entity);
  }

  public repairStructure(uid: string): void {
    const entity = this.structures.find((s) => s.data.uid === uid);
    if (!entity) return;
    if (!entity.data.ruined && entity.data.hp >= entity.data.maxHp) return;

    const spec = STRUCTURE_SPECS[entity.data.kind];
    const cost = getRepairCost(
      entity.data.kind,
      entity.data.hp,
      entity.data.maxHp,
    );
    if (this.gold < cost) {
      this.setStatus(`Need ₽${cost} to repair ${spec.name}.`);
      return;
    }

    if (entity.data.ruined && this.getUnitAt(entity.data.gx, entity.data.gy)) {
      this.setStatus(
        'Cannot repair while a Pokémon is standing on the rubble.',
      );
      return;
    }

    this.repairSingleStructure(entity, cost);
    this.invalidateEnemyPaths();
    this.refreshPathPreview();
    this.refreshHoverReadout();
    this.sfx.play('build', 60);
    this.setStatus(`Repaired ${spec.name} (-₽${cost}).`);
  }

  public repairAllStructures(): void {
    if (this.phase !== 'PREP') return;

    let repairedCount = 0;
    let totalCost = 0;
    let sawDamaged = false;

    for (const entity of this.structures) {
      if (!entity.data.ruined && entity.data.hp >= entity.data.maxHp) continue;
      sawDamaged = true;

      if (
        entity.data.ruined &&
        this.getUnitAt(entity.data.gx, entity.data.gy)
      ) {
        continue;
      }

      const cost = getRepairCost(
        entity.data.kind,
        entity.data.hp,
        entity.data.maxHp,
      );
      if (this.gold < cost) break;

      this.repairSingleStructure(entity, cost);
      repairedCount += 1;
      totalCost += cost;
    }

    if (repairedCount > 0) {
      this.invalidateEnemyPaths();
      this.refreshPathPreview();
      this.refreshHighlights();
      this.refreshHoverReadout();
      this.sfx.play('build', 60);
      this.setStatus(
        `Repaired ${repairedCount} structure${repairedCount === 1 ? '' : 's'} (-₽${totalCost}).`,
      );
      return;
    }

    if (sawDamaged) {
      this.setStatus('Not enough ₽ to repair structures.');
    } else {
      this.setStatus('All structures are already at full HP.');
    }
  }

  public detonateBarrel(uid: string): void {
    const entity = this.structures.find((s) => s.data.uid === uid);
    if (!entity || entity.data.kind !== 'barrel' || entity.data.ruined) return;
    this.explodeBarrel(entity);
    this.emitSnapshot();
  }

  public healUnit(uid: string): void {
    const unit = this.units.find((u) => u.data.uid === uid);
    if (!unit || unit.data.fainted || unit.data.hp >= unit.data.maxHp) return;

    const cost = HEAL_COST;
    if (this.gold < cost) {
      this.setStatus(
        `Need ₽${cost} to heal ${POKEMON_SPECIES[unit.data.speciesId].name}.`,
      );
      return;
    }

    this.gold -= cost;
    const healed = unit.data.maxHp - unit.data.hp;
    unit.data.hp = unit.data.maxHp;
    this.updateUnitBars(unit);
    this.spawnFloatingText(
      unit.sprite.x,
      unit.sprite.y - 24,
      `+${Math.round(healed)}`,
      '#4ade80',
    );
    this.refreshHoverReadout();
    this.setStatus(
      `Healed ${POKEMON_SPECIES[unit.data.speciesId].name} (-₽${cost}).`,
    );
  }

  public reviveUnit(uid: string): void {
    const unit = this.units.find((u) => u.data.uid === uid);
    if (!unit || !unit.data.fainted) return;

    const cost = REVIVE_COST;
    if (this.gold < cost) {
      this.setStatus(
        `Need ₽${cost} to revive ${POKEMON_SPECIES[unit.data.speciesId].name}.`,
      );
      return;
    }

    this.gold -= cost;
    unit.data.fainted = false;
    unit.data.hp = unit.data.maxHp;
    unit.data.attackCooldownMs = 0;
    unit.sprite.setAlpha(1);
    unit.sprite.clearTint();
    this.playUnitAnim(unit, 'Idle');
    this.updateUnitBars(unit);
    this.spawnFloatingText(
      unit.sprite.x,
      unit.sprite.y - 24,
      'REVIVED!',
      '#fde047',
    );
    this.refreshHoverReadout();
    this.setStatus(
      `Revived ${POKEMON_SPECIES[unit.data.speciesId].name} (-₽${cost}).`,
    );
  }

  public startPlayFromHome(): void {
    if (this.phase !== 'HOME') return;
    this.phase = 'MAP_SELECT';
    this.setStatus('Select a battlefield map.');
  }

  public goToMapSelect(): void {
    if (this.phase !== 'HOME' && this.phase !== 'DRAFT') return;
    this.phase = 'MAP_SELECT';
    this.setStatus('Select a battlefield map.');
  }

  public selectMapAndDraft(mapId: string): void {
    if (this.phase !== 'MAP_SELECT') return;
    const spec = MAP_BY_ID[mapId];
    if (!spec || spec.comingSoon) return;
    if (this.selectedMapId !== mapId) {
      this.selectedMapId = mapId;
      this.tiles = createGridForMap(mapId);
      this.renderTerrain();
      this.refreshPathPreview();
    }
    this.phase = 'DRAFT';
    this.setStatus(
      `${MAP_BY_ID[mapId].name}: Draft your starting Pokémon (10-point budget).`,
    );
  }

  public backToMapSelect(): void {
    if (this.phase !== 'DRAFT') return;
    this.phase = 'MAP_SELECT';
    this.setStatus('Select a battlefield map.');
  }

  public returnToHome(): void {
    this.restartRun();
  }

  public toggleDraftSpecies(speciesId: string): void {
    if (this.phase !== 'DRAFT') return;
    const idx = this.draftIds.indexOf(speciesId);
    if (idx !== -1) {
      this.draftIds.splice(idx, 1);
      this.emitSnapshot();
      return;
    }
    if (!isPokemonUnlocked(this.playerSave, speciesId)) {
      this.setStatus(
        `${POKEMON_SPECIES[speciesId]?.name ?? speciesId} is locked. Recruit it in a run to unlock!`,
      );
      return;
    }
    if (!canDraftSpecies(this.draftIds, speciesId, DRAFT_BUDGET)) {
      this.setStatus(
        `Cannot draft ${POKEMON_SPECIES[speciesId]?.name ?? speciesId}: 10-point budget or 6-unit cap reached.`,
      );
      return;
    }
    this.draftIds.push(speciesId);
    this.emitSnapshot();
  }

  public clearDraft(): void {
    if (this.phase !== 'DRAFT') return;
    this.draftIds = [];
    this.emitSnapshot();
  }

  public confirmDraft(): void {
    if (this.phase !== 'DRAFT' || this.draftIds.length === 0) return;
    for (let i = 0; i < this.draftIds.length; i++) {
      const pos = PREP_INITIAL_POSITIONS[i % PREP_INITIAL_POSITIONS.length];
      this.spawnUnit(this.draftIds[i], pos.gx, pos.gy);
    }
    this.phase = 'PREP';
    this.activePortals = rollWavePortals(this.wave, this.tiles, []);
    this.refreshPortalVisuals();
    this.refreshPathPreview();
    this.refreshHighlights();
    this.setStatus(
      `Wave 1 Prep: ${this.units.length} Pokémon deployed (${getDraftCost(this.draftIds)}/${DRAFT_BUDGET} pts).`,
    );
  }

  private recalcUnitMaxHp(unit: UnitEntity): void {
    const prevMax = unit.data.maxHp;
    unit.data.maxHp = this.computeUnitMaxHp(
      unit.data.speciesId,
      unit.data.branchId,
      unit.data.heldItems,
    );
    if (!unit.data.fainted) {
      unit.data.hp = Math.min(
        unit.data.maxHp,
        unit.data.hp + Math.max(0, unit.data.maxHp - prevMax),
      );
      if (unit.data.maxHp < prevMax && unit.data.hp <= 0) {
        unit.data.hp = 1;
      }
    }
    this.updateUnitBars(unit);
  }

  public pickBranchReward(branchId: string): void {
    if (this.phase !== 'REWARD' || !this.pendingBranchUnitUid) return;
    const unit = this.units.find(
      (u) => u.data.uid === this.pendingBranchUnitUid,
    );
    if (!unit) return;
    const branch = getBranchSpec(unit.data.speciesId, branchId);
    if (!branch) return;

    unit.data.branchId = branch.id;
    this.recalcUnitMaxHp(unit);
    unit.sprite.setScale(1.12);
    this.pendingBranchUnitUid = null;
    this.advanceAfterReward(
      `${POKEMON_SPECIES[unit.data.speciesId].name} specialized into ${branch.name}!`,
    );
  }

  public deployReserve(reserveSpeciesId: string): void {
    if (this.phase !== 'PREP') {
      this.setStatus('Deploying reserves is only allowed during Prep.');
      return;
    }
    if (this.units.length >= MAX_ACTIVE_UNITS) {
      this.setStatus(`Maximum ${MAX_ACTIVE_UNITS} deployed Pokémon reached.`);
      return;
    }
    const reserveIdx = this.reserveIds.indexOf(reserveSpeciesId);
    if (reserveIdx === -1) return;

    const openPos =
      PREP_INITIAL_POSITIONS.find((p) => this.isValidUnitTile(p.gx, p.gy)) ??
      this.findOpenPrepTile();
    if (!openPos) {
      this.setStatus('No open tile available to deploy.');
      return;
    }

    this.reserveIds.splice(reserveIdx, 1);
    const unit = this.spawnUnit(reserveSpeciesId, openPos.gx, openPos.gy);
    this.selectedUnitUid = unit.data.uid;
    this.refreshHighlights();
    this.setStatus(
      `Deployed ${POKEMON_SPECIES[reserveSpeciesId]?.name ?? reserveSpeciesId} (${this.units.length}/${MAX_ACTIVE_UNITS}).`,
    );
  }

  private findOpenPrepTile(): GridPoint | null {
    for (let radius = 2; radius <= 6; radius++) {
      for (let gy = 9 - radius; gy <= 9 + radius; gy++) {
        for (let gx = 14 - radius; gx <= 14 + radius; gx++) {
          if (this.isValidUnitTile(gx, gy)) return { gx, gy };
        }
      }
    }
    return null;
  }

  public buyHeldItem(itemId: string): void {
    if (this.phase !== 'PREP' && this.phase !== 'SHOP') {
      this.setStatus('Held items can only be purchased during Prep or Shop.');
      return;
    }
    const item = HELD_ITEMS[itemId];
    if (!item) return;
    if (this.gold < item.cost) {
      this.setStatus(`Need ₽${item.cost} to buy ${item.name}.`);
      return;
    }
    this.gold -= item.cost;
    this.heldItemInventory.push(item.id);
    this.setStatus(`Purchased ${item.name} for ₽${item.cost}.`);
  }

  public equipHeldItem(unitUid: string, itemId: string): void {
    if (this.phase !== 'PREP' && this.phase !== 'SHOP') {
      this.setStatus('Held items can only be equipped during Prep or Shop.');
      return;
    }
    const unit = this.units.find((u) => u.data.uid === unitUid);
    if (!unit || unit.data.heldItems.length >= MAX_HELD_ITEMS) return;
    const invIdx = this.heldItemInventory.indexOf(itemId);
    if (invIdx === -1) return;

    this.heldItemInventory.splice(invIdx, 1);
    unit.data.heldItems.push(itemId);
    this.recalcUnitMaxHp(unit);
    this.setStatus(
      `Equipped ${HELD_ITEMS[itemId]?.name ?? itemId} on ${POKEMON_SPECIES[unit.data.speciesId].name}.`,
    );
  }

  public unequipHeldItem(unitUid: string, index: number): void {
    if (this.phase !== 'PREP' && this.phase !== 'SHOP') {
      this.setStatus('Held items can only be unequipped during Prep or Shop.');
      return;
    }
    const unit = this.units.find((u) => u.data.uid === unitUid);
    if (!unit || index < 0 || index >= unit.data.heldItems.length) return;

    const [removed] = unit.data.heldItems.splice(index, 1);
    this.heldItemInventory.push(removed);
    this.recalcUnitMaxHp(unit);
    this.setStatus(`Unequipped ${HELD_ITEMS[removed]?.name ?? removed}.`);
  }

  public swapReserve(activeUid: string, reserveSpeciesId: string): void {
    if (this.phase !== 'PREP') {
      this.setStatus('Team swaps are only allowed during Prep.');
      return;
    }

    const unit = this.units.find((u) => u.data.uid === activeUid);
    const reserveIdx = this.reserveIds.indexOf(reserveSpeciesId);
    if (!unit || reserveIdx === -1) return;

    const oldSpeciesId = unit.data.speciesId;
    const newSpecies = POKEMON_SPECIES[reserveSpeciesId];
    if (!newSpecies) return;

    this.reserveIds[reserveIdx] = oldSpeciesId;
    unit.data.branchId = null;
    unit.sprite.setScale(1);
    const newMaxHp = this.computeUnitMaxHp(
      reserveSpeciesId,
      null,
      unit.data.heldItems,
    );

    unit.data.speciesId = reserveSpeciesId;
    unit.data.maxHp = newMaxHp;
    unit.data.hp = newMaxHp;
    unit.data.ult = computeStartingUlt(
      newSpecies.ultMax,
      this.getSpeciesPotential(reserveSpeciesId),
    );
    unit.data.ultMax = newSpecies.ultMax;
    unit.data.autoUlt = newSpecies.ultAutoDefault;
    unit.data.fainted = false;
    unit.data.attackCooldownMs = 0;
    unit.data.hitCount = 0;
    unit.isAttackAnimPlaying = false;
    unit.sprite.setAlpha(1);
    unit.sprite.clearTint();
    ensureSpeciesSpritesLoaded(this, reserveSpeciesId, () => {
      if (unit.data.speciesId === reserveSpeciesId && !unit.data.fainted) {
        this.playUnitAnim(unit, 'Idle');
      }
    });
    this.updateUnitBars(unit);

    this.setStatus(
      `Swapped ${POKEMON_SPECIES[oldSpeciesId].name} for ${newSpecies.name}.`,
    );
  }

  public pickReward(rewardId: string): void {
    if (this.phase !== 'REWARD') return;
    const choice = this.rewardChoices.find((r) => r.id === rewardId);
    if (!choice) return;

    if (choice.kind === 'branch' && choice.unitUid) {
      this.pendingBranchUnitUid = choice.unitUid;
      this.rewardChoices = [];
      this.setStatus(`${choice.title}: choose 1 of 3 branches.`);
      return;
    }

    let statusDetail = '';
    if (choice.kind === 'upgrade') {
      this.upgrades.push(choice.id);
      if (choice.id === 'thick_hide') {
        for (const u of this.units) {
          this.recalcUnitMaxHp(u);
        }
      }
    } else if (choice.kind === 'artifact') {
      this.artifacts.push(choice.id);
      if (choice.id === 'fortification_core') {
        for (const s of this.structures) {
          const prevMax = s.data.maxHp;
          s.data.maxHp = this.computeStructureMaxHp(
            STRUCTURE_SPECS[s.data.kind].maxHp,
          );
          if (!s.data.ruined) {
            s.data.hp = Math.min(
              s.data.maxHp,
              s.data.hp + (s.data.maxHp - prevMax),
            );
          }
          this.updateStructureBar(s);
        }
      }
    } else if (choice.kind === 'recruit' && choice.speciesId) {
      const openPos =
        this.units.length < MAX_ACTIVE_UNITS
          ? (PREP_INITIAL_POSITIONS.find((p) =>
              this.isValidUnitTile(p.gx, p.gy),
            ) ?? this.findOpenPrepTile())
          : null;
      if (openPos) {
        this.spawnUnit(choice.speciesId, openPos.gx, openPos.gy);
        statusDetail = ' (auto-deployed)';
      } else if (
        !this.reserveIds.includes(choice.speciesId) &&
        this.reserveIds.length < MAX_RESERVE_UNITS
      ) {
        this.reserveIds.push(choice.speciesId);
      }
      const shardText = this.awardRecruitShards(choice.speciesId);
      statusDetail = `${statusDetail} (${shardText})`;
    }

    this.rewardChoices = [];
    this.advanceAfterReward(`Picked ${choice.title}${statusDetail}.`);
  }

  private awardRecruitShards(speciesId: string): string {
    const shardGain = addShardsToSpecies(
      this.playerSave,
      speciesId,
      RECRUIT_SHARDS,
    );
    persistPlayerSave(this.playerSave);
    const spName = POKEMON_SPECIES[speciesId]?.name ?? speciesId;
    const entry = this.playerSave.pokemon[speciesId];
    const isUnlocked = Boolean(entry?.unlocked);
    const totalShards = entry?.shards ?? 0;
    const unlockCost = getUnlockShardCost(speciesId);
    if (shardGain.universalShardsAdded > 0) {
      return `+${shardGain.universalShardsAdded} Universal Shards`;
    }
    if (!isUnlocked && totalShards >= unlockCost) {
      return `+${shardGain.speciesShardsAdded} ${spName} Shards (${totalShards}/${unlockCost} — Ready to unlock in Pokédex!)`;
    }
    if (!isUnlocked) {
      return `+${shardGain.speciesShardsAdded} ${spName} Shards (${totalShards}/${unlockCost})`;
    }
    return `+${shardGain.speciesShardsAdded} ${spName} Shards`;
  }

  public unlockSpeciesWithShards(speciesId: string): boolean {
    if (!unlockSpeciesWithShardsFromSave(this.playerSave, speciesId)) {
      return false;
    }
    persistPlayerSave(this.playerSave);
    this.sfx.play('ui_click', 0);
    const name = POKEMON_SPECIES[speciesId]?.name ?? speciesId;
    this.setStatus(`Unlocked ${name}!`);
    return true;
  }

  public upgradeSpeciesPotential(speciesId: string): boolean {
    if (!upgradeSpeciesPotentialFromSave(this.playerSave, speciesId)) {
      return false;
    }
    persistPlayerSave(this.playerSave);
    this.sfx.play('ui_click', 0);
    const name = POKEMON_SPECIES[speciesId]?.name ?? speciesId;
    const rank = this.getSpeciesPotential(speciesId);
    this.setStatus(`${name} reached Potential ★${rank}!`);
    return true;
  }

  public hatchEgg(tier: EggTier): EggHatchResult | null {
    const result = hatchEggFromSave(this.playerSave, tier, this.rng);
    if (!result) return null;
    persistPlayerSave(this.playerSave);
    this.sfx.play('ui_click', 0);
    const name = POKEMON_SPECIES[result.speciesId]?.name ?? result.speciesId;
    const detail = result.wasNewUnlock
      ? 'NEW!'
      : result.universalShardsAwarded > 0
        ? `+${result.universalShardsAwarded} Universal Shards`
        : `+${result.shardsAwarded} Shards`;
    this.setStatus(`Hatched ${name} (${detail})`);
    return result;
  }

  public closeShop(): void {
    if (this.phase !== 'SHOP') return;
    this.advanceToNextPrep('Left Merchant Shop.');
  }

  private advanceAfterReward(prefixMsg: string): void {
    if (isShopAfterWave(this.wave, this.maxWaves)) {
      this.phase = 'SHOP';
      this.refreshHighlights();
      this.setStatus(
        `${prefixMsg} Merchant Shop opened after Wave ${this.wave}!`,
      );
      return;
    }
    this.advanceToNextPrep(prefixMsg);
  }

  private advanceToNextPrep(prefixMsg: string): void {
    const prevIds = new Set(this.activePortals.map((p) => p.id));
    this.wave += 1;
    this.phase = 'PREP';
    this.activePortals = rotateWavePortals(
      this.wave,
      this.activePortals,
      this.tiles,
      this.structures.map((s) => s.data),
    );
    this.refreshPortalVisuals();
    this.refreshPathPreview();
    this.refreshHighlights();

    const addedPortal = this.activePortals.find((p) => !prevIds.has(p.id));
    const fadingPortal =
      this.wave >= 4 && this.wave % 2 === 0 ? this.activePortals[0] : undefined;
    const portalHint = addedPortal
      ? ` New ${addedPortal.side} portal opened!`
      : fadingPortal
        ? ` (${fadingPortal.side} portal fades next wave)`
        : '';
    this.setStatus(`${prefixMsg} Prepare for Wave ${this.wave}!${portalHint}`);
  }

  public restartRun(): void {
    this.clearDynamicEntities();
    this.initNewRunState();
  }

  // ---------------------------------------------------------------------------
  // Setup & Rendering
  // ---------------------------------------------------------------------------

  private renderTerrain(): void {
    renderTerrain(this, this.tiles, this.terrainRefs);
  }

  private refreshPortalVisuals(): void {
    const closingPortalId =
      this.wave >= 4 && this.wave % 2 === 0
        ? this.activePortals[0]?.id
        : undefined;
    refreshPortalVisuals(
      this,
      this.activePortals,
      this.portalVisualState,
      closingPortalId,
    );
  }

  private initNewRunState(): void {
    this.phase = 'HOME';
    this.playerSave = loadPlayerSave();
    this.wave = 1;
    this.coreHp = CORE_MAX_HP;
    this.coreMaxHp = CORE_MAX_HP;
    this.coreHitFlashTimerMs = 0;
    this.lastCoreShakeAtMs = 0;
    this.coreSprite?.clearTint();
    this.gold = INITIAL_GOLD;
    this.ap = INITIAL_AP;
    this.maxAp = MAX_AP;
    this.kills = 0;
    this.speedMult = 1;
    this.paused = false;
    this.slowMo = false;
    this.anims.globalTimeScale = 1;
    this.tweens.timeScale = 1;

    this.selectedTool = null;
    this.selectedUnitUid = null;
    this.selectedStructureUid = null;
    this.movingStructureUid = null;
    this.aimingUltUnitUid = null;

    this.artifacts = [];
    this.upgrades = [];
    this.rewardChoices = [];
    this.pendingBranchUnitUid = null;
    this.draftIds = [...STARTER_UNLOCKED_IDS];
    this.reserveIds = [];
    this.heldItemInventory = [];
    this.spawnQueue = [];
    this.spawnQueueIndex = 0;
    this.waveElapsedMs = 0;
    this.berryHealTimerMs = 0;
    for (const u of this.units) {
      u.data.damageDealt = 0;
      u.data.damageTaken = 0;
      u.data.healingDone = 0;
      const startUlt = computeStartingUlt(
        u.data.ultMax,
        this.getSpeciesPotential(u.data.speciesId),
      );
      if (u.data.ult < startUlt) {
        u.data.ult = startUlt;
        this.updateUnitBars(u);
      }
    }

    this.activePortals = [];
    this.updateCoreBar();
    this.refreshPortalVisuals();
    this.refreshPathPreview();
    this.refreshHighlights();
    this.setStatus(
      'Welcome to PokéBastion TD! Press Play to draft your team or open the Pokédex.',
    );
  }

  private clearDynamicEntities(): void {
    for (const u of this.units) {
      this.tweens.killTweensOf(u.sprite);
      u.sprite.destroy();
      u.hpBarBg.destroy();
      u.hpBarFill.destroy();
      u.ultBarFill.destroy();
    }
    this.units = [];

    for (const s of this.structures) {
      s.sprite.destroy();
      s.hpBarBg.destroy();
      s.hpBarFill.destroy();
    }
    this.structures = [];

    for (const e of this.enemies) {
      this.tweens.killTweensOf(e.sprite);
      e.sprite.destroy();
      e.hpBarBg.destroy();
      e.hpBarFill.destroy();
    }
    this.enemies = [];

    for (const v of this.transientVfx) {
      this.tweens.killTweensOf(v);
      if (v.active) v.destroy();
    }
    this.transientVfx = [];

    for (const t of this.floatingTexts) {
      this.tweens.killTweensOf(t);
      if (t.active) t.destroy();
    }
    this.floatingTexts = [];
    this.spawnQueue = [];
    this.spawnQueueIndex = 0;
    this.hoveredUnitUid = null;
    this.hoveredEnemyUid = null;
    this.hoveredStructUid = null;
    this.buildGhostSprite?.setVisible(false);
    this.moveCostBadge?.setVisible(false);
    this.ultCasterRing?.setVisible(false);
    this.hoverReadoutContainer?.setVisible(false);
    this.lastHoverReadoutVisible = false;
    this.game.events.emit('context-inspect', null);
  }

  // ---------------------------------------------------------------------------
  // Input Handling
  // ---------------------------------------------------------------------------

  private updateHoverTargets(x: number, y: number): boolean {
    if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) {
      const changed =
        this.hoverTile !== null ||
        this.hoveredUnitUid !== null ||
        this.hoveredEnemyUid !== null ||
        this.hoveredStructUid !== null;
      this.hoverTile = null;
      this.hoveredUnitUid = null;
      this.hoveredEnemyUid = null;
      this.hoveredStructUid = null;
      return changed;
    }

    const pt = worldToGrid(x, y);
    const tileChanged =
      !this.hoverTile ||
      this.hoverTile.gx !== pt.gx ||
      this.hoverTile.gy !== pt.gy;
    const unit = this.getUnitAt(pt.gx, pt.gy);
    const struct = this.getStructureAt(pt.gx, pt.gy);
    const enemy =
      this.enemies.find(
        (e) => e.hp > 0 && Math.hypot(e.x - x, e.y - y) <= TILE_SIZE * 0.5,
      ) ??
      this.enemies.find((e) => e.hp > 0 && e.gx === pt.gx && e.gy === pt.gy);

    const nextUnitUid = unit?.data.uid ?? null;
    const nextEnemyUid = enemy?.uid ?? null;
    const nextStructUid = struct?.data.uid ?? null;

    const changed =
      tileChanged ||
      this.hoveredUnitUid !== nextUnitUid ||
      this.hoveredEnemyUid !== nextEnemyUid ||
      this.hoveredStructUid !== nextStructUid;

    this.hoverTile = pt;
    this.hoveredUnitUid = nextUnitUid;
    this.hoveredEnemyUid = nextEnemyUid;
    this.hoveredStructUid = nextStructUid;
    return changed;
  }

  private isCameraInputAllowed(): boolean {
    if (this.phase !== 'PREP' && this.phase !== 'COMBAT') return false;
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement
    ) {
      return false;
    }
    if (document.querySelector('#modal-root > *')) return false;
    return true;
  }

  private syncPointerHoverAfterCameraMove(
    forceHighlightRefresh: boolean,
  ): void {
    if (this.lastPointerScreenX < 0 || this.lastPointerScreenY < 0) return;

    const cam = this.cameras.main;
    const camChanged =
      cam.scrollX !== this.lastCamScrollX ||
      cam.scrollY !== this.lastCamScrollY ||
      cam.zoom !== this.lastCamZoom;
    const hasHoveredEntity = Boolean(
      this.hoveredEnemyUid || this.hoveredUnitUid || this.hoveredStructUid,
    );
    if (
      !camChanged &&
      !forceHighlightRefresh &&
      (this.phase !== 'COMBAT' || !hasHoveredEntity)
    ) {
      return;
    }
    this.lastCamScrollX = cam.scrollX;
    this.lastCamScrollY = cam.scrollY;
    this.lastCamZoom = cam.zoom;

    const worldPt = cam.getWorldPoint(
      this.lastPointerScreenX,
      this.lastPointerScreenY,
      this.reprojWorldPoint,
    );
    const prevTile = this.hoverTile ? { ...this.hoverTile } : null;
    const hoverChanged = this.updateHoverTargets(worldPt.x, worldPt.y);

    if (hoverChanged) {
      const tileChanged =
        (prevTile === null) !== (this.hoverTile === null) ||
        (prevTile !== null &&
          this.hoverTile !== null &&
          (prevTile.gx !== this.hoverTile.gx ||
            prevTile.gy !== this.hoverTile.gy));
      if (
        tileChanged &&
        this.phase === 'PREP' &&
        (Boolean(this.getSpeculativeWallPreview()) ||
          this.hadSpeculativeWallPreview)
      ) {
        this.refreshPathPreview();
      }
      this.ultHighlightRefreshTimerMs = 0;
      this.refreshHighlights();
      this.refreshHoverReadout();
    } else if (forceHighlightRefresh) {
      this.refreshHighlights();
      this.refreshHoverReadout();
    } else if (
      this.phase === 'COMBAT' &&
      (this.hoveredEnemyUid || this.hoveredUnitUid || this.hoveredStructUid)
    ) {
      this.refreshHoverReadout();
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const pointerEv = pointer.event as MouseEvent | PointerEvent | undefined;
    if (
      this.canDragCamera &&
      pointer.isDown &&
      !pointer.rightButtonDown() &&
      this.isCameraInputAllowed() &&
      !pointerEv?.ctrlKey &&
      !pointerEv?.metaKey
    ) {
      const dx = pointer.x - this.dragStartX;
      const dy = pointer.y - this.dragStartY;
      if (!this.isDraggingCamera && Math.hypot(dx, dy) > 6) {
        this.isDraggingCamera = true;
      }
      if (this.isDraggingCamera) {
        const cam = this.cameras.main;
        cam.scrollX = this.dragStartScrollX - dx / cam.zoom;
        cam.scrollY = this.dragStartScrollY - dy / cam.zoom;
        return;
      }
    }

    this.lastPointerScreenX = pointer.x;
    this.lastPointerScreenY = pointer.y;

    const wx = pointer.worldX;
    const wy = pointer.worldY;
    const prevTile = this.hoverTile ? { ...this.hoverTile } : null;

    const changed = this.updateHoverTargets(wx, wy);
    if (!changed) return;

    const tileChanged =
      (prevTile === null) !== (this.hoverTile === null) ||
      (prevTile !== null &&
        this.hoverTile !== null &&
        (prevTile.gx !== this.hoverTile.gx ||
          prevTile.gy !== this.hoverTile.gy));

    if (
      tileChanged &&
      this.phase === 'PREP' &&
      (Boolean(this.getSpeculativeWallPreview()) ||
        this.hadSpeculativeWallPreview)
    ) {
      this.refreshPathPreview();
    }
    this.ultHighlightRefreshTimerMs = 0;
    this.refreshHighlights();
    this.refreshHoverReadout();
  }

  private getTileScreenPosition(
    gx: number,
    gy: number,
  ): { screenX: number; screenY: number } {
    const cam = this.cameras.main;
    const rect = this.game.canvas.getBoundingClientRect();
    const wx = tileCenterX(gx);
    const wy = tileCenterY(gy);
    const scaleX = rect.width / Math.max(1, cam.width);
    const scaleY = rect.height / Math.max(1, cam.height);
    return {
      screenX: rect.left + (wx - cam.worldView.x) * cam.zoom * scaleX,
      screenY: rect.top + (wy - cam.worldView.y) * cam.zoom * scaleY,
    };
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown()) {
      if (this.aimingUltUnitUid !== null) {
        this.cancelActiveSelections();
        this.game.events.emit('context-inspect', null);
        return;
      }
      if (this.phase === 'PREP' || this.phase === 'COMBAT') {
        const wx = pointer.worldX;
        const wy = pointer.worldY;
        if (wx >= 0 && wx < CANVAS_WIDTH && wy >= 0 && wy < CANVAS_HEIGHT) {
          const { gx, gy } = worldToGrid(wx, wy);
          const clickedStructure = this.getStructureAt(gx, gy);
          const clickedUnit = this.getUnitAt(gx, gy);
          if (clickedStructure) {
            this.selectedTool = null;
            this.movingStructureUid = null;
            this.selectedUnitUid = null;
            this.selectedStructureUid = clickedStructure.data.uid;
            this.refreshPathPreview();
            this.refreshHighlights();
            this.emitSnapshot();
            this.game.events.emit('context-inspect', {
              kind: 'structure',
              uid: clickedStructure.data.uid,
              ...this.getTileScreenPosition(
                clickedStructure.data.gx,
                clickedStructure.data.gy,
              ),
            });
            return;
          } else if (clickedUnit) {
            this.selectedTool = null;
            this.movingStructureUid = null;
            this.selectUnit(clickedUnit.data.uid);
            this.game.events.emit('context-inspect', {
              kind: 'unit',
              uid: clickedUnit.data.uid,
              ...this.getTileScreenPosition(
                clickedUnit.data.gx,
                clickedUnit.data.gy,
              ),
            });
            return;
          }
        }
      }
      this.cancelActiveSelections();
      this.game.events.emit('context-inspect', null);
      return;
    }

    const pointerEv = pointer.event as MouseEvent | PointerEvent | undefined;
    this.isDraggingCamera = false;
    this.canDragCamera =
      this.isCameraInputAllowed() && !pointerEv?.ctrlKey && !pointerEv?.metaKey;
    if (!this.canDragCamera) return;

    const cam = this.cameras.main;
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.dragStartScrollX = cam.scrollX;
    this.dragStartScrollY = cam.scrollY;
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    const wasDragging = this.isDraggingCamera;
    this.isDraggingCamera = false;
    this.canDragCamera = false;
    if (wasDragging || pointer.rightButtonReleased()) return;

    const wx = pointer.worldX;
    const wy = pointer.worldY;
    if (wx < 0 || wx >= CANVAS_WIDTH || wy < 0 || wy >= CANVAS_HEIGHT) {
      return;
    }

    if (this.phase !== 'PREP' && this.phase !== 'COMBAT') return;

    this.game.events.emit('context-inspect', null);

    const { gx, gy } = worldToGrid(wx, wy);

    if (this.aimingUltUnitUid) {
      this.executeAimedUlt(gx, gy);
      return;
    }

    if (this.phase === 'PREP') {
      const pointerEv = pointer.event as MouseEvent | PointerEvent | undefined;
      this.handlePrepClick(gx, gy, Boolean(pointerEv?.shiftKey));
    } else {
      this.handleCombatClick(gx, gy);
    }
  }

  private cancelActiveSelections(): void {
    this.cancelAction();
  }

  private handlePrepClick(gx: number, gy: number, shiftHeld = false): void {
    const clickedStructure = this.getStructureAt(gx, gy);
    const clickedUnit = this.getUnitAt(gx, gy);

    if (this.selectedTool === 'sell_struct') {
      if (clickedStructure) {
        this.sellStructure(clickedStructure);
      }
      return;
    }

    if (this.selectedTool !== null) {
      if (clickedUnit && !shiftHeld) {
        this.selectUnit(clickedUnit.data.uid);
        return;
      }
      this.tryPlaceStructure(this.selectedTool, gx, gy);
      return;
    }

    // No tool selected: active structure move, unit selection/repositioning, or direct click-to-move structure
    if (this.movingStructureUid) {
      this.handleMoveStructureClick(gx, gy, clickedStructure, clickedUnit);
      return;
    }

    if (clickedUnit) {
      if (this.selectedUnitUid === clickedUnit.data.uid) {
        this.selectUnit(null);
      } else if (this.selectedUnitUid) {
        const selected = this.units.find(
          (u) => u.data.uid === this.selectedUnitUid,
        );
        if (selected) {
          this.swapUnitPositions(selected, clickedUnit);
          return;
        }
        this.selectUnit(clickedUnit.data.uid);
      } else {
        this.selectUnit(clickedUnit.data.uid);
        this.setStatus(
          `Selected ${POKEMON_SPECIES[clickedUnit.data.speciesId].name}. Click an empty tile to move or another Pokémon to swap (0 AP in Prep).`,
        );
      }
      return;
    }

    if (
      this.selectedUnitUid &&
      !clickedStructure &&
      this.isValidUnitTile(gx, gy)
    ) {
      const unit = this.units.find((u) => u.data.uid === this.selectedUnitUid);
      if (unit) {
        this.moveUnitToTile(unit, gx, gy, false);
        this.refreshHighlights();
        this.emitSnapshot();
        return;
      }
    }

    if (clickedStructure) {
      this.movingStructureUid = clickedStructure.data.uid;
      this.selectedStructureUid = clickedStructure.data.uid;
      this.selectedUnitUid = null;
      this.refreshPathPreview();
      this.refreshHighlights();
      this.refreshHoverReadout();
      this.setStatus(
        `Moving ${STRUCTURE_SPECS[clickedStructure.data.kind].name}. Click an empty tile (Esc / Right-Click to cancel).`,
      );
      return;
    }

    this.selectedUnitUid = null;
    this.selectedStructureUid = null;
    this.refreshHighlights();
    this.emitSnapshot();
  }

  private handleMoveStructureClick(
    gx: number,
    gy: number,
    clickedStructure: StructureEntity | undefined,
    clickedUnit: UnitEntity | undefined,
  ): void {
    if (!this.movingStructureUid) {
      if (clickedStructure) {
        this.movingStructureUid = clickedStructure.data.uid;
        this.refreshPathPreview();
        this.refreshHighlights();
        this.refreshHoverReadout();
        this.setStatus(
          `Moving ${STRUCTURE_SPECS[clickedStructure.data.kind].name}. Click a valid empty tile.`,
        );
      }
      return;
    }

    const moving = this.structures.find(
      (s) => s.data.uid === this.movingStructureUid,
    );
    if (!moving) {
      this.movingStructureUid = null;
      this.refreshHighlights();
      return;
    }

    if (clickedUnit) {
      this.movingStructureUid = null;
      this.selectUnit(clickedUnit.data.uid);
      return;
    }

    if (clickedStructure) {
      if (clickedStructure.data.uid === moving.data.uid) {
        this.movingStructureUid = null;
        this.setStatus(`Selected ${STRUCTURE_SPECS[moving.data.kind].name}.`);
      } else {
        this.movingStructureUid = clickedStructure.data.uid;
        this.selectedStructureUid = clickedStructure.data.uid;
        this.setStatus(
          `Moving ${STRUCTURE_SPECS[clickedStructure.data.kind].name}. Click an empty tile (Esc / Right-Click to cancel).`,
        );
      }
      this.refreshPathPreview();
      this.refreshHighlights();
      this.refreshHoverReadout();
      this.emitSnapshot();
      return;
    }

    if (isNoBuildTile(gx, gy, this.tiles, this.activePortals)) {
      this.setStatus('Cannot move structure to that tile.');
      return;
    }

    moving.data.gx = gx;
    moving.data.gy = gy;
    const cx = tileCenterX(gx);
    const cy = tileCenterY(gy);
    moving.sprite.setPosition(cx, cy).setDepth(4 + gy * 0.1);
    moving.hpBarBg.setPosition(cx, cy + 20);
    moving.hpBarFill.setPosition(cx - 17, cy + 20);

    this.movingStructureUid = null;
    this.selectedStructureUid = moving.data.uid;
    this.refreshPathPreview();
    this.refreshHighlights();
    this.refreshHoverReadout();
    this.setStatus(`Moved ${STRUCTURE_SPECS[moving.data.kind].name}.`);
  }

  private handleCombatClick(gx: number, gy: number): void {
    const clickedUnit = this.getUnitAt(gx, gy);
    const clickedStructure = this.getStructureAt(gx, gy);

    if (clickedUnit && !clickedUnit.data.fainted) {
      if (this.selectedUnitUid === clickedUnit.data.uid) {
        this.selectUnit(null);
      } else {
        this.selectUnit(clickedUnit.data.uid);
      }
      return;
    }

    if (this.selectedUnitUid) {
      const unit = this.units.find((u) => u.data.uid === this.selectedUnitUid);
      if (unit && !unit.data.fainted) {
        if (unit.moveTarget?.gx === gx && unit.moveTarget?.gy === gy) {
          this.selectUnit(null);
          return;
        }
        const isDifferentTile = unit.data.gx !== gx || unit.data.gy !== gy;
        const apCost = 1;

        if (isDifferentTile && this.isValidUnitTile(gx, gy)) {
          const path = findUnitPath(
            { gx: unit.data.gx, gy: unit.data.gy },
            { gx, gy },
            this.tiles,
            this.getBlockedStructureKeys(),
          );
          if (!path || path.length < 2) {
            this.setStatus('No path to that tile.');
            return;
          }
          if (this.ap < apCost) {
            this.setStatus(`Need ${apCost} AP to move there.`);
            return;
          }
          this.ap -= apCost;
          unit.movePath = path.slice(1);
          unit.moveTarget = { gx, gy };
          unit.stationaryMs = 0;
          this.playUnitAnim(unit, 'Walk');
          this.selectedUnitUid = null;
          this.slowMo = false;
          this.refreshHighlights();
          this.setStatus(
            `${POKEMON_SPECIES[unit.data.speciesId].name} moving (-${apCost} AP).`,
          );
          return;
        }
      }
      this.selectUnit(null);
      return;
    }

    if (clickedStructure) {
      this.selectedStructureUid = clickedStructure.data.uid;
      this.refreshHighlights();
      this.emitSnapshot();
      return;
    }

    this.selectedStructureUid = null;
    this.refreshHighlights();
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Structures & Path Preview
  // ---------------------------------------------------------------------------

  private tryPlaceStructure(kind: StructureKind, gx: number, gy: number): void {
    const spec = STRUCTURE_SPECS[kind];
    if (isNoBuildTile(gx, gy, this.tiles, this.activePortals)) {
      this.setStatus(
        'Cannot build on spawn lanes, water moats, or the Bastion Core.',
      );
      return;
    }
    if (this.getStructureAt(gx, gy) || this.getUnitAt(gx, gy)) {
      this.setStatus('Tile is already occupied.');
      return;
    }
    if (this.gold < spec.cost) {
      this.setStatus(`Need ₽${spec.cost} to build ${spec.name}.`);
      return;
    }

    this.gold -= spec.cost;
    const maxHp = this.computeStructureMaxHp(spec.maxHp);
    const data: GridStructure = {
      uid: `struct_${this.nextUidCounter++}`,
      kind,
      gx,
      gy,
      hp: maxHp,
      maxHp,
      ruined: false,
    };

    const cx = tileCenterX(gx);
    const cy = tileCenterY(gy);
    const sprite = this.add
      .image(cx, cy, `tex:${kind}`)
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setDepth(4 + gy * 0.1);
    const hpBarBg = this.add
      .rectangle(cx, cy + 20, 36, 4, 0x0f172a, 0.85)
      .setDepth(7);
    const hpBarFill = this.add
      .rectangle(cx - 17, cy + 20, 34, 2, 0x38bdf8, 1)
      .setOrigin(0, 0.5)
      .setDepth(7);

    const entity: StructureEntity = { data, sprite, hpBarBg, hpBarFill };
    this.structures.push(entity);
    this.updateStructureBar(entity);
    this.refreshPathPreview();
    this.refreshHighlights();
    this.sfx.play('build', 60);
    this.setStatus(`Built ${spec.name} (-₽${spec.cost}).`);
  }

  private sellStructure(entity: StructureEntity): void {
    const spec = STRUCTURE_SPECS[entity.data.kind];
    const refund = getSellRefund(entity.data.kind);
    this.gold += refund;
    this.removeStructureEntity(entity);
    this.refreshPathPreview();
    this.refreshHighlights();
    this.refreshHoverReadout();
    this.sfx.play('coin', 40);
    this.setStatus(`Sold ${spec.name} (+₽${refund}).`);
  }

  private removeStructureEntity(entity: StructureEntity): void {
    entity.sprite.destroy();
    entity.hpBarBg.destroy();
    entity.hpBarFill.destroy();
    this.structures = this.structures.filter(
      (s) => s.data.uid !== entity.data.uid,
    );
    if (this.selectedStructureUid === entity.data.uid) {
      this.selectedStructureUid = null;
    }
    if (this.movingStructureUid === entity.data.uid) {
      this.movingStructureUid = null;
    }
  }

  private isValidBuildTile(gx: number, gy: number): boolean {
    return (
      !isNoBuildTile(gx, gy, this.tiles, this.activePortals) &&
      !this.getStructureAt(gx, gy) &&
      !this.getUnitAt(gx, gy)
    );
  }

  private getSpeculativeWallPreview(): {
    addKey: string;
    removeKey: string | null;
    addStruct: GridStructure;
    removeUid: string | null;
  } | null {
    if (this.phase !== 'PREP' || !this.hoverTile) return null;
    const { gx, gy } = this.hoverTile;
    if (!this.isValidBuildTile(gx, gy)) return null;

    if (
      this.selectedTool === 'wood_wall' ||
      this.selectedTool === 'stone_wall'
    ) {
      return {
        addKey: keyOf(gx, gy),
        removeKey: null,
        addStruct: {
          uid: '__preview__',
          kind: this.selectedTool,
          gx,
          gy,
          hp: 100,
          maxHp: 100,
          ruined: false,
        },
        removeUid: null,
      };
    }

    if (this.selectedTool === null && this.movingStructureUid) {
      const moving = this.structures.find(
        (s) => s.data.uid === this.movingStructureUid,
      );
      if (
        moving &&
        !moving.data.ruined &&
        moving.data.hp > 0 &&
        STRUCTURE_SPECS[moving.data.kind].blocksGround
      ) {
        return {
          addKey: keyOf(gx, gy),
          removeKey: keyOf(moving.data.gx, moving.data.gy),
          addStruct: { ...moving.data, gx, gy },
          removeUid: moving.data.uid,
        };
      }
    }

    return null;
  }

  private getBlockedWallKeys(includeSpeculativeHover = false): Set<string> {
    const blocked = new Set<string>();
    for (const s of this.structures) {
      if (
        !s.data.ruined &&
        s.data.hp > 0 &&
        STRUCTURE_SPECS[s.data.kind].blocksGround
      ) {
        blocked.add(keyOf(s.data.gx, s.data.gy));
      }
    }
    if (includeSpeculativeHover) {
      const specPreview = this.getSpeculativeWallPreview();
      if (specPreview) {
        if (specPreview.removeKey) blocked.delete(specPreview.removeKey);
        blocked.add(specPreview.addKey);
      }
    }
    return blocked;
  }

  private refreshPathPreview(): void {
    this.cachedDashSegments = [];
    this.pathPreviewStaticGraphics.clear();
    if (this.phase !== 'PREP') {
      this.hadSpeculativeWallPreview = false;
      this.pathPreviewGraphics.clear();
      return;
    }

    const previewPaths: Array<{ points: GridPoint[]; color: number }> = [];
    const blockingWalls: GridPoint[] = [];

    const specPreview = this.getSpeculativeWallPreview();
    this.hadSpeculativeWallPreview = Boolean(specPreview);
    const blockedWalls = this.getBlockedWallKeys(true);
    const previewStructures = specPreview
      ? [
          ...this.structures
            .filter((s) => s.data.uid !== specPreview.removeUid)
            .map((s) => s.data),
          specPreview.addStruct,
        ]
      : this.structures.map((s) => s.data);

    for (const portal of this.activePortals) {
      for (const start of portal.cells) {
        const openPath = findPath(start, this.tiles, blockedWalls, 'ground');
        if (openPath && openPath.length > 1) {
          previewPaths.push({ points: openPath, color: 0xffffff });
          continue;
        }

        const blockingWall = findNearestBlockingWall(
          start,
          this.tiles,
          previewStructures,
        );
        if (blockingWall) {
          const toWall = this.findPathToTile(
            start,
            { gx: blockingWall.gx, gy: blockingWall.gy },
            blockedWalls,
          );
          if (toWall.length > 1) {
            previewPaths.push({ points: toWall, color: 0xf97316 });
          }
          blockingWalls.push({
            gx: blockingWall.gx,
            gy: blockingWall.gy,
          });
        }
      }
    }

    const drawnSegments = new Set<string>();
    const drawnArrows = new Set<string>();

    for (const { points, color } of previewPaths) {
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const segKey = `${p0.gx},${p0.gy}->${p1.gx},${p1.gy}`;
        if (drawnSegments.has(segKey)) continue;
        drawnSegments.add(segKey);

        const x1 = tileCenterX(p0.gx);
        const y1 = tileCenterY(p0.gy);
        const dist = Math.hypot(
          tileCenterX(p1.gx) - x1,
          tileCenterY(p1.gy) - y1,
        );
        if (dist <= 0) continue;

        this.cachedDashSegments.push({
          color,
          x1,
          y1,
          ux: (tileCenterX(p1.gx) - x1) / dist,
          uy: (tileCenterY(p1.gy) - y1) / dist,
          dist,
        });
      }

      // Directional arrowheads at portal exit & every 3 tiles along the route
      for (let i = 0; i < points.length - 1; i += 3) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const arrowKey = `${p0.gx},${p0.gy}->${p1.gx},${p1.gy}`;
        if (drawnArrows.has(arrowKey)) continue;
        drawnArrows.add(arrowKey);

        const mx = (tileCenterX(p0.gx) + tileCenterX(p1.gx)) / 2;
        const my = (tileCenterY(p0.gy) + tileCenterY(p1.gy)) / 2;
        const rawDx = p1.gx - p0.gx;
        const rawDy = p1.gy - p0.gy;
        const len = Math.hypot(rawDx, rawDy) || 1;
        const dx = rawDx / len;
        const dy = rawDy / len;
        const px = -dy;
        const py = dx;
        this.pathPreviewStaticGraphics.lineStyle(4, 0x0f172a, 0.85);
        this.pathPreviewStaticGraphics.lineBetween(
          mx - dx * 4 + px * 4,
          my - dy * 4 + py * 4,
          mx + dx * 3,
          my + dy * 3,
        );
        this.pathPreviewStaticGraphics.lineBetween(
          mx - dx * 4 - px * 4,
          my - dy * 4 - py * 4,
          mx + dx * 3,
          my + dy * 3,
        );
        this.pathPreviewStaticGraphics.lineStyle(2, color, 1);
        this.pathPreviewStaticGraphics.lineBetween(
          mx - dx * 4 + px * 4,
          my - dy * 4 + py * 4,
          mx + dx * 3,
          my + dy * 3,
        );
        this.pathPreviewStaticGraphics.lineBetween(
          mx - dx * 4 - px * 4,
          my - dy * 4 - py * 4,
          mx + dx * 3,
          my + dy * 3,
        );
      }
    }

    for (const bw of blockingWalls) {
      this.pathPreviewStaticGraphics.lineStyle(2.5, 0xef4444, 0.95);
      this.pathPreviewStaticGraphics.strokeRect(
        bw.gx * TILE_SIZE + 4,
        bw.gy * TILE_SIZE + 4,
        TILE_SIZE - 8,
        TILE_SIZE - 8,
      );
    }

    this.pathDashTickMs = 0;
    this.renderPreviewDashes();
  }

  private renderPreviewDashes(): void {
    this.pathPreviewGraphics.clear();
    if (this.phase !== 'PREP' || this.cachedDashSegments.length === 0) return;

    const dashLen = 8;
    const period = 14;
    const startOffset = -period + (this.pathDashOffset % period);

    const drawPass = (
      width: number,
      fixedColor: number | null,
      alpha: number,
    ) => {
      let lastColor = -1;
      if (fixedColor !== null) {
        this.pathPreviewGraphics.lineStyle(width, fixedColor, alpha);
      }
      for (const seg of this.cachedDashSegments) {
        if (fixedColor === null && seg.color !== lastColor) {
          lastColor = seg.color;
          this.pathPreviewGraphics.lineStyle(width, seg.color, alpha);
        }
        let d = startOffset;
        while (d < seg.dist) {
          const startD = Math.max(0, d);
          const endD = Math.min(d + dashLen, seg.dist);
          if (endD > startD) {
            this.pathPreviewGraphics.lineBetween(
              seg.x1 + seg.ux * startD,
              seg.y1 + seg.uy * startD,
              seg.x1 + seg.ux * endD,
              seg.y1 + seg.uy * endD,
            );
          }
          d += period;
        }
      }
    };

    // Dark outline first for crisp contrast over grass & sand
    drawPass(5, 0x0f172a, 0.75);
    drawPass(2.5, null, 0.95);
  }

  /**
   * 4-dir BFS from `start` to `target` avoiding water and intact walls (except `target` itself).
   */
  private findPathToTile(
    start: GridPoint,
    target: GridPoint,
    baseBlockedWalls?: Set<string>,
  ): GridPoint[] {
    if (start.gx === target.gx && start.gy === target.gy) return [start];

    const blockedWalls = new Set(baseBlockedWalls ?? this.getBlockedWallKeys());
    blockedWalls.delete(keyOf(target.gx, target.gy));

    const queue: GridPoint[] = [start];
    const cameFrom = new Map<string, GridPoint | null>();
    cameFrom.set(keyOf(start.gx, start.gy), null);
    const dirs: GridPoint[] = [
      { gx: 1, gy: 0 },
      { gx: -1, gy: 0 },
      { gx: 0, gy: 1 },
      { gx: 0, gy: -1 },
    ];

    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      if (cur.gx === target.gx && cur.gy === target.gy) {
        const path: GridPoint[] = [];
        let node: GridPoint | null | undefined = cur;
        while (node) {
          path.push(node);
          node = cameFrom.get(keyOf(node.gx, node.gy));
        }
        path.reverse();
        return path;
      }

      for (const d of dirs) {
        const nx = cur.gx + d.gx;
        const ny = cur.gy + d.gy;
        if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
        if (this.tiles[ny][nx] === 'water') continue;
        const k = keyOf(nx, ny);
        if (cameFrom.has(k) || blockedWalls.has(k)) continue;
        cameFrom.set(k, cur);
        queue.push({ gx: nx, gy: ny });
      }
    }

    return [start, target];
  }

  // ---------------------------------------------------------------------------
  // Highlights
  // ---------------------------------------------------------------------------

  private drawDashedCircle(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number,
    primaryColor: number,
    secondaryColor: number | null,
    alpha: number,
    lineWidth = 2,
    dashLen = 8,
    gapLen = 5,
  ): void {
    if (radius <= 0) return;
    const circumference = 2 * Math.PI * radius;
    const stepLen = dashLen + gapLen;
    const numDashes = Math.max(8, Math.round(circumference / stepLen));
    const stepAngle = (2 * Math.PI) / numDashes;
    const dashAngle = stepAngle * (dashLen / stepLen);

    for (let i = 0; i < numDashes; i++) {
      const startAngle = i * stepAngle;
      const color =
        secondaryColor !== null && i % 2 === 1 ? secondaryColor : primaryColor;
      g.lineStyle(lineWidth, color, alpha);
      g.beginPath();
      g.arc(cx, cy, radius, startAngle, startAngle + dashAngle);
      g.strokePath();
    }
  }

  private drawAttackRangePerimeter(
    gx: number,
    gy: number,
    range: number,
    alpha: number,
    lineWidth: number,
  ): void {
    const cx = tileCenterX(gx);
    const cy = tileCenterY(gy);
    const radius = (range + 0.5) * TILE_SIZE - 1;
    this.drawDashedCircle(
      this.highlightGraphics,
      cx,
      cy,
      radius,
      0xfb7185,
      0xffffff,
      alpha,
      lineWidth,
      8,
      5,
    );
  }

  private drawNonPlaceableTile(gx: number, gy: number): void {
    const x = gx * TILE_SIZE + 2;
    const y = gy * TILE_SIZE + 2;
    const size = TILE_SIZE - 4;
    const pad = 7;
    this.highlightGraphics.fillStyle(0x0f172a, 0.36);
    this.highlightGraphics.fillRect(x, y, size, size);
    this.highlightGraphics.lineStyle(1.4, 0x94a3b8, 0.35);
    this.highlightGraphics.lineBetween(
      gx * TILE_SIZE + pad,
      gy * TILE_SIZE + pad,
      (gx + 1) * TILE_SIZE - pad,
      (gy + 1) * TILE_SIZE - pad,
    );
    this.highlightGraphics.lineBetween(
      (gx + 1) * TILE_SIZE - pad,
      gy * TILE_SIZE + pad,
      gx * TILE_SIZE + pad,
      (gy + 1) * TILE_SIZE - pad,
    );
  }

  private drawTargetReticle(cx: number, cy: number, color: number): void {
    const r = 18;
    const arm = 6;
    this.highlightGraphics.lineStyle(2, color, 0.95);
    this.highlightGraphics.strokeCircle(cx, cy, r);
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const px = cx + sx * (r + 3);
      const py = cy + sy * (r + 3);
      this.highlightGraphics.lineBetween(px, py, px - sx * arm, py);
      this.highlightGraphics.lineBetween(px, py, px, py - sy * arm);
    }
  }

  private drawStructureAuraPreview(
    kind: StructureKind,
    gx: number,
    gy: number,
  ): void {
    if (kind === 'berry_bush') {
      const zx = (gx - 1) * TILE_SIZE;
      const zy = (gy - 1) * TILE_SIZE;
      const size = 3 * TILE_SIZE;
      this.highlightGraphics.fillStyle(0x4ade80, 0.14);
      this.highlightGraphics.fillRect(zx, zy, size, size);
      this.highlightGraphics.lineStyle(1.5, 0x4ade80, 0.6);
      this.highlightGraphics.strokeRect(zx + 1, zy + 1, size - 2, size - 2);
    } else if (kind === 'barrel') {
      const cx = tileCenterX(gx);
      const cy = tileCenterY(gy);
      const radiusPx = BARREL_RADIUS * TILE_SIZE;
      this.highlightGraphics.fillStyle(0xf97316, 0.16);
      this.highlightGraphics.fillCircle(cx, cy, radiusPx);
      this.highlightGraphics.lineStyle(1.8, 0xf97316, 0.78);
      this.highlightGraphics.strokeCircle(cx, cy, radiusPx);
    }
  }

  private refreshHighlights(): void {
    this.highlightGraphics.clear();
    this.buildGhostSprite.setVisible(false);
    this.moveCostBadge.setVisible(false);

    // Selected structure outline
    if (this.selectedStructureUid) {
      const s = this.structures.find(
        (st) => st.data.uid === this.selectedStructureUid,
      );
      if (s) {
        this.highlightGraphics.lineStyle(2, 0xfbbf24, 0.95);
        this.highlightGraphics.strokeRect(
          s.data.gx * TILE_SIZE + 2,
          s.data.gy * TILE_SIZE + 2,
          TILE_SIZE - 4,
          TILE_SIZE - 4,
        );
      }
    }

    // Moving structure highlight
    if (this.movingStructureUid) {
      const s = this.structures.find(
        (st) => st.data.uid === this.movingStructureUid,
      );
      if (s) {
        this.highlightGraphics.fillStyle(0xfbbf24, 0.25);
        this.highlightGraphics.fillRect(
          s.data.gx * TILE_SIZE + 2,
          s.data.gy * TILE_SIZE + 2,
          TILE_SIZE - 4,
          TILE_SIZE - 4,
        );
      }
    }

    // Unit movement rings + selected unit Chebyshev attack range
    const selectedUnit = this.selectedUnitUid
      ? this.units.find((u) => u.data.uid === this.selectedUnitUid)
      : undefined;

    if (selectedUnit && !selectedUnit.data.fainted) {
      this.highlightGraphics.lineStyle(2, 0x22d3ee, 1);
      this.highlightGraphics.strokeRect(
        selectedUnit.data.gx * TILE_SIZE + 2,
        selectedUnit.data.gy * TILE_SIZE + 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4,
      );

      for (let gy = 0; gy < GRID_ROWS; gy++) {
        for (let gx = 0; gx < GRID_COLS; gx++) {
          if (gx === selectedUnit.data.gx && gy === selectedUnit.data.gy) {
            continue;
          }
          if (!this.isValidUnitTile(gx, gy)) {
            this.drawNonPlaceableTile(gx, gy);
            continue;
          }

          this.highlightGraphics.fillStyle(0x22d3ee, 0.12);
          this.highlightGraphics.fillRect(
            gx * TILE_SIZE + 2,
            gy * TILE_SIZE + 2,
            TILE_SIZE - 4,
            TILE_SIZE - 4,
          );
        }
      }

      const selectedSpec = POKEMON_SPECIES[selectedUnit.data.speciesId];
      if (selectedSpec) {
        this.drawAttackRangePerimeter(
          selectedUnit.data.gx,
          selectedUnit.data.gy,
          this.getUnitRange(selectedUnit),
          0.95,
          2.2,
        );
      }

      // Projected attack range + AP badge when hovering a valid movement destination
      if (
        this.hoverTile &&
        this.selectedTool === null &&
        !this.aimingUltUnitUid
      ) {
        const { gx: hx, gy: hy } = this.hoverTile;
        const isValidDest =
          (hx !== selectedUnit.data.gx || hy !== selectedUnit.data.gy) &&
          this.isValidUnitTile(hx, hy);

        if (isValidDest) {
          const apCost = this.phase === 'PREP' ? 0 : 1;
          const affordable = this.phase === 'PREP' || this.ap >= apCost;

          this.highlightGraphics.lineStyle(
            2,
            affordable ? 0x67e8f9 : 0xef4444,
            0.9,
          );
          this.highlightGraphics.strokeRect(
            hx * TILE_SIZE + 3,
            hy * TILE_SIZE + 3,
            TILE_SIZE - 6,
            TILE_SIZE - 6,
          );

          if (selectedSpec && selectedUnit) {
            this.drawAttackRangePerimeter(
              hx,
              hy,
              this.getUnitRange(selectedUnit),
              affordable ? 0.65 : 0.35,
              1.6,
            );
          }

          const badgeColor = !affordable
            ? '#fca5a5'
            : apCost === 0
              ? '#67e8f9'
              : apCost === 1
                ? '#22d3ee'
                : '#fbbf24';
          const bx = Phaser.Math.Clamp(
            hx * TILE_SIZE + TILE_SIZE - 4,
            4,
            CANVAS_WIDTH - 42,
          );
          const by = Phaser.Math.Clamp(
            hy * TILE_SIZE - 6,
            4,
            CANVAS_HEIGHT - 22,
          );
          this.moveCostBadge
            .setText(`${apCost} AP`)
            .setColor(badgeColor)
            .setPosition(bx, by)
            .setVisible(true);
        }
      }
    }

    // Hovered unit Chebyshev attack range perimeter
    if (
      this.hoveredUnitUid &&
      !this.aimingUltUnitUid &&
      this.hoveredUnitUid !== this.selectedUnitUid
    ) {
      const hoveredUnit = this.units.find(
        (u) => u.data.uid === this.hoveredUnitUid,
      );
      if (hoveredUnit) {
        const spec = POKEMON_SPECIES[hoveredUnit.data.speciesId];
        if (spec) {
          this.drawAttackRangePerimeter(
            hoveredUnit.data.gx,
            hoveredUnit.data.gy,
            this.getUnitRange(hoveredUnit),
            0.8,
            1.8,
          );
        }
      }
    }

    // Non-placeable tile overlay (grayed + light X) when placing or moving a structure
    const isPlacingStruct =
      this.phase === 'PREP' &&
      ((this.selectedTool !== null && this.selectedTool !== 'sell_struct') ||
        (this.selectedTool === null && Boolean(this.movingStructureUid)));
    if (isPlacingStruct) {
      for (let gy = 0; gy < GRID_ROWS; gy++) {
        for (let gx = 0; gx < GRID_COLS; gx++) {
          if (!this.isValidBuildTile(gx, gy)) {
            this.drawNonPlaceableTile(gx, gy);
          }
        }
      }
    }

    // Ultimate aiming circle preview + target reticles
    if (this.aimingUltUnitUid && this.hoverTile) {
      const cx = tileCenterX(this.hoverTile.gx);
      const cy = tileCenterY(this.hoverTile.gy);
      const radiusPx = ULT_RADIUS * TILE_SIZE;
      this.highlightGraphics.fillStyle(0xfbbf24, 0.22);
      this.highlightGraphics.fillCircle(cx, cy, radiusPx);
      this.highlightGraphics.lineStyle(2, 0xfbbf24, 0.9);
      this.highlightGraphics.strokeCircle(cx, cy, radiusPx);

      const caster = this.units.find(
        (u) => u.data.uid === this.aimingUltUnitUid,
      );
      const isHealUlt =
        caster !== undefined && isHealUltSpecies(caster.data.speciesId);

      if (isHealUlt) {
        for (const ally of this.units) {
          if (ally.data.fainted) continue;
          if (
            Math.hypot(
              ally.data.gx - this.hoverTile.gx,
              ally.data.gy - this.hoverTile.gy,
            ) <= ULT_RADIUS
          ) {
            this.drawTargetReticle(ally.sprite.x, ally.sprite.y, 0x4ade80);
          }
        }
      } else {
        for (const enemy of this.enemies) {
          if (enemy.hp <= 0) continue;
          if (
            Math.hypot(
              enemy.gx - this.hoverTile.gx,
              enemy.gy - this.hoverTile.gy,
            ) <= ULT_RADIUS
          ) {
            this.drawTargetReticle(enemy.x, enemy.y, 0xfde047);
          }
        }
      }
    } else if (
      this.hoverTile &&
      this.phase === 'PREP' &&
      (this.selectedTool !== null || this.movingStructureUid !== null)
    ) {
      const { gx, gy } = this.hoverTile;
      if (this.selectedTool === 'sell_struct') {
        const hoveredStruct = this.getStructureAt(gx, gy);
        if (hoveredStruct) {
          this.highlightGraphics.fillStyle(0xef4444, 0.24);
          this.highlightGraphics.fillRect(
            gx * TILE_SIZE + 2,
            gy * TILE_SIZE + 2,
            TILE_SIZE - 4,
            TILE_SIZE - 4,
          );
          this.highlightGraphics.lineStyle(2.5, 0xf59e0b, 0.95);
        } else {
          this.highlightGraphics.lineStyle(1.5, 0x64748b, 0.55);
        }
        this.highlightGraphics.strokeRect(
          gx * TILE_SIZE + 2,
          gy * TILE_SIZE + 2,
          TILE_SIZE - 4,
          TILE_SIZE - 4,
        );
      } else if (this.selectedTool === null && this.movingStructureUid) {
        const canPlace = this.isValidBuildTile(gx, gy);
        this.highlightGraphics.lineStyle(
          2,
          canPlace ? 0x4ade80 : 0xef4444,
          0.9,
        );
        this.highlightGraphics.strokeRect(
          gx * TILE_SIZE + 2,
          gy * TILE_SIZE + 2,
          TILE_SIZE - 4,
          TILE_SIZE - 4,
        );
        const moving = this.structures.find(
          (s) => s.data.uid === this.movingStructureUid,
        );
        if (moving) {
          this.buildGhostSprite
            .setTexture(`tex:${moving.data.kind}`)
            .setPosition(tileCenterX(gx), tileCenterY(gy))
            .setAlpha(0.55)
            .setTint(canPlace ? 0xffffff : 0xf87171)
            .setVisible(true);
          this.drawStructureAuraPreview(moving.data.kind, gx, gy);
        }
      } else if (this.selectedTool !== null) {
        const canPlace = this.isValidBuildTile(gx, gy);
        this.highlightGraphics.lineStyle(
          2,
          canPlace ? 0x4ade80 : 0xef4444,
          0.9,
        );
        this.highlightGraphics.strokeRect(
          gx * TILE_SIZE + 2,
          gy * TILE_SIZE + 2,
          TILE_SIZE - 4,
          TILE_SIZE - 4,
        );
        this.buildGhostSprite
          .setTexture(`tex:${this.selectedTool}`)
          .setPosition(tileCenterX(gx), tileCenterY(gy))
          .setAlpha(0.55)
          .setTint(canPlace ? 0xffffff : 0xf87171)
          .setVisible(true);
        this.drawStructureAuraPreview(this.selectedTool, gx, gy);
      }
    }
  }

  private refreshHoverReadout(): void {
    if (
      this.selectedTool !== null ||
      this.aimingUltUnitUid ||
      this.movingStructureUid
    ) {
      if (this.lastHoverReadoutVisible) {
        this.hoverReadoutContainer.setVisible(false);
        this.lastHoverReadoutVisible = false;
      }
      return;
    }

    let label = '';
    if (this.hoveredEnemyUid) {
      const enemy = this.enemies.find(
        (e) => e.uid === this.hoveredEnemyUid && e.hp > 0,
      );
      if (enemy) {
        const spec = ENEMY_SPECIES[enemy.speciesId];
        if (spec) {
          const trait =
            spec.movementType === 'fly'
              ? 'Fly'
              : spec.movementType === 'burrow'
                ? 'Burrow'
                : spec.wallDmgMult > 1
                  ? 'Wall-Breaker'
                  : spec.roleLabel;
          label = `${spec.name}  HP ${Math.ceil(enemy.hp)}/${enemy.maxHp}  [${trait}]`;
        }
      }
    } else if (this.hoveredUnitUid) {
      const unit = this.units.find((u) => u.data.uid === this.hoveredUnitUid);
      if (unit) {
        const spec = POKEMON_SPECIES[unit.data.speciesId];
        if (spec) {
          const trait = unit.data.fainted
            ? 'Fainted'
            : `${spec.pokeClass} · Range ${this.getUnitRange(unit)}`;
          label = `${spec.name}  HP ${Math.ceil(unit.data.hp)}/${unit.data.maxHp}  [${trait}]`;
        }
      }
    } else if (this.hoveredStructUid) {
      const struct = this.structures.find(
        (s) => s.data.uid === this.hoveredStructUid,
      );
      if (struct) {
        const spec = STRUCTURE_SPECS[struct.data.kind];
        if (spec) {
          const trait = struct.data.ruined
            ? 'Ruined'
            : spec.blocksGround
              ? 'Blocks Ground'
              : spec.consumable
                ? 'Trap'
                : 'Support';
          label = `${spec.name}  HP ${Math.ceil(struct.data.hp)}/${struct.data.maxHp}  [${trait}]`;
        }
      }
    }

    if (!label) {
      if (this.lastHoverReadoutVisible) {
        this.hoverReadoutContainer.setVisible(false);
        this.lastHoverReadoutVisible = false;
      }
      return;
    }

    if (label !== this.lastHoverReadoutText) {
      this.lastHoverReadoutText = label;
      this.hoverReadoutText.setText(label);
      const bounds = this.hoverReadoutText.getBounds();
      this.hoverReadoutBg.setSize(
        Math.max(120, Math.ceil(bounds.width) + 16),
        24,
      );
    }
    if (!this.lastHoverReadoutVisible) {
      this.hoverReadoutContainer.setVisible(true);
      this.lastHoverReadoutVisible = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Units
  // ---------------------------------------------------------------------------

  private spawnUnit(speciesId: string, gx: number, gy: number): UnitEntity {
    const spec = POKEMON_SPECIES[speciesId];
    const maxHp = this.computeUnitMaxHp(speciesId, null, []);
    const data: ActiveUnit = {
      uid: `unit_${this.nextUidCounter++}`,
      speciesId,
      branchId: null,
      heldItems: [],
      gx,
      gy,
      hp: maxHp,
      maxHp,
      ult: computeStartingUlt(spec.ultMax, this.getSpeciesPotential(speciesId)),
      ultMax: spec.ultMax,
      autoUlt: spec.ultAutoDefault,
      fainted: false,
      facingDir: 0,
      attackCooldownMs: 0,
      hitCount: 0,
      damageDealt: 0,
      damageTaken: 0,
      healingDone: 0,
    };

    const cx = tileCenterX(gx);
    const cy = tileCenterY(gy);
    const sprite = this.add
      .sprite(cx, cy, `pmd:${speciesId}:Idle`)
      .setDepth(4 + gy * 0.1 + 0.04);
    const hpBarBg = this.add
      .rectangle(cx, cy - 22, 36, 6, 0x0f172a, 0.85)
      .setDepth(7);
    const hpBarFill = this.add
      .rectangle(cx - 17, cy - 23, 34, 3, 0x4ade80, 1)
      .setOrigin(0, 0.5)
      .setDepth(7);
    const ultBarFill = this.add
      .rectangle(cx - 17, cy - 20, 0, 2, 0xfbbf24, 1)
      .setOrigin(0, 0.5)
      .setDepth(7);

    const entity: UnitEntity = {
      data,
      sprite,
      hpBarBg,
      hpBarFill,
      ultBarFill,
      stationaryMs: 1000,
      isAttackAnimPlaying: false,
      movePath: [],
      moveTarget: null,
    };
    this.units.push(entity);
    ensureSpeciesSpritesLoaded(this, speciesId, () => {
      if (sprite.scene && !data.fainted) {
        this.playUnitAnim(entity, 'Idle');
      }
    });
    this.updateUnitBars(entity);
    return entity;
  }

  private swapUnitPositions(a: UnitEntity, b: UnitEntity): void {
    const ax = a.data.gx;
    const ay = a.data.gy;
    const bx = b.data.gx;
    const by = b.data.gy;
    this.moveUnitToTile(a, bx, by, false);
    this.moveUnitToTile(b, ax, ay, false);
    this.selectedUnitUid = null;
    this.refreshHighlights();
    this.emitSnapshot();
    const nameA = POKEMON_SPECIES[a.data.speciesId]?.name ?? a.data.speciesId;
    const nameB = POKEMON_SPECIES[b.data.speciesId]?.name ?? b.data.speciesId;
    this.setStatus(`Swapped ${nameA} and ${nameB}.`);
  }

  private moveUnitToTile(
    unit: UnitEntity,
    gx: number,
    gy: number,
    animateDash: boolean,
  ): void {
    this.tweens.killTweensOf(unit.sprite);
    unit.movePath = [];
    unit.moveTarget = null;
    const dx = gx - unit.data.gx;
    const dy = gy - unit.data.gy;
    unit.data.facingDir = vectorToPmdDir(dx, dy, unit.data.facingDir);
    unit.data.gx = gx;
    unit.data.gy = gy;
    unit.stationaryMs = 0;

    const tx = tileCenterX(gx);
    const ty = tileCenterY(gy);

    if (animateDash) {
      this.playUnitAnim(unit, 'Walk');
      this.tweens.add({
        targets: unit.sprite,
        x: tx,
        y: ty,
        duration: 120,
        ease: 'Quad.easeOut',
        onUpdate: () => this.syncUnitBarPositions(unit),
        onComplete: () => {
          this.syncUnitBarPositions(unit);
          unit.data.facingDir = 0;
          if (!unit.data.fainted && !unit.isAttackAnimPlaying) {
            this.playUnitAnim(unit, 'Idle');
          }
        },
      });
    } else {
      unit.sprite.setPosition(tx, ty);
      this.syncUnitBarPositions(unit);
      unit.data.facingDir = 0;
      this.playUnitAnim(unit, 'Idle');
    }
  }

  private syncUnitBarPositions(unit: UnitEntity): void {
    const { x, y } = unit.sprite;
    unit.hpBarBg.setPosition(x, y - 22);
    unit.hpBarFill.setPosition(x - 17, y - 23);
    unit.ultBarFill.setPosition(x - 17, y - 20);
  }

  private updateUnitBars(unit: UnitEntity): void {
    const hpRatio = Phaser.Math.Clamp(unit.data.hp / unit.data.maxHp, 0, 1);
    unit.hpBarFill.width = 34 * hpRatio;
    unit.hpBarFill.setFillStyle(
      hpRatio > 0.5 ? 0x4ade80 : hpRatio > 0.25 ? 0xfacc15 : 0xef4444,
    );

    const ultRatio = Phaser.Math.Clamp(unit.data.ult / unit.data.ultMax, 0, 1);
    unit.ultBarFill.width = 34 * ultRatio;
  }

  private playUnitAnim(
    unit: UnitEntity,
    animName: 'Idle' | 'Walk' | 'Attack',
  ): void {
    const key = `anim:pmd:${unit.data.speciesId}:${animName}:${unit.data.facingDir}`;
    if (!this.anims.exists(key)) return;

    if (animName === 'Attack') {
      unit.isAttackAnimPlaying = true;
      unit.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
      unit.sprite.play(key, false);
      unit.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        unit.isAttackAnimPlaying = false;
        if (!unit.data.fainted && unit.sprite.active) {
          this.playUnitAnim(unit, 'Idle');
        }
      });
      return;
    }

    unit.isAttackAnimPlaying = false;
    unit.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    if (unit.sprite.anims.currentAnim?.key !== key) {
      unit.sprite.play(key, true);
    }
  }

  private updateUnits(simDtMs: number): void {
    let changed = false;

    for (const unit of this.units) {
      if (unit.data.fainted) continue;

      unit.data.attackCooldownMs = Math.max(
        0,
        unit.data.attackCooldownMs - simDtMs,
      );

      if (unit.movePath.length > 0) {
        this.stepWalkingUnit(unit, simDtMs);
        continue;
      }

      unit.stationaryMs += simDtMs;

      // Auto-ult check
      if (unit.data.autoUlt && unit.data.ult >= unit.data.ultMax) {
        const autoTarget = this.findAutoUltTarget(unit);
        if (autoTarget) {
          this.castUltimate(unit, autoTarget.gx, autoTarget.gy);
          changed = true;
          continue;
        }
      }

      if (unit.data.attackCooldownMs > 0) continue;

      const target = this.findNearestEnemyInRange(
        unit.data.gx,
        unit.data.gy,
        this.getUnitRange(unit),
      );
      if (!target) continue;

      unit.data.facingDir = vectorToPmdDir(
        target.x - unit.sprite.x,
        target.y - unit.sprite.y,
        unit.data.facingDir,
      );
      this.playUnitAnim(unit, 'Attack');

      const atkInterval = this.getUnitAttackIntervalMs(unit);
      unit.data.attackCooldownMs = atkInterval;
      this.performBasicAttack(unit, target);
      changed = true;
    }

    if (changed) {
      this.emitSnapshot();
    }
  }

  private performBasicAttack(unit: UnitEntity, target: EnemyEntity): void {
    const spec = POKEMON_SPECIES[unit.data.speciesId];
    const branch = getBranchSpec(unit.data.speciesId, unit.data.branchId);
    const potential = this.getSpeciesPotential(unit.data.speciesId);
    unit.data.hitCount += 1;

    const {
      damage: dmg,
      isCrit,
      ultCharge,
      lifestealHeal,
      chainDamage,
      chainTargets,
    } = computeBasicAttackDamage({
      baseAtk: this.getUnitAtk(unit),
      speciesId: unit.data.speciesId,
      hitCount: unit.data.hitCount,
      branchSpecial: branch?.special,
      heldItems: unit.data.heldItems,
      targetHp: target.hp,
      targetMaxHp: target.maxHp,
      targetHasStatus: target.burnTimerMs > 0 || target.slowTimerMs > 0,
      potential,
      subclass: spec.subclass,
      targetMovementType: ENEMY_SPECIES[target.speciesId]?.movementType,
    });

    this.addUnitUlt(unit, ultCharge);
    this.sfx.play(getSpeciesAttackSfx(unit.data.speciesId), 85);

    const applyHit = () => {
      if (target.hp > 0) {
        if (
          unit.data.speciesId === '0004' ||
          branch?.special === 'burn_spread'
        ) {
          target.burnTimerMs = 3000;
          target.burnDps = 6;
          if (branch?.special === 'burn_spread') {
            for (const other of this.enemies) {
              if (
                other.uid !== target.uid &&
                chebyshevDist(other.gx, other.gy, target.gx, target.gy) <= 1
              ) {
                other.burnTimerMs = 2500;
                other.burnDps = 5;
              }
            }
          }
        }
        if (unit.data.speciesId === '0012' || branch?.special === 'slow_hit') {
          const slowDuration = computeSlowDurationMs(
            unit.data.speciesId === '0012' ? 3000 : 2000,
            potential,
            spec.subclass,
          );
          target.slowTimerMs = Math.max(target.slowTimerMs, slowDuration);
        }
        this.damageEnemy(target, dmg, unit, isCrit);

        if (lifestealHeal > 0 && !unit.data.fainted) {
          const prevHp = unit.data.hp;
          unit.data.hp = Math.min(
            unit.data.maxHp,
            unit.data.hp + lifestealHeal,
          );
          const actualHeal = Math.round(unit.data.hp - prevHp);
          if (actualHeal > 0) {
            unit.data.healingDone = (unit.data.healingDone ?? 0) + actualHeal;
          }
          this.updateUnitBars(unit);
        }

        if (chainDamage > 0 && chainTargets > 0) {
          const chainHits = this.enemies
            .filter(
              (e) =>
                e.uid !== target.uid &&
                e.hp > 0 &&
                chebyshevDist(e.gx, e.gy, target.gx, target.gy) <= 2,
            )
            .slice(0, chainTargets);
          for (const chainTarget of chainHits) {
            this.damageEnemy(chainTarget, chainDamage, unit, false);
          }
        }
      }
    };

    if (spec.basicVfx.includes('flight')) {
      this.spawnProjectileVfx(
        spec.basicVfx,
        spec.impactVfx,
        unit.sprite.x,
        unit.sprite.y,
        target.x,
        target.y,
        applyHit,
      );
    } else {
      this.spawnOneShotVfx(spec.impactVfx, target.x, target.y);
      applyHit();
    }
  }

  private findAutoUltTarget(unit: UnitEntity): GridPoint | null {
    const isHealUlt = isHealUltSpecies(unit.data.speciesId);

    const unitRange = this.getUnitRange(unit);
    if (isHealUlt) {
      let bestAlly: UnitEntity | null = null;
      let lowestRatio = 0.85;
      for (const ally of this.units) {
        if (ally.data.fainted) continue;
        if (
          !isInCircularRange(
            unit.data.gx,
            unit.data.gy,
            ally.data.gx,
            ally.data.gy,
            unitRange + 2,
          )
        ) {
          continue;
        }
        const ratio = ally.data.hp / ally.data.maxHp;
        if (ratio < lowestRatio) {
          lowestRatio = ratio;
          bestAlly = ally;
        }
      }
      if (bestAlly) return { gx: bestAlly.data.gx, gy: bestAlly.data.gy };
      if (unit.data.speciesId === '0001') return null;
    }

    const nearest = this.findNearestEnemyInRange(
      unit.data.gx,
      unit.data.gy,
      unitRange + 2,
    );
    return nearest ? { gx: nearest.gx, gy: nearest.gy } : null;
  }

  private executeAimedUlt(gx: number, gy: number): void {
    const unit = this.units.find((u) => u.data.uid === this.aimingUltUnitUid);
    this.aimingUltUnitUid = null;
    this.paused = false;
    this.slowMo = false;

    if (unit && !unit.data.fainted && unit.data.ult >= unit.data.ultMax) {
      this.castUltimate(unit, gx, gy);
    }

    this.refreshHighlights();
    this.emitSnapshot();
  }

  private castUltimate(unit: UnitEntity, gx: number, gy: number): void {
    const spec = POKEMON_SPECIES[unit.data.speciesId];
    unit.data.ult = 0;
    unit.data.facingDir = vectorToPmdDir(
      gx - unit.data.gx,
      gy - unit.data.gy,
      unit.data.facingDir,
    );
    this.playUnitAnim(unit, 'Attack');

    const tx = tileCenterX(gx);
    const ty = tileCenterY(gy);
    this.spawnOneShotVfx(spec.ultVfx, tx, ty, 1.15);
    this.sfx.play(getSpeciesUltSfx(unit.data.speciesId), 100);

    const atk = this.getUnitAtk(unit);
    const branch = getBranchSpec(unit.data.speciesId, unit.data.branchId);
    const ultMult = branch?.ultMult ?? 1;
    const potential = this.getSpeciesPotential(unit.data.speciesId);

    if (isHealUltSpecies(unit.data.speciesId)) {
      const healAmount = computeUltPower(
        atk,
        ultMult,
        true,
        potential,
        spec.subclass,
      );
      for (const ally of this.units) {
        if (ally.data.fainted) continue;
        if (Math.hypot(ally.data.gx - gx, ally.data.gy - gy) <= ULT_RADIUS) {
          const prevHp = ally.data.hp;
          ally.data.hp = Math.min(ally.data.maxHp, ally.data.hp + healAmount);
          const actualHeal = Math.round(ally.data.hp - prevHp);
          if (actualHeal > 0) {
            unit.data.healingDone = (unit.data.healingDone ?? 0) + actualHeal;
            this.spawnFloatingText(
              ally.sprite.x,
              ally.sprite.y - 24,
              `+${actualHeal}`,
              '#4ade80',
            );
          }
          this.updateUnitBars(ally);
        }
      }
      if (unit.data.speciesId === '0012') {
        const slowDuration = computeSlowDurationMs(
          3500,
          potential,
          spec.subclass,
        );
        for (const enemy of [...this.enemies]) {
          if (Math.hypot(enemy.gx - gx, enemy.gy - gy) <= ULT_RADIUS) {
            enemy.stunTimerMs = Math.max(enemy.stunTimerMs, 1500);
            enemy.slowTimerMs = Math.max(enemy.slowTimerMs, slowDuration);
          }
        }
      }
    } else {
      const ultDmg = computeUltPower(
        atk,
        ultMult,
        false,
        potential,
        spec.subclass,
      );
      for (const enemy of [...this.enemies]) {
        if (Math.hypot(enemy.gx - gx, enemy.gy - gy) <= ULT_RADIUS) {
          if (unit.data.speciesId === '0143') {
            enemy.stunTimerMs = Math.max(enemy.stunTimerMs, 1500);
          }
          if (
            unit.data.speciesId === '0007' ||
            unit.data.speciesId === '0143'
          ) {
            this.knockbackEnemy(enemy, tx, ty);
          }
          this.damageEnemy(enemy, ultDmg, unit, true);
        }
      }
    }

    this.updateUnitBars(unit);
    this.setStatus(`${spec.name} unleashed ${spec.ultName}!`);
  }

  private addUnitUlt(unit: UnitEntity, amount: number): void {
    const mult = this.upgrades.includes('quick_charge') ? 1.3 : 1;
    unit.data.ult = Math.min(unit.data.ultMax, unit.data.ult + amount * mult);
    this.updateUnitBars(unit);
  }

  // ---------------------------------------------------------------------------
  // Enemies & Spawning
  // ---------------------------------------------------------------------------

  private buildSpawnQueue(): void {
    this.spawnQueue = [];
    this.spawnQueueIndex = 0;
    const waveDef = this.activeWaves[this.wave - 1];
    if (!waveDef) return;

    let portalIdx = 0;

    for (const group of waveDef.spawns) {
      const delay = group.delayMs ?? 0;
      for (let i = 0; i < group.count; i++) {
        const portal =
          this.activePortals[
            (portalIdx + i) % Math.max(1, this.activePortals.length)
          ];
        const point = portal
          ? portal.cells[i % portal.cells.length]
          : { gx: 0, gy: Math.floor(GRID_ROWS / 2) };
        this.spawnQueue.push({
          spawnAtMs: delay + i * group.intervalMs,
          speciesId: group.speciesId,
          point,
        });
      }
      portalIdx += 1;
    }

    this.spawnQueue.sort((a, b) => a.spawnAtMs - b.spawnAtMs);
  }

  private processSpawnQueue(): void {
    while (
      this.spawnQueueIndex < this.spawnQueue.length &&
      this.spawnQueue[this.spawnQueueIndex].spawnAtMs <= this.waveElapsedMs
    ) {
      const next = this.spawnQueue[this.spawnQueueIndex++];
      this.spawnEnemy(next.speciesId, next.point);
    }
  }

  private spawnEnemy(speciesId: string, point: GridPoint): void {
    const spec = ENEMY_SPECIES[speciesId];
    if (!spec) return;

    const x = tileCenterX(point.gx);
    const y = tileCenterY(point.gy);
    const facingDir = point.gx < GRID_COLS / 2 ? 2 : 6;

    const spriteKey = spec.spriteId ?? speciesId;
    const sprite = this.add
      .sprite(x, y, `pmd:${spriteKey}:Walk`)
      .setDepth(
        spec.movementType === 'fly' ? 6.2 : 4 + (y / TILE_SIZE) * 0.1 + 0.04,
      );
    if (spec.spriteScale) sprite.setScale(spec.spriteScale);
    if (spec.spriteTint !== undefined) sprite.setTint(spec.spriteTint);
    const hpBarBg = this.add
      .rectangle(x, y - 20, 32, 4, 0x0f172a, 0.85)
      .setDepth(7);
    const hpBarFill = this.add
      .rectangle(x - 15, y - 20, 30, 2, 0xf43f5e, 1)
      .setOrigin(0, 0.5)
      .setDepth(7);

    const enemy: EnemyEntity = {
      uid: `enemy_${this.nextUidCounter++}`,
      speciesId,
      x,
      y,
      gx: point.gx,
      gy: point.gy,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      facingDir,
      attackCooldownMs: 0,
      burnTimerMs: 0,
      burnDps: 0,
      burnTickMs: 0,
      slowTimerMs: 0,
      stunTimerMs: 0,
      hitFlashTimerMs: 0,
      path: [],
      targetWallUid: null,
      repathTimerMs: 0,
      sprite,
      hpBarBg,
      hpBarFill,
    };

    this.enemies.push(enemy);
    this.computeEnemyPath(enemy);
    this.playEnemyAnim(enemy, 'Walk');
  }

  private updateEnemies(simDtMs: number): void {
    this.isUpdatingEnemies = true;
    this.enemiesDirty = false;
    try {
      for (let i = 0; i < this.enemies.length; i++) {
        const enemy = this.enemies[i];
        if (enemy.hp <= 0) continue;

        const spec = ENEMY_SPECIES[enemy.speciesId];
        enemy.attackCooldownMs = Math.max(0, enemy.attackCooldownMs - simDtMs);
        enemy.slowTimerMs = Math.max(0, enemy.slowTimerMs - simDtMs);
        enemy.stunTimerMs = Math.max(0, enemy.stunTimerMs - simDtMs);
        enemy.hitFlashTimerMs = Math.max(0, enemy.hitFlashTimerMs - simDtMs);
        enemy.repathTimerMs -= simDtMs;

        const baseTint = spec.spriteTint ?? 0xffffff;
        const nextTint =
          enemy.hitFlashTimerMs > 0
            ? 0xffaaaa
            : enemy.stunTimerMs > 0
              ? 0xfef08a
              : enemy.burnTimerMs > 0
                ? 0xfb923c
                : enemy.slowTimerMs > 0
                  ? 0x38bdf8
                  : baseTint;
        if (nextTint === 0xffffff) {
          if (enemy.sprite.isTinted) enemy.sprite.clearTint();
        } else if (
          !enemy.sprite.isTinted ||
          enemy.sprite.tintTopLeft !== nextTint
        ) {
          enemy.sprite.setTint(nextTint);
        }

        // Burn DoT
        if (enemy.burnTimerMs > 0) {
          enemy.burnTimerMs = Math.max(0, enemy.burnTimerMs - simDtMs);
          enemy.burnTickMs += simDtMs;
          if (enemy.burnTickMs >= 500) {
            enemy.burnTickMs -= 500;
            this.damageEnemy(
              enemy,
              Math.round(enemy.burnDps * 0.5),
              null,
              false,
            );
            if (enemy.hp <= 0) continue;
          }
        }

        if (enemy.stunTimerMs > 0) continue;

        // Barrel trap trigger for non-flying enemies
        if (spec.movementType !== 'fly') {
          const structHere = this.getStructureAt(enemy.gx, enemy.gy);
          if (
            structHere &&
            structHere.data.kind === 'barrel' &&
            !structHere.data.ruined
          ) {
            this.explodeBarrel(structHere);
            if (enemy.hp <= 0) continue;
          }
        }

        // Check adjacent attack targets: Core -> blocking unit -> blocking wall
        const adjCore = CORE_CELLS.find(
          (c) => manhattanDist(enemy.gx, enemy.gy, c.gx, c.gy) <= 1,
        );
        if (adjCore) {
          this.enemyAttackCore(enemy, adjCore);
          continue;
        }

        if (spec.movementType !== 'fly') {
          const adjUnit = this.findAdjacentLivingUnit(enemy);
          if (adjUnit) {
            this.enemyAttackUnit(enemy, adjUnit);
            continue;
          }
        }

        if (spec.movementType === 'ground' && enemy.targetWallUid) {
          const wall = this.structures.find(
            (s) =>
              s.data.uid === enemy.targetWallUid &&
              !s.data.ruined &&
              s.data.hp > 0,
          );
          if (
            wall &&
            manhattanDist(enemy.gx, enemy.gy, wall.data.gx, wall.data.gy) <= 1
          ) {
            this.enemyAttackStructure(enemy, wall);
            continue;
          }
        }

        // Recompute path if needed
        if (enemy.path.length === 0 || enemy.repathTimerMs <= 0) {
          this.computeEnemyPath(enemy);
        }

        this.moveEnemyAlongPath(enemy, simDtMs);
      }
    } finally {
      this.isUpdatingEnemies = false;
      if (this.enemiesDirty) {
        this.enemiesDirty = false;
        this.enemies = this.enemies.filter((e) => e.hp > 0);
      }
    }
  }

  private computeEnemyPath(enemy: EnemyEntity): void {
    const spec = ENEMY_SPECIES[enemy.speciesId];
    const blockedWalls = this.getBlockedWallKeys();
    const start: GridPoint = { gx: enemy.gx, gy: enemy.gy };

    enemy.repathTimerMs = 400;
    enemy.targetWallUid = null;

    const path = findPath(start, this.tiles, blockedWalls, spec.movementType);
    if (path && path.length > 0) {
      enemy.path = path;
    } else if (spec.movementType === 'ground') {
      const wall = findNearestBlockingWall(
        start,
        this.tiles,
        this.structures.map((s) => s.data),
      );
      if (wall) {
        enemy.targetWallUid = wall.uid;
        enemy.path = this.findPathToTile(start, { gx: wall.gx, gy: wall.gy });
      } else {
        enemy.path = [start];
      }
    } else {
      enemy.path = [start];
    }

    if (enemy.path.length > 1) {
      const p0x = tileCenterX(enemy.path[0].gx);
      const p0y = tileCenterY(enemy.path[0].gy);
      const p1x = tileCenterX(enemy.path[1].gx);
      const p1y = tileCenterY(enemy.path[1].gy);
      const ex = enemy.x - p0x;
      const ey = enemy.y - p0y;
      const dx = p1x - p0x;
      const dy = p1y - p0y;
      if (Math.hypot(ex, ey) < 4 || ex * dx + ey * dy > 0) {
        enemy.path.shift();
      }
    }
  }

  private moveEnemyAlongPath(enemy: EnemyEntity, simDtMs: number): void {
    if (enemy.path.length === 0) return;

    while (enemy.path.length > 1) {
      const wx = tileCenterX(enemy.path[0].gx);
      const wy = tileCenterY(enemy.path[0].gy);
      if (Math.hypot(wx - enemy.x, wy - enemy.y) < 3) {
        enemy.path.shift();
      } else {
        break;
      }
    }

    const nextPt = enemy.path[0];
    const tx = tileCenterX(nextPt.gx);
    const ty = tileCenterY(nextPt.gy);
    const dx = tx - enemy.x;
    const dy = ty - enemy.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 1) {
      if (enemy.path.length > 1) enemy.path.shift();
      return;
    }

    const spec = ENEMY_SPECIES[enemy.speciesId];
    const slowMult = enemy.slowTimerMs > 0 ? 0.6 : 1;
    const step = (spec.speed * TILE_SIZE * slowMult * simDtMs) / 1000;

    if (step >= dist) {
      enemy.x = tx;
      enemy.y = ty;
    } else {
      enemy.x += (dx / dist) * step;
      enemy.y += (dy / dist) * step;
    }

    const gridPos = worldToGrid(enemy.x, enemy.y);
    enemy.gx = gridPos.gx;
    enemy.gy = gridPos.gy;
    enemy.facingDir = vectorToPmdDir(dx, dy, enemy.facingDir);

    this.syncEnemySprite(enemy);
    this.playEnemyAnim(enemy, 'Walk');
  }

  private enemyAttackCore(enemy: EnemyEntity, coreCell: GridPoint): void {
    const tx = tileCenterX(coreCell.gx);
    const ty = tileCenterY(coreCell.gy);
    enemy.facingDir = vectorToPmdDir(
      tx - enemy.x,
      ty - enemy.y,
      enemy.facingDir,
    );
    if (enemy.attackCooldownMs > 0) return;

    const spec = ENEMY_SPECIES[enemy.speciesId];
    enemy.attackCooldownMs = 1000;
    this.playEnemyAnim(enemy, 'Attack');
    this.spawnOneShotVfx(spec.hitVfx, tx, ty, 0.9);

    this.coreHp = Math.max(0, this.coreHp - spec.atk);
    this.updateCoreBar();
    this.coreHitFlashTimerMs = 90;
    this.coreSprite?.setTint(0xff9999);
    if (this.time.now - this.lastCoreShakeAtMs >= 750) {
      this.lastCoreShakeAtMs = this.time.now;
      this.triggerScreenShake(45, 0.0007);
    }
    this.spawnFloatingText(
      (GRID_COLS / 2) * TILE_SIZE,
      (GRID_ROWS / 2) * TILE_SIZE - 24,
      `-${spec.atk}`,
      '#f43f5e',
    );
    this.emitSnapshot();
  }

  private enemyAttackUnit(enemy: EnemyEntity, unit: UnitEntity): void {
    enemy.facingDir = vectorToPmdDir(
      unit.sprite.x - enemy.x,
      unit.sprite.y - enemy.y,
      enemy.facingDir,
    );
    if (enemy.attackCooldownMs > 0) return;

    const enemySpec = ENEMY_SPECIES[enemy.speciesId];
    enemy.attackCooldownMs = 1000;
    this.playEnemyAnim(enemy, 'Attack');
    this.spawnOneShotVfx(enemySpec.hitVfx, unit.sprite.x, unit.sprite.y, 0.85);

    const unitBranch = getBranchSpec(unit.data.speciesId, unit.data.branchId);
    const { damage: dmg, reflectedThorns } = computeEnemyAttackDamage({
      enemyAtk: enemySpec.atk,
      unitDef: this.getUnitDef(unit),
      unitSpeciesId: unit.data.speciesId,
      unitStationaryMs: unit.stationaryMs,
      unitHeldItems: unit.data.heldItems,
      unitAdjacentToStructure: this.isAdjacentToAnyStructure(
        unit.data.gx,
        unit.data.gy,
      ),
      unitBranchSpecial: unitBranch?.special,
    });

    const taken = Math.min(unit.data.hp, Math.max(0, dmg));
    unit.data.hp = Math.max(0, unit.data.hp - dmg);
    if (taken > 0) {
      unit.data.damageTaken = (unit.data.damageTaken ?? 0) + Math.round(taken);
      this.emitSnapshot();
    }
    if (reflectedThorns > 0 && enemy.hp > 0) {
      this.damageEnemy(enemy, reflectedThorns, unit, false);
    }
    this.spawnFloatingText(
      unit.sprite.x,
      unit.sprite.y - 24,
      `-${dmg}`,
      '#fb7185',
    );

    if (unit.data.hp <= 0) {
      unit.data.fainted = true;
      unit.movePath = [];
      unit.moveTarget = null;
      unit.sprite.setAlpha(0.35);
      unit.sprite.setTint(0x64748b);
      unit.sprite.anims.stop();
      if (this.selectedUnitUid === unit.data.uid) {
        this.selectedUnitUid = null;
        this.slowMo = false;
        this.refreshHighlights();
      }
      if (this.aimingUltUnitUid === unit.data.uid) {
        this.aimingUltUnitUid = null;
        this.slowMo = false;
        this.refreshHighlights();
      }
    }
    this.updateUnitBars(unit);
    this.emitSnapshot();
  }

  private enemyAttackStructure(
    enemy: EnemyEntity,
    struct: StructureEntity,
  ): void {
    enemy.facingDir = vectorToPmdDir(
      struct.sprite.x - enemy.x,
      struct.sprite.y - enemy.y,
      enemy.facingDir,
    );
    if (enemy.attackCooldownMs > 0) return;

    const spec = ENEMY_SPECIES[enemy.speciesId];
    enemy.attackCooldownMs = 1000;
    this.playEnemyAnim(enemy, 'Attack');
    this.spawnOneShotVfx(spec.hitVfx, struct.sprite.x, struct.sprite.y, 0.85);

    const dmg = Math.round(spec.atk * spec.wallDmgMult);
    struct.data.hp = Math.max(0, struct.data.hp - dmg);
    this.spawnFloatingText(
      struct.sprite.x,
      struct.sprite.y - 20,
      `-${dmg}`,
      '#fdba74',
    );

    if (struct.data.hp <= 0) {
      if (struct.data.kind === 'barrel') {
        this.explodeBarrel(struct);
      } else {
        struct.data.ruined = true;
        struct.sprite.setTexture('tex:ruined');
        this.updateStructureBar(struct);
        this.invalidateEnemyPaths();
        this.sfx.play('crumble', 120);
      }
    } else {
      this.updateStructureBar(struct);
    }
    this.emitSnapshot();
  }

  private damageEnemy(
    enemy: EnemyEntity,
    amount: number,
    attacker: UnitEntity | null,
    isCrit: boolean,
  ): void {
    if (enemy.hp <= 0) return;
    const dealt = Math.min(enemy.hp, Math.max(0, amount));
    enemy.hp = Math.max(0, enemy.hp - amount);
    if (attacker && dealt > 0) {
      attacker.data.damageDealt =
        (attacker.data.damageDealt ?? 0) + Math.round(dealt);
      this.emitSnapshot();
    }
    if (amount > 0 && enemy.hp > 0) {
      enemy.hitFlashTimerMs = 90;
      enemy.sprite.setTint(0xffaaaa);
    }

    const hpRatio = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
    enemy.hpBarFill.width = 30 * hpRatio;

    this.spawnFloatingText(
      enemy.x,
      enemy.y - 22,
      isCrit ? `${amount}!` : `${amount}`,
      isCrit ? '#fde047' : '#f8fafc',
    );

    if (enemy.hp <= 0) {
      this.handleEnemyKilled(enemy, attacker);
    }
  }

  private handleEnemyKilled(
    enemy: EnemyEntity,
    attacker: UnitEntity | null,
  ): void {
    const spec = ENEMY_SPECIES[enemy.speciesId];
    const potential = attacker
      ? this.getSpeciesPotential(attacker.data.speciesId)
      : 0;
    const bounty = computeKillBounty(
      spec.bounty,
      this.artifacts.includes('commanders_insignia'),
      potential,
    );

    this.gold += bounty;
    this.kills += 1;
    this.sfx.play('faint', 130);

    const apInterval = this.artifacts.includes('temporal_gear') ? 4 : 6;
    if (this.kills % apInterval === 0 && this.ap < this.maxAp) {
      this.ap += 1;
      this.spawnFloatingText(enemy.x, enemy.y - 36, '+1 AP', '#38bdf8');
    }

    if (attacker && !attacker.data.fainted) {
      this.addUnitUlt(attacker, 15);
    }

    this.spawnFloatingText(enemy.x, enemy.y - 10, `+₽${bounty}`, '#facc15');
    this.tweens.killTweensOf(enemy.sprite);
    enemy.sprite.destroy();
    enemy.hpBarBg.destroy();
    enemy.hpBarFill.destroy();
    if (this.isUpdatingEnemies) {
      this.enemiesDirty = true;
    } else {
      this.enemies = this.enemies.filter((e) => e.uid !== enemy.uid);
    }
    if (this.hoveredEnemyUid === enemy.uid) {
      this.hoveredEnemyUid = null;
      this.refreshHoverReadout();
    }
    this.emitSnapshot();
  }

  private knockbackEnemy(
    enemy: EnemyEntity,
    fromX: number,
    fromY: number,
  ): void {
    const dx = enemy.x - fromX;
    const dy = enemy.y - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = Phaser.Math.Clamp(
      enemy.x + (dx / dist) * 28,
      12,
      CANVAS_WIDTH - 12,
    );
    const ny = Phaser.Math.Clamp(
      enemy.y + (dy / dist) * 28,
      12,
      CANVAS_HEIGHT - 12,
    );
    const gridPos = worldToGrid(nx, ny);
    if (
      ENEMY_SPECIES[enemy.speciesId].movementType !== 'fly' &&
      this.tiles[gridPos.gy][gridPos.gx] === 'water'
    ) {
      return;
    }
    enemy.x = nx;
    enemy.y = ny;
    enemy.gx = gridPos.gx;
    enemy.gy = gridPos.gy;
    enemy.path = [];
    this.syncEnemySprite(enemy);
  }

  private syncEnemySprite(enemy: EnemyEntity): void {
    enemy.sprite.setPosition(enemy.x, enemy.y);
    if (ENEMY_SPECIES[enemy.speciesId]?.movementType !== 'fly') {
      enemy.sprite.setDepth(4 + (enemy.y / TILE_SIZE) * 0.1 + 0.04);
    }
    enemy.hpBarBg.setPosition(enemy.x, enemy.y - 20);
    enemy.hpBarFill.setPosition(enemy.x - 15, enemy.y - 20);
  }

  private playEnemyAnim(enemy: EnemyEntity, animName: 'Walk' | 'Attack'): void {
    const spriteId =
      ENEMY_SPECIES[enemy.speciesId]?.spriteId ?? enemy.speciesId;
    const key = `anim:pmd:${spriteId}:${animName}:${enemy.facingDir}`;
    if (!this.anims.exists(key)) return;

    if (animName === 'Attack') {
      enemy.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
      enemy.sprite.play(key, false);
      enemy.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (enemy.hp > 0 && enemy.sprite.active) {
          this.playEnemyAnim(enemy, 'Walk');
        }
      });
      return;
    }

    if (enemy.sprite.anims.currentAnim?.key !== key) {
      enemy.sprite.play(key, true);
    }
  }

  private invalidateEnemyPaths(): void {
    for (const enemy of this.enemies) {
      enemy.path = [];
      enemy.targetWallUid = null;
      enemy.repathTimerMs = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Structures & Wave End
  // ---------------------------------------------------------------------------

  private updateBerryBushes(simDtMs: number): void {
    this.berryHealTimerMs += simDtMs;
    if (this.berryHealTimerMs < 1000) return;
    this.berryHealTimerMs -= 1000;

    let healedAny = false;
    for (const struct of this.structures) {
      if (
        struct.data.kind !== 'berry_bush' ||
        struct.data.ruined ||
        struct.data.hp <= 0
      )
        continue;

      for (const unit of this.units) {
        if (unit.data.fainted || unit.data.hp >= unit.data.maxHp) continue;
        if (
          chebyshevDist(
            unit.data.gx,
            unit.data.gy,
            struct.data.gx,
            struct.data.gy,
          ) <= 1
        ) {
          const prev = unit.data.hp;
          unit.data.hp = Math.min(
            unit.data.maxHp,
            unit.data.hp + BERRY_HEAL_PER_SEC,
          );
          const diff = Math.round(unit.data.hp - prev);
          if (diff > 0) {
            this.updateUnitBars(unit);
            this.spawnFloatingText(
              unit.sprite.x,
              unit.sprite.y - 24,
              `+${diff}`,
              '#4ade80',
            );
            healedAny = true;
          }
        }
      }
    }

    if (healedAny) this.emitSnapshot();
  }

  private explodeBarrel(barrel: StructureEntity): void {
    const bx = barrel.data.gx;
    const by = barrel.data.gy;
    const cx = barrel.sprite.x;
    const cy = barrel.sprite.y;

    this.removeStructureEntity(barrel);
    this.spawnOneShotVfx('explosions/big-explosion', cx, cy, 1.1);
    this.triggerScreenShake(110, 0.0025);
    this.sfx.play('crumble', 60);

    for (const enemy of [...this.enemies]) {
      if (Math.hypot(enemy.gx - bx, enemy.gy - by) <= BARREL_RADIUS) {
        this.damageEnemy(enemy, BARREL_DAMAGE, null, true);
      }
    }
  }

  private resetCombatControlState(): void {
    this.stopAllUnitMovement();
    this.paused = false;
    this.slowMo = false;
    this.aimingUltUnitUid = null;
    this.selectedUnitUid = null;
    this.anims.globalTimeScale = 1;
    this.tweens.timeScale = 1;
  }

  private handleWaveComplete(): void {
    this.resetCombatControlState();
    this.ap = Math.min(this.maxAp, this.ap + 3);

    if (this.wave >= this.maxWaves) {
      this.phase = 'VICTORY';
      const squadSpeciesIds = Array.from(
        new Set([
          ...this.draftIds,
          ...this.units.map((u) => u.data.speciesId),
          ...this.reserveIds,
        ]),
      );
      const mapSpec = MAP_BY_ID[this.selectedMapId];
      const reward = applyRunVictoryRewards(this.playerSave, {
        mapId: this.selectedMapId,
        difficulty: mapSpec?.difficulty ?? 'Beginner',
        squadSpeciesIds,
        coreHp: Math.max(0, Math.round(this.coreHp)),
        coreMaxHp: this.coreMaxHp,
        rng: this.rng,
      });
      persistPlayerSave(this.playerSave);
      this.sfx.play('wave_clear', 0);
      const eggCount =
        reward.eggsEarned.common +
        reward.eggsEarned.rare +
        reward.eggsEarned.master;
      const rewardHint =
        eggCount > 0
          ? ` Earned ${eggCount} egg${eggCount > 1 ? 's' : ''}!`
          : '';
      this.setStatus(
        `Victory! The Bastion Core survived all ${this.maxWaves} waves.${rewardHint}`,
      );
      return;
    }

    this.rewardChoices = this.generateRewardChoices();
    this.phase = 'REWARD';
    this.refreshHighlights();
    this.sfx.play('wave_clear', 0);
    this.setStatus(`Wave ${this.wave} cleared! +3 AP. Choose a reward.`);
  }

  private handleDefeat(): void {
    this.resetCombatControlState();
    this.phase = 'DEFEAT';
    this.sfx.play('faint', 0);
    this.refreshHighlights();
    this.setStatus('Defeat! The Bastion Core was destroyed.');
  }

  private generateRewardChoices(): RewardOption[] {
    const ownedSpecies = new Set([
      ...this.units.map((u) => u.data.speciesId),
      ...this.reserveIds,
    ]);
    const unbranchedUnits = this.units
      .filter((u) => !u.data.branchId)
      .map((u) => ({ uid: u.data.uid, speciesId: u.data.speciesId }));

    return buildRewardChoices(
      ownedSpecies,
      this.upgrades,
      this.artifacts,
      this.rng,
      unbranchedUnits,
      false,
      this.units.length < MAX_ACTIVE_UNITS ||
        this.reserveIds.length < MAX_RESERVE_UNITS,
    );
  }

  private triggerScreenShake(durationMs: number, intensity: number): void {
    if (!this.screenShakeEnabled) return;
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!prefersReducedMotion) {
      this.cameras.main.shake(durationMs, intensity);
    }
  }

  // ---------------------------------------------------------------------------
  // VFX & Floating Text
  // ---------------------------------------------------------------------------

  private spawnProjectileVfx(
    flightKey: string,
    impactKey: string,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    onArrive: () => void,
  ): void {
    const animKey = `anim:vfx:${flightKey}`;
    if (!this.anims.exists(animKey)) {
      onArrive();
      return;
    }

    const { startX, startY, rotation } = computeProjectileLaunch(
      sx,
      sy,
      tx,
      ty,
    );

    this.evictOldestTransientVfx();
    const proj = this.add
      .sprite(startX, startY, `vfx:${flightKey}`)
      .setDepth(8)
      .setOrigin(0.25, 0.5)
      .setScale(0.75)
      .setRotation(rotation);
    this.transientVfx.push(proj);
    proj.play(animKey);

    const dist = Math.hypot(tx - startX, ty - startY);
    const duration = Math.max(90, Math.round((dist / 380) * 1000));

    this.tweens.add({
      targets: proj,
      x: tx,
      y: ty,
      duration,
      onComplete: () => {
        this.removeTransientVfx(proj);
        this.spawnOneShotVfx(impactKey, tx, ty, 0.85, rotation);
        onArrive();
      },
    });
  }

  private spawnOneShotVfx(
    vfxKey: string,
    x: number,
    y: number,
    scale = 0.9,
    rotation = 0,
  ): void {
    const animKey = `anim:vfx:${vfxKey}`;
    if (!this.anims.exists(animKey)) return;

    this.evictOldestTransientVfx();
    const fx = this.add
      .sprite(x, y, `vfx:${vfxKey}`)
      .setDepth(8)
      .setScale(scale)
      .setRotation(rotation);
    this.transientVfx.push(fx);
    fx.play({ key: animKey, repeat: 0 });
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.removeTransientVfx(fx);
    });
  }

  private spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
  ): void {
    while (this.floatingTexts.length >= MAX_FLOATING_TEXTS) {
      const oldest = this.floatingTexts.shift();
      if (oldest) {
        this.tweens.killTweensOf(oldest);
        if (oldest.active) oldest.destroy();
      }
    }

    const label = this.add
      .text(x, y, text, {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        color,
        stroke: '#020617',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(9);
    this.floatingTexts.push(label);

    this.tweens.add({
      targets: label,
      y: y - 22,
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.removeFloatingText(label);
      },
    });
  }

  private evictOldestTransientVfx(): void {
    while (this.transientVfx.length >= MAX_TRANSIENT_VFX) {
      const oldest = this.transientVfx.shift();
      if (oldest) {
        this.tweens.killTweensOf(oldest);
        if (oldest.active) oldest.destroy();
      }
    }
  }

  private removeTransientVfx(obj: Phaser.GameObjects.GameObject): void {
    this.tweens.killTweensOf(obj);
    if (obj.active) obj.destroy();
    const idx = this.transientVfx.indexOf(obj);
    if (idx >= 0) this.transientVfx.splice(idx, 1);
  }

  private removeFloatingText(label: Phaser.GameObjects.Text): void {
    this.tweens.killTweensOf(label);
    if (label.active) label.destroy();
    const idx = this.floatingTexts.indexOf(label);
    if (idx >= 0) this.floatingTexts.splice(idx, 1);
  }

  // ---------------------------------------------------------------------------
  // Stat Helpers & Lookups
  // ---------------------------------------------------------------------------

  private getSpeciesPotential(speciesId: string): number {
    return this.playerSave.pokemon[speciesId]?.mastery ?? 0;
  }

  private computeUnitMaxHp(
    speciesId: string,
    branchId: string | null = null,
    heldItems: string[] = [],
  ): number {
    return computeCombatUnitMaxHp(
      speciesId,
      this.upgrades,
      branchId,
      heldItems,
      this.getSpeciesPotential(speciesId),
    );
  }

  private computeStructureMaxHp(baseMaxHp: number): number {
    return this.artifacts.includes('fortification_core')
      ? Math.round(baseMaxHp * 1.4)
      : baseMaxHp;
  }

  private getUnitRange(unit: UnitEntity): number {
    return computeUnitRange(
      unit.data.speciesId,
      unit.data.branchId,
      this.upgrades,
      this.getSpeciesPotential(unit.data.speciesId),
    );
  }

  private getUnitAtk(unit: UnitEntity): number {
    // Bulbasaur aura: nearby living allies gain +10% ATK
    const hasBulbasaurAura = this.units.some(
      (other) =>
        !other.data.fainted &&
        other.data.speciesId === '0001' &&
        other.data.uid !== unit.data.uid &&
        chebyshevDist(
          other.data.gx,
          other.data.gy,
          unit.data.gx,
          unit.data.gy,
        ) <= 2,
    );
    return computeUnitAtk(
      unit.data.speciesId,
      this.upgrades,
      hasBulbasaurAura,
      unit.data.branchId,
      unit.data.heldItems,
      this.getSpeciesPotential(unit.data.speciesId),
    );
  }

  private getUnitDef(unit: UnitEntity): number {
    let def = computeUnitDef(
      unit.data.speciesId,
      unit.data.branchId,
      unit.data.heldItems,
      this.upgrades,
      this.getSpeciesPotential(unit.data.speciesId),
    );
    if (
      unit.data.speciesId === '0007' &&
      this.isNearWaterOrWall(unit.data.gx, unit.data.gy)
    ) {
      def = Math.round(def * 1.25);
    }
    if (
      unit.data.speciesId === '0074' &&
      this.isAdjacentToWall(unit.data.gx, unit.data.gy)
    ) {
      def = Math.round(def * 1.3);
    }
    return def;
  }

  private getUnitAttackIntervalMs(unit: UnitEntity): number {
    let interval = computeUnitAttackIntervalMs(
      unit.data.speciesId,
      this.artifacts,
      unit.data.branchId,
      unit.data.heldItems,
      this.upgrades,
      this.getSpeciesPotential(unit.data.speciesId),
    );
    if (unit.data.speciesId === '0133') {
      interval = Math.round(interval / 1.2);
    }
    return interval;
  }

  private isAdjacentToAnyStructure(gx: number, gy: number): boolean {
    return this.structures.some(
      (s) => !s.data.ruined && chebyshevDist(s.data.gx, s.data.gy, gx, gy) <= 1,
    );
  }

  private isNearWaterOrWall(gx: number, gy: number): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = gx + dx;
        const ny = gy + dy;
        if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
        if (this.tiles[ny][nx] === 'water') return true;
        const st = this.getStructureAt(nx, ny);
        if (st && !st.data.ruined) return true;
      }
    }
    return false;
  }

  private isAdjacentToWall(gx: number, gy: number): boolean {
    return this.structures.some(
      (s) =>
        !s.data.ruined &&
        STRUCTURE_SPECS[s.data.kind].blocksGround &&
        chebyshevDist(gx, gy, s.data.gx, s.data.gy) <= 1,
    );
  }

  private stepWalkingUnit(unit: UnitEntity, simDtMs: number): void {
    const baseMove = POKEMON_SPECIES[unit.data.speciesId].moveRange;
    const branch = getBranchSpec(unit.data.speciesId, unit.data.branchId);
    const moveRange = getEffectiveMoveRange(
      baseMove,
      this.upgrades,
      branch,
      unit.data.speciesId,
    );
    const speedPxPerSec = (2.5 + moveRange * 1.5) * TILE_SIZE;
    let remainingPx = speedPxPerSec * (simDtMs / 1000);

    while (remainingPx > 0 && unit.movePath.length > 0) {
      const next = unit.movePath[0];
      const tx = tileCenterX(next.gx);
      const ty = tileCenterY(next.gy);
      const dx = tx - unit.sprite.x;
      const dy = ty - unit.sprite.y;
      const dist = Math.hypot(dx, dy);

      unit.data.facingDir = vectorToPmdDir(dx, dy, unit.data.facingDir);

      if (dist <= remainingPx) {
        unit.sprite.setPosition(tx, ty);
        unit.data.gx = next.gx;
        unit.data.gy = next.gy;
        unit.movePath.shift();
        remainingPx -= dist;
      } else {
        const ratio = remainingPx / dist;
        unit.sprite.setPosition(
          unit.sprite.x + dx * ratio,
          unit.sprite.y + dy * ratio,
        );
        remainingPx = 0;
      }
    }

    unit.stationaryMs = 0;
    unit.sprite.setDepth(4 + (unit.sprite.y / TILE_SIZE) * 0.1 + 0.04);
    this.syncUnitBarPositions(unit);

    if (unit.movePath.length === 0) {
      unit.moveTarget = null;
      unit.data.facingDir = 0;
      if (!unit.isAttackAnimPlaying) {
        this.playUnitAnim(unit, 'Idle');
      }
      if (this.selectedUnitUid === unit.data.uid) {
        this.refreshHighlights();
      }
    } else {
      this.playUnitAnim(unit, 'Walk');
    }
  }

  private stopAllUnitMovement(): void {
    for (const unit of this.units) {
      if (unit.movePath.length === 0 && !unit.moveTarget) continue;
      unit.movePath = [];
      unit.moveTarget = null;
      const tx = tileCenterX(unit.data.gx);
      const ty = tileCenterY(unit.data.gy);
      unit.sprite.setPosition(tx, ty);
      unit.sprite.setDepth(4 + unit.data.gy * 0.1 + 0.04);
      this.syncUnitBarPositions(unit);
      unit.data.facingDir = 0;
      if (!unit.data.fainted) {
        this.playUnitAnim(unit, 'Idle');
      }
    }
  }

  private getBlockedStructureKeys(): Set<string> {
    const blocked = new Set<string>();
    for (const s of this.structures) {
      if (!s.data.ruined) {
        blocked.add(`${s.data.gx},${s.data.gy}`);
      }
    }
    return blocked;
  }

  private isValidUnitTile(gx: number, gy: number): boolean {
    if (isNoBuildTile(gx, gy, this.tiles, this.activePortals)) return false;
    if (this.getUnitAt(gx, gy)) return false;
    if (
      this.units.some(
        (u) =>
          !u.data.fainted && u.moveTarget?.gx === gx && u.moveTarget?.gy === gy,
      )
    ) {
      return false;
    }
    const struct = this.getStructureAt(gx, gy);
    if (struct && !struct.data.ruined) return false;
    return true;
  }

  private getUnitAt(gx: number, gy: number): UnitEntity | undefined {
    return this.units.find((u) => u.data.gx === gx && u.data.gy === gy);
  }

  private getStructureAt(gx: number, gy: number): StructureEntity | undefined {
    return this.structures.find((s) => s.data.gx === gx && s.data.gy === gy);
  }

  private findNearestEnemyInRange(
    gx: number,
    gy: number,
    range: number,
  ): EnemyEntity | null {
    let best: EnemyEntity | null = null;
    let bestDist = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      if (!isInCircularRange(gx, gy, enemy.gx, enemy.gy, range)) continue;
      const euclid = Math.hypot(enemy.gx - gx, enemy.gy - gy);
      if (euclid < bestDist) {
        bestDist = euclid;
        best = enemy;
      }
    }
    return best;
  }

  private findAdjacentLivingUnit(enemy: EnemyEntity): UnitEntity | null {
    let best: UnitEntity | null = null;
    let bestHp = Infinity;
    for (const unit of this.units) {
      if (unit.data.fainted) continue;
      if (manhattanDist(enemy.gx, enemy.gy, unit.data.gx, unit.data.gy) <= 1) {
        if (unit.data.hp < bestHp) {
          bestHp = unit.data.hp;
          best = unit;
        }
      }
    }
    return best;
  }

  private updateCoreBar(): void {
    const ratio = Phaser.Math.Clamp(this.coreHp / this.coreMaxHp, 0, 1);
    this.coreHpBarFill.width = CORE_HP_BAR_WIDTH * ratio;
    this.coreHpBarFill.setFillStyle(
      ratio > 0.5 ? 0x22d3ee : ratio > 0.25 ? 0xfacc15 : 0xef4444,
    );
    if (ratio > 0.25 && this.coreHpBarFill.alpha !== 1) {
      this.coreHpBarFill.setAlpha(1);
    }
  }

  private updateStructureBar(entity: StructureEntity): void {
    const ratio = Phaser.Math.Clamp(entity.data.hp / entity.data.maxHp, 0, 1);
    entity.hpBarFill.width = 34 * ratio;
    entity.hpBarFill.setVisible(!entity.data.ruined);
  }

  private setStatus(message: string): void {
    this.statusMessage = message;
    this.emitSnapshot();
  }

  private emitSnapshot(): void {
    if (this.inCombatFrame) {
      this.snapshotDirty = true;
      return;
    }
    this.snapshotDirty = false;
    this.sfx?.syncPhaseBgm(this.phase);
    this.game.events.emit('snapshot', this.getSnapshot());
  }
}
