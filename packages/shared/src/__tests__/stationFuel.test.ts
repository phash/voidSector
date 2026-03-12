import { describe, it, expect } from 'vitest';
import {
  STATION_FUEL_BASELINE_PER_TICK,
  STATION_FUEL_GAS_RATE_PER_TICK,
  STATION_FUEL_PER_GAS,
  STATION_FUEL_MAX_STOCK,
  STATION_FUEL_LEVEL_EFFICIENCY,
} from '@void-sector/shared';

describe('station fuel production constants', () => {
  it('baseline is 10 fuel/tick', () => {
    expect(STATION_FUEL_BASELINE_PER_TICK).toBe(10);
  });

  it('gas rate is 100 fuel/tick at level 1', () => {
    expect(STATION_FUEL_GAS_RATE_PER_TICK * STATION_FUEL_LEVEL_EFFICIENCY[1]).toBe(100);
  });

  it('level 2 produces 120 fuel/tick', () => {
    expect(STATION_FUEL_GAS_RATE_PER_TICK * STATION_FUEL_LEVEL_EFFICIENCY[2]).toBe(120);
  });

  it('STATION_FUEL_PER_GAS is 1', () => {
    expect(STATION_FUEL_PER_GAS).toBe(1);
  });

  it('max stock defined', () => {
    expect(STATION_FUEL_MAX_STOCK).toBeGreaterThan(0);
  });
});
