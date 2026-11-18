import { describe, expect, it } from 'vitest';
import { MAP_BY_ID, MAP_CATALOG, createGridForMap } from '../src/data/maps';
import {
  CORE_CELLS,
  createBaseGrid,
  findPath,
} from '../src/engine/pathfinding';
import { GRID_COLS, GRID_ROWS } from '../src/types';

describe('Map Catalog & Pathfinding Validity', () => {
  it('defines 4 maps with valid 28x18 grids and walkable paths from both flanks', () => {
    expect(MAP_CATALOG).toHaveLength(4);

    const ids = new Set<string>();
    for (const map of MAP_CATALOG) {
      expect(ids.has(map.id)).toBe(false);
      ids.add(map.id);
      if (map.comingSoon) continue;

      const grid = createGridForMap(map.id);
      expect(grid).toHaveLength(GRID_ROWS);
      for (const row of grid) {
        expect(row).toHaveLength(GRID_COLS);
      }

      for (const core of CORE_CELLS) {
        expect(grid[core.gy][core.gx]).toBe('core');
      }

      // Ground enemies must have a valid path from both west and east edges
      const westPath = findPath({ gx: 0, gy: 8 }, grid, new Set(), 'ground');
      const eastPath = findPath(
        { gx: GRID_COLS - 1, gy: 8 },
        grid,
        new Set(),
        'ground',
      );
      expect(westPath).not.toBeNull();
      expect(eastPath).not.toBeNull();
    }
  });

  it('falls back to base grid for unknown mapId and applies custom waterTiles/treeTiles within bounds', () => {
    expect(createGridForMap('nonexistent_map')).toEqual(createBaseGrid());

    const customId = '__test_custom_map__';
    MAP_BY_ID[customId] = {
      id: customId,
      name: 'Test Map',
      difficulty: 'Beginner',
      desc: 'Test',
      waterTiles: [
        [2, 3],
        [-1, 5],
      ],
      treeTiles: [
        [4, 5],
        [99, 99],
      ],
    };
    try {
      const grid = createGridForMap(customId);
      expect(grid[3][2]).toBe('water');
      expect(grid[5][4]).toBe('tree');
      expect(grid[0][0]).toBe('grass');
      for (const core of CORE_CELLS) {
        expect(grid[core.gy][core.gx]).toBe('core');
      }
    } finally {
      delete MAP_BY_ID[customId];
    }
  });
});
