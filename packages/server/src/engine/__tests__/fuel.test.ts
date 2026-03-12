import { describe, it, expect } from 'vitest';
import { FUEL_COST_PER_UNIT, HULLS } from '@void-sector/shared';

describe('Fuel System', () => {
  const scout = HULLS.scout;
  const explorer = HULLS.explorer;

  it('should have fuel cost per unit defined', () => {
    expect(FUEL_COST_PER_UNIT).toBe(2);
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

  it('explorer hull should have more fuel capacity than scout', () => {
    expect(explorer.baseFuel).toBeGreaterThan(scout.baseFuel);
  });

  it('refuel cost should be calculable', () => {
    const cost = scout.baseFuel * FUEL_COST_PER_UNIT;
    expect(cost).toBe(160); // 80 * 2
  });
});
