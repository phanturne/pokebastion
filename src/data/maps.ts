import { CORE_CELLS, createBaseGrid, inBounds } from '../engine/pathfinding';
import { GRID_COLS, GRID_ROWS, MapDifficulty, TileKind } from '../types';

export interface MapWaveTheme {
  label: string;
  early: readonly string[];
  mid: readonly string[];
  late: readonly string[];
  boss: readonly string[];
}

export interface MapSpec {
  id: string;
  name: string;
  difficulty: MapDifficulty;
  desc: string;
  previewImage?: string;
  comingSoon?: boolean;
  waterTiles?: Array<[number, number]>;
  treeTiles?: Array<[number, number]>;
  useDefaultLayout?: boolean;
  waveTheme: MapWaveTheme;
}

export const MAP_CATALOG: MapSpec[] = [
  {
    id: 'viridian_outpost',
    name: 'Viridian Outpost',
    difficulty: 'Beginner',
    desc: 'Balanced forest clearing with twin moats and wide building lanes around the Pokémon Center.',
    previewImage: 'assets/maps/viridian_outpost.jpg',
    useDefaultLayout: true,
    waveTheme: {
      label: 'Balanced Frontier',
      early: ['0019', '0023', '0066', '0074', '0050', '0041', '0021'],
      mid: [
        '0020',
        '0024',
        '0111',
        '0081',
        '0092',
        '0109',
        '0042',
        '0022',
        '0051',
      ],
      late: ['0123', '0068', '0112', '0093', '0095', '0169', '0082', '0075'],
      boss: ['0076', '0142', '0094', '0068', '0112'],
    },
  },
  {
    id: 'cerulean_creek',
    name: 'Cerulean Creek',
    difficulty: 'Intermediate',
    desc: 'Twin north-south river channels force ground waves across narrow central bridges.',
    previewImage: 'assets/maps/cerulean_creek.jpg',
    comingSoon: true,
    waveTheme: {
      label: 'Storm & Sky',
      early: ['0019', '0023', '0066', '0021', '0041', '0081'],
      mid: ['0020', '0024', '0022', '0042', '0081', '0109'],
      late: ['0042', '0022', '0082', '0123', '0169'],
      boss: ['0142', '0169', '0082'],
    },
  },
  {
    id: 'lavender_hollow',
    name: 'Lavender Hollow',
    difficulty: 'Advanced',
    desc: 'Dense timber thickets create tight chokepoints and split flanks for agile ambushers.',
    previewImage: 'assets/maps/lavender_hollow.jpg',
    comingSoon: true,
    waveTheme: {
      label: 'Spectral Ambush',
      early: ['0019', '0023', '0050', '0092', '0041'],
      mid: ['0024', '0092', '0093', '0109', '0051', '0042'],
      late: ['0093', '0094', '0051', '0095', '0123', '0169'],
      boss: ['0094', '0169', '0095'],
    },
  },
  {
    id: 'victory_road',
    name: 'Victory Road',
    difficulty: 'Expert',
    desc: 'Open high-pressure siege arena with minimal natural cover and long exposed flanks.',
    previewImage: 'assets/maps/victory_road.jpg',
    comingSoon: true,
    waveTheme: {
      label: 'Armored Siege',
      early: ['0066', '0074', '0020', '0111', '0050'],
      mid: ['0075', '0112', '0082', '0095', '0022', '0093'],
      late: ['0076', '0068', '0112', '0082', '0123', '0142'],
      boss: ['0076', '0068', '0142'],
    },
  },
];

export const MAP_BY_ID: Record<string, MapSpec> = Object.fromEntries(
  MAP_CATALOG.map((m) => [m.id, m]),
);

export function createGridForMap(mapId: string): TileKind[][] {
  const spec = MAP_BY_ID[mapId];
  if (!spec || spec.useDefaultLayout) {
    return createBaseGrid();
  }

  const grid: TileKind[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, (): TileKind => 'grass'),
  );

  for (const [gx, gy] of spec.waterTiles ?? []) {
    if (inBounds(gx, gy)) {
      grid[gy][gx] = 'water';
    }
  }
  for (const [gx, gy] of spec.treeTiles ?? []) {
    if (inBounds(gx, gy)) {
      grid[gy][gx] = 'tree';
    }
  }
  for (const c of CORE_CELLS) {
    grid[c.gy][c.gx] = 'core';
  }

  return grid;
}
