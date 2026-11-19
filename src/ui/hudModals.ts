import { MAP_CATALOG, createGridForMap } from '../data/maps';
import { HELD_ITEMS, POKEMON_SPECIES } from '../data/pokemon';
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
import {
  EggHatchResult,
  EggTier,
  GameSnapshot,
  MapDifficulty,
  PokemonClass,
  PokemonRarity,
  PokemonSpecies,
} from '../types';
import {
  HELD_ITEM_ICONS,
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
} from './hudShared';

export interface ModalState {
  showCredits: boolean;
  showPokedex: boolean;
  showEggs: boolean;
  showHatchRates: boolean;
  hatchResult: EggHatchResult | null;
  hatchSeq: number;
  pokedexFilter: 'all' | 'unlocked' | 'locked';
  rosterClassFilter: 'All' | PokemonClass;
  rosterRarityFilter: 'All' | PokemonRarity;
  rosterCostFilter: 'All' | '1' | '2' | '3' | '4' | '5+';
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
    <div class="potential-tiers-box">
      <div class="potential-tiers-title">Potential Tiers (★1–★5)</div>
      <div class="potential-tiers-list">${rows}</div>
    </div>
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
              shards + universalShards >= nextUpgradeCost &&
              shards >= nextUpgradeCost;
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
              >
                <div class="pokedex-card-top">
                  <span class="pokedex-rarity-tag rarity-${rarity.toLowerCase()}">${escapeHtml(rarity)}</span>
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
    <div class="menu-backdrop">
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

  return `
    <div class="menu-backdrop">
      <div class="modal-card compact hatch-reveal-modal ${rarityClass}" data-hatch-seq="${hatchSeq}" role="dialog" aria-modal="true" aria-labelledby="modal-title-hatch-reveal" tabindex="-1">
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
    </div>
  `;
}

function renderHomeModal(snap: GameSnapshot): string {
  const unlockedCount = snap.unlockedIds.length;
  const totalCount = Object.keys(POKEMON_SPECIES).length;
  const totalEggs =
    (snap.eggs?.common ?? 0) +
    (snap.eggs?.rare ?? 0) +
    (snap.eggs?.master ?? 0);
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
          <button type="button" class="btn home-btn" data-action="open-eggs">Eggs (${totalEggs})</button>
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
          <button type="button" class="btn btn-icon" data-action="back-map-select" title="Change Map" aria-label="Maps">🗺</button>
          <button type="button" class="btn btn-icon" data-action="back-home" title="Home" aria-label="Home">⌂</button>
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
  if (state.hatchResult) {
    return {
      html: renderEggHatchRevealModal(snap, state.hatchResult, state.hatchSeq),
    };
  }
  if (state.showCredits) {
    return { html: renderCreditsModal() };
  }
  if (state.showPokedex) {
    return { html: renderPokedexModal(snap, state) };
  }
  if (state.showEggs) {
    return { html: renderEggsModal(snap, state) };
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
    return { html: renderDraftModal(snap, state) };
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
