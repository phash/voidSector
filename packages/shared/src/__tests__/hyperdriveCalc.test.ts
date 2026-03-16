import { describe, it, expect } from 'vitest';
import { createHyperdriveState, calculateCurrentCharge, spendCharge } from '../hyperdriveCalc';
import { calculateShipStats } from '../shipCalculator';
import { FUEL_MIN_TANK } from '../constants.js';

describe('createHyperdriveState', () => {
  it('creates state from ship stats with full charge', () => {
    const state = createHyperdriveState({ hyperdriveRange: 16, hyperdriveRegen: 2.0 }, 1000);
    expect(state.charge).toBe(16);
    expect(state.maxCharge).toBe(16);
    expect(state.regenPerSecond).toBe(2.0);
    expect(state.lastTick).toBe(1000);
  });

  it('creates state with zero range', () => {
    const state = createHyperdriveState({ hyperdriveRange: 0, hyperdriveRegen: 0 }, 5000);
    expect(state.charge).toBe(0);
    expect(state.maxCharge).toBe(0);
    expect(state.regenPerSecond).toBe(0);
  });
});

describe('calculateCurrentCharge', () => {
  it('returns current charge when no time has elapsed', () => {
    const state = createHyperdriveState({ hyperdriveRange: 16, hyperdriveRegen: 2.0 }, 1000);
    expect(calculateCurrentCharge(state, 1000)).toBe(16);
  });

  it('regenerates charge over time', () => {
    const state = {
      charge: 0,
      maxCharge: 16,
      regenPerSecond: 2.0,
      lastTick: 0,
    };
    // After 5 seconds: 0 + 5 * 2.0 = 10
    expect(calculateCurrentCharge(state, 5000)).toBe(10);
  });

  it('clamps charge to maxCharge', () => {
    const state = {
      charge: 10,
      maxCharge: 16,
      regenPerSecond: 2.0,
      lastTick: 0,
    };
    // After 10 seconds: 10 + 10 * 2.0 = 30, clamped to 16
    expect(calculateCurrentCharge(state, 10_000)).toBe(16);
  });

  it('handles partial regeneration', () => {
    const state = {
      charge: 5,
      maxCharge: 30,
      regenPerSecond: 3.0,
      lastTick: 0,
    };
    // After 3 seconds: 5 + 3 * 3.0 = 14
    expect(calculateCurrentCharge(state, 3000)).toBe(14);
  });

  it('handles zero regen', () => {
    const state = {
      charge: 8,
      maxCharge: 16,
      regenPerSecond: 0,
      lastTick: 0,
    };
    // After any time, charge stays at 8
    expect(calculateCurrentCharge(state, 60_000)).toBe(8);
  });

  it('does not decrease charge when time goes backwards (clamps elapsed to 0)', () => {
    const state = {
      charge: 10,
      maxCharge: 16,
      regenPerSecond: 2.0,
      lastTick: 5000,
    };
    // Time before lastTick — elapsed is clamped to 0
    expect(calculateCurrentCharge(state, 3000)).toBe(10);
  });
});

describe('spendCharge', () => {
  it('spends charge and returns updated state', () => {
    const state = {
      charge: 16,
      maxCharge: 16,
      regenPerSecond: 2.0,
      lastTick: 0,
    };
    const result = spendCharge(state, 10, 0);
    expect(result).not.toBeNull();
    expect(result!.charge).toBe(6);
    expect(result!.maxCharge).toBe(16);
    expect(result!.regenPerSecond).toBe(2.0);
    expect(result!.lastTick).toBe(0);
  });

  it('returns null when insufficient charge', () => {
    const state = {
      charge: 5,
      maxCharge: 16,
      regenPerSecond: 2.0,
      lastTick: 0,
    };
    const result = spendCharge(state, 10, 0);
    expect(result).toBeNull();
  });

  it('accounts for regen before spending', () => {
    const state = {
      charge: 5,
      maxCharge: 16,
      regenPerSecond: 2.0,
      lastTick: 0,
    };
    // After 3 seconds: 5 + 3 * 2.0 = 11, then spend 10 => 1
    const result = spendCharge(state, 10, 3000);
    expect(result).not.toBeNull();
    expect(result!.charge).toBe(1);
    expect(result!.lastTick).toBe(3000);
  });

  it('returns null when regen is still insufficient', () => {
    const state = {
      charge: 0,
      maxCharge: 16,
      regenPerSecond: 1.0,
      lastTick: 0,
    };
    // After 2 seconds: 0 + 2 * 1.0 = 2, need 10 => null
    const result = spendCharge(state, 10, 2000);
    expect(result).toBeNull();
  });

  it('allows spending exact charge', () => {
    const state = {
      charge: 10,
      maxCharge: 16,
      regenPerSecond: 0,
      lastTick: 0,
    };
    const result = spendCharge(state, 10, 0);
    expect(result).not.toBeNull();
    expect(result!.charge).toBe(0);
  });

  it('handles partial charge jump (spend less than full charge)', () => {
    const state = {
      charge: 16,
      maxCharge: 16,
      regenPerSecond: 2.0,
      lastTick: 0,
    };
    const result = spendCharge(state, 3, 0);
    expect(result).not.toBeNull();
    expect(result!.charge).toBe(13);
  });
});

