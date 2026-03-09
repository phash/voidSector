import { describe, it, expect } from 'vitest';

/**
 * Unit tests for ACEP XP budget logic.
 * The cap enforcement logic lives inside addAcepXp() which requires a DB.
 * Here we test the budget calculation logic in isolation (no DB import needed).
 */

type AcepPath = 'ausbau' | 'intel' | 'kampf' | 'explorer';
const ACEP_PATH_CAP = 50;
const ACEP_TOTAL_CAP = 100;

describe('ACEP XP constants', () => {
  it('per-path cap is 50', () => {
    expect(ACEP_PATH_CAP).toBe(50);
  });

  it('total cap is 100', () => {
    expect(ACEP_TOTAL_CAP).toBe(100);
  });

  it('total cap equals 2 × per-path cap (forces specialisation)', () => {
    expect(ACEP_TOTAL_CAP).toBe(2 * ACEP_PATH_CAP);
  });
});

describe('ACEP XP budget logic', () => {
  /** Mirrors the cap logic in addAcepXp without DB */
  function computeEffectiveGain(
    current: Record<AcepPath, number>,
    path: AcepPath,
    amount: number,
  ): number {
    const total = Object.values(current).reduce((a, b) => a + b, 0);
    const pathValue = current[path];
    const remaining_path = ACEP_PATH_CAP - pathValue;
    const remaining_total = ACEP_TOTAL_CAP - total;
    return Math.max(0, Math.min(amount, remaining_path, remaining_total));
  }

  const empty = (): Record<AcepPath, number> => ({
    ausbau: 0,
    intel: 0,
    kampf: 0,
    explorer: 0,
  });

  it('gains full amount when budget is available', () => {
    const result = computeEffectiveGain(empty(), 'intel', 10);
    expect(result).toBe(10);
  });

  it('caps gain at per-path limit', () => {
    const current = { ...empty(), intel: 48 };
    const result = computeEffectiveGain(current, 'intel', 10);
    expect(result).toBe(2); // only 2 remaining of 50
  });

  it('caps gain at total budget limit', () => {
    // 90 XP already spent across paths
    const current = { ausbau: 50, intel: 40, kampf: 0, explorer: 0 };
    const result = computeEffectiveGain(current, 'kampf', 20);
    expect(result).toBe(10); // only 10 remaining of 100
  });

  it('returns 0 when path is already at cap', () => {
    const current = { ...empty(), kampf: 50 };
    const result = computeEffectiveGain(current, 'kampf', 5);
    expect(result).toBe(0);
  });

  it('returns 0 when total budget is exhausted', () => {
    const current = { ausbau: 50, intel: 50, kampf: 0, explorer: 0 };
    const result = computeEffectiveGain(current, 'kampf', 5);
    expect(result).toBe(0);
  });

  it('each path can reach cap independently', () => {
    // Max out ausbau and intel — these together hit total cap
    const current = { ausbau: 50, intel: 50, kampf: 0, explorer: 0 };
    expect(computeEffectiveGain(current, 'kampf', 1)).toBe(0);
    expect(computeEffectiveGain(current, 'explorer', 1)).toBe(0);
  });

  it('respects both caps simultaneously', () => {
    // 45 intel (5 remaining on path), 50 total remaining on budget → path wins
    const current = { ...empty(), intel: 45 };
    expect(computeEffectiveGain(current, 'intel', 10)).toBe(5);

    // 50 ausbau, 45 kampf (5 remaining on path) — but total is 95, so 5 remaining on budget
    const current2 = { ausbau: 50, intel: 0, kampf: 45, explorer: 0 };
    expect(computeEffectiveGain(current2, 'kampf', 10)).toBe(5); // path cap limits
  });
});
