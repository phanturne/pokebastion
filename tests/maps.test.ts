import { describe, expect, it } from 'vitest';
import { MAP_CATALOG, createGridForMap } from '../src/data/maps';
import { CORE_CELLS, findPath } from '../src/engine/pathfinding';
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
});
