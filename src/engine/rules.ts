import { CLASS_MINOR_UPGRADES, CLASS_MINOR_UPGRADE_MAP } from '../data/classes';
import {
  HELD_ITEMS,
  POKEMON_SPECIES,
  REWARD_POOL,
  STRUCTURE_SPECS,
} from '../data/pokemon';
import {
  EnemySpecies,
  GamePhase,
  MinorUpgradeSpec,
  PokemonBranch,
  PokemonRarity,
  PokemonSpecies,
  RewardOption,
  StructureKind,
} from '../types';

export const HEAL_COST = 15;
export const REVIVE_COST = 35;
export const RARE_CANDY_COST = 65;
export const SELL_REFUND_RATE = 0.7;
export const REPAIR_COST_RATE = 0.5;
export const BASE_AP_KILL_THRESHOLD = 6;
export const TEMPORAL_GEAR_KILL_THRESHOLD = 4;
export const WAVE_AP_RECOVERY = 3;
export const DRAFT_BUDGET = 10;
export const MAX_ACTIVE_UNITS = 6;
export const MAX_RESERVE_UNITS = 3;
export const MAX_HELD_ITEMS = 3;

const WATER_SPECIES_IDS = new Set([
  '0007',
  '0008',
  '0009',
  '0054',
  '0055',
  '0060',
  '0061',
  '0062',
  '0072',
  '0073',
  '0079',
  '0080',
  '0086',
  '0087',
  '0090',
  '0091',
  '0098',
  '0099',
  '0116',
  '0117',
  '0118',
  '0119',
  '0120',
  '0121',
  '0129',
  '0130',
  '0131',
  '0134',
  '0138',
  '0139',
  '0140',
  '0141',
]);

/** Returns true if a Pokémon species can be placed on and move through water tiles. */
export function isWaterSpecies(
  speciesId: string,
  spec?: Pick<PokemonSpecies, 'canEnterWater'>,
): boolean {
  return spec?.canEnterWater ?? WATER_SPECIES_IDS.has(speciesId);
}

const FLYING_SPECIES_IDS = new Set([
  '0006',
  '0012',
  '0016',
  '0017',
  '0018',
  '0021',
  '0022',
  '0041',
  '0042',
  '0083',
  '0084',
  '0085',
  '0123',
  '0130',
  '0142',
  '0144',
  '0145',
  '0146',
  '0149',
]);

/** Returns true if a Pokémon species is a flying unit that blocks enemy flyers. */
export function isFlyingSpecies(
  speciesId: string,
  spec?: Pick<PokemonSpecies, 'canFly'>,
): boolean {
  return spec?.canFly ?? FLYING_SPECIES_IDS.has(speciesId);
}

/** Returns true if a Pokémon species can be placed on and move over water tiles (Water or Flying). */
export function canUnitEnterWater(
  speciesId: string,
  spec?: Pick<PokemonSpecies, 'canEnterWater' | 'canFly'>,
): boolean {
  return isWaterSpecies(speciesId, spec) || isFlyingSpecies(speciesId, spec);
}

/** Returns true if a Merchant Shop event triggers after completing `wave`. */
export function isShopAfterWave(wave: number, maxWaves: number): boolean {
  return wave > 0 && wave < maxWaves && wave % 5 === 0;
}

export function getDraftCost(speciesIds: string[]): number {
  return speciesIds.reduce(
    (sum, id) => sum + (POKEMON_SPECIES[id]?.draftCost ?? 0),
    0,
  );
}

export function canDraftSpecies(
  currentIds: string[],
  speciesId: string,
  budget = DRAFT_BUDGET,
  maxUnits = MAX_ACTIVE_UNITS,
): boolean {
  const sp = POKEMON_SPECIES[speciesId];
  if (!sp) return false;
  if (currentIds.includes(speciesId)) return false;
  if (currentIds.length >= maxUnits) return false;
  return getDraftCost(currentIds) + sp.draftCost <= budget;
}

