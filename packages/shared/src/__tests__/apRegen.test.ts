import { describe, it, expect } from 'vitest';
import {
  calculateApRegen, getDamageState, getModuleEffectivePowerLevel,
} from '../shipCalculator.js';
import type { ShipModule } from '../types.js';

describe('calculateApRegen', () => {
  it('returns BASE_HULL_AP_REGEN with no modules', () => {
    expect(calculateApRegen([])).toBeCloseTo(0.1);
  });

  it('returns base + generator contribution at high power full HP', () => {
    // fusion_cell_mk3: apCost = -8, hitpoints = 20, stats.apRegen = 8
    const modules: ShipModule[] = [{
      moduleId: 'fusion_cell_mk3', slotIndex: 0, source: 'standard',
      powerLevel: 'high', currentHp: 20,
    }];
    // 0.1 + 8 * 1.0 * (20/20) = 8.1
    expect(calculateApRegen(modules)).toBeCloseTo(8.1);
  });

  it('generator at low power reduces AP', () => {
    const modules: ShipModule[] = [{
      moduleId: 'fusion_cell_mk3', slotIndex: 0, source: 'standard',
      powerLevel: 'low', currentHp: 20,
    }];
    // 0.1 + 8 * 0.4 * 1.0 = 3.3
    expect(calculateApRegen(modules)).toBeCloseTo(3.3);
  });

  it('damaged generator reduces AP proportionally', () => {
    const modules: ShipModule[] = [{
      moduleId: 'fusion_cell_mk3', slotIndex: 0, source: 'standard',
      powerLevel: 'high', currentHp: 8, // 8/20 = 40% → heavy → power cap LOW
    }];
    // effective power = LOW (capped due to heavy damage)
    // 0.1 + 8 * 0.4 * (8/20) = 0.1 + 1.28 = 1.38
    const regen = calculateApRegen(modules);
    expect(regen).toBeGreaterThan(0.1);
    expect(regen).toBeLessThan(8.1);
  });

  it('destroyed generator contributes 0', () => {
    // fusion_cell_mk1: hitpoints = 20
    const modules: ShipModule[] = [{
      moduleId: 'fusion_cell_mk1', slotIndex: 0, source: 'standard',
      powerLevel: 'high', currentHp: 4, // 4/20 = 20% → destroyed → OFF
    }];
    expect(calculateApRegen(modules)).toBeCloseTo(0.1);
  });
});

describe('getDamageState', () => {
  it('intact above 75%', () => expect(getDamageState(80, 100)).toBe('intact'));
  it('light 50-75%', () => expect(getDamageState(60, 100)).toBe('light'));
  it('heavy 25-50%', () => expect(getDamageState(40, 100)).toBe('heavy'));
  it('destroyed at or below 25%', () => expect(getDamageState(20, 100)).toBe('destroyed'));
  it('exactly 25% is destroyed', () => expect(getDamageState(25, 100)).toBe('destroyed'));
  it('handles 0 maxHp safely', () => expect(getDamageState(0, 0)).toBe('destroyed'));
});

describe('getModuleEffectivePowerLevel', () => {
  it('destroyed module forced to off', () => {
    // puls_laser_mk1: hitpoints = 40
    const m: ShipModule = {
      moduleId: 'puls_laser_mk1', slotIndex: 2, source: 'standard',
      powerLevel: 'high', currentHp: 8, // 8/40 = 20% → destroyed
    };
    expect(getModuleEffectivePowerLevel(m)).toBe('off');
  });

  it('heavy damage caps at low', () => {
    // puls_laser_mk1: hitpoints = 40
    const m: ShipModule = {
      moduleId: 'puls_laser_mk1', slotIndex: 2, source: 'standard',
      powerLevel: 'high', currentHp: 16, // 16/40 = 40% → heavy → cap low
    };
    expect(getModuleEffectivePowerLevel(m)).toBe('low');
  });

  it('light damage caps high to mid', () => {
    // puls_laser_mk1: hitpoints = 40
    const m: ShipModule = {
      moduleId: 'puls_laser_mk1', slotIndex: 2, source: 'standard',
      powerLevel: 'high', currentHp: 28, // 28/40 = 70% → light → cap mid
    };
    expect(getModuleEffectivePowerLevel(m)).toBe('mid');
  });

  it('intact module uses requested power level', () => {
    const m: ShipModule = {
      moduleId: 'puls_laser_mk1', slotIndex: 2, source: 'standard',
      powerLevel: 'mid', currentHp: 40,
    };
    expect(getModuleEffectivePowerLevel(m)).toBe('mid');
  });

  it('no powerLevel defaults to high', () => {
    const m: ShipModule = { moduleId: 'puls_laser_mk1', slotIndex: 2, source: 'standard' };
    expect(getModuleEffectivePowerLevel(m)).toBe('high');
  });
});
