import { MAP_CATALOG, createGridForMap } from '../data/maps';
import { HELD_ITEMS, POKEMON_SPECIES } from '../data/pokemon';
import {
  HEAL_COST,
  MAX_ACTIVE_UNITS,
  MAX_HELD_ITEMS,
  REVIVE_COST,
  getBranchSpec,
  getDraftCost,
  getEffectiveAtk,
  getEffectiveAttackIntervalMs,
  getEffectiveDef,
  getEffectiveMoveRange,
  getEffectiveRange,
} from '../engine/rules';
import { GameSnapshot, MapDifficulty } from '../types';
import {
  HELD_ITEM_ICONS,
  SVG_SHAKE_OFF,
  SVG_SHAKE_ON,
  SVG_SOUND_OFF,
  SVG_SOUND_ON,
  escapeHtml,
  formatBranchChips,
  renderBranchTree,
  renderDraftSnowflake,
  renderPokeIcon,
} from './hudShared';

export interface ModalState {
  showCredits: boolean;
  showPokedex: boolean;
  pokedexFilter: 'all' | 'unlocked' | 'locked';
  inspectedPokedexId: string | null;
  mapDifficultyFilter: 'All' | MapDifficulty;
  inspectedDraftId: string | null;
  expandedUnitUid: string | null;
}

const mapPreviewSvgCache = new Map<string, string>();

function getMapPreviewSvg(mapId: string): string {
  const cached = mapPreviewSvgCache.get(mapId);
  if (cached !== undefined) return cached;

  const grid = createGridForMap(mapId);
  const rects: string[] = [];
  for (let gy = 0; gy < grid.length; gy++) {
    for (let gx = 0; gx < grid[gy].length; gx++) {
      const t = grid[gy][gx];
      if (t === 'grass') continue;
      const fill =
        t === 'water' ? '#38bdf8' : t === 'tree' ? '#166534' : '#f43f5e';
      rects.push(
        `<rect x="${gx}" y="${gy}" width="1" height="1" fill="${fill}" />`,
      );
    }
  }
  const svg = `<svg class="map-preview-svg" viewBox="0 0 28 18" preserveAspectRatio="xMidYMid slice"><rect width="28" height="18" fill="#2d5a27" />${rects.join('')}</svg>`;
  mapPreviewSvgCache.set(mapId, svg);
  return svg;
}

