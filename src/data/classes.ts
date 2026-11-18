import { MinorUpgradeSpec, PokemonClass, PokemonSubclass } from '../types';

export interface ClassDefinition {
  id: PokemonClass;
  name: string;
  purpose: string;
  subclasses: [PokemonSubclass, PokemonSubclass, PokemonSubclass];
}

export interface SubclassDefinition {
  id: PokemonSubclass;
  parentClass: PokemonClass;
  desc: string;
}

export const CLASS_DEFINITIONS: Record<PokemonClass, ClassDefinition> = {
  Defender: {
    id: 'Defender',
    name: 'Defender',
    purpose: 'Frontline tanking, blocking, and wall/core protection.',
    subclasses: ['Bastion', 'Wallguard', 'Juggernaut'],
  },
  Brawler: {
    id: 'Brawler',
    name: 'Brawler',
    purpose: 'Close-range melee dueling and frontline damage.',
    subclasses: ['Duelist', 'Cleave', 'Interceptor'],
  },
  Marksman: {
    id: 'Marksman',
    name: 'Marksman',
    purpose: 'Long-range attacks and priority targeting.',
    subclasses: ['Sniper', 'Rapid-Fire', 'Artillery'],
  },
  Blaster: {
    id: 'Blaster',
    name: 'Blaster',
    purpose: 'Elemental AoE damage and crowd clearing.',
    subclasses: ['Elemental AoE', 'Chain', 'Status'],
  },
  Support: {
    id: 'Support',
    name: 'Support',
    purpose: 'Healing, buffs, shields, and AP/cooldown aid.',
    subclasses: ['Healer', 'Buffer', 'Tactician'],
  },
  Specialist: {
    id: 'Specialist',
    name: 'Specialist',
    purpose: 'Entry hazards, terrain control, mobility, and debuffs.',
    subclasses: ['Hazard Setter', 'Displacer', 'Ambusher'],
  },
};

export const SUBCLASS_DEFINITIONS: Record<PokemonSubclass, SubclassDefinition> =
  {
    Bastion: {
      id: 'Bastion',
      parentClass: 'Defender',
      desc: 'High HP and armor anchor built to hold chokepoints.',
    },
    Wallguard: {
      id: 'Wallguard',
      parentClass: 'Defender',
      desc: 'Fortifies and shields adjacent walls and structures.',
    },
    Juggernaut: {
      id: 'Juggernaut',
      parentClass: 'Defender',
      desc: 'Punishes attackers with counterattacks and self-sustain.',
    },
    Duelist: {
      id: 'Duelist',
      parentClass: 'Brawler',
      desc: 'High single-target melee DPS against priority threats.',
    },
    Cleave: {
      id: 'Cleave',
      parentClass: 'Brawler',
      desc: 'Sweeping melee strikes that hit multiple adjacent foes.',
    },
    Interceptor: {
      id: 'Interceptor',
      parentClass: 'Brawler',
      desc: 'High-mobility melee fighter that chases down leaks.',
    },
    Sniper: {
      id: 'Sniper',
      parentClass: 'Marksman',
      desc: 'Extreme-range precision shots and anti-flyer focus.',
    },
    'Rapid-Fire': {
      id: 'Rapid-Fire',
      parentClass: 'Marksman',
      desc: 'Relentless high-attack-speed ranged barrages.',
    },
    Artillery: {
      id: 'Artillery',
      parentClass: 'Marksman',
      desc: 'Long-range splash projectiles for clustered waves.',
    },
    'Elemental AoE': {
      id: 'Elemental AoE',
      parentClass: 'Blaster',
      desc: 'Wide elemental bursts that clear dense enemy packs.',
    },
    Chain: {
      id: 'Chain',
      parentClass: 'Blaster',
      desc: 'Bouncing elemental arcs that hit multiple nearby targets.',
    },
    Status: {
      id: 'Status',
      parentClass: 'Blaster',
      desc: 'Applies group Burn, Paralyze, Freeze, or Poison.',
    },
    Healer: {
      id: 'Healer',
      parentClass: 'Support',
      desc: 'Restores allied Pokémon HP and clears debuffs.',
    },
    Buffer: {
      id: 'Buffer',
      parentClass: 'Support',
      desc: 'Projects attack, speed, and defensive auras to allies.',
    },
    Tactician: {
      id: 'Tactician',
      parentClass: 'Support',
      desc: 'Accelerates AP recovery and ultimate charge rates.',
    },
    'Hazard Setter': {
      id: 'Hazard Setter',
      parentClass: 'Specialist',
      desc: 'Deploys Spikes, Toxic Spikes, Sticky Web, or Stealth Rock.',
    },
    Displacer: {
      id: 'Displacer',
      parentClass: 'Specialist',
      desc: 'Controls enemy advance with knockback, pulls, and slows.',
    },
    Ambusher: {
      id: 'Ambusher',
      parentClass: 'Specialist',
      desc: 'Cheap repositioning, stealth, or teleportation across lanes.',
    },
  };

