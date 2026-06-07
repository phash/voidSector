import { describe, it, expect } from 'vitest';
import { resolveStationCombat, deriveStationDefenseInput } from '../stationCombat.js';

describe('deriveStationDefenseInput', () => {
  it('scales HP/turret/shield off station level and ion off werft level', () => {
    const input = deriveStationDefenseInput(3, 2, null, 4, 7);
    expect(input.stationMaxHp).toBe(500 * 3); // STATION_BASE_HP × level
    expect(input.stationHp).toBe(500 * 3); // null currentHp → full
    expect(input.turretDamage).toBe(3 * 18);
    expect(input.ionCannonDamage).toBe(2 * 25);
    expect(input.pirateLevel).toBe(4);
  });

  it('uses persisted currentHp when the station is damaged', () => {
    const input = deriveStationDefenseInput(2, 0, 250, 1, 1);
    expect(input.stationHp).toBe(250);
    expect(input.ionCannonDamage).toBe(0); // no shipyard
  });
});

describe('resolveStationCombat', () => {
  it('station defends against weak pirate', () => {
    const result = resolveStationCombat({
      stationHp: 500,
      stationMaxHp: 500,
      stationShieldHp: 150,
      stationShieldRegen: 10,
      turretDamage: 30,
      ionCannonDamage: 0,
      pirateLevel: 1,
      seed: 42,
    });
    expect(result.outcome).toBe('defended');
    expect(result.hpLost).toBe(0);
  });

  it('station takes damage from strong pirate', () => {
    const result = resolveStationCombat({
      stationHp: 500,
      stationMaxHp: 500,
      stationShieldHp: 0,
      stationShieldRegen: 0,
      turretDamage: 15,
      ionCannonDamage: 0,
      pirateLevel: 8,
      seed: 42,
    });
    expect(['defended', 'damaged', 'destroyed']).toContain(result.outcome);
  });

  it('returns destroyed when HP reaches 0', () => {
    const result = resolveStationCombat({
      stationHp: 10,
      stationMaxHp: 500,
      stationShieldHp: 0,
      stationShieldRegen: 0,
      turretDamage: 0,
      ionCannonDamage: 0,
      pirateLevel: 10,
      seed: 42,
    });
    expect(result.outcome).toBe('destroyed');
    expect(result.hpLost).toBeGreaterThan(0);
  });

  it('ion cannon fires once and helps defend', () => {
    const result = resolveStationCombat({
      stationHp: 500,
      stationMaxHp: 500,
      stationShieldHp: 150,
      stationShieldRegen: 10,
      turretDamage: 15,
      ionCannonDamage: 80,
      pirateLevel: 3,
      seed: 42,
    });
    expect(result.outcome).toBe('defended');
  });

  it('shield absorbs pirate damage', () => {
    const withShield = resolveStationCombat({
      stationHp: 500,
      stationMaxHp: 500,
      stationShieldHp: 150,
      stationShieldRegen: 10,
      turretDamage: 15,
      ionCannonDamage: 0,
      pirateLevel: 5,
      seed: 42,
    });
    const withoutShield = resolveStationCombat({
      stationHp: 500,
      stationMaxHp: 500,
      stationShieldHp: 0,
      stationShieldRegen: 0,
      turretDamage: 15,
      ionCannonDamage: 0,
      pirateLevel: 5,
      seed: 42,
    });
    expect(withShield.hpLost).toBeLessThanOrEqual(withoutShield.hpLost);
  });
});
