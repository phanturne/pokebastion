import Phaser from 'phaser';

interface VfxManifestEntry {
  path: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  frameRate: number;
  loop: boolean;
}

type PokeAnimName = 'Walk' | 'Idle' | 'Attack';

interface PokeAnimEntry {
  frameWidth: number;
  frameHeight: number;
  frames: number;
  frameRate: number;
}

const POKE_ANIMS: readonly PokeAnimName[] = ['Walk', 'Idle', 'Attack'];
const PMD_DIRECTIONS = 8;

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;
    this.add
      .text(cx, cy, 'Loading PokéBastion Assets...', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#e2e8f0',
      })
      .setOrigin(0.5);

    this.load.spritesheet('mpwsp01', 'assets/tiles/mpwsp01-tileset.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.json('vfx-manifest', 'assets/vfx/manifest.json');
    this.load.json('poke-manifest', 'assets/pokemon/manifest.json');
  }

  create(): void {
    const vfxManifest =
      (this.cache.json.get('vfx-manifest') as Record<string, VfxManifestEntry>) ?? {};
    const pokeManifest =
      (this.cache.json.get('poke-manifest') as Record<
        string,
        Record<PokeAnimName, PokeAnimEntry>
      >) ?? {};

    this.generateProceduralTextures();

    for (const [effectKey, entry] of Object.entries(vfxManifest)) {
      this.load.spritesheet(`vfx:${effectKey}`, entry.path, {
        frameWidth: entry.frameWidth,
        frameHeight: entry.frameHeight,
      });
    }

    for (const [id, anims] of Object.entries(pokeManifest)) {
      for (const animName of POKE_ANIMS) {
        const anim = anims[animName];
        if (!anim) continue;
        this.load.spritesheet(
          `pmd:${id}:${animName}`,
          `assets/pokemon/${id}/${animName}-Anim.png`,
          {
            frameWidth: anim.frameWidth,
            frameHeight: anim.frameHeight,
          },
        );
      }
    }

    this.load.once('complete', () => {
      this.registerAnimations(vfxManifest, pokeManifest);
      this.scene.start('BattleScene');
    });

    this.load.start();
  }

  private registerAnimations(
    vfxManifest: Record<string, VfxManifestEntry>,
    pokeManifest: Record<string, Record<PokeAnimName, PokeAnimEntry>>,
  ): void {
    for (const [effectKey, entry] of Object.entries(vfxManifest)) {
      const animKey = `anim:vfx:${effectKey}`;
      if (this.anims.exists(animKey) || entry.frames <= 0) continue;

      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(`vfx:${effectKey}`, {
          start: 0,
          end: entry.frames - 1,
        }),
        frameRate: entry.frameRate,
        repeat: entry.loop ? -1 : 0,
      });
    }

    for (const [id, anims] of Object.entries(pokeManifest)) {
      for (const animName of POKE_ANIMS) {
        const anim = anims[animName];
        if (!anim || anim.frames <= 0) continue;

        const sheetKey = `pmd:${id}:${animName}`;
        const repeat = animName === 'Attack' ? 0 : -1;

        for (let dir = 0; dir < PMD_DIRECTIONS; dir++) {
          const animKey = `anim:pmd:${id}:${animName}:${dir}`;
          if (this.anims.exists(animKey)) continue;

          const start = dir * anim.frames;
          const end = start + anim.frames - 1;
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(sheetKey, { start, end }),
            frameRate: anim.frameRate,
            repeat,
          });
        }
      }
    }
  }

  private generateProceduralTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    this.drawCoreTexture(g);
    this.drawWoodWallTexture(g);
    this.drawStoneWallTexture(g);
    this.drawBerryBushTexture(g);
    this.drawBarrelTexture(g);
    this.drawRuinedTexture(g);

    g.destroy();
  }

  private drawCoreTexture(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    // Outer cyan aura rings
    g.fillStyle(0x06b6d4, 0.16);
    g.fillCircle(48, 48, 44);
    g.fillStyle(0x22d3ee, 0.24);
    g.fillCircle(48, 48, 34);

    // Gold pedestal octagon ring
    g.lineStyle(3, 0xfbbf24, 0.95);
    g.strokeCircle(48, 48, 30);
    g.fillStyle(0x0f172a, 0.85);
    g.fillCircle(48, 48, 27);

    // Gold cardinal prongs
    g.fillStyle(0xf59e0b, 1);
    g.fillRect(45, 10, 6, 10);
    g.fillRect(45, 76, 6, 10);
    g.fillRect(10, 45, 10, 6);
    g.fillRect(76, 45, 10, 6);

    // Crystal facets (cyan + bright core)
    g.fillStyle(0x0891b2, 1);
    g.fillTriangle(48, 16, 70, 48, 48, 80);
    g.fillStyle(0x22d3ee, 1);
    g.fillTriangle(48, 16, 26, 48, 48, 80);
    g.fillStyle(0xa5f3fc, 0.95);
    g.fillTriangle(48, 24, 36, 48, 48, 54);
    g.fillStyle(0xfef08a, 0.95);
    g.fillCircle(48, 48, 7);
    g.lineStyle(2, 0xfde047, 1);
    g.strokeTriangle(48, 16, 70, 48, 48, 80);
    g.strokeTriangle(48, 16, 26, 48, 48, 80);

    g.generateTexture('tex:core', 96, 96);
  }

  private drawWoodWallTexture(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    // Base shadow
    g.fillStyle(0x1c1917, 0.45);
    g.fillRoundedRect(4, 38, 40, 8, 3);

    // Vertical palisade logs
    const logXs = [5, 14, 23, 32];
    for (const lx of logXs) {
      g.fillStyle(0x78350f, 1);
      g.fillRect(lx, 10, 8, 32);
      g.fillStyle(0x92400e, 1);
      g.fillRect(lx + 1, 10, 4, 30);
      // Pointed top
      g.fillStyle(0xb45309, 1);
      g.fillTriangle(lx, 10, lx + 4, 3, lx + 8, 10);
      g.lineStyle(1, 0x451a03, 1);
      g.strokeRect(lx, 10, 8, 32);
    }

    // Horizontal crossbeams + iron nails
    g.fillStyle(0x57280a, 1);
    g.fillRect(3, 17, 42, 5);
    g.fillRect(3, 31, 42, 5);
    g.lineStyle(1, 0x291507, 1);
    g.strokeRect(3, 17, 42, 5);
    g.strokeRect(3, 31, 42, 5);

    g.fillStyle(0xd6d3d1, 1);
    for (const lx of logXs) {
      g.fillRect(lx + 3, 19, 2, 2);
      g.fillRect(lx + 3, 33, 2, 2);
    }

    g.generateTexture('tex:wood_wall', 48, 48);
  }

  private drawStoneWallTexture(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    // Base block
    g.fillStyle(0x334155, 1);
    g.fillRoundedRect(3, 4, 42, 40, 4);

    // Top bevel highlight
    g.fillStyle(0x94a3b8, 1);
    g.fillRect(4, 5, 40, 6);

    // Stone brick courses
    g.fillStyle(0x64748b, 1);
    g.fillRect(5, 12, 18, 9);
    g.fillRect(25, 12, 18, 9);
    g.fillRect(5, 23, 11, 9);
    g.fillRect(18, 23, 16, 9);
    g.fillRect(36, 23, 7, 9);
    g.fillRect(5, 34, 20, 8);
    g.fillRect(27, 34, 16, 8);

    // Crenellation notches on top
    g.fillStyle(0x475569, 1);
    g.fillRect(5, 3, 10, 5);
    g.fillRect(19, 3, 10, 5);
    g.fillRect(33, 3, 10, 5);

    // Crisp dark mortar outline
    g.lineStyle(2, 0x1e293b, 1);
    g.strokeRoundedRect(3, 4, 42, 40, 4);

    g.generateTexture('tex:stone_wall', 48, 48);
  }

  private drawBerryBushTexture(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    // Shadow
    g.fillStyle(0x052e16, 0.45);
    g.fillEllipse(24, 40, 36, 10);

    // Foliage clusters
    g.fillStyle(0x14532d, 1);
    g.fillCircle(16, 28, 12);
    g.fillCircle(32, 28, 12);
    g.fillCircle(24, 19, 14);

    g.fillStyle(0x16a34a, 1);
    g.fillCircle(15, 25, 9);
    g.fillCircle(32, 26, 9);
    g.fillCircle(24, 17, 11);

    g.fillStyle(0x4ade80, 0.85);
    g.fillCircle(21, 13, 6);
    g.fillCircle(13, 22, 4);

    // Red/pink healing berries
    const berries: Array<[number, number, number]> = [
      [14, 24, 0xf43f5e],
      [25, 16, 0xfb7185],
      [33, 25, 0xe11d48],
      [22, 29, 0xf43f5e],
      [29, 19, 0xfda4af],
    ];
    for (const [bx, by, color] of berries) {
      g.fillStyle(color, 1);
      g.fillCircle(bx, by, 3.5);
      g.fillStyle(0xffe4e6, 1);
      g.fillCircle(bx - 1, by - 1, 1.2);
    }

    g.generateTexture('tex:berry_bush', 48, 48);
  }

  private drawBarrelTexture(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    // Shadow
    g.fillStyle(0x1c1917, 0.45);
    g.fillEllipse(24, 42, 28, 8);

    // Barrel body
    g.fillStyle(0x991b1b, 1);
    g.fillRoundedRect(11, 8, 26, 33, 6);
    g.fillStyle(0xdc2626, 1);
    g.fillRoundedRect(13, 10, 14, 29, 4);

    // Top rim
    g.fillStyle(0x7f1d1d, 1);
    g.fillEllipse(24, 10, 24, 7);
    g.lineStyle(2, 0x450a0a, 1);
    g.strokeRoundedRect(11, 8, 26, 33, 6);

    // Amber hazard band
    g.fillStyle(0xf59e0b, 1);
    g.fillRect(11, 20, 26, 9);
    // Diagonal hazard stripes
    g.fillStyle(0x1c1917, 1);
    g.fillTriangle(13, 29, 18, 20, 22, 20);
    g.fillTriangle(13, 29, 22, 20, 17, 29);
    g.fillTriangle(25, 29, 30, 20, 34, 20);
    g.fillTriangle(25, 29, 34, 20, 29, 29);

    // Metal hoops
    g.fillStyle(0x475569, 1);
    g.fillRect(10, 14, 28, 3);
    g.fillRect(10, 32, 28, 3);

    g.generateTexture('tex:barrel', 48, 48);
  }

  private drawRuinedTexture(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    // Scorched / cracked dark rubble overlay
    g.fillStyle(0x0f172a, 0.45);
    g.fillRoundedRect(4, 6, 40, 38, 4);

    // Rubble chunks
    g.fillStyle(0x475569, 0.95);
    g.fillRect(8, 30, 10, 8);
    g.fillRect(21, 33, 12, 7);
    g.fillRect(32, 27, 8, 9);
    g.fillRect(14, 22, 9, 7);

    // Jagged fracture lines
    g.lineStyle(2, 0x020617, 0.95);
    g.beginPath();
    g.moveTo(10, 10);
    g.lineTo(22, 20);
    g.lineTo(18, 32);
    g.lineTo(28, 40);
    g.moveTo(22, 20);
    g.lineTo(36, 15);
    g.moveTo(30, 25);
    g.lineTo(40, 34);
    g.strokePath();

    // Subtle ash highlights
    g.lineStyle(1, 0x94a3b8, 0.65);
    g.strokeRect(9, 30, 9, 7);
    g.strokeRect(22, 33, 10, 6);

    g.generateTexture('tex:ruined', 48, 48);
  }
}
