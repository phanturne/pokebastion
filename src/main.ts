import Phaser from 'phaser';
import './styles.css';
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
let resizeObserver: ResizeObserver | null = null;
if (host && typeof ResizeObserver !== 'undefined') {
  resizeObserver = new ResizeObserver(() => {
    if (host.clientWidth > 0 && host.clientHeight > 0) {
      game.scale.resize(host.clientWidth, host.clientHeight);
    }
  });
  resizeObserver.observe(host);
}

const hud = new HudOverlay(game);

game.events.once(Phaser.Core.Events.DESTROY, () => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  hud.destroy();
});
