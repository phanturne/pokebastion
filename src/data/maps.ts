import { CORE_CELLS, createBaseGrid } from '../engine/pathfinding';
import { GRID_COLS, GRID_ROWS, MapDifficulty, TileKind } from '../types';

export interface MapSpec {
  id: string;
  name: string;
  difficulty: MapDifficulty;
  desc: string;
  comingSoon?: boolean;
  waterTiles?: Array<[number, number]>;
  treeTiles?: Array<[number, number]>;
  useDefaultLayout?: boolean;
}

export const MAP_CATALOG: MapSpec[] = [
  {
    id: 'viridian_outpost',
    name: 'Viridian Outpost',
    difficulty: 'Beginner',
    desc: 'Balanced forest clearing with twin moats and wide building lanes around the Pokémon Center.',
    useDefaultLayout: true,
  },
  {
    id: 'cerulean_creek',
    name: 'Cerulean Creek',
    difficulty: 'Intermediate',
    desc: 'Twin north-south river channels force ground waves across narrow central bridges.',
    comingSoon: true,
  },
  {
    id: 'lavender_hollow',
    name: 'Lavender Hollow',
    difficulty: 'Advanced',
    desc: 'Dense timber thickets create tight chokepoints and split flanks for agile ambushers.',
    comingSoon: true,
  },
  {
    id: 'victory_road',
    name: 'Victory Road',
    difficulty: 'Expert',
    desc: 'Open high-pressure siege arena with minimal natural cover and long exposed flanks.',
    comingSoon: true,
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
    if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
      grid[gy][gx] = 'water';
    }
  }
  for (const [gx, gy] of spec.treeTiles ?? []) {
    if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
      grid[gy][gx] = 'tree';
    }
  }
  for (const c of CORE_CELLS) {
    grid[c.gy][c.gx] = 'core';
  }

  return grid;
}