function renderCreditsModal(): string {
  return `
    <div class="menu-backdrop">
      <div class="modal-card compact" role="dialog" aria-modal="true" aria-labelledby="modal-title-credits" tabindex="-1">
        <div class="modal-header">
          <div class="modal-title" id="modal-title-credits">Asset Credits</div>
          <button type="button" class="btn" data-action="close-credits">Close</button>
        </div>
        <div class="credits-list">
          <div class="credit-item">
            <strong>Tiles, Forest Props & Pokémon Center — Ekat's Public Tiles</strong>
            <span>Ekat's Public Tiles (Route 224, Tall Grass, Citrus Outdoors, Cold Storage)</span>
          </div>
          <div class="credit-item">
            <strong>Tile Textures — MPWSP01</strong>
            <a href="https://scarloxy.itch.io/mpwsp01" target="_blank" rel="noopener noreferrer">
              scarloxy.itch.io
            </a>
          </div>
          <div class="credit-item">
            <strong>Pokémon Sprites — PMD / PMDCollab</strong>
            <a href="https://sprites.pmdcollab.org" target="_blank" rel="noopener noreferrer">
              sprites.pmdcollab.org
            </a>
          </div>
          <div class="credit-item">
            <strong>Attack VFX — PVFX Foundry</strong>
            <a href="https://nerijs.itch.io/pvfx-foundry/devlog/1750877/pvfx-foundry-10-101-new-effects-rebuilt-for-quality" target="_blank" rel="noopener noreferrer">
              PVFX Foundry (itch.io)
            </a>
          </div>
          <div class="credit-item">
            <strong>Sound Effects &amp; Music — Tuxemon &amp; Kelvin Shadewing</strong>
            <a href="https://github.com/Tuxemon/Tuxemon" target="_blank" rel="noopener noreferrer">
              github.com/Tuxemon/Tuxemon
            </a>
            <span>Includes SFX by Nick &ldquo;Kelvin Shadewing&rdquo; Kovacs (kelvinshadewing.net) &amp; Tuxemon contributors, plus JRPGCollection BGM loops</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPokedexModal(
  snap: GameSnapshot | null,
  state: ModalState,
): string {
  const unlockedSet = new Set(snap?.unlockedIds ?? []);
  const allSpecies = Object.values(POKEMON_SPECIES);
  const unlockedCount = allSpecies.filter((s) => unlockedSet.has(s.id)).length;
  const filtered = allSpecies.filter((s) => {
    if (state.pokedexFilter === 'unlocked') return unlockedSet.has(s.id);
    if (state.pokedexFilter === 'locked') return !unlockedSet.has(s.id);
    return true;
  });
  const inspectedId =
    state.inspectedPokedexId && POKEMON_SPECIES[state.inspectedPokedexId]
      ? state.inspectedPokedexId
      : (filtered[0]?.id ?? allSpecies[0]?.id);
  const inspectedSp = inspectedId ? POKEMON_SPECIES[inspectedId] : undefined;
  const inspectedUnlocked = inspectedSp
    ? unlockedSet.has(inspectedSp.id)
    : false;

  const gridHtml =
    filtered.length > 0
      ? filtered
          .map((sp) => {
            const isUnlocked = unlockedSet.has(sp.id);
            const classes = [
              'draft-roster-item',
              !isUnlocked ? 'is-locked' : '',
              sp.id === inspectedId ? 'is-inspected' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return `
              <button
                type="button"
                class="${classes}"
                data-action="inspect-pokedex"
                data-id="${sp.id}"
              >
                ${renderPokeIcon(sp.id)}
                <span class="draft-roster-name">#${sp.id.slice(-3)} ${escapeHtml(sp.name)}</span>
              </button>
            `;
          })
          .join('')
      : '<div class="card-hint" style="grid-column:1/-1;padding:12px;">No Pokémon match this filter yet.</div>';

  const detailHtml = inspectedSp
    ? `
      <div class="draft-detail-panel">
        <div class="draft-detail-header">
          <div class="draft-detail-identity">
            ${renderPokeIcon(inspectedSp.id, 'lg')}
            <div class="draft-detail-title">
              <div class="draft-detail-name">${escapeHtml(inspectedSp.name)}</div>
              <div class="draft-detail-tags">
                <span class="tag">${escapeHtml(inspectedSp.pokeClass)}</span>
                <span class="tag cost-tag">${inspectedSp.draftCost} pt${inspectedSp.draftCost === 1 ? '' : 's'}</span>
                ${!inspectedUnlocked ? '<span class="tag locked-tag">Locked</span>' : ''}
              </div>
            </div>
          </div>
        </div>
        ${renderDraftSnowflake(inspectedSp)}
        <div class="desc-box">
          <div><strong>Passive:</strong> ${escapeHtml(inspectedSp.passiveDesc)}</div>
          <div><strong>Basic:</strong> ${escapeHtml(inspectedSp.basicDesc)}</div>
          <div><strong>Ult (${escapeHtml(inspectedSp.ultName)}):</strong> ${escapeHtml(inspectedSp.ultDesc)}</div>
          <div class="draft-branches">
            <strong>Branches:</strong>
            ${inspectedSp.branches
              .map(
                (b, idx) =>
                  `<div class="branch-line">• <em>Path ${idx + 1}: ${escapeHtml(b.name)}</em> ${formatBranchChips(b)} — ${escapeHtml(b.desc)}</div>`,
              )
              .join('')}
          </div>
        </div>
      </div>
    `
    : '';

  return `
    <div class="menu-backdrop">
      <div class="modal-card draft-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-pokedex" tabindex="-1">
        <div class="modal-header">
          <div class="modal-title" id="modal-title-pokedex">Pokédex — ${unlockedCount} / ${allSpecies.length} Unlocked</div>
          <div class="btn-row" style="margin:0">
            <button type="button" class="btn ${state.pokedexFilter === 'all' ? 'btn-primary' : ''}" data-action="pokedex-filter" data-id="all" aria-pressed="${state.pokedexFilter === 'all'}">All (${allSpecies.length})</button>
            <button type="button" class="btn ${state.pokedexFilter === 'unlocked' ? 'btn-primary' : ''}" data-action="pokedex-filter" data-id="unlocked" aria-pressed="${state.pokedexFilter === 'unlocked'}">Unlocked (${unlockedCount})</button>
            <button type="button" class="btn ${state.pokedexFilter === 'locked' ? 'btn-primary' : ''}" data-action="pokedex-filter" data-id="locked" aria-pressed="${state.pokedexFilter === 'locked'}">Locked (${allSpecies.length - unlockedCount})</button>
            <button type="button" class="btn" data-action="close-pokedex">Close</button>
          </div>
        </div>
        <div class="draft-body">
          <div class="draft-roster-grid">${gridHtml}</div>
          ${detailHtml}
        </div>
      </div>
    </div>
  `;
}

function renderHomeModal(snap: GameSnapshot): string {
  const unlockedCount = snap.unlockedIds.length;
  const totalCount = Object.keys(POKEMON_SPECIES).length;
  return `
    <div class="menu-backdrop">
      <div class="modal-card compact home-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-home" tabindex="-1">
        <div class="home-title" id="modal-title-home">PokéBastion TD</div>
        <p class="home-subtitle">
          Tactical Pokémon tower defense. Build walls, reposition units in real time, and defend the Pokémon Center across 10 waves.
        </p>
        <div class="home-actions">
          <button type="button" class="btn btn-primary home-btn" data-action="home-play">Play</button>
          <button type="button" class="btn home-btn" data-action="open-pokedex">Pokédex (${unlockedCount}/${totalCount})</button>
          <button type="button" class="btn home-btn home-toggle-btn" data-action="toggle-mute" aria-pressed="${snap.muted}" title="${snap.muted ? 'Sound: Off' : 'Sound: On'}">${snap.muted ? SVG_SOUND_OFF : SVG_SOUND_ON}<span>Sound</span></button>
          <button type="button" class="btn home-btn home-toggle-btn" data-action="toggle-shake" aria-pressed="${!snap.screenShakeEnabled}" title="${snap.screenShakeEnabled ? 'Screen shake: On' : 'Screen shake: Off'}">${snap.screenShakeEnabled ? SVG_SHAKE_ON : SVG_SHAKE_OFF}<span>Shake</span></button>
          <button type="button" class="btn home-btn" data-action="toggle-credits">Credits</button>
        </div>
      </div>
    </div>
  `;
}

function renderMapSelectModal(
  snap: GameSnapshot,
  mapDifficultyFilter: 'All' | MapDifficulty,
): string {
  const difficulties: Array<'All' | MapDifficulty> = [
    'All',
    'Beginner',
    'Intermediate',
    'Advanced',
    'Expert',
  ];
  const filteredMaps = MAP_CATALOG.filter(
    (m) =>
      mapDifficultyFilter === 'All' || m.difficulty === mapDifficultyFilter,
  );
  const mapCardsHtml = filteredMaps
    .map((m) => {
      const diffClass = `diff-${m.difficulty.toLowerCase()}`;
      const isCurrent = !m.comingSoon && snap.selectedMapId === m.id;
      const previewHtml = m.comingSoon
        ? `<div class="map-coming-soon">COMING SOON</div>`
        : getMapPreviewSvg(m.id);
      return `
        <button
          type="button"
          class="map-card ${isCurrent ? 'is-selected' : ''} ${m.comingSoon ? 'is-coming-soon' : ''}"
          data-action="select-map"
          data-id="${escapeHtml(m.id)}"
          ${m.comingSoon ? 'disabled' : ''}
        >
          <div class="map-preview-wrap">
            ${previewHtml}
            <span class="tag map-diff-badge ${diffClass}">${escapeHtml(m.difficulty)}</span>
          </div>
          <div class="map-card-body">
            <div class="map-card-title">${escapeHtml(m.name)}</div>
            <div class="map-card-desc">${escapeHtml(m.desc)}</div>
          </div>
        </button>
      `;
    })
    .join('');

  const filterTabsHtml = difficulties
    .map(
      (d) =>
        `<button type="button" class="btn ${mapDifficultyFilter === d ? 'btn-primary' : ''}" data-action="map-filter" data-id="${d}" aria-pressed="${mapDifficultyFilter === d}">${d}</button>`,
    )
    .join('');

  return `
    <div class="menu-backdrop">
      <div class="modal-card draft-modal map-select-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-map-select" tabindex="-1">
        <div class="modal-header">
          <div class="modal-title" id="modal-title-map-select">Select Battlefield</div>
          <div class="btn-row" style="margin:0">
            ${filterTabsHtml}
            <button type="button" class="btn" data-action="back-home">Home</button>
          </div>
        </div>
        <div class="map-grid">${mapCardsHtml}</div>
      </div>
    </div>
  `;
}

function renderDraftModal(
  snap: GameSnapshot,
  inspectedDraftId: string | null,
): string {
  const spent = getDraftCost(snap.draftIds);
  const remaining = snap.draftBudget - spent;
  const allSpecies = Object.values(POKEMON_SPECIES);
  const defaultDraftId = snap.draftIds[0] ?? Object.keys(POKEMON_SPECIES)[0];
  const inspectedId =
    inspectedDraftId && POKEMON_SPECIES[inspectedDraftId]
      ? inspectedDraftId
      : defaultDraftId;
  const inspectedSp = POKEMON_SPECIES[inspectedId];

  const unlockedSet = new Set(snap.unlockedIds);
  const sortedSpecies = [...allSpecies].sort((a, b) => {
    const aUnl = unlockedSet.has(a.id) ? 0 : 1;
    const bUnl = unlockedSet.has(b.id) ? 0 : 1;
    return aUnl - bUnl || Number(a.id) - Number(b.id);
  });
  const rosterItems = sortedSpecies
    .map((sp) => {
      const isUnlocked = unlockedSet.has(sp.id);
      const picked = snap.draftIds.includes(sp.id);
      const canAdd =
        isUnlocked &&
        (picked ||
          (snap.draftIds.length < MAX_ACTIVE_UNITS &&
            spent + sp.draftCost <= snap.draftBudget));
      const classes = [
        'draft-roster-item',
        picked ? 'is-picked' : '',
        !isUnlocked ? 'is-locked' : '',
        sp.id === inspectedId ? 'is-inspected' : '',
        isUnlocked && !picked && !canAdd ? 'is-unaffordable' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `
        <button
          type="button"
          class="${classes}"
          data-action="inspect-draft"
          data-id="${sp.id}"
        >
          ${renderPokeIcon(sp.id)}
          <span class="draft-roster-name">${escapeHtml(sp.name)}</span>
        </button>
      `;
    })
    .join('');

  const teamChips =
    snap.draftIds.length > 0
      ? snap.draftIds
          .map((id) => {
            const sp = POKEMON_SPECIES[id];
            return `<button type="button" class="draft-chip ${sp.id === inspectedId ? 'is-inspected' : ''}" data-action="inspect-draft" data-id="${sp.id}" style="border-color:${sp.color}">${escapeHtml(sp.name)} (${sp.draftCost})</button>`;
          })
          .join('')
      : '<span class="card-hint">Select at least 1 Pokémon to start.</span>';

  const isInspectedUnlocked = inspectedSp
    ? unlockedSet.has(inspectedSp.id)
    : false;
  const isPicked = inspectedSp ? snap.draftIds.includes(inspectedSp.id) : false;
  const canAddInspected = inspectedSp
    ? isInspectedUnlocked &&
      (isPicked ||
        (snap.draftIds.length < MAX_ACTIVE_UNITS &&
          spent + inspectedSp.draftCost <= snap.draftBudget))
    : false;
  const needPts = inspectedSp ? inspectedSp.draftCost - remaining : 0;
  const actionLabel = !isInspectedUnlocked
    ? 'Locked'
    : isPicked
      ? 'Remove'
      : canAddInspected
        ? 'Draft'
        : snap.draftIds.length >= MAX_ACTIVE_UNITS
          ? 'Team Full'
          : `Need ${needPts} more pt${needPts === 1 ? '' : 's'}`;
  const actionBtnClass = isPicked
    ? 'btn btn-danger'
    : canAddInspected
      ? 'btn btn-primary'
      : 'btn';

  const detailHtml = inspectedSp
    ? `
      <div class="draft-detail-panel">
        <div class="draft-detail-header">
          <div class="draft-detail-identity">
            ${renderPokeIcon(inspectedSp.id, 'lg')}
            <div class="draft-detail-title">
              <div class="draft-detail-name">${escapeHtml(inspectedSp.name)}</div>
              <div class="draft-detail-tags">
                <span class="tag">${escapeHtml(inspectedSp.pokeClass)}</span>
                <span class="tag ${isPicked ? 'draft-cost-picked' : ''}">${inspectedSp.draftCost} pt${inspectedSp.draftCost === 1 ? '' : 's'}</span>
                ${inspectedSp.unlockedStarter ? '<span class="tag starter-tag">Starter</span>' : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            class="${actionBtnClass}"
            data-action="toggle-draft"
            data-id="${inspectedSp.id}"
            ${isPicked || canAddInspected ? '' : 'disabled'}
          >
            ${actionLabel}
          </button>
        </div>
        ${!isInspectedUnlocked ? '<div class="card-hint">Recruit in a run to unlock.</div>' : ''}
        ${renderDraftSnowflake(inspectedSp)}
        <div class="desc-box">
          <div><strong>Passive:</strong> ${escapeHtml(inspectedSp.passiveDesc)}</div>
          <div><strong>Basic:</strong> ${escapeHtml(inspectedSp.basicDesc)}</div>
          <div><strong>${escapeHtml(inspectedSp.ultName)}:</strong> ${escapeHtml(inspectedSp.ultDesc)}</div>
        </div>
      </div>
    `
    : '';

  return `
    <div class="modal-card draft-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-draft" tabindex="-1">
      <div class="modal-header">
        <div>
          <div class="modal-title" id="modal-title-draft">Starter Draft — ${spent} / ${snap.draftBudget} pts</div>
          <div class="card-hint">Remaining: ${remaining} pts · Team: ${snap.draftIds.length} / ${MAX_ACTIVE_UNITS}</div>
        </div>
        <div class="btn-row" style="margin:0">
          <button type="button" class="btn" data-action="back-map-select">Maps</button>
          <button type="button" class="btn" data-action="back-home">Home</button>
          <button type="button" class="btn" data-action="open-pokedex">Pokédex</button>
          <button type="button" class="btn" data-action="clear-draft" ${snap.draftIds.length === 0 ? 'disabled' : ''}>Clear</button>
          <button type="button" class="btn btn-primary" data-action="confirm-draft" ${snap.draftIds.length === 0 ? 'disabled' : ''}>Start Game</button>
        </div>
      </div>
      <div class="draft-team-bar">${teamChips}</div>
      <div class="draft-body">
        <div class="draft-roster-grid">${rosterItems}</div>
        ${detailHtml}
      </div>
    </div>
  `;
}

function renderBranchRewardModal(snap: GameSnapshot): string {
  const unit = snap.activeUnits.find(
    (u) => u.uid === snap.pendingBranchUnitUid,
  );
  const sp = unit ? POKEMON_SPECIES[unit.speciesId] : undefined;
  if (!sp) return '';

  const branchCards = sp.branches
    .map(
      (b) => `
        <button type="button" class="reward-card" data-action="pick-branch-reward" data-id="${escapeHtml(b.id)}">
          <div class="reward-title">${escapeHtml(b.name)}</div>
          <div class="reward-desc">${escapeHtml(b.desc)}</div>
        </button>
      `,
    )
    .join('');

  return `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title-branch" tabindex="-1">
      <div class="modal-header">
        <div class="modal-title" id="modal-title-branch">Specialize ${escapeHtml(sp.name)} — Choose 1 of 3</div>
      </div>
      <div class="reward-grid">${branchCards}</div>
    </div>
  `;
}

function renderRewardModal(snap: GameSnapshot): string {
  const cards = snap.rewardChoices
    .map(
      (choice) => `
        <button type="button" class="reward-card" data-action="pick-reward" data-id="${escapeHtml(choice.id)}">
          <span class="tag">${escapeHtml(choice.kind)}</span>
          <div class="reward-title">${escapeHtml(choice.title)}</div>
          <div class="reward-desc">${escapeHtml(choice.desc)}</div>
        </button>
      `,
    )
    .join('');

  return `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title-reward" tabindex="-1">
      <div class="modal-header">
        <div class="modal-title" id="modal-title-reward">Wave Cleared — Choose a Reward</div>
      </div>
      <div class="reward-grid">${cards}</div>
    </div>
  `;
}

function renderEndgameModal(snap: GameSnapshot): string {
  const victory = snap.phase === 'VICTORY';
  return `
    <div class="modal-card compact" role="dialog" aria-modal="true" aria-labelledby="modal-title-endgame" tabindex="-1">
      <div class="modal-header">
        <div class="modal-title" id="modal-title-endgame" style="color:${victory ? 'var(--green)' : 'var(--red)'}">
          ${victory ? 'Bastion Secured — Victory!' : 'Core Shattered — Defeat'}
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Wave</div>
          <div class="stat-box-val">${snap.wave} / ${snap.maxWaves}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Kills</div>
          <div class="stat-box-val">${snap.kills}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Core HP</div>
          <div class="stat-box-val">${Math.max(0, Math.ceil(snap.coreHp))} / ${snap.coreMaxHp}</div>
        </div>
      </div>
      <button type="button" class="btn btn-primary btn-wave" data-action="restart-run">
        Play Again
      </button>
    </div>
  `;
}

function renderExpandedUnitModal(
  snap: GameSnapshot,
  expandedUnitUid: string,
): string {
  const unit = snap.activeUnits.find((u) => u.uid === expandedUnitUid);
  const sp = unit ? POKEMON_SPECIES[unit.speciesId] : undefined;
  if (!unit || !sp) return '';

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
    sp.moveRange,
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

  const heldHtml = Array.from({ length: MAX_HELD_ITEMS })
    .map((_, idx) => {
      const itemId = unit.heldItems[idx];
      const item = itemId ? HELD_ITEMS[itemId] : null;
      if (!item) return '<div class="held-slot empty">Empty Slot</div>';
      return `
        <div class="held-slot filled">
          <span><strong>${escapeHtml(item.name)}</strong> — ${escapeHtml(item.desc)}</span>
          ${
            snap.phase === 'PREP'
              ? `<button type="button" class="held-remove" data-action="unequip-item" data-unit="${unit.uid}" data-id="${idx}" aria-label="Unequip ${escapeHtml(item.name)}">×</button>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  return `
    <div class="modal-card draft-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-unit" tabindex="-1">
      <div class="modal-header">
        <div class="unit-name-wrap">
          ${renderPokeIcon(sp.id)}
          <div class="modal-title" id="modal-title-unit">${escapeHtml(sp.name)}</div>
          <span class="tag">${escapeHtml(sp.pokeClass)}</span>
          ${branch ? `<span class="tag branch-tag">${escapeHtml(branch.name)}</span>` : ''}
        </div>
        <button type="button" class="btn" data-action="close-expanded-unit">Close</button>
      </div>

      <div class="unit-stats-grid unit-stats-grid-6">
        <div class="unit-stat"><span class="unit-stat-lbl">HP</span><span class="unit-stat-val">${Math.ceil(unit.hp)}/${unit.maxHp}</span></div>
        <div class="unit-stat"><span class="unit-stat-lbl">ATK</span><span class="unit-stat-val">${atk}</span></div>
        <div class="unit-stat"><span class="unit-stat-lbl">DEF</span><span class="unit-stat-val">${def}</span></div>
        <div class="unit-stat"><span class="unit-stat-lbl">RANGE</span><span class="unit-stat-val">${range}</span></div>
        <div class="unit-stat"><span class="unit-stat-lbl">MOVE</span><span class="unit-stat-val">${mov}</span></div>
        <div class="unit-stat"><span class="unit-stat-lbl">ATK/S</span><span class="unit-stat-val">${atkSpd}</span></div>
      </div>

      <div class="desc-box">
        <div><strong>Passive:</strong> ${escapeHtml(sp.passiveDesc)}</div>
        <div><strong>Basic Attack:</strong> ${escapeHtml(sp.basicDesc)}</div>
        <div><strong>Ultimate — ${escapeHtml(sp.ultName)}:</strong> ${escapeHtml(sp.ultDesc)} (${Math.floor(unit.ult)}/${unit.ultMax})</div>
      </div>

      <div class="branch-header">
        <span>Specializations</span>
        ${branch ? '' : '<span class="card-hint">Not yet specialized</span>'}
      </div>
      ${renderBranchTree(sp, unit.branchId, snap.upgrades)}

      <div class="held-box">
        <div class="branch-header">
          <span>Held Items</span>
          <span class="card-hint">${unit.heldItems.length} / ${MAX_HELD_ITEMS}</span>
        </div>
        <div class="held-slots">${heldHtml}</div>
      </div>
    </div>
  `;
}

function renderShopModal(snap: GameSnapshot): string {
  const items = Object.values(HELD_ITEMS);
  const itemRows = items
    .map((item) => {
      const owned = snap.heldItemInventory.filter(
        (id) => id === item.id,
      ).length;
      const canBuy = snap.gold >= item.cost;
      return `
        <div class="shop-modal-item">
          <div class="shop-modal-item-head">
            <span class="shop-modal-item-icon">${HELD_ITEM_ICONS[item.id] ?? ''}</span>
            <div class="shop-modal-item-meta">
              <strong>${escapeHtml(item.name)}${owned > 0 ? ` <span class="tag">${owned} in bag</span>` : ''}</strong>
              <span class="shop-item-desc">${escapeHtml(item.desc)}</span>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-accent btn-xs"
            data-action="buy-item"
            data-id="${item.id}"
            ${canBuy ? '' : 'disabled'}
          >
            Buy ₽${item.cost}
          </button>
        </div>
      `;
    })
    .join('');

  const careUnits = snap.activeUnits.filter((u) => u.fainted || u.hp < u.maxHp);
  const careRows = careUnits
    .map((u) => {
      const sp = POKEMON_SPECIES[u.speciesId];
      const name = sp ? sp.name : u.speciesId;
      if (u.fainted) {
        return `
          <div class="shop-care-chip">
            ${renderPokeIcon(u.speciesId)}
            <span>${escapeHtml(name)} (Fainted)</span>
            <button type="button" class="btn btn-primary btn-xs" data-action="revive-unit" data-id="${u.uid}" ${snap.gold >= REVIVE_COST ? '' : 'disabled'}>Revive ₽${REVIVE_COST}</button>
          </div>
        `;
      }
      return `
        <div class="shop-care-chip">
          ${renderPokeIcon(u.speciesId)}
          <span>${escapeHtml(name)} (${Math.ceil(u.hp)}/${u.maxHp})</span>
          <button type="button" class="btn btn-accent btn-xs" data-action="heal-unit" data-id="${u.uid}" ${snap.gold >= HEAL_COST ? '' : 'disabled'}>Heal ₽${HEAL_COST}</button>
        </div>
      `;
    })
    .join('');

  return `
    <div class="menu-backdrop">
      <div class="modal-card compact" role="dialog" aria-modal="true" aria-labelledby="modal-title-shop" tabindex="-1">
        <div class="modal-header">
          <div>
            <div class="modal-title" id="modal-title-shop">Wave ${snap.wave} Merchant Shop</div>
            <div class="modal-sub">Stock up on Held Items and heal your team before Wave ${snap.wave + 1}.</div>
          </div>
          <span class="stat-pill"><span class="stat-label">Gold</span><span class="stat-val gold">₽${snap.gold}</span></span>
        </div>
        <div class="shop-modal-grid">${itemRows}</div>
        ${
          careRows
            ? `<div class="shop-care-section">
                <div class="section-header"><span>Team Care</span><span>${careUnits.length} injured</span></div>
                <div class="shop-care-list">${careRows}</div>
              </div>`
            : ''
        }
        <div class="modal-footer-row">
          <span class="card-hint">Bag: ${snap.heldItemInventory.length} held item(s) ready to equip in Prep.</span>
          <button type="button" class="btn btn-primary" data-action="close-shop">
            Continue to Wave ${snap.wave + 1}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderModalHtml(
  snap: GameSnapshot | null,
  state: ModalState,
): { html: string; invalidExpandedUnit?: boolean } {
  if (state.showCredits) {
    return { html: renderCreditsModal() };
  }
  if (state.showPokedex) {
    return { html: renderPokedexModal(snap, state) };
  }
  if (!snap) {
    return { html: '' };
  }
  if (snap.phase === 'HOME') {
    return { html: renderHomeModal(snap) };
  }
  if (snap.phase === 'MAP_SELECT') {
    return { html: renderMapSelectModal(snap, state.mapDifficultyFilter) };
  }
  if (snap.phase === 'DRAFT') {
    return { html: renderDraftModal(snap, state.inspectedDraftId) };
  }
  if (snap.phase === 'REWARD' && snap.pendingBranchUnitUid) {
    return { html: renderBranchRewardModal(snap) };
  }
  if (snap.phase === 'REWARD') {
    return { html: renderRewardModal(snap) };
  }
  if (snap.phase === 'SHOP') {
    return { html: renderShopModal(snap) };
  }
  if (snap.phase === 'VICTORY' || snap.phase === 'DEFEAT') {
    return { html: renderEndgameModal(snap) };
  }
  if (state.expandedUnitUid) {
    const html = renderExpandedUnitModal(snap, state.expandedUnitUid);
    if (!html) {
      return { html: '', invalidExpandedUnit: true };
    }
    return { html };
  }
  return { html: '' };
}