/**
 * Class- and subclass-scoped minor upgrades (30 total: 2 per class + 1 per subclass).
 * Dual-class Pokémon can draw from both of their class pools.
 */
export const CLASS_MINOR_UPGRADES: MinorUpgradeSpec[] = [
  // Defender (2 class + 3 subclass)
  {
    id: 'defender_iron_plate',
    title: 'Iron Plating',
    desc: 'All Defenders gain +20% Max HP and +5 DEF.',
    targetClass: 'Defender',
    hpMult: 1.2,
    defBonus: 5,
  },
  {
    id: 'defender_stalwart_stance',
    title: 'Stalwart Stance',
    desc: 'All Defenders gain +15% ATK and +4 DEF.',
    targetClass: 'Defender',
    atkMult: 1.15,
    defBonus: 4,
  },
  {
    id: 'defender_bastion_core',
    title: 'Bastion Bulwark',
    desc: 'Bastion Defenders gain +25% Max HP.',
    targetClass: 'Defender',
    targetSubclass: 'Bastion',
    hpMult: 1.25,
  },
  {
    id: 'defender_wallguard_mortar',
    title: 'Reinforced Mortar',
    desc: 'Wallguard Defenders gain +8 DEF and +10% Max HP.',
    targetClass: 'Defender',
    targetSubclass: 'Wallguard',
    defBonus: 8,
    hpMult: 1.1,
  },
  {
    id: 'defender_juggernaut_fury',
    title: 'Juggernaut Counter',
    desc: 'Juggernaut Defenders gain +20% ATK and +12% Attack Speed.',
    targetClass: 'Defender',
    targetSubclass: 'Juggernaut',
    atkMult: 1.2,
    attackIntervalMult: 0.89,
  },

  // Brawler (2 class + 3 subclass)
  {
    id: 'brawler_heavy_knuckles',
    title: 'Heavy Knuckles',
    desc: 'All Brawlers gain +20% ATK.',
    targetClass: 'Brawler',
    atkMult: 1.2,
  },
  {
    id: 'brawler_combat_tempo',
    title: 'Combat Tempo',
    desc: 'All Brawlers gain +15% Attack Speed and +10% Max HP.',
    targetClass: 'Brawler',
    attackIntervalMult: 0.87,
    hpMult: 1.1,
  },
  {
    id: 'brawler_duelist_edge',
    title: 'Duelist Focus',
    desc: 'Duelist Brawlers gain +25% ATK.',
    targetClass: 'Brawler',
    targetSubclass: 'Duelist',
    atkMult: 1.25,
  },
  {
    id: 'brawler_cleave_reach',
    title: 'Sweeping Arc',
    desc: 'Cleave Brawlers gain +15% ATK and +15% Max HP.',
    targetClass: 'Brawler',
    targetSubclass: 'Cleave',
    atkMult: 1.15,
    hpMult: 1.15,
  },
  {
    id: 'brawler_interceptor_stride',
    title: 'Interceptor Stride',
    desc: 'Interceptor Brawlers gain +1 Move Range and +15% Attack Speed.',
    targetClass: 'Brawler',
    targetSubclass: 'Interceptor',
    moveRangeBonus: 1,
    attackIntervalMult: 0.87,
  },

  // Marksman (2 class + 3 subclass)
  {
    id: 'marksman_eagle_eye',
    title: 'Eagle Eye',
    desc: 'All Marksmen gain +1 Range.',
    targetClass: 'Marksman',
    rangeBonus: 1,
  },
  {
    id: 'marksman_fletched_bolts',
    title: 'Fletched Bolts',
    desc: 'All Marksmen gain +18% ATK.',
    targetClass: 'Marksman',
    atkMult: 1.18,
  },
  {
    id: 'marksman_sniper_scope',
    title: 'Sniper Scope',
    desc: 'Sniper Marksmen gain +1 Range and +15% ATK.',
    targetClass: 'Marksman',
    targetSubclass: 'Sniper',
    rangeBonus: 1,
    atkMult: 1.15,
  },
  {
    id: 'marksman_rapid_volley',
    title: 'Rapid Volley',
    desc: 'Rapid-Fire Marksmen gain +22% Attack Speed.',
    targetClass: 'Marksman',
    targetSubclass: 'Rapid-Fire',
    attackIntervalMult: 0.82,
  },
  {
    id: 'marksman_artillery_shells',
    title: 'Heavy Shells',
    desc: 'Artillery Marksmen gain +22% ATK and +15% Ult charge rate.',
    targetClass: 'Marksman',
    targetSubclass: 'Artillery',
    atkMult: 1.22,
    ultChargeMult: 1.15,
  },

  // Blaster (2 class + 3 subclass)
  {
    id: 'blaster_volatile_spark',
    title: 'Volatile Spark',
    desc: 'All Blasters gain +18% ATK and +15% Ult charge rate.',
    targetClass: 'Blaster',
    atkMult: 1.18,
    ultChargeMult: 1.15,
  },
  {
    id: 'blaster_quick_cast',
    title: 'Quick Cast',
    desc: 'All Blasters gain +15% Attack Speed.',
    targetClass: 'Blaster',
    attackIntervalMult: 0.87,
  },
  {
    id: 'blaster_aoe_overload',
    title: 'Elemental Overload',
    desc: 'Elemental AoE Blasters gain +22% ATK.',
    targetClass: 'Blaster',
    targetSubclass: 'Elemental AoE',
    atkMult: 1.22,
  },
  {
    id: 'blaster_chain_arc',
    title: 'Conductive Arc',
    desc: 'Chain Blasters gain +1 Range and +12% Attack Speed.',
    targetClass: 'Blaster',
    targetSubclass: 'Chain',
    rangeBonus: 1,
    attackIntervalMult: 0.89,
  },
  {
    id: 'blaster_status_potency',
    title: 'Lingering Affliction',
    desc: 'Status Blasters gain +20% Ult charge rate and +10% ATK.',
    targetClass: 'Blaster',
    targetSubclass: 'Status',
    ultChargeMult: 1.2,
    atkMult: 1.1,
  },

  // Support (2 class + 3 subclass)
  {
    id: 'support_soothing_aura',
    title: 'Soothing Aura',
    desc: 'All Supports gain +20% Max HP and +20% Ult charge rate.',
    targetClass: 'Support',
    hpMult: 1.2,
    ultChargeMult: 1.2,
  },
  {
    id: 'support_field_presence',
    title: 'Field Presence',
    desc: 'All Supports gain +1 Range and +4 DEF.',
    targetClass: 'Support',
    rangeBonus: 1,
    defBonus: 4,
  },
  {
    id: 'support_healer_grace',
    title: 'Restorative Grace',
    desc: 'Healer Supports gain +25% Ult charge rate and +15% Max HP.',
    targetClass: 'Support',
    targetSubclass: 'Healer',
    ultChargeMult: 1.25,
    hpMult: 1.15,
  },
  {
    id: 'support_buffer_banner',
    title: 'Rallying Banner',
    desc: 'Buffer Supports gain +15% Attack Speed and +15% ATK.',
    targetClass: 'Support',
    targetSubclass: 'Buffer',
    attackIntervalMult: 0.87,
    atkMult: 1.15,
  },
  {
    id: 'support_tactician_mind',
    title: 'Tactician Insight',
    desc: 'Tactician Supports gain +1 Move Range and +25% Ult charge rate.',
    targetClass: 'Support',
    targetSubclass: 'Tactician',
    moveRangeBonus: 1,
    ultChargeMult: 1.25,
  },

  // Specialist (2 class + 3 subclass)
  {
    id: 'specialist_nimble_step',
    title: 'Nimble Step',
    desc: 'All Specialists gain +1 Move Range and +10% Attack Speed.',
    targetClass: 'Specialist',
    moveRangeBonus: 1,
    attackIntervalMult: 0.91,
  },
  {
    id: 'specialist_trapper_craft',
    title: "Trapper's Craft",
    desc: 'All Specialists gain +15% ATK and +15% Ult charge rate.',
    targetClass: 'Specialist',
    atkMult: 1.15,
    ultChargeMult: 1.15,
  },
  {
    id: 'specialist_hazard_stock',
    title: 'Dense Hazards',
    desc: 'Hazard Setter Specialists gain +20% Ult charge rate and +1 Range.',
    targetClass: 'Specialist',
    targetSubclass: 'Hazard Setter',
    ultChargeMult: 1.2,
    rangeBonus: 1,
  },
  {
    id: 'specialist_displacer_force',
    title: 'Kinetic Force',
    desc: 'Displacer Specialists gain +20% ATK and +10% Max HP.',
    targetClass: 'Specialist',
    targetSubclass: 'Displacer',
    atkMult: 1.2,
    hpMult: 1.1,
  },
  {
    id: 'specialist_ambusher_blink',
    title: 'Shadow Blink',
    desc: 'Ambusher Specialists gain +1 Move Range and +18% Attack Speed.',
    targetClass: 'Specialist',
    targetSubclass: 'Ambusher',
    moveRangeBonus: 1,
    attackIntervalMult: 0.85,
  },
];

export const CLASS_MINOR_UPGRADE_MAP: Record<string, MinorUpgradeSpec> =
  Object.fromEntries(CLASS_MINOR_UPGRADES.map((u) => [u.id, u]));
