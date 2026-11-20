import { POKEMON_SPECIES } from '../data/pokemon';
import { HazardKind, MovementType } from '../types';
import { getSpeciesTypes } from './typeChart';

export type UltMode =
  'aoe' | 'heal_aoe' | 'sniper' | 'hazard' | 'chain_storm' | 'knockback_aoe';

export interface SpeciesKit {
  // Mobility
  canTeleport?: boolean;
  // Auras projected to nearby living allies (Chebyshev <= auraRadius)
  auraAtkPct?: number;
  auraDefPct?: number;
  auraSpdPct?: number;
  auraRegenPerSec?: number;
  auraRadius?: number;
  // Self stat passives
  nearWallOrWaterDefPct?: number;
  nearWallOnlyDefPct?: number;
  stationaryDrPct?: number;
  stationaryAtkPct?: number;
  atkSpdBonusPct?: number;
  ultChargeBonusPct?: number;
  ultChargeOnHitTaken?: number;
  soloAtkPct?: number;
  packAtkPerAllyPct?: number;
  // Basic attack modifiers & on-hit effects
  critEveryN?: number;
  critMult?: number;
  armorPiercePct?: number;
  statusBonusDmgPct?: number;
  executeBonusDmgPct?: number;
  antiAirBonusPct?: number;
  onHitBurn?: { dps: number; durationMs: number };
  onHitPoison?: { dps: number; durationMs: number };
  onHitSlowMs?: number;
  onHitStunEveryN?: { everyN: number; durationMs: number };
  onHitChain?: { dmgRatio: number; targets: number };
  onHitSplash?: { dmgRatio: number; radius: number };
  onHitLifestealPct?: number;
  thornsPct?: number;
  // Ultimate mechanics
  ultMode?: UltMode;
  ultPowerMult?: number;
  ultRange?: number;
  ultRadius?: number;
  ultHazardKind?: HazardKind;
  ultStunMs?: number;
  ultSlowMs?: number;
  ultBurn?: { dps: number; durationMs: number };
  ultPoison?: { dps: number; durationMs: number };
  ultKnockback?: boolean;
  ultExecuteBonusPct?: number;
  ultKillRefundRatio?: number;
  ultHealSelfRatio?: number;
  // Passive entry hazard placement
  passiveHazardKind?: HazardKind;
}

export const HAZARD_SPECS: Record<
  HazardKind,
  {
    name: string;
    desc: string;
    charges: number;
    ttlMs: number;
    hitsFlying: boolean;
    slowMs: number;
    poisonDps: number;
    poisonMs: number;
  }
> = {
  stealth_rock: {
    name: 'Stealth Rock',
    desc: 'Jagged stones that pierce advancing foes (2x vs Flying).',
    charges: 5,
    ttlMs: 18000,
    hitsFlying: true,
    slowMs: 0,
    poisonDps: 0,
    poisonMs: 0,
  },
  spikes: {
    name: 'Spikes',
    desc: 'Sharp caltrops that damage and briefly slow ground foes.',
    charges: 5,
    ttlMs: 18000,
    hitsFlying: false,
    slowMs: 1200,
    poisonDps: 0,
    poisonMs: 0,
  },
  toxic_spikes: {
    name: 'Toxic Spikes',
    desc: 'Venomous barbs that poison and slow ground foes.',
    charges: 5,
    ttlMs: 18000,
    hitsFlying: false,
    slowMs: 1000,
    poisonDps: 9,
    poisonMs: 4000,
  },
  sticky_web: {
    name: 'Sticky Web',
    desc: 'Dense silk snare that heavily slows ground foes.',
    charges: 6,
    ttlMs: 18000,
    hitsFlying: false,
    slowMs: 3500,
    poisonDps: 0,
    poisonMs: 0,
  },
};

