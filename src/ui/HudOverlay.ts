import Phaser from 'phaser';
import type { BattleScene } from '../scenes/BattleScene';
import { POKEMON_SPECIES } from '../data/pokemon';
import { GameSnapshot, MapDifficulty } from '../types';
import { ToolId } from './hudShared';
import {
  renderRelicTooltipContent,
  renderShopTooltipContent,
  renderSidePanelHtml,
  renderTopBarHtml,
} from './hudSidePanel';
import { renderModalHtml } from './hudModals';

export class HudOverlay {
  private readonly topBar: HTMLElement | null;
  private readonly sidePanel: HTMLElement | null;
  private readonly modalRoot: HTMLElement | null;

  private lastSnap: GameSnapshot | null = null;
  private showCredits = false;
  private showPokedex = false;
  private pokedexFilter: 'all' | 'unlocked' | 'locked' = 'all';
  private inspectedPokedexId: string | null = '0001';
  private mapDifficultyFilter: 'All' | MapDifficulty = 'All';
  private sideTab: 'team' | 'shop' = 'team';
  private expandedUnitUid: string | null = null;
  private inspectedDraftId: string | null = null;
  private hoveredTool: ToolId | null = null;
  private hoveredRelicId: string | null = null;

  private lastTopHtml = '';
  private lastSideHtml = '';
  private lastModalHtml = '';

  private readonly onSnapshot = (snap: GameSnapshot): void => {
    this.render(snap);
  };