export function getBranchSpec(
  speciesId: string,
  branchId: string | null,
): PokemonBranch | undefined {
  if (!branchId) return undefined;
  return POKEMON_SPECIES[speciesId]?.branches.find((b) => b.id === branchId);
}

export function chebyshevDist(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function doesMinorUpgradeMatchSpecies(
  upgrade: MinorUpgradeSpec,
  species: Pick<PokemonSpecies, 'pokeClass' | 'secondaryClass' | 'subclass'>,
): boolean {
  const matchesClass =
    species.pokeClass === upgrade.targetClass ||
    species.secondaryClass === upgrade.targetClass;
  if (!matchesClass) return false;
  if (upgrade.targetSubclass && species.subclass !== upgrade.targetSubclass) {
    return false;
  }
  return true;
}

export function getEligibleMinorUpgrades(
  species: Pick<PokemonSpecies, 'pokeClass' | 'secondaryClass' | 'subclass'>,
  ownedUpgradeIds: readonly string[] | ReadonlySet<string> = [],
): MinorUpgradeSpec[] {
  const owned =
    ownedUpgradeIds instanceof Set ? ownedUpgradeIds : new Set(ownedUpgradeIds);
  return CLASS_MINOR_UPGRADES.filter(
    (u) => !owned.has(u.id) && doesMinorUpgradeMatchSpecies(u, species),
  );
}

export function getMatchingMinorUpgrades(
  speciesId: string,
  upgrades: string[],
): MinorUpgradeSpec[] {
  const sp = POKEMON_SPECIES[speciesId];
  if (!sp || upgrades.length === 0) return [];
  const matched: MinorUpgradeSpec[] = [];
  for (const id of upgrades) {
    const spec = CLASS_MINOR_UPGRADE_MAP[id];
    if (spec && doesMinorUpgradeMatchSpecies(spec, sp)) {
      matched.push(spec);
    }
  }
  return matched;
}

/**
 * Returns the AP cost to move from (fromX, fromY) to (toX, toY), or null if same tile.
 * During PREP phase, any reachable tile costs 0 AP;
 * during COMBAT, moving to any valid tile costs 1 AP.
 */
export function getMovementCost(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  _moveRange: number,
  phase: GamePhase,
): number | null {
  if (fromX === toX && fromY === toY) return null;
  if (phase === 'PREP') return 0;
  return 1;
}

type StatModifiers = {
  hpMult?: number;
  atkMult?: number;
  defBonus?: number;
  rangeBonus?: number;
  attackIntervalMult?: number;
};

function applyStatModifiers(
  speciesId: string,
  branchId: string | null,
  heldItems: string[],
  upgrades: string[],
  initial: number,
  mode: 'mult' | 'add',
  pick: (m: StatModifiers) => number | undefined,
): number {
  let acc = initial;
  const step = (val: number | undefined): void => {
    if (val === undefined) return;
    acc = mode === 'mult' ? acc * val : acc + val;
  };
  const branch = getBranchSpec(speciesId, branchId);
  if (branch) step(pick(branch));
  for (const itemId of heldItems) {
    const item = HELD_ITEMS[itemId];
    if (item) step(pick(item));
  }
  for (const u of getMatchingMinorUpgrades(speciesId, upgrades)) {
    step(pick(u));
  }
  return acc;
}

export function getEffectiveMaxHp(
  speciesId: string,
  upgrades: string[],
  branchId: string | null = null,
  heldItems: string[] = [],
): number {
  const base = POKEMON_SPECIES[speciesId]?.maxHp ?? 100;
  const initMult = upgrades.includes('thick_hide') ? 1.3 : 1;
  return Math.round(
    base *
      applyStatModifiers(
        speciesId,
        branchId,
        heldItems,
        upgrades,
        initMult,
        'mult',
        (m) => m.hpMult,
      ),
  );
}

export function getEffectiveAtk(
  speciesId: string,
  upgrades: string[],
  hasBulbasaurAura = false,
  branchId: string | null = null,
  heldItems: string[] = [],
): number {
  const base = POKEMON_SPECIES[speciesId]?.atk ?? 20;
  let initMult = 1;
  if (upgrades.includes('sharp_claws')) initMult += 0.25;
  if (hasBulbasaurAura) initMult += 0.1;
  return Math.round(
    base *
      applyStatModifiers(
        speciesId,
        branchId,
        heldItems,
        upgrades,
        initMult,
        'mult',
        (m) => m.atkMult,
      ),
  );
}

export function getEffectiveDef(
  speciesId: string,
  branchId: string | null = null,
  heldItems: string[] = [],
  upgrades: string[] = [],
): number {
  const base = POKEMON_SPECIES[speciesId]?.def ?? 0;
  return applyStatModifiers(
    speciesId,
    branchId,
    heldItems,
    upgrades,
    base,
    'add',
    (m) => m.defBonus,
  );
}

export function getEffectiveRange(
  speciesId: string,
  branchId: string | null = null,
  upgrades: string[] = [],
): number {
  const base = POKEMON_SPECIES[speciesId]?.range ?? 1;
  return applyStatModifiers(
    speciesId,
    branchId,
    [],
    upgrades,
    base,
    'add',
    (m) => m.rangeBonus,
  );
}

export function getEffectiveAttackIntervalMs(
  speciesId: string,
  artifacts: string[],
  branchId: string | null = null,
  heldItems: string[] = [],
  upgrades: string[] = [],
): number {
  const base = POKEMON_SPECIES[speciesId]?.attackIntervalMs ?? 1000;
  const initMult = artifacts.includes('arcane_conduit') ? 0.83 : 1;
  return Math.round(
    base *
      applyStatModifiers(
        speciesId,
        branchId,
        heldItems,
        upgrades,
        initMult,
        'mult',
        (m) => m.attackIntervalMult,
      ),
  );
}

export function getEffectiveStructureMaxHp(
  kind: StructureKind,
  artifacts: string[],
): number {
  const base = STRUCTURE_SPECS[kind].maxHp;
  if (artifacts.includes('fortification_core')) {
    return Math.round(base * 1.4);
  }
  return base;
}

export function getSellRefund(kind: StructureKind): number {
  return Math.round(STRUCTURE_SPECS[kind].cost * SELL_REFUND_RATE);
}

/**
 * Scales structure build cost by the number of active structures of the same kind on the board.
 * Ground-blocking walls get a 4-wall grace threshold (+15% each thereafter);
 * non-wall structures scale +25% per active copy after the first.
 */
export function getStructureBuildCost(
  kind: StructureKind,
  activeCount: number,
): number {
  const spec = STRUCTURE_SPECS[kind];
  const count = Math.max(0, activeCount);
  if (spec.blocksGround) {
    const extra = Math.max(0, count - 4);
    return Math.round(spec.cost * (1 + extra * 0.15));
  }
  return Math.round(spec.cost * (1 + count * 0.25));
}

export function getPokemonReleaseRefund(
  speciesId: string,
  branchId: string | null = null,
): number {
  const draftCost = POKEMON_SPECIES[speciesId]?.draftCost ?? 3;
  return draftCost * 10 + (branchId ? 15 : 0);
}

export function getRepairCost(
  kind: StructureKind,
  hp?: number,
  maxHp?: number,
): number {
  const base = STRUCTURE_SPECS[kind].cost;
  if (hp === undefined || maxHp === undefined || maxHp <= 0) {
    return Math.round(base * REPAIR_COST_RATE);
  }
  const missingRatio = Math.max(0, Math.min(1, (maxHp - hp) / maxHp));
  if (missingRatio <= 0) return 0;
  return Math.max(5, Math.ceil(base * REPAIR_COST_RATE * missingRatio));
}

export function getApKillThreshold(artifacts: string[]): number {
  return artifacts.includes('temporal_gear')
    ? TEMPORAL_GEAR_KILL_THRESHOLD
    : BASE_AP_KILL_THRESHOLD;
}

export function getBountyGold(baseBounty: number, artifacts: string[]): number {
  return artifacts.includes('commanders_insignia')
    ? Math.round(baseBounty * 1.35)
    : baseBounty;
}

/** Gentle late-wave bounty taper (1.0× through Wave 10, decaying thereafter). */
export function getBountyWaveMult(wave: number): number {
  if (wave <= 10) return 1;
  return 1 / (1 + (wave - 10) * 0.05);
}

export function getHealCost(wave: number): number {
  return Math.round(HEAL_COST * (1 + Math.max(0, wave - 1) * 0.12));
}

export function getReviveCost(wave: number): number {
  return Math.round(REVIVE_COST * (1 + Math.max(0, wave - 1) * 0.12));
}

const RARITY_BRANCH_BASE_COST: Record<PokemonRarity, number> = {
  Common: 50,
  Uncommon: 70,
  Rare: 95,
  Epic: 125,
  Legendary: 160,
};
const BRANCH_INDEX_COST_MULT = [1, 1.25, 1.5] as const;

/** Specialization cost scales with Pokémon rarity and branch index (Path 1 < Path 2 < Path 3). */
export function getBranchCost(speciesId: string, branchIndex: number): number {
  const rarity = POKEMON_SPECIES[speciesId]?.rarity ?? 'Common';
  const base = RARITY_BRANCH_BASE_COST[rarity];
  const mult =
    BRANCH_INDEX_COST_MULT[
      Math.max(0, Math.min(BRANCH_INDEX_COST_MULT.length - 1, branchIndex))
    ];
  return Math.round(base * mult);
}

export function getRewardRerollCost(rerollsUsed: number, wave = 1): number {
  const base = Math.round(20 * (1 + Math.max(0, wave - 1) * 0.15));
  return Math.round(base * Math.pow(1.75, Math.max(0, rerollsUsed)));
}

const RARITY_TIERS: readonly PokemonRarity[] = [
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
];

const RARITY_REWARD_WEIGHT: Record<PokemonRarity, number> = {
  Common: 40,
  Uncommon: 25,
  Rare: 14,
  Epic: 6,
  Legendary: 2,
};

function pickByRarityTier<T>(
  items: readonly T[],
  getRarity: (item: T) => PokemonRarity | undefined,
  rng: () => number,
): T {
  const buckets = new Map<PokemonRarity, T[]>();
  for (const item of items) {
    const tier = getRarity(item) ?? 'Uncommon';
    const list = buckets.get(tier);
    if (list) list.push(item);
    else buckets.set(tier, [item]);
  }

  let totalWeight = 0;
  for (const tier of RARITY_TIERS) {
    if (buckets.has(tier)) totalWeight += RARITY_REWARD_WEIGHT[tier];
  }

  let chosenBucket: T[] = items as T[];
  if (totalWeight > 0) {
    let roll = rng() * totalWeight;
    for (const tier of RARITY_TIERS) {
      const bucket = buckets.get(tier);
      if (!bucket) continue;
      roll -= RARITY_REWARD_WEIGHT[tier];
      if (roll <= 0) {
        chosenBucket = bucket;
        break;
      }
      chosenBucket = bucket;
    }
  }

  return chosenBucket[Math.floor(rng() * chosenBucket.length)];
}

function shuffleByRarityTier<T>(
  items: readonly T[],
  getRarity: (item: T) => PokemonRarity | undefined,
  rng: () => number,
): T[] {
  const pool = [...items];
  const result: T[] = [];
  while (pool.length > 0) {
    const picked = pickByRarityTier(pool, getRarity, rng);
    result.push(picked);
    pool.splice(pool.indexOf(picked), 1);
  }
  return result;
}

/**
 * Generates up to 3 distinct roguelike reward choices between waves,
 * weighting rarer species, upgrades, and artifacts lower than common ones.
 */
export function generateRewardChoices(
  ownedSpeciesIds: Set<string>,
  ownedUpgrades: string[],
  ownedArtifacts: string[],
  rng: () => number = Math.random,
  _unbranchedUnits: Array<{ uid: string; speciesId: string }> = [],
  includeClassMinorUpgrades = false,
  canRecruit = true,
  evolvableUnits: Array<{
    uid: string;
    speciesId: string;
    targetSpeciesId: string;
  }> = [],
  excludeRewardIds?: Set<string>,
): RewardOption[] {
  void _unbranchedUnits;
  const ownedUpgradeSet = new Set(ownedUpgrades);
  const ownedArtifactSet = new Set(ownedArtifacts);

  const availableRewards: RewardOption[] = REWARD_POOL.filter(
    (r) =>
      (r.kind === 'upgrade' && !ownedUpgradeSet.has(r.id)) ||
      (r.kind === 'artifact' && !ownedArtifactSet.has(r.id)),
  );

  if (includeClassMinorUpgrades) {
    const minorPool = new Map<string, RewardOption>();
    for (const speciesId of ownedSpeciesIds) {
      const sp = POKEMON_SPECIES[speciesId];
      if (!sp) continue;
      for (const u of getEligibleMinorUpgrades(sp, ownedUpgradeSet)) {
        if (!minorPool.has(u.id)) {
          minorPool.set(u.id, {
            id: u.id,
            kind: 'upgrade',
            title: u.title,
            desc: u.desc,
            targetClass: u.targetClass,
          });
        }
      }
    }
    availableRewards.push(...minorPool.values());
  }

  const pickRandom = <T>(arr: readonly T[]): T =>
    arr[Math.floor(rng() * arr.length)];

  const unownedSpecies = Object.values(POKEMON_SPECIES).filter(
    (sp) => !ownedSpeciesIds.has(sp.id),
  );

  const isExcluded = (id: string): boolean =>
    Boolean(excludeRewardIds?.has(id));

  const preferredEvolvable = evolvableUnits.filter(
    (u) => !isExcluded(`evolve_${u.uid}_${u.targetSpeciesId}`),
  );
  const excludedEvolvable = evolvableUnits.filter((u) =>
    isExcluded(`evolve_${u.uid}_${u.targetSpeciesId}`),
  );
  const preferredSpecies = unownedSpecies.filter(
    (sp) => !isExcluded(`recruit_${sp.id}`),
  );
  const excludedSpecies = unownedSpecies.filter((sp) =>
    isExcluded(`recruit_${sp.id}`),
  );
  const preferredRewards = availableRewards.filter((r) => !isExcluded(r.id));
  const excludedRewards = availableRewards.filter((r) => isExcluded(r.id));

  const pushEvolveChoice = (unit: {
    uid: string;
    speciesId: string;
    targetSpeciesId: string;
  }): void => {
    const fromSp = POKEMON_SPECIES[unit.speciesId];
    const toSp = POKEMON_SPECIES[unit.targetSpeciesId];
    if (!fromSp || !toSp) return;
    choices.push({
      id: `evolve_${unit.uid}_${unit.targetSpeciesId}`,
      kind: 'evolve',
      title: `Evolve ${fromSp.name} → ${toSp.name}`,
      desc: `Evolve ${fromSp.name} into ${toSp.name} (HP ${toSp.maxHp}, ATK ${toSp.atk}).`,
      speciesId: unit.speciesId,
      targetSpeciesId: unit.targetSpeciesId,
      unitUid: unit.uid,
    });
  };

  const pushRecruitChoice = (sp: (typeof unownedSpecies)[number]): void => {
    choices.push({
      id: `recruit_${sp.id}`,
      kind: 'recruit',
      rarity: sp.rarity,
      title: `Recruit ${sp.name}`,
      desc: `${sp.pokeClass} — ${sp.ultName}: ${sp.ultDesc}`,
      speciesId: sp.id,
    });
  };

  const choices: RewardOption[] = [];

  if (preferredEvolvable.length > 0 && choices.length < 3) {
    pushEvolveChoice(pickRandom(preferredEvolvable));
  }

  if (canRecruit && preferredSpecies.length > 0 && choices.length < 3) {
    pushRecruitChoice(
      pickByRarityTier(preferredSpecies, (sp) => sp.rarity, rng),
    );
  }

  for (const item of shuffleByRarityTier(
    preferredRewards,
    (r) => r.rarity,
    rng,
  )) {
    if (choices.length >= 3) break;
    choices.push(item);
  }

  // Fall back to excluded options only if needed to reach 3 choices
  if (
    canRecruit &&
    choices.length < 3 &&
    !choices.some((c) => c.kind === 'recruit') &&
    excludedSpecies.length > 0
  ) {
    pushRecruitChoice(
      pickByRarityTier(excludedSpecies, (sp) => sp.rarity, rng),
    );
  }

  for (const item of shuffleByRarityTier(
    excludedRewards,
    (r) => r.rarity,
    rng,
  )) {
    if (choices.length >= 3) break;
    choices.push(item);
  }

  if (
    choices.length < 3 &&
    !choices.some((c) => c.kind === 'evolve') &&
    excludedEvolvable.length > 0
  ) {
    pushEvolveChoice(pickRandom(excludedEvolvable));
  }

  return choices;
}

/**
 * Checks whether grid coordinate `(bx, by)` falls inside the circular attack
 * perimeter of radius `range + 0.5` tiles centered on `(ax, ay)`.
 */
export function isInCircularRange(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  range: number,
): boolean {
  if (range < 0) return false;
  const dx = bx - ax;
  const dy = by - ay;
  const r = range + 0.5;
  return dx * dx + dy * dy <= r * r;
}

export interface ProjectileLaunch {
  startX: number;
  startY: number;
  rotation: number;
}

/**
 * Computes a muzzle-offset spawn point and rotation angle (radians, 0 = +x)
 * from `(sx, sy)` toward `(tx, ty)`, clamped so it never overshoots the target.
 */
export function computeProjectileLaunch(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  muzzleOffset = 16,
): ProjectileLaunch {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    return { startX: sx, startY: sy, rotation: 0 };
  }
  const rotation = Math.atan2(dy, dx);
  const offset = Math.min(Math.max(0, muzzleOffset), dist * 0.5);
  return {
    startX: sx + Math.cos(rotation) * offset,
    startY: sy + Math.sin(rotation) * offset,
    rotation,
  };
}