export function computeHazardDamage(
  kind: HazardKind,
  enemyMaxHp: number,
  movementType: MovementType,
  casterAtk: number,
): number {
  const spec = HAZARD_SPECS[kind];
  if (!spec.hitsFlying && movementType === 'fly') return 0;

  if (kind === 'stealth_rock') {
    const base = Math.max(
      Math.round(casterAtk * 0.9),
      Math.round(enemyMaxHp * 0.08),
    );
    return movementType === 'fly' ? base * 2 : base;
  }
  if (kind === 'spikes') {
    return Math.max(
      Math.round(casterAtk * 0.85),
      Math.round(enemyMaxHp * 0.07),
    );
  }
  if (kind === 'toxic_spikes') {
    return Math.max(
      Math.round(casterAtk * 0.45),
      Math.round(enemyMaxHp * 0.03),
    );
  }
  // sticky_web deals light impact damage + heavy slow
  return Math.max(6, Math.round(casterAtk * 0.25));
}

/**
 * Handcrafted kits for iconic Pokémon inspired by their mainline movesets & lore.
 */
export const SIGNATURE_KITS: Record<string, SpeciesKit> = {
  // Starters & Evolutions
  '0001': {
    // Bulbasaur: Sweet Scent / Synthesis + Overgrow Aura
    auraAtkPct: 0.1,
    auraRadius: 2,
    ultMode: 'heal_aoe',
    onHitLifestealPct: 0.1,
  },
  '0002': {
    // Ivysaur
    auraAtkPct: 0.12,
    auraRadius: 2,
    ultMode: 'heal_aoe',
    onHitPoison: { dps: 5, durationMs: 3000 },
  },
  '0003': {
    // Venusaur: Thick Fat + Overgrow Canopy + Solar/Synthesis
    auraAtkPct: 0.15,
    auraRadius: 2,
    stationaryDrPct: 0.12,
    ultMode: 'heal_aoe',
    onHitPoison: { dps: 7, durationMs: 3000 },
  },
  '0004': {
    // Charmander: Blaze + Ember
    onHitBurn: { dps: 6, durationMs: 3000 },
    ultBurn: { dps: 8, durationMs: 3500 },
  },
  '0005': {
    // Charmeleon
    onHitBurn: { dps: 8, durationMs: 3000 },
    critEveryN: 5,
    ultBurn: { dps: 10, durationMs: 4000 },
  },
  '0006': {
    // Charizard: Drought / Inferno
    onHitBurn: { dps: 10, durationMs: 3500 },
    onHitSplash: { dmgRatio: 0.35, radius: 1.5 },
    ultBurn: { dps: 14, durationMs: 4000 },
    ultPowerMult: 1.15,
  },
  '0007': {
    // Squirtle: Shell Guard + Hydro Knockback
    nearWallOrWaterDefPct: 0.25,
    onHitSlowMs: 1400,
    ultMode: 'knockback_aoe',
    ultKnockback: true,
  },
  '0008': {
    // Wartortle
    nearWallOrWaterDefPct: 0.28,
    onHitSlowMs: 1800,
    ultMode: 'knockback_aoe',
    ultKnockback: true,
  },
  '0009': {
    // Blastoise: Mega Bastion + Rain Dish Aura
    nearWallOrWaterDefPct: 0.3,
    auraDefPct: 0.15,
    auraRadius: 2,
    onHitSplash: { dmgRatio: 0.35, radius: 1.4 },
    ultMode: 'knockback_aoe',
    ultKnockback: true,
  },

  // Sticky Web / Bug Status & Web
  '0010': {
    // Caterpie: String Shot (Sticky Web)
    onHitSlowMs: 2200,
    ultMode: 'hazard',
    ultHazardKind: 'sticky_web',
  },
  '0011': {
    // Metapod: Harden
    stationaryDrPct: 0.25,
    thornsPct: 0.25,
  },
  '0012': {
    // Butterfree: Compound Eyes Sleep/Slow Powder
    onHitSlowMs: 3000,
    ultMode: 'heal_aoe',
    ultSlowMs: 3500,
    ultStunMs: 1500,
  },
  '0013': {
    onHitPoison: { dps: 5, durationMs: 3000 },
    ultPoison: { dps: 7, durationMs: 4000 },
  },
  '0014': {
    stationaryDrPct: 0.2,
    thornsPct: 0.2,
    onHitPoison: { dps: 6, durationMs: 3000 },
  },
  '0015': {
    // Beedrill: Sniper Fell Stinger (Manual Priority Ult!)
    critEveryN: 4,
    onHitPoison: { dps: 7, durationMs: 3000 },
    ultMode: 'sniper',
    ultRange: 14,
    ultRadius: 1.1,
    ultPowerMult: 2.3,
    ultExecuteBonusPct: 0.35,
    ultKillRefundRatio: 0.5,
  },

  // Bird Snipers (Manual Priority Ult!)
  '0016': { antiAirBonusPct: 0.2, atkSpdBonusPct: 0.1 },
  '0017': { antiAirBonusPct: 0.25, atkSpdBonusPct: 0.12 },
  '0018': {
    // Pidgeot: Sky Attack Sniper
    antiAirBonusPct: 0.3,
    stationaryAtkPct: 0.15,
    ultMode: 'sniper',
    ultRange: 14,
    ultRadius: 1.2,
    ultPowerMult: 2.3,
  },
  '0021': { antiAirBonusPct: 0.2, critEveryN: 5 },
  '0022': {
    // Fearow: Drill Peck Sniper
    antiAirBonusPct: 0.35,
    armorPiercePct: 0.2,
    ultMode: 'sniper',
    ultRange: 14,
    ultRadius: 1.1,
    ultPowerMult: 2.25,
  },

  // Pikachu & Raichu
  '0025': {
    ultChargeBonusPct: 0.1,
    onHitChain: { dmgRatio: 0.35, targets: 1 },
  },
  '0026': {
    ultChargeBonusPct: 0.2,
    onHitChain: { dmgRatio: 0.45, targets: 2 },
    onHitStunEveryN: { everyN: 5, durationMs: 700 },
    antiAirBonusPct: 0.25,
    ultMode: 'chain_storm',
  },

  // Sandshrew / Sandslash (Spikes Setter)
  '0027': {
    nearWallOnlyDefPct: 0.2,
    thornsPct: 0.2,
  },
  '0028': {
    thornsPct: 0.25,
    passiveHazardKind: 'spikes',
    ultMode: 'hazard',
    ultHazardKind: 'spikes',
  },

  // Nido Family
  '0031': {
    // Nidoqueen: Royal Guard DEF Aura + Poison
    auraDefPct: 0.14,
    auraRadius: 2,
    onHitPoison: { dps: 7, durationMs: 3000 },
    ultMode: 'knockback_aoe',
    ultKnockback: true,
  },
  '0034': {
    // Nidoking: Sheer Force Aura + Armor Pierce
    auraAtkPct: 0.12,
    auraRadius: 2,
    armorPiercePct: 0.2,
  },

  // Support Auras (Clefable, Wigglytuff, Chansey)
  '0035': { auraRegenPerSec: 3, auraRadius: 2, ultMode: 'heal_aoe' },
  '0036': {
    auraDefPct: 0.15,
    auraRegenPerSec: 4,
    auraRadius: 2,
    ultChargeOnHitTaken: 18,
    ultMode: 'heal_aoe',
  },
  '0039': { onHitSlowMs: 1800, ultStunMs: 1600 },
  '0040': {
    auraRegenPerSec: 4,
    auraRadius: 2,
    ultChargeOnHitTaken: 18,
    ultMode: 'heal_aoe',
    ultStunMs: 1500,
  },

  // Poison / Lifesteal / Status
  '0041': { onHitLifestealPct: 0.18, antiAirBonusPct: 0.15 },
  '0042': {
    onHitLifestealPct: 0.22,
    onHitPoison: { dps: 6, durationMs: 3000 },
  },
  '0046': {
    onHitPoison: { dps: 6, durationMs: 3000 },
    onHitLifestealPct: 0.15,
  },
  '0047': {
    onHitPoison: { dps: 8, durationMs: 3500 },
    onHitLifestealPct: 0.22,
    ultSlowMs: 2800,
  },
  '0048': { statusBonusDmgPct: 0.2, onHitPoison: { dps: 6, durationMs: 3000 } },
  '0049': {
    statusBonusDmgPct: 0.25,
    onHitPoison: { dps: 9, durationMs: 3500 },
    ultPoison: { dps: 12, durationMs: 4000 },
    ultSlowMs: 2500,
  },

  // Poliwag Line (Water Absorb)
  '0060': { onHitSlowMs: 1500, ultHealSelfRatio: 0.15, ultSlowMs: 2500 },
  '0061': { onHitSlowMs: 1800, ultHealSelfRatio: 0.2, ultSlowMs: 3000 },
  '0062': {
    onHitSlowMs: 2000,
    ultHealSelfRatio: 0.25,
    ultMode: 'knockback_aoe',
    ultKnockback: true,
  },

  // Psychic Teleporters!
  '0063': {
    // Abra: Instant Teleport!
    canTeleport: true,
    onHitChain: { dmgRatio: 0.3, targets: 1 },
  },
  '0064': {
    // Kadabra: Instant Teleport + Psychic Confusion
    canTeleport: true,
    armorPiercePct: 0.15,
    onHitChain: { dmgRatio: 0.35, targets: 1 },
  },
  '0065': {
    // Alakazam: Instant Teleport + Armor-Piercing Sniper Future Sight!
    canTeleport: true,
    armorPiercePct: 0.25,
    ultMode: 'sniper',
    ultRange: 14,
    ultRadius: 1.2,
    ultPowerMult: 2.4,
  },

  // Tentacool / Tentacruel (Acid Rain & Slow)
  '0072': {
    onHitSlowMs: 1800,
    onHitPoison: { dps: 6, durationMs: 3000 },
    ultSlowMs: 3000,
  },
  '0073': {
    onHitSlowMs: 2200,
    onHitPoison: { dps: 9, durationMs: 3500 },
    ultSlowMs: 3500,
    ultPoison: { dps: 10, durationMs: 4000 },
  },

  // Geodude / Graveler / Golem (Wall-Synergy Juggernauts)
  '0074': {
    nearWallOnlyDefPct: 0.3,
  },
  '0075': {
    nearWallOnlyDefPct: 0.3,
    stationaryDrPct: 0.12,
  },
  '0076': {
    nearWallOnlyDefPct: 0.35,
    stationaryDrPct: 0.18,
    ultMode: 'knockback_aoe',
    ultKnockback: true,
    ultStunMs: 1200,
  },

  // Slowpoke / Slowbro (Defensive Recovery Tanks)
  '0079': {
    stationaryDrPct: 0.18,
    ultChargeOnHitTaken: 20,
    ultMode: 'heal_aoe',
  },
  '0080': {
    stationaryDrPct: 0.22,
    ultChargeOnHitTaken: 20,
    ultMode: 'heal_aoe',
    ultSlowMs: 2500,
  },

  // Shellder / Cloyster (Shell Armor & Thorns)
  '0090': { nearWallOrWaterDefPct: 0.25, onHitSlowMs: 1500 },
  '0091': {
    nearWallOrWaterDefPct: 0.3,
    thornsPct: 0.25,
    onHitSlowMs: 2000,
    ultSlowMs: 3200,
  },

  // Ghost Line (Haunter & Gengar have Instant Teleport; Gastly uses Hex)
  '0092': {
    onHitPoison: { dps: 6, durationMs: 3000 },
    statusBonusDmgPct: 0.2,
  },
  '0093': {
    canTeleport: true,
    onHitPoison: { dps: 8, durationMs: 3500 },
    statusBonusDmgPct: 0.3,
  },
  '0094': {
    canTeleport: true,
    statusBonusDmgPct: 0.35,
    onHitPoison: { dps: 9, durationMs: 3500 },
    ultPoison: { dps: 12, durationMs: 4000 },
  },

  // Onix (Stealth Rock Setter)
  '0095': {
    nearWallOnlyDefPct: 0.25,
    passiveHazardKind: 'stealth_rock',
    ultMode: 'hazard',
    ultHazardKind: 'stealth_rock',
  },

  // Drowzee / Hypno (Hypnosis & Dream Eater)
  '0096': { onHitSlowMs: 1800, ultStunMs: 1600 },
  '0097': {
    onHitStunEveryN: { everyN: 5, durationMs: 900 },
    ultStunMs: 2000,
  },

  // Hitmonlee (Sniper High Jump Kick)
  '0106': {
    critEveryN: 4,
    executeBonusDmgPct: 0.25,
    ultMode: 'sniper',
    ultRange: 10,
    ultRadius: 1.1,
    ultPowerMult: 2.4,
  },

  // Koffing / Weezing (Toxic Spikes)
  '0109': {
    onHitPoison: { dps: 7, durationMs: 3500 },
    thornsPct: 0.2,
    ultMode: 'hazard',
    ultHazardKind: 'toxic_spikes',
  },
  '0110': {
    onHitPoison: { dps: 10, durationMs: 4000 },
    onHitSplash: { dmgRatio: 0.35, radius: 1.4 },
    passiveHazardKind: 'toxic_spikes',
    ultMode: 'hazard',
    ultHazardKind: 'toxic_spikes',
  },

  // Rhyhorn / Rhydon (Armored Horn Drill)
  '0111': {
    nearWallOnlyDefPct: 0.25,
    armorPiercePct: 0.15,
  },
  '0112': {
    armorPiercePct: 0.25,
    critEveryN: 4,
    ultMode: 'knockback_aoe',
    ultKnockback: true,
  },

  // Chansey (Defensive Recovery Healer + Regen Aura)
  '0113': {
    auraRegenPerSec: 6,
    auraRadius: 2,
    ultChargeOnHitTaken: 22,
    ultMode: 'heal_aoe',
  },

  // Tangela (Sticky Web)
  '0114': {
    onHitSlowMs: 2000,
    passiveHazardKind: 'sticky_web',
    ultMode: 'hazard',
    ultHazardKind: 'sticky_web',
  },

  // Mr. Mime (Barrier DEF Aura)
  '0122': {
    auraDefPct: 0.18,
    auraRadius: 2,
  },

  // Scyther / Pinsir
  '0123': { atkSpdBonusPct: 0.2, critEveryN: 4, soloAtkPct: 0.15 },
  '0127': {
    // Pinsir: Guillotine Sniper Execute!
    executeBonusDmgPct: 0.3,
    ultMode: 'sniper',
    ultRange: 10,
    ultRadius: 1.1,
    ultPowerMult: 2.35,
    ultExecuteBonusPct: 0.45,
  },

  // Gyarados / Lapras
  '0130': {
    executeBonusDmgPct: 0.25,
    onHitSplash: { dmgRatio: 0.35, radius: 1.5 },
    ultMode: 'knockback_aoe',
    ultKnockback: true,
  },
  '0131': {
    auraDefPct: 0.15,
    auraRadius: 2,
    onHitSlowMs: 2200,
    ultHealSelfRatio: 0.2,
    ultSlowMs: 3500,
  },

  // Eevee & Eeveelutions
  '0133': { atkSpdBonusPct: 0.2, packAtkPerAllyPct: 0.05 },
  '0134': {
    nearWallOrWaterDefPct: 0.25,
    ultHealSelfRatio: 0.25,
    ultMode: 'heal_aoe',
  },
  '0135': {
    auraSpdPct: 0.15,
    auraRadius: 2,
    thornsPct: 0.2,
    onHitChain: { dmgRatio: 0.4, targets: 2 },
  },
  '0136': {
    onHitBurn: { dps: 10, durationMs: 3500 },
    onHitSplash: { dmgRatio: 0.35, radius: 1.4 },
    ultBurn: { dps: 14, durationMs: 4000 },
  },

  // Fossils (Omastar / Kabutops / Aerodactyl Sniper)
  '0138': {
    nearWallOrWaterDefPct: 0.2,
    onHitSlowMs: 1500,
  },
  '0139': {
    nearWallOrWaterDefPct: 0.25,
    onHitSlowMs: 2000,
    ultSlowMs: 3000,
  },
  '0140': {
    onHitLifestealPct: 0.15,
    atkSpdBonusPct: 0.12,
  },
  '0141': {
    onHitLifestealPct: 0.2,
    critEveryN: 4,
    atkSpdBonusPct: 0.2,
  },
  '0142': {
    // Aerodactyl: Ancient Sky Drop Sniper!
    antiAirBonusPct: 0.3,
    executeBonusDmgPct: 0.2,
    ultMode: 'sniper',
    ultRange: 16,
    ultRadius: 1.2,
    ultPowerMult: 2.4,
  },

  // Snorlax (Defensive Recovery Juggernaut)
  '0143': {
    stationaryDrPct: 0.25,
    ultChargeOnHitTaken: 20,
    ultMode: 'knockback_aoe',
    ultKnockback: true,
    ultStunMs: 1500,
  },

  // Legendary Birds & Mewtwo / Mew / Dragonite / Lucario
  '0144': {
    // Articuno: Sheer Cold
    onHitSlowMs: 2800,
    ultSlowMs: 4000,
    ultStunMs: 1500,
  },
  '0145': {
    // Zapdos: Thunder Chain Storm
    ultChargeBonusPct: 0.2,
    onHitChain: { dmgRatio: 0.5, targets: 2 },
    antiAirBonusPct: 0.25,
    ultMode: 'chain_storm',
    ultPowerMult: 1.25,
  },
  '0146': {
    // Moltres: Sky Inferno
    onHitBurn: { dps: 14, durationMs: 4000 },
    onHitSplash: { dmgRatio: 0.4, radius: 1.6 },
    ultBurn: { dps: 18, durationMs: 4500 },
  },
  '0147': {
    // Dratini: Shed Skin + Dragon Pulse
    armorPiercePct: 0.15,
    atkSpdBonusPct: 0.1,
  },
  '0148': {
    // Dragonair: Dragon Rage + Rain/Aura
    armorPiercePct: 0.2,
    onHitSplash: { dmgRatio: 0.25, radius: 1.2 },
    ultSlowMs: 2500,
  },
  '0149': {
    // Dragonite: Multiscale + Outrage
    stationaryDrPct: 0.2,
    onHitSplash: { dmgRatio: 0.35, radius: 1.5 },
    ultPowerMult: 1.2,
  },
  '0150': {
    // Mewtwo: Instant Teleport + Psystrike Sniper!
    canTeleport: true,
    soloAtkPct: 0.2,
    armorPiercePct: 0.3,
    ultMode: 'sniper',
    ultRange: 16,
    ultRadius: 1.4,
    ultPowerMult: 2.6,
  },
  '0151': {
    // Mew: Instant Teleport + Versatile Aura + Genesis Bloom
    canTeleport: true,
    auraAtkPct: 0.1,
    auraSpdPct: 0.1,
    auraRadius: 2,
    ultChargeBonusPct: 0.15,
    ultMode: 'heal_aoe',
  },
  '0448': {
    // Lucario: Every 4th hit guaranteed crit + Aura Storm
    critEveryN: 4,
    critMult: 1.75,
  },
};

