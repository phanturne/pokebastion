import type Phaser from 'phaser';
import { POKEMON_SPECIES } from '../data/pokemon';
import type { GamePhase } from '../types';

export type BgmKey = 'bgm_prep' | 'bgm_combat';

export const BGM_ASSETS: Record<BgmKey, string> = {
  bgm_prep: 'assets/bgm/prep.ogg',
  bgm_combat: 'assets/bgm/combat.ogg',
};

const BGM_VOLUME = 0.22;

export type SfxKey =
  | 'ui_click'
  | 'ui_confirm'
  | 'ui_select'
  | 'coin'
  | 'wave_start'
  | 'wave_clear'
  | 'build'
  | 'crumble'
  | 'faint'
  | 'atk_electric'
  | 'ult_electric'
  | 'atk_fire'
  | 'ult_fire'
  | 'atk_water'
  | 'ult_water'
  | 'atk_melee'
  | 'ult_melee'
  | 'atk_magic'
  | 'ult_heal';

export const SFX_ASSETS: Record<SfxKey, string> = {
  ui_click: 'assets/sfx/ui_click.ogg',
  ui_confirm: 'assets/sfx/ui_confirm.ogg',
  ui_select: 'assets/sfx/ui_select.ogg',
  coin: 'assets/sfx/coin.wav',
  wave_start: 'assets/sfx/wave_start.mp3',
  wave_clear: 'assets/sfx/wave_clear.wav',
  build: 'assets/sfx/build.ogg',
  crumble: 'assets/sfx/crumble.ogg',
  faint: 'assets/sfx/faint.ogg',
  atk_electric: 'assets/sfx/atk_electric.ogg',
  ult_electric: 'assets/sfx/ult_electric.ogg',
  atk_fire: 'assets/sfx/atk_fire.ogg',
  ult_fire: 'assets/sfx/ult_fire.ogg',
  atk_water: 'assets/sfx/atk_water.ogg',
  ult_water: 'assets/sfx/ult_water.wav',
  atk_melee: 'assets/sfx/atk_melee.ogg',
  ult_melee: 'assets/sfx/ult_melee.wav',
  atk_magic: 'assets/sfx/atk_magic.ogg',
  ult_heal: 'assets/sfx/ult_heal.ogg',
};

const SFX_DEFAULT_VOLUME: Record<SfxKey, number> = {
  ui_click: 0.35,
  ui_confirm: 0.4,
  ui_select: 0.3,
  coin: 0.35,
  wave_start: 0.45,
  wave_clear: 0.45,
  build: 0.4,
  crumble: 0.4,
  faint: 0.35,
  atk_electric: 0.22,
  ult_electric: 0.45,
  atk_fire: 0.24,
  ult_fire: 0.45,
  atk_water: 0.24,
  ult_water: 0.4,
  atk_melee: 0.24,
  ult_melee: 0.4,
  atk_magic: 0.24,
  ult_heal: 0.45,
};

const MUTE_STORAGE_KEY = 'pokebastion:sfx_muted';

const SPECIES_ATTACK_SFX: Record<string, SfxKey> = {
  '0025': 'atk_electric', // Pikachu
  '0004': 'atk_fire', // Charmander
  '0007': 'atk_water', // Squirtle
  '0001': 'atk_magic', // Bulbasaur
  '0012': 'atk_magic', // Butterfree
  '0094': 'atk_magic', // Gengar
  '0143': 'atk_melee', // Snorlax
  '0074': 'atk_melee', // Geodude
  '0133': 'atk_melee', // Eevee
  '0448': 'atk_melee', // Lucario
};

const SPECIES_ULT_SFX: Record<string, SfxKey> = {
  '0025': 'ult_electric',
  '0004': 'ult_fire',
  '0007': 'ult_water',
  '0001': 'ult_heal',
  '0012': 'ult_heal',
  '0094': 'ult_electric',
  '0143': 'crumble',
  '0074': 'crumble',
  '0133': 'ult_melee',
  '0448': 'ult_melee',
};

