import { describe, it, expect } from 'vitest';
import {
  SECTOR_RESOURCE_YIELDS,
  SECTOR_TYPES,
  RESOURCE_TYPES,
  SECTOR_WEIGHTS,
  AP_COSTS,
  AP_DEFAULTS,
  STRUCTURE_COSTS,
  STRUCTURE_AP_COSTS,
  RELAY_RANGES,
  PRODUCTION_RECIPES,
  getAcepDominantPath,
  getAcepRadarPattern,
  ACEP_RADAR_PATTERNS,
} from '../constants';

describe('constants', () => {
  it('sector weights sum to 1', () => {
    const sum = Object.values(SECTOR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it('every sector type has a weight', () => {
    for (const type of SECTOR_TYPES) {
      expect(SECTOR_WEIGHTS[type]).toBeDefined();
    }
  });

  it('AP defaults are sane', () => {
    expect(AP_DEFAULTS.max).toBeGreaterThan(0);
    expect(AP_DEFAULTS.regenPerSecond).toBeGreaterThan(0);
    expect(AP_COSTS.jump).toBeGreaterThan(0);
    expect(AP_COSTS.scan).toBeGreaterThan(0);
  });

  it('every sector type has resource yields', () => {
    for (const type of SECTOR_TYPES) {
      const yields = SECTOR_RESOURCE_YIELDS[type];
      expect(yields).toBeDefined();
      for (const res of RESOURCE_TYPES) {
        expect(typeof yields[res]).toBe('number');
        expect(yields[res]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('station sectors have zero resources', () => {
    const station = SECTOR_RESOURCE_YIELDS.station;
    expect(station.ore + station.gas + station.crystal).toBe(0);
  });

  it('STRUCTURE_COSTS includes factory, research_lab, and kontor', () => {
    expect(STRUCTURE_COSTS.factory).toBeDefined();
    expect(STRUCTURE_COSTS.research_lab).toBeDefined();
    expect(STRUCTURE_COSTS.kontor).toBeDefined();
    expect(STRUCTURE_COSTS.factory.ore).toBeGreaterThan(0);
    expect(STRUCTURE_COSTS.research_lab.crystal).toBeGreaterThan(0);
    expect(STRUCTURE_COSTS.kontor.ore).toBeGreaterThan(0);
  });

  it('STRUCTURE_AP_COSTS includes factory, research_lab, and kontor', () => {
    expect(STRUCTURE_AP_COSTS.factory).toBe(20);
    expect(STRUCTURE_AP_COSTS.research_lab).toBe(25);
    expect(STRUCTURE_AP_COSTS.kontor).toBe(15);
  });

  it('RELAY_RANGES includes factory, research_lab, and kontor', () => {
    expect(RELAY_RANGES.factory).toBe(0);
    expect(RELAY_RANGES.research_lab).toBe(0);
    expect(RELAY_RANGES.kontor).toBe(0);
  });

  it('PRODUCTION_RECIPES has valid recipes', () => {
    expect(PRODUCTION_RECIPES.length).toBeGreaterThan(0);
    for (const recipe of PRODUCTION_RECIPES) {
      expect(recipe.id).toBeTruthy();
      expect(recipe.outputItem).toBeTruthy();
      expect(recipe.outputAmount).toBeGreaterThan(0);
      expect(recipe.inputs.length).toBeGreaterThan(0);
      expect(recipe.cycleSeconds).toBeGreaterThan(0);
      for (const input of recipe.inputs) {
        expect(['ore', 'gas', 'crystal']).toContain(input.resource);
        expect(input.amount).toBeGreaterThan(0);
      }
    }
  });

  it('PRODUCTION_RECIPES has unique IDs', () => {
    const ids = PRODUCTION_RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('PRODUCTION_RECIPES covers all processed item types', () => {
    const outputItems = new Set(PRODUCTION_RECIPES.map((r) => r.outputItem));
    expect(outputItems.has('fuel_cell')).toBe(true);
    expect(outputItems.has('circuit_board')).toBe(true);
    expect(outputItems.has('alloy_plate')).toBe(true);
    expect(outputItems.has('void_shard')).toBe(true);
    expect(outputItems.has('bio_extract')).toBe(true);
  });

  describe('getAcepDominantPath', () => {
    it('returns none when all XP is zero', () => {
      expect(getAcepDominantPath({ ausbau: 0, intel: 0, kampf: 0, explorer: 0 })).toBe('none');
    });

    it('returns dominant path when > 40%', () => {
      expect(getAcepDominantPath({ ausbau: 30, intel: 5, kampf: 5, explorer: 5 })).toBe('ausbau');
      expect(getAcepDominantPath({ ausbau: 5, intel: 30, kampf: 5, explorer: 5 })).toBe('intel');
      expect(getAcepDominantPath({ ausbau: 5, intel: 5, kampf: 30, explorer: 5 })).toBe('kampf');
      expect(getAcepDominantPath({ ausbau: 5, intel: 5, kampf: 5, explorer: 30 })).toBe('explorer');
    });

    it('returns none when no path exceeds 40%', () => {
      expect(getAcepDominantPath({ ausbau: 10, intel: 10, kampf: 10, explorer: 10 })).toBe('none');
    });

    it('ignores extra properties on the xp object (regression: total contamination)', () => {
      // The caller passes { ausbau, intel, kampf, explorer, total } — the
      // total field must NOT pollute Object.entries / the entries array.
      const xp = { ausbau: 30, intel: 5, kampf: 5, explorer: 5, total: 45 } as any;
      expect(getAcepDominantPath(xp)).toBe('ausbau');
    });
  });

  describe('getAcepRadarPattern', () => {
    it('returns a valid pattern for ACEP XP with total property', () => {
      const xp = { ausbau: 30, intel: 5, kampf: 5, explorer: 5, total: 45 };
      const pattern = getAcepRadarPattern(xp);
      expect(pattern).toBeDefined();
      expect(Array.isArray(pattern)).toBe(true);
      expect(pattern.length).toBeGreaterThan(0);
    });

    it('returns valid patterns for all tier/path combinations', () => {
      for (const tier of [1, 2, 3, 4] as const) {
        for (const path of ['ausbau', 'intel', 'kampf', 'explorer', 'none'] as const) {
          const pattern = ACEP_RADAR_PATTERNS[tier][path];
          expect(pattern).toBeDefined();
          expect(Array.isArray(pattern)).toBe(true);
        }
      }
    });
  });
});
