import { describe, it, expect } from 'vitest';
import {
  SECTOR_RESOURCE_YIELDS,
  ENVIRONMENT_WEIGHTS,
  CONTENT_WEIGHTS,
  RESOURCE_REGEN_PER_MINUTE,
  CRYSTAL_REGEN_PER_MINUTE,
} from '@void-sector/shared';

describe('worldgen rebalance (#113)', () => {
  it('asteroids always have ore', () => {
    expect(SECTOR_RESOURCE_YIELDS.asteroid_field.ore).toBeGreaterThanOrEqual(50);
  });

  it('asteroids have crystal', () => {
    expect(SECTOR_RESOURCE_YIELDS.asteroid_field.crystal).toBeGreaterThan(0);
  });

  it('nebula always has gas', () => {
    expect(SECTOR_RESOURCE_YIELDS.nebula.gas).toBeGreaterThanOrEqual(30);
  });

  it('nebula has crystal', () => {
    expect(SECTOR_RESOURCE_YIELDS.nebula.crystal).toBeGreaterThan(0);
  });

  it('empty has no resources', () => {
    const e = SECTOR_RESOURCE_YIELDS.empty;
    expect(e.ore + e.gas + e.crystal).toBe(0);
  });

  it('environment weights favor empty at 70%+', () => {
    expect(ENVIRONMENT_WEIGHTS.empty).toBeGreaterThanOrEqual(0.7);
  });

  it('content weights have more asteroids than before', () => {
    expect(CONTENT_WEIGHTS.asteroid_field).toBeGreaterThanOrEqual(0.25);
  });

  it('resource regen constants are positive', () => {
    expect(RESOURCE_REGEN_PER_MINUTE).toBeGreaterThan(0);
    expect(CRYSTAL_REGEN_PER_MINUTE).toBeGreaterThan(0);
    expect(CRYSTAL_REGEN_PER_MINUTE).toBeLessThan(RESOURCE_REGEN_PER_MINUTE);
  });
});
