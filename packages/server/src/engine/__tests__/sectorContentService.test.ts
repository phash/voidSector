import { describe, it, expect } from 'vitest';
import {
  generateSectorEnvironment,
  generateSectorContents,
  getStationDensityMultiplier,
  getPirateDensityMultiplier,
} from '../sectorContentService.js';
import { WORLD_SEED } from '@void-sector/shared';

describe('generateSectorEnvironment', () => {
  it('returns a valid environment type', () => {
    const valid = ['empty', 'nebula', 'star', 'planet', 'asteroid', 'black_hole'];
    for (let x = 0; x < 100; x += 13) {
      const env = generateSectorEnvironment(x, x * 3 + 7);
      expect(valid).toContain(env.environmentType);
    }
  });

  it('is deterministic — same seed produces same result', () => {
    const a = generateSectorEnvironment(42, 99, WORLD_SEED);
    const b = generateSectorEnvironment(42, 99, WORLD_SEED);
    expect(a).toEqual(b);
  });

  it('marks star and black_hole as impassable', () => {
    let foundStar = false;
    let foundBlackHole = false;
    for (let x = 0; x < 50000 && (!foundStar || !foundBlackHole); x += 37) {
      const env = generateSectorEnvironment(x, x * 3 + 7);
      if (env.environmentType === 'star') {
        expect(env.isImpassable).toBe(true);
        foundStar = true;
      }
      if (env.environmentType === 'black_hole') {
        expect(env.isImpassable).toBe(true);
        foundBlackHole = true;
      }
    }
  });

  it('non-impassable environments have isImpassable=false', () => {
    for (let x = 0; x < 1000; x += 17) {
      const env = generateSectorEnvironment(x, x * 2 + 5);
      if (env.environmentType !== 'star' && env.environmentType !== 'black_hole') {
        expect(env.isImpassable).toBe(false);
      }
    }
  });

  it('planet environment gets a planet subtype', () => {
    let foundPlanet = false;
    const validSubtypes = [
      'terrestrial',
      'water',
      'ice',
      'lava',
      'exotic_a',
      'exotic_b',
      'exotic_c',
    ];
    for (let x = 0; x < 50000 && !foundPlanet; x += 7) {
      const env = generateSectorEnvironment(x, x + 3);
      if (env.environmentType === 'planet') {
        expect(env.planetSubtype).not.toBeNull();
        expect(validSubtypes).toContain(env.planetSubtype);
        foundPlanet = true;
      }
    }
    expect(foundPlanet).toBe(true);
  });

  it('non-planet environments have null planetSubtype', () => {
    for (let x = 0; x < 1000; x += 11) {
      const env = generateSectorEnvironment(x, x * 3);
      if (env.environmentType !== 'planet') {
        expect(env.planetSubtype).toBeNull();
      }
    }
  });

  it('contentVariance is between 0.2 and 1.8', () => {
    for (let x = 0; x < 1000; x += 7) {
      const env = generateSectorEnvironment(x, x * 2);
      expect(env.contentVariance).toBeGreaterThanOrEqual(0.2);
      expect(env.contentVariance).toBeLessThanOrEqual(1.8);
    }
  });
});

describe('generateSectorContents', () => {
  it('returns empty array for star environments', () => {
    const contents = generateSectorContents(100, 200, 'star', 1.0);
    expect(contents).toHaveLength(0);
  });

  it('returns empty array for black_hole environments', () => {
    const contents = generateSectorContents(100, 200, 'black_hole', 1.0);
    expect(contents).toHaveLength(0);
  });

  it('is deterministic', () => {
    const a = generateSectorContents(42, 99, 'empty', 1.0, WORLD_SEED);
    const b = generateSectorContents(42, 99, 'empty', 1.0, WORLD_SEED);
    expect(a).toEqual(b);
  });

  it('returns valid content types', () => {
    const valid = [
      'asteroid_field',
      'station',
      'anomaly',
      'pirate_zone',
      'player_base',
      'meteor',
      'relic',
      'npc_ship',
      'ruin',
    ];
    for (let x = 0; x < 500; x += 7) {
      const contents = generateSectorContents(x, x + 5, 'empty', 1.0);
      for (const c of contents) {
        expect(valid).toContain(c.contentType);
      }
    }
  });

  it('meteor content has ore/gas/crystal yields', () => {
    let found = false;
    for (let x = 0; x < 50000 && !found; x += 3) {
      const contents = generateSectorContents(x, x * 2 + 1, 'empty', 1.5);
      const meteor = contents.find((c) => c.contentType === 'meteor');
      if (meteor) {
        expect(meteor.oreYield).toBeGreaterThan(0);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('nebula sectors can have relic content', () => {
    let found = false;
    for (let x = 0; x < 50000 && !found; x += 3) {
      const contents = generateSectorContents(x, x + 7, 'nebula', 1.5);
      if (contents.some((c) => c.contentType === 'relic')) {
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});

describe('distance density multipliers', () => {
  it('station density is higher near origin (0,0)', () => {
    const near = getStationDensityMultiplier(0, 0);
    const far = getStationDensityMultiplier(10000, 10000);
    expect(near).toBeGreaterThan(far);
  });

  it('pirate density is higher far from origin', () => {
    const near = getPirateDensityMultiplier(0, 0);
    const far = getPirateDensityMultiplier(10000, 10000);
    expect(far).toBeGreaterThan(near);
  });

  it('station multiplier at origin equals DENSITY_STATION_NEAR', () => {
    const mult = getStationDensityMultiplier(0, 0);
    expect(mult).toBeCloseTo(2.5);
  });

  it('station multiplier far out equals DENSITY_STATION_FAR', () => {
    const mult = getStationDensityMultiplier(50000, 50000);
    expect(mult).toBeCloseTo(0.3);
  });
});
