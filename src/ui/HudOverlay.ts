import Phaser from 'phaser';
import { POKEMON_SPECIES, REWARD_POOL, STRUCTURE_SPECS } from '../data/pokemon';
import {
  ActiveUnit,
  GameSnapshot,
  GridStructure,
  RewardOption,
  StructureKind,
} from '../types';

const HEAL_COST = 30;
const REVIVE_COST = 80;

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
          const tool = id as StructureKind | 'move_struct' | 'sell_struct';
          scene.selectTool?.(this.lastSnap?.selectedTool === tool ? null : tool);
          break;
        }
        case 'repair-struct':
          scene.repairStructure?.(id);
          break;
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

    this.topBar?.addEventListener('click', onClick);
    this.sidePanel?.addEventListener('click', onClick);
    this.sidePanel?.addEventListener('change', onChange);
    this.modalRoot?.addEventListener('click', onClick);
  }

  public render(snap: GameSnapshot): void {
    this.lastSnap = snap;
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
        <span class="stat-pill">
          <span class="stat-label">AP</span>
          <span class="stat-val ap">${snap.ap} / ${snap.maxAp}</span>
        </span>
        <button class="btn" data-action="toggle-speed">${snap.speedMult}×</button>
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

    const selectedUnit =
      snap.activeUnits.find((u) => u.uid === snap.selectedUnitUid) ?? null;
    const selectedStruct =
      snap.structures.find((s) => s.uid === snap.selectedStructureUid) ?? null;

    const parts: string[] = [
      `<div class="status-banner">${escapeHtml(snap.statusMessage || 'Ready.')}</div>`,
    ];

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

    parts.push(this.renderSelectedPokemon(snap, selectedUnit));
    parts.push(this.renderTeamAndReserve(snap));
    parts.push(this.renderRelics(snap));

    const html = parts.join('');
    if (html !== this.lastSideHtml) {
      this.sidePanel.innerHTML = html;
      this.lastSideHtml = html;
    }
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
          >
            <div class="tool-top">
              <span>${escapeHtml(spec.name)}</span>
              <span class="tool-cost">₽${spec.cost}</span>
            </div>
            <div class="tool-desc">${escapeHtml(spec.desc)}</div>
          </button>
        `;
      })
      .join('');

    const moveActive = snap.selectedTool === 'move_struct' ? 'btn-accent' : '';
    const sellActive = snap.selectedTool === 'sell_struct' ? 'btn-danger' : '';

    return `
      <section class="card">
        <div class="section-header">
          <span>Build Palette</span>
          <span>Click grid to place</span>
        </div>
        <div class="tool-grid">${structButtons}</div>
        <div class="btn-row">
          <button class="btn ${moveActive}" data-action="select-tool" data-id="move_struct">
            Move
          </button>
          <button class="btn ${sellActive}" data-action="select-tool" data-id="sell_struct">
            Sell (70%)
          </button>
        </div>
      </section>
    `;
  }

  private renderSelectedStructure(
    snap: GameSnapshot,
    struct: GridStructure,
  ): string {
    const spec = STRUCTURE_SPECS[struct.kind];
    const hpPct = pct(struct.hp, struct.maxHp).toFixed(1);
    const repairCost = Math.floor(spec.cost * 0.5);
    const needsRepair = struct.ruined || struct.hp < struct.maxHp;
    const canRepair = snap.phase === 'PREP' && needsRepair && snap.gold >= repairCost;
    const isBarrel = struct.kind === 'barrel' && !struct.ruined;

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
        <div class="btn-row">
          ${
            snap.phase === 'PREP' && needsRepair
              ? `<button class="btn btn-accent" data-action="repair-struct" data-id="${struct.uid}" ${canRepair ? '' : 'disabled'}>Repair (₽${repairCost})</button>`
              : ''
          }
          ${
            isBarrel
              ? `<button class="btn btn-danger" data-action="detonate-barrel" data-id="${struct.uid}">Detonate</button>`
              : ''
          }
        </div>
      </section>
    `;
  }

  private renderSelectedPokemon(
    snap: GameSnapshot,
    unit: ActiveUnit | null,
  ): string {
    if (!unit) {
      return `
        <section class="card">
          <div class="section-header"><span>Selected Pokémon</span></div>
          <div class="tool-desc">Select an active Pokémon on the grid or roster below.</div>
        </section>
      `;
    }

    const species = POKEMON_SPECIES[unit.speciesId];
    if (!species) return '';

    const hpPct = pct(unit.hp, unit.maxHp).toFixed(1);
    const ultPct = pct(unit.ult, unit.ultMax).toFixed(1);
    const ultReady = !unit.fainted && unit.ult >= unit.ultMax;
    const isAiming = snap.aimingUltUnitUid === unit.uid;
    const canHeal =
      snap.phase === 'PREP' && !unit.fainted && unit.hp < unit.maxHp && snap.gold >= HEAL_COST;
    const canRevive =
      snap.phase === 'PREP' && unit.fainted && snap.gold >= REVIVE_COST;

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
            ${ultReady ? '' : 'disabled'}
          >
            ${isAiming ? 'Aiming Ult...' : 'Cast Ult'}
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

        ${
          snap.phase === 'PREP'
            ? `
              <div class="btn-row">
                <button
                  class="btn btn-accent"
                  data-action="heal-unit"
                  data-id="${unit.uid}"
                  ${canHeal ? '' : 'disabled'}
                >
                  Heal (₽${HEAL_COST})
                </button>
                <button
                  class="btn btn-primary"
                  data-action="revive-unit"
                  data-id="${unit.uid}"
                  ${canRevive ? '' : 'disabled'}
                >
                  Revive (₽${REVIVE_COST})
                </button>
              </div>
            `
            : ''
        }

        <div class="desc-box">
          <div><strong>Passive:</strong> ${escapeHtml(species.passiveDesc)}</div>
          <div><strong>Ult — ${escapeHtml(species.ultName)}:</strong> ${escapeHtml(species.ultDesc)}</div>
        </div>
      </section>
    `;
  }

  private renderTeamAndReserve(snap: GameSnapshot): string {
    const activeChips = snap.activeUnits
      .map((u) => {
        const sp = POKEMON_SPECIES[u.speciesId];
        const name = sp ? sp.name : u.speciesId;
        const color = sp ? sp.color : '#8b949e';
        const selected = u.uid === snap.selectedUnitUid ? 'selected' : '';
        const fainted = u.fainted ? 'fainted' : '';
        const hpLabel = u.fainted ? 'KO' : `${Math.ceil(u.hp)}/${u.maxHp}`;
        return `
          <button
            class="unit-chip ${selected} ${fainted}"
            data-action="select-unit"
            data-id="${u.uid}"
          >
            <span class="swatch" style="background:${color}"></span>
            <span>${escapeHtml(name)}</span>
            <span class="chip-hp">${hpLabel}</span>
          </button>
        `;
      })
      .join('');

    const canSwap = snap.phase === 'PREP' && Boolean(snap.selectedUnitUid);
    const reserveChips = snap.reserveIds.length
      ? snap.reserveIds
          .map((id) => {
            const sp = POKEMON_SPECIES[id];
            const name = sp ? sp.name : id;
            const color = sp ? sp.color : '#8b949e';
            return `
              <button
                class="unit-chip reserve"
                data-action="swap-reserve"
                data-id="${id}"
                ${canSwap ? '' : 'disabled'}
                title="${canSwap ? 'Swap with selected active Pokémon' : 'Select an active Pokémon during PREP to swap'}"
              >
                <span class="swatch" style="background:${color}"></span>
                <span>${escapeHtml(name)}</span>
              </button>
            `;
          })
          .join('')
      : '<span class="tool-desc">No reserve Pokémon.</span>';

    return `
      <section class="card">
        <div class="section-header">
          <span>Active Team</span>
          <span>${snap.activeUnits.length} deployed</span>
        </div>
        <div class="chips-grid">${activeChips}</div>
        <div class="section-header" style="margin-top:4px">
          <span>Reserve</span>
          <span>${snap.phase === 'PREP' ? 'Click to swap selected' : 'PREP only'}</span>
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
