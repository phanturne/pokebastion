import { HELD_ITEMS, POKEMON_SPECIES, STRUCTURE_SPECS } from '../data/pokemon';
import {
  HEAL_COST,
  MAX_ACTIVE_UNITS,
  MAX_HELD_ITEMS,
  REVIVE_COST,
  getBranchSpec,
  getEffectiveAtk,
  getEffectiveAttackIntervalMs,
  getEffectiveDef,
  getEffectiveMaxHp,
  getEffectiveMoveRange,
  getEffectiveRange,
  getRepairCost,
} from '../engine/rules';
import { ActiveUnit, GameSnapshot, GridStructure } from '../types';
import {
  HELD_ITEM_ICONS,
  RELIC_ICONS,
  REWARD_BY_ID,
  TOOL_ICONS,
  TOOL_SHORT_NAME,
  ToolId,
  escapeHtml,
  pct,
  renderPokeIcon,
} from './hudShared';

export interface SidePanelState {
  sideTab: 'team' | 'shop';
  hoveredTool: ToolId | null;
  hoveredRelicId: string | null;
}

export function renderTopBarHtml(snap: GameSnapshot): string {
  const corePct = pct(snap.coreHp, snap.coreMaxHp).toFixed(1);

  return `
    <div class="top-group">
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
      <span class="stat-pill" title="Action Points for combat movement (1 AP anywhere on the map; +3 per wave)">
        <span class="stat-label">AP</span>
        <span class="stat-val ap">${snap.ap} / ${snap.maxAp}</span>
      </span>
      <button type="button" class="btn" data-action="toggle-speed" aria-pressed="${snap.speedMult > 1}" title="Toggle simulation speed (1× / 2×)">${snap.speedMult}×</button>
      <button type="button" class="btn" data-action="toggle-mute" aria-pressed="${snap.muted}" title="Toggle audio (BGM & SFX)">${snap.muted ? 'Muted' : 'Audio'}</button>
      <button type="button" class="btn" data-action="toggle-credits">Credits</button>
      <button type="button" class="btn" data-action="back-home" title="Return to Home Screen">Home</button>
    </div>
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

  if (snap.phase === 'PREP') {
    parts.push(`
      <button type="button" class="btn btn-primary btn-wave" data-action="start-wave">
        Start Wave ${snap.wave}
      </button>
    `);
  }

  parts.push(`
    <div class="side-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected="${state.sideTab === 'team'}"
        class="side-tab-btn ${state.sideTab === 'team' ? 'active' : ''}"
        data-action="switch-tab"
        data-id="team"
      >
        Team (${snap.activeUnits.length}/${MAX_ACTIVE_UNITS})
      </button>
      <button
        type="button"
        role="tab"
        aria-selected="${state.sideTab === 'shop'}"
        class="side-tab-btn ${state.sideTab === 'shop' ? 'active' : ''}"
        data-action="switch-tab"
        data-id="shop"
      >
        Shop
      </button>
    </div>
  `);

  if (selectedStruct) {
    parts.push(renderSelectedStructure(snap, selectedStruct));
  }

  if (state.sideTab === 'shop') {
    if (snap.phase === 'PREP') {
      parts.push(renderBuildPalette(snap));
      parts.push(renderHeldItemShop(snap));
      parts.push(
        `<div class="shop-tooltip" id="shop-tooltip">${renderShopTooltipContent(snap, state.hoveredTool)}</div>`,
      );
    } else {
      parts.push(
        '<section class="card"><div class="card-hint">Structures and Held Items can be purchased during the Prep phase.</div></section>',
      );
    }
  } else {
    parts.push(renderRelics(snap, state.hoveredRelicId));
    parts.push(renderTeamAndReserve(snap));
  }

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

function renderHeldItemShop(snap: GameSnapshot): string {
  const items = Object.values(HELD_ITEMS);
  const invCount = snap.heldItemInventory.length;
  const rows = items
    .map((item) => {
      const disabled = snap.gold < item.cost ? 'disabled' : '';
      const owned = snap.heldItemInventory.filter(
        (id) => id === item.id,
      ).length;
      return `
        <div class="shop-item-row">
          <div class="shop-item-info">
            <strong>${escapeHtml(item.name)}${owned > 0 ? ` <span class="tag">${owned} in bag</span>` : ''}</strong>
            <span class="shop-item-desc">${escapeHtml(item.desc)}</span>
          </div>
          <button
            type="button"
            class="btn btn-accent btn-xs"
            data-action="buy-item"
            data-id="${item.id}"
            ${disabled}
          >
            ₽${item.cost}
          </button>
        </div>
      `;
    })
    .join('');

  return `
    <section class="card">
      <div class="card-header">
        <span class="card-title">Held Items Shop</span>
        <span class="card-hint">${invCount} in bag</span>
      </div>
      <div class="shop-items-list">${rows}</div>
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

function renderTeamUnitCard(
  snap: GameSnapshot,
  unit: ActiveUnit,
  isActiveInSidebar: boolean,
): string {
  const species = POKEMON_SPECIES[unit.speciesId];
  if (!species) return '';

  const isSelected = snap.selectedUnitUid === unit.uid;
  const hpPct = pct(unit.hp, unit.maxHp).toFixed(1);
  const ultPctNum = pct(unit.ult, unit.ultMax);
  const ultPct = ultPctNum.toFixed(1);
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

  return `
    <div class="team-unit-card ${isSelected ? 'selected' : ''}">
      <div class="unit-title-row">
        <button type="button" class="unit-chip ${isSelected ? 'selected' : ''}" data-action="select-unit" data-id="${unit.uid}" aria-pressed="${isSelected}" style="border:none;background:transparent;padding:0">
          ${renderPokeIcon(unit.speciesId)}
          <strong>${escapeHtml(species.name)}</strong>
        </button>
        <div class="unit-name-wrap">
          ${isSelected ? '<span class="tag selected-tag">Selected</span>' : ''}
          ${branch ? `<span class="tag branch-tag">${escapeHtml(branch.name)}</span>` : ''}
          <button type="button" class="btn btn-xs" data-action="expand-unit" data-id="${unit.uid}">Details</button>
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
          <span class="unit-stat-lbl">RANGE</span>
          <span class="unit-stat-val">${range}</span>
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

      <div class="btn-row" style="align-items:center;flex-wrap:wrap">
        ${
          snap.phase === 'COMBAT'
            ? `<button type="button" class="btn btn-ult btn-xs" data-action="cast-ult" data-id="${unit.uid}" ${canCastUlt ? '' : 'disabled'}>${ultLabel}</button>`
            : ''
        }
        <label class="toggle-label">
          <input type="checkbox" data-action="toggle-auto-ult" data-id="${unit.uid}" ${unit.autoUlt ? 'checked' : ''} />
          Auto
        </label>
        ${prepBtn}
      </div>

      <div class="held-slots-row">
        ${Array.from({ length: MAX_HELD_ITEMS })
          .map((_, idx) => {
            const itemId = unit.heldItems[idx];
            const item = itemId ? HELD_ITEMS[itemId] : null;
            if (!item) {
              return '<div class="held-slot-icon" title="Empty Held Item Slot"></div>';
            }
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
        ${
          snap.phase === 'PREP' &&
          isActiveInSidebar &&
          unit.heldItems.length < MAX_HELD_ITEMS &&
          snap.heldItemInventory.length > 0
            ? Array.from(new Set(snap.heldItemInventory))
                .map((itemId) => {
                  const item = HELD_ITEMS[itemId];
                  if (!item) return '';
                  return `
                    <button
                      type="button"
                      class="held-equip-icon-btn"
                      data-action="equip-item"
                      data-unit="${unit.uid}"
                      data-id="${itemId}"
                      title="${escapeHtml(`Equip ${item.name}: ${item.desc}`)}"
                    >
                      +${HELD_ITEM_ICONS[item.id] ?? escapeHtml(item.name)}
                    </button>
                  `;
                })
                .join('')
            : ''
        }
      </div>
    </div>
  `;
}

function renderTeamAndReserve(snap: GameSnapshot): string {
  const activeInSidebarUid =
    snap.selectedUnitUid ?? snap.activeUnits[0]?.uid ?? null;
  const activeCards = snap.activeUnits
    .map((u) => renderTeamUnitCard(snap, u, u.uid === activeInSidebarUid))
    .join('');

  const selectedActive =
    snap.activeUnits.find((u) => u.uid === snap.selectedUnitUid) ?? null;
  const selectedActiveName = selectedActive
    ? (POKEMON_SPECIES[selectedActive.speciesId]?.name ??
      selectedActive.speciesId)
    : null;
  const canSwap = snap.phase === 'PREP' && Boolean(selectedActive);
  const canDeploy =
    snap.phase === 'PREP' && snap.activeUnits.length < MAX_ACTIVE_UNITS;

  const reserveChips = snap.reserveIds.length
    ? snap.reserveIds
        .map((id) => {
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
                ? 'Click Deploy to add to battlefield (up to 6)'
                : canSwap && selectedActiveName
                  ? `Click to swap into ${selectedActiveName}'s slot`
                  : 'Select an active Pokémon during PREP to swap',
            ].join('\n');
          }
          if (canDeploy) {
            return `
              <button
                type="button"
                class="unit-chip reserve"
                data-action="deploy-reserve"
                data-id="${id}"
                title="${escapeHtml(tooltip)}"
              >
                ${renderPokeIcon(id)}
                <span>+ Deploy ${escapeHtml(name)}</span>
              </button>
            `;
          }
          return `
            <button
              type="button"
              class="unit-chip reserve"
              data-action="swap-reserve"
              data-id="${id}"
              ${canSwap ? '' : 'disabled'}
              title="${escapeHtml(tooltip)}"
            >
              ${renderPokeIcon(id)}
              <span>${escapeHtml(name)}</span>
            </button>
          `;
        })
        .join('')
    : '<span class="tool-desc">No reserve Pokémon.</span>';

  const reserveHint =
    snap.phase === 'PREP'
      ? canDeploy
        ? `Click to deploy (${snap.activeUnits.length}/${MAX_ACTIVE_UNITS})`
        : selectedActiveName
          ? `Swap into ${escapeHtml(selectedActiveName)}'s slot`
          : 'Select active to swap'
      : 'PREP only';

  return `
    <section class="card">
      <div class="team-unit-list">${activeCards}</div>
      <div class="section-header" style="margin-top:4px">
        <span>Reserve</span>
        <span>${reserveHint}</span>
      </div>
      <div class="chips-grid">${reserveChips}</div>
    </section>
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

function renderRelics(
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
    <section class="card" style="padding:7px 10px">
      <div class="section-header" style="margin-bottom:${badges.length ? '5px' : '0'}">
        <span>Artifacts & Upgrades</span>
        <span>${badges.length}</span>
      </div>
      ${
        badges.length
          ? `<div class="relic-icons-row">${badges.join('')}</div>
             <div class="relic-tooltip" id="relic-tooltip">${renderRelicTooltipContent(snap, hoveredRelicId)}</div>`
          : '<span class="tool-desc">None acquired yet.</span>'
      }
    </section>
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
