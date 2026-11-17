import Phaser from 'phaser';
import {
  ENEMY_SPECIES,
  INITIAL_ACTIVE_IDS,
  INITIAL_RESERVE_IDS,
  POKEMON_SPECIES,
  REWARD_POOL,
  STRUCTURE_SPECS,
  WAVE_DEFINITIONS,
} from '../data/pokemon';
import {
  CORE_CELLS,
  createBaseGrid,
  findNearestBlockingWall,
  findPath,
  GridPoint,
  isNoBuildTile,
  SPAWN_EAST,
  SPAWN_WEST,
} from '../engine/pathfinding';
import {
  ActiveUnit,
  GamePhase,
  GameSnapshot,
  GridStructure,
  RewardOption,
  StructureKind,
  TileKind,
} from '../types';

const CANVAS_WIDTH = 864;
const CANVAS_HEIGHT = 576;
const TILE_SIZE = 48;
const GRID_COLS = 18;
const GRID_ROWS = 12;

const PREP_INITIAL_POSITIONS: readonly GridPoint[] = [
  { gx: 7, gy: 4 },
  { gx: 10, gy: 4 },
  { gx: 7, gy: 7 },
  { gx: 10, gy: 7 },
];

const INITIAL_GOLD = 140;
const INITIAL_AP = 8;
const MAX_AP = 10;
const CORE_MAX_HP = 1000;
const BERRY_HEAL_PER_SEC = 8;
const BARREL_DAMAGE = 120;
const BARREL_RADIUS = 1.8;
const ULT_RADIUS = 1.5;

interface UnitEntity {
  data: ActiveUnit;
  sprite: Phaser.GameObjects.Sprite;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  ultBarFill: Phaser.GameObjects.Rectangle;
  stationaryMs: number;
  isAttackAnimPlaying: boolean;
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
  side: 'west' | 'east';
  point: GridPoint;
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

export class BattleScene extends Phaser.Scene {
  private tiles: TileKind[][] = [];
  private phase: GamePhase = 'PREP';
  private wave = 1;
  private readonly maxWaves = WAVE_DEFINITIONS.length;
  private coreHp = CORE_MAX_HP;
  private coreMaxHp = CORE_MAX_HP;
  private gold = INITIAL_GOLD;
  private ap = INITIAL_AP;
  private maxAp = MAX_AP;
  private kills = 0;
  private speedMult: 1 | 2 = 1;
  private slowMo = false;

  private selectedTool: StructureKind | 'move_struct' | 'sell_struct' | null = null;
  private selectedUnitUid: string | null = null;
  private selectedStructureUid: string | null = null;
  private movingStructureUid: string | null = null;
  private aimingUltUnitUid: string | null = null;

  private units: UnitEntity[] = [];
  private reserveIds: string[] = [];
  private structures: StructureEntity[] = [];
  private enemies: EnemyEntity[] = [];
  private spawnQueue: SpawnEntry[] = [];

  private artifacts: string[] = [];
  private upgrades: string[] = [];
  private rewardChoices: RewardOption[] = [];
  private statusMessage = 'Prepare your defenses and position Pokémon.';

  private waveElapsedMs = 0;
  private berryHealTimerMs = 0;
  private nextUidCounter = 1;
  private hoverTile: GridPoint | null = null;

  private coreHpBarFill!: Phaser.GameObjects.Rectangle;
  private spawnMarkers: Phaser.GameObjects.Rectangle[] = [];
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private pathPreviewGraphics!: Phaser.GameObjects.Graphics;
  private transientVfx: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    (window as unknown as { __battleScene?: BattleScene }).__battleScene = this;
    this.registry.set('battleScene', this);

    this.tiles = createBaseGrid();
    this.renderTerrain();
    this.renderGridAndMarkers();
    this.renderBastionCore();

    this.highlightGraphics = this.add.graphics().setDepth(2);
    this.pathPreviewGraphics = this.add.graphics().setDepth(3);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerDown, this);

