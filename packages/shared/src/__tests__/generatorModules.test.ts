import { describe, it, expect } from 'vitest';
import {
  SPECIALIZED_SLOT_CATEGORIES, SPECIALIZED_SLOT_INDEX,
  ACEP_EXTRA_SLOT_THRESHOLDS, MODULES,
  MODULE_HP_BY_TIER, MODULE_EP_COSTS, BASE_HULL_AP_REGEN,
  DEFENSE_ONLY_CATEGORIES,
} from '../constants.js';

describe('slot remap', () => {
  it('generator is slot 0', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES[0]).toBe('generator');
    expect(SPECIALIZED_SLOT_INDEX['generator']).toBe(0);
  });

  it('drive is slot 1 (was 0)', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES[1]).toBe('drive');
    expect(SPECIALIZED_SLOT_INDEX['drive']).toBe(1);
  });

  it('cargo is slot 7 (was 6)', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES[7]).toBe('cargo');
    expect(SPECIALIZED_SLOT_INDEX['cargo']).toBe(7);
  });

  it('has 8 specialized slot categories', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES).toHaveLength(8);
  });

  it('DEFENSE_ONLY_CATEGORIES unchanged', () => {
    expect(DEFENSE_ONLY_CATEGORIES).toContain('defense');
    expect(DEFENSE_ONLY_CATEGORIES).toContain('special');
  });
});

describe('new constants', () => {
  it('MODULE_HP_BY_TIER has tier 1-5', () => {
    expect(MODULE_HP_BY_TIER[1]).toBe(20);
    expect(MODULE_HP_BY_TIER[3]).toBe(55);
    expect(MODULE_HP_BY_TIER[5]).toBe(110);
  });

  it('MODULE_EP_COSTS has weapon costs', () => {
    expect(MODULE_EP_COSTS['weapon']).toBeDefined();
    expect(MODULE_EP_COSTS['weapon']!['high']).toBe(6);
    expect(MODULE_EP_COSTS['weapon']!['off']).toBe(0);
  });

  it('BASE_HULL_AP_REGEN is 0.08', () => {
    expect(BASE_HULL_AP_REGEN).toBeCloseTo(0.08);
  });
});

describe('generator modules', () => {
  it('generator_mk1 exists with ep and apRegenPerSecond', () => {
    const g = MODULES['generator_mk1'];
    expect(g).toBeDefined();
    expect(g.category).toBe('generator');
    expect(g.tier).toBe(1);
    expect(g.effects.generatorEpPerRound).toBe(6);
    expect(g.effects.apRegenPerSecond).toBeCloseTo(0.20);
    expect(g.maxHp).toBe(20);
  });

  it('generator_mk5 has 18 EP/round and 1.0 AP/s', () => {
    expect(MODULES['generator_mk5'].effects.generatorEpPerRound).toBe(18);
    expect(MODULES['generator_mk5'].effects.apRegenPerSecond).toBeCloseTo(1.0);
  });

  it('repair_mk1 exists with repair stats', () => {
    const r = MODULES['repair_mk1'];
    expect(r).toBeDefined();
    expect(r.category).toBe('repair');
    expect(r.effects.repairHpPerRound).toBe(2);
    expect(r.effects.repairHpPerSecond).toBeCloseTo(0.5);
    expect(r.maxHp).toBe(20);
  });

  it('repair_mk5 has 16 HP/round', () => {
    expect(MODULES['repair_mk5'].effects.repairHpPerRound).toBe(16);
  });

  it('existing modules have maxHp via backfill', () => {
    expect(MODULES['laser_mk1'].maxHp).toBe(20);   // tier 1
    expect(MODULES['laser_mk3'].maxHp).toBe(55);   // tier 3
    expect(MODULES['drive_mk5'].maxHp).toBe(110);  // tier 5
  });
});
