import { describe, it, expect } from 'vitest';
import {
  SPECIALIZED_SLOT_CATEGORIES,
  SPECIALIZED_SLOT_INDEX,
  UNIQUE_MODULE_CATEGORIES,
  DEFENSE_ONLY_CATEGORIES,
  ACEP_PATH_SLOT_UNLOCKS,
  ACEP_LEVEL_THRESHOLDS,
  ACEP_LEVEL_MULTIPLIERS,
  getAcepUnlockedSlots,
} from '../constants.js';

describe('specialized slot system', () => {
  it('has 9 specialized slot categories', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES).toHaveLength(9);
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

  it('only factory is unique (shield and scanner are stackable)', () => {
    expect(UNIQUE_MODULE_CATEGORIES).toContain('factory');
    expect(UNIQUE_MODULE_CATEGORIES).not.toContain('shield');
    expect(UNIQUE_MODULE_CATEGORIES).not.toContain('scanner');
  });

  it('defense and special are extra-slot-only', () => {
    expect(DEFENSE_ONLY_CATEGORIES).toContain('defense');
    expect(DEFENSE_ONLY_CATEGORIES).toContain('special');
  });

  it('extra slots unlocked via ACEP path levels (getAcepUnlockedSlots)', () => {
    // kampf level 2 unlocks first WPN slot
    const slots = getAcepUnlockedSlots({ kampf: 2 });
    expect(slots).toHaveLength(1);
    expect(slots[0].label).toBe('WPN');
    // kampf level 4 unlocks two WPN slots
    const slots2 = getAcepUnlockedSlots({ kampf: 4 });
    expect(slots2).toHaveLength(2);
    // ACEP_PATH_SLOT_UNLOCKS has entries for all paths
    expect(ACEP_PATH_SLOT_UNLOCKS.length).toBeGreaterThan(0);
  });

  it('ACEP level 1 = 1.0 multiplier', () => {
    expect(ACEP_LEVEL_MULTIPLIERS[1]).toBe(1.0);
  });

  it('ACEP level 5 = 1.5 multiplier', () => {
    expect(ACEP_LEVEL_MULTIPLIERS[5]).toBe(1.5);
  });

  it('level 5 threshold is 20000 XP', () => {
    expect(ACEP_LEVEL_THRESHOLDS[5]).toBe(20000);
  });
});
