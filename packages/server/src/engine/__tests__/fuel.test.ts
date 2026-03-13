import { describe, it, expect } from 'vitest';
import { FUEL_COST_PER_UNIT, BASE_FUEL_CAPACITY, BASE_FUEL_PER_JUMP } from '@void-sector/shared';

describe('Fuel System', () => {
  it('should have fuel cost per unit defined', () => {
    expect(FUEL_COST_PER_UNIT).toBe(0.1);
  });

  it('base fuel capacity should be 10_000', () => {
    expect(BASE_FUEL_CAPACITY).toBe(10_000);
  });

  it('base fuel per jump should be 100', () => {
    expect(BASE_FUEL_PER_JUMP).toBe(100);
  });

  it('refuel cost should be calculable', () => {
    const cost = BASE_FUEL_CAPACITY * FUEL_COST_PER_UNIT;
    expect(cost).toBe(1000); // 10_000 * 0.1
  });
});

describe('Fuel System (new values)', () => {
  it('BASE_FUEL_CAPACITY is 10_000', () => {
    expect(BASE_FUEL_CAPACITY).toBe(10_000);
  });

  it('BASE_FUEL_PER_JUMP is 100', () => {
    expect(BASE_FUEL_PER_JUMP).toBe(100);
  });

  it('FUEL_COST_PER_UNIT is 0.1', () => {
    expect(FUEL_COST_PER_UNIT).toBe(0.1);
  });
});
