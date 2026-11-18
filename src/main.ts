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
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [BootScene, BattleScene],
});

const host = document.getElementById('phaser-host');
if (host && typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => {
    if (host.clientWidth > 0 && host.clientHeight > 0) {
      game.scale.resize(host.clientWidth, host.clientHeight);
    }
  }).observe(host);
}

new HudOverlay(game);
