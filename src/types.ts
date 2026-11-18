export const GRID_COLS = 28;
export const GRID_ROWS = 18;
export const TILE_SIZE = 32;

export type GamePhase =
  | 'HOME'
  | 'MAP_SELECT'
  | 'DRAFT'
  | 'PREP'
  | 'COMBAT'
  | 'REWARD'
  | 'VICTORY'
  | 'DEFEAT';

export type MapDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

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

export type StructureKind =
  'wood_wall' | 'stone_wall' | 'berry_bush' | 'barrel';

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
  fainted: boolean;
  facingDir: number; // 0..7 PMD direction
  attackCooldownMs: number;
  hitCount: number;
}

export interface RewardOption {
  id: string;
  kind: 'upgrade' | 'artifact' | 'recruit' | 'branch';
  title: string;
  desc: string;
  speciesId?: string;
  unitUid?: string;
  targetClass?: PokemonClass;
}

export interface GameSnapshot {
  phase: GamePhase;
  wave: number;
  maxWaves: number;
  coreHp: number;
  coreMaxHp: number;
  gold: number;
  ap: number;
  maxAp: number;
  kills: number;
  speedMult: 1 | 2;
  muted: boolean;
  selectedTool: StructureKind | 'move_struct' | 'sell_struct' | null;
  selectedUnitUid: string | null;
  selectedStructureUid: string | null;
  aimingUltUnitUid: string | null;
  activeUnits: ActiveUnit[];
  reserveIds: string[];
  draftIds: string[];
  unlockedIds: string[];
  selectedMapId: string;
  draftBudget: number;
  heldItemInventory: string[];
  structures: GridStructure[];
  artifacts: string[];
  upgrades: string[];
  rewardChoices: RewardOption[];
  pendingBranchUnitUid: string | null;
  statusMessage: string;
}
