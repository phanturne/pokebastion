export const GRID_COLS = 28;
export const GRID_ROWS = 18;
export const TILE_SIZE = 32;

export type GamePhase =
  | 'HOME'
  | 'MAP_SELECT'
  | 'DIFFICULTY_SELECT'
  | 'DRAFT'
  | 'PREP'
  | 'COMBAT'
  | 'REWARD'
  | 'SHOP'
  | 'VICTORY'
  | 'DEFEAT';

export type MapDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
export type RunDifficulty = 'easy' | 'normal' | 'hard' | 'expert';

export type TileKind = 'grass' | 'dirt' | 'water' | 'core' | 'spawn' | 'tree';

export type PokemonClass =
  'Defender' | 'Brawler' | 'Marksman' | 'Blaster' | 'Support' | 'Specialist';

export type PokemonSubclass =
  | 'Bastion'
  | 'Wallguard'
  | 'Juggernaut'
  | 'Duelist'
  | 'Cleave'
  | 'Interceptor'
  | 'Sniper'
  | 'Rapid-Fire'
  | 'Artillery'
  | 'Elemental AoE'
  | 'Chain'
  | 'Status'
  | 'Healer'
  | 'Buffer'
  | 'Tactician'
  | 'Hazard Setter'
  | 'Displacer'
  | 'Ambusher';

export type PokemonRarity =
  'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export type EggTier = 'common' | 'rare' | 'master';

export interface EggHatchResult {
  eggTier: EggTier;
  speciesId: string;
  rarity: PokemonRarity;
  wasNewUnlock: boolean;
  shardsAwarded: number;
  universalShardsAwarded: number;
}

export interface PokemonProgress {
  unlocked: boolean;
  shards: number;
  potential: number; // 0..5
}

export interface RunMetaReward {
  shardsBySpecies: Record<string, number>;
  universalShardsAwarded: number;
  eggsEarned: Record<EggTier, number>;
  newAchievements: string[];
  firstClear: boolean;
  pityTriggered: boolean;
}

export interface MinorUpgradeSpec {
  id: string;
  title: string;
  desc: string;
  targetClass: PokemonClass;
  targetSubclass?: PokemonSubclass;
  hpMult?: number;
  atkMult?: number;
  defBonus?: number;
  rangeBonus?: number;
  attackIntervalMult?: number;
  moveRangeBonus?: number;
  ultChargeMult?: number;
}

export type MovementType = 'ground' | 'burrow' | 'fly';

export type HazardKind =
  'stealth_rock' | 'spikes' | 'toxic_spikes' | 'sticky_web';

export interface UnitStatusBadge {
  id: string;
  label: string;
  desc: string;
  kind: 'buff' | 'debuff';
  icon: string;
}

export type StructureKind =
  | 'wood_wall'
  | 'stone_wall'
  | 'thorn_wall'
  | 'flame_brazier'
  | 'berry_bush'
  | 'tempo_shrine'
  | 'honey_trap'
  | 'lightning_rod'
  | 'barrel';

export interface PokemonBranch {
  id: string;
  name: string;
  desc: string;
  atkMult?: number;
  hpMult?: number;
  defBonus?: number;
  rangeBonus?: number;
  attackIntervalMult?: number;
  moveRangeBonus?: number;
  ultMult?: number;
  special?:
    | 'burn_spread'
    | 'chain_hit'
    | 'lifesteal'
    | 'slow_hit'
    | 'thorns'
    | 'crit_boost';
}

export interface HeldItemSpec {
  id: string;
  name: string;
  rarity?: PokemonRarity;
  spriteSlug?: string;
  cost: number;
  desc: string;
  atkMult?: number;
  hpMult?: number;
  defBonus?: number;
  attackIntervalMult?: number;
  special?: 'bloodthirsty' | 'storm_conductor' | 'guardian_charm';
}

export interface ArtifactSpec {
  id: string;
  name: string;
  rarity: PokemonRarity;
  spriteSlug: string;
  desc: string;
  targetClass?: PokemonClass;
}

