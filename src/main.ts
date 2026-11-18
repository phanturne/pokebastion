import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BattleScene } from './scenes/BattleScene';
import { HudOverlay } from './ui/HudOverlay';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'phaser-host',
  pixelArt: true,
  backgroundColor: '#11161d',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 896,
    height: 576,
    expandParent: false,
  },
  scene: [BootScene, BattleScene],
});

const host = document.getElementById('phaser-host');
if (host && typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => game.scale.refresh()).observe(host);
}

new HudOverlay(game);