/**
 * Returns true when an enemy species has special tactical traits
 * (bypasses defenders, ranged attack, non-ground movement, or heavy wall damage).
 */
export function isSpecialEnemy(
  spec: Pick<
    EnemySpecies,
    'ignoresUnits' | 'range' | 'movementType' | 'wallDmgMult'
  >,
): boolean {
  return (
    Boolean(spec.ignoresUnits) ||
    (spec.range ?? 1) > 1 ||
    spec.movementType !== 'ground' ||
    spec.wallDmgMult >= 2
  );
}

/**
 * Returns a concise 1-line tactical threat callout for an enemy species.
 */
export function getEnemyThreatSummary(spec: EnemySpecies): string {
  if (spec.ignoresUnits) {
    return 'Ignores Pokémon — rushes Core';
  }
  if ((spec.range ?? 1) > 1) {
    return `Ranged attacker (${spec.range} tiles)`;
  }
  if (spec.movementType === 'fly') {
    return 'Flying — bypasses walls & ground traps';
  }
  if (spec.movementType === 'burrow') {
    return 'Burrower — tunnels under walls';
  }
  if (spec.wallDmgMult >= 2) {
    return `Structure Breaker (${spec.wallDmgMult}× wall dmg)`;
  }
  return spec.roleLabel;
}
