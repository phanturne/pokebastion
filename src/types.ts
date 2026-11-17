export const GRID_COLS = 18;
export const GRID_ROWS = 12;
export const TILE_SIZE = 48;

export type GamePhase = 'PREP' | 'COMBAT' | 'REWARD' | 'VICTORY' | 'DEFEAT';

export type TileKind = 'grass' | 'dirt' | 'water' | 'core' | 'spawn';

export type PokemonClass =
  | 'Defender'
  | 'Brawler'
  | 'Marksman'
  | 'Blaster'
  | 'Support'
  | 'Specialist';

export type MovementType = 'ground' | 'burrow' | 'fly';

export type StructureKind = 'wood_wall' | 'stone_wall' | 'berry_bush' | 'barrel';

export interface PokemonSpecies {
  id: string; // PMDCollab 4-digit ID e.g. '0025'
  name: string;
  pokeClass: PokemonClass;
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
}

export interface EnemySpecies {
  id: string; // PMDCollab 4-digit ID
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
  kind: 'upgrade' | 'artifact' | 'recruit';
  title: string;
  desc: string;
  speciesId?: string;
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
  selectedTool: StructureKind | 'move_struct' | 'sell_struct' | null;
  selectedUnitUid: string | null;
  selectedStructureUid: string | null;
  aimingUltUnitUid: string | null;
  activeUnits: ActiveUnit[];
  reserveIds: string[];
  structures: GridStructure[];
  artifacts: string[];
  upgrades: string[];
  rewardChoices: RewardOption[];
  statusMessage: string;
}
