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
    const modules: ShipModule[] = [{
      moduleId: 'generator_mk3', slotIndex: 0, source: 'standard',
      powerLevel: 'high', currentHp: 55,
    }];
    // 0.1 + 6 * 1.0 * (55/55) = 6.1
    expect(calculateApRegen(modules)).toBeCloseTo(6.1);
  });

  it('generator at low power reduces AP', () => {
    const modules: ShipModule[] = [{
      moduleId: 'generator_mk3', slotIndex: 0, source: 'standard',
      powerLevel: 'low', currentHp: 55,
    }];
    // 0.1 + 6 * 0.4 * 1.0 = 2.5
    expect(calculateApRegen(modules)).toBeCloseTo(2.5);
  });

  it('damaged generator reduces AP proportionally', () => {
    const modules: ShipModule[] = [{
      moduleId: 'generator_mk3', slotIndex: 0, source: 'standard',
      powerLevel: 'high', currentHp: 27, // ~49% of 55 → heavy → power cap LOW
    }];
    // effective power = LOW (capped due to heavy damage)
    // 0.1 + 6 * 0.4 * (27/55) ≈ 1.278
    const regen = calculateApRegen(modules);
    expect(regen).toBeGreaterThan(0.1);
    expect(regen).toBeLessThan(6.1);
  });

  it('destroyed generator contributes 0', () => {
    const modules: ShipModule[] = [{
      moduleId: 'generator_mk1', slotIndex: 0, source: 'standard',
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
    const m: ShipModule = {
      moduleId: 'laser_mk1', slotIndex: 2, source: 'standard',
      powerLevel: 'high', currentHp: 4, // 4/20 = 20% → destroyed
    };
    expect(getModuleEffectivePowerLevel(m)).toBe('off');
  });

  it('heavy damage caps at low', () => {
    const m: ShipModule = {
      moduleId: 'laser_mk1', slotIndex: 2, source: 'standard',
      powerLevel: 'high', currentHp: 8, // 8/20 = 40% → heavy → cap low
    };
    expect(getModuleEffectivePowerLevel(m)).toBe('low');
  });

  it('light damage caps high to mid', () => {
    const m: ShipModule = {
      moduleId: 'laser_mk1', slotIndex: 2, source: 'standard',
      powerLevel: 'high', currentHp: 14, // 14/20 = 70% → light → cap mid
    };
    expect(getModuleEffectivePowerLevel(m)).toBe('mid');
  });

  it('intact module uses requested power level', () => {
    const m: ShipModule = {
      moduleId: 'laser_mk1', slotIndex: 2, source: 'standard',
      powerLevel: 'mid', currentHp: 20,
    };
    expect(getModuleEffectivePowerLevel(m)).toBe('mid');
  });

  it('no powerLevel defaults to high', () => {
    const m: ShipModule = { moduleId: 'laser_mk1', slotIndex: 2, source: 'standard' };
    expect(getModuleEffectivePowerLevel(m)).toBe('high');
  });
});