export function getSpeciesAttackSfx(speciesId: string): SfxKey {
  const mapped = SPECIES_ATTACK_SFX[speciesId];
  if (mapped) return mapped;
  const vfx = POKEMON_SPECIES[speciesId]?.basicVfx ?? '';
  if (vfx.includes('lightning')) return 'atk_electric';
  if (vfx.includes('fire') || vfx.includes('explosion')) return 'atk_fire';
  if (vfx.includes('water')) return 'atk_water';
  if (
    vfx.includes('shadow') ||
    vfx.includes('nature') ||
    vfx.includes('holy')
  ) {
    return 'atk_magic';
  }
  return 'atk_melee';
}

export function getSpeciesUltSfx(speciesId: string): SfxKey {
  const mapped = SPECIES_ULT_SFX[speciesId];
  if (mapped) return mapped;
  const vfx = POKEMON_SPECIES[speciesId]?.ultVfx ?? '';
  if (vfx.includes('lightning')) return 'ult_electric';
  if (vfx.includes('fire') || vfx.includes('explosion')) return 'ult_fire';
  if (vfx.includes('water')) return 'ult_water';
  if (vfx.includes('heal')) return 'ult_heal';
  if (vfx.includes('rock') || vfx.includes('boulder')) return 'crumble';
  return 'ult_melee';
}

export class SfxPlayer {
  private readonly lastPlayedAt = new Map<SfxKey, number>();
  private muted: boolean;
  private currentBgmKey: BgmKey | null = null;
  private currentBgm: Phaser.Sound.BaseSound | null = null;
  private pendingBgmKey: BgmKey | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.muted = this.readStoredMute();
    this.scene.sound.mute = this.muted;
    this.scene.sound.once('unlocked', () => {
      if (this.pendingBgmKey) {
        const key = this.pendingBgmKey;
        this.pendingBgmKey = null;
        this.playBgm(key);
      }
    });
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.scene.sound.mute = this.muted;
    this.writeStoredMute(this.muted);
    if (!this.muted) {
      this.play('ui_click', 0);
      if (this.currentBgmKey && !this.currentBgm?.isPlaying) {
        const key = this.currentBgmKey;
        this.currentBgmKey = null;
        this.playBgm(key);
      }
    }
    return this.muted;
  }

  public syncPhaseBgm(phase: GamePhase): void {
    if (phase === 'COMBAT') {
      this.playBgm('bgm_combat');
    } else if (phase === 'VICTORY' || phase === 'DEFEAT') {
      this.stopBgm();
    } else {
      this.playBgm('bgm_prep');
    }
  }

  public playBgm(key: BgmKey): void {
    if (this.currentBgmKey === key && this.currentBgm?.isPlaying) return;
    if (!this.scene.cache.audio.exists(key)) return;

    if (this.scene.sound.locked) {
      this.pendingBgmKey = key;
      return;
    }

    this.stopBgm();
    this.currentBgmKey = key;
    this.currentBgm = this.scene.sound.add(key, {
      loop: true,
      volume: BGM_VOLUME,
    });
    this.currentBgm.play();
  }

  public stopBgm(): void {
    this.pendingBgmKey = null;
    this.currentBgmKey = null;
    if (this.currentBgm) {
      this.currentBgm.stop();
      this.currentBgm.destroy();
      this.currentBgm = null;
    }
  }

  public play(key: SfxKey, minIntervalMs = 70): void {
    if (this.muted) return;
    if (!this.scene.cache.audio.exists(key)) return;

    const now = performance.now();
    const prev = this.lastPlayedAt.get(key) ?? 0;
    if (minIntervalMs > 0 && now - prev < minIntervalMs) return;

    this.lastPlayedAt.set(key, now);
    this.scene.sound.play(key, { volume: SFX_DEFAULT_VOLUME[key] });
  }

  private readStoredMute(): boolean {
    try {
      return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private writeStoredMute(muted: boolean): void {
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // Ignore storage errors in restricted contexts.
    }
  }
}
