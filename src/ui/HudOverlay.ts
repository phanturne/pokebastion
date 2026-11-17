import Phaser from 'phaser';
import { POKEMON_SPECIES, REWARD_POOL, STRUCTURE_SPECS } from '../data/pokemon';
import {
  HEAL_COST,
  REVIVE_COST,
  getEffectiveAtk,
  getEffectiveMaxHp,
  getEffectiveMoveRange,
  getRepairCost,
} from '../engine/rules';
import {
  ActiveUnit,
  GameSnapshot,
  GridStructure,
  RewardOption,
  StructureKind,
} from '../types';

type ToolId = StructureKind | 'move_struct' | 'sell_struct';

const TOOL_SHORT_NAME: Record<ToolId, string> = {
  wood_wall: 'Barricade',
  stone_wall: 'Stone Wall',
  berry_bush: 'Berry Bush',
  barrel: 'Bomb Barrel',
  move_struct: 'Move',
  sell_struct: 'Sell',
};

const TOOL_ICONS: Record<ToolId, string> = {
  wood_wall: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="2" y="3" width="3" height="11" fill="#8b5a2b"/>
    <rect x="6" y="2" width="4" height="12" fill="#a06b38"/>
    <rect x="11" y="3" width="3" height="11" fill="#8b5a2b"/>
    <rect x="1" y="6" width="14" height="2" fill="#5c3a1b"/>
    <rect x="1" y="10" width="14" height="2" fill="#5c3a1b"/>
    <rect x="3" y="6" width="1" height="1" fill="#d29922"/>
    <rect x="12" y="10" width="1" height="1" fill="#d29922"/>
  </svg>`,
  stone_wall: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="1" y="2" width="14" height="12" fill="#484f58"/>
    <rect x="2" y="3" width="5" height="3" fill="#8b949e"/>
    <rect x="8" y="3" width="6" height="3" fill="#6e7681"/>
    <rect x="2" y="7" width="3" height="3" fill="#6e7681"/>
    <rect x="6" y="7" width="6" height="3" fill="#8b949e"/>
    <rect x="13" y="7" width="1" height="3" fill="#6e7681"/>
    <rect x="2" y="11" width="6" height="2" fill="#8b949e"/>
    <rect x="9" y="11" width="5" height="2" fill="#6e7681"/>
  </svg>`,
  berry_bush: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="4" y="3" width="8" height="3" fill="#2ea043"/>
    <rect x="2" y="5" width="12" height="6" fill="#3fb950"/>
    <rect x="3" y="10" width="10" height="3" fill="#238636"/>
    <rect x="5" y="13" width="6" height="1" fill="#1b5e20"/>
    <rect x="4" y="6" width="2" height="2" fill="#f85149"/>
    <rect x="9" y="5" width="2" height="2" fill="#f7cc45"/>
    <rect x="7" y="9" width="2" height="2" fill="#f85149"/>
    <rect x="11" y="8" width="2" height="2" fill="#ff7b72"/>
  </svg>`,
  barrel: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="10" y="1" width="2" height="2" fill="#f7cc45"/>
    <rect x="8" y="2" width="2" height="2" fill="#f85149"/>
    <rect x="4" y="4" width="8" height="10" fill="#b62324"/>
    <rect x="5" y="5" width="6" height="8" fill="#f85149"/>
    <rect x="3" y="6" width="10" height="2" fill="#6e7681"/>
    <rect x="3" y="10" width="10" height="2" fill="#6e7681"/>
    <rect x="7" y="8" width="2" height="2" fill="#f7cc45"/>
  </svg>`,
  move_struct: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="7" y="2" width="2" height="12" fill="#58a6ff"/>
    <rect x="2" y="7" width="12" height="2" fill="#58a6ff"/>
    <rect x="6" y="3" width="4" height="1" fill="#58a6ff"/>
    <rect x="6" y="12" width="4" height="1" fill="#58a6ff"/>
    <rect x="3" y="6" width="1" height="4" fill="#58a6ff"/>
    <rect x="12" y="6" width="1" height="4" fill="#58a6ff"/>
  </svg>`,
  sell_struct: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="4" y="2" width="8" height="12" fill="#d29922"/>
    <rect x="3" y="4" width="10" height="8" fill="#f7cc45"/>
    <rect x="6" y="4" width="4" height="1" fill="#8b5a2b"/>
    <rect x="6" y="5" width="1" height="7" fill="#8b5a2b"/>
    <rect x="9" y="5" width="1" height="2" fill="#8b5a2b"/>
    <rect x="6" y="7" width="4" height="1" fill="#8b5a2b"/>
    <rect x="5" y="9" width="5" height="1" fill="#8b5a2b"/>
  </svg>`,
};

