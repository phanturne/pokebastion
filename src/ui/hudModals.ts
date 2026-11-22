import { getEvolutionTargets } from '../data/evolutions';
import { MAP_BY_ID, MAP_CATALOG, createGridForMap } from '../data/maps';
import { ENEMY_SPECIES, HELD_ITEMS, POKEMON_SPECIES } from '../data/pokemon';
import {
  RUN_DIFFICULTIES,
  RUN_DIFFICULTY_BY_ID,
  getWavesForRun,
} from '../data/waves';
import {
  computeUnitAtk,
  computeUnitAttackIntervalMs,
  computeUnitDef,
  computeUnitRange,
} from '../engine/combat';
import {
  EGG_DUPLICATE_SHARDS,
  EGG_HATCH_RATES,
  MAX_POTENTIAL,
  PITY_WIN_THRESHOLD,
  POTENTIAL_TIER_DESCRIPTIONS,
  POTENTIAL_UPGRADE_COSTS,
  SUBCLASS_PASSIVE_DESCS,
  getPotentialUpgradeCost,
  getSpeciesRarity,
  getUnlockShardCost,
} from '../engine/progression';
import {
  MAX_ACTIVE_UNITS,
  MAX_HELD_ITEMS,
  RARE_CANDY_COST,
  getBranchSpec,
  getDraftCost,
  getEnemyThreatSummary,
  getHealCost,
  getPokemonReleaseRefund,
  getReviveCost,
  getRewardRerollCost,
} from '../engine/rules';
import {
  POKEMON_ELEMENT_TYPES,
  TYPE_CHART,
  TYPE_COLORS,
} from '../engine/typeChart';
import {
  EggHatchResult,
  EggTier,
  GameSnapshot,
  MapDifficulty,
  PokemonClass,
  PokemonRarity,
  PokemonSpecies,
  RunDifficulty,
} from '../types';
import {
  HELD_ITEM_ICONS,
  SVG_GITHUB,
  SVG_SHAKE_OFF,
  SVG_SHAKE_ON,
  SVG_SOUND_OFF,
  SVG_SOUND_ON,
  escapeHtml,
  formatBranchChips,
  pct,
  renderBranchTree,
  renderDraftSnowflake,
  renderPokeIcon,
  renderSpeciesTypeBadges,
  renderTargetPriorityControl,
  renderTypeBadge,
} from './hudShared';