export interface PokemonSpecies {
  id: string; // PMDCollab 4-digit ID e.g. '0025'
  name: string;
  rarity?: PokemonRarity;
  pokeClass: PokemonClass;
  secondaryClass?: PokemonClass;
  subclass?: PokemonSubclass;
  draftCost: number;
  unlockedStarter?: boolean;
  color: string;
  maxHp: number;
  atk: number;
  def: number;
  range: number; // grid tiles (Manhattan/Chebyshev)
  attackIntervalMs: number;
  moveRange: number; // 1 AP ring; 2 * moveRange = 2 AP ring
  ultMax: number;
  ultAutoDefault: boolean;
  passiveDesc: string;
  basicDesc: string;
  ultName: string;
  ultDesc: string;
  basicVfx: string;
  impactVfx: string;
  ultVfx: string;
  isMelee: boolean;
  canEnterWater?: boolean;
  canFly?: boolean;
  branches: [PokemonBranch, PokemonBranch, PokemonBranch];
}

export interface EnemySpecies {
  id: string; // PMDCollab 4-digit ID
  spriteId?: string;
  spriteScale?: number;
  spriteTint?: number;
  name: string;
  color: string;
  maxHp: number;
  atk: number;
  speed: number; // tiles per second
  movementType: MovementType;
  range?: number; // default 1
  attackIntervalMs?: number; // default 1000
  projectileVfx?: string;
  ignoresUnits?: boolean;
  wallDmgMult: number;
  bounty: number;
  roleLabel: string;
  hitVfx: string;
}

export interface StructureSpec {
  kind: StructureKind;
  name: string;
  cost: number;
  maxHp: number;
  blocksGround: boolean;
  consumable: boolean;
  desc: string;
}

export interface GridStructure {
  uid: string;
  kind: StructureKind;
  gx: number;
  gy: number;
  hp: number;
  maxHp: number;
  ruined: boolean;
}

export type TargetPriority =
  'first' | 'last' | 'close' | 'strong' | 'advantageous';

export const TARGET_PRIORITIES: readonly TargetPriority[] = [
  'first',
  'last',
  'close',
  'strong',
  'advantageous',
];

export interface ActiveUnit {
  uid: string;
  speciesId: string;
  branchId: string | null;
  heldItems: string[];
  gx: number;
  gy: number;
  hp: number;
  maxHp: number;
  ult: number;
  ultMax: number;
  autoUlt: boolean;
  targetPriority?: TargetPriority;
  fainted: boolean;
  facingDir: number; // 0..7 PMD direction
  attackCooldownMs: number;
  hitCount: number;
  damageDealt?: number;
  damageTaken?: number;
  healingDone?: number;
  effectiveAtk?: number;
  effectiveDef?: number;
  effectiveRange?: number;
  effectiveAttackIntervalMs?: number;
  statusBadges?: UnitStatusBadge[];
}

export interface RewardOption {
  id: string;
  kind: 'upgrade' | 'artifact' | 'recruit' | 'branch' | 'evolve';
  rarity?: PokemonRarity;
  title: string;
  desc: string;
  speciesId?: string;
  targetSpeciesId?: string;
  unitUid?: string;
  targetClass?: PokemonClass;
}

export interface GameSnapshot {
  phase: GamePhase;
  wave: number;
  maxWaves: number;
  waveElapsedMs?: number;
  coreHp: number;
  coreMaxHp: number;
  gold: number;
  ap: number;
  maxAp: number;
  kills: number;
  speedMult: 1 | 2;
  paused: boolean;
  muted: boolean;
  screenShakeEnabled: boolean;
  selectedTool: StructureKind | null;
  movingStructureUid?: string | null;
  selectedUnitUid: string | null;
  selectedStructureUid: string | null;
  aimingUltUnitUid: string | null;
  activeUnits: ActiveUnit[];
  reserveIds: string[];
  draftIds: string[];
  unlockedIds: string[];
  selectedMapId: string;
  selectedDifficulty: RunDifficulty;
  draftBudget: number;
  heldItemInventory: string[];
  structures: GridStructure[];
  artifacts: string[];
  upgrades: string[];
  rewardChoices: RewardOption[];
  rewardRerollsUsed: number;
  pendingBranchUnitUid: string | null;
  statusMessage: string;
  pokemonProgress: Record<string, PokemonProgress>;
  universalShards: number;
  eggs: Record<EggTier, number>;
  pityWins: number;
  achievements: string[];
  clearedMaps: string[];
}

export interface ContextInspectTarget {
  kind: 'structure' | 'unit';
  uid: string;
  screenX: number;
  screenY: number;
}
