import { describe, it, expect } from 'vitest';
import {
  SPECIALIZED_SLOT_CATEGORIES,
  SPECIALIZED_SLOT_INDEX,
  UNIQUE_MODULE_CATEGORIES,
  DEFENSE_ONLY_CATEGORIES,
  ACEP_EXTRA_SLOT_THRESHOLDS,
  ACEP_LEVEL_THRESHOLDS,
  ACEP_LEVEL_MULTIPLIERS,
} from '../constants.js';

describe('specialized slot system', () => {
  it('has 8 specialized slot categories', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES).toHaveLength(8);
  });

  it('generator is slot 0', () => {
    expect(SPECIALIZED_SLOT_INDEX['generator']).toBe(0);
  });

  it('drive is slot 1', () => {
    expect(SPECIALIZED_SLOT_INDEX['drive']).toBe(1);
  });

  it('cargo is slot 7', () => {
    expect(SPECIALIZED_SLOT_INDEX['cargo']).toBe(7);
  });

  it('shield and scanner are unique', () => {
    expect(UNIQUE_MODULE_CATEGORIES).toContain('shield');
    expect(UNIQUE_MODULE_CATEGORIES).toContain('scanner');
  });

  it('defense and special are extra-slot-only', () => {
    expect(DEFENSE_ONLY_CATEGORIES).toContain('defense');
    expect(DEFENSE_ONLY_CATEGORIES).toContain('special');
  });

  it('extra slot unlocks at ausbau XP 10, 25, 40, 50', () => {
    expect(ACEP_EXTRA_SLOT_THRESHOLDS[0]).toBe(10);
    expect(ACEP_EXTRA_SLOT_THRESHOLDS[3]).toBe(50);
  });

  it('ACEP level 1 = 1.0 multiplier', () => {
    expect(ACEP_LEVEL_MULTIPLIERS[1]).toBe(1.0);
  });

  it('ACEP level 5 = 1.5 multiplier', () => {
    expect(ACEP_LEVEL_MULTIPLIERS[5]).toBe(1.5);
  });

  it('level 5 threshold is 50 XP', () => {
    expect(ACEP_LEVEL_THRESHOLDS[5]).toBe(50);
  });
});
