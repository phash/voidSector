import { describe, it, expect } from 'vitest';
import { createHyperdriveState, calculateCurrentCharge, spendCharge } from '../hyperdriveCalc';
import { calculateShipStats } from '../shipCalculator';

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

describe('efficiency clamping in shipCalculator', () => {
  it('clamps hyperdriveFuelEfficiency to [0, 1]', () => {
    // With void_drive: 0.35 — within range, should not be clamped
    const stats = calculateShipStats('scout', [{ moduleId: 'void_drive', slotIndex: 0 }]);
    expect(stats.hyperdriveFuelEfficiency).toBe(0.35);
    expect(stats.hyperdriveFuelEfficiency).toBeGreaterThanOrEqual(0);
    expect(stats.hyperdriveFuelEfficiency).toBeLessThanOrEqual(1);
  });

  it('returns zero hyperdrive stats with no drive modules', () => {
    const stats = calculateShipStats('scout', []);
    expect(stats.hyperdriveRange).toBe(0);
    expect(stats.hyperdriveSpeed).toBe(0);
    expect(stats.hyperdriveRegen).toBe(0);
    expect(stats.hyperdriveFuelEfficiency).toBe(0);
  });

  it('adds hyperdrive stats from drive_mk1', () => {
    const stats = calculateShipStats('scout', [{ moduleId: 'drive_mk1', slotIndex: 0 }]);
    expect(stats.hyperdriveRange).toBe(4);
    expect(stats.hyperdriveSpeed).toBe(2);
    expect(stats.hyperdriveRegen).toBe(1.0);
    expect(stats.hyperdriveFuelEfficiency).toBe(0);
  });

  it('adds hyperdrive stats from drive_mk2', () => {
    const stats = calculateShipStats('freighter', [{ moduleId: 'drive_mk2', slotIndex: 0 }]);
    expect(stats.hyperdriveRange).toBe(8);
    expect(stats.hyperdriveSpeed).toBe(3);
    expect(stats.hyperdriveRegen).toBe(1.5);
    expect(stats.hyperdriveFuelEfficiency).toBeCloseTo(0.1);
  });

  it('adds hyperdrive stats from drive_mk3', () => {
    const stats = calculateShipStats('cruiser', [{ moduleId: 'drive_mk3', slotIndex: 0 }]);
    expect(stats.hyperdriveRange).toBe(16);
    expect(stats.hyperdriveSpeed).toBe(5);
    expect(stats.hyperdriveRegen).toBe(2.0);
    expect(stats.hyperdriveFuelEfficiency).toBeCloseTo(0.2);
  });

  it('adds hyperdrive stats from void_drive', () => {
    const stats = calculateShipStats('explorer', [{ moduleId: 'void_drive', slotIndex: 0 }]);
    expect(stats.hyperdriveRange).toBe(30);
    expect(stats.hyperdriveSpeed).toBe(8);
    expect(stats.hyperdriveRegen).toBe(3.0);
    expect(stats.hyperdriveFuelEfficiency).toBeCloseTo(0.35);
  });
});
