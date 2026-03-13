import { describe, it, expect } from 'vitest';
import {
  SECTOR_RESOURCE_YIELDS,
  ENVIRONMENT_WEIGHTS,
  CONTENT_WEIGHTS,
  RESOURCE_REGEN_DELAY_TICKS,
  RESOURCE_REGEN_INTERVAL_TICKS,
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

  it('content weights have positive asteroid weight', () => {
    // PR #219 rebalanced: none=0.90 (sparse universe), asteroid_field=0.05
    expect(CONTENT_WEIGHTS.asteroid_field).toBeGreaterThan(0);
    expect(CONTENT_WEIGHTS.none).toBeGreaterThanOrEqual(0.85);
  });

  it('resource regen constants are positive', () => {
    expect(RESOURCE_REGEN_DELAY_TICKS).toBeGreaterThan(0);
    expect(RESOURCE_REGEN_INTERVAL_TICKS).toBeGreaterThan(0);
  });
});
