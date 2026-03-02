import { describe, it, expect } from 'vitest';
import { SECTOR_RESOURCE_YIELDS, SECTOR_TYPES, RESOURCE_TYPES, SECTOR_WEIGHTS, AP_COSTS, AP_DEFAULTS } from '../constants';

describe('constants', () => {
  it('sector weights sum to 1', () => {
    const sum = Object.values(SECTOR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it('every sector type has a weight', () => {
    for (const type of SECTOR_TYPES) {
      expect(SECTOR_WEIGHTS[type]).toBeDefined();
    }
  });

  it('AP defaults are sane', () => {
    expect(AP_DEFAULTS.max).toBeGreaterThan(0);
    expect(AP_DEFAULTS.regenPerSecond).toBeGreaterThan(0);
    expect(AP_COSTS.jump).toBeGreaterThan(0);
    expect(AP_COSTS.scan).toBeGreaterThan(0);
  });

  it('every sector type has resource yields', () => {
    for (const type of SECTOR_TYPES) {
      const yields = SECTOR_RESOURCE_YIELDS[type];
      expect(yields).toBeDefined();
      for (const res of RESOURCE_TYPES) {
        expect(typeof yields[res]).toBe('number');
        expect(yields[res]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('station sectors have zero resources', () => {
    const station = SECTOR_RESOURCE_YIELDS.station;
    expect(station.ore + station.gas + station.crystal).toBe(0);
  });
});
