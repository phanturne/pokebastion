import Phaser from 'phaser';
import { BGM_ASSETS, SFX_ASSETS } from '../audio/sfx';

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

    this.load.spritesheet('ekat-route224', 'assets/tiles/ekat-route224.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.image('tex:core', 'assets/structures/core-pkcenter.png');
    this.load.image('tex:wood_wall', 'assets/structures/wood_wall.png');
    this.load.image('tex:stone_wall', 'assets/structures/stone_wall.png');
    this.load.image('tex:berry_bush', 'assets/structures/berry_bush.png');
    this.load.image('tex:barrel', 'assets/structures/barrel.png');
    this.load.image('tex:tree_oak', 'assets/structures/tree_oak.png');
    this.load.image('tex:tree_pine', 'assets/structures/tree_pine.png');
    this.load.image('deco:sprout1', 'assets/structures/deco_sprout_1.png');
    this.load.image('deco:sprout2', 'assets/structures/deco_sprout_2.png');
    this.load.image('deco:sprout3', 'assets/structures/deco_sprout_3.png');
    this.load.image('deco:pebbles', 'assets/structures/deco_stump.png');
    this.load.image('deco:stump', 'assets/structures/deco_real_stump.png');
    this.load.image('deco:tallgrass', 'assets/structures/deco_tall_grass.png');
    this.load.json('vfx-manifest', 'assets/vfx/manifest.json');
    this.load.json('poke-manifest', 'assets/pokemon/manifest.json');

    for (const [key, path] of Object.entries(SFX_ASSETS)) {
      this.load.audio(key, path);
    }
    for (const [key, path] of Object.entries(BGM_ASSETS)) {
      this.load.audio(key, path);
    }
  }

  create(): void {
    const vfxManifest =
      (this.cache.json.get('vfx-manifest') as Record<
        string,
        VfxManifestEntry
      >) ?? {};
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

    this.drawRuinedTexture(g);

    g.destroy();
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
