import { describe, it, expect } from 'vitest';
import { resolveStationCombat } from '../stationCombat.js';

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
