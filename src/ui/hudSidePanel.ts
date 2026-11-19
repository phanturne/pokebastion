import {
  HELD_ITEMS,
  POKEMON_SPECIES,
  STRUCTURE_SPECS,
  WAVE_DEFINITIONS,
} from '../data/pokemon';
import {
  HEAL_COST,
  MAX_ACTIVE_UNITS,
  MAX_HELD_ITEMS,
  MAX_RESERVE_UNITS,
  REVIVE_COST,
  getBranchSpec,
  getEffectiveAtk,
  getEffectiveAttackIntervalMs,
  getEffectiveDef,
  getEffectiveMaxHp,
  getEffectiveMoveRange,
  getEffectiveRange,
  getRepairCost,
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

  for (let w = 1; w <= snap.maxWaves; w++) {
    const waveDef = WAVE_DEFINITIONS[w - 1];
    const isBoss = w === snap.maxWaves;
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
      return `
        <button
          type="button"
          class="bag-item-chip"
          data-action="equip-item"
          data-unit="${selectedUnit?.uid ?? ''}"
          data-id="${item.id}"
          ${canEquip ? '' : 'disabled'}
          title="${escapeHtml(`${item.name} (${count} in bag): ${item.desc}${canEquip ? ` — Click to equip on ${selectedName}` : ''}`)}"
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

  let text: string;
  let barClass = 'active-mode-bar';
  if (snap.selectedTool === 'sell_struct') {
    text = 'Selling Structure — Click structure to refund 70%';
    barClass = 'active-mode-bar sell';
  } else {
    const spec = STRUCTURE_SPECS[snap.selectedTool];
    text = `Placing ${escapeHtml(spec.name)} — Click grass tile`;
  }

  return `
    <div class="${barClass}">
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

function renderBuildPalette(snap: GameSnapshot): string {
  const structButtons = Object.values(STRUCTURE_SPECS)
    .map((spec) => {
      const active = snap.selectedTool === spec.kind ? 'active' : '';
      const unaffordable = snap.gold < spec.cost ? 'unaffordable' : '';
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
            <span class="tool-cost">₽${spec.cost}</span>
          </span>
        </button>
      `;
    })
    .join('');

  const sellActive = snap.selectedTool === 'sell_struct' ? 'active-danger' : '';

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
        <button
          type="button"
          class="tool-btn ${sellActive}"
          data-action="select-tool"
          data-id="sell_struct"
          data-tool-tip="sell_struct"
          aria-pressed="${snap.selectedTool === 'sell_struct'}"
        >
          <span class="tool-icon">${TOOL_ICONS.sell_struct}</span>
          <span class="tool-meta">
            <span class="tool-name">${TOOL_SHORT_NAME.sell_struct}</span>
            <span class="tool-cost refund">+70% ₽</span>
          </span>
        </button>
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
  const refund = Math.floor(spec.cost * 0.7);

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

  const atk = getEffectiveAtk(
    unit.speciesId,
    snap.upgrades,
    false,
    unit.branchId,
    unit.heldItems,
  );
  const def = getEffectiveDef(
    unit.speciesId,
    unit.branchId,
    unit.heldItems,
    snap.upgrades,
  );
  const range = getEffectiveRange(unit.speciesId, unit.branchId, snap.upgrades);
  const mov = getEffectiveMoveRange(
    species.moveRange,
    snap.upgrades,
    branch,
    unit.speciesId,
  );

  const tipLines = [
    `${species.name}${branch ? ` (${branch.name})` : ''} · ${species.pokeClass}`,
    `HP ${Math.max(0, Math.ceil(unit.hp))}/${unit.maxHp} | ATK ${atk} | DEF ${def} | RNG ${range} | MOV ${mov}`,
    `Ult: ${species.ultName} (${Math.floor(unit.ult)}/${unit.ultMax})`,
    'Click to select · Double-click for Details',
  ].join('\n');

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

  let actionPill = '';
  if (canCastUlt) {
    actionPill = `<button type="button" class="bp-action-pill ult" data-action="cast-ult" data-id="${unit.uid}">${isAiming ? 'AIM' : 'ULT'}</button>`;
  } else if (snap.phase === 'PREP' && unit.fainted) {
    const canRevive = snap.gold >= REVIVE_COST;
    actionPill = `<button type="button" class="bp-action-pill revive" data-action="revive-unit" data-id="${unit.uid}" ${canRevive ? '' : 'disabled'}>₽${REVIVE_COST}</button>`;
  } else if (snap.phase === 'PREP' && unit.hp < unit.maxHp) {
    const canHeal = snap.gold >= HEAL_COST;
    actionPill = `<button type="button" class="bp-action-pill heal" data-action="heal-unit" data-id="${unit.uid}" ${canHeal ? '' : 'disabled'}>+HP</button>`;
  }

  return `
    <div class="bp-slot ${isSelected ? 'selected' : ''} ${unit.fainted ? 'fainted' : ''} ${ultReady ? 'ult-ready' : ''}">
      <div class="bp-items-row">${heldRow}</div>
      <div class="bp-portrait-wrap">
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
      const hp = getEffectiveMaxHp(sp.id, snap.upgrades);
      const atk = getEffectiveAtk(sp.id, snap.upgrades);
      const mov = getEffectiveMoveRange(sp.moveRange, snap.upgrades);
      tooltip = [
        `${sp.name} (${sp.pokeClass})`,
        `HP ${hp} | ATK ${atk} | Range ${sp.range} | MOV ${mov}`,
        `Passive: ${sp.passiveDesc}`,
        `Ult — ${sp.ultName}: ${sp.ultDesc}`,
        canDeploy
          ? `Click to deploy (${snap.activeUnits.length}/${MAX_ACTIVE_UNITS})`
          : canSwap && selectedActiveName
            ? `Click to swap with ${selectedActiveName}`
            : 'Select an active Pokémon during PREP to swap',
      ].join('\n');
    }

    if (canDeploy) {
      reserveSlots.push(`
        <div class="bp-slot reserve">
          <button type="button" class="bp-portrait-btn reserve" data-action="deploy-reserve" data-id="${id}" title="${escapeHtml(tooltip)}">
            ${renderPokeIcon(id)}
          </button>
          <span class="bp-name">${escapeHtml(name)}</span>
        </div>
      `);
    } else {
      reserveSlots.push(`
        <div class="bp-slot reserve">
          <button type="button" class="bp-portrait-btn reserve" data-action="swap-reserve" data-id="${id}" ${canSwap ? '' : 'disabled'} title="${escapeHtml(tooltip)}">
            ${renderPokeIcon(id)}
          </button>
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
  const refund = Math.floor(spec.cost * 0.7);
  const pathTag = spec.blocksGround ? 'Blocks Ground' : 'Passable';

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
      <span class="tag">${pathTag}</span>
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
  const atk = getEffectiveAtk(
    unit.speciesId,
    snap.upgrades,
    false,
    unit.branchId,
    unit.heldItems,
  );
  const def = getEffectiveDef(
    unit.speciesId,
    unit.branchId,
    unit.heldItems,
    snap.upgrades,
  );
  const range = getEffectiveRange(unit.speciesId, unit.branchId, snap.upgrades);
  const mov = getEffectiveMoveRange(
    species.moveRange,
    snap.upgrades,
    branch,
    unit.speciesId,
  );
  const intervalMs = getEffectiveAttackIntervalMs(
    unit.speciesId,
    snap.artifacts,
    unit.branchId,
    unit.heldItems,
    snap.upgrades,
  );
  const atkSpd = (1000 / Math.max(1, intervalMs)).toFixed(2);

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

  const canHeal =
    snap.phase === 'PREP' &&
    !unit.fainted &&
    unit.hp < unit.maxHp &&
    snap.gold >= HEAL_COST;
  const canRevive =
    snap.phase === 'PREP' && unit.fainted && snap.gold >= REVIVE_COST;

  let prepBtn = '';
  if (snap.phase === 'PREP') {
    if (unit.fainted) {
      prepBtn = `<button type="button" class="btn btn-primary btn-xs" data-action="revive-unit" data-id="${unit.uid}" ${canRevive ? '' : 'disabled'}>Revive ₽${REVIVE_COST}</button>`;
    } else if (unit.hp < unit.maxHp) {
      prepBtn = `<button type="button" class="btn btn-accent btn-xs" data-action="heal-unit" data-id="${unit.uid}" ${canHeal ? '' : 'disabled'}>Heal ₽${HEAL_COST}</button>`;
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
                    snap.phase === 'PREP'
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
    <div class="popover-stats-grid">
      <div class="unit-stat"><span class="unit-stat-lbl">HP</span><span class="unit-stat-val">${Math.max(0, Math.ceil(unit.hp))}/${unit.maxHp}</span></div>
      <div class="unit-stat"><span class="unit-stat-lbl">ATK</span><span class="unit-stat-val">${atk}</span></div>
      <div class="unit-stat"><span class="unit-stat-lbl">DEF</span><span class="unit-stat-val">${def}</span></div>
      <div class="unit-stat"><span class="unit-stat-lbl">RNG</span><span class="unit-stat-val">${range}</span></div>
      <div class="unit-stat"><span class="unit-stat-lbl">SPD</span><span class="unit-stat-val">${atkSpd}</span></div>
      <div class="unit-stat"><span class="unit-stat-lbl">MOV</span><span class="unit-stat-val">${mov}</span></div>
    </div>
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
      <button type="button" class="btn btn-xs" data-action="expand-unit" data-id="${unit.uid}">Details</button>
    </div>
  `;
}
