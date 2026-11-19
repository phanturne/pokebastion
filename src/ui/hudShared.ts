import { CLASS_MINOR_UPGRADES } from '../data/classes';
import { POKEMON_SPECIES, REWARD_POOL } from '../data/pokemon';
import { doesMinorUpgradeMatchSpecies } from '../engine/rules';
import {
  PokemonBranch,
  PokemonSpecies,
  RewardOption,
  StructureKind,
} from '../types';

export type ToolId = StructureKind | 'sell_struct';

export const SVG_PAUSE =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M3.5 2.5h3v11h-3v-11zm6 0h3v11h-3v-11z"/></svg>';
export const SVG_PLAY =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2.5l9 5.5-9 5.5V2.5z"/></svg>';
export const SVG_SOUND_ON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 5.5h3l3.5-3v11L5 10.5H2v-5zm8.2-.2a4 4 0 0 1 0 5.4l-1-1a2.6 2.6 0 0 0 0-3.4l1-1zm2-2a6.6 6.6 0 0 1 0 9.4l-1-1a5.2 5.2 0 0 0 0-7.4l1-1z"/></svg>';
export const SVG_SOUND_OFF =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 5.5h3l3.5-3v11L5 10.5H2v-5zm8.3.4l1.4 1.4 1.4-1.4 1 1-1.4 1.4 1.4 1.4-1 1-1.4-1.4-1.4 1.4-1-1 1.4-1.4-1.4-1.4 1-1z"/></svg>';
export const SVG_SHAKE_ON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 2.5h6v11H5v-11zm1.5 1.5v8h3V4h-3zM2.8 5.2l-1.5 1.5L2.8 8.2 1.3 9.7l1.5 1.5.9-.9-.6-.6 1.5-1.5-1.5-1.5.6-.6-.9-.9zm10.4 0l-.9.9.6.6-1.5 1.5 1.5 1.5-.6.6.9.9 1.5-1.5-1.5-1.5 1.5-1.5-1.5-1.5z"/></svg>';
export const SVG_SHAKE_OFF =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 2.5h6v11H5v-11zm1.5 1.5v8h3V4h-3zM2.3 2.3l11.4 11.4-1 1L1.3 3.3l1-1z"/></svg>';

export const TOOL_SHORT_NAME: Record<ToolId, string> = {
  wood_wall: 'Barricade',
  stone_wall: 'Stone Wall',
  berry_bush: 'Berry Bush',
  barrel: 'Bomb Barrel',
  sell_struct: 'Sell',
};

