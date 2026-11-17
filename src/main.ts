import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BattleScene } from './scenes/BattleScene';
import { HudOverlay } from './ui/HudOverlay';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 864,
  height: 576,
  parent: 'phaser-host',
  pixelArt: true,
  backgroundColor: '#11161d',
  scene: [BootScene, BattleScene],
});

new HudOverlay(game);
