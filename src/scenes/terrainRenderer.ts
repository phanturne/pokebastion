import Phaser from 'phaser';
import { SpawnPortal } from '../engine/pathfinding';
import { GRID_COLS, GRID_ROWS, TILE_SIZE, TileKind } from '../types';

const CANVAS_WIDTH = GRID_COLS * TILE_SIZE;
const CANVAS_HEIGHT = GRID_ROWS * TILE_SIZE;
const BORDER_PAD_TILES = 14;
const BORDER_PAD_PX = BORDER_PAD_TILES * TILE_SIZE;

export const CORE_HP_BAR_WIDTH = 58;

export interface TerrainRenderRefs {
  terrainLayer?: Phaser.GameObjects.Group;
  arenaGroundRT?: Phaser.GameObjects.RenderTexture;
  borderBakedImg?: Phaser.GameObjects.Image;
}

export interface PortalVisualState {
  portalGraphics: Phaser.GameObjects.Graphics;
  portalMarkers: Phaser.GameObjects.Rectangle[];
  portalTween: Phaser.Tweens.Tween | null;
}

function tileCenterX(gx: number): number {
  return gx * TILE_SIZE + TILE_SIZE / 2;
}

function tileCenterY(gy: number): number {
  return gy * TILE_SIZE + TILE_SIZE / 2;
}