const kitCache = new Map<string, SpeciesKit>();

function deriveFallbackKit(speciesId: string): SpeciesKit {
  const sp = POKEMON_SPECIES[speciesId];
  if (!sp) return {};

  const types = getSpeciesTypes(speciesId);
  const desc = `${sp.passiveDesc} ${sp.ultDesc}`.toLowerCase();
  const kit: SpeciesKit = {};

  // Element-inspired basic & passive traits
  if (types.includes('Fire')) {
    kit.onHitBurn = { dps: 6, durationMs: 3000 };
  } else if (types.includes('Poison')) {
    kit.onHitPoison = { dps: 6, durationMs: 3000 };
  } else if (types.includes('Ice') || types.includes('Water')) {
    kit.onHitSlowMs = 1500;
  } else if (types.includes('Electric')) {
    kit.onHitChain = { dmgRatio: 0.35, targets: 1 };
    kit.ultChargeBonusPct = 0.1;
  } else if (types.includes('Rock') || types.includes('Ground')) {
    kit.nearWallOnlyDefPct = 0.2;
  } else if (types.includes('Flying')) {
    kit.antiAirBonusPct = 0.2;
  } else if (types.includes('Fighting')) {
    kit.critEveryN = 5;
  } else if (types.includes('Grass')) {
    kit.onHitLifestealPct = 0.12;
  } else if (types.includes('Dragon')) {
    kit.armorPiercePct = 0.15;
  }

  // Keyword traits from species passive/ult description
  if (desc.includes('crit')) {
    kit.critEveryN = kit.critEveryN ?? 5;
  }
  if (desc.includes('pierce') || desc.includes('ignore')) {
    kit.armorPiercePct = kit.armorPiercePct ?? 0.2;
  }
  if (desc.includes('lifesteal') || desc.includes('drain')) {
    kit.onHitLifestealPct = kit.onHitLifestealPct ?? 0.15;
  }
  if (desc.includes('reflect') || desc.includes('thorns')) {
    kit.thornsPct = kit.thornsPct ?? 0.2;
  }
  if (desc.includes('slow') || desc.includes('chill')) {
    kit.onHitSlowMs = kit.onHitSlowMs ?? 1600;
  }
  if (desc.includes('stun') || desc.includes('paralyze')) {
    kit.onHitStunEveryN = kit.onHitStunEveryN ?? { everyN: 6, durationMs: 700 };
  }
  if (desc.includes('knockback') || desc.includes('push')) {
    kit.ultMode = 'knockback_aoe';
    kit.ultKnockback = true;
  }

  // Class-based fallback passive so every single unit has a real, active passive
  if (sp.pokeClass === 'Support') {
    if (desc.includes('heal') || desc.includes('restore')) {
      kit.auraRegenPerSec = 3;
      kit.ultMode = kit.ultMode ?? 'heal_aoe';
    } else {
      kit.auraAtkPct = 0.08;
    }
    kit.auraRadius = 2;
  } else if (sp.pokeClass === 'Defender') {
    kit.stationaryDrPct = kit.stationaryDrPct ?? 0.15;
  } else if (sp.pokeClass === 'Marksman') {
    kit.stationaryAtkPct = 0.12;
  } else if (sp.pokeClass === 'Brawler') {
    kit.packAtkPerAllyPct = 0.05;
  } else if (sp.pokeClass === 'Specialist') {
    if (
      desc.includes('hazard') ||
      desc.includes('spike') ||
      desc.includes('rock')
    ) {
      kit.ultMode = kit.ultMode ?? 'hazard';
      kit.ultHazardKind = 'spikes';
    } else {
      kit.statusBonusDmgPct = 0.2;
    }
  } else if (sp.pokeClass === 'Blaster') {
    kit.onHitSplash = kit.onHitSplash ?? { dmgRatio: 0.25, radius: 1.2 };
  }

  return kit;
}

export function getSpeciesKit(speciesId: string): SpeciesKit {
  const cached = kitCache.get(speciesId);
  if (cached) return cached;

  const sig = SIGNATURE_KITS[speciesId];
  const kit = sig ? { ...sig } : deriveFallbackKit(speciesId);
  kitCache.set(speciesId, kit);
  return kit;
}