    this.initNewRunState();
  }

  update(_time: number, delta: number): void {
    const clampedDelta = Math.min(delta, 50);
    const timeScale = this.phase === 'COMBAT' ? (this.slowMo ? 0.35 : this.speedMult) : 1;
    this.anims.globalTimeScale = timeScale;
    this.tweens.timeScale = timeScale;

    if (this.phase !== 'COMBAT') return;

    const simDtMs = clampedDelta * timeScale;
    this.waveElapsedMs += simDtMs;

    this.processSpawnQueue();
    this.updateBerryBushes(simDtMs);
    this.updateEnemies(simDtMs);
    this.updateUnits(simDtMs);

    if (this.coreHp <= 0) {
      this.handleDefeat();
      return;
    }

    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.handleWaveComplete();
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
      coreHp: Math.max(0, Math.round(this.coreHp)),
      coreMaxHp: this.coreMaxHp,
      gold: this.gold,
      ap: this.ap,
      maxAp: this.maxAp,
      kills: this.kills,
      speedMult: this.speedMult,
      selectedTool: this.selectedTool,
      selectedUnitUid: this.selectedUnitUid,
      selectedStructureUid: this.selectedStructureUid,
      aimingUltUnitUid: this.aimingUltUnitUid,
      activeUnits: this.units.map((u) => ({ ...u.data })),
      reserveIds: [...this.reserveIds],
      structures: this.structures.map((s) => ({ ...s.data })),
      artifacts: [...this.artifacts],
      upgrades: [...this.upgrades],
      rewardChoices: this.rewardChoices.map((r) => ({ ...r })),
      statusMessage: this.statusMessage,
    };
  }

  public selectTool(tool: StructureKind | 'move_struct' | 'sell_struct' | null): void {
    if (this.phase !== 'PREP' && tool !== null) {
      this.setStatus('Structures can only be built, moved, or sold during Prep.');
      return;
    }
    this.selectedTool = this.selectedTool === tool ? null : tool;
    this.movingStructureUid = null;
    this.aimingUltUnitUid = null;
    if (this.selectedTool !== null) {
      this.selectedUnitUid = null;
      this.selectedStructureUid = null;
    }
    this.refreshHighlights();
    this.emitSnapshot();
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
      this.setStatus(`${POKEMON_SPECIES[unit.data.speciesId].name} is fainted.`);
      return;
    }

    this.selectedTool = null;
    this.selectedUnitUid = uid;
    this.slowMo = this.phase === 'COMBAT';
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
    this.slowMo = false;
    this.waveElapsedMs = 0;
    this.berryHealTimerMs = 0;

    this.buildSpawnQueue();
    this.pathPreviewGraphics.clear();
    this.refreshHighlights();

    const waveDef = WAVE_DEFINITIONS[this.wave - 1];
    this.setStatus(waveDef ? `${waveDef.title} begun!` : `Wave ${this.wave} begun!`);
  }

  public toggleSpeed(): void {
    this.speedMult = this.speedMult === 1 ? 2 : 1;
    this.emitSnapshot();
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
      this.setStatus(`${POKEMON_SPECIES[unit.data.speciesId].name}'s Ultimate is not ready.`);
      return;
    }

    this.selectedTool = null;
    this.selectedUnitUid = null;
    this.selectedStructureUid = null;
    this.aimingUltUnitUid = uid;
    this.slowMo = true;
    this.refreshHighlights();
    this.setStatus(
      `Click a tile to cast ${POKEMON_SPECIES[unit.data.speciesId].ultName} (Right-click to cancel).`,
    );
  }

  public repairStructure(uid: string): void {
    const entity = this.structures.find((s) => s.data.uid === uid);
    if (!entity) return;
    if (!entity.data.ruined && entity.data.hp >= entity.data.maxHp) return;

    const spec = STRUCTURE_SPECS[entity.data.kind];
    const missingRatio = 1 - entity.data.hp / entity.data.maxHp;
    const cost = Math.max(5, Math.ceil(spec.cost * 0.5 * missingRatio));
    if (this.gold < cost) {
      this.setStatus(`Need ${cost}G to repair ${spec.name}.`);
      return;
    }

    if (entity.data.ruined && this.getUnitAt(entity.data.gx, entity.data.gy)) {
      this.setStatus('Cannot repair while a Pokémon is standing on the rubble.');
      return;
    }

    this.gold -= cost;
    entity.data.hp = entity.data.maxHp;
    entity.data.ruined = false;
    entity.sprite.setTexture(`tex:${entity.data.kind}`);
    this.updateStructureBar(entity);
    this.invalidateEnemyPaths();
    this.refreshPathPreview();
    this.setStatus(`Repaired ${spec.name} (-${cost}G).`);
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

    const cost = 15;
    if (this.gold < cost) {
      this.setStatus(`Need ${cost}G to heal ${POKEMON_SPECIES[unit.data.speciesId].name}.`);
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
    this.setStatus(`Healed ${POKEMON_SPECIES[unit.data.speciesId].name} (-${cost}G).`);
  }

  public reviveUnit(uid: string): void {
    const unit = this.units.find((u) => u.data.uid === uid);
    if (!unit || !unit.data.fainted) return;

    const cost = 35;
    if (this.gold < cost) {
      this.setStatus(`Need ${cost}G to revive ${POKEMON_SPECIES[unit.data.speciesId].name}.`);
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
    this.spawnFloatingText(unit.sprite.x, unit.sprite.y - 24, 'REVIVED!', '#fde047');
    this.setStatus(`Revived ${POKEMON_SPECIES[unit.data.speciesId].name} (-${cost}G).`);
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
    const newMaxHp = this.computeUnitMaxHp(newSpecies.maxHp);

    unit.data.speciesId = reserveSpeciesId;
    unit.data.maxHp = newMaxHp;
    unit.data.hp = newMaxHp;
    unit.data.ult = 0;
    unit.data.ultMax = newSpecies.ultMax;
    unit.data.autoUlt = newSpecies.ultAutoDefault;
    unit.data.fainted = false;
    unit.data.attackCooldownMs = 0;
    unit.data.hitCount = 0;
    unit.isAttackAnimPlaying = false;
    unit.sprite.setAlpha(1);
    unit.sprite.clearTint();
    this.playUnitAnim(unit, 'Idle');
    this.updateUnitBars(unit);

    this.setStatus(`Swapped ${POKEMON_SPECIES[oldSpeciesId].name} for ${newSpecies.name}.`);
  }

  public pickReward(rewardId: string): void {
    if (this.phase !== 'REWARD') return;
    const choice = this.rewardChoices.find((r) => r.id === rewardId);
    if (!choice) return;

    if (choice.kind === 'upgrade') {
      this.upgrades.push(choice.id);
      if (choice.id === 'thick_hide') {
        for (const u of this.units) {
          const prevMax = u.data.maxHp;
          u.data.maxHp = this.computeUnitMaxHp(POKEMON_SPECIES[u.data.speciesId].maxHp);
          if (!u.data.fainted) {
            u.data.hp = Math.min(u.data.maxHp, u.data.hp + (u.data.maxHp - prevMax));
          }
          this.updateUnitBars(u);
        }
      }
    } else if (choice.kind === 'artifact') {
      this.artifacts.push(choice.id);
      if (choice.id === 'fortification_core') {
        for (const s of this.structures) {
          const prevMax = s.data.maxHp;
          s.data.maxHp = this.computeStructureMaxHp(STRUCTURE_SPECS[s.data.kind].maxHp);
          if (!s.data.ruined) {
            s.data.hp = Math.min(s.data.maxHp, s.data.hp + (s.data.maxHp - prevMax));
          }
          this.updateStructureBar(s);
        }
      }
    } else if (choice.kind === 'recruit' && choice.speciesId) {
      if (!this.reserveIds.includes(choice.speciesId)) {
        this.reserveIds.push(choice.speciesId);
      }
    }

    this.rewardChoices = [];
    this.wave += 1;
    this.phase = 'PREP';
    this.refreshPathPreview();
    this.refreshHighlights();
    this.setStatus(`Picked ${choice.title}. Prepare for Wave ${this.wave}!`);
  }

  public restartRun(): void {
    this.clearDynamicEntities();
    this.initNewRunState();
  }

  // ---------------------------------------------------------------------------
  // Setup & Rendering
  // ---------------------------------------------------------------------------

  private renderTerrain(): void {
    for (let gy = 0; gy < GRID_ROWS; gy++) {
      for (let gx = 0; gx < GRID_COLS; gx++) {
        const tile = this.tiles[gy][gx];
        const frame = tile === 'grass' ? 0 : tile === 'water' ? 7 : 1;
        this.add
          .image(tileCenterX(gx), tileCenterY(gy), 'mpwsp01', frame)
          .setScale(3)
          .setDepth(0);
      }
    }
  }

  private renderGridAndMarkers(): void {
    const gridG = this.add.graphics().setDepth(1);
    gridG.lineStyle(1, 0xffffff, 0.08);
    for (let gx = 0; gx <= GRID_COLS; gx++) {
      gridG.lineBetween(gx * TILE_SIZE, 0, gx * TILE_SIZE, CANVAS_HEIGHT);
    }
    for (let gy = 0; gy <= GRID_ROWS; gy++) {
      gridG.lineBetween(0, gy * TILE_SIZE, CANVAS_WIDTH, gy * TILE_SIZE);
    }

    this.spawnMarkers = [];
    for (const pt of [...SPAWN_WEST, ...SPAWN_EAST]) {
      const marker = this.add
        .rectangle(tileCenterX(pt.gx), tileCenterY(pt.gy), TILE_SIZE - 4, TILE_SIZE - 4, 0xf43f5e, 0.18)
        .setStrokeStyle(1, 0xfb7185, 0.45)
        .setDepth(1);
      this.spawnMarkers.push(marker);
    }

    this.tweens.add({
      targets: this.spawnMarkers,
      alpha: { from: 0.35, to: 0.85 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private renderBastionCore(): void {
    const cx = 9 * TILE_SIZE;
    const cy = 6 * TILE_SIZE;
    this.add.image(cx, cy, 'tex:core').setDepth(4);

    this.add.rectangle(cx, cy + 44, 72, 6, 0x0f172a, 0.85).setDepth(7);
    this.coreHpBarFill = this.add
      .rectangle(cx - 35, cy + 44, 70, 4, 0x22d3ee, 1)
      .setOrigin(0, 0.5)
      .setDepth(7);
  }

  private initNewRunState(): void {
    this.phase = 'PREP';
    this.wave = 1;
    this.coreHp = CORE_MAX_HP;
    this.coreMaxHp = CORE_MAX_HP;
    this.gold = INITIAL_GOLD;
    this.ap = INITIAL_AP;
    this.maxAp = MAX_AP;
    this.kills = 0;
    this.speedMult = 1;
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
    this.reserveIds = [...INITIAL_RESERVE_IDS];
    this.spawnQueue = [];
    this.waveElapsedMs = 0;
    this.berryHealTimerMs = 0;

    for (let i = 0; i < INITIAL_ACTIVE_IDS.length; i++) {
      const pos = PREP_INITIAL_POSITIONS[i];
      this.spawnUnit(INITIAL_ACTIVE_IDS[i], pos.gx, pos.gy);
    }

    this.updateCoreBar();
    this.refreshPathPreview();
    this.refreshHighlights();
    this.setStatus('Wave 1 Prep: build barricades or reposition your Pokémon.');
  }

  private clearDynamicEntities(): void {
    for (const u of this.units) {
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
      e.sprite.destroy();
      e.hpBarBg.destroy();
      e.hpBarFill.destroy();
    }
    this.enemies = [];

    for (const v of this.transientVfx) {
      if (v.active) v.destroy();
    }
    this.transientVfx = [];
    this.spawnQueue = [];
  }

  // ---------------------------------------------------------------------------
  // Input Handling
  // ---------------------------------------------------------------------------

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.x < 0 || pointer.x >= CANVAS_WIDTH || pointer.y < 0 || pointer.y >= CANVAS_HEIGHT) {
      if (this.hoverTile !== null) {
        this.hoverTile = null;
        this.refreshHighlights();
      }
      return;
    }

    const pt = worldToGrid(pointer.x, pointer.y);
    if (!this.hoverTile || this.hoverTile.gx !== pt.gx || this.hoverTile.gy !== pt.gy) {
      this.hoverTile = pt;
      this.refreshHighlights();
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.x < 0 || pointer.x >= CANVAS_WIDTH || pointer.y < 0 || pointer.y >= CANVAS_HEIGHT) {
      return;
    }

    if (pointer.rightButtonDown()) {
      this.cancelActiveSelections();
      return;
    }

    if (this.phase !== 'PREP' && this.phase !== 'COMBAT') return;

    const { gx, gy } = worldToGrid(pointer.x, pointer.y);

    if (this.aimingUltUnitUid) {
      this.executeAimedUlt(gx, gy);
      return;
    }

    if (this.phase === 'PREP') {
      this.handlePrepClick(gx, gy);
    } else {
      this.handleCombatClick(gx, gy);
    }
  }

  private cancelActiveSelections(): void {
    this.selectedTool = null;
    this.selectedUnitUid = null;
    this.selectedStructureUid = null;
    this.movingStructureUid = null;
    this.aimingUltUnitUid = null;
    this.slowMo = false;
    this.refreshHighlights();
    this.emitSnapshot();
  }

  private handlePrepClick(gx: number, gy: number): void {
    const clickedStructure = this.getStructureAt(gx, gy);
    const clickedUnit = this.getUnitAt(gx, gy);

    if (this.selectedTool === 'sell_struct') {
      if (clickedStructure) {
        this.sellStructure(clickedStructure);
      }
      return;
    }

    if (this.selectedTool === 'move_struct') {
      this.handleMoveStructureClick(gx, gy, clickedStructure, clickedUnit);
      return;
    }

    if (this.selectedTool !== null) {
      this.tryPlaceStructure(this.selectedTool, gx, gy);
      return;
    }

    // No tool selected: unit selection / free repositioning / structure selection
    if (clickedUnit) {
      this.selectedUnitUid = clickedUnit.data.uid;
      this.selectedStructureUid = null;
      this.refreshHighlights();
      this.setStatus(
        `Selected ${POKEMON_SPECIES[clickedUnit.data.speciesId].name}. Click an empty tile to reposition (0 AP in Prep).`,
      );
      return;
    }

    if (this.selectedUnitUid && !clickedStructure && this.isValidUnitTile(gx, gy)) {
      const unit = this.units.find((u) => u.data.uid === this.selectedUnitUid);
      if (unit) {
        this.moveUnitToTile(unit, gx, gy, false);
        this.refreshHighlights();
        this.emitSnapshot();
        return;
      }
    }

    if (clickedStructure) {
      this.selectedStructureUid = clickedStructure.data.uid;
      this.selectedUnitUid = null;
      this.refreshHighlights();
      this.emitSnapshot();
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
        this.refreshHighlights();
        this.setStatus(
          `Moving ${STRUCTURE_SPECS[clickedStructure.data.kind].name}. Click a valid empty tile.`,
        );
      }
      return;
    }

    const moving = this.structures.find((s) => s.data.uid === this.movingStructureUid);
    if (!moving) {
      this.movingStructureUid = null;
      this.refreshHighlights();
      return;
    }

    if (clickedStructure) {
      this.movingStructureUid =
        clickedStructure.data.uid === moving.data.uid ? null : clickedStructure.data.uid;
      this.refreshHighlights();
      this.emitSnapshot();
      return;
    }

    if (isNoBuildTile(gx, gy, this.tiles) || clickedUnit) {
      this.setStatus('Cannot move structure to that tile.');
      return;
    }

    moving.data.gx = gx;
    moving.data.gy = gy;
    const cx = tileCenterX(gx);
    const cy = tileCenterY(gy);
    moving.sprite.setPosition(cx, cy);
    moving.hpBarBg.setPosition(cx, cy + 20);
    moving.hpBarFill.setPosition(cx - 17, cy + 20);

    this.movingStructureUid = null;
    this.refreshPathPreview();
    this.refreshHighlights();
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
        const dist = manhattanDist(unit.data.gx, unit.data.gy, gx, gy);
        const moveRange = this.getUnitMoveRange(unit);
        const apCost = dist > 0 && dist <= moveRange ? 1 : dist <= moveRange * 2 ? 2 : 0;

        if (apCost > 0 && this.isValidUnitTile(gx, gy)) {
          if (this.ap < apCost) {
            this.setStatus(`Need ${apCost} AP to move there.`);
            return;
          }
          this.ap -= apCost;
          this.moveUnitToTile(unit, gx, gy, true);
          this.selectedUnitUid = null;
          this.slowMo = false;
          this.refreshHighlights();
          this.setStatus(
            `${POKEMON_SPECIES[unit.data.speciesId].name} dashed (-${apCost} AP).`,
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
    if (isNoBuildTile(gx, gy, this.tiles)) {
      this.setStatus('Cannot build on spawn lanes, water moats, or the Bastion Core.');
      return;
    }
    if (this.getStructureAt(gx, gy) || this.getUnitAt(gx, gy)) {
      this.setStatus('Tile is already occupied.');
      return;
    }
    if (this.gold < spec.cost) {
      this.setStatus(`Need ${spec.cost}G to build ${spec.name}.`);
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
    const sprite = this.add.image(cx, cy, `tex:${kind}`).setDepth(4);
    const hpBarBg = this.add.rectangle(cx, cy + 20, 36, 4, 0x0f172a, 0.85).setDepth(7);
    const hpBarFill = this.add
      .rectangle(cx - 17, cy + 20, 34, 2, 0x38bdf8, 1)
      .setOrigin(0, 0.5)
      .setDepth(7);

    const entity: StructureEntity = { data, sprite, hpBarBg, hpBarFill };
    this.structures.push(entity);
    this.updateStructureBar(entity);
    this.refreshPathPreview();
    this.refreshHighlights();
    this.setStatus(`Built ${spec.name} (-${spec.cost}G).`);
  }

  private sellStructure(entity: StructureEntity): void {
    const spec = STRUCTURE_SPECS[entity.data.kind];
    const refund = Math.round(spec.cost * 0.7);
    this.gold += refund;
    this.removeStructureEntity(entity);
    this.refreshPathPreview();
    this.refreshHighlights();
    this.setStatus(`Sold ${spec.name} (+${refund}G).`);
  }

  private removeStructureEntity(entity: StructureEntity): void {
    entity.sprite.destroy();
    entity.hpBarBg.destroy();
    entity.hpBarFill.destroy();
    this.structures = this.structures.filter((s) => s.data.uid !== entity.data.uid);
    if (this.selectedStructureUid === entity.data.uid) {
      this.selectedStructureUid = null;
    }
    if (this.movingStructureUid === entity.data.uid) {
      this.movingStructureUid = null;
    }
  }

  private getBlockedWallKeys(): Set<string> {
    const blocked = new Set<string>();
    for (const s of this.structures) {
      if (!s.data.ruined && s.data.hp > 0 && STRUCTURE_SPECS[s.data.kind].blocksGround) {
        blocked.add(keyOf(s.data.gx, s.data.gy));
      }
    }
    return blocked;
  }

  private refreshPathPreview(): void {
    this.pathPreviewGraphics.clear();
    if (this.phase !== 'PREP') return;

    const blockedWalls = this.getBlockedWallKeys();
    const starts: GridPoint[] = [
      { gx: 0, gy: 5 },
      { gx: 17, gy: 5 },
    ];

    for (const start of starts) {
      const openPath = findPath(start, this.tiles, blockedWalls, 'ground');
      if (openPath && openPath.length > 1) {
        this.drawDashedPath(openPath, 0x22d3ee, 0.85);
        continue;
      }

      const blockingWall = findNearestBlockingWall(
        start,
        this.tiles,
        this.structures.map((s) => s.data),
      );
      if (blockingWall) {
        const toWall = this.findPathToTile(start, {
          gx: blockingWall.gx,
          gy: blockingWall.gy,
        });
        if (toWall.length > 1) {
          this.drawDashedPath(toWall, 0xf97316, 0.9);
        }
        this.pathPreviewGraphics.lineStyle(2, 0xef4444, 0.9);
        this.pathPreviewGraphics.strokeRect(
          blockingWall.gx * TILE_SIZE + 4,
          blockingWall.gy * TILE_SIZE + 4,
          TILE_SIZE - 8,
          TILE_SIZE - 8,
        );
      }
    }
  }

  private drawDashedPath(points: GridPoint[], color: number, alpha: number): void {
    this.pathPreviewGraphics.lineStyle(2.5, color, alpha);
    const dashLen = 8;
    const gapLen = 6;

    for (let i = 0; i < points.length - 1; i++) {
      const x1 = tileCenterX(points[i].gx);
      const y1 = tileCenterY(points[i].gy);
      const x2 = tileCenterX(points[i + 1].gx);
      const y2 = tileCenterY(points[i + 1].gy);
      const dist = Math.hypot(x2 - x1, y2 - y1);
      if (dist <= 0) continue;

      const ux = (x2 - x1) / dist;
      const uy = (y2 - y1) / dist;
      let d = 0;
      while (d < dist) {
        const end = Math.min(d + dashLen, dist);
        this.pathPreviewGraphics.lineBetween(x1 + ux * d, y1 + uy * d, x1 + ux * end, y1 + uy * end);
        d += dashLen + gapLen;
      }
    }
  }

  /**
   * 4-dir BFS from `start` to `target` avoiding water and intact walls (except `target` itself).
   */
  private findPathToTile(start: GridPoint, target: GridPoint): GridPoint[] {
    if (start.gx === target.gx && start.gy === target.gy) return [start];

    const blockedWalls = this.getBlockedWallKeys();
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

  private refreshHighlights(): void {
    this.highlightGraphics.clear();

    // Selected structure outline
    if (this.selectedStructureUid) {
      const s = this.structures.find((st) => st.data.uid === this.selectedStructureUid);
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
      const s = this.structures.find((st) => st.data.uid === this.movingStructureUid);
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

    // Unit movement rings
    if (this.selectedUnitUid) {
      const unit = this.units.find((u) => u.data.uid === this.selectedUnitUid);
      if (unit && !unit.data.fainted) {
        const moveRange = this.getUnitMoveRange(unit);
        this.highlightGraphics.lineStyle(2, 0x22d3ee, 1);
        this.highlightGraphics.strokeRect(
          unit.data.gx * TILE_SIZE + 2,
          unit.data.gy * TILE_SIZE + 2,
          TILE_SIZE - 4,
          TILE_SIZE - 4,
        );

        for (let gy = 0; gy < GRID_ROWS; gy++) {
          for (let gx = 0; gx < GRID_COLS; gx++) {
            const dist = manhattanDist(unit.data.gx, unit.data.gy, gx, gy);
            if (dist === 0 || !this.isValidUnitTile(gx, gy)) continue;

            if (dist <= moveRange) {
              this.highlightGraphics.fillStyle(0x22d3ee, 0.22);
              this.highlightGraphics.fillRect(
                gx * TILE_SIZE + 2,
                gy * TILE_SIZE + 2,
                TILE_SIZE - 4,
                TILE_SIZE - 4,
              );
            } else if (dist <= moveRange * 2) {
              const color = this.phase === 'COMBAT' ? 0xf59e0b : 0x22d3ee;
              const alpha = this.phase === 'COMBAT' ? 0.2 : 0.1;
              this.highlightGraphics.fillStyle(color, alpha);
              this.highlightGraphics.fillRect(
                gx * TILE_SIZE + 2,
                gy * TILE_SIZE + 2,
                TILE_SIZE - 4,
                TILE_SIZE - 4,
              );
            }
          }
        }
      }
    }

    // Ultimate aiming circle preview
    if (this.aimingUltUnitUid && this.hoverTile) {
      const cx = tileCenterX(this.hoverTile.gx);
      const cy = tileCenterY(this.hoverTile.gy);
      const radiusPx = ULT_RADIUS * TILE_SIZE;
      this.highlightGraphics.fillStyle(0xfbbf24, 0.22);
      this.highlightGraphics.fillCircle(cx, cy, radiusPx);
      this.highlightGraphics.lineStyle(2, 0xfbbf24, 0.9);
      this.highlightGraphics.strokeCircle(cx, cy, radiusPx);
    } else if (this.hoverTile && this.selectedTool !== null && this.phase === 'PREP') {
      const { gx, gy } = this.hoverTile;
      const canPlace =
        this.selectedTool === 'move_struct' || this.selectedTool === 'sell_struct'
          ? Boolean(this.getStructureAt(gx, gy) || this.movingStructureUid)
          : !isNoBuildTile(gx, gy, this.tiles) &&
            !this.getStructureAt(gx, gy) &&
            !this.getUnitAt(gx, gy);
      this.highlightGraphics.lineStyle(2, canPlace ? 0x4ade80 : 0xef4444, 0.9);
      this.highlightGraphics.strokeRect(
        gx * TILE_SIZE + 2,
        gy * TILE_SIZE + 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Units
  // ---------------------------------------------------------------------------

  private spawnUnit(speciesId: string, gx: number, gy: number): UnitEntity {
    const spec = POKEMON_SPECIES[speciesId];
    const maxHp = this.computeUnitMaxHp(spec.maxHp);
    const data: ActiveUnit = {
      uid: `unit_${this.nextUidCounter++}`,
      speciesId,
      gx,
      gy,
      hp: maxHp,
      maxHp,
      ult: 0,
      ultMax: spec.ultMax,
      autoUlt: spec.ultAutoDefault,
      fainted: false,
      facingDir: gx < 9 ? 6 : 2,
      attackCooldownMs: 0,
      hitCount: 0,
    };

    const cx = tileCenterX(gx);
    const cy = tileCenterY(gy);
    const sprite = this.add.sprite(cx, cy, `pmd:${speciesId}:Idle`).setDepth(5);
    const hpBarBg = this.add.rectangle(cx, cy - 22, 36, 6, 0x0f172a, 0.85).setDepth(7);
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
    };
    this.units.push(entity);
    this.playUnitAnim(entity, 'Idle');
    this.updateUnitBars(entity);
    return entity;
  }

  private moveUnitToTile(unit: UnitEntity, gx: number, gy: number, animateDash: boolean): void {
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
          if (!unit.data.fainted && !unit.isAttackAnimPlaying) {
            this.playUnitAnim(unit, 'Idle');
          }
        },
      });
    } else {
      unit.sprite.setPosition(tx, ty);
      this.syncUnitBarPositions(unit);
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
    unit.hpBarFill.setFillStyle(hpRatio > 0.5 ? 0x4ade80 : hpRatio > 0.25 ? 0xfacc15 : 0xef4444);

    const ultRatio = Phaser.Math.Clamp(unit.data.ult / unit.data.ultMax, 0, 1);
    unit.ultBarFill.width = 34 * ultRatio;
  }

  private playUnitAnim(unit: UnitEntity, animName: 'Idle' | 'Walk' | 'Attack'): void {
    const key = `anim:pmd:${unit.data.speciesId}:${animName}:${unit.data.facingDir}`;
    if (!this.anims.exists(key)) return;

    if (animName === 'Attack') {
      unit.isAttackAnimPlaying = true;
      unit.sprite.play(key, false);
      unit.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        unit.isAttackAnimPlaying = false;
        if (!unit.data.fainted && unit.sprite.active) {
          this.playUnitAnim(unit, 'Idle');
        }
      });
      return;
    }

    if (unit.sprite.anims.currentAnim?.key !== key) {
      unit.sprite.play(key, true);
    }
  }

  private updateUnits(simDtMs: number): void {
    let changed = false;

    for (const unit of this.units) {
      if (unit.data.fainted) continue;

      unit.stationaryMs += simDtMs;
      unit.data.attackCooldownMs = Math.max(0, unit.data.attackCooldownMs - simDtMs);

      const spec = POKEMON_SPECIES[unit.data.speciesId];

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

      const target = this.findNearestEnemyInRange(unit.data.gx, unit.data.gy, spec.range);
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
    unit.data.hitCount += 1;

    let dmg = this.getUnitAtk(unit);
    let isCrit = false;

    if (unit.data.speciesId === '0448' && unit.data.hitCount % 4 === 0) {
      dmg = Math.round(dmg * 1.75);
      isCrit = true;
    }
    if (unit.data.speciesId === '0094' && (target.burnTimerMs > 0 || target.slowTimerMs > 0)) {
      dmg = Math.round(dmg * 1.35);
    }

    const baseCharge = 15 * (unit.data.speciesId === '0025' ? 1.1 : 1);
    this.addUnitUlt(unit, baseCharge);

    const applyHit = () => {
      if (target.hp > 0) {
        if (unit.data.speciesId === '0004') {
          target.burnTimerMs = 3000;
          target.burnDps = 6;
        }
        if (unit.data.speciesId === '0012') {
          target.slowTimerMs = 3000; // Butterfree passive: +50% slow duration (2s -> 3s)
        }
        this.damageEnemy(target, dmg, unit, isCrit);
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
    const spec = POKEMON_SPECIES[unit.data.speciesId];
    const isHealUlt = unit.data.speciesId === '0001' || unit.data.speciesId === '0012';

    if (isHealUlt) {
      let bestAlly: UnitEntity | null = null;
      let lowestRatio = 0.85;
      for (const ally of this.units) {
        if (ally.data.fainted) continue;
        if (chebyshevDist(unit.data.gx, unit.data.gy, ally.data.gx, ally.data.gy) > spec.range + 2) {
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

    const nearest = this.findNearestEnemyInRange(unit.data.gx, unit.data.gy, spec.range + 2);
    return nearest ? { gx: nearest.gx, gy: nearest.gy } : null;
  }

  private executeAimedUlt(gx: number, gy: number): void {
    const unit = this.units.find((u) => u.data.uid === this.aimingUltUnitUid);
    this.aimingUltUnitUid = null;
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
    unit.data.facingDir = vectorToPmdDir(gx - unit.data.gx, gy - unit.data.gy, unit.data.facingDir);
    this.playUnitAnim(unit, 'Attack');

    const tx = tileCenterX(gx);
    const ty = tileCenterY(gy);
    this.spawnOneShotVfx(spec.ultVfx, tx, ty, 1.15);

    const atk = this.getUnitAtk(unit);

    if (unit.data.speciesId === '0001' || unit.data.speciesId === '0012') {
      const healAmount = Math.round(atk * 2.5);
      for (const ally of this.units) {
        if (ally.data.fainted) continue;
        if (Math.hypot(ally.data.gx - gx, ally.data.gy - gy) <= ULT_RADIUS) {
          const prevHp = ally.data.hp;
          ally.data.hp = Math.min(ally.data.maxHp, ally.data.hp + healAmount);
          const actualHeal = Math.round(ally.data.hp - prevHp);
          if (actualHeal > 0) {
            this.spawnFloatingText(ally.sprite.x, ally.sprite.y - 24, `+${actualHeal}`, '#4ade80');
          }
          this.updateUnitBars(ally);
        }
      }
      if (unit.data.speciesId === '0012') {
        for (const enemy of [...this.enemies]) {
          if (Math.hypot(enemy.gx - gx, enemy.gy - gy) <= ULT_RADIUS) {
            enemy.stunTimerMs = Math.max(enemy.stunTimerMs, 1500);
            enemy.slowTimerMs = Math.max(enemy.slowTimerMs, 3500);
          }
        }
      }
    } else {
      const ultDmg = Math.round(atk * 2.2);
      for (const enemy of [...this.enemies]) {
        if (Math.hypot(enemy.gx - gx, enemy.gy - gy) <= ULT_RADIUS) {
          if (unit.data.speciesId === '0143') {
            enemy.stunTimerMs = Math.max(enemy.stunTimerMs, 1500);
          }
          if (unit.data.speciesId === '0007' || unit.data.speciesId === '0143') {
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
    const waveDef = WAVE_DEFINITIONS[this.wave - 1];
    if (!waveDef) return;

    let westIdx = 0;
    let eastIdx = 0;

    for (const group of waveDef.spawns) {
      const delay = group.delayMs ?? 0;
      for (let i = 0; i < group.count; i++) {
        const side: 'west' | 'east' =
          group.side === 'both' ? (i % 2 === 0 ? 'west' : 'east') : group.side;
        const point =
          side === 'west'
            ? SPAWN_WEST[westIdx++ % SPAWN_WEST.length]
            : SPAWN_EAST[eastIdx++ % SPAWN_EAST.length];
        this.spawnQueue.push({
          spawnAtMs: delay + i * group.intervalMs,
          speciesId: group.speciesId,
          side,
          point,
        });
      }
    }

    this.spawnQueue.sort((a, b) => a.spawnAtMs - b.spawnAtMs);
  }

  private processSpawnQueue(): void {
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].spawnAtMs <= this.waveElapsedMs) {
      const next = this.spawnQueue.shift()!;
      this.spawnEnemy(next.speciesId, next.point);
    }
  }

  private spawnEnemy(speciesId: string, point: GridPoint): void {
    const spec = ENEMY_SPECIES[speciesId];
    if (!spec) return;

    const x = tileCenterX(point.gx);
    const y = tileCenterY(point.gy);
    const facingDir = point.gx < 9 ? 2 : 6;

    const sprite = this.add
      .sprite(x, y, `pmd:${speciesId}:Walk`)
      .setDepth(spec.movementType === 'fly' ? 6 : 5);
    const hpBarBg = this.add.rectangle(x, y - 20, 32, 4, 0x0f172a, 0.85).setDepth(7);
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
    for (const enemy of [...this.enemies]) {
      if (enemy.hp <= 0) continue;

      const spec = ENEMY_SPECIES[enemy.speciesId];
      enemy.attackCooldownMs = Math.max(0, enemy.attackCooldownMs - simDtMs);
      enemy.slowTimerMs = Math.max(0, enemy.slowTimerMs - simDtMs);
      enemy.stunTimerMs = Math.max(0, enemy.stunTimerMs - simDtMs);
      enemy.repathTimerMs -= simDtMs;

      // Burn DoT
      if (enemy.burnTimerMs > 0) {
        enemy.burnTimerMs = Math.max(0, enemy.burnTimerMs - simDtMs);
        enemy.burnTickMs += simDtMs;
        if (enemy.burnTickMs >= 500) {
          enemy.burnTickMs -= 500;
          this.damageEnemy(enemy, Math.round(enemy.burnDps * 0.5), null, false);
          if (enemy.hp <= 0) continue;
        }
      }

      if (enemy.stunTimerMs > 0) continue;

      // Barrel trap trigger for non-flying enemies
      if (spec.movementType !== 'fly') {
        const structHere = this.getStructureAt(enemy.gx, enemy.gy);
        if (structHere && structHere.data.kind === 'barrel' && !structHere.data.ruined) {
          this.explodeBarrel(structHere);
          if (enemy.hp <= 0) continue;
        }
      }

      // Check adjacent attack targets: Core -> blocking unit -> blocking wall
      const adjCore = CORE_CELLS.find((c) => manhattanDist(enemy.gx, enemy.gy, c.gx, c.gy) <= 1);
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
          (s) => s.data.uid === enemy.targetWallUid && !s.data.ruined && s.data.hp > 0,
        );
        if (wall && manhattanDist(enemy.gx, enemy.gy, wall.data.gx, wall.data.gy) <= 1) {
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
    enemy.facingDir = vectorToPmdDir(tx - enemy.x, ty - enemy.y, enemy.facingDir);
    if (enemy.attackCooldownMs > 0) return;

    const spec = ENEMY_SPECIES[enemy.speciesId];
    enemy.attackCooldownMs = 1000;
    this.playEnemyAnim(enemy, 'Attack');
    this.spawnOneShotVfx(spec.hitVfx, tx, ty, 0.9);

    this.coreHp = Math.max(0, this.coreHp - spec.atk);
    this.updateCoreBar();
    this.spawnFloatingText(9 * TILE_SIZE, 6 * TILE_SIZE - 28, `-${spec.atk}`, '#f43f5e');
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

    const def = this.getUnitDef(unit);
    let dmg = Math.max(2, Math.round(enemySpec.atk * (40 / (40 + def))));
    if (unit.data.speciesId === '0143' && unit.stationaryMs >= 500) {
      dmg = Math.max(2, Math.round(dmg * 0.75));
    }

    unit.data.hp = Math.max(0, unit.data.hp - dmg);
    this.spawnFloatingText(unit.sprite.x, unit.sprite.y - 24, `-${dmg}`, '#fb7185');

    if (unit.data.hp <= 0) {
      unit.data.fainted = true;
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

  private enemyAttackStructure(enemy: EnemyEntity, struct: StructureEntity): void {
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
    this.spawnFloatingText(struct.sprite.x, struct.sprite.y - 20, `-${dmg}`, '#fdba74');

    if (struct.data.hp <= 0) {
      if (struct.data.kind === 'barrel') {
        this.explodeBarrel(struct);
      } else {
        struct.data.ruined = true;
        struct.sprite.setTexture('tex:ruined');
        this.updateStructureBar(struct);
        this.invalidateEnemyPaths();
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
    enemy.hp = Math.max(0, enemy.hp - amount);

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

  private handleEnemyKilled(enemy: EnemyEntity, attacker: UnitEntity | null): void {
    const spec = ENEMY_SPECIES[enemy.speciesId];
    const bountyMult = this.artifacts.includes('commanders_insignia') ? 1.25 : 1;
    const bounty = Math.round(spec.bounty * bountyMult);

    this.gold += bounty;
    this.kills += 1;

    const apInterval = this.artifacts.includes('temporal_gear') ? 4 : 6;
    if (this.kills % apInterval === 0 && this.ap < this.maxAp) {
      this.ap += 1;
      this.spawnFloatingText(enemy.x, enemy.y - 36, '+1 AP', '#38bdf8');
    }

    if (attacker && !attacker.data.fainted) {
      this.addUnitUlt(attacker, 15);
    }

    this.spawnFloatingText(enemy.x, enemy.y - 10, `+${bounty}G`, '#facc15');
    enemy.sprite.destroy();
    enemy.hpBarBg.destroy();
    enemy.hpBarFill.destroy();
    this.enemies = this.enemies.filter((e) => e.uid !== enemy.uid);
    this.emitSnapshot();
  }

  private knockbackEnemy(enemy: EnemyEntity, fromX: number, fromY: number): void {
    const dx = enemy.x - fromX;
    const dy = enemy.y - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = Phaser.Math.Clamp(enemy.x + (dx / dist) * 28, 12, CANVAS_WIDTH - 12);
    const ny = Phaser.Math.Clamp(enemy.y + (dy / dist) * 28, 12, CANVAS_HEIGHT - 12);
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
    enemy.hpBarBg.setPosition(enemy.x, enemy.y - 20);
    enemy.hpBarFill.setPosition(enemy.x - 15, enemy.y - 20);
  }

  private playEnemyAnim(enemy: EnemyEntity, animName: 'Walk' | 'Attack'): void {
    const key = `anim:pmd:${enemy.speciesId}:${animName}:${enemy.facingDir}`;
    if (!this.anims.exists(key)) return;

    if (animName === 'Attack') {
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
      if (struct.data.kind !== 'berry_bush' || struct.data.ruined || struct.data.hp <= 0) continue;

      for (const unit of this.units) {
        if (unit.data.fainted || unit.data.hp >= unit.data.maxHp) continue;
        if (chebyshevDist(unit.data.gx, unit.data.gy, struct.data.gx, struct.data.gy) <= 1) {
          const prev = unit.data.hp;
          unit.data.hp = Math.min(unit.data.maxHp, unit.data.hp + BERRY_HEAL_PER_SEC);
          const diff = Math.round(unit.data.hp - prev);
          if (diff > 0) {
            this.updateUnitBars(unit);
            this.spawnFloatingText(unit.sprite.x, unit.sprite.y - 24, `+${diff}`, '#4ade80');
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
    this.cameras.main.shake(180, 0.008);

    for (const enemy of [...this.enemies]) {
      if (Math.hypot(enemy.gx - bx, enemy.gy - by) <= BARREL_RADIUS) {
        this.damageEnemy(enemy, BARREL_DAMAGE, null, true);
      }
    }
  }

  private handleWaveComplete(): void {
    this.slowMo = false;
    this.aimingUltUnitUid = null;
    this.selectedUnitUid = null;
    this.anims.globalTimeScale = 1;
    this.tweens.timeScale = 1;
    this.ap = Math.min(this.maxAp, this.ap + 3);

    if (this.wave >= this.maxWaves) {
      this.phase = 'VICTORY';
      this.setStatus('Victory! The Bastion Core survived all 3 waves.');
      return;
    }

    this.rewardChoices = this.generateRewardChoices();
    this.phase = 'REWARD';
    this.refreshHighlights();
    this.setStatus(`Wave ${this.wave} cleared! +3 AP. Choose a reward.`);
  }

  private handleDefeat(): void {
    this.phase = 'DEFEAT';
    this.slowMo = false;
    this.aimingUltUnitUid = null;
    this.selectedUnitUid = null;
    this.anims.globalTimeScale = 1;
    this.tweens.timeScale = 1;
    this.refreshHighlights();
    this.setStatus('Defeat! The Bastion Core was destroyed.');
  }

  private generateRewardChoices(): RewardOption[] {
    const owned = new Set([...this.upgrades, ...this.artifacts]);
    const pool = Phaser.Utils.Array.Shuffle(REWARD_POOL.filter((r) => !owned.has(r.id)));

    const activeSpecies = new Set(this.units.map((u) => u.data.speciesId));
    const reserveSpecies = new Set(this.reserveIds);
    const unrecruited = Phaser.Utils.Array.Shuffle(
      Object.keys(POKEMON_SPECIES).filter(
        (id) => !activeSpecies.has(id) && !reserveSpecies.has(id),
      ),
    );

    const choices: RewardOption[] = [];
    if (unrecruited.length > 0) {
      const sid = unrecruited[0];
      const sp = POKEMON_SPECIES[sid];
      choices.push({
        id: `recruit_${sid}`,
        kind: 'recruit',
        title: `Recruit ${sp.name}`,
        desc: `${sp.pokeClass} — ${sp.passiveDesc}`,
        speciesId: sid,
      });
    }

    while (choices.length < 3 && pool.length > 0) {
      choices.push(pool.shift()!);
    }

    return choices;
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

    const proj = this.add
      .sprite(sx, sy, `vfx:${flightKey}`)
      .setDepth(8)
      .setScale(0.75)
      .setRotation(Math.atan2(ty - sy, tx - sx));
    this.transientVfx.push(proj);
    proj.play(animKey);

    const dist = Math.hypot(tx - sx, ty - sy);
    const duration = Math.max(90, Math.round((dist / 380) * 1000));

    this.tweens.add({
      targets: proj,
      x: tx,
      y: ty,
      duration,
      onComplete: () => {
        if (proj.active) proj.destroy();
        this.spawnOneShotVfx(impactKey, tx, ty, 0.85);
        onArrive();
      },
    });
  }

  private spawnOneShotVfx(vfxKey: string, x: number, y: number, scale = 0.9): void {
    const animKey = `anim:vfx:${vfxKey}`;
    if (!this.anims.exists(animKey)) return;

    const fx = this.add.sprite(x, y, `vfx:${vfxKey}`).setDepth(8).setScale(scale);
    this.transientVfx.push(fx);
    fx.play(animKey);
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (fx.active) fx.destroy();
    });
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
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
    this.transientVfx.push(label);

    this.tweens.add({
      targets: label,
      y: y - 22,
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (label.active) label.destroy();
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Stat Helpers & Lookups
  // ---------------------------------------------------------------------------

  private computeUnitMaxHp(baseMaxHp: number): number {
    return this.upgrades.includes('thick_hide') ? Math.round(baseMaxHp * 1.3) : baseMaxHp;
  }

  private computeStructureMaxHp(baseMaxHp: number): number {
    return this.artifacts.includes('fortification_core')
      ? Math.round(baseMaxHp * 1.4)
      : baseMaxHp;
  }

  private getUnitMoveRange(unit: UnitEntity): number {
    const base = POKEMON_SPECIES[unit.data.speciesId].moveRange;
    return base + (this.upgrades.includes('swift_boots') ? 1 : 0);
  }

  private getUnitAtk(unit: UnitEntity): number {
    let mult = this.upgrades.includes('sharp_claws') ? 1.25 : 1;

    // Bulbasaur aura: nearby living allies gain +10% ATK
    const hasBulbasaurAura = this.units.some(
      (other) =>
        !other.data.fainted &&
        other.data.speciesId === '0001' &&
        other.data.uid !== unit.data.uid &&
        chebyshevDist(other.data.gx, other.data.gy, unit.data.gx, unit.data.gy) <= 2,
    );
    if (hasBulbasaurAura) mult += 0.1;

    return Math.round(POKEMON_SPECIES[unit.data.speciesId].atk * mult);
  }

  private getUnitDef(unit: UnitEntity): number {
    let def = POKEMON_SPECIES[unit.data.speciesId].def;
    if (unit.data.speciesId === '0007' && this.isNearWaterOrWall(unit.data.gx, unit.data.gy)) {
      def = Math.round(def * 1.25);
    }
    if (unit.data.speciesId === '0074' && this.isAdjacentToWall(unit.data.gx, unit.data.gy)) {
      def = Math.round(def * 1.3);
    }
    return def;
  }

  private getUnitAttackIntervalMs(unit: UnitEntity): number {
    const base = POKEMON_SPECIES[unit.data.speciesId].attackIntervalMs;
    let speedBonus = 1;
    if (unit.data.speciesId === '0133') speedBonus += 0.2;
    if (this.artifacts.includes('arcane_conduit')) speedBonus += 0.2;
    return Math.round(base / speedBonus);
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

  private isValidUnitTile(gx: number, gy: number): boolean {
    if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return false;
    const tile = this.tiles[gy][gx];
    if (tile === 'water' || tile === 'core') return false;
    if (this.getUnitAt(gx, gy)) return false;
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

  private findNearestEnemyInRange(gx: number, gy: number, range: number): EnemyEntity | null {
    let best: EnemyEntity | null = null;
    let bestDist = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      const cheb = chebyshevDist(gx, gy, enemy.gx, enemy.gy);
      if (cheb > range) continue;
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
    this.coreHpBarFill.width = 70 * ratio;
    this.coreHpBarFill.setFillStyle(ratio > 0.5 ? 0x22d3ee : ratio > 0.25 ? 0xfacc15 : 0xef4444);
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
    this.game.events.emit('snapshot', this.getSnapshot());
  }
}
