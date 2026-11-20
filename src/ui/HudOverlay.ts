import Phaser from 'phaser';
import type { BattleScene } from '../scenes/BattleScene';
import { ENEMY_SPECIES, POKEMON_SPECIES } from '../data/pokemon';
import { getEnemyThreatSummary } from '../engine/rules';
import {
  ContextInspectTarget,
  EggHatchResult,
  EggTier,
  GameSnapshot,
  MapDifficulty,
  PokemonClass,
  PokemonRarity,
  RunDifficulty,
} from '../types';
import {
  escapeHtml,
  renderPokeIcon,
  renderSpeciesTypeBadges,
  ToolId,
} from './hudShared';
import {
  CombatStatTab,
  formatTimerMs,
  renderBottomBarHtml,
  renderRelicTooltipContent,
  renderShopTooltipContent,
  renderSidePanelHtml,
  renderStructurePopoverHtml,
  renderTopBarHtml,
  renderUnitPopoverHtml,
} from './hudSidePanel';
import { renderModalHtml } from './hudModals';

export class HudOverlay {
  private readonly topBar: HTMLElement | null;
  private readonly sidePanel: HTMLElement | null;
  private readonly bottomBar: HTMLElement | null;
  private readonly mapPopover: HTMLElement | null;
  private readonly modalRoot: HTMLElement | null;
  private readonly enemyIntroBanner: HTMLElement | null;

  private enemyIntroQueue: string[] = [];
  private enemyIntroActiveId: string | null = null;
  private enemyIntroLeaveTimer: ReturnType<typeof setTimeout> | null = null;
  private enemyIntroNextTimer: ReturnType<typeof setTimeout> | null = null;

  private lastSnap: GameSnapshot | null = null;
  private popoverTarget: ContextInspectTarget | null = null;
  private lastPopoverHtml = '';
  private showCredits = false;
  private showPokedex = false;
  private typeChartOpen = false;
  private showEggs = false;
  private showHatchRates = false;
  private hatchResult: EggHatchResult | null = null;
  private hatchSeq = 0;
  private pokedexFilter: 'all' | 'unlocked' | 'locked' = 'all';
  private rosterClassFilter: 'All' | PokemonClass = 'All';
  private rosterRarityFilter: 'All' | PokemonRarity = 'All';
  private rosterCostFilter: 'All' | '1' | '2' | '3' | '4' | '5+' = 'All';
  private inspectedPokedexId: string | null = '0001';
  private mapDifficultyFilter: 'All' | MapDifficulty = 'All';
  private selectedDifficultyPreview: RunDifficulty = 'normal';
  private combatStatTab: CombatStatTab = 'dealt';
  private expandedUnitUid: string | null = null;
  private inspectedDraftId: string | null = null;
  private hoveredTool: ToolId | null = null;
  private hoveredRelicId: string | null = null;

  private lastTopHtml = '';
  private lastSideHtml = '';
  private lastBottomHtml = '';
  private lastModalHtml = '';
  private lastModalKind = '';
  private lastPopoverPosKey = '';
  private previousFocus: HTMLElement | null = null;

  private readonly onSnapshot = (snap: GameSnapshot): void => {
    this.render(snap);
  };

  private readonly onInspectUnit = (uid: string): void => {
    if (!uid) return;
    if (!this.expandedUnitUid) this.capturePreviousFocus();
    this.expandedUnitUid = uid;
    this.renderModal();
  };

  private readonly onContextInspect = (
    target: ContextInspectTarget | null,
  ): void => {
    this.popoverTarget = target;
    this.renderPopover();
  };

  private readonly onEnemyIntroduced = (speciesId: string): void => {
    if (!speciesId || !ENEMY_SPECIES[speciesId]) return;
    if (
      this.enemyIntroActiveId === speciesId ||
      this.enemyIntroQueue.includes(speciesId)
    ) {
      return;
    }
    this.enemyIntroQueue.push(speciesId);
    if (!this.enemyIntroActiveId) {
      this.showNextEnemyIntro();
    }
  };

  private readonly onRunReset = (): void => {
    this.clearEnemyIntroQueue();
  };

