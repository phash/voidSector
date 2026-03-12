import { describe, it, expect } from 'vitest';
import { FUEL_COST_PER_UNIT, HULLS } from '@void-sector/shared';

describe('Fuel System', () => {
  const scout = HULLS.scout;
  const explorer = HULLS.explorer;

  it('should have fuel cost per unit defined', () => {
    expect(FUEL_COST_PER_UNIT).toBe(0.1);
  });

  it('should define baseFuelPerJump for all hull types', () => {
    for (const [, hull] of Object.entries(HULLS)) {
      expect(hull.baseFuelPerJump).toBeGreaterThan(0);
      expect(hull.baseFuel).toBeGreaterThan(0);
    }
  });

  it('scout hull should have defined fuel values', () => {
    expect(scout.baseFuel).toBeGreaterThan(0);
    expect(scout.baseFuelPerJump).toBeGreaterThan(0);
  });

  it('explorer hull should have same fuel capacity as scout', () => {
    expect(explorer.baseFuel).toBe(scout.baseFuel);
  });

  it('refuel cost should be calculable', () => {
    const cost = scout.baseFuel * FUEL_COST_PER_UNIT;
    expect(cost).toBe(1000); // 10_000 * 0.1
  });
});

describe('Fuel System (new values)', () => {
  it('all hulls have baseFuel 10_000', () => {
    for (const hull of Object.values(HULLS)) {
      expect(hull.baseFuel).toBe(10_000);
    }
  });

  it('all hulls have baseFuelPerJump 100', () => {
    for (const hull of Object.values(HULLS)) {
      expect(hull.baseFuelPerJump).toBe(100);
    }
  });

  it('FUEL_COST_PER_UNIT is 0.1', () => {
    expect(FUEL_COST_PER_UNIT).toBe(0.1);
  });
});