const REWARD_BY_ID: Record<string, RewardOption> = Object.fromEntries(
  REWARD_POOL.map((r) => [r.id, r]),
);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pct(cur: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (cur / max) * 100));
}

export class HudOverlay {
  private readonly topBar: HTMLElement | null;
  private readonly sidePanel: HTMLElement | null;
  private readonly modalRoot: HTMLElement | null;

  private lastSnap: GameSnapshot | null = null;
  private showCredits = false;
  private hoveredTool: ToolId | null = null;

  private lastTopHtml = '';
  private lastSideHtml = '';
  private lastModalHtml = '';

  constructor(private readonly game: Phaser.Game) {
    this.topBar = document.getElementById('top-bar');
    this.sidePanel = document.getElementById('side-panel');
    this.modalRoot = document.getElementById('modal-root');

    this.bindEvents();
    this.game.events.on('snapshot', (snap: GameSnapshot) => this.render(snap));
  }

  private scene(): any {
    return this.game.scene.getScene('BattleScene') as any;
  }

  private cancelActiveAction(): void {
    const scene = this.scene();
    if (!scene) return;
    if (typeof scene.cancelAction === 'function') {
      scene.cancelAction();
    } else {
      scene.selectTool?.(null);
      scene.selectUnit?.(null);
    }
  }

  private bindEvents(): void {
    const onClick = (ev: Event) => {
      const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const id = target.dataset.id ?? '';
      if (!action) return;

      if (action === 'toggle-credits') {
        this.showCredits = !this.showCredits;
        this.renderModal();
        return;
      }
      if (action === 'close-credits') {
        this.showCredits = false;
        this.renderModal();
        return;
      }
      if (action === 'cancel-action') {
        this.cancelActiveAction();
        return;
      }

      const scene = this.scene();
      if (!scene) return;

      switch (action) {
        case 'toggle-speed':
          scene.toggleSpeed?.();
          break;
        case 'start-wave':
          scene.startWave?.();
          break;
        case 'select-tool': {
          const tool = id as ToolId;
          scene.selectTool?.(this.lastSnap?.selectedTool === tool ? null : tool);
          break;
        }
        case 'repair-struct':
          scene.repairStructure?.(id);
          break;
        case 'repair-all': {
          if (typeof scene.repairAllStructures === 'function') {
            scene.repairAllStructures();
          } else {
            const damaged = (this.lastSnap?.structures ?? []).filter(
              (s) => s.ruined || s.hp < s.maxHp,
            );
            for (const s of damaged) {
              scene.repairStructure?.(s.uid);
            }
          }
          break;
        }
        case 'detonate-barrel':
          scene.detonateBarrel?.(id);
          break;
        case 'cast-ult':
          scene.triggerUlt?.(id);
          break;
        case 'heal-unit':
          scene.healUnit?.(id);
          break;
        case 'revive-unit':
          scene.reviveUnit?.(id);
          break;
        case 'select-unit':
          scene.selectUnit?.(id);
          break;
        case 'swap-reserve': {
          const activeUid =
            this.lastSnap?.selectedUnitUid ?? this.lastSnap?.activeUnits[0]?.uid;
          if (activeUid) scene.swapReserve?.(activeUid, id);
          break;
        }
        case 'pick-reward':
          scene.pickReward?.(id);
          break;
        case 'restart-run':
          scene.restartRun?.();
          break;
      }
    };

    const onChange = (ev: Event) => {
      const input = ev.target as HTMLInputElement | null;
      if (!input || input.dataset.action !== 'toggle-auto-ult') return;
      const uid = input.dataset.id;
      if (uid) this.scene()?.toggleAutoUlt?.(uid);
    };

    const onToolEnter = (ev: Event) => {
      const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-tool-tip]');
      if (!target) return;
      const tipId = target.dataset.toolTip as ToolId | undefined;
      if (tipId && tipId !== this.hoveredTool) {
        this.hoveredTool = tipId;
        this.updateShopTooltip();
      }
    };

