import { describe, it, expect } from 'vitest';
import { getMaxTier, getResearchCost, isModuleUnlocked } from '../techGating.js';
import { MODULE_DEFINITIONS } from '../moduleDefinitions.js';

describe('getMaxTier', () => {
  it('returns the highest tier present in a category', () => {
    expect(getMaxTier('drive')).toBeGreaterThanOrEqual(5);
    expect(getMaxTier('weapon_energy')).toBeGreaterThanOrEqual(2);
  });
  it('returns 1 for an unknown category', () => {
    expect(getMaxTier('does_not_exist')).toBe(1);
  });
});

describe('getResearchCost', () => {
  it('scales 15 per tier above 1', () => {
    expect(getResearchCost(2)).toBe(15);
    expect(getResearchCost(3)).toBe(30);
    expect(getResearchCost(6)).toBe(75);
  });
});

describe('isModuleUnlocked', () => {
  it('tier-1 module is free with no research', () => {
    expect(isModuleUnlocked('puls_laser_mk1', {}, [])).toBe(true);
  });
  it('tier-2 module is locked until its category tier is researched', () => {
    expect(isModuleUnlocked('puls_laser_mk2', {}, [])).toBe(false);
    expect(isModuleUnlocked('puls_laser_mk2', { weapon_energy: 2 }, [])).toBe(true);
  });
  it('found-only module requires a blueprint regardless of tier', async () => {
    const foundOnly = MODULE_DEFINITIONS.find((m) => m.isFoundOnly);
    if (foundOnly) {
      expect(isModuleUnlocked(foundOnly.id, { [foundOnly.category]: 99 }, [])).toBe(false);
      expect(isModuleUnlocked(foundOnly.id, {}, [foundOnly.id])).toBe(true);
    }
  });
  it('unknown module is not unlocked', () => {
    expect(isModuleUnlocked('nope', { weapon_energy: 9 }, [])).toBe(false);
  });
});
