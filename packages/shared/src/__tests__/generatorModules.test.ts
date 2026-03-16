import { describe, it, expect } from 'vitest';
import {
  SPECIALIZED_SLOT_CATEGORIES, SPECIALIZED_SLOT_INDEX,
  ACEP_EXTRA_SLOT_THRESHOLDS,
  MODULE_HP_BY_TIER, BASE_HULL_AP_REGEN,
  DEFENSE_ONLY_CATEGORIES,
} from '../constants.js';
import { MODULE_MAP } from '../moduleDefinitions.js';

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

  it('has 9 specialized slot categories', () => {
    expect(SPECIALIZED_SLOT_CATEGORIES).toHaveLength(9);
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

  it('BASE_HULL_AP_REGEN is 0.1', () => {
    expect(BASE_HULL_AP_REGEN).toBeCloseTo(0.1);
  });
});

describe('generator modules (new system)', () => {
  it('fusion_cell_mk1 exists with apCost and stats', () => {
    const g = MODULE_MAP.get('fusion_cell_mk1');
    expect(g).toBeDefined();
    expect(g!.category).toBe('generator');
    expect(g!.tier).toBe(1);
    expect(g!.stats['apRegen']).toBe(4);
    expect(g!.stats['energyPerRound']).toBe(100);
    expect(g!.hitpoints).toBe(20);
  });

  it('am_generator has 12 apRegen and 500 energyPerRound', () => {
    const g = MODULE_MAP.get('am_generator')!;
    expect(g.stats['apRegen']).toBe(12);
    expect(g.stats['energyPerRound']).toBe(500);
  });

  it('repair_drone_mk1 exists with repair stats', () => {
    const r = MODULE_MAP.get('repair_drone_mk1');
    expect(r).toBeDefined();
    expect(r!.category).toBe('repair');
    expect(r!.stats['repairRate']).toBe(2);
    expect(r!.hitpoints).toBe(20);
  });

  it('nano_bots_mk1 has 16 repairRate', () => {
    const r = MODULE_MAP.get('nano_bots_mk1')!;
    expect(r.stats['repairRate']).toBe(16);
  });

  it('modules have hitpoints defined', () => {
    expect(MODULE_MAP.get('puls_laser_mk1')!.hitpoints).toBe(40);
    expect(MODULE_MAP.get('puls_laser_mk3')!.hitpoints).toBe(80);
    expect(MODULE_MAP.get('am_drive_mk1')!.hitpoints).toBe(40);
  });
});
