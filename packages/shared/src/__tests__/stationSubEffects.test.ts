import { describe, it, expect } from 'vitest';
import {
  REFINERY_GAS_PER_TICK, REFINERY_FUEL_PER_GAS, REFINERY_FUEL_MAX,
  SENSOR_PIRATE_REDUCTION_PER_LEVEL, SENSOR_PIRATE_REDUCTION_MAX,
} from '../constants.js';

describe('station sub-effect constants', () => {
  it('has refinery conversion constants', () => {
    expect(REFINERY_GAS_PER_TICK).toBe(1);
    expect(REFINERY_FUEL_PER_GAS).toBe(100);
    expect(REFINERY_FUEL_MAX).toBe(20000);
  });
  it('has sensor pirate-reduction constants', () => {
    expect(SENSOR_PIRATE_REDUCTION_PER_LEVEL).toBe(0.15);
    expect(SENSOR_PIRATE_REDUCTION_MAX).toBe(0.9);
  });
});