describe('V2 calculateShipStats drive stats', () => {
  it('returns zero legacy hyperdrive stats with no drive modules', () => {
    const stats = calculateShipStats([]);
    expect(stats.hyperdriveRange).toBe(0);
    expect(stats.hyperdriveSpeed).toBe(0);
    expect(stats.hyperdriveRegen).toBe(0);
    expect(stats.hyperdriveFuelEfficiency).toBe(0);
  });

  it('ion_drive_mk1 sets V2 jumpDistance and fuelCapacity', () => {
    const stats = calculateShipStats([{ moduleId: 'ion_drive_mk1', slotIndex: 0 }]);
    expect(stats.jumpDistance).toBe(32);
    expect(stats.fuelCapacity).toBe(2000);
    expect(stats.rechargeRate).toBe(4);
  });

  it('ion_drive_mk2 sets V2 jumpDistance and fuelCapacity', () => {
    const stats = calculateShipStats([{ moduleId: 'ion_drive_mk2', slotIndex: 0 }]);
    expect(stats.jumpDistance).toBe(48);
    expect(stats.fuelCapacity).toBe(4000);
    expect(stats.rechargeRate).toBe(6);
  });

  it('ion_drive_mk3 sets V2 jumpDistance and fuelCapacity', () => {
    const stats = calculateShipStats([{ moduleId: 'ion_drive_mk3', slotIndex: 0 }]);
    expect(stats.jumpDistance).toBe(64);
    expect(stats.fuelCapacity).toBe(8000);
    expect(stats.rechargeRate).toBe(8);
  });

  it('void_drive sets V2 jumpDistance and fuelCapacity', () => {
    const stats = calculateShipStats([{ moduleId: 'void_drive', slotIndex: 0 }]);
    expect(stats.jumpDistance).toBe(1200);
    expect(stats.fuelCapacity).toBe(2000);
    expect(stats.rechargeRate).toBe(24);
  });
});

describe('drive fuelMax', () => {
  it('ion_drive_mk1 sets fuelMax from fuelCapacity', () => {
    const stats = calculateShipStats([{ moduleId: 'ion_drive_mk1', slotIndex: 0 }]);
    // fuelCapacity=2000, but FUEL_MIN_TANK=10000 → fuelMax = max(10000, 2000) = 10000
    expect(stats.fuelMax).toBeGreaterThanOrEqual(FUEL_MIN_TANK);
  });

  it('am_drive_mk1 sets fuelMax from fuelCapacity', () => {
    const stats = calculateShipStats([{ moduleId: 'am_drive_mk1', slotIndex: 0 }]);
    // fuelCapacity=12000, FUEL_MIN_TANK=10000 → fuelMax = max(10000, 12000) = 12000
    expect(stats.fuelMax).toBe(12_000);
  });

  it('am_drive_mk2 sets fuelMax from fuelCapacity', () => {
    const stats = calculateShipStats([{ moduleId: 'am_drive_mk2', slotIndex: 0 }]);
    // fuelCapacity=20000
    expect(stats.fuelMax).toBe(20_000);
  });

  it('fuelMax never falls below FUEL_MIN_TANK', () => {
    const stats = calculateShipStats([]);
    expect(stats.fuelMax).toBeGreaterThanOrEqual(FUEL_MIN_TANK);
  });
});