  private readonly onClick = (ev: Event): void => {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-action]',
    );
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id ?? '';
    if (!action) return;

    if (action === 'toggle-credits') {
      this.scene()?.playUiSfx?.('ui_click');
      this.showCredits = !this.showCredits;
      this.renderModal();
      return;
    }
    if (action === 'close-credits') {
      this.scene()?.playUiSfx?.('ui_click');
      this.showCredits = false;
      this.renderModal();
      return;
    }
    if (action === 'open-pokedex') {
      this.scene()?.playUiSfx?.('ui_click');
      this.showPokedex = true;
      this.renderModal();
      return;
    }
    if (action === 'close-pokedex') {
      this.scene()?.playUiSfx?.('ui_click');
      this.showPokedex = false;
      this.renderModal();
      return;
    }
    if (action === 'pokedex-filter') {
      this.scene()?.playUiSfx?.('ui_click');
      this.pokedexFilter = id === 'unlocked' || id === 'locked' ? id : 'all';
      this.renderModal();
      return;
    }
    if (action === 'inspect-pokedex') {
      if (id && POKEMON_SPECIES[id]) {
        this.scene()?.playUiSfx?.('ui_select');
        this.inspectedPokedexId = id;
        this.renderModal();
      }
      return;
    }
    if (action === 'cancel-action') {
      this.scene()?.playUiSfx?.('ui_click');
      this.cancelActiveAction();
      return;
    }

    const scene = this.scene();
    if (!scene) return;

    if (
      action !== 'toggle-speed' &&
      action !== 'toggle-mute' &&
      action !== 'start-wave'
    ) {
      if (
        action === 'buy-item' ||
        action === 'heal-unit' ||
        action === 'revive-unit'
      ) {
        scene.playUiSfx?.('coin');
      } else if (
        action === 'confirm-draft' ||
        action === 'pick-reward' ||
        action === 'pick-branch'
      ) {
        scene.playUiSfx?.('ui_confirm');
      } else {
        scene.playUiSfx?.('ui_click');
      }
    }

    switch (action) {
      case 'toggle-speed':
        scene.toggleSpeed?.();
        break;
      case 'toggle-mute':
        scene.toggleMute?.();
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
      case 'home-play':
        scene.startPlayFromHome?.();
        break;
      case 'select-map':
        scene.selectMapAndDraft?.(id);
        break;
      case 'back-map-select':
        scene.backToMapSelect?.();
        break;
      case 'map-filter':
        this.mapDifficultyFilter =
          id === 'Beginner' ||
          id === 'Intermediate' ||
          id === 'Advanced' ||
          id === 'Expert'
            ? id
            : 'All';
        this.renderModal();
        break;
      case 'back-home':
        scene.returnToHome?.();
        break;
      case 'inspect-draft':
        if (id && POKEMON_SPECIES[id]) {
          this.inspectedDraftId = id;
          this.renderModal();
        }
        break;
      case 'toggle-draft':
        scene.toggleDraftSpecies?.(id);
        break;
      case 'clear-draft':
        scene.clearDraft?.();
        break;
      case 'confirm-draft':
        scene.confirmDraft?.();
        break;
      case 'pick-branch-reward':
        scene.pickBranchReward?.(id);
        break;
      case 'deploy-reserve':
        scene.deployReserve?.(id);
        break;
      case 'switch-tab':
        this.sideTab = id === 'shop' ? 'shop' : 'team';
        if (this.lastSnap) this.renderSidePanel(this.lastSnap);
        break;
      case 'expand-unit':
        this.expandedUnitUid = id || null;
        this.renderModal();
        break;
      case 'close-expanded-unit':
        this.expandedUnitUid = null;
        this.renderModal();
        break;
      case 'buy-item':
        scene.buyHeldItem?.(id);
        break;
      case 'equip-item': {
        const unitUid = target.dataset.unit ?? this.lastSnap?.selectedUnitUid;
        if (unitUid) scene.equipHeldItem?.(unitUid, id);
        break;
      }
      case 'unequip-item': {
        const unitUid = target.dataset.unit ?? this.lastSnap?.selectedUnitUid;
        const idx = Number(id);
        if (unitUid && !Number.isNaN(idx)) {
          scene.unequipHeldItem?.(unitUid, idx);
        }
        break;
      }
      case 'restart-run':
        scene.restartRun?.();
        break;
    }
  };

  private readonly onChange = (ev: Event): void => {
    const input = ev.target as HTMLInputElement | null;
    if (!input || input.dataset.action !== 'toggle-auto-ult') return;
    const uid = input.dataset.id;
    if (uid) this.scene()?.toggleAutoUlt?.(uid);
  };

  private readonly onToolEnter = (ev: Event): void => {
    const el = ev.target as HTMLElement | null;
    const toolTarget = el?.closest<HTMLElement>('[data-tool-tip]');
    if (toolTarget) {
      const tipId = toolTarget.dataset.toolTip as ToolId | undefined;
      if (tipId && tipId !== this.hoveredTool) {
        this.hoveredTool = tipId;
        this.updateShopTooltip();
      }
    }
    const relicTarget = el?.closest<HTMLElement>('[data-relic-tip]');
    if (relicTarget) {
      const relicId = relicTarget.dataset.relicTip;
      if (relicId && relicId !== this.hoveredRelicId) {
        this.hoveredRelicId = relicId;
        this.updateRelicTooltip();
      }
    }
  };

  private readonly onToolLeave = (ev: Event): void => {
    const mouseOrFocus = ev as MouseEvent | FocusEvent;
    const el = ev.target as HTMLElement | null;
    const related = mouseOrFocus.relatedTarget as HTMLElement | null;

    const leavingTool = el?.closest<HTMLElement>('[data-tool-tip]');
    if (leavingTool && !related?.closest<HTMLElement>('[data-tool-tip]')) {
      if (this.hoveredTool !== null) {
        this.hoveredTool = null;
        this.updateShopTooltip();
      }
    }

    const leavingRelic = el?.closest<HTMLElement>('[data-relic-tip]');
    if (leavingRelic && !related?.closest<HTMLElement>('[data-relic-tip]')) {
      if (this.hoveredRelicId !== null) {
        this.hoveredRelicId = null;
        this.updateRelicTooltip();
      }
    }
  };

  private readonly onModalClick = (ev: Event): void => {
    const target = ev.target as HTMLElement | null;
    if (
      target === this.modalRoot ||
      target?.classList.contains('menu-backdrop')
    ) {
      if (this.showCredits) {
        this.showCredits = false;
        this.renderModal();
        return;
      }
      if (this.showPokedex) {
        this.showPokedex = false;
        this.renderModal();
        return;
      }
      if (this.expandedUnitUid) {
        this.expandedUnitUid = null;
        this.renderModal();
        return;
      }
    }
    this.onClick(ev);
  };

  private readonly onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape') return;
    if (this.showCredits) {
      this.showCredits = false;
      this.renderModal();
      return;
    }
    if (this.showPokedex) {
      this.showPokedex = false;
      this.renderModal();
      return;
    }
    if (this.expandedUnitUid) {
      this.expandedUnitUid = null;
      this.renderModal();
      return;
    }
    this.cancelActiveAction();
  };

  constructor(private readonly game: Phaser.Game) {
    this.topBar = document.getElementById('top-bar');
    this.sidePanel = document.getElementById('side-panel');
    this.modalRoot = document.getElementById('modal-root');

    this.bindEvents();
    this.game.events.on('snapshot', this.onSnapshot);
  }

  public destroy(): void {
    this.game.events.off('snapshot', this.onSnapshot);
    this.topBar?.removeEventListener('click', this.onClick);
    this.sidePanel?.removeEventListener('click', this.onClick);
    this.sidePanel?.removeEventListener('change', this.onChange);
    this.modalRoot?.removeEventListener('change', this.onChange);
    this.sidePanel?.removeEventListener('mouseover', this.onToolEnter);
    this.sidePanel?.removeEventListener('mouseout', this.onToolLeave);
    this.sidePanel?.removeEventListener('focusin', this.onToolEnter);
    this.sidePanel?.removeEventListener('focusout', this.onToolLeave);
    this.modalRoot?.removeEventListener('click', this.onModalClick);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private scene(): BattleScene | undefined {
    return this.game.scene.getScene('BattleScene') as BattleScene | undefined;
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
    this.topBar?.addEventListener('click', this.onClick);
    this.sidePanel?.addEventListener('click', this.onClick);
    this.sidePanel?.addEventListener('change', this.onChange);
    this.modalRoot?.addEventListener('change', this.onChange);
    this.sidePanel?.addEventListener('mouseover', this.onToolEnter);
    this.sidePanel?.addEventListener('mouseout', this.onToolLeave);
    this.sidePanel?.addEventListener('focusin', this.onToolEnter);
    this.sidePanel?.addEventListener('focusout', this.onToolLeave);
    this.modalRoot?.addEventListener('click', this.onModalClick);
    window.addEventListener('keydown', this.onKeyDown);
  }

  private updateShopTooltip(): void {
    if (!this.sidePanel || !this.lastSnap) return;
    const box = this.sidePanel.querySelector<HTMLElement>('#shop-tooltip');
    if (!box) return;
    box.innerHTML = renderShopTooltipContent(this.lastSnap, this.hoveredTool);
  }

  private updateRelicTooltip(): void {
    if (!this.sidePanel || !this.lastSnap) return;
    const box = this.sidePanel.querySelector<HTMLElement>('#relic-tooltip');
    if (!box) return;
    box.innerHTML = renderRelicTooltipContent(
      this.lastSnap,
      this.hoveredRelicId,
    );
  }

  public render(snap: GameSnapshot): void {
    this.lastSnap = snap;
    if (snap.phase !== 'PREP') {
      this.hoveredTool = null;
    }
    const isMenuPhase =
      snap.phase === 'HOME' ||
      snap.phase === 'MAP_SELECT' ||
      snap.phase === 'DRAFT';
    if (this.topBar) this.topBar.style.display = isMenuPhase ? 'none' : '';
    if (this.sidePanel)
      this.sidePanel.style.display = isMenuPhase ? 'none' : '';
    this.renderTopBar(snap);
    this.renderSidePanel(snap);
    this.renderModal();
  }

  private renderTopBar(snap: GameSnapshot): void {
    if (!this.topBar) return;
    const html = renderTopBarHtml(snap);
    if (html !== this.lastTopHtml) {
      this.topBar.innerHTML = html;
      this.lastTopHtml = html;
    }
  }

  private renderSidePanel(snap: GameSnapshot): void {
    if (!this.sidePanel) return;
    const html = renderSidePanelHtml(snap, {
      sideTab: this.sideTab,
      hoveredTool: this.hoveredTool,
      hoveredRelicId: this.hoveredRelicId,
    });
    if (html !== this.lastSideHtml) {
      this.sidePanel.innerHTML = html;
      this.lastSideHtml = html;
    }
  }

  private renderModal(): void {
    if (!this.modalRoot) return;
    const { html, invalidExpandedUnit } = renderModalHtml(this.lastSnap, {
      showCredits: this.showCredits,
      showPokedex: this.showPokedex,
      pokedexFilter: this.pokedexFilter,
      inspectedPokedexId: this.inspectedPokedexId,
      mapDifficultyFilter: this.mapDifficultyFilter,
      inspectedDraftId: this.inspectedDraftId,
      expandedUnitUid: this.expandedUnitUid,
    });
    if (invalidExpandedUnit) {
      this.expandedUnitUid = null;
    }
    if (html !== this.lastModalHtml) {
      this.modalRoot.innerHTML = html;
      this.lastModalHtml = html;
    }
  }
}