  private readonly onDocumentPointerDown = (ev: PointerEvent): void => {
    if (!this.popoverTarget || !this.mapPopover || this.mapPopover.hidden) {
      return;
    }
    if (ev.button === 2) return;
    if (ev.target instanceof Node && this.mapPopover.contains(ev.target)) {
      return;
    }
    this.closePopover();
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
      if (!this.showCredits) this.capturePreviousFocus();
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
      if (!this.showPokedex) this.capturePreviousFocus();
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
    if (action === 'open-type-chart') {
      this.scene()?.playUiSfx?.('ui_click');
      if (!this.typeChartOpen) this.capturePreviousFocus();
      this.typeChartOpen = true;
      this.renderModal();
      return;
    }
    if (action === 'close-type-chart') {
      this.scene()?.playUiSfx?.('ui_click');
      this.typeChartOpen = false;
      this.renderModal();
      return;
    }
    if (action === 'toggle-draft-card') {
      if (id) {
        this.inspectedDraftId = id;
        this.scene()?.toggleDraftSpecies?.(id);
        this.renderModal();
      }
      return;
    }
    if (action === 'reset-roster-filters') {
      this.scene()?.playUiSfx?.('ui_click');
      this.rosterClassFilter = 'All';
      this.rosterRarityFilter = 'All';
      this.rosterCostFilter = 'All';
      this.renderModal();
      return;
    }
    if (action === 'open-eggs') {
      this.scene()?.playUiSfx?.('ui_click');
      if (!this.showEggs) this.capturePreviousFocus();
      this.showEggs = true;
      this.showHatchRates = false;
      this.renderModal();
      return;
    }
    if (action === 'close-eggs') {
      this.scene()?.playUiSfx?.('ui_click');
      this.showEggs = false;
      this.showHatchRates = false;
      this.renderModal();
      return;
    }
    if (action === 'toggle-hatch-rates') {
      this.scene()?.playUiSfx?.('ui_click');
      this.showHatchRates = !this.showHatchRates;
      this.renderModal();
      return;
    }
    if (action === 'close-hatch-result') {
      this.scene()?.playUiSfx?.('ui_click');
      this.hatchResult = null;
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
    if (action === 'close-popover') {
      this.scene()?.playUiSfx?.('ui_click');
      this.closePopover();
      return;
    }

    const scene = this.scene();
    if (!scene) return;

    if (
      action !== 'toggle-speed' &&
      action !== 'toggle-mute' &&
      action !== 'start-wave' &&
      action !== 'target-prev' &&
      action !== 'target-next'
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
        action === 'pick-branch' ||
        action === 'unlock-species' ||
        action === 'upgrade-potential' ||
        action === 'hatch-egg' ||
        action === 'hatch-another'
      ) {
        scene.playUiSfx?.('ui_confirm');
      } else {
        scene.playUiSfx?.('ui_click');
      }
    }

    switch (action) {
      case 'toggle-pause':
        scene.togglePause?.();
        break;
      case 'toggle-speed':
        scene.toggleSpeed?.();
        break;
      case 'toggle-mute':
        scene.toggleMute?.();
        break;
      case 'toggle-shake':
        scene.toggleScreenShake?.();
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
        this.closePopover();
        break;
      case 'sell-struct-uid':
        scene.sellStructureByUid?.(id);
        this.closePopover();
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
      case 'target-prev':
        scene.cycleUnitTargetPriority?.(id, -1);
        break;
      case 'target-next':
        scene.cycleUnitTargetPriority?.(id, 1);
        break;
      case 'select-unit':
        scene.selectUnit?.(id);
        break;
      case 'swap-reserve': {
        const activeUid = this.lastSnap?.selectedUnitUid;
        if (activeUid) scene.swapReserve?.(activeUid, id);
        break;
      }
      case 'pick-reward':
        scene.pickReward?.(id);
        break;
      case 'reroll-rewards':
        scene.rerollRewards?.();
        break;
      case 'home-play':
        scene.startPlayFromHome?.();
        break;
      case 'select-map':
        this.selectedDifficultyPreview =
          this.lastSnap?.selectedDifficulty ?? 'normal';
        scene.selectMapAndDraft?.(id);
        break;
      case 'preview-difficulty':
        if (
          id === 'easy' ||
          id === 'normal' ||
          id === 'hard' ||
          id === 'expert'
        ) {
          this.selectedDifficultyPreview = id;
          this.renderModal();
        }
        break;
      case 'confirm-difficulty': {
        const chosen =
          id === 'easy' || id === 'normal' || id === 'hard' || id === 'expert'
            ? id
            : this.selectedDifficultyPreview;
        scene.selectDifficultyAndDraft?.(chosen);
        break;
      }
      case 'back-difficulty-select':
        scene.backToDifficultySelect?.();
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
      case 'clear-draft':
        scene.clearDraft?.();
        break;
      case 'confirm-draft':
        scene.confirmDraft?.();
        break;
      case 'specialize-unit': {
        const unitUid = target.dataset.unit ?? '';
        if (unitUid) scene.specializeUnit?.(unitUid, id);
        break;
      }
      case 'deploy-reserve':
        scene.deployReserve?.(id);
        break;
      case 'release-unit':
        scene.releaseUnit?.(id);
        this.closePopover();
        if (this.expandedUnitUid === id) {
          this.expandedUnitUid = null;
          this.renderModal();
        }
        break;
      case 'release-reserve':
        scene.releaseReserve?.(id);
        break;
      case 'switch-stat-tab':
        this.combatStatTab = id === 'taken' || id === 'healed' ? id : 'dealt';
        if (this.lastSnap) this.renderSidePanel(this.lastSnap);
        break;
      case 'close-shop':
        scene.closeShop?.();
        break;
      case 'expand-unit':
        this.closePopover();
        if (!this.expandedUnitUid && id) this.capturePreviousFocus();
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
      case 'buy-rare-candy': {
        const unitUid = target.dataset.unit;
        if (unitUid && id) scene.buyRareCandy?.(unitUid, id);
        break;
      }
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
      case 'unlock-species':
        if (id) scene.unlockSpeciesWithShards?.(id);
        break;
      case 'upgrade-potential':
        if (id) scene.upgradeSpeciesPotential?.(id);
        break;
      case 'hatch-egg': {
        const tier = id as EggTier;
        if (tier === 'common' || tier === 'rare' || tier === 'master') {
          const res = scene.hatchEgg?.(tier) ?? null;
          if (res) {
            this.hatchResult = res;
            this.hatchSeq += 1;
            this.renderModal();
          }
        }
        break;
      }
      case 'hatch-another': {
        if (!this.hatchResult) break;
        const tier = this.hatchResult.eggTier;
        const res = scene.hatchEgg?.(tier) ?? null;
        if (res) {
          this.hatchResult = res;
          this.hatchSeq += 1;
          this.renderModal();
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
    if (target?.classList.contains('home-bg-hit')) {
      this.scene()?.playUiSfx?.('ui_confirm');
      this.scene()?.startPlayFromHome?.();
      return;
    }
    if (
      target === this.modalRoot ||
      target?.classList.contains('menu-backdrop') ||
      (this.showCredits && target?.classList.contains('modal-card'))
    ) {
      if (this.hatchResult) {
        this.hatchResult = null;
        this.renderModal();
        return;
      }
      if (this.typeChartOpen) {
        this.typeChartOpen = false;
        this.renderModal();
        return;
      }
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
      if (this.showEggs) {
        this.showEggs = false;
        this.showHatchRates = false;
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

  private readonly onModalDblClick = (ev: Event): void => {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-action="inspect-draft"]',
    );
    const id = target?.dataset.id;
    if (!id) return;
    const scene = this.scene();
    if (!scene) return;
    scene.playUiSfx?.('ui_click');
    scene.toggleDraftSpecies?.(id);
  };

  private readonly onContextMenu = (ev: MouseEvent): void => {
    const snap = this.lastSnap;
    if (!snap || (snap.phase !== 'PREP' && snap.phase !== 'COMBAT')) return;
    if (
      snap.selectedTool !== null ||
      Boolean(snap.movingStructureUid) ||
      snap.aimingUltUnitUid !== null ||
      snap.selectedUnitUid !== null
    ) {
      ev.preventDefault();
      this.cancelActiveAction();
    }
  };

  private readonly onKeyDown = (ev: KeyboardEvent): void => {
    if (
      ev.key === 'Tab' &&
      this.lastModalHtml !== '' &&
      this.modalRoot?.classList.contains('is-fullscreen')
    ) {
      const focusables = this.getModalFocusables();
      if (focusables.length === 0) {
        ev.preventDefault();
        this.modalRoot.querySelector<HTMLElement>('.modal-card')?.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (ev.shiftKey) {
        if (
          !active ||
          !this.modalRoot.contains(active) ||
          active === first ||
          active.classList.contains('modal-card')
        ) {
          ev.preventDefault();
          last.focus();
        }
      } else if (
        !active ||
        !this.modalRoot.contains(active) ||
        active === last
      ) {
        ev.preventDefault();
        first.focus();
      }
      return;
    }

    if (ev.key !== 'Escape') return;
    if (this.hatchResult) {
      this.hatchResult = null;
      this.renderModal();
      return;
    }
    if (this.typeChartOpen) {
      this.typeChartOpen = false;
      this.renderModal();
      return;
    }
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
    if (this.showEggs) {
      this.showEggs = false;
      this.showHatchRates = false;
      this.renderModal();
      return;
    }
    if (this.expandedUnitUid) {
      this.expandedUnitUid = null;
      this.renderModal();
      return;
    }
    if (this.lastModalHtml !== '') {
      return;
    }
    if (this.popoverTarget) {
      this.closePopover();
      return;
    }
    this.cancelActiveAction();
  };

  constructor(private readonly game: Phaser.Game) {
    this.topBar = document.getElementById('top-bar');
    this.sidePanel = document.getElementById('side-panel');
    this.bottomBar = document.getElementById('bottom-bar');
    this.mapPopover = document.getElementById('map-popover');
    this.modalRoot = document.getElementById('modal-root');
    this.enemyIntroBanner = this.createEnemyIntroBanner();

    this.bindEvents();
    this.game.events.on('snapshot', this.onSnapshot);
    this.game.events.on('inspect-unit', this.onInspectUnit);
    this.game.events.on('context-inspect', this.onContextInspect);
    this.game.events.on('enemy-introduced', this.onEnemyIntroduced);
    this.game.events.on('run-reset', this.onRunReset);
  }

  public destroy(): void {
    this.clearEnemyIntroQueue();
    this.enemyIntroBanner?.remove();
    this.game.events.off('snapshot', this.onSnapshot);
    this.game.events.off('inspect-unit', this.onInspectUnit);
    this.game.events.off('context-inspect', this.onContextInspect);
    this.game.events.off('enemy-introduced', this.onEnemyIntroduced);
    this.game.events.off('run-reset', this.onRunReset);
    this.topBar?.removeEventListener('click', this.onClick);
    this.topBar?.removeEventListener('contextmenu', this.onContextMenu);
    this.topBar?.removeEventListener('mouseover', this.onToolEnter);
    this.topBar?.removeEventListener('mouseout', this.onToolLeave);
    this.topBar?.removeEventListener('focusin', this.onToolEnter);
    this.topBar?.removeEventListener('focusout', this.onToolLeave);
    this.sidePanel?.removeEventListener('click', this.onClick);
    this.sidePanel?.removeEventListener('contextmenu', this.onContextMenu);
    this.sidePanel?.removeEventListener('change', this.onChange);
    this.bottomBar?.removeEventListener('click', this.onClick);
    this.bottomBar?.removeEventListener('contextmenu', this.onContextMenu);
    this.bottomBar?.removeEventListener('dblclick', this.onBottomDblClick);
    this.mapPopover?.removeEventListener('click', this.onClick);
    this.mapPopover?.removeEventListener('contextmenu', this.onContextMenu);
    this.modalRoot?.removeEventListener('change', this.onChange);
    this.sidePanel?.removeEventListener('mouseover', this.onToolEnter);
    this.sidePanel?.removeEventListener('mouseout', this.onToolLeave);
    this.sidePanel?.removeEventListener('focusin', this.onToolEnter);
    this.sidePanel?.removeEventListener('focusout', this.onToolLeave);
    this.modalRoot?.removeEventListener('click', this.onModalClick);
    this.modalRoot?.removeEventListener('change', this.onModalChange);
    this.modalRoot?.removeEventListener('dblclick', this.onModalDblClick);
    document.removeEventListener('pointerdown', this.onDocumentPointerDown);
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

  private readonly onBottomDblClick = (ev: Event): void => {
    const btn = (ev.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-action="select-unit"]',
    );
    const uid = btn?.dataset.id;
    if (!uid) return;
    this.closePopover();
    if (!this.expandedUnitUid) this.capturePreviousFocus();
    this.expandedUnitUid = uid;
    this.renderModal();
  };

  private bindEvents(): void {
    this.topBar?.addEventListener('click', this.onClick);
    this.topBar?.addEventListener('contextmenu', this.onContextMenu);
    this.topBar?.addEventListener('mouseover', this.onToolEnter);
    this.topBar?.addEventListener('mouseout', this.onToolLeave);
    this.topBar?.addEventListener('focusin', this.onToolEnter);
    this.topBar?.addEventListener('focusout', this.onToolLeave);
    this.sidePanel?.addEventListener('click', this.onClick);
    this.sidePanel?.addEventListener('contextmenu', this.onContextMenu);
    this.sidePanel?.addEventListener('change', this.onChange);
    this.bottomBar?.addEventListener('click', this.onClick);
    this.bottomBar?.addEventListener('contextmenu', this.onContextMenu);
    this.bottomBar?.addEventListener('dblclick', this.onBottomDblClick);
    this.mapPopover?.addEventListener('click', this.onClick);
    this.mapPopover?.addEventListener('contextmenu', this.onContextMenu);
    this.modalRoot?.addEventListener('change', this.onChange);
    this.sidePanel?.addEventListener('mouseover', this.onToolEnter);
    this.sidePanel?.addEventListener('mouseout', this.onToolLeave);
    this.sidePanel?.addEventListener('focusin', this.onToolEnter);
    this.sidePanel?.addEventListener('focusout', this.onToolLeave);
    this.modalRoot?.addEventListener('click', this.onModalClick);
    this.modalRoot?.addEventListener('change', this.onModalChange);
    this.modalRoot?.addEventListener('dblclick', this.onModalDblClick);
    document.addEventListener('pointerdown', this.onDocumentPointerDown);
    window.addEventListener('keydown', this.onKeyDown);
  }

  private readonly onModalChange = (ev: Event): void => {
    const target = ev.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const action = target.dataset.action;
    if (!action) return;
    this.scene()?.playUiSfx?.('ui_click');
    if (action === 'roster-class-filter') {
      this.rosterClassFilter = target.value as 'All' | PokemonClass;
      this.renderModal();
    } else if (action === 'roster-rarity-filter') {
      this.rosterRarityFilter = target.value as 'All' | PokemonRarity;
      this.renderModal();
    } else if (action === 'roster-cost-filter') {
      this.rosterCostFilter = target.value as
        'All' | '1' | '2' | '3' | '4' | '5+';
      this.renderModal();
    }
  };

  private updateShopTooltip(): void {
    if (!this.sidePanel || !this.lastSnap) return;
    const box = this.sidePanel.querySelector<HTMLElement>('#shop-tooltip');
    if (!box) return;
    box.innerHTML = renderShopTooltipContent(this.lastSnap, this.hoveredTool);
  }

  private updateRelicTooltip(): void {
    if (!this.topBar || !this.lastSnap) return;
    const box = this.topBar.querySelector<HTMLElement>('#relic-tooltip');
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
      snap.phase === 'DIFFICULTY_SELECT' ||
      snap.phase === 'DRAFT';
    if (this.topBar) this.topBar.style.display = isMenuPhase ? 'none' : '';
    if (this.sidePanel)
      this.sidePanel.style.display = isMenuPhase ? 'none' : '';
    if (this.bottomBar)
      this.bottomBar.style.display = isMenuPhase ? 'none' : '';
    this.renderTopBar(snap);
    this.renderSidePanel(snap);
    this.renderBottomBar(snap);
    this.renderModal();
    this.renderPopover();
  }

  private closePopover(): void {
    this.popoverTarget = null;
    this.renderPopover();
  }

  private renderPopover(): void {
    if (!this.mapPopover) return;
    const target = this.popoverTarget;
    const snap = this.lastSnap;
    if (
      !target ||
      !snap ||
      this.lastModalHtml !== '' ||
      (snap.phase !== 'PREP' && snap.phase !== 'COMBAT')
    ) {
      this.mapPopover.hidden = true;
      this.lastPopoverHtml = '';
      return;
    }

    let html = '';
    if (target.kind === 'structure') {
      const struct = snap.structures.find((s) => s.uid === target.uid);
      if (struct) html = renderStructurePopoverHtml(snap, struct);
    } else {
      const unit = snap.activeUnits.find((u) => u.uid === target.uid);
      if (unit) html = renderUnitPopoverHtml(snap, unit);
    }

    if (!html) {
      this.popoverTarget = null;
      this.mapPopover.hidden = true;
      this.lastPopoverHtml = '';
      return;
    }

    if (html !== this.lastPopoverHtml) {
      this.mapPopover.innerHTML = html;
      this.lastPopoverHtml = html;
    }
    this.mapPopover.hidden = false;

    const posKey = `${target.kind}:${target.uid}:${target.screenX}:${target.screenY}:${html.length}:${window.innerWidth}x${window.innerHeight}`;
    if (posKey === this.lastPopoverPosKey) return;
    this.lastPopoverPosKey = posKey;

    const rect = this.mapPopover.getBoundingClientRect();
    const width = rect.width || 256;
    const height = rect.height || 200;
    const pad = 12;

    let maxLeft = window.innerWidth - width - pad;
    if (this.sidePanel && this.sidePanel.offsetParent !== null) {
      const sideRect = this.sidePanel.getBoundingClientRect();
      maxLeft = Math.min(maxLeft, sideRect.left - width - 10);
    }
    maxLeft = Math.max(pad, maxLeft);

    const left = Math.max(pad, Math.min(target.screenX + 18, maxLeft));
    const maxTop = Math.max(pad, window.innerHeight - height - pad);
    const top = Math.max(pad, Math.min(target.screenY - 12, maxTop));

    this.mapPopover.style.left = `${Math.round(left)}px`;
    this.mapPopover.style.top = `${Math.round(top)}px`;
  }

  private renderTopBar(snap: GameSnapshot): void {
    if (!this.topBar) return;
    const html = renderTopBarHtml(snap, this.hoveredRelicId);
    if (html !== this.lastTopHtml) {
      this.topBar.innerHTML = html;
      this.lastTopHtml = html;
    }
    const timerEl = this.topBar.querySelector<HTMLElement>('#hud-timer');
    if (timerEl) {
      const nextText = formatTimerMs(snap.waveElapsedMs);
      if (timerEl.textContent !== nextText) {
        timerEl.textContent = nextText;
      }
    }
  }

  private renderBottomBar(snap: GameSnapshot): void {
    if (!this.bottomBar) return;
    const html = renderBottomBarHtml(snap);
    if (html !== this.lastBottomHtml) {
      this.bottomBar.innerHTML = html;
      this.lastBottomHtml = html;
    }
  }

  private renderSidePanel(snap: GameSnapshot): void {
    if (!this.sidePanel) return;
    const html = renderSidePanelHtml(snap, {
      combatStatTab: this.combatStatTab,
      hoveredTool: this.hoveredTool,
      hoveredRelicId: this.hoveredRelicId,
    });
    if (html !== this.lastSideHtml) {
      const focusSelector = this.captureSidePanelFocusSelector();
      this.sidePanel.innerHTML = html;
      this.lastSideHtml = html;
      if (focusSelector) {
        const target = this.sidePanel.querySelector<HTMLElement>(focusSelector);
        if (target && !(target as HTMLButtonElement).disabled) {
          target.focus({ preventScroll: true });
        }
      }
    }
  }

  private renderModal(): void {
    if (!this.modalRoot) return;
    const { html, invalidExpandedUnit, layoutMode } = renderModalHtml(
      this.lastSnap,
      {
        showCredits: this.showCredits,
        showPokedex: this.showPokedex,
        typeChartOpen: this.typeChartOpen,
        showEggs: this.showEggs,
        showHatchRates: this.showHatchRates,
        hatchResult: this.hatchResult,
        hatchSeq: this.hatchSeq,
        pokedexFilter: this.pokedexFilter,
        rosterClassFilter: this.rosterClassFilter,
        rosterRarityFilter: this.rosterRarityFilter,
        rosterCostFilter: this.rosterCostFilter,
        inspectedPokedexId: this.inspectedPokedexId,
        mapDifficultyFilter: this.mapDifficultyFilter,
        selectedDifficultyPreview: this.selectedDifficultyPreview,
        inspectedDraftId: this.inspectedDraftId,
        expandedUnitUid: this.expandedUnitUid,
      },
    );
    if (invalidExpandedUnit) {
      this.expandedUnitUid = null;
    }
    this.modalRoot.classList.toggle('is-docked', layoutMode === 'docked');
    this.modalRoot.classList.toggle(
      'is-fullscreen',
      layoutMode === 'fullscreen',
    );
    const modalKind = this.getModalKind();
    if (html !== this.lastModalHtml) {
      const sameModal = modalKind === this.lastModalKind && modalKind !== '';
      if (
        sameModal &&
        (modalKind === 'pokedex' || modalKind === 'DRAFT') &&
        this.patchRosterModalInPlace(html)
      ) {
        this.lastModalHtml = html;
        this.lastModalKind = modalKind;
        return;
      }
      const savedScrolls = sameModal
        ? {
            grid:
              this.modalRoot.querySelector<HTMLElement>('.draft-roster-grid')
                ?.scrollTop ?? 0,
            detail:
              this.modalRoot.querySelector<HTMLElement>('.draft-detail-panel')
                ?.scrollTop ?? 0,
            card:
              this.modalRoot.querySelector<HTMLElement>('.modal-card')
                ?.scrollTop ?? 0,
          }
        : null;
      this.modalRoot.innerHTML = html;
      this.modalRoot
        .querySelector<HTMLElement>('.modal-card')
        ?.classList.toggle('docked-panel', layoutMode === 'docked');
      this.lastModalHtml = html;
      if (savedScrolls) {
        const gridEl =
          this.modalRoot.querySelector<HTMLElement>('.draft-roster-grid');
        const detailEl = this.modalRoot.querySelector<HTMLElement>(
          '.draft-detail-panel',
        );
        const cardEl = this.modalRoot.querySelector<HTMLElement>('.modal-card');
        if (gridEl) gridEl.scrollTop = savedScrolls.grid;
        if (detailEl) detailEl.scrollTop = savedScrolls.detail;
        if (cardEl) cardEl.scrollTop = savedScrolls.card;
      }
      if (html !== '' && modalKind !== this.lastModalKind) {
        this.focusModal();
      } else if (html === '' && this.lastModalKind !== '') {
        this.restorePreviousFocus();
      }
      this.lastModalKind = modalKind;
    }
  }

  private patchRosterModalInPlace(html: string): boolean {
    if (!this.modalRoot) return false;
    const oldGrid =
      this.modalRoot.querySelector<HTMLElement>('.draft-roster-grid');
    if (!oldGrid) return false;

    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    const newGrid =
      tpl.content.querySelector<HTMLElement>('.draft-roster-grid');
    if (!newGrid) return false;

    const oldCards = Array.from(oldGrid.children) as HTMLElement[];
    const newCards = Array.from(newGrid.children) as HTMLElement[];
    if (oldCards.length !== newCards.length) return false;
    for (let i = 0; i < oldCards.length; i++) {
      const oldId = oldCards[i].dataset.id;
      const newId = newCards[i].dataset.id;
      if (!oldId || oldId !== newId) return false;
    }

    // Sync card classes & aria-pressed without replacing <img> nodes
    for (let i = 0; i < oldCards.length; i++) {
      if (oldCards[i].className !== newCards[i].className) {
        oldCards[i].className = newCards[i].className;
      }
      const pressed = newCards[i].getAttribute('aria-pressed');
      if (pressed !== null) {
        oldCards[i].setAttribute('aria-pressed', pressed);
      }
    }

    // Update detail panel, team bar, and header if present
    const oldDetail = this.modalRoot.querySelector<HTMLElement>(
      '.draft-detail-panel',
    );
    const newDetail = tpl.content.querySelector<HTMLElement>(
      '.draft-detail-panel',
    );
    if (oldDetail && newDetail) {
      oldDetail.innerHTML = newDetail.innerHTML;
    }

    const oldTeamBar =
      this.modalRoot.querySelector<HTMLElement>('.draft-team-bar');
    const newTeamBar =
      tpl.content.querySelector<HTMLElement>('.draft-team-bar');
    if (oldTeamBar && newTeamBar) {
      oldTeamBar.innerHTML = newTeamBar.innerHTML;
    }

    const oldHeader =
      this.modalRoot.querySelector<HTMLElement>('.modal-header');
    const newHeader = tpl.content.querySelector<HTMLElement>('.modal-header');
    if (oldHeader && newHeader && oldHeader.innerHTML !== newHeader.innerHTML) {
      oldHeader.innerHTML = newHeader.innerHTML;
    }

    return true;
  }

  private captureSidePanelFocusSelector(): string | null {
    if (!this.sidePanel || this.lastModalHtml !== '') return null;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !this.sidePanel.contains(active)) {
      return null;
    }
    if (active.dataset.relicTip) {
      return `[data-relic-tip="${CSS.escape(active.dataset.relicTip)}"]`;
    }
    const action = active.dataset.action;
    if (!action) return null;
    let selector = `[data-action="${CSS.escape(action)}"]`;
    if (active.dataset.id !== undefined) {
      selector += `[data-id="${CSS.escape(active.dataset.id)}"]`;
    }
    if (active.dataset.unit !== undefined) {
      selector += `[data-unit="${CSS.escape(active.dataset.unit)}"]`;
    }
    return selector;
  }

  private capturePreviousFocus(): void {
    if (this.lastModalKind !== '') return;
    this.previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  }

  private getModalKind(): string {
    if (this.hatchResult) return `hatch-result:${this.hatchSeq}`;
    if (this.typeChartOpen) return 'type-chart';
    if (this.showCredits) return 'credits';
    if (this.showPokedex) return 'pokedex';
    if (this.showEggs) return this.showHatchRates ? 'eggs-rates' : 'eggs';
    if (!this.lastSnap) return '';
    const { phase } = this.lastSnap;
    if (
      phase === 'HOME' ||
      phase === 'MAP_SELECT' ||
      phase === 'DIFFICULTY_SELECT' ||
      phase === 'DRAFT' ||
      phase === 'SHOP' ||
      phase === 'VICTORY' ||
      phase === 'DEFEAT'
    ) {
      return phase;
    }
    if (phase === 'REWARD') {
      return 'REWARD';
    }
    if (this.expandedUnitUid) {
      return `unit:${this.expandedUnitUid}`;
    }
    return '';
  }

  private getModalFocusables(): HTMLElement[] {
    if (!this.modalRoot) return [];
    const selector =
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
    return Array.from(
      this.modalRoot.querySelectorAll<HTMLElement>(selector),
    ).filter((el) => el.offsetParent !== null);
  }

  private focusModal(): void {
    if (!this.modalRoot) return;
    const card = this.modalRoot.querySelector<HTMLElement>('.modal-card');
    if (!card) return;
    const firstFocusable = this.getModalFocusables()[0];
    (firstFocusable ?? card).focus({ preventScroll: true });
  }

  private restorePreviousFocus(): void {
    const prev = this.previousFocus;
    this.previousFocus = null;
    if (prev && prev.isConnected) {
      prev.focus({ preventScroll: true });
      return;
    }
    if (this.sidePanel && this.sidePanel.offsetParent !== null) {
      const fallback = this.sidePanel.querySelector<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (fallback) {
        fallback.focus({ preventScroll: true });
        return;
      }
    }
    document.body.focus();
  }

  private createEnemyIntroBanner(): HTMLElement {
    const existing = document.getElementById('enemy-intro-banner');
    if (existing) return existing;
    const banner = document.createElement('div');
    banner.id = 'enemy-intro-banner';
    banner.className = 'enemy-intro-banner';
    banner.setAttribute('aria-live', 'polite');
    banner.hidden = true;
    document.body.appendChild(banner);
    return banner;
  }

  private clearEnemyIntroQueue(): void {
    if (this.enemyIntroLeaveTimer !== null) {
      clearTimeout(this.enemyIntroLeaveTimer);
      this.enemyIntroLeaveTimer = null;
    }
    if (this.enemyIntroNextTimer !== null) {
      clearTimeout(this.enemyIntroNextTimer);
      this.enemyIntroNextTimer = null;
    }
    this.enemyIntroQueue = [];
    this.enemyIntroActiveId = null;
    if (this.enemyIntroBanner) {
      this.enemyIntroBanner.hidden = true;
      this.enemyIntroBanner.innerHTML = '';
      this.enemyIntroBanner.classList.remove('is-leaving');
    }
  }

  private showNextEnemyIntro(): void {
    if (this.enemyIntroLeaveTimer !== null) {
      clearTimeout(this.enemyIntroLeaveTimer);
      this.enemyIntroLeaveTimer = null;
    }
    if (this.enemyIntroNextTimer !== null) {
      clearTimeout(this.enemyIntroNextTimer);
      this.enemyIntroNextTimer = null;
    }

    const nextId = this.enemyIntroQueue.shift();
    if (!nextId) {
      this.enemyIntroActiveId = null;
      if (this.enemyIntroBanner) {
        this.enemyIntroBanner.hidden = true;
        this.enemyIntroBanner.innerHTML = '';
        this.enemyIntroBanner.classList.remove('is-leaving');
      }
      return;
    }

    const spec = ENEMY_SPECIES[nextId];
    if (!spec || !this.enemyIntroBanner) {
      this.showNextEnemyIntro();
      return;
    }

    this.enemyIntroActiveId = nextId;
    const spriteKey = spec.spriteId ?? spec.id;
    const summary = getEnemyThreatSummary(spec);

    this.enemyIntroBanner.classList.remove('is-leaving');
    this.enemyIntroBanner.hidden = false;
    this.enemyIntroBanner.innerHTML = `
      <div class="enemy-intro-card" style="--enemy-accent:${escapeHtml(spec.color)}">
        <div class="enemy-intro-stripe"></div>
        <div class="enemy-intro-portrait">
          ${renderPokeIcon(spriteKey, 'lg')}
        </div>
        <div class="enemy-intro-body">
          <div class="enemy-intro-kicker">
            <span class="enemy-intro-badge">NEW THREAT</span>
            <span class="enemy-intro-role">${escapeHtml(spec.roleLabel)}</span>
          </div>
          <div class="enemy-intro-title-row">
            <span class="enemy-intro-name">${escapeHtml(spec.name)}</span>
            <span class="type-badge-row">${renderSpeciesTypeBadges(spec.id, false)}</span>
          </div>
          <div class="enemy-intro-summary">${escapeHtml(summary)}</div>
        </div>
      </div>
    `;

    this.enemyIntroLeaveTimer = setTimeout(() => {
      this.enemyIntroBanner?.classList.add('is-leaving');
    }, 3200);

    this.enemyIntroNextTimer = setTimeout(() => {
      this.enemyIntroActiveId = null;
      this.showNextEnemyIntro();
    }, 3500);
  }
}