    const onToolLeave = (ev: Event) => {
      const mouseOrFocus = ev as MouseEvent | FocusEvent;
      const leaving = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-tool-tip]');
      if (!leaving) return;
      const next = (mouseOrFocus.relatedTarget as HTMLElement | null)?.closest<HTMLElement>(
        '[data-tool-tip]',
      );
      if (!next && this.hoveredTool !== null) {
        this.hoveredTool = null;
        this.updateShopTooltip();
      }
    };

    this.topBar?.addEventListener('click', onClick);
    this.sidePanel?.addEventListener('click', onClick);
    this.sidePanel?.addEventListener('change', onChange);
    this.sidePanel?.addEventListener('mouseover', onToolEnter);
    this.sidePanel?.addEventListener('mouseout', onToolLeave);
    this.sidePanel?.addEventListener('focusin', onToolEnter);
    this.sidePanel?.addEventListener('focusout', onToolLeave);
    this.modalRoot?.addEventListener('click', (ev) => {
      if (ev.target === this.modalRoot && this.showCredits) {
        this.showCredits = false;
        this.renderModal();
        return;
      }
      onClick(ev);
    });

    window.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      if (this.showCredits) {
        this.showCredits = false;
        this.renderModal();
        return;
      }
      this.cancelActiveAction();
    });
  }

  private updateShopTooltip(): void {
    if (!this.sidePanel || !this.lastSnap) return;
    const box = this.sidePanel.querySelector<HTMLElement>('#shop-tooltip');
    if (!box) return;
    box.innerHTML = this.renderShopTooltipContent(this.lastSnap);
    this.lastSideHtml = this.sidePanel.innerHTML;
  }

  public render(snap: GameSnapshot): void {
    this.lastSnap = snap;
    if (snap.phase !== 'PREP') {
      this.hoveredTool = null;
    }
    this.renderTopBar(snap);
    this.renderSidePanel(snap);
    this.renderModal();
  }

  private renderTopBar(snap: GameSnapshot): void {
    if (!this.topBar) return;
    const corePct = pct(snap.coreHp, snap.coreMaxHp).toFixed(1);

    const html = `
      <div class="top-group">
        <span class="brand">PokéBastion</span>
        <span class="stat-pill">
          <span class="stat-label">Wave</span>
          <span class="stat-val">${snap.wave} / ${snap.maxWaves}</span>
        </span>
        <span class="phase-badge phase-${snap.phase}">${snap.phase}</span>
        <div class="stat-pill core-meter">
          <span class="stat-label">Core</span>
          <div class="core-bar-wrap">
            <div class="bar-track">
              <div class="bar-fill bar-core" style="width:${corePct}%"></div>
            </div>
          </div>
          <span class="stat-val">${Math.max(0, Math.ceil(snap.coreHp))} / ${snap.coreMaxHp}</span>
        </div>
      </div>
      <div class="top-group">
        <span class="stat-pill">
          <span class="stat-label">Gold</span>
          <span class="stat-val gold">₽${snap.gold}</span>
        </span>
        <span class="stat-pill" title="Action Points for combat movement (1 AP standard ring, 2 AP extended; +3 per wave)">
          <span class="stat-label">AP</span>
          <span class="stat-val ap">${snap.ap} / ${snap.maxAp}</span>
        </span>
        <button class="btn" data-action="toggle-speed" title="Toggle simulation speed (1× / 2×)">${snap.speedMult}×</button>
        <button class="btn" data-action="toggle-credits">Credits</button>
      </div>
    `;

    if (html !== this.lastTopHtml) {
      this.topBar.innerHTML = html;
      this.lastTopHtml = html;
    }
  }

  private renderSidePanel(snap: GameSnapshot): void {
    if (!this.sidePanel) return;

    const inspectedUnitUid = snap.aimingUltUnitUid ?? snap.selectedUnitUid;
    const selectedUnit =
      snap.activeUnits.find((u) => u.uid === inspectedUnitUid) ?? null;
    const selectedStruct =
      snap.structures.find((s) => s.uid === snap.selectedStructureUid) ?? null;

    const parts: string[] = [];
    const activeModeBar = this.renderActiveModeBar(snap);
    if (activeModeBar) {
      parts.push(activeModeBar);
    }

    parts.push(`<div class="status-banner">${escapeHtml(snap.statusMessage || 'Ready.')}</div>`);

    if (snap.phase === 'PREP') {
      parts.push(`
        <button class="btn btn-primary btn-wave" data-action="start-wave">
          Start Wave ${snap.wave}
        </button>
      `);
      parts.push(this.renderBuildPalette(snap));
    }

    if (selectedStruct) {
      parts.push(this.renderSelectedStructure(snap, selectedStruct));
    }

    if (selectedUnit) {
      parts.push(this.renderSelectedPokemon(snap, selectedUnit));
    }

    parts.push(this.renderTeamAndReserve(snap));
    parts.push(this.renderRelics(snap));

    const html = parts.join('');
    if (html !== this.lastSideHtml) {
      this.sidePanel.innerHTML = html;
      this.lastSideHtml = html;
    }
  }

  private renderActiveModeBar(snap: GameSnapshot): string {
    if (snap.aimingUltUnitUid !== null) {
      const aimingUnit = snap.activeUnits.find((u) => u.uid === snap.aimingUltUnitUid);
      const sp = aimingUnit ? POKEMON_SPECIES[aimingUnit.speciesId] : null;
      const ultName = sp ? sp.ultName : 'Ultimate';
      return `
        <div class="active-mode-bar ult">
          <span class="active-mode-text">Aiming ${escapeHtml(ultName)} — Click target tile</span>
          <button class="btn btn-danger btn-xs" data-action="cancel-action">Cancel (Esc)</button>
        </div>
      `;
    }

    if (snap.selectedTool === null) return '';

    let text = '';
    let barClass = 'active-mode-bar';
    if (snap.selectedTool === 'move_struct') {
      text = 'Moving Structure — Click structure, then grass tile';
    } else if (snap.selectedTool === 'sell_struct') {
      text = 'Selling Structure — Click structure to refund 70%';
      barClass = 'active-mode-bar sell';
    } else {
      const spec = STRUCTURE_SPECS[snap.selectedTool];
      text = `Placing ${escapeHtml(spec.name)} — Click grass tile`;
    }

    return `
      <div class="${barClass}">
        <span class="active-mode-text">${text}</span>
        <button class="btn btn-danger btn-xs" data-action="cancel-action">Cancel (Esc)</button>
      </div>
    `;
  }

  private renderShopTooltipContent(snap: GameSnapshot): string {
    const tool = this.hoveredTool ?? snap.selectedTool;
    if (!tool) {
      return `<div class="tool-desc">Hover or focus an item above to view HP, pathing, and effects.</div>`;
    }

    if (tool === 'move_struct') {
      return `
        <div class="shop-tooltip-head">
          <span>Move Structure</span>
          <span class="tool-cost free">Free</span>
        </div>
        <div class="shop-tooltip-tags">
          <span class="tag">Relocate</span>
        </div>
        <div class="shop-tooltip-desc">Click an existing structure, then click an open grass tile to move it.</div>
      `;
    }

    if (tool === 'sell_struct') {
      return `
        <div class="shop-tooltip-head">
          <span>Sell Structure</span>
          <span class="tool-cost refund">+70% ₽</span>
        </div>
        <div class="shop-tooltip-tags">
          <span class="tag">Refund</span>
        </div>
        <div class="shop-tooltip-desc">Click an existing structure to dismantle it and refund 70% of its build cost.</div>
      `;
    }

    const spec = STRUCTURE_SPECS[tool];
    const deficit = Math.max(0, spec.cost - snap.gold);
    const pathTag = spec.blocksGround
      ? 'Blocks Ground'
      : spec.consumable
        ? 'One-Time Trap'
        : 'Passable';

    return `
      <div class="shop-tooltip-head">
        <span>${escapeHtml(spec.name)}</span>
        <span class="tool-cost">₽${spec.cost}</span>
      </div>
      <div class="shop-tooltip-tags">
        <span class="tag">HP ${spec.maxHp}</span>
        <span class="tag">${pathTag}</span>
        ${deficit > 0 ? `<span class="shop-need">Need ₽${deficit} more</span>` : ''}
      </div>
      <div class="shop-tooltip-desc">${escapeHtml(spec.desc)}</div>
    `;
  }

  private renderBuildPalette(snap: GameSnapshot): string {
    const structButtons = Object.values(STRUCTURE_SPECS)
      .map((spec) => {
        const active = snap.selectedTool === spec.kind ? 'active' : '';
        const unaffordable = snap.gold < spec.cost ? 'unaffordable' : '';
        return `
          <button
            class="tool-btn ${active} ${unaffordable}"
            data-action="select-tool"
            data-id="${spec.kind}"
            data-tool-tip="${spec.kind}"
          >
            <span class="tool-icon">${TOOL_ICONS[spec.kind]}</span>
            <span class="tool-meta">
              <span class="tool-name">${escapeHtml(TOOL_SHORT_NAME[spec.kind])}</span>
              <span class="tool-cost">₽${spec.cost}</span>
            </span>
          </button>
        `;
      })
      .join('');

    const moveActive = snap.selectedTool === 'move_struct' ? 'active' : '';
    const sellActive = snap.selectedTool === 'sell_struct' ? 'active-danger' : '';

    const damagedStructs = snap.structures.filter((s) => s.ruined || s.hp < s.maxHp);
    const totalRepairCost = damagedStructs.reduce(
      (sum, s) => sum + getRepairCost(s.kind, s.hp, s.maxHp),
      0,
    );

    return `
      <section class="card">
        <div class="section-header">
          <span>Build Palette</span>
          <span>Click grid to place</span>
        </div>
        <div class="tool-grid">
          ${structButtons}
          <button
            class="tool-btn ${moveActive}"
            data-action="select-tool"
            data-id="move_struct"
            data-tool-tip="move_struct"
          >
            <span class="tool-icon">${TOOL_ICONS.move_struct}</span>
            <span class="tool-meta">
              <span class="tool-name">${TOOL_SHORT_NAME.move_struct}</span>
              <span class="tool-cost free">Free</span>
            </span>
          </button>
          <button
            class="tool-btn ${sellActive}"
            data-action="select-tool"
            data-id="sell_struct"
            data-tool-tip="sell_struct"
          >
            <span class="tool-icon">${TOOL_ICONS.sell_struct}</span>
            <span class="tool-meta">
              <span class="tool-name">${TOOL_SHORT_NAME.sell_struct}</span>
              <span class="tool-cost refund">+70% ₽</span>
            </span>
          </button>
        </div>
        <div class="shop-tooltip" id="shop-tooltip">
          ${this.renderShopTooltipContent(snap)}
        </div>
        ${
          damagedStructs.length > 0 && totalRepairCost > 0
            ? `
              <button
                class="btn btn-accent"
                data-action="repair-all"
                ${snap.gold >= totalRepairCost ? '' : 'disabled'}
                title="Repair all ${damagedStructs.length} damaged or ruined structures"
              >
                Repair All (₽${totalRepairCost})
              </button>
            `
            : ''
        }
      </section>
    `;
  }

  private renderSelectedStructure(
    snap: GameSnapshot,
    struct: GridStructure,
  ): string {
    const spec = STRUCTURE_SPECS[struct.kind];
    const hpPct = pct(struct.hp, struct.maxHp).toFixed(1);
    const repairCost = getRepairCost(struct.kind, struct.hp, struct.maxHp);
    const needsRepair = (struct.ruined || struct.hp < struct.maxHp) && repairCost > 0;
    const canRepair = snap.phase === 'PREP' && needsRepair && snap.gold >= repairCost;
    const isBarrel = struct.kind === 'barrel' && !struct.ruined;
    const showDetonate = isBarrel && snap.phase === 'COMBAT';

    return `
      <section class="card">
        <div class="unit-title-row">
          <strong>${escapeHtml(spec.name)}</strong>
          ${struct.ruined ? '<span class="tag ruined">Ruined</span>' : `<span class="tag">(${struct.gx}, ${struct.gy})</span>`}
        </div>
        <div class="bar-row">
          <div class="bar-labels">
            <span>Structure HP</span>
            <span>${Math.max(0, Math.ceil(struct.hp))} / ${struct.maxHp}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill bar-hp" style="width:${hpPct}%"></div>
          </div>
        </div>
        ${
          (snap.phase === 'PREP' && needsRepair) || showDetonate
            ? `
              <div class="btn-row">
                ${
                  snap.phase === 'PREP' && needsRepair
                    ? `<button class="btn btn-accent" data-action="repair-struct" data-id="${struct.uid}" ${canRepair ? '' : 'disabled'}>Repair (₽${repairCost})</button>`
                    : ''
                }
                ${
                  showDetonate
                    ? `<button class="btn btn-danger" data-action="detonate-barrel" data-id="${struct.uid}">Detonate</button>`
                    : ''
                }
              </div>
            `
            : ''
        }
      </section>
    `;
  }

  private renderSelectedPokemon(
    snap: GameSnapshot,
    unit: ActiveUnit,
  ): string {
    const species = POKEMON_SPECIES[unit.speciesId];
    if (!species) return '';

    const hpPct = pct(unit.hp, unit.maxHp).toFixed(1);
    const ultPctNum = pct(unit.ult, unit.ultMax);
    const ultPct = ultPctNum.toFixed(1);
    const ultReady = !unit.fainted && unit.ult >= unit.ultMax;
    const isAiming = snap.aimingUltUnitUid === unit.uid;
    const canCastUlt = snap.phase === 'COMBAT' && ultReady;

    let ultLabel = 'Cast Ult';
    if (isAiming) {
      ultLabel = 'Aiming Ult...';
    } else if (unit.fainted) {
      ultLabel = 'Fainted';
    } else if (snap.phase !== 'COMBAT') {
      ultLabel = 'Prep Only';
    } else if (!ultReady) {
      ultLabel = `Charging (${Math.floor(ultPctNum)}%)`;
    }

    const atk = getEffectiveAtk(unit.speciesId, snap.upgrades);
    const def = species.def;
    const rng = species.range;
    const mov = getEffectiveMoveRange(species.moveRange, snap.upgrades);

    const canHeal =
      snap.phase === 'PREP' && !unit.fainted && unit.hp < unit.maxHp && snap.gold >= HEAL_COST;
    const canRevive =
      snap.phase === 'PREP' && unit.fainted && snap.gold >= REVIVE_COST;

    let prepActionBtn = '';
    if (snap.phase === 'PREP') {
      if (unit.fainted) {
        prepActionBtn = `
          <div class="btn-row">
            <button
              class="btn btn-primary"
              data-action="revive-unit"
              data-id="${unit.uid}"
              ${canRevive ? '' : 'disabled'}
            >
              Revive (₽${REVIVE_COST})
            </button>
          </div>
        `;
      } else if (unit.hp < unit.maxHp) {
        prepActionBtn = `
          <div class="btn-row">
            <button
              class="btn btn-accent"
              data-action="heal-unit"
              data-id="${unit.uid}"
              ${canHeal ? '' : 'disabled'}
            >
              Heal (₽${HEAL_COST})
            </button>
          </div>
        `;
      }
    }

    return `
      <section class="card">
        <div class="unit-title-row">
          <div class="unit-name-wrap">
            <span class="swatch" style="background:${species.color}"></span>
            <strong>${escapeHtml(species.name)}</strong>
          </div>
          <div class="unit-name-wrap">
            ${unit.fainted ? '<span class="tag fainted">Fainted</span>' : ''}
            <span class="tag">${escapeHtml(species.pokeClass)}</span>
          </div>
        </div>

        <div class="unit-stats-grid">
          <div class="unit-stat">
            <span class="unit-stat-lbl">ATK</span>
            <span class="unit-stat-val">${atk}</span>
          </div>
          <div class="unit-stat">
            <span class="unit-stat-lbl">DEF</span>
            <span class="unit-stat-val">${def}</span>
          </div>
          <div class="unit-stat">
            <span class="unit-stat-lbl">RNG</span>
            <span class="unit-stat-val">${rng}</span>
          </div>
          <div class="unit-stat">
            <span class="unit-stat-lbl">MOV</span>
            <span class="unit-stat-val">${mov}</span>
          </div>
        </div>

        <div class="bar-row">
          <div class="bar-labels">
            <span>HP</span>
            <span>${Math.max(0, Math.ceil(unit.hp))} / ${unit.maxHp}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill bar-hp" style="width:${hpPct}%"></div>
          </div>
        </div>

        <div class="bar-row">
          <div class="bar-labels">
            <span>Ult (${escapeHtml(species.ultName)})</span>
            <span>${Math.floor(unit.ult)} / ${unit.ultMax}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill bar-ult" style="width:${ultPct}%"></div>
          </div>
        </div>

        <div class="btn-row" style="align-items:center">
          <button
            class="btn btn-ult"
            data-action="cast-ult"
            data-id="${unit.uid}"
            ${canCastUlt ? '' : 'disabled'}
          >
            ${ultLabel}
          </button>
          <label class="toggle-label">
            <input
              type="checkbox"
              data-action="toggle-auto-ult"
              data-id="${unit.uid}"
              ${unit.autoUlt ? 'checked' : ''}
            />
            Auto-Ult
          </label>
        </div>

        ${prepActionBtn}

        <div class="desc-box">
          <div><strong>Passive:</strong> ${escapeHtml(species.passiveDesc)}</div>
          <div><strong>Ult — ${escapeHtml(species.ultName)}:</strong> ${escapeHtml(species.ultDesc)}</div>
        </div>
      </section>
    `;
  }

  private renderTeamAndReserve(snap: GameSnapshot): string {
    const inspectedUid = snap.aimingUltUnitUid ?? snap.selectedUnitUid;
    const activeChips = snap.activeUnits
      .map((u) => {
        const sp = POKEMON_SPECIES[u.speciesId];
        const name = sp ? sp.name : u.speciesId;
        const color = sp ? sp.color : '#8b949e';
        const selected = u.uid === inspectedUid ? 'selected' : '';
        const fainted = u.fainted ? 'fainted' : '';
        const hpLabel = u.fainted ? 'KO' : `${Math.ceil(u.hp)}/${u.maxHp}`;
        const ultReady = !u.fainted && u.ult >= u.ultMax;
        return `
          <button
            class="unit-chip ${selected} ${fainted}"
            data-action="select-unit"
            data-id="${u.uid}"
          >
            <span class="swatch" style="background:${color}"></span>
            <span>${escapeHtml(name)}</span>
            ${ultReady ? '<span class="ult-pip" title="Ultimate ready">ULT</span>' : ''}
            <span class="chip-hp">${hpLabel}</span>
          </button>
        `;
      })
      .join('');

    const selectedActive =
      snap.activeUnits.find((u) => u.uid === snap.selectedUnitUid) ?? null;
    const selectedActiveName = selectedActive
      ? (POKEMON_SPECIES[selectedActive.speciesId]?.name ?? selectedActive.speciesId)
      : null;
    const canSwap = snap.phase === 'PREP' && Boolean(selectedActive);

    const reserveChips = snap.reserveIds.length
      ? snap.reserveIds
          .map((id) => {
            const sp = POKEMON_SPECIES[id];
            const name = sp ? sp.name : id;
            const color = sp ? sp.color : '#8b949e';
            let tooltip = 'Select an active Pokémon during PREP to swap';
            if (sp) {
              const hp = getEffectiveMaxHp(sp.id, snap.upgrades);
              const atk = getEffectiveAtk(sp.id, snap.upgrades);
              const mov = getEffectiveMoveRange(sp.moveRange, snap.upgrades);
              tooltip = [
                `${sp.name} (${sp.pokeClass})`,
                `HP ${hp} | ATK ${atk} | RNG ${sp.range} | MOV ${mov}`,
                `Passive: ${sp.passiveDesc}`,
                `Ult — ${sp.ultName}: ${sp.ultDesc}`,
                canSwap && selectedActiveName
                  ? `Click to swap into ${selectedActiveName}'s slot`
                  : 'Select an active Pokémon during PREP to swap',
              ].join('\n');
            }
            return `
              <button
                class="unit-chip reserve"
                data-action="swap-reserve"
                data-id="${id}"
                ${canSwap ? '' : 'disabled'}
                title="${escapeHtml(tooltip)}"
              >
                <span class="swatch" style="background:${color}"></span>
                <span>${escapeHtml(name)}</span>
              </button>
            `;
          })
          .join('')
      : '<span class="tool-desc">No reserve Pokémon.</span>';

    const reserveHint =
      snap.phase === 'PREP'
        ? selectedActiveName
          ? `Swap into ${escapeHtml(selectedActiveName)}'s slot`
          : 'Select active to swap'
        : 'PREP only';

    return `
      <section class="card">
        <div class="section-header">
          <span>Active Team</span>
          <span>${snap.activeUnits.length} deployed</span>
        </div>
        <div class="chips-grid">${activeChips}</div>
        <div class="section-header" style="margin-top:4px">
          <span>Reserve</span>
          <span>${reserveHint}</span>
        </div>
        <div class="chips-grid">${reserveChips}</div>
      </section>
    `;
  }

  private renderRelics(snap: GameSnapshot): string {
    const badges: string[] = [];

    for (const id of snap.upgrades) {
      const meta = REWARD_BY_ID[id];
      const title = meta ? meta.title : id;
      const desc = meta ? meta.desc : '';
      badges.push(
        `<span class="relic-badge upgrade" title="${escapeHtml(desc)}">${escapeHtml(title)}</span>`,
      );
    }
    for (const id of snap.artifacts) {
      const meta = REWARD_BY_ID[id];
      const title = meta ? meta.title : id;
      const desc = meta ? meta.desc : '';
      badges.push(
        `<span class="relic-badge artifact" title="${escapeHtml(desc)}">${escapeHtml(title)}</span>`,
      );
    }

    return `
      <section class="card">
        <div class="section-header">
          <span>Artifacts & Upgrades</span>
          <span>${badges.length}</span>
        </div>
        <div class="badge-list">
          ${badges.length ? badges.join('') : '<span class="tool-desc">None acquired yet.</span>'}
        </div>
      </section>
    `;
  }

  private renderModal(): void {
    if (!this.modalRoot) return;
    let html = '';

    if (this.showCredits) {
      html = `
        <div class="modal-card compact">
          <div class="modal-header">
            <div class="modal-title">Asset Credits</div>
            <button class="btn" data-action="close-credits">Close</button>
          </div>
          <div class="credits-list">
            <div class="credit-item">
              <strong>Tile Textures — MPWSP01</strong>
              <a href="https://scarloxy.itch.io/mpwsp01" target="_blank" rel="noopener noreferrer">
                https://scarloxy.itch.io/mpwsp01
              </a>
            </div>
            <div class="credit-item">
              <strong>Pokémon Sprites — PMD / PMDCollab</strong>
              <a href="https://sprites.pmdcollab.org" target="_blank" rel="noopener noreferrer">
                https://sprites.pmdcollab.org
              </a>
            </div>
            <div class="credit-item">
              <strong>Attack VFX — PVFX Foundry</strong>
              <a href="https://nerijs.itch.io/pvfx-foundry/devlog/1750877/pvfx-foundry-10-101-new-effects-rebuilt-for-quality" target="_blank" rel="noopener noreferrer">
                https://nerijs.itch.io/pvfx-foundry/devlog/1750877/pvfx-foundry-10-101-new-effects-rebuilt-for-quality
              </a>
            </div>
          </div>
        </div>
      `;
    } else if (this.lastSnap?.phase === 'REWARD') {
      const cards = this.lastSnap.rewardChoices
        .map(
          (choice) => `
            <button class="reward-card" data-action="pick-reward" data-id="${escapeHtml(choice.id)}">
              <span class="tag">${escapeHtml(choice.kind)}</span>
              <div class="reward-title">${escapeHtml(choice.title)}</div>
              <div class="reward-desc">${escapeHtml(choice.desc)}</div>
            </button>
          `,
        )
        .join('');

      html = `
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">Wave Cleared — Choose a Reward</div>
          </div>
          <div class="reward-grid">${cards}</div>
        </div>
      `;
    } else if (
      this.lastSnap?.phase === 'VICTORY' ||
      this.lastSnap?.phase === 'DEFEAT'
    ) {
      const victory = this.lastSnap.phase === 'VICTORY';
      html = `
        <div class="modal-card compact">
          <div class="modal-header">
            <div class="modal-title" style="color:${victory ? 'var(--green)' : 'var(--red)'}">
              ${victory ? 'Bastion Secured — Victory!' : 'Core Shattered — Defeat'}
            </div>
          </div>
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-label">Wave</div>
              <div class="stat-box-val">${this.lastSnap.wave} / ${this.lastSnap.maxWaves}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Kills</div>
              <div class="stat-box-val">${this.lastSnap.kills}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Core HP</div>
              <div class="stat-box-val">${Math.max(0, Math.ceil(this.lastSnap.coreHp))} / ${this.lastSnap.coreMaxHp}</div>
            </div>
          </div>
          <button class="btn btn-primary btn-wave" data-action="restart-run">
            Play Again
          </button>
        </div>
      `;
    }

    if (html !== this.lastModalHtml) {
      this.modalRoot.innerHTML = html;
      this.lastModalHtml = html;
    }
  }
}