export function renderTerrain(
  scene: Phaser.Scene,
  tiles: TileKind[][],
  refs: TerrainRenderRefs,
): void {
  refs.terrainLayer?.clear(true, true);
  refs.arenaGroundRT?.destroy();
  refs.borderBakedImg?.destroy();

  const worldW = CANVAS_WIDTH + BORDER_PAD_PX * 2;
  const worldH = CANVAS_HEIGHT + BORDER_PAD_PX * 2;

  refs.arenaGroundRT = scene.add
    .renderTexture(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .setOrigin(0, 0)
    .setDepth(0);

  // Bake border grass + trees once into a half-res pre-blurred CanvasTexture
  // (eliminates ~150+ tree display objects and WebGL postFX FBO allocations)
  const bakeBorder = !scene.textures.exists('border-baked');
  const borderScale = 2;
  const bw = Math.ceil(worldW / borderScale);
  const bh = Math.ceil(worldH / borderScale);
  let borderOff: HTMLCanvasElement | null = null;
  let bctx: CanvasRenderingContext2D | null = null;
  if (bakeBorder) {
    borderOff = document.createElement('canvas');
    borderOff.width = bw;
    borderOff.height = bh;
    bctx = borderOff.getContext('2d');
  }

  const drawToBorder = (
    texKey: string,
    frame: number | undefined,
    cx: number,
    cy: number,
    scale = 1,
    originX = 0.5,
    originY = 0.5,
  ) => {
    if (!bctx) return;
    const tex = scene.textures.get(texKey);
    const fr = frame !== undefined ? tex.get(frame) : tex.get();
    const src = tex.getSourceImage() as CanvasImageSource;
    const dw = (fr.width * scale) / borderScale;
    const dh = (fr.height * scale) / borderScale;
    const dx = (cx + BORDER_PAD_PX) / borderScale - dw * originX;
    const dy = (cy + BORDER_PAD_PX) / borderScale - dh * originY;
    bctx.drawImage(
      src,
      fr.cutX,
      fr.cutY,
      fr.cutWidth,
      fr.cutHeight,
      dx,
      dy,
      dw,
      dh,
    );
  };

  const stamp = scene.make.image({ key: 'ekat-route224', add: false });
  const addTerrain = (img: Phaser.GameObjects.Image) => {
    refs.terrainLayer?.add(img);
    return img;
  };
  const subSize = TILE_SIZE / 2; // 24px sub-tiles (16px * 1.5x) to match PMD sprite pixel density
  const tileAt = (gx: number, gy: number) =>
    gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS
      ? tiles[gy][gx]
      : 'grass';

  for (let gy = -BORDER_PAD_TILES; gy < GRID_ROWS + BORDER_PAD_TILES; gy++) {
    for (let gx = -BORDER_PAD_TILES; gx < GRID_COLS + BORDER_PAD_TILES; gx++) {
      const inArena = gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS;
      const tile = inArena ? tiles[gy][gx] : 'grass';
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const dx = sx === 0 ? -1 : 1;
          const dy = sy === 0 ? -1 : 1;
          let frame: number;

          if (tile === 'water') {
            const sameH = tileAt(gx + dx, gy) === 'water';
            const sameV = tileAt(gx, gy + dy) === 'water';
            const col = !sameH ? (sx === 0 ? 5 : 7) : 6;
            const row = !sameV ? (sy === 0 ? 6 : 8) : 7;
            frame = row * 8 + col;
          } else if (tile === 'core') {
            frame = 0; // clean meadow grass underneath the transparent Pokémon Center
          } else if (tile === 'dirt' || tile === 'spawn') {
            const isPath = (x: number, y: number) => {
              const t = tileAt(x, y);
              return t === 'dirt' || t === 'spawn' || t === 'core';
            };
            const sameH = isPath(gx + dx, gy);
            const sameV = isPath(gx, gy + dy);
            const col = !sameH ? (sx === 0 ? 5 : 7) : 6;
            const row = !sameV ? (sy === 0 ? 3 : 5) : 4;
            frame = row * 8 + col;
          } else {
            // Clean, seamless meadow grass (0) with subtle grass tuft variation (1)
            const subX = gx * 2 + sx;
            const subY = gy * 2 + sy;
            let h = Math.imul(subX ^ (subY << 5), 0x45d9f3b);
            h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
            h = (h ^ (h >>> 16)) >>> 0;
            frame = h % 100 < 22 ? 1 : 0;
          }

          const wx = gx * TILE_SIZE + sx * subSize + subSize / 2;
          const wy = gy * TILE_SIZE + sy * subSize + subSize / 2;
          if (inArena) {
            stamp.setTexture('ekat-route224', frame).setScale(1);
            refs.arenaGroundRT.draw(stamp, wx, wy);
            const onArenaEdge =
              gx === 0 ||
              gx === GRID_COLS - 1 ||
              gy === 0 ||
              gy === GRID_ROWS - 1;
            if (onArenaEdge) {
              drawToBorder('ekat-route224', 0, wx, wy, 1, 0.5, 0.5);
            }
          } else {
            drawToBorder('ekat-route224', frame, wx, wy, 1, 0.5, 0.5);
          }
        }
      }

      if (!inArena) {
        let bh2 = Math.imul(gx ^ (gy << 7), 0x27d4eb2d);
        bh2 = Math.imul(bh2 ^ (bh2 >>> 15), 0x85ebca6b);
        const br = (bh2 >>> 0) % 100;
        const distFromArena = Math.max(
          gx < 0 ? -gx : gx >= GRID_COLS ? gx - GRID_COLS + 1 : 0,
          gy < 0 ? -gy : gy >= GRID_ROWS ? gy - GRID_ROWS + 1 : 0,
        );
        const treeChance = distFromArena >= 2 ? 32 : 12;
        if (br < treeChance) {
          const isOak = (((gx + gy) % 2) + 2) % 2 === 0;
          drawToBorder(
            isOak ? 'tex:tree_oak' : 'tex:tree_pine',
            undefined,
            tileCenterX(gx),
            tileCenterY(gy) + TILE_SIZE * 0.45,
            1,
            0.5,
            1,
          );
        } else if (br < treeChance + 14) {
          drawToBorder(
            'deco:tallgrass',
            undefined,
            tileCenterX(gx),
            tileCenterY(gy),
            1.35,
          );
        } else if (br < treeChance + 19) {
          drawToBorder(
            'deco:stump',
            undefined,
            tileCenterX(gx),
            tileCenterY(gy),
            1.2,
          );
        } else if (br < treeChance + 24) {
          drawToBorder(
            'deco:sprout1',
            undefined,
            tileCenterX(gx),
            tileCenterY(gy),
            1,
          );
        }
      } else if (tile === 'grass') {
        let gh = Math.imul(gx ^ (gy << 7), 0x27d4eb2d);
        gh = Math.imul(gh ^ (gh >>> 15), 0x85ebca6b);
        const gr = (gh >>> 0) % 100;
        if (gr < 4) {
          addTerrain(
            scene.add
              .image(tileCenterX(gx), tileCenterY(gy), 'deco:sprout1')
              .setDepth(0.5),
          );
        } else if (gr < 7) {
          addTerrain(
            scene.add
              .image(tileCenterX(gx), tileCenterY(gy), 'deco:sprout2')
              .setDepth(0.5),
          );
        } else if (gr === 7) {
          addTerrain(
            scene.add
              .image(tileCenterX(gx), tileCenterY(gy), 'deco:sprout3')
              .setDepth(0.5),
          );
        } else if (gr === 8) {
          addTerrain(
            scene.add
              .image(tileCenterX(gx), tileCenterY(gy), 'deco:pebbles')
              .setDepth(0.5),
          );
        }
      } else if (tile === 'tree') {
        const isOak = (gx + gy) % 2 === 0;
        addTerrain(
          scene.add
            .image(
              tileCenterX(gx),
              tileCenterY(gy) + TILE_SIZE * 0.45,
              isOak ? 'tex:tree_oak' : 'tex:tree_pine',
            )
            .setOrigin(0.5, 1)
            .setDepth(4 + gy * 0.1 + 0.02),
        );
      }
    }
  }

  // Wild tall-grass clusters & tree stumps for natural route diversity
  const tallGrassCoords: Array<[number, number]> = [
    [3, 3],
    [4, 3],
    [3, 4],
    [GRID_COLS - 4, 3],
    [GRID_COLS - 5, 3],
    [GRID_COLS - 4, 4],
    [3, GRID_ROWS - 4],
    [4, GRID_ROWS - 4],
    [3, GRID_ROWS - 5],
    [GRID_COLS - 4, GRID_ROWS - 4],
    [GRID_COLS - 5, GRID_ROWS - 4],
    [GRID_COLS - 4, GRID_ROWS - 5],
    [11, 2],
    [12, 2],
    [15, 2],
    [16, 2],
    [11, GRID_ROWS - 3],
    [12, GRID_ROWS - 3],
    [15, GRID_ROWS - 3],
    [16, GRID_ROWS - 3],
    [4, 8],
    [4, 9],
    [5, 8],
    [GRID_COLS - 5, 8],
    [GRID_COLS - 5, 9],
    [GRID_COLS - 6, 9],
    [10, 7],
    [17, 10],
  ];
  for (const [gx, gy] of tallGrassCoords) {
    if (tiles[gy]?.[gx] === 'grass') {
      addTerrain(
        scene.add
          .image(tileCenterX(gx), tileCenterY(gy), 'deco:tallgrass')
          .setScale(1.4)
          .setDepth(0.6),
      );
    }
  }

  const stumpCoords: Array<[number, number]> = [
    [8, 2],
    [GRID_COLS - 9, 2],
    [9, 5],
    [GRID_COLS - 10, 5],
    [8, GRID_ROWS - 3],
    [GRID_COLS - 9, GRID_ROWS - 3],
  ];
  for (const [gx, gy] of stumpCoords) {
    if (tiles[gy]?.[gx] === 'grass') {
      addTerrain(
        scene.add
          .image(tileCenterX(gx), tileCenterY(gy), 'deco:stump')
          .setScale(1.25)
          .setDepth(0.8),
      );
    }
  }
  stamp.destroy();

  if (bakeBorder && borderOff) {
    const borderTex = scene.textures.createCanvas('border-baked', bw, bh);
    if (borderTex) {
      const ctx = borderTex.getContext();
      ctx.filter = 'blur(2px)';
      ctx.drawImage(borderOff, 0, 0);
      borderTex.refresh();
      borderTex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
  refs.borderBakedImg = scene.add
    .image(-BORDER_PAD_PX, -BORDER_PAD_PX, 'border-baked')
    .setOrigin(0, 0)
    .setScale(borderScale)
    .setDepth(-1);
}

export function renderGridAndMarkers(
  scene: Phaser.Scene,
): Phaser.GameObjects.Graphics {
  const gridG = scene.add.graphics().setDepth(1);
  gridG.lineStyle(1, 0xffffff, 0.08);
  for (let gx = 0; gx <= GRID_COLS; gx++) {
    gridG.lineBetween(gx * TILE_SIZE, 0, gx * TILE_SIZE, CANVAS_HEIGHT);
  }
  for (let gy = 0; gy <= GRID_ROWS; gy++) {
    gridG.lineBetween(0, gy * TILE_SIZE, CANVAS_WIDTH, gy * TILE_SIZE);
  }

  // Quarter-resolution blurred wilderness fog (16x less VRAM)
  const worldW = CANVAS_WIDTH + BORDER_PAD_PX * 2;
  const worldH = CANVAS_HEIGHT + BORDER_PAD_PX * 2;
  const fogScale = 4;
  const fogW = Math.ceil(worldW / fogScale);
  const fogH = Math.ceil(worldH / fogScale);
  if (!scene.textures.exists('arena-fog')) {
    const fogTex = scene.textures.createCanvas('arena-fog', fogW, fogH);
    if (fogTex) {
      const ctx = fogTex.getContext();
      const off = document.createElement('canvas');
      off.width = fogW;
      off.height = fogH;
      const octx = off.getContext('2d');
      if (octx) {
        octx.fillStyle = 'rgba(8, 13, 22, 0.45)';
        octx.fillRect(0, 0, fogW, fogH);
        octx.globalCompositeOperation = 'destination-out';
        octx.filter = 'blur(5px)';
        octx.fillStyle = '#000';
        octx.beginPath();
        octx.roundRect(
          BORDER_PAD_PX / fogScale,
          BORDER_PAD_PX / fogScale,
          CANVAS_WIDTH / fogScale,
          CANVAS_HEIGHT / fogScale,
          24 / fogScale,
        );
        octx.fill();
        ctx.drawImage(off, 0, 0);
        fogTex.refresh();
        fogTex.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
  }
  scene.add
    .image(-BORDER_PAD_PX, -BORDER_PAD_PX, 'arena-fog')
    .setOrigin(0, 0)
    .setScale(fogScale)
    .setDepth(8);

  return scene.add.graphics().setDepth(1.2);
}

export function refreshPortalVisuals(
  scene: Phaser.Scene,
  activePortals: SpawnPortal[],
  state: PortalVisualState,
  closingPortalId?: string,
): void {
  if (state.portalTween) {
    state.portalTween.stop();
    state.portalTween = null;
  }
  for (const m of state.portalMarkers) m.destroy();
  state.portalMarkers = [];
  state.portalGraphics.clear();

  for (const portal of activePortals) {
    const isClosing = Boolean(closingPortalId && portal.id === closingPortalId);
    const fillColor = isClosing ? 0xf59e0b : 0xd946ef;
    const strokeColor = isClosing ? 0xfbbf24 : 0xf43f5e;
    const ringColor = isClosing ? 0xfde68a : 0xf0abfc;
    const dirX = portal.side === 'west' ? 1 : portal.side === 'east' ? -1 : 0;
    const dirY = portal.side === 'north' ? 1 : portal.side === 'south' ? -1 : 0;

    for (const pt of portal.cells) {
      const marker = scene.add
        .rectangle(
          tileCenterX(pt.gx),
          tileCenterY(pt.gy),
          TILE_SIZE - 4,
          TILE_SIZE - 4,
          fillColor,
          0.24,
        )
        .setStrokeStyle(1.5, strokeColor, 0.85)
        .setDepth(1.1);
      state.portalMarkers.push(marker);

      const cx = tileCenterX(pt.gx);
      const cy = tileCenterY(pt.gy);
      state.portalGraphics.lineStyle(1.5, ringColor, 0.75);
      state.portalGraphics.strokeCircle(cx, cy, TILE_SIZE * 0.28);

      state.portalGraphics.lineStyle(2, 0xffffff, 0.95);
      if (dirX !== 0) {
        state.portalGraphics.lineBetween(
          cx - 4 * dirX,
          cy - 5,
          cx + 4 * dirX,
          cy,
        );
        state.portalGraphics.lineBetween(
          cx + 4 * dirX,
          cy,
          cx - 4 * dirX,
          cy + 5,
        );
      } else {
        state.portalGraphics.lineBetween(
          cx - 5,
          cy - 4 * dirY,
          cx,
          cy + 4 * dirY,
        );
        state.portalGraphics.lineBetween(
          cx,
          cy + 4 * dirY,
          cx + 5,
          cy - 4 * dirY,
        );
      }
    }

    // Draw 1-tile no-build buffer around this portal
    const drawnBuffer = new Set<string>();
    for (const pt of portal.cells) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const bx = pt.gx + dx;
        const by = pt.gy + dy;
        if (bx < 0 || bx >= GRID_COLS || by < 0 || by >= GRID_ROWS) continue;
        if (portal.cells.some((c) => c.gx === bx && c.gy === by)) continue;
        const bKey = `${bx},${by}`;
        if (drawnBuffer.has(bKey)) continue;
        drawnBuffer.add(bKey);
        const x = bx * TILE_SIZE;
        const y = by * TILE_SIZE;
        state.portalGraphics.lineStyle(1, 0xfb7185, 0.28);
        state.portalGraphics.strokeRect(
          x + 2,
          y + 2,
          TILE_SIZE - 4,
          TILE_SIZE - 4,
        );
      }
    }
  }

  if (state.portalMarkers.length > 0) {
    state.portalTween = scene.tweens.add({
      targets: state.portalMarkers,
      alpha: { from: 0.35, to: 0.9 },
      duration: 950,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

export function renderBastionCore(
  scene: Phaser.Scene,
): Phaser.GameObjects.Rectangle {
  const cx = (GRID_COLS / 2) * TILE_SIZE;
  const cy = (GRID_ROWS / 2) * TILE_SIZE;
  scene.add
    .image(cx, cy, 'tex:core')
    .setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2)
    .setDepth(4 + (GRID_ROWS / 2) * 0.1);

  scene.add
    .rectangle(cx, cy + TILE_SIZE + 6, 60, 6, 0x0f172a, 0.85)
    .setDepth(7);
  return scene.add
    .rectangle(cx - 29, cy + TILE_SIZE + 6, CORE_HP_BAR_WIDTH, 4, 0x22d3ee, 1)
    .setOrigin(0, 0.5)
    .setDepth(7);
}
