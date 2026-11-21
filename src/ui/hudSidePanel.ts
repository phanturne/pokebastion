import { HELD_ITEMS, POKEMON_SPECIES, STRUCTURE_SPECS } from '../data/pokemon';
import { getWavesForRun } from '../data/waves';
import {
  computeUnitAtk,
  computeUnitAttackIntervalMs,
  computeUnitDef,
  computeUnitRange,
} from '../engine/combat';
import {
  MAX_ACTIVE_UNITS,
  MAX_HELD_ITEMS,
  MAX_RESERVE_UNITS,
  getBranchSpec,
  getEffectiveAtk,
  getEffectiveDef,
  getEffectiveMaxHp,
  getEffectiveRange,
  getEffectiveStructureMaxHp,
  getHealCost,
  getPokemonReleaseRefund,
  getRepairCost,
  getReviveCost,
  getSellRefund,
  getStructureBuildCost,
  isShopAfterWave,
} from '../engine/rules';
import { ActiveUnit, GameSnapshot, GridStructure } from '../types';
import {
  HELD_ITEM_ICONS,
  RELIC_ICONS,
  REWARD_BY_ID,
  SVG_PAUSE,
  SVG_PLAY,
  SVG_SHAKE_OFF,
  SVG_SHAKE_ON,
  SVG_SOUND_OFF,
  SVG_SOUND_ON,
  TOOL_ICONS,
  TOOL_SHORT_NAME,
  ToolId,
  escapeHtml,
  pct,
  renderPokeIcon,
  renderSpeciesTypeBadges,
  renderTargetPriorityControl,
} from './hudShared';

export type CombatStatTab = 'dealt' | 'taken' | 'healed';

export interface SidePanelState {
  combatStatTab: CombatStatTab;
  hoveredTool: ToolId | null;
  hoveredRelicId: string | null;
}

const SVG_SWORD =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.5 1.5l-4.2 1.1-5.6 5.6-1.4-.7-.8.8 2 2-2 2 .8.8 2-2 2 2 .8-.8-.7-1.4 5.6-5.6 1.1-4.2z"/></svg>';
const SVG_CROWN =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 12.5h12v1.5H2v-1.5zm0-7l3 2.5 3-4.5 3 4.5 3-2.5-1.2 6H3.2L2 5.5z"/></svg>';
const SVG_SHOP =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 3h12l1 3.5a2 2 0 0 1-2 2 2 2 0 0 1-1.7-1 2 2 0 0 1-3.3 0 2 2 0 0 1-3.3 0A2 2 0 0 1 3 8.5a2 2 0 0 1-2-2L2 3zm1 6.5h10V14H3V9.5z"/></svg>';
const SVG_SHIELD =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5L2.5 3.8v4.1c0 3.3 2.3 5.8 5.5 6.6 3.2-.8 5.5-3.3 5.5-6.6V3.8L8 1.5z"/></svg>';
const SVG_HEAL =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5V2z"/></svg>';

