import { describe, it, expect } from 'vitest';
import { FUEL_COST_PER_UNIT, SHIP_CLASSES } from '@void-sector/shared';

describe('Fuel System', () => {
  const scout = SHIP_CLASSES.aegis_scout_mk1;
  const seeker = SHIP_CLASSES.void_seeker_mk2;

  it('should have fuel cost per unit defined', () => {
    expect(FUEL_COST_PER_UNIT).toBe(2);
  });

  it('should define fuelPerJump for all ship classes', () => {
    for (const [, shipClass] of Object.entries(SHIP_CLASSES)) {
      expect(shipClass.fuelPerJump).toBeGreaterThan(0);
      expect(shipClass.fuelMax).toBeGreaterThan(0);
    }
  });

  it('aegis scout should have 20 jumps worth of fuel', () => {
    expect(scout.fuelMax / scout.fuelPerJump).toBe(20);
  });

  it('void seeker should have more fuel capacity', () => {
    expect(seeker.fuelMax).toBeGreaterThan(scout.fuelMax);
  });

  it('refuel cost should be calculable', () => {
    const cost = scout.fuelMax * FUEL_COST_PER_UNIT;
    expect(cost).toBe(200);
  });
});