export interface ModalState {
  showCredits: boolean;
  showPokedex: boolean;
  showEggs: boolean;
  showHatchRates: boolean;
  typeChartOpen: boolean;
  hatchResult: EggHatchResult | null;
  hatchSeq: number;
  pokedexFilter: 'all' | 'unlocked' | 'locked';
  rosterClassFilter: 'All' | PokemonClass;
  rosterRarityFilter: 'All' | PokemonRarity;
  rosterCostFilter: 'All' | '1' | '2' | '3' | '4' | '5+';
  inspectedPokedexId: string | null;
  mapDifficultyFilter: 'All' | MapDifficulty;
  selectedDifficultyPreview: RunDifficulty;
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

function renderCreditsModal(snap: GameSnapshot | null): string {
  const isHome = !snap || snap.phase === 'HOME';
  const cardHtml = `
      <div class="modal-card compact" role="dialog" aria-modal="${isHome ? 'true' : 'false'}" aria-labelledby="modal-title-credits" tabindex="-1">
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
          <div class="credit-item">
            <strong>Held Item Sprites — PokeAPI / PokéSprite</strong>
            <a href="https://pokeapi.github.io/sprites/#/item" target="_blank" rel="noopener noreferrer">
              pokeapi.github.io/sprites
            </a>
          </div>
        </div>
      </div>
  `;
  return isHome
    ? `<div class="menu-backdrop"><img class="menu-backdrop-img" src="assets/ui/menu-bg.jpg" alt="" aria-hidden="true" />${cardHtml}</div>`
    : cardHtml;
}

function renderPokedexProgressionHtml(
  snap: GameSnapshot | null,
  speciesId: string,
  isUnlocked: boolean,
  shards: number,
  potential: number,
): string {
  const universalShards = snap?.universalShards ?? 0;

  if (!isUnlocked) {
    const cost = getUnlockShardCost(speciesId);
    const shortfall = Math.max(0, cost - shards);
    const canAfford = snap !== null && shards + universalShards >= cost;
    const usesUniversal = shortfall > 0 && canAfford;
    const fillPct = pct(shards, cost);
    const note =
      shortfall > 0
        ? usesUniversal
          ? `Uses ${shortfall} Universal`
          : `Need ${shortfall} more`
        : 'Ready to unlock';

    return `
      <div class="pokedex-prog-box">
        <div class="pokedex-prog-head">
          <span class="pokedex-prog-label">Unlock Progress</span>
          <span class="pokedex-prog-nums">${shards} / ${cost} Shards · ${note}</span>
        </div>
        <div class="shard-bar-track" role="progressbar" aria-valuenow="${Math.min(shards, cost)}" aria-valuemin="0" aria-valuemax="${cost}">
          <div class="shard-bar-fill" style="width:${fillPct}%"></div>
        </div>
        <button
          type="button"
          class="btn btn-primary btn-xs pokedex-prog-btn"
          data-action="unlock-species"
          data-id="${speciesId}"
          ${canAfford ? '' : 'disabled'}
        >
          ${usesUniversal ? `Unlock with Shards (${shards} + ${shortfall} Univ.)` : `Unlock with Shards (${cost})`}
        </button>
      </div>
    `;
  }

  const nextCost = getPotentialUpgradeCost(potential);
  if (nextCost === null) {
    return `
      <div class="pokedex-prog-box is-maxed">
        <div class="pokedex-prog-head">
          <span class="pokedex-prog-label">Potential Maxed</span>
          <span class="pokedex-prog-nums">★${MAX_POTENTIAL} / ★${MAX_POTENTIAL}${shards > 0 ? ` · ${shards} extra shards` : ''}</span>
        </div>
        <div class="shard-bar-track" role="progressbar" aria-valuenow="${MAX_POTENTIAL}" aria-valuemin="0" aria-valuemax="${MAX_POTENTIAL}">
          <div class="shard-bar-fill is-max" style="width:100%"></div>
        </div>
      </div>
    `;
  }

  const shortfall = Math.max(0, nextCost - shards);
  const canAfford = snap !== null && shards + universalShards >= nextCost;
  const usesUniversal = shortfall > 0 && canAfford;
  const fillPct = pct(shards, nextCost);
  const note =
    shortfall > 0
      ? usesUniversal
        ? `Uses ${shortfall} Universal`
        : `Need ${shortfall} more`
      : 'Ready to upgrade';

  return `
    <div class="pokedex-prog-box">
      <div class="pokedex-prog-head">
        <span class="pokedex-prog-label">Next Potential (★${potential} → ★${potential + 1})</span>
        <span class="pokedex-prog-nums">${shards} / ${nextCost} Shards · ${note}</span>
      </div>
      <div class="shard-bar-track" role="progressbar" aria-valuenow="${Math.min(shards, nextCost)}" aria-valuemin="0" aria-valuemax="${nextCost}">
        <div class="shard-bar-fill" style="width:${fillPct}%"></div>
      </div>
      <button
        type="button"
        class="btn btn-primary btn-xs pokedex-prog-btn"
        data-action="upgrade-potential"
        data-id="${speciesId}"
        ${canAfford ? '' : 'disabled'}
      >
        Upgrade Potential (★${potential} → ★${potential + 1})${usesUniversal ? ` · +${shortfall} Univ.` : ''}
      </button>
    </div>
  `;
}

function renderPotentialTiersHtml(
  speciesId: string,
  isUnlocked: boolean,
  potential: number,
): string {
  const sp = POKEMON_SPECIES[speciesId];
  const rows = POTENTIAL_TIER_DESCRIPTIONS.map((baseDesc, idx) => {
    const tier = idx + 1;
    const cost = POTENTIAL_UPGRADE_COSTS[idx];
    const isTierUnlocked = isUnlocked && potential >= tier;
    const isNextTier = isUnlocked && potential + 1 === tier;
    const stateCls = isTierUnlocked
      ? 'is-unlocked'
      : isNextTier
        ? 'is-next'
        : 'is-locked';
    const statusText = isTierUnlocked
      ? 'Unlocked'
      : isNextTier
        ? `Next · ${cost}`
        : `${cost} Shards`;
    const desc =
      tier === 5 && sp?.subclass
        ? `${sp.subclass}: ${SUBCLASS_PASSIVE_DESCS[sp.subclass]}`
        : baseDesc;

    return `
      <div class="potential-tier-row ${stateCls}">
        <span class="potential-tier-star">★${tier}</span>
        <span class="potential-tier-desc">${escapeHtml(desc)}</span>
        <span class="potential-tier-status">${escapeHtml(statusText)}</span>
      </div>
    `;
  }).join('');

  return `
    <details class="potential-tiers-box">
      <summary class="potential-tiers-title">Potential Tiers (★${potential}/${MAX_POTENTIAL})</summary>
      <div class="potential-tiers-list">${rows}</div>
    </details>
  `;
}

const ROSTER_CLASSES: Array<'All' | PokemonClass> = [
  'All',
  'Defender',
  'Brawler',
  'Marksman',
  'Blaster',
  'Support',
  'Specialist',
];
const ROSTER_RARITIES: Array<'All' | PokemonRarity> = [
  'All',
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
];
const ROSTER_COSTS: Array<{
  id: ModalState['rosterCostFilter'];
  label: string;
}> = [
  { id: 'All', label: 'Any Cost' },
  { id: '1', label: '1 pt' },
  { id: '2', label: '2 pts' },
  { id: '3', label: '3 pts' },
  { id: '4', label: '4 pts' },
  { id: '5+', label: '5–6 pts' },
];

function filterSpeciesByAttributes(
  list: PokemonSpecies[],
  state: ModalState,
): PokemonSpecies[] {
  return list.filter((sp) => {
    if (
      state.rosterClassFilter !== 'All' &&
      sp.pokeClass !== state.rosterClassFilter &&
      sp.secondaryClass !== state.rosterClassFilter
    ) {
      return false;
    }
    if (
      state.rosterRarityFilter !== 'All' &&
      getSpeciesRarity(sp.id) !== state.rosterRarityFilter
    ) {
      return false;
    }
    if (state.rosterCostFilter !== 'All') {
      if (state.rosterCostFilter === '5+') {
        if (sp.draftCost < 5) return false;
      } else if (sp.draftCost !== Number(state.rosterCostFilter)) {
        return false;
      }
    }
    return true;
  });
}

function renderRosterFiltersHtml(state: ModalState): string {
  const hasFilter =
    state.rosterClassFilter !== 'All' ||
    state.rosterRarityFilter !== 'All' ||
    state.rosterCostFilter !== 'All';

  const classOpts = ROSTER_CLASSES.map(
    (c) =>
      `<option value="${c}" ${state.rosterClassFilter === c ? 'selected' : ''}>${c === 'All' ? 'All Classes' : c}</option>`,
  ).join('');
  const rarityOpts = ROSTER_RARITIES.map(
    (r) =>
      `<option value="${r}" ${state.rosterRarityFilter === r ? 'selected' : ''}>${r === 'All' ? 'All Rarities' : r}</option>`,
  ).join('');
  const costOpts = ROSTER_COSTS.map(
    (c) =>
      `<option value="${c.id}" ${state.rosterCostFilter === c.id ? 'selected' : ''}>${c.label}</option>`,
  ).join('');

  return `
    <div class="roster-filter-bar">
      <div class="roster-filter-group">
        <label class="roster-filter-label" for="filter-class">Class</label>
        <select id="filter-class" class="roster-select" data-action="roster-class-filter" aria-label="Filter by Class">
          ${classOpts}
        </select>
      </div>
      <div class="roster-filter-group">
        <label class="roster-filter-label" for="filter-rarity">Rarity</label>
        <select id="filter-rarity" class="roster-select" data-action="roster-rarity-filter" aria-label="Filter by Rarity">
          ${rarityOpts}
        </select>
      </div>
      <div class="roster-filter-group">
        <label class="roster-filter-label" for="filter-cost">Cost</label>
        <select id="filter-cost" class="roster-select" data-action="roster-cost-filter" aria-label="Filter by Draft Cost">
          ${costOpts}
        </select>
      </div>
      ${
        hasFilter
          ? '<button type="button" class="btn btn-xs roster-reset-btn" data-action="reset-roster-filters" title="Reset attribute filters">↺ Reset</button>'
          : ''
      }
    </div>
  `;
}

function renderPokedexModal(
  snap: GameSnapshot | null,
  state: ModalState,
): string {
  const unlockedSet = new Set(snap?.unlockedIds ?? []);
  const universalShards = snap?.universalShards ?? 0;
  const allSpecies = Object.values(POKEMON_SPECIES);
  const unlockedCount = allSpecies.filter((s) => unlockedSet.has(s.id)).length;
  const statusFiltered = allSpecies.filter((s) => {
    if (state.pokedexFilter === 'unlocked') return unlockedSet.has(s.id);
    if (state.pokedexFilter === 'locked') return !unlockedSet.has(s.id);
    return true;
  });
  const filtered = filterSpeciesByAttributes(statusFiltered, state);
  const inspectedId =
    state.inspectedPokedexId && POKEMON_SPECIES[state.inspectedPokedexId]
      ? state.inspectedPokedexId
      : (filtered[0]?.id ?? allSpecies[0]?.id);
  const inspectedSp = inspectedId ? POKEMON_SPECIES[inspectedId] : undefined;
  const inspectedUnlocked = inspectedSp
    ? unlockedSet.has(inspectedSp.id)
    : false;
  const inspectedProg = inspectedSp
    ? snap?.pokemonProgress?.[inspectedSp.id]
    : undefined;
  const inspectedShards = inspectedProg?.shards ?? 0;
  const inspectedPotential = inspectedProg?.potential ?? 0;
  const inspectedRarity = inspectedSp
    ? getSpeciesRarity(inspectedSp.id)
    : 'Common';

  const gridHtml =
    filtered.length > 0
      ? filtered
          .map((sp) => {
            const isUnlocked = unlockedSet.has(sp.id);
            const prog = snap?.pokemonProgress?.[sp.id];
            const shards = prog?.shards ?? 0;
            const potential = prog?.potential ?? 0;
            const unlockCost = getUnlockShardCost(sp.id);
            const rarity = getSpeciesRarity(sp.id);
            const cardMeta = isUnlocked
              ? `★${potential}`
              : `${shards}/${unlockCost}`;
            const nextUpgradeCost = isUnlocked
              ? getPotentialUpgradeCost(potential)
              : unlockCost;
            const miniFillPct =
              nextUpgradeCost !== null ? pct(shards, nextUpgradeCost) : 100;
            const isReady =
              nextUpgradeCost !== null &&
              shards + universalShards >= nextUpgradeCost;
            const classes = [
              'draft-roster-item',
              'pokedex-card',
              `card-rarity-${rarity.toLowerCase()}`,
              !isUnlocked ? 'is-locked' : '',
              isReady ? 'is-ready' : '',
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
                title="${escapeHtml(`${sp.name} (${rarity})`)}"
              >
                <div class="pokedex-card-top">
                  <span class="pokedex-card-meta ${isUnlocked ? 'is-potential' : 'is-shards'}" aria-label="${isUnlocked ? `Potential ${potential} of ${MAX_POTENTIAL}` : `${shards} of ${unlockCost} shards`}">${cardMeta}</span>
                </div>
                ${renderPokeIcon(sp.id)}
                <span class="draft-roster-name">#${sp.id.slice(-3)} ${escapeHtml(sp.name)}</span>
                <span class="card-mini-bar" aria-hidden="true">
                  <span class="card-mini-fill ${nextUpgradeCost === null ? 'is-max' : ''}" style="width:${miniFillPct}%"></span>
                </span>
              </button>
            `;
          })
          .join('')
      : '<div class="card-hint" style="grid-column:1/-1;padding:12px;">No Pokémon match this filter yet.</div>';

  const detailHtml = inspectedSp
    ? `
      <div class="draft-detail-panel pokedex-detail-panel">
        <div class="draft-detail-header">
          <div class="draft-detail-identity">
            ${renderPokeIcon(inspectedSp.id, 'lg')}
            <div class="draft-detail-title">
              <div class="draft-detail-name">${escapeHtml(inspectedSp.name)}</div>
              <div class="draft-detail-tags">
                <span class="tag rarity-tag rarity-${inspectedRarity.toLowerCase()}">${escapeHtml(inspectedRarity)}</span>
                <span class="tag">${escapeHtml(inspectedSp.pokeClass)}</span>
                <span class="tag cost-tag">${inspectedSp.draftCost} pt${inspectedSp.draftCost === 1 ? '' : 's'}</span>
                ${inspectedUnlocked ? `<span class="tag potential-tag">★${inspectedPotential}/${MAX_POTENTIAL}</span>` : '<span class="tag locked-tag">Locked</span>'}
              </div>
              <div class="type-badge-row">${renderSpeciesTypeBadges(inspectedSp.id)}</div>
            </div>
          </div>
        </div>
        ${renderPokedexProgressionHtml(snap, inspectedSp.id, inspectedUnlocked, inspectedShards, inspectedPotential)}
        ${renderPotentialTiersHtml(inspectedSp.id, inspectedUnlocked, inspectedPotential)}
        ${renderDraftSnowflake(inspectedSp)}
        <div class="desc-box">
          <div><strong>Passive:</strong> ${escapeHtml(inspectedSp.passiveDesc)}</div>
          <div><strong>Basic:</strong> ${escapeHtml(inspectedSp.basicDesc)}</div>
          <div><strong>Ult (${escapeHtml(inspectedSp.ultName)}):</strong> ${escapeHtml(inspectedSp.ultDesc)}</div>
          <div class="draft-branches">
            <strong>Branches:</strong>
            ${inspectedSp.branches
              .map((b, idx) => {
                const chips = formatBranchChips(b);
                return `<div class="branch-line">• <em>Path ${idx + 1}: ${escapeHtml(b.name)}</em> ${chips || `— ${escapeHtml(b.desc)}`}</div>`;
              })
              .join('')}
          </div>
        </div>
      </div>
    `
    : '';

  return `
    <div class="menu-backdrop"><img class="menu-backdrop-img" src="assets/ui/menu-bg.jpg" alt="" aria-hidden="true" />
      <div class="modal-card draft-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-pokedex" tabindex="-1">
        <div class="modal-header pokedex-modal-header">
          <div class="pokedex-header-left">
            <div class="modal-title" id="modal-title-pokedex">Pokédex — ${unlockedCount} / ${allSpecies.length} Unlocked</div>
            <span class="stat-pill pokedex-shards-pill" title="Universal Shards can substitute for any missing species shards">
              <span class="stat-label">Universal Shards</span>
              <span class="stat-val gold">${universalShards}</span>
            </span>
          </div>
          <div class="btn-row pokedex-header-actions" style="margin:0">
            <button type="button" class="btn btn-sm ${state.pokedexFilter === 'all' ? 'btn-primary' : ''}" data-action="pokedex-filter" data-id="all" aria-pressed="${state.pokedexFilter === 'all'}">All (${allSpecies.length})</button>
            <button type="button" class="btn btn-sm ${state.pokedexFilter === 'unlocked' ? 'btn-primary' : ''}" data-action="pokedex-filter" data-id="unlocked" aria-pressed="${state.pokedexFilter === 'unlocked'}">Unlocked (${unlockedCount})</button>
            <button type="button" class="btn btn-sm ${state.pokedexFilter === 'locked' ? 'btn-primary' : ''}" data-action="pokedex-filter" data-id="locked" aria-pressed="${state.pokedexFilter === 'locked'}">Locked (${allSpecies.length - unlockedCount})</button>
            <button type="button" class="btn btn-icon" data-action="close-pokedex" aria-label="Close Pokédex" title="Close">✕</button>
          </div>
        </div>
        ${renderRosterFiltersHtml(state)}
        <div class="draft-body">
          <div class="draft-roster-grid">${gridHtml}</div>
          ${detailHtml}
        </div>
      </div>
    </div>
  `;
}

const EGG_TIER_META: Record<
  EggTier,
  { label: string; subtitle: string; primaryColor: string; spotColor: string }
> = {
  common: {
    label: 'Common Egg',
    subtitle: 'Mostly Common & Uncommon Pokémon',
    primaryColor: '#cbd5e1',
    spotColor: '#64748b',
  },
  rare: {
    label: 'Rare Egg',
    subtitle: 'Guaranteed Uncommon or higher',
    primaryColor: '#58a6ff',
    spotColor: '#1d4ed8',
  },
  master: {
    label: 'Master Egg',
    subtitle: '70% Epic · 30% Legendary',
    primaryColor: '#bc8cff',
    spotColor: '#f7cc45',
  },
};

function renderEggSvg(tier: EggTier, cls = 'egg-svg'): string {
  const meta = EGG_TIER_META[tier];
  return `
    <svg class="${cls}" viewBox="0 0 32 38" aria-hidden="true">
      <path d="M16 3C10 3 5 13 5 22c0 7.5 4.8 13 11 13s11-5.5 11-13C27 13 22 3 16 3z" fill="${meta.primaryColor}" stroke="#0d1117" stroke-width="2"/>
      <ellipse cx="12" cy="15" rx="3" ry="4" fill="${meta.spotColor}" opacity="0.65"/>
      <circle cx="20" cy="22" r="2.6" fill="${meta.spotColor}" opacity="0.65"/>
      <circle cx="13" cy="27" r="2" fill="${meta.spotColor}" opacity="0.5"/>
      <path d="M11 9c1.5-2.5 3.2-3.5 5-3.5" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity="0.65"/>
    </svg>
  `;
}

function renderHatchRatesInfoHtml(): string {
  const rarities: PokemonRarity[] = [
    'Common',
    'Uncommon',
    'Rare',
    'Epic',
    'Legendary',
  ];
  const tiers: EggTier[] = ['common', 'rare', 'master'];

  const rowsHtml = rarities
    .map((rarity) => {
      const cells = tiers
        .map((tier) => {
          const rate = EGG_HATCH_RATES[tier][rarity];
          return `<td class="${rate === 0 ? 'is-zero' : ''}">${rate > 0 ? `${rate}%` : '—'}</td>`;
        })
        .join('');
      return `
        <tr>
          <td><span class="pokedex-rarity-tag rarity-${rarity.toLowerCase()}">${escapeHtml(rarity)}</span></td>
          ${cells}
          <td>+${EGG_DUPLICATE_SHARDS[rarity]} Shards</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="hatch-rates-panel">
      <div class="hatch-rates-rule">
        <strong>Unowned-First Rule:</strong> When an Egg rolls a rarity tier, it prioritizes Pokémon you haven't unlocked yet in that rarity. If you already own every Pokémon of that rarity, it awards duplicate Shards for a random Pokémon of that rarity.
      </div>
      <div class="hatch-table-wrap">
        <table class="hatch-rates-table">
          <thead>
            <tr>
              <th>Rarity</th>
              <th>Common Egg</th>
              <th>Rare Egg</th>
              <th>Master Egg</th>
              <th>Duplicate Payout</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderEggsModal(snap: GameSnapshot | null, state: ModalState): string {
  const eggs = snap?.eggs ?? { common: 0, rare: 0, master: 0 };
  const pityWins = snap?.pityWins ?? 0;
  const pityPct = pct(pityWins, PITY_WIN_THRESHOLD);
  const tiers: EggTier[] = ['common', 'rare', 'master'];

  const eggCardsHtml = tiers
    .map((tier) => {
      const meta = EGG_TIER_META[tier];
      const count = eggs[tier] ?? 0;
      return `
        <div class="egg-tier-card tier-${tier}">
          <div class="egg-tier-icon">${renderEggSvg(tier)}</div>
          <div class="egg-tier-name">${meta.label}</div>
          <div class="egg-tier-sub">${meta.subtitle}</div>
          <div class="egg-tier-count">Owned: <strong>${count}</strong></div>
          <button
            type="button"
            class="btn btn-primary"
            data-action="hatch-egg"
            data-id="${tier}"
            ${count > 0 ? '' : 'disabled'}
          >
            Hatch
          </button>
        </div>
      `;
    })
    .join('');

  const bodyHtml = state.showHatchRates
    ? renderHatchRatesInfoHtml()
    : `
      <div class="egg-pity-bar">
        <div class="egg-pity-head">
          <span>Bonus Egg Pity Counter</span>
          <span class="egg-pity-val">${pityWins} / ${PITY_WIN_THRESHOLD} wins to guaranteed bonus Egg</span>
        </div>
        <div class="shard-bar-track" role="progressbar" aria-valuenow="${pityWins}" aria-valuemin="0" aria-valuemax="${PITY_WIN_THRESHOLD}">
          <div class="shard-bar-fill" style="width:${pityPct}%"></div>
        </div>
      </div>
      <div class="egg-tier-grid">${eggCardsHtml}</div>
    `;

  return `
    <div class="menu-backdrop"><img class="menu-backdrop-img" src="assets/ui/menu-bg.jpg" alt="" aria-hidden="true" />
      <div class="modal-card eggs-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-eggs" tabindex="-1">
        <div class="modal-header">
          <div class="modal-title" id="modal-title-eggs">${state.showHatchRates ? 'Egg Hatch Rates & Rules' : 'Pokémon Eggs'}</div>
          <div class="btn-row" style="margin:0">
            <button
              type="button"
              class="btn ${state.showHatchRates ? 'btn-primary' : ''}"
              data-action="toggle-hatch-rates"
              aria-pressed="${state.showHatchRates}"
            >
              ${state.showHatchRates ? 'Back to Eggs' : 'Info / Hatch Rates'}
            </button>
            <button type="button" class="btn" data-action="close-eggs">Close</button>
          </div>
        </div>
        ${bodyHtml}
      </div>
    </div>
  `;
}

function renderEggHatchRevealModal(
  snap: GameSnapshot | null,
  result: EggHatchResult,
  hatchSeq: number,
): string {
  const sp = POKEMON_SPECIES[result.speciesId];
  const spName = sp ? sp.name : result.speciesId;
  const rarityClass = `rarity-${result.rarity.toLowerCase()}`;
  const remainingOfTier = snap?.eggs?.[result.eggTier] ?? 0;
  const canHatchAnother = remainingOfTier > 0;

  const rewardSummaryParts: string[] = [];
  if (result.shardsAwarded > 0) {
    rewardSummaryParts.push(
      `+${result.shardsAwarded} ${escapeHtml(spName)} Shards`,
    );
  }
  if (result.universalShardsAwarded > 0) {
    rewardSummaryParts.push(
      `+${result.universalShardsAwarded} Universal Shards`,
    );
  }
  const rewardSummary =
    rewardSummaryParts.length > 0
      ? `<div class="hatch-shards-summary">${rewardSummaryParts.join(' · ')}</div>`
      : '';

  const isHome = !snap || snap.phase === 'HOME';
  const cardHtml = `
      <div class="modal-card compact hatch-reveal-modal ${rarityClass}" data-hatch-seq="${hatchSeq}" role="dialog" aria-modal="${isHome ? 'true' : 'false'}" aria-labelledby="modal-title-hatch-reveal" tabindex="-1">
        <div class="hatch-reveal-head">
          <span class="tag">${escapeHtml(EGG_TIER_META[result.eggTier].label)}</span>
        </div>
        <div class="hatch-stage">
          <div class="hatch-egg-wobble" aria-hidden="true">${renderEggSvg(result.eggTier, 'egg-svg hatch-egg-svg')}</div>
          <div class="hatch-flash" aria-hidden="true"></div>
          <div class="hatch-pokemon-reveal">
            <div class="hatch-glow ${rarityClass}"></div>
            <img class="hatch-pokemon-sprite" src="assets/pokemon/${escapeHtml(result.speciesId)}/Normal.png" alt="${escapeHtml(spName)}" width="80" height="80" />
          </div>
        </div>
        <div class="hatch-reveal-info">
          <div class="hatch-badges">
            <span class="pokedex-rarity-tag ${rarityClass}">${escapeHtml(result.rarity)}</span>
            ${result.wasNewUnlock ? '<span class="hatch-new-badge">NEW UNLOCK!</span>' : ''}
          </div>
          <div class="modal-title hatch-pokemon-name" id="modal-title-hatch-reveal">${escapeHtml(spName)}</div>
          ${rewardSummary}
        </div>
        <div class="hatch-reveal-actions">
          <button
            type="button"
            class="btn btn-primary"
            data-action="hatch-another"
            ${canHatchAnother ? '' : 'disabled'}
          >
            Hatch Another (${remainingOfTier})
          </button>
          <button type="button" class="btn" data-action="close-hatch-result">Close</button>
        </div>
      </div>
  `;
  return isHome
    ? `<div class="menu-backdrop"><img class="menu-backdrop-img" src="assets/ui/menu-bg.jpg" alt="" aria-hidden="true" />${cardHtml}</div>`
    : cardHtml;
}

function renderHomeModal(snap: GameSnapshot): string {
  const unlockedCount = snap.unlockedIds.length;
  const totalCount = Object.keys(POKEMON_SPECIES).length;
  const totalEggs =
    (snap.eggs?.common ?? 0) +
    (snap.eggs?.rare ?? 0) +
    (snap.eggs?.master ?? 0);
  return `
    <div class="menu-backdrop home-backdrop"><img class="menu-backdrop-img home-bg-drift" src="assets/ui/menu-bg.jpg" alt="" aria-hidden="true" />
      <div class="modal-card compact home-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-home" tabindex="-1">
        <div class="home-bg-hit" aria-hidden="true"></div>
        <div class="home-top-controls">
          <button
            type="button"
            class="btn btn-icon"
            data-action="toggle-mute"
            aria-pressed="${snap.muted}"
            aria-label="${snap.muted ? 'Sound: Off' : 'Sound: On'}"
            title="${snap.muted ? 'Sound: Off' : 'Sound: On'}"
          >${snap.muted ? SVG_SOUND_OFF : SVG_SOUND_ON}</button>
          <button
            type="button"
            class="btn btn-icon"
            data-action="toggle-shake"
            aria-pressed="${!snap.screenShakeEnabled}"
            aria-label="${snap.screenShakeEnabled ? 'Screen shake: On' : 'Screen shake: Off'}"
            title="${snap.screenShakeEnabled ? 'Screen shake: On' : 'Screen shake: Off'}"
          >${snap.screenShakeEnabled ? SVG_SHAKE_ON : SVG_SHAKE_OFF}</button>
          <a
            class="btn btn-icon home-github-btn"
            href="https://github.com/phanturne/pokebastion"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository"
            title="View on GitHub"
          >${SVG_GITHUB}</a>
        </div>
        <div class="home-hero">
          <div class="home-title-row">
            <h1 class="home-title" id="modal-title-home">PokéBastion TD</h1>
            <span class="home-alpha-badge">Alpha</span>
          </div>
          <p class="home-subtitle">
            Tactical Pokémon tower defense. Build walls, reposition units in real time, and defend the Pokémon Center.
          </p>
        </div>
        <div class="home-press-play" aria-hidden="true">Click anywhere to play</div>
        <div class="home-actions">
          <button type="button" class="btn btn-primary home-btn" data-action="home-play">Play</button>
          <button type="button" class="btn home-btn" data-action="open-pokedex">Pokédex (${unlockedCount}/${totalCount})</button>
          <button type="button" class="btn home-btn ${totalEggs > 0 ? 'has-eggs' : ''}" data-action="open-eggs">Eggs (${totalEggs})${totalEggs > 0 ? '<span class="egg-notify-dot" aria-hidden="true"></span>' : ''}</button>
          <button type="button" class="btn home-btn" data-action="toggle-credits">Credits</button>
          <a class="btn home-btn" href="about.html">About</a>
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
      const basePreview = m.previewImage
        ? `<img class="map-preview-img" src="${escapeHtml(m.previewImage)}" alt="${escapeHtml(m.name)}" />`
        : getMapPreviewSvg(m.id);
      const previewHtml = m.comingSoon
        ? `${basePreview}<div class="map-coming-soon">COMING SOON</div>`
        : basePreview;
      return `
        <button
          type="button"
          class="map-card btd6-map-card ${isCurrent ? 'is-selected' : ''} ${m.comingSoon ? 'is-coming-soon' : ''}"
          data-action="select-map"
          data-id="${escapeHtml(m.id)}"
          title="${escapeHtml(m.desc)}"
          ${m.comingSoon ? 'disabled' : ''}
        >
          <div class="map-card-banner">
            <span class="map-card-title">${escapeHtml(m.name.toUpperCase())}</span>
            <span class="tag map-diff-badge ${diffClass}">${escapeHtml(m.difficulty)}</span>
          </div>
          <div class="map-preview-wrap">
            ${previewHtml}
          </div>
        </button>
      `;
    })
    .join('');

  const filterTabsHtml = difficulties
    .map(
      (d) =>
        `<button type="button" class="btn map-diff-tab ${mapDifficultyFilter === d ? 'btn-primary is-active' : ''}" data-action="map-filter" data-id="${d}" aria-pressed="${mapDifficultyFilter === d}">${d}</button>`,
    )
    .join('');

  return `
    <div class="menu-backdrop"><img class="menu-backdrop-img" src="assets/ui/menu-bg.jpg" alt="" aria-hidden="true" />
      <div class="modal-card draft-modal map-select-modal btd6-map-select" role="dialog" aria-modal="true" aria-labelledby="modal-title-map-select" tabindex="-1">
        <div class="btd6-map-topbar">
          <button type="button" class="btn btd6-back-btn" data-action="back-home" aria-label="Back to Home" title="Back to Home">← Back</button>
          <div class="modal-title btd6-map-heading" id="modal-title-map-select">Select Battlefield</div>
          <div class="btd6-topbar-spacer"></div>
        </div>
        <div class="map-grid btd6-map-grid">${mapCardsHtml}</div>
        <div class="btd6-difficulty-bar" role="tablist" aria-label="Map Difficulty">
          ${filterTabsHtml}
        </div>
      </div>
    </div>
  `;
}

function formatPctModifier(mult: number, invertGood = false): string {
  const delta = Math.round((mult - 1) * 100);
  if (delta === 0) return '100%';
  const sign = delta > 0 ? '+' : '';
  const cls =
    (delta > 0 && !invertGood) || (delta < 0 && invertGood)
      ? 'mod-good'
      : 'mod-hard';
  return `<span class="${cls}">${sign}${delta}%</span>`;
}

function renderDifficultySelectModal(
  snap: GameSnapshot,
  selectedDifficulty: RunDifficulty,
): string {
  const mapSpec = MAP_BY_ID[snap.selectedMapId];
  const activeDiff = RUN_DIFFICULTY_BY_ID[selectedDifficulty];
  const activeWaves = getWavesForRun(snap.selectedMapId, selectedDifficulty);

  const firstWaveByEnemy = new Map<string, number>();
  const bossEnemyIds = new Set<string>();
  for (const w of activeWaves) {
    for (const grp of w.spawns) {
      if (!firstWaveByEnemy.has(grp.speciesId)) {
        firstWaveByEnemy.set(grp.speciesId, w.wave);
      }
      if (grp.isBoss) {
        bossEnemyIds.add(grp.speciesId);
      }
    }
  }

  const diffCardsHtml = RUN_DIFFICULTIES.map((d) => {
    const isSelected = d.id === selectedDifficulty;
    const bossCount = Math.floor(d.maxWaves / 10);
    return `
      <button
        type="button"
        class="diff-card diff-tier-${d.id} ${isSelected ? 'is-selected' : ''}"
        data-action="preview-difficulty"
        data-id="${d.id}"
        aria-pressed="${isSelected}"
      >
        <div class="diff-card-head">
          <span class="diff-card-name">${escapeHtml(d.name)}</span>
          <span class="tag diff-card-waves">${d.maxWaves} Waves · ${bossCount} Boss${bossCount === 1 ? '' : 'es'}</span>
        </div>
        <div class="diff-card-badge">${escapeHtml(d.badge)}</div>
        <p class="diff-card-desc">${escapeHtml(d.subtitle)}</p>
        <div class="diff-mod-table">
          <div class="diff-mod-row"><span>Core HP</span><b>${d.coreMaxHp}</b></div>
          <div class="diff-mod-row"><span>Start Gold</span><b>₽${d.startingGold}</b></div>
          <div class="diff-mod-row"><span>Kill Gold</span>${formatPctModifier(d.bountyMult)}</div>
          <div class="diff-mod-row"><span>Foe HP</span>${formatPctModifier(d.enemyHpMult, true)}</div>
          <div class="diff-mod-row"><span>Foe ATK</span>${formatPctModifier(d.enemyAtkMult, true)}</div>
          <div class="diff-mod-row"><span>Foe SPD</span>${formatPctModifier(d.enemySpeedMult, true)}</div>
        </div>
      </button>
    `;
  }).join('');

  const enemyCardsHtml = Object.values(ENEMY_SPECIES)
    .filter((spec) => firstWaveByEnemy.has(spec.id))
    .sort((a, b) => {
      const wa = firstWaveByEnemy.get(a.id) ?? 999;
      const wb = firstWaveByEnemy.get(b.id) ?? 999;
      return wa - wb || Number(a.id) - Number(b.id);
    })
    .map((spec) => {
      const firstWave = firstWaveByEnemy.get(spec.id)!;
      const isMapBoss = bossEnemyIds.has(spec.id);
      const spriteId = spec.spriteId ?? spec.id;
      const scaledHp = Math.max(
        1,
        Math.round(spec.maxHp * activeDiff.enemyHpMult),
      );
      const scaledAtk = Math.max(
        1,
        Math.round(spec.atk * activeDiff.enemyAtkMult),
      );
      const scaledSpeed = (spec.speed * activeDiff.enemySpeedMult).toFixed(2);
      const scaledBounty = Math.max(
        1,
        Math.round(spec.bounty * activeDiff.bountyMult),
      );
      const moveLabel =
        spec.movementType === 'fly'
          ? 'Flying'
          : spec.movementType === 'burrow'
            ? 'Burrow'
            : 'Ground';
      const waveTag = `<span class="tag enemy-wave-tag">Wave ${firstWave}+</span>`;
      const extraTags: string[] = [
        `<span class="tag move-tag move-${spec.movementType}">${moveLabel}</span>`,
      ];
      if (isMapBoss) {
        extraTags.push(`<span class="tag tag-boss">10-Wave Boss</span>`);
      }
      if ((spec.range ?? 1) > 1) {
        extraTags.push(`<span class="tag">Range ${spec.range}</span>`);
      }
      if (spec.wallDmgMult >= 2) {
        extraTags.push(
          `<span class="tag">${spec.wallDmgMult}× Wall Dmg</span>`,
        );
      }
      if (spec.ignoresUnits) {
        extraTags.push(`<span class="tag tag-warn">Ignores Units</span>`);
      }

      return `
        <div class="enemy-intel-card ${isMapBoss ? 'is-boss-enemy' : ''}">
          <div class="enemy-intel-top">
            <span class="poke-icon-wrap lg enemy-portrait" aria-hidden="true">
              <img src="assets/pokemon/${escapeHtml(spriteId)}/Normal.png" alt="" width="40" height="40" loading="lazy" decoding="async" />
            </span>
            <div class="enemy-intel-title-wrap">
              <div class="enemy-intel-name-row">
                <span class="enemy-intel-name">${escapeHtml(spec.name)}</span>
                ${waveTag}
              </div>
              <div class="enemy-intel-role">${escapeHtml(spec.roleLabel)}</div>
            </div>
          </div>
          <div class="enemy-intel-trait">${escapeHtml(getEnemyThreatSummary(spec))}</div>
          <div class="enemy-intel-tags">${extraTags.join('')}</div>
          <div class="enemy-intel-stats">
            <span>HP <b>${scaledHp}</b></span>
            <span>ATK <b>${scaledAtk}</b></span>
            <span>SPD <b>${scaledSpeed}</b></span>
            <span>Bounty <b>₽${scaledBounty}</b></span>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="menu-backdrop"><img class="menu-backdrop-img" src="assets/ui/menu-bg.jpg" alt="" aria-hidden="true" />
      <div class="modal-card draft-modal difficulty-select-modal btd6-map-select" role="dialog" aria-modal="true" aria-labelledby="modal-title-difficulty" tabindex="-1">
        <div class="btd6-map-topbar">
          <button type="button" class="btn btd6-back-btn" data-action="back-map-select" aria-label="Back to Map Select" title="Back to Map Select">← Maps</button>
          <div class="diff-heading-wrap">
            <div class="modal-title btd6-map-heading" id="modal-title-difficulty">Select Mode &amp; Difficulty</div>
            <div class="card-hint">${escapeHtml(mapSpec?.name ?? snap.selectedMapId)} · ${escapeHtml(mapSpec?.waveTheme.label ?? 'Standard')} · ${activeDiff.maxWaves} Waves</div>
          </div>
          <button type="button" class="btn btn-primary diff-confirm-cta" data-action="confirm-difficulty" data-id="${activeDiff.id}">Draft (${escapeHtml(activeDiff.name)}) →</button>
        </div>
        <div class="diff-cards-grid" role="radiogroup" aria-label="Run Difficulty">
          ${diffCardsHtml}
        </div>
        <div class="enemy-intel-section">
          <div class="enemy-intel-header">
            <span class="enemy-intel-heading">Enemy Intel &amp; Traits (${escapeHtml(activeDiff.name)} Scaling)</span>
            <span class="card-hint">${firstWaveByEnemy.size} active on this map · bosses spawn every 10 waves (3.5× HP, 1.6× ATK, stun-immune)</span>
          </div>
          <div class="enemy-intel-grid">
            ${enemyCardsHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderDraftModal(snap: GameSnapshot, state: ModalState): string {
  const spent = getDraftCost(snap.draftIds);
  const remaining = snap.draftBudget - spent;
  const allSpecies = Object.values(POKEMON_SPECIES);
  const unlockedSet = new Set(snap.unlockedIds);
  const sortedSpecies = [...allSpecies].sort((a, b) => {
    const aUnl = unlockedSet.has(a.id) ? 0 : 1;
    const bUnl = unlockedSet.has(b.id) ? 0 : 1;
    return aUnl - bUnl || Number(a.id) - Number(b.id);
  });
  const filteredSpecies = filterSpeciesByAttributes(sortedSpecies, state);
  const defaultDraftId =
    snap.draftIds[0] ??
    filteredSpecies[0]?.id ??
    Object.keys(POKEMON_SPECIES)[0];
  const inspectedId =
    state.inspectedDraftId && POKEMON_SPECIES[state.inspectedDraftId]
      ? state.inspectedDraftId
      : defaultDraftId;
  const inspectedSp = POKEMON_SPECIES[inspectedId];

  const rosterItems =
    filteredSpecies.length > 0
      ? filteredSpecies
          .map((sp) => {
            const isUnlocked = unlockedSet.has(sp.id);
            const picked = snap.draftIds.includes(sp.id);
            const prog = snap.pokemonProgress?.[sp.id];
            const potential = prog?.potential ?? 0;
            const rarity = getSpeciesRarity(sp.id);
            const canAdd =
              isUnlocked &&
              (picked ||
                (snap.draftIds.length < MAX_ACTIVE_UNITS &&
                  spent + sp.draftCost <= snap.draftBudget));
            const classes = [
              'draft-roster-item',
              'pokedex-card',
              `card-rarity-${rarity.toLowerCase()}`,
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
                data-action="toggle-draft-card"
                data-id="${sp.id}"
                aria-pressed="${picked}"
              >
                <div class="pokedex-card-top">
                  <span class="draft-card-cost">${sp.draftCost}p</span>
                  <span class="pokedex-card-meta ${isUnlocked ? 'is-potential' : 'is-shards'}">${isUnlocked ? `★${potential}` : 'Locked'}</span>
                </div>
                ${renderPokeIcon(sp.id)}
                <span class="draft-roster-name">${escapeHtml(sp.name)}</span>
              </button>
            `;
          })
          .join('')
      : '<div class="card-hint" style="grid-column:1/-1;padding:12px;">No Pokémon match these filters.</div>';

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
  const statusPillClass = !isInspectedUnlocked
    ? 'locked-tag'
    : isPicked
      ? 'picked-tag'
      : canAddInspected
        ? 'ready-tag'
        : 'locked-tag';
  const statusPillLabel = !isInspectedUnlocked
    ? 'Locked'
    : isPicked
      ? '✓ In Team'
      : canAddInspected
        ? 'Click Portrait to Add'
        : snap.draftIds.length >= MAX_ACTIVE_UNITS
          ? 'Team Full'
          : `Need ${needPts} more pt${needPts === 1 ? '' : 's'}`;

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
                <span class="tag ${statusPillClass}">${statusPillLabel}</span>
              </div>
              <div class="type-badge-row">${renderSpeciesTypeBadges(inspectedSp.id)}</div>
            </div>
          </div>
        </div>
        ${!isInspectedUnlocked ? '<div class="card-hint">Recruit in runs or hatch Eggs to collect shards and unlock in Pokédex.</div>' : '<div class="card-hint">Click any unlocked portrait on the left to add or remove.</div>'}
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
          <button type="button" class="btn btn-icon" data-action="back-difficulty-select" title="Back to Difficulty Select" aria-label="Back to Difficulty Select">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          </button>
          <button type="button" class="btn btn-icon" data-action="back-home" title="Home" aria-label="Home">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>
          </button>
          <button type="button" class="btn btn-sm" data-action="open-pokedex" title="Open Pokédex">📖 Pokédex</button>
          <button type="button" class="btn btn-sm" data-action="clear-draft" title="Clear team" ${snap.draftIds.length === 0 ? 'disabled' : ''}>↺ Clear</button>
          <button type="button" class="btn btn-sm btn-primary" data-action="confirm-draft" ${snap.draftIds.length === 0 ? 'disabled' : ''}>▶ Start Game</button>
        </div>
      </div>
      <div class="draft-team-bar">${teamChips}</div>
      ${renderRosterFiltersHtml(state)}
      <div class="draft-body">
        <div class="draft-roster-grid">${rosterItems}</div>
        ${detailHtml}
      </div>
    </div>
  `;
}

function renderRewardModal(snap: GameSnapshot): string {
  const rerollCost = getRewardRerollCost(snap.rewardRerollsUsed, snap.wave);
  const canReroll = snap.gold >= rerollCost;
  const cards = snap.rewardChoices
    .map((choice) => {
      const badge =
        choice.kind === 'evolve'
          ? 'EVOLVE'
          : choice.kind === 'item'
            ? 'GEAR'
            : choice.kind;
      const iconSpeciesId =
        choice.kind === 'evolve' && choice.targetSpeciesId
          ? choice.targetSpeciesId
          : choice.kind === 'recruit' && choice.speciesId
            ? choice.speciesId
            : null;
      const rarity: PokemonRarity | null =
        choice.rarity ??
        (iconSpeciesId && POKEMON_SPECIES[iconSpeciesId]
          ? getSpeciesRarity(iconSpeciesId)
          : null);
      const rarityCardClass = rarity
        ? `card-rarity-${rarity.toLowerCase()}`
        : '';
      const rarityBadgeHtml = rarity
        ? `<span class="tag rarity-tag rarity-${rarity.toLowerCase()}">${escapeHtml(rarity)}</span>`
        : '';
      const iconHtml =
        choice.kind === 'item' && choice.itemId
          ? (HELD_ITEM_ICONS[choice.itemId] ?? '')
          : iconSpeciesId
            ? renderPokeIcon(iconSpeciesId)
            : '';
      return `
        <button type="button" class="reward-card ${rarityCardClass}" data-action="pick-reward" data-id="${escapeHtml(choice.id)}">
          <div class="reward-card-tags">
            <span class="tag">${escapeHtml(badge)}</span>
            ${rarityBadgeHtml}
          </div>
          ${iconHtml}
          <div class="reward-title">${escapeHtml(choice.title)}</div>
          <div class="reward-desc">${escapeHtml(choice.desc)}</div>
        </button>
      `;
    })
    .join('');

  return `
    <div class="modal-card" role="dialog" aria-modal="false" aria-labelledby="modal-title-reward" tabindex="-1">
      <div class="modal-header">
        <div class="modal-title" id="modal-title-reward">Wave Cleared — Choose a Reward</div>
        <button
          type="button"
          class="btn btn-accent"
          data-action="reroll-rewards"
          ${canReroll ? '' : 'disabled'}
        >
          Reroll (₽${rerollCost})
        </button>
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
  const potential = snap.pokemonProgress[unit.speciesId]?.potential ?? 0;
  const baseAtk = computeUnitAtk(
    unit.speciesId,
    snap.upgrades,
    false,
    unit.branchId,
    unit.heldItems,
    potential,
    snap.artifacts,
  );
  const baseDef = computeUnitDef(
    unit.speciesId,
    unit.branchId,
    unit.heldItems,
    snap.upgrades,
    potential,
    undefined,
    snap.artifacts,
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

  const heldHtml = Array.from({ length: MAX_HELD_ITEMS })
    .map((_, idx) => {
      const itemId = unit.heldItems[idx];
      const item = itemId ? HELD_ITEMS[itemId] : null;
      if (!item) return '<div class="held-slot empty">Empty Slot</div>';
      return `
        <div class="held-slot filled" title="${escapeHtml(item.desc)}">
          <span class="held-slot-name">${HELD_ITEM_ICONS[item.id] ?? ''} <strong>${escapeHtml(item.name)}</strong></span>
          ${
            snap.phase === 'PREP' || snap.phase === 'SHOP'
              ? `<button type="button" class="held-remove" data-action="unequip-item" data-unit="${unit.uid}" data-id="${idx}" aria-label="Unequip ${escapeHtml(item.name)}">×</button>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  return `
    <div class="modal-card draft-modal unit-inspector-modal" role="dialog" aria-modal="false" aria-labelledby="modal-title-unit" tabindex="-1">
      <div class="modal-header">
        <div class="unit-name-wrap">
          ${renderPokeIcon(sp.id)}
          <div class="modal-title" id="modal-title-unit">${escapeHtml(sp.name)}</div>
          <span class="tag">${escapeHtml(sp.pokeClass)}</span>
          ${branch ? `<span class="tag branch-tag">${escapeHtml(branch.name)}</span>` : ''}
          ${renderSpeciesTypeBadges(sp.id)}
        </div>
        <button type="button" class="btn btn-xs" data-action="close-expanded-unit" aria-label="Close">✕</button>
      </div>

      <div class="unit-stats-grid unit-stats-grid-5">
        <div class="unit-stat"><span class="unit-stat-lbl">HP</span><span class="unit-stat-val">${Math.ceil(unit.hp)}/${unit.maxHp}</span></div>
        <div class="unit-stat"><span class="unit-stat-lbl">ATK</span><span class="unit-stat-val ${atk > baseAtk ? 'stat-boosted' : ''}" title="Base ${baseAtk} → Live ${atk}">${atk}</span></div>
        <div class="unit-stat"><span class="unit-stat-lbl">DEF</span><span class="unit-stat-val ${def > baseDef ? 'stat-boosted' : ''}" title="Base ${baseDef} → Live ${def}">${def}</span></div>
        <div class="unit-stat"><span class="unit-stat-lbl">RANGE</span><span class="unit-stat-val ${range > baseRange ? 'stat-boosted' : ''}">${range}</span></div>
        <div class="unit-stat"><span class="unit-stat-lbl">ATK/S</span><span class="unit-stat-val ${intervalMs < baseIntervalMs ? 'stat-boosted' : ''}">${atkSpd}</span></div>
      </div>

      <div class="desc-box">
        <div><strong>Passive:</strong> ${escapeHtml(sp.passiveDesc)}</div>
        <div><strong>Basic:</strong> ${escapeHtml(sp.basicDesc)}</div>
        <div><strong>Ult — ${escapeHtml(sp.ultName)}:</strong> ${escapeHtml(sp.ultDesc)} (${Math.floor(unit.ult)}/${unit.ultMax})</div>
      </div>

      <div class="branch-header">
        <span>Specializations</span>
        ${branch ? '' : `<span class="card-hint">${snap.phase === 'PREP' ? 'Choose a path below' : 'Specialize during Prep'}</span>`}
      </div>
      ${renderBranchTree(sp, unit.branchId, snap.upgrades, {
        unitUid: unit.uid,
        canSpecialize: snap.phase === 'PREP',
        gold: snap.gold,
      })}

      <div class="held-box">
        <div class="branch-header">
          <span>Held Items</span>
          <span class="card-hint">${unit.heldItems.length} / ${MAX_HELD_ITEMS}</span>
        </div>
        <div class="held-slots held-slots-3col">${heldHtml}</div>
      </div>

      <div class="unit-modal-footer">
        ${renderTargetPriorityControl(unit)}
        ${
          snap.phase === 'PREP'
            ? `<button type="button" class="btn btn-danger btn-xs" data-action="release-unit" data-id="${unit.uid}" ${snap.activeUnits.length > 1 ? '' : 'disabled'}>Release (+₽${getPokemonReleaseRefund(unit.speciesId, unit.branchId)})</button>`
            : ''
        }
      </div>
    </div>
  `;
}

function renderShopModal(snap: GameSnapshot): string {
  const items =
    snap.shopOfferItemIds.length > 0
      ? snap.shopOfferItemIds
          .map((id) => HELD_ITEMS[id])
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : Object.values(HELD_ITEMS).slice(0, 6);
  const itemRows = items
    .map((item) => {
      const owned = snap.heldItemInventory.filter(
        (id) => id === item.id,
      ).length;
      const soldOut = snap.shopPurchasedItemIds.includes(item.id);
      const canBuy = !soldOut && snap.gold >= item.cost;
      const rarityTag = item.rarity
        ? ` <span class="tag rarity-tag rarity-${item.rarity.toLowerCase()}">${escapeHtml(item.rarity)}</span>`
        : '';
      return `
        <div class="shop-modal-item">
          <div class="shop-modal-item-head">
            <span class="shop-modal-item-icon">${HELD_ITEM_ICONS[item.id] ?? ''}</span>
            <div class="shop-modal-item-meta">
              <strong>${escapeHtml(item.name)}${rarityTag}${owned > 0 ? ` <span class="tag">${owned} in bag</span>` : ''}</strong>
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
            ${soldOut ? 'Sold Out' : `Buy ₽${item.cost}`}
          </button>
        </div>
      `;
    })
    .join('');

  const healCost = getHealCost(snap.wave);
  const reviveCost = getReviveCost(snap.wave);
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
            <button type="button" class="btn btn-primary btn-xs" data-action="revive-unit" data-id="${u.uid}" ${snap.gold >= reviveCost ? '' : 'disabled'}>Revive ₽${reviveCost}</button>
          </div>
        `;
      }
      return `
        <div class="shop-care-chip">
          ${renderPokeIcon(u.speciesId)}
          <span>${escapeHtml(name)} (${Math.ceil(u.hp)}/${u.maxHp})</span>
          <button type="button" class="btn btn-accent btn-xs" data-action="heal-unit" data-id="${u.uid}" ${snap.gold >= healCost ? '' : 'disabled'}>Heal ₽${healCost}</button>
        </div>
      `;
    })
    .join('');

  const rareCandyRows = snap.activeUnits
    .flatMap((u) => {
      const targets = getEvolutionTargets(u.speciesId);
      const fromName = POKEMON_SPECIES[u.speciesId]?.name ?? u.speciesId;
      return targets.map((targetId) => {
        const toName = POKEMON_SPECIES[targetId]?.name ?? targetId;
        return `
          <div class="shop-care-chip">
            ${renderPokeIcon(u.speciesId)}
            <span>${escapeHtml(fromName)} → ${escapeHtml(toName)}</span>
            <button
              type="button"
              class="btn btn-primary btn-xs"
              data-action="buy-rare-candy"
              data-unit="${u.uid}"
              data-id="${targetId}"
              ${snap.gold >= RARE_CANDY_COST ? '' : 'disabled'}
            >
              Rare Candy ₽${RARE_CANDY_COST}
            </button>
          </div>
        `;
      });
    })
    .join('');

  return `
    <div class="modal-card compact" role="dialog" aria-modal="false" aria-labelledby="modal-title-shop" tabindex="-1">
      <div class="modal-header">
        <div>
          <div class="modal-title" id="modal-title-shop">Wave ${snap.wave} Merchant Shop</div>
          <div class="modal-sub">Stock up on Held Items and heal your team before Wave ${snap.wave + 1}.</div>
        </div>
        <span class="stat-pill"><span class="stat-label">Gold</span><span class="stat-val gold">₽${snap.gold}</span></span>
      </div>
      <div class="shop-modal-grid">${itemRows}</div>
      ${
        rareCandyRows
          ? `<div class="shop-care-section">
              <div class="section-header"><span>Rare Candy (Evolution)</span><span>₽${RARE_CANDY_COST}</span></div>
              <div class="shop-care-list">${rareCandyRows}</div>
            </div>`
          : ''
      }
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
  `;
}

function renderTypeChartModal(snap: GameSnapshot | null): string {
  const isHome = !snap || snap.phase === 'HOME';
  const headerCells = POKEMON_ELEMENT_TYPES.map((defType) => {
    const abbr = defType.slice(0, 3).toUpperCase();
    const color = TYPE_COLORS[defType];
    return `<th scope="col" title="${escapeHtml(defType)}"><span class="type-abbr" style="--type-color:${color}">${abbr}</span></th>`;
  }).join('');

  const rows = POKEMON_ELEMENT_TYPES.map((atkType) => {
    const cells = POKEMON_ELEMENT_TYPES.map((defType) => {
      const raw = TYPE_CHART[atkType]?.[defType] ?? 1;
      if (raw === 2) {
        return `<td class="eff-cell eff-super" title="${escapeHtml(atkType)} → ${escapeHtml(defType)}: 1.5× (2.0× if 4×)">1.5×</td>`;
      }
      if (raw === 0.5) {
        return `<td class="eff-cell eff-resist" title="${escapeHtml(atkType)} → ${escapeHtml(defType)}: 0.5×">0.5×</td>`;
      }
      if (raw === 0) {
        return `<td class="eff-cell eff-immune" title="${escapeHtml(atkType)} → ${escapeHtml(defType)}: 0.35× (Immunity)">0.35×</td>`;
      }
      return `<td class="eff-cell eff-neutral" title="${escapeHtml(atkType)} → ${escapeHtml(defType)}: 1.0×">·</td>`;
    }).join('');
    return `<tr><th scope="row">${renderTypeBadge(atkType)}</th>${cells}</tr>`;
  }).join('');

  const cardHtml = `
      <div class="modal-card type-chart-modal" role="dialog" aria-modal="${isHome ? 'true' : 'false'}" aria-labelledby="modal-title-type-chart" tabindex="-1">
        <div class="modal-header">
          <div>
            <div class="modal-title" id="modal-title-type-chart">Elemental Type Chart</div>
            <div class="card-hint">Applies to both unit attacks and enemy attacks. Dual-type defenders combine multipliers.</div>
          </div>
          <button type="button" class="btn btn-icon" data-action="close-type-chart" aria-label="Close Type Chart" title="Close">✕</button>
        </div>
        <div class="type-chart-legend">
          <span class="legend-item eff-extremely"><strong>2.0×</strong> Double Super (4×)</span>
          <span class="legend-item eff-super"><strong>1.5×</strong> Super Effective (2×)</span>
          <span class="legend-item eff-neutral"><strong>1.0×</strong> Neutral</span>
          <span class="legend-item eff-resist"><strong>0.5×</strong> Not Very Effective</span>
          <span class="legend-item eff-immune"><strong>0.35×</strong> Double Resist / Immunity</span>
        </div>
        <div class="type-chart-scroll">
          <table class="type-chart-table">
            <thead>
              <tr>
                <th scope="col" class="type-chart-corner">ATK \\ DEF</th>
                ${headerCells}
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
  `;
  return isHome
    ? `<div class="menu-backdrop"><img class="menu-backdrop-img" src="assets/ui/menu-bg.jpg" alt="" aria-hidden="true" />${cardHtml}</div>`
    : cardHtml;
}

export type ModalLayoutMode = 'fullscreen' | 'docked';

export function renderModalHtml(
  snap: GameSnapshot | null,
  state: ModalState,
): {
  html: string;
  invalidExpandedUnit?: boolean;
  layoutMode?: ModalLayoutMode;
} {
  const inGameMode: ModalLayoutMode =
    snap !== null && snap.phase !== 'HOME' ? 'docked' : 'fullscreen';
  if (state.hatchResult) {
    return {
      html: renderEggHatchRevealModal(snap, state.hatchResult, state.hatchSeq),
      layoutMode: inGameMode,
    };
  }
  if (state.typeChartOpen) {
    return { html: renderTypeChartModal(snap), layoutMode: inGameMode };
  }
  if (state.showCredits) {
    return { html: renderCreditsModal(snap), layoutMode: inGameMode };
  }
  if (state.showPokedex) {
    return { html: renderPokedexModal(snap, state), layoutMode: 'fullscreen' };
  }
  if (state.showEggs) {
    return { html: renderEggsModal(snap, state), layoutMode: 'fullscreen' };
  }
  if (!snap) {
    return { html: '' };
  }
  if (snap.phase === 'HOME') {
    return { html: renderHomeModal(snap), layoutMode: 'fullscreen' };
  }
  if (snap.phase === 'MAP_SELECT') {
    return {
      html: renderMapSelectModal(snap, state.mapDifficultyFilter),
      layoutMode: 'fullscreen',
    };
  }
  if (snap.phase === 'DIFFICULTY_SELECT') {
    return {
      html: renderDifficultySelectModal(snap, state.selectedDifficultyPreview),
      layoutMode: 'fullscreen',
    };
  }
  if (snap.phase === 'DRAFT') {
    return { html: renderDraftModal(snap, state), layoutMode: 'fullscreen' };
  }
  if (snap.phase === 'REWARD') {
    return { html: renderRewardModal(snap), layoutMode: 'docked' };
  }
  if (snap.phase === 'SHOP') {
    return { html: renderShopModal(snap), layoutMode: 'docked' };
  }
  if (snap.phase === 'VICTORY' || snap.phase === 'DEFEAT') {
    return { html: renderEndgameModal(snap), layoutMode: 'fullscreen' };
  }
  if (state.expandedUnitUid) {
    const html = renderExpandedUnitModal(snap, state.expandedUnitUid);
    if (!html) {
      return { html: '', invalidExpandedUnit: true };
    }
    return { html, layoutMode: 'docked' };
  }
  return { html: '' };
}