export function formatTimerMs(ms: number | undefined): string {
  const totalSec = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formatStatNum(val: number): string {
  const n = Math.max(0, Math.round(val));
  if (n >= 100000) return `${Math.round(n / 1000)}K`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function renderTopLeftRelics(
  snap: GameSnapshot,
  hoveredRelicId: string | null,
): string {
  const badges: string[] = [];
  for (const id of snap.upgrades) {
    const meta = REWARD_BY_ID[id];
    const title = meta ? meta.title : id;
    const icon =
      RELIC_ICONS[id] ?? `<span>${escapeHtml(title[0] ?? '?')}</span>`;
    const active = hoveredRelicId === id ? ' is-active' : '';
    badges.push(
      `<span class="relic-icon-tile upgrade${active}" tabindex="0" data-relic-tip="${escapeHtml(id)}" aria-label="${escapeHtml(title)}">${icon}</span>`,
    );
  }
  for (const id of snap.artifacts) {
    const meta = REWARD_BY_ID[id];
    const title = meta ? meta.title : id;
    const icon =
      RELIC_ICONS[id] ?? `<span>${escapeHtml(title[0] ?? '?')}</span>`;
    const active = hoveredRelicId === id ? ' is-active' : '';
    badges.push(
      `<span class="relic-icon-tile artifact${active}" tabindex="0" data-relic-tip="${escapeHtml(id)}" aria-label="${escapeHtml(title)}">${icon}</span>`,
    );
  }

  return `
    <div class="top-left-relics">
      <div class="relic-cluster">
        ${
          badges.length
            ? `<div class="relic-icons-row">${badges.join('')}</div>`
            : '<span class="relic-empty-pill" title="Acquired Artifacts & Upgrades appear here">Relics 0</span>'
        }
      </div>
      <div class="relic-tooltip top-relic-tooltip" id="relic-tooltip">${renderRelicTooltipContent(snap, hoveredRelicId)}</div>
    </div>
  `;
}

function renderWaveTimeline(snap: GameSnapshot): string {
  const allItems: Array<{
    html: string;
    isCurrent: boolean;
  }> = [];

  const runWaves = getWavesForRun(snap.selectedMapId, snap.selectedDifficulty);
  for (let w = 1; w <= snap.maxWaves; w++) {
    const waveDef = runWaves[w - 1];
    const isBoss = w === snap.maxWaves || w % 10 === 0;
    const isDone = w < snap.wave || (w === snap.wave && snap.phase === 'SHOP');
    const isCurrent = w === snap.wave && snap.phase !== 'SHOP';
    const cls = isCurrent ? 'current' : isDone ? 'done' : 'upcoming';
    const title = waveDef ? waveDef.title : `Wave ${w}`;
    allItems.push({
      isCurrent,
      html: `<span class="tl-node ${cls} ${isBoss ? 'boss' : ''}" title="${escapeHtml(title)}">${isBoss ? SVG_CROWN : SVG_SWORD}<span class="tl-num">${w}</span></span>`,
    });
    if (isShopAfterWave(w, snap.maxWaves)) {
      const shopDone = w < snap.wave;
      const shopCurrent = w === snap.wave && snap.phase === 'SHOP';
      const shopCls = shopCurrent ? 'current' : shopDone ? 'done' : 'upcoming';
      allItems.push({
        isCurrent: shopCurrent,
        html: `<span class="tl-node shop ${shopCls}" title="Merchant Shop (after Wave ${w})">${SVG_SHOP}</span>`,
      });
    }
  }

  const curIdx = Math.max(
    0,
    allItems.findIndex((item) => item.isCurrent),
  );
  const maxVisible = 7;
  let start = Math.max(0, curIdx - 2);
  const end = Math.min(allItems.length, start + maxVisible);
  start = Math.max(0, end - maxVisible);

  const visible = allItems.slice(start, end).map((i) => i.html);
  const prefix = start > 0 ? '<span class="tl-sep">…</span>' : '';
  const suffix = end < allItems.length ? '<span class="tl-sep">…</span>' : '';

  return `<div class="wave-timeline" aria-label="Wave and event schedule">${prefix}${visible.join('<span class="tl-sep">·</span>')}${suffix}</div>`;
}

export function renderTopBarHtml(
  snap: GameSnapshot,
  hoveredRelicId: string | null = null,
): string {
  const corePct = pct(snap.coreHp, snap.coreMaxHp).toFixed(1);

  return `
    ${renderTopLeftRelics(snap, hoveredRelicId)}
    <div class="top-center-hud">
      <div class="top-center-main">
        <div class="top-cap-left">
          <span class="hud-gold" title="Gold">₽${snap.gold}</span>
          <div class="hud-core" title="Bastion Core HP">
            <span class="stat-label">Core</span>
            <div class="core-bar-wrap">
              <div class="bar-track"><div class="bar-fill bar-core" style="width:${corePct}%"></div></div>
            </div>
            <span class="stat-val">${Math.max(0, Math.ceil(snap.coreHp))}</span>
          </div>
        </div>
        ${renderWaveTimeline(snap)}
        <div class="top-cap-right">
          <span class="hud-ap" title="Action Points for combat movement (1 AP anywhere; +3 per wave)">AP <strong>${snap.ap}/${snap.maxAp}</strong></span>
        </div>
      </div>
      <div class="top-center-sub">
        <span>Wave ${snap.wave} / ${snap.maxWaves}</span>
        <span class="phase-badge phase-${snap.phase}">${snap.phase}</span>
        ${snap.phase === 'COMBAT' ? '<span class="hud-timer" id="hud-timer"></span>' : ''}
      </div>
    </div>
    <div class="top-group top-controls">
      <button type="button" class="btn btn-icon" data-action="toggle-pause" aria-pressed="${snap.paused}" aria-label="${snap.paused ? 'Resume combat' : 'Pause combat'}" ${snap.phase !== 'COMBAT' ? 'disabled' : ''} title="${snap.paused ? 'Resume combat' : 'Pause combat'}">${snap.paused ? SVG_PLAY : SVG_PAUSE}</button>
      <button type="button" class="btn btn-speed" data-action="toggle-speed" aria-pressed="${snap.speedMult > 1}" title="Toggle simulation speed (1× / 2×)">${snap.speedMult}×</button>
      <button type="button" class="btn btn-icon" data-action="toggle-mute" aria-pressed="${snap.muted}" aria-label="${snap.muted ? 'Unmute audio' : 'Mute audio'}" title="${snap.muted ? 'Unmute audio (BGM & SFX)' : 'Mute audio (BGM & SFX)'}">${snap.muted ? SVG_SOUND_OFF : SVG_SOUND_ON}</button>
      <button type="button" class="btn btn-icon" data-action="toggle-shake" aria-pressed="${!snap.screenShakeEnabled}" aria-label="${snap.screenShakeEnabled ? 'Disable screen shake' : 'Enable screen shake'}" title="${snap.screenShakeEnabled ? 'Screen shake: On' : 'Screen shake: Off'}">${snap.screenShakeEnabled ? SVG_SHAKE_ON : SVG_SHAKE_OFF}</button>
      <button type="button" class="btn" data-action="open-type-chart" title="Type Effectiveness Chart">Types</button>
      <button type="button" class="btn" data-action="toggle-credits">Credits</button>
      <button type="button" class="btn" data-action="back-home" title="Return to Home Screen">Home</button>
    </div>
  `;
}

function renderCombatStatsPanel(
  snap: GameSnapshot,
  activeTab: CombatStatTab,
): string {
  const getVal = (u: ActiveUnit): number => {
    if (activeTab === 'taken') return u.damageTaken ?? 0;
    if (activeTab === 'healed') return u.healingDone ?? 0;
    return u.damageDealt ?? 0;
  };

  const sorted = [...snap.activeUnits].sort((a, b) => getVal(b) - getVal(a));
  const maxVal = Math.max(1, ...sorted.map(getVal));
  const label =
    activeTab === 'taken'
      ? 'DAMAGE TAKEN'
      : activeTab === 'healed'
        ? 'HEALING DONE'
        : 'DAMAGE DEALT';
  const barClass =
    activeTab === 'taken'
      ? 'stat-bar-taken'
      : activeTab === 'healed'
        ? 'stat-bar-healed'
        : 'stat-bar-dealt';

  const rows = sorted
    .map((u) => {
      const sp = POKEMON_SPECIES[u.speciesId];
      const name = sp ? sp.name : u.speciesId;
      const val = getVal(u);
      const widthPct = val > 0 ? Math.max(4, (val / maxVal) * 100) : 0;
      return `
        <div class="combat-stat-row ${u.fainted ? 'fainted' : ''}">
          <div class="combat-stat-avatar">${renderPokeIcon(u.speciesId)}</div>
          <div class="combat-stat-body">
            <div class="combat-stat-head">
              <span class="combat-stat-name">${escapeHtml(name)}</span>
              <span class="combat-stat-num">${formatStatNum(val)}</span>
            </div>
            <div class="combat-stat-track">
              <div class="combat-stat-fill ${barClass}" style="width:${widthPct.toFixed(1)}%"></div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <section class="card combat-stats-card">
      <div class="stat-tabs" role="tablist" aria-label="Combat stat category">
        <button type="button" role="tab" aria-selected="${activeTab === 'dealt'}" class="stat-tab-btn ${activeTab === 'dealt' ? 'active' : ''}" data-action="switch-stat-tab" data-id="dealt" title="Damage Dealt">${SVG_SWORD}</button>
        <button type="button" role="tab" aria-selected="${activeTab === 'taken'}" class="stat-tab-btn ${activeTab === 'taken' ? 'active' : ''}" data-action="switch-stat-tab" data-id="taken" title="Damage Taken">${SVG_SHIELD}</button>
        <button type="button" role="tab" aria-selected="${activeTab === 'healed'}" class="stat-tab-btn ${activeTab === 'healed' ? 'active' : ''}" data-action="switch-stat-tab" data-id="healed" title="Healing Done">${SVG_HEAL}</button>
      </div>
      <div class="combat-stats-title">${label}</div>
      <div class="combat-stats-list">
        ${rows || '<div class="card-hint">No active Pokémon.</div>'}
      </div>
    </section>
  `;
}

function renderPrepBagCard(snap: GameSnapshot): string {
  if (snap.heldItemInventory.length === 0) return '';
  const selectedUnit =
    snap.activeUnits.find((u) => u.uid === snap.selectedUnitUid) ??
    snap.activeUnits[0] ??
    null;
  const selectedName = selectedUnit
    ? (POKEMON_SPECIES[selectedUnit.speciesId]?.name ?? selectedUnit.speciesId)
    : 'Pokémon';
  const canEquip =
    Boolean(selectedUnit) &&
    (selectedUnit?.heldItems.length ?? MAX_HELD_ITEMS) < MAX_HELD_ITEMS;

  const uniqueItems = Array.from(new Set(snap.heldItemInventory));
  const chips = uniqueItems
    .map((itemId) => {
      const item = HELD_ITEMS[itemId];
      if (!item) return '';
      const count = snap.heldItemInventory.filter((id) => id === itemId).length;
      const alreadyEquipped = Boolean(
        selectedUnit?.heldItems.includes(item.id),
      );
      const chipEnabled = canEquip && !alreadyEquipped;
      return `
        <button
          type="button"
          class="bag-item-chip"
          data-action="equip-item"
          data-unit="${selectedUnit?.uid ?? ''}"
          data-id="${item.id}"
          ${chipEnabled ? '' : 'disabled'}
          title="${escapeHtml(`${item.name} (${count} in bag): ${item.desc}${alreadyEquipped ? ` — Already equipped on ${selectedName}` : canEquip ? ` — Click to equip on ${selectedName}` : ''}`)}"
        >
          ${HELD_ITEM_ICONS[item.id] ?? ''}
          <span>${escapeHtml(item.name)}${count > 1 ? ` ×${count}` : ''}</span>
        </button>
      `;
    })
    .join('');

  return `
    <section class="card">
      <div class="card-header">
        <span class="card-title">Held Item Bag</span>
        <span class="card-hint">${canEquip ? `Equip to ${escapeHtml(selectedName)}` : `${snap.heldItemInventory.length} item(s)`}</span>
      </div>
      <div class="bag-items-wrap">${chips}</div>
    </section>
  `;
}

export function renderSidePanelHtml(
  snap: GameSnapshot,
  state: SidePanelState,
): string {
  const selectedStruct =
    snap.structures.find((s) => s.uid === snap.selectedStructureUid) ?? null;

  const parts: string[] = [];
  const activeModeBar = renderActiveModeBar(snap);
  if (activeModeBar) {
    parts.push(activeModeBar);
  } else {
    parts.push(
      `<div class="status-banner" role="status" aria-live="polite">${escapeHtml(snap.statusMessage || 'Ready.')}</div>`,
    );
  }

  if (snap.phase === 'COMBAT') {
    parts.push(renderCombatStatsPanel(snap, state.combatStatTab));
    if (selectedStruct) {
      parts.push(renderSelectedStructure(snap, selectedStruct));
    }
    return parts.join('');
  }

  if (snap.phase === 'PREP') {
    parts.push(`
      <button type="button" class="btn btn-primary btn-wave" data-action="start-wave">
        Start Wave ${snap.wave}
      </button>
    `);
  }

  if (selectedStruct) {
    parts.push(renderSelectedStructure(snap, selectedStruct));
  }

  parts.push(renderBuildPalette(snap));
  parts.push(
    `<div class="shop-tooltip" id="shop-tooltip">${renderShopTooltipContent(snap, state.hoveredTool)}</div>`,
  );
  const bagCard = renderPrepBagCard(snap);
  if (bagCard) parts.push(bagCard);

  return parts.join('');
}

function renderActiveModeBar(snap: GameSnapshot): string {
  if (snap.aimingUltUnitUid !== null) {
    const aimingUnit = snap.activeUnits.find(
      (u) => u.uid === snap.aimingUltUnitUid,
    );
    const sp = aimingUnit ? POKEMON_SPECIES[aimingUnit.speciesId] : null;
    const ultName = sp ? sp.ultName : 'Ultimate';
    return `
      <div class="active-mode-bar ult">
        <span class="active-mode-text">Aiming ${escapeHtml(ultName)} — Click target tile</span>
        <button type="button" class="btn btn-danger btn-xs" data-action="cancel-action">Cancel (Esc / Right-Click)</button>
      </div>
    `;
  }

  if (snap.movingStructureUid) {
    const movingStruct = snap.structures.find(
      (s) => s.uid === snap.movingStructureUid,
    );
    const specName = movingStruct
      ? STRUCTURE_SPECS[movingStruct.kind].name
      : 'Structure';
    return `
      <div class="active-mode-bar">
        <span class="active-mode-text">Moving ${escapeHtml(specName)} — Click empty tile</span>
        <button type="button" class="btn btn-danger btn-xs" data-action="cancel-action">Cancel (Esc / Right-Click)</button>
      </div>
    `;
  }

  if (snap.selectedTool === null) return '';

  const spec = STRUCTURE_SPECS[snap.selectedTool];
  const text = `Placing ${escapeHtml(spec.name)} — Click grass tile`;

  return `
    <div class="active-mode-bar">
      <span class="active-mode-text">${text}</span>
      <button type="button" class="btn btn-danger btn-xs" data-action="cancel-action">Cancel (Esc / Right-Click)</button>
    </div>
  `;
}

export function renderShopTooltipContent(
  snap: GameSnapshot,
  hoveredTool: ToolId | null,
): string {
  const tool = hoveredTool ?? snap.selectedTool;
  if (!tool) {
    return '';
  }

  const spec = STRUCTURE_SPECS[tool];
  const activeCount = snap.structures.filter(
    (s) => s.kind === tool && !s.ruined,
  ).length;
  const cost = getStructureBuildCost(tool, activeCount);
  const deficit = Math.max(0, cost - snap.gold);
  const pathTag = spec.blocksGround
    ? ''
    : spec.consumable
      ? 'One-Time Trap'
      : 'Passable';

  return `
    <div class="shop-tooltip-head">
      <span>${escapeHtml(spec.name)}</span>
      <span class="tool-cost">₽${cost}</span>
    </div>
    <div class="shop-tooltip-tags">
      <span class="tag">HP ${getEffectiveStructureMaxHp(tool, snap.artifacts)}</span>
      ${pathTag ? `<span class="tag">${pathTag}</span>` : ''}
      ${deficit > 0 ? `<span class="shop-need">Need ₽${deficit} more</span>` : ''}
    </div>
    <div class="shop-tooltip-desc">${escapeHtml(spec.desc)}</div>
  `;
}

function renderBuildPalette(snap: GameSnapshot): string {
  const activeCounts = new Map<string, number>();
  for (const s of snap.structures) {
    if (!s.ruined) {
      activeCounts.set(s.kind, (activeCounts.get(s.kind) ?? 0) + 1);
    }
  }
  const structButtons = Object.values(STRUCTURE_SPECS)
    .map((spec) => {
      const cost = getStructureBuildCost(
        spec.kind,
        activeCounts.get(spec.kind) ?? 0,
      );
      const active = snap.selectedTool === spec.kind ? 'active' : '';
      const unaffordable = snap.gold < cost ? 'unaffordable' : '';
      return `
        <button
          type="button"
          class="tool-btn ${active} ${unaffordable}"
          data-action="select-tool"
          data-id="${spec.kind}"
          data-tool-tip="${spec.kind}"
          aria-pressed="${snap.selectedTool === spec.kind}"
        >
          <span class="tool-icon">${TOOL_ICONS[spec.kind]}</span>
          <span class="tool-meta">
            <span class="tool-name">${escapeHtml(TOOL_SHORT_NAME[spec.kind])}</span>
            <span class="tool-cost">₽${cost}</span>
          </span>
        </button>
      `;
    })
    .join('');

  const damagedStructs = snap.structures.filter(
    (s) => s.ruined || s.hp < s.maxHp,
  );
  const totalRepairCost = damagedStructs.reduce(
    (sum, s) => sum + getRepairCost(s.kind, s.hp, s.maxHp),
    0,
  );

  return `
    <section class="card">
      <div class="tool-grid">
        ${structButtons}
      </div>
      ${
        damagedStructs.length > 0 && totalRepairCost > 0
          ? `
            <button
              type="button"
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

function renderSelectedStructure(
  snap: GameSnapshot,
  struct: GridStructure,
): string {
  const spec = STRUCTURE_SPECS[struct.kind];
  const hpPct = pct(struct.hp, struct.maxHp).toFixed(1);
  const repairCost = getRepairCost(struct.kind, struct.hp, struct.maxHp);
  const needsRepair =
    (struct.ruined || struct.hp < struct.maxHp) && repairCost > 0;
  const canRepair =
    snap.phase === 'PREP' && needsRepair && snap.gold >= repairCost;
  const isBarrel = struct.kind === 'barrel' && !struct.ruined;
  const showDetonate = isBarrel && snap.phase === 'COMBAT';
  const showSell = snap.phase === 'PREP';
  const refund = getSellRefund(spec.kind, snap.artifacts);

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
        (snap.phase === 'PREP' && needsRepair) || showDetonate || showSell
          ? `
            <div class="btn-row">
              ${
                snap.phase === 'PREP' && needsRepair
                  ? `<button type="button" class="btn btn-accent" data-action="repair-struct" data-id="${struct.uid}" ${canRepair ? '' : 'disabled'}>Repair (₽${repairCost})</button>`
                  : ''
              }
              ${
                showDetonate
                  ? `<button type="button" class="btn btn-danger" data-action="detonate-barrel" data-id="${struct.uid}">Detonate</button>`
                  : ''
              }
              ${
                showSell
                  ? `<button type="button" class="btn btn-danger" data-action="sell-struct-uid" data-id="${struct.uid}">Sell (+₽${refund})</button>`
                  : ''
              }
            </div>
          `
          : ''
      }
    </section>
  `;
}

function renderBottomPartySlot(snap: GameSnapshot, unit: ActiveUnit): string {
  const species = POKEMON_SPECIES[unit.speciesId];
  if (!species) return '';

  const isSelected = snap.selectedUnitUid === unit.uid;
  const hpPct = pct(unit.hp, unit.maxHp).toFixed(1);
  const ultPctNum = pct(unit.ult, unit.ultMax);
  const ultPct = ultPctNum.toFixed(1);
  const ultReady = !unit.fainted && unit.ult >= unit.ultMax;
  const isAiming = snap.aimingUltUnitUid === unit.uid;
  const canCastUlt = snap.phase === 'COMBAT' && ultReady;
  const branch = getBranchSpec(unit.speciesId, unit.branchId);

  const baseAtk = getEffectiveAtk(
    unit.speciesId,
    snap.upgrades,
    false,
    unit.branchId,
    unit.heldItems,
    snap.artifacts,
  );
  const atk = unit.effectiveAtk ?? baseAtk;
  const def =
    unit.effectiveDef ??
    getEffectiveDef(
      unit.speciesId,
      unit.branchId,
      unit.heldItems,
      snap.upgrades,
      snap.artifacts,
    );
  const range =
    unit.effectiveRange ??
    getEffectiveRange(
      unit.speciesId,
      unit.branchId,
      snap.upgrades,
      unit.heldItems,
    );

  const badges = unit.statusBadges ?? [];
  const badgeTip =
    badges.length > 0
      ? `\nActive: ${badges.map((b) => b.desc).join(' · ')}`
      : '';

  const tipLines = [
    `${species.name}${branch ? ` (${branch.name})` : ''} · ${species.pokeClass}`,
    `HP ${Math.max(0, Math.ceil(unit.hp))}/${unit.maxHp} | ATK ${atk} | DEF ${def} | RNG ${range}`,
    `Ult: ${species.ultName} (${Math.floor(unit.ult)}/${unit.ultMax})`,
    `Click to select · Double-click for Details${badgeTip}`,
  ].join('\n');

  const visibleBadges = badges.slice(0, 3);
  const hiddenBadges = badges.slice(3);
  const overflowKind = hiddenBadges.some((b) => b.kind === 'debuff')
    ? 'debuff'
    : 'buff';
  const statusColHtml =
    visibleBadges.length > 0
      ? `<div class="bp-status-col">${visibleBadges
          .map(
            (b) =>
              `<span class="bp-status-badge ${b.kind}" title="${escapeHtml(b.desc)}">${escapeHtml(b.icon)}</span>`,
          )
          .join('')}${
          hiddenBadges.length > 0
            ? `<span class="bp-status-badge ${overflowKind}" title="${escapeHtml(
                hiddenBadges.map((b) => b.desc).join(' · '),
              )}">+${hiddenBadges.length}</span>`
            : ''
        }</div>`
      : '';

  const heldRow = Array.from({ length: MAX_HELD_ITEMS })
    .map((_, idx) => {
      const itemId = unit.heldItems[idx];
      const item = itemId ? HELD_ITEMS[itemId] : null;
      if (!item) {
        return '<span class="bp-item-slot" title="Empty Held Item Slot"></span>';
      }
      const icon = HELD_ITEM_ICONS[item.id] ?? '';
      return `
        <span class="bp-item-slot filled" title="${escapeHtml(`${item.name}: ${item.desc}`)}">
          ${icon}
          ${
            snap.phase === 'PREP' || snap.phase === 'SHOP'
              ? `<button type="button" class="bp-item-remove" data-action="unequip-item" data-unit="${unit.uid}" data-id="${idx}" aria-label="Unequip ${escapeHtml(item.name)}">×</button>`
              : ''
          }
        </span>
      `;
    })
    .join('');

  const healCost = getHealCost(snap.wave);
  const reviveCost = getReviveCost(snap.wave);
  let actionPill = '';
  if (canCastUlt) {
    actionPill = `<button type="button" class="bp-action-pill ult" data-action="cast-ult" data-id="${unit.uid}">${isAiming ? 'AIM' : 'ULT'}</button>`;
  } else if (snap.phase === 'PREP' && unit.fainted) {
    const canRevive = snap.gold >= reviveCost;
    actionPill = `<button type="button" class="bp-action-pill revive" data-action="revive-unit" data-id="${unit.uid}" ${canRevive ? '' : 'disabled'}>₽${reviveCost}</button>`;
  } else if (snap.phase === 'PREP' && unit.hp < unit.maxHp) {
    const canHeal = snap.gold >= healCost;
    actionPill = `<button type="button" class="bp-action-pill heal" data-action="heal-unit" data-id="${unit.uid}" ${canHeal ? '' : 'disabled'}>+HP</button>`;
  }

  return `
    <div class="bp-slot ${isSelected ? 'selected' : ''} ${unit.fainted ? 'fainted' : ''} ${ultReady ? 'ult-ready' : ''}">
      <div class="bp-items-row">${heldRow}</div>
      <div class="bp-portrait-wrap">
        ${statusColHtml}
        <button
          type="button"
          class="bp-portrait-btn"
          data-action="select-unit"
          data-id="${unit.uid}"
          aria-pressed="${isSelected}"
          title="${escapeHtml(tipLines)}"
        >
          ${renderPokeIcon(unit.speciesId)}
        </button>
        <button
          type="button"
          class="bp-info-btn"
          data-action="expand-unit"
          data-id="${unit.uid}"
          title="Inspect ${escapeHtml(species.name)}"
          aria-label="Inspect ${escapeHtml(species.name)}"
        >i</button>
        ${actionPill}
      </div>
      <div class="bp-bars">
        <div class="bp-bar-track"><div class="bp-bar-fill hp" style="width:${hpPct}%"></div></div>
        <div class="bp-bar-track"><div class="bp-bar-fill ult" style="width:${ultPct}%"></div></div>
      </div>
      <span class="bp-name">${escapeHtml(species.name)}</span>
    </div>
  `;
}

export function renderBottomBarHtml(snap: GameSnapshot): string {
  const partySlots: string[] = [];
  for (let i = 0; i < MAX_ACTIVE_UNITS; i++) {
    const unit = snap.activeUnits[i];
    if (unit) {
      partySlots.push(renderBottomPartySlot(snap, unit));
    } else {
      partySlots.push(
        `<div class="bp-slot empty" title="Empty Party Slot (${snap.activeUnits.length}/${MAX_ACTIVE_UNITS})"><div class="bp-items-row"></div><div class="bp-portrait-empty"></div><span class="bp-name muted">—</span></div>`,
      );
    }
  }

  const selectedActive =
    snap.activeUnits.find((u) => u.uid === snap.selectedUnitUid) ?? null;
  const selectedActiveName = selectedActive
    ? (POKEMON_SPECIES[selectedActive.speciesId]?.name ??
      selectedActive.speciesId)
    : null;
  const canSwap = snap.phase === 'PREP' && Boolean(selectedActive);
  const canDeploy =
    snap.phase === 'PREP' && snap.activeUnits.length < MAX_ACTIVE_UNITS;

  const reserveSlots: string[] = [];
  for (let i = 0; i < MAX_RESERVE_UNITS; i++) {
    const id = snap.reserveIds[i];
    if (!id) {
      reserveSlots.push(
        `<div class="bp-slot reserve empty" title="Empty Reserve Slot (${snap.reserveIds.length}/${MAX_RESERVE_UNITS})"><div class="bp-portrait-empty reserve"></div><span class="bp-name muted">—</span></div>`,
      );
      continue;
    }
    const sp = POKEMON_SPECIES[id];
    const name = sp ? sp.name : id;
    let tooltip = 'Select an active Pokémon during PREP to swap';
    if (sp) {
      const hp = getEffectiveMaxHp(
        sp.id,
        snap.upgrades,
        null,
        [],
        snap.artifacts,
      );
      const atk = getEffectiveAtk(
        sp.id,
        snap.upgrades,
        false,
        null,
        [],
        snap.artifacts,
      );
      tooltip = [
        `${sp.name} (${sp.pokeClass})`,
        `HP ${hp} | ATK ${atk} | Range ${sp.range}`,
        `Passive: ${sp.passiveDesc}`,
        `Ult — ${sp.ultName}: ${sp.ultDesc}`,
        canDeploy
          ? `Click to deploy (${snap.activeUnits.length}/${MAX_ACTIVE_UNITS})`
          : canSwap && selectedActiveName
            ? `Click to swap with ${selectedActiveName}`
            : 'Select an active Pokémon during PREP to swap',
      ].join('\n');
    }

    const reserveRefund = getPokemonReleaseRefund(id);
    const releaseBtn =
      snap.phase === 'PREP'
        ? `<button type="button" class="bp-info-btn" data-action="release-reserve" data-id="${id}" aria-label="Release ${escapeHtml(name)} (+₽${reserveRefund})" title="Release ${escapeHtml(name)} (+₽${reserveRefund})">×</button>`
        : '';

    if (canDeploy) {
      reserveSlots.push(`
        <div class="bp-slot reserve">
          <div class="bp-portrait-wrap">
            <button type="button" class="bp-portrait-btn reserve" data-action="deploy-reserve" data-id="${id}" title="${escapeHtml(tooltip)}">
              ${renderPokeIcon(id)}
            </button>
            ${releaseBtn}
          </div>
          <span class="bp-name">${escapeHtml(name)}</span>
        </div>
      `);
    } else {
      reserveSlots.push(`
        <div class="bp-slot reserve">
          <div class="bp-portrait-wrap">
            <button type="button" class="bp-portrait-btn reserve" data-action="swap-reserve" data-id="${id}" ${canSwap ? '' : 'disabled'} title="${escapeHtml(tooltip)}">
              ${renderPokeIcon(id)}
            </button>
            ${releaseBtn}
          </div>
          <span class="bp-name">${escapeHtml(name)}</span>
        </div>
      `);
    }
  }

  return `
    <div class="bottom-roster-bar">
      <div class="bottom-group-label">PARTY</div>
      <div class="bottom-slots-row">${partySlots.join('')}</div>
      <div class="bottom-divider" aria-hidden="true"></div>
      <div class="bottom-slots-row">${reserveSlots.join('')}</div>
      <div class="bottom-group-label">RESERVE</div>
    </div>
  `;
}

export function renderRelicTooltipContent(
  snap: GameSnapshot,
  hoveredRelicId: string | null,
): string {
  const id = hoveredRelicId;
  if (!id || (!snap.upgrades.includes(id) && !snap.artifacts.includes(id))) {
    return '';
  }
  const meta = REWARD_BY_ID[id];
  const title = meta ? meta.title : id;
  const desc = meta ? meta.desc : '';
  const isArtifact = snap.artifacts.includes(id);
  const kindLabel = isArtifact ? 'Artifact' : 'Upgrade';
  return `
    <div class="relic-tooltip-head">
      <span>${escapeHtml(title)}</span>
      <span class="tag ${isArtifact ? 'tag-gold' : ''}">${kindLabel}</span>
    </div>
    <div class="tool-desc">${escapeHtml(desc)}</div>
  `;
}

export function renderStructurePopoverHtml(
  snap: GameSnapshot,
  struct: GridStructure,
): string {
  const spec = STRUCTURE_SPECS[struct.kind];
  if (!spec) return '';
  const repairCost = getRepairCost(struct.kind, struct.hp, struct.maxHp);
  const needsRepair =
    (struct.ruined || struct.hp < struct.maxHp) && repairCost > 0;
  const canRepair =
    snap.phase === 'PREP' && needsRepair && snap.gold >= repairCost;
  const showDetonate =
    struct.kind === 'barrel' && !struct.ruined && snap.phase === 'COMBAT';
  const showSell = snap.phase === 'PREP';
  const refund = getSellRefund(spec.kind, snap.artifacts);
  const pathTag = spec.blocksGround ? '' : 'Passable';

  return `
    <div class="popover-head">
      <div class="popover-title-wrap">
        <strong>${escapeHtml(spec.name)}</strong>
        ${struct.ruined ? '<span class="tag ruined">Ruined</span>' : `<span class="tag">(${struct.gx}, ${struct.gy})</span>`}
      </div>
      <button type="button" class="popover-close" data-action="close-popover" aria-label="Close">×</button>
    </div>
    <div class="popover-meta-row">
      <span class="tag">HP ${Math.max(0, Math.ceil(struct.hp))} / ${struct.maxHp}</span>
      ${pathTag ? `<span class="tag">${pathTag}</span>` : ''}
    </div>
    <p class="popover-desc">${escapeHtml(spec.desc)}</p>
    ${
      (snap.phase === 'PREP' && needsRepair) || showDetonate || showSell
        ? `
          <div class="btn-row">
            ${
              snap.phase === 'PREP' && needsRepair
                ? `<button type="button" class="btn btn-accent btn-xs" data-action="repair-struct" data-id="${struct.uid}" ${canRepair ? '' : 'disabled'}>Repair (₽${repairCost})</button>`
                : ''
            }
            ${
              showDetonate
                ? `<button type="button" class="btn btn-danger btn-xs" data-action="detonate-barrel" data-id="${struct.uid}">Detonate</button>`
                : ''
            }
            ${
              showSell
                ? `<button type="button" class="btn btn-danger btn-xs" data-action="sell-struct-uid" data-id="${struct.uid}">Sell (+₽${refund})</button>`
                : ''
            }
          </div>
        `
        : ''
    }
  `;
}

export function renderUnitPopoverHtml(
  snap: GameSnapshot,
  unit: ActiveUnit,
): string {
  const species = POKEMON_SPECIES[unit.speciesId];
  if (!species) return '';

  const branch = getBranchSpec(unit.speciesId, unit.branchId);
  const potential = snap.pokemonProgress[unit.speciesId]?.potential ?? 0;
  const baseAtk = computeUnitAtk(
    unit.speciesId,
    snap.upgrades,
    false,
    unit.branchId,
    unit.heldItems,
    potential,
  );
  const baseDef = computeUnitDef(
    unit.speciesId,
    unit.branchId,
    unit.heldItems,
    snap.upgrades,
    potential,
  );
  const baseRange = computeUnitRange(
    unit.speciesId,
    unit.branchId,
    snap.upgrades,
    potential,
    undefined,
    unit.heldItems,
  );
  const baseIntervalMs = computeUnitAttackIntervalMs(
    unit.speciesId,
    snap.artifacts,
    unit.branchId,
    unit.heldItems,
    snap.upgrades,
    potential,
  );
  const atk = unit.effectiveAtk ?? baseAtk;
  const def = unit.effectiveDef ?? baseDef;
  const range = unit.effectiveRange ?? baseRange;
  const intervalMs = unit.effectiveAttackIntervalMs ?? baseIntervalMs;
  const atkSpd = (1000 / Math.max(1, intervalMs)).toFixed(2);
  const badges = unit.statusBadges ?? [];

  const ultPctNum = pct(unit.ult, unit.ultMax);
  const ultReady = !unit.fainted && unit.ult >= unit.ultMax;
  const isAiming = snap.aimingUltUnitUid === unit.uid;
  const canCastUlt = snap.phase === 'COMBAT' && ultReady;
  let ultLabel = 'Cast Ult';
  if (isAiming) {
    ultLabel = 'Aiming...';
  } else if (unit.fainted) {
    ultLabel = 'Fainted';
  } else if (!ultReady) {
    ultLabel = `${Math.floor(ultPctNum)}%`;
  }

  const healCost = getHealCost(snap.wave);
  const reviveCost = getReviveCost(snap.wave);
  const canHeal =
    snap.phase === 'PREP' &&
    !unit.fainted &&
    unit.hp < unit.maxHp &&
    snap.gold >= healCost;
  const canRevive =
    snap.phase === 'PREP' && unit.fainted && snap.gold >= reviveCost;

  let prepBtn = '';
  if (snap.phase === 'PREP') {
    if (unit.fainted) {
      prepBtn = `<button type="button" class="btn btn-primary btn-xs" data-action="revive-unit" data-id="${unit.uid}" ${canRevive ? '' : 'disabled'}>Revive ₽${reviveCost}</button>`;
    } else if (unit.hp < unit.maxHp) {
      prepBtn = `<button type="button" class="btn btn-accent btn-xs" data-action="heal-unit" data-id="${unit.uid}" ${canHeal ? '' : 'disabled'}>Heal ₽${healCost}</button>`;
    }
    if (!unit.branchId) {
      prepBtn += `<button type="button" class="btn btn-accent btn-xs" data-action="expand-unit" data-id="${unit.uid}">Specialize</button>`;
    }
  }

  const heldItemsHtml =
    unit.heldItems.length > 0
      ? `
        <div class="held-slots-row">
          ${unit.heldItems
            .map((itemId, idx) => {
              const item = HELD_ITEMS[itemId];
              if (!item) return '';
              const icon = HELD_ITEM_ICONS[item.id] ?? '';
              return `
                <div class="held-slot-icon filled" title="${escapeHtml(`${item.name}: ${item.desc}`)}">
                  ${icon}
                  ${
                    snap.phase === 'PREP' || snap.phase === 'SHOP'
                      ? `<button type="button" class="held-slot-remove" data-action="unequip-item" data-unit="${unit.uid}" data-id="${idx}" aria-label="Unequip ${escapeHtml(item.name)}" title="Unequip ${escapeHtml(item.name)}">×</button>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')}
        </div>
      `
      : '';

  return `
    <div class="popover-head">
      <div class="popover-title-wrap">
        ${renderPokeIcon(unit.speciesId)}
        <strong>${escapeHtml(species.name)}</strong>
        <span class="tag">${escapeHtml(species.pokeClass)}</span>
        ${branch ? `<span class="tag branch-tag">${escapeHtml(branch.name)}</span>` : ''}
      </div>
      <button type="button" class="popover-close" data-action="close-popover" aria-label="Close">×</button>
    </div>
    <div class="type-badge-row">${renderSpeciesTypeBadges(unit.speciesId)}</div>
    ${renderTargetPriorityControl(unit)}
    <div class="popover-stats-grid">
      <div class="unit-stat"><span class="unit-stat-lbl">HP</span><span class="unit-stat-val">${Math.max(0, Math.ceil(unit.hp))}/${unit.maxHp}</span></div>
      <div class="unit-stat"><span class="unit-stat-lbl">ATK</span><span class="unit-stat-val ${atk > baseAtk ? 'stat-boosted' : ''}" title="Base ${baseAtk} → Live ${atk}">${atk}</span></div>
      <div class="unit-stat"><span class="unit-stat-lbl">DEF</span><span class="unit-stat-val ${def > baseDef ? 'stat-boosted' : ''}" title="Base ${baseDef} → Live ${def}">${def}</span></div>
      <div class="unit-stat"><span class="unit-stat-lbl">RNG</span><span class="unit-stat-val ${range > baseRange ? 'stat-boosted' : ''}">${range}</span></div>
      <div class="unit-stat"><span class="unit-stat-lbl">SPD</span><span class="unit-stat-val ${intervalMs < baseIntervalMs ? 'stat-boosted' : ''}">${atkSpd}</span></div>
    </div>
    ${
      badges.length > 0
        ? `<div class="popover-buffs-row">${badges
            .map(
              (b) =>
                `<span class="popover-buff-pill ${b.kind}" title="${escapeHtml(b.desc)}">${escapeHtml(b.icon)} ${escapeHtml(b.label)}</span>`,
            )
            .join('')}</div>`
        : ''
    }
    <div class="popover-kit">
      <div class="popover-kit-line"><strong>Passive:</strong> ${escapeHtml(species.passiveDesc)}</div>
      <div class="popover-kit-line"><strong>Basic:</strong> ${escapeHtml(species.basicDesc)}</div>
      <div class="popover-kit-line"><strong>Ult — ${escapeHtml(species.ultName)}:</strong> ${escapeHtml(species.ultDesc)}</div>
    </div>
    ${heldItemsHtml}
    <div class="btn-row">
      ${
        snap.phase === 'COMBAT'
          ? `<button type="button" class="btn btn-ult btn-xs" data-action="cast-ult" data-id="${unit.uid}" ${canCastUlt ? '' : 'disabled'}>${ultLabel}</button>`
          : ''
      }
      ${prepBtn}
      ${
        snap.phase === 'PREP'
          ? `<button type="button" class="btn btn-danger btn-xs" data-action="release-unit" data-id="${unit.uid}" ${snap.activeUnits.length > 1 ? '' : 'disabled'}>Release (+₽${getPokemonReleaseRefund(unit.speciesId, unit.branchId)})</button>`
          : ''
      }
      <button type="button" class="btn btn-xs" data-action="expand-unit" data-id="${unit.uid}">Details</button>
    </div>
  `;
}