export const TOOL_ICONS: Record<ToolId, string> = {
  wood_wall: `<img src="assets/structures/wood_wall.png" width="20" height="20" style="image-rendering:pixelated" alt="" />`,
  stone_wall: `<img src="assets/structures/stone_wall.png" width="20" height="20" style="image-rendering:pixelated" alt="" />`,
  berry_bush: `<img src="assets/structures/berry_bush.png" width="20" height="20" style="image-rendering:pixelated" alt="" />`,
  barrel: `<img src="assets/structures/barrel.png" width="20" height="20" style="image-rendering:pixelated" alt="" />`,
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

export const REWARD_BY_ID: Record<string, RewardOption> = Object.fromEntries(
  REWARD_POOL.map((r) => [r.id, r]),
);

export const HELD_ITEM_ICONS: Record<string, string> = {
  bloodthirsty_edge: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="10" y="2" width="4" height="4" fill="#f85149"/>
    <rect x="8" y="4" width="4" height="4" fill="#ff7b72"/>
    <rect x="6" y="6" width="4" height="4" fill="#e6edf3"/>
    <rect x="4" y="8" width="4" height="4" fill="#8b949e"/>
    <rect x="2" y="11" width="3" height="3" fill="#d29922"/>
  </svg>`,
  storm_conductor: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="8" y="1" width="4" height="3" fill="#f7cc45"/>
    <rect x="6" y="4" width="4" height="3" fill="#fde047"/>
    <rect x="4" y="7" width="8" height="2" fill="#f7cc45"/>
    <rect x="6" y="9" width="4" height="3" fill="#58a6ff"/>
    <rect x="4" y="12" width="4" height="3" fill="#38bdf8"/>
  </svg>`,
  guardian_charm: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="4" y="2" width="8" height="2" fill="#58a6ff"/>
    <rect x="3" y="4" width="10" height="5" fill="#38bdf8"/>
    <rect x="4" y="9" width="8" height="3" fill="#58a6ff"/>
    <rect x="6" y="12" width="4" height="2" fill="#d29922"/>
    <rect x="6" y="5" width="4" height="4" fill="#f7cc45"/>
  </svg>`,
};

export const RELIC_ICONS: Record<string, string> = {
  sharp_claws: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="2" width="2" height="9" fill="#f85149"/><rect x="7" y="2" width="2" height="11" fill="#ff7b72"/><rect x="11" y="2" width="2" height="9" fill="#f85149"/><rect x="3" y="12" width="10" height="2" fill="#8b949e"/></svg>`,
  quick_charge: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="7" y="2" width="3" height="5" fill="#f7cc45"/><rect x="5" y="7" width="6" height="2" fill="#fde047"/><rect x="6" y="9" width="3" height="5" fill="#f7cc45"/></svg>`,
  thick_hide: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="3" width="10" height="7" fill="#3fb950"/><rect x="5" y="10" width="6" height="3" fill="#2ea043"/><rect x="6" y="5" width="4" height="4" fill="#a7f3d0"/></svg>`,
  fortification_core: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="3" y="3" width="10" height="10" fill="#8b949e"/><rect x="5" y="5" width="6" height="6" fill="#d29922"/></svg>`,
  temporal_gear: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="5" y="2" width="6" height="12" fill="#bc8cff"/><rect x="2" y="5" width="12" height="6" fill="#bc8cff"/><rect x="6" y="6" width="4" height="4" fill="#0d1117"/></svg>`,
  arcane_conduit: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="6" y="2" width="4" height="12" fill="#58a6ff"/><rect x="4" y="5" width="8" height="6" fill="#bc8cff"/><rect x="7" y="6" width="2" height="4" fill="#e6edf3"/></svg>`,
  commanders_insignia: `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="7" y="2" width="2" height="12" fill="#f7cc45"/><rect x="4" y="5" width="8" height="6" fill="#d29922"/><rect x="6" y="6" width="4" height="4" fill="#fde047"/></svg>`,
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function pct(cur: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (cur / max) * 100));
}

export function renderPokeIcon(
  speciesId: string,
  size: 'sm' | 'lg' = 'sm',
): string {
  const px = size === 'lg' ? 40 : 28;
  const cls = size === 'lg' ? 'poke-icon-wrap lg' : 'poke-icon-wrap';
  return `
    <span class="${cls}" aria-hidden="true">
      <img src="assets/pokemon/${escapeHtml(speciesId)}/Normal.png" alt="" width="${px}" height="${px}" loading="lazy" decoding="async" />
    </span>
  `;
}

interface SnowflakeAxis {
  label: string;
  getValue: (s: PokemonSpecies) => number;
  format: (v: number) => string;
}

const SNOWFLAKE_AXES: SnowflakeAxis[] = [
  { label: 'HP', getValue: (s) => s.maxHp, format: (v) => `${Math.round(v)}` },
  { label: 'ATK', getValue: (s) => s.atk, format: (v) => `${Math.round(v)}` },
  {
    label: 'SPD',
    getValue: (s) => (s.attackIntervalMs > 0 ? 1000 / s.attackIntervalMs : 0),
    format: (v) => `${v.toFixed(2)}/s`,
  },
  {
    label: 'MOV',
    getValue: (s) => s.moveRange,
    format: (v) => `${v}`,
  },
  { label: 'RNG', getValue: (s) => s.range, format: (v) => `${v}` },
  { label: 'DEF', getValue: (s) => s.def, format: (v) => `${Math.round(v)}` },
];

const SNOWFLAKE_CX = 170;
const SNOWFLAKE_CY = 135;
const SNOWFLAKE_R_MAX = 80;

const pt = (r: number, angle: number): [number, number] => [
  SNOWFLAKE_CX + r * Math.cos(angle),
  SNOWFLAKE_CY + r * Math.sin(angle),
];

const ALL_SPECIES = Object.values(POKEMON_SPECIES);
const SNOWFLAKE_BOUNDS = SNOWFLAKE_AXES.map((ax) => {
  let min = Infinity;
  let max = -Infinity;
  for (const s of ALL_SPECIES) {
    const v = ax.getValue(s);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
});

const SNOWFLAKE_GRID_SVG =
  [0.25, 0.5, 0.75, 1.0]
    .map((frac) => {
      const pts = SNOWFLAKE_AXES.map((_, i) => {
        const [x, y] = pt(
          SNOWFLAKE_R_MAX * frac,
          -Math.PI / 2 + (i * Math.PI) / 3,
        );
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return `<polygon points="${pts}" fill="none" stroke="#30363d" stroke-width="1" />`;
    })
    .join('') +
  SNOWFLAKE_AXES.map((_, i) => {
    const [x, y] = pt(SNOWFLAKE_R_MAX, -Math.PI / 2 + (i * Math.PI) / 3);
    return `<line x1="${SNOWFLAKE_CX}" y1="${SNOWFLAKE_CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#30363d" stroke-width="1" />`;
  }).join('');

export function renderDraftSnowflake(sp: PokemonSpecies): string {
  const normalize = (val: number, min: number, max: number): number =>
    max <= min ? 0.625 : 0.25 + 0.75 * ((val - min) / (max - min));

  const spPoints: string[] = [];
  const spDots: string[] = [];
  const labels: string[] = [];

  SNOWFLAKE_AXES.forEach((ax, i) => {
    const { min, max } = SNOWFLAKE_BOUNDS[i];
    const raw = ax.getValue(sp);

    const angle = -Math.PI / 2 + (i * Math.PI) / 3;
    const cos = Math.cos(angle);

    const [spX, spY] = pt(SNOWFLAKE_R_MAX * normalize(raw, min, max), angle);
    spPoints.push(`${spX.toFixed(1)},${spY.toFixed(1)}`);
    spDots.push(
      `<circle cx="${spX.toFixed(1)}" cy="${spY.toFixed(1)}" r="3.2" fill="${escapeHtml(sp.color)}" stroke="#0d1117" stroke-width="1" />`,
    );

    const [lx, ly] = pt(SNOWFLAKE_R_MAX + 22, angle);
    const anchor = Math.abs(cos) < 0.1 ? 'middle' : cos > 0 ? 'start' : 'end';
    const labelY = i === 0 ? ly - 12 : i === 3 ? ly - 1 : ly - 4;
    const valY = i === 0 ? ly + 4 : i === 3 ? ly + 15 : ly + 12;

    labels.push(
      `<text x="${lx.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}" fill="#8b949e" font-size="11" font-weight="700">${ax.label}</text>`,
      `<text x="${lx.toFixed(1)}" y="${valY.toFixed(1)}" text-anchor="${anchor}" fill="#e6edf3" font-size="13" font-weight="700">${escapeHtml(ax.format(raw))}</text>`,
    );
  });

  const color = escapeHtml(sp.color);
  return `
    <div class="snowflake-wrap">
      <svg class="snowflake-svg" viewBox="0 0 340 270" role="img" aria-label="${escapeHtml(sp.name)} stat comparison radar">
        ${SNOWFLAKE_GRID_SVG}
        <polygon points="${spPoints.join(' ')}" fill="${color}" fill-opacity="0.24" stroke="${color}" stroke-width="2" />
        ${spDots.join('')}
        ${labels.join('')}
      </svg>
    </div>
  `;
}

const SPECIAL_LABELS: Record<NonNullable<PokemonBranch['special']>, string> = {
  burn_spread: 'Burn Spread',
  chain_hit: 'Chain Hit',
  lifesteal: 'Lifesteal',
  slow_hit: 'Slow Hit',
  thorns: 'Thorns',
  crit_boost: 'Crit Boost',
};

export function formatBranchChips(b: PokemonBranch): string {
  const chips: string[] = [];
  if (b.atkMult) chips.push(`+${Math.round((b.atkMult - 1) * 100)}% ATK`);
  if (b.hpMult) chips.push(`+${Math.round((b.hpMult - 1) * 100)}% HP`);
  if (b.defBonus) chips.push(`+${b.defBonus} DEF`);
  if (b.rangeBonus) chips.push(`+${b.rangeBonus} RNG`);
  if (b.attackIntervalMult) {
    chips.push(`+${Math.round((1 / b.attackIntervalMult - 1) * 100)}% SPD`);
  }
  if (b.moveRangeBonus) chips.push(`+${b.moveRangeBonus} MOV`);
  if (b.ultMult) chips.push(`+${Math.round((b.ultMult - 1) * 100)}% ULT`);
  if (b.special) chips.push(SPECIAL_LABELS[b.special]);
  return chips
    .map((c) => `<span class="branch-chip">${escapeHtml(c)}</span>`)
    .join('');
}

export function renderBranchTree(
  sp: PokemonSpecies,
  activeBranchId: string | null,
  activeUpgrades: string[],
): string {
  const pathsHtml = sp.branches
    .map((b, idx) => {
      const chosen = activeBranchId === b.id;
      const locked = Boolean(activeBranchId && !chosen);
      const stateBadge = chosen
        ? '<span class="tag branch-tag">Active</span>'
        : locked
          ? '<span class="tag locked-tag">Locked</span>'
          : `<span class="tag">Path ${idx + 1}</span>`;
      return `
        <div class="expanded-branch-card ${chosen ? 'chosen' : ''} ${locked ? 'locked' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            <strong>${escapeHtml(b.name)}</strong>
            ${stateBadge}
          </div>
          <div class="branch-chip-row">${formatBranchChips(b)}</div>
          <span>${escapeHtml(b.desc)}</span>
        </div>
      `;
    })
    .join('');

  const matchingMinor = CLASS_MINOR_UPGRADES.filter((u) =>
    doesMinorUpgradeMatchSpecies(u, sp),
  );
  const minorHtml = matchingMinor
    .map((u) => {
      const owned = activeUpgrades.includes(u.id);
      return `
        <div class="minor-pool-item ${owned ? 'owned' : ''}" title="${escapeHtml(u.desc)}">
          <span class="minor-pool-name">${escapeHtml(u.title)}</span>
          <span class="tag ${owned ? 'starter-tag' : ''}">${owned ? 'Active' : 'Random Pool'}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="expanded-branches-grid">${pathsHtml}</div>
    <div class="minor-pool-box">
      <div class="branch-header">
        <span>${escapeHtml(sp.pokeClass)}${sp.subclass ? ` · ${escapeHtml(sp.subclass)}` : ''} Minor Upgrades</span>
        <span class="card-hint">Randomly offered between waves</span>
      </div>
      <div class="minor-pool-grid">${minorHtml}</div>
    </div>
  `;
}
