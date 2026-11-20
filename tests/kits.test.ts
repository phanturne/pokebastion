import { describe, expect, it } from 'vitest';
import { POKEMON_SPECIES } from '../src/data/pokemon';
import {
  computeBasicAttackDamage,
  computeEnemyAttackDamage,
  computeUltPower,
} from '../src/engine/combat';
import { computeHazardDamage, getSpeciesKit } from '../src/engine/kits';

describe('Pokemon Kits, Teleport, Hazards & Sniper Ults', () => {
  it('gives every playable Pokémon species an active kit mechanic', () => {
    for (const sp of Object.values(POKEMON_SPECIES)) {
      const kit = getSpeciesKit(sp.id);
      const hasMechanic =
        Boolean(kit.canTeleport) ||
        Boolean(kit.auraAtkPct) ||
        Boolean(kit.auraDefPct) ||
        Boolean(kit.auraSpdPct) ||
        Boolean(kit.auraRegenPerSec) ||
        Boolean(kit.nearWallOrWaterDefPct) ||
        Boolean(kit.nearWallOnlyDefPct) ||
        Boolean(kit.stationaryDrPct) ||
        Boolean(kit.stationaryAtkPct) ||
        Boolean(kit.atkSpdBonusPct) ||
        Boolean(kit.ultChargeBonusPct) ||
        Boolean(kit.soloAtkPct) ||
        Boolean(kit.packAtkPerAllyPct) ||
        Boolean(kit.critEveryN) ||
        Boolean(kit.armorPiercePct) ||
        Boolean(kit.statusBonusDmgPct) ||
        Boolean(kit.executeBonusDmgPct) ||
        Boolean(kit.antiAirBonusPct) ||
        Boolean(kit.onHitBurn) ||
        Boolean(kit.onHitPoison) ||
        Boolean(kit.onHitSlowMs) ||
        Boolean(kit.onHitChain) ||
        Boolean(kit.onHitSplash) ||
        Boolean(kit.onHitLifestealPct) ||
        Boolean(kit.onHitStunEveryN) ||
        Boolean(kit.ultStunMs) ||
        Boolean(kit.thornsPct) ||
        Boolean(kit.ultMode);
      expect(hasMechanic, `${sp.id} (${sp.name}) should have a kit`).toBe(true);
    }
  });

  it('enables instant teleport for select Ghost and Psychic Pokémon only', () => {
    for (const id of ['0063', '0064', '0065', '0093', '0094', '0150', '0151']) {
      expect(getSpeciesKit(id).canTeleport).toBe(true);
    }
    for (const id of ['0001', '0079', '0092', '0096', '0122']) {
      expect(getSpeciesKit(id).canTeleport).toBeFalsy();
    }
  });

  it('computes entry hazard damage with Stealth Rock hitting flying for 2x and Spikes ignoring flying', () => {
    const rockGround = computeHazardDamage('stealth_rock', 200, 'ground', 20);
    const rockFly = computeHazardDamage('stealth_rock', 200, 'fly', 20);
    expect(rockGround).toBeGreaterThan(0);
    expect(rockFly).toBe(rockGround * 2);

    expect(computeHazardDamage('spikes', 200, 'ground', 20)).toBeGreaterThan(0);
    expect(computeHazardDamage('spikes', 200, 'fly', 20)).toBe(0);
    expect(computeHazardDamage('sticky_web', 200, 'fly', 20)).toBe(0);
  });

  it('configures Sniper Ult Pokémon with auto-ult support and high single-target power', () => {
    const snipers = [
      '0015',
      '0018',
      '0022',
      '0065',
      '0106',
      '0127',
      '0142',
      '0150',
    ];
    for (const id of snipers) {
      expect(POKEMON_SPECIES[id].ultAutoDefault).toBe(true);
      const kit = getSpeciesKit(id);
      expect(kit.ultMode).toBe('sniper');
      expect((kit.ultPowerMult ?? 1) >= 2.2).toBe(true);
      expect((kit.ultRange ?? 0) >= 10).toBe(true);
    }
    expect(computeUltPower(40, 1, false, 0, undefined, 2.5)).toBe(220);
  });

  it('recharges defensive recovery Pokémon Ults when hit instead of on basic attack', () => {
    for (const id of ['0036', '0040', '0079', '0080', '0113', '0143']) {
      const kit = getSpeciesKit(id);
      expect((kit.ultChargeOnHitTaken ?? 0) > 0).toBe(true);
      const basic = computeBasicAttackDamage({
        baseAtk: 20,
        speciesId: id,
        hitCount: 1,
        heldItems: [],
        targetHp: 100,
        targetMaxHp: 100,
        targetHasStatus: false,
      });
      expect(basic.ultCharge).toBe(0);
    }
  });

  it('applies kit passives in basic attack and enemy attack damage formulas', () => {
    const gengarNormal = computeBasicAttackDamage({
      baseAtk: 40,
      speciesId: '0094',
      hitCount: 1,
      heldItems: [],
      targetHp: 200,
      targetMaxHp: 200,
      targetHasStatus: false,
    });
    const gengarStatus = computeBasicAttackDamage({
      baseAtk: 40,
      speciesId: '0094',
      hitCount: 1,
      heldItems: [],
      targetHp: 200,
      targetMaxHp: 200,
      targetHasStatus: true,
    });
    expect(gengarStatus.damage).toBeGreaterThan(gengarNormal.damage);

    const snorlaxMoving = computeEnemyAttackDamage({
      enemyAtk: 40,
      unitDef: 10,
      unitSpeciesId: '0143',
      unitStationaryMs: 0,
      unitHeldItems: [],
      unitAdjacentToStructure: false,
    });
    const snorlaxStationary = computeEnemyAttackDamage({
      enemyAtk: 40,
      unitDef: 10,
      unitSpeciesId: '0143',
      unitStationaryMs: 1000,
      unitHeldItems: [],
      unitAdjacentToStructure: false,
    });
    expect(snorlaxStationary.damage).toBeLessThan(snorlaxMoving.damage);
  });

  it('derives fallback kits for non-signature species and returns empty kit for unknown IDs', () => {
    // '0019' (Rattata) uses deriveFallbackKit
    const rattataKit = getSpeciesKit('0019');
    expect(Object.keys(rattataKit).length).toBeGreaterThan(0);

    // '0029' (Nidoran♀, Poison) derives onHitPoison from element
    const nidoranFKit = getSpeciesKit('0029');
    expect(nidoranFKit.onHitPoison).toBeDefined();

    // Unknown species ID returns empty kit safely
    expect(getSpeciesKit('unknown_species')).toEqual({});
  });
});
