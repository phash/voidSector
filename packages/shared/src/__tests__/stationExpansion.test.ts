import { describe, it, expect } from 'vitest';
import {
  stationTierForVolume,
  expansionCost,
  stationCargoCapacity,
  STATION_EXPANSION_TYPES,
  STATION_TIER_THRESHOLDS,
} from '../constants.js';

describe('stationTierForVolume', () => {
  it('maps trade volume to tiers via thresholds', () => {
    expect(stationTierForVolume(0)).toBe(1);
    expect(stationTierForVolume(999)).toBe(1);
    expect(stationTierForVolume(1000)).toBe(2);
    expect(stationTierForVolume(4000)).toBe(3);
    expect(stationTierForVolume(12000)).toBe(4);
    expect(stationTierForVolume(30000)).toBe(5);
    expect(stationTierForVolume(99999999)).toBe(5); // capped at MAX_STATION_LEVEL
  });
  it('threshold table has 5 entries starting at 0', () => {
    expect(STATION_TIER_THRESHOLDS.length).toBe(5);
    expect(STATION_TIER_THRESHOLDS[0]).toBe(0);
  });
});

describe('expansionCost', () => {
  it('scales the base cost by target level', () => {
    expect(expansionCost('cargo', 1)).toEqual({ ore: 30, gas: 5, crystal: 5, credits: 100, artefact: 0 });
    expect(expansionCost('cargo', 3)).toEqual({ ore: 90, gas: 15, crystal: 15, credits: 300, artefact: 0 });
    expect(expansionCost('werft', 2)).toEqual({ ore: 80, gas: 40, crystal: 50, credits: 800, artefact: 4 });
  });
  it('covers all six expansion types', () => {
    expect(STATION_EXPANSION_TYPES).toEqual(['factory', 'cargo', 'markt', 'werft', 'refinery', 'sensor']);
    for (const t of STATION_EXPANSION_TYPES) {
      expect(expansionCost(t, 1).ore).toBeGreaterThan(0);
    }
  });
});

describe('stationCargoCapacity', () => {
  it('grows with cargo level', () => {
    expect(stationCargoCapacity(0)).toBe(200);
    expect(stationCargoCapacity(3)).toBe(1100);
  });
});
