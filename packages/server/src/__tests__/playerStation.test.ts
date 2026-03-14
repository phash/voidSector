import { describe, it, expect } from 'vitest';
import { STATION_BUILD_COSTS, STATION_MODULE_UPGRADE_COST, MAX_STATION_LEVEL } from '@void-sector/shared';

describe('Player Station Constants', () => {
  it('has 5 build cost levels', () => {
    expect(Object.keys(STATION_BUILD_COSTS)).toHaveLength(5);
  });

  it('build costs double each level', () => {
    expect(STATION_BUILD_COSTS[2].credits).toBe(STATION_BUILD_COSTS[1].credits * 2);
    expect(STATION_BUILD_COSTS[3].credits).toBe(STATION_BUILD_COSTS[2].credits * 2);
    expect(STATION_BUILD_COSTS[4].credits).toBe(STATION_BUILD_COSTS[3].credits * 2);
    expect(STATION_BUILD_COSTS[5].credits).toBe(STATION_BUILD_COSTS[4].credits * 2);
  });

  it('crystal costs double each level', () => {
    expect(STATION_BUILD_COSTS[2].crystal).toBe(STATION_BUILD_COSTS[1].crystal * 2);
    expect(STATION_BUILD_COSTS[5].crystal).toBe(80);
  });

  it('module upgrade cost scales quadratically', () => {
    expect(STATION_MODULE_UPGRADE_COST(1)).toBe(200);
    expect(STATION_MODULE_UPGRADE_COST(2)).toBe(800);
    expect(STATION_MODULE_UPGRADE_COST(3)).toBe(1800);
    expect(STATION_MODULE_UPGRADE_COST(5)).toBe(5000);
  });

  it('MAX_STATION_LEVEL is 5', () => {
    expect(MAX_STATION_LEVEL).toBe(5);
  });
});
