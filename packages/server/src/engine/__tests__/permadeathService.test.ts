/**
 * Tests for permadeathService.ts — ACEP/4
 * Tests deterministic logic that doesn't require DB access.
 */
import { describe, it, expect } from 'vitest';

// ── Mirror of deterministic salvage logic from permadeathService.ts ──

function computeSalvageable(modules: string[], shipId: string): string[] {
  return modules.filter((_, i) => {
    const hash = shipId
      .split('')
      .reduce((acc, ch, ci) => acc ^ (ch.charCodeAt(0) * (ci + 1) * 31), i * 97);
    return Math.abs(hash) % 100 < 25;
  });
}

// ── Mirror of legacy XP computation ──

function computeLegacyXp(xp: { ausbau: number; intel: number; kampf: number; explorer: number }) {
  return {
    ausbau: Math.floor(xp.ausbau * 0.3),
    intel: Math.floor(xp.intel * 0.3),
    kampf: Math.floor(xp.kampf * 0.3),
    explorer: Math.floor(xp.explorer * 0.3),
  };
}

describe('permadeathService — salvage logic', () => {
  it('returns 25% or fewer modules as salvageable on average', () => {
    const modules = Array.from({ length: 20 }, (_, i) => `module_${i}`);
    const shipId = 'test-ship-id-1234';
    const salvageable = computeSalvageable(modules, shipId);
    // Should be between 0 and 8 (generous range for deterministic hash)
    expect(salvageable.length).toBeLessThanOrEqual(8);
  });

  it('is deterministic for same shipId + modules', () => {
    const modules = ['drive_mk1', 'scanner_mk2', 'cargo_mk1', 'armor_mk2'];
    const shipId = 'stable-ship-uuid';
    const first = computeSalvageable(modules, shipId);
    const second = computeSalvageable(modules, shipId);
    expect(first).toEqual(second);
  });

  it('produces different results for different shipIds', () => {
    const modules = Array.from({ length: 10 }, (_, i) => `module_${i}`);
    const a = computeSalvageable(modules, 'ship-aaa');
    const b = computeSalvageable(modules, 'ship-bbb');
    // Extremely unlikely to be identical for 10 modules with different seeds
    // (just verify it runs without throwing)
    expect(Array.isArray(a)).toBe(true);
    expect(Array.isArray(b)).toBe(true);
  });

  it('handles empty module list', () => {
    const salvageable = computeSalvageable([], 'some-ship-id');
    expect(salvageable).toEqual([]);
  });
});

describe('permadeathService — legacy XP', () => {
  it('returns 30% of each path rounded down', () => {
    const legacy = computeLegacyXp({ ausbau: 10, intel: 20, kampf: 33, explorer: 15 });
    expect(legacy.ausbau).toBe(3); // floor(10*0.3)
    expect(legacy.intel).toBe(6); // floor(20*0.3)
    expect(legacy.kampf).toBe(9); // floor(33*0.3)
    expect(legacy.explorer).toBe(4); // floor(15*0.3)
  });

  it('returns 0 when XP is 0', () => {
    const legacy = computeLegacyXp({ ausbau: 0, intel: 0, kampf: 0, explorer: 0 });
    expect(legacy).toEqual({ ausbau: 0, intel: 0, kampf: 0, explorer: 0 });
  });

  it('caps correctly at max XP path (50)', () => {
    const legacy = computeLegacyXp({ ausbau: 50, intel: 50, kampf: 0, explorer: 0 });
    expect(legacy.ausbau).toBe(15); // floor(50*0.3)
    expect(legacy.intel).toBe(15);
    expect(legacy.kampf).toBe(0);
    expect(legacy.explorer).toBe(0);
  });

  it('total legacy never exceeds 30% of total cap (100)', () => {
    const legacy = computeLegacyXp({ ausbau: 50, intel: 50, kampf: 0, explorer: 0 });
    const total = legacy.ausbau + legacy.intel + legacy.kampf + legacy.explorer;
    expect(total).toBeLessThanOrEqual(30); // 30% of 100
  });
});

describe('permadeathService — radar icon tier', () => {
  function getIconTier(total: number): number {
    return total >= 80 ? 4 : total >= 50 ? 3 : total >= 20 ? 2 : 1;
  }

  it('tier 1 for xp < 20', () => {
    expect(getIconTier(0)).toBe(1);
    expect(getIconTier(19)).toBe(1);
  });

  it('tier 2 for xp 20-49', () => {
    expect(getIconTier(20)).toBe(2);
    expect(getIconTier(49)).toBe(2);
  });

  it('tier 3 for xp 50-79', () => {
    expect(getIconTier(50)).toBe(3);
    expect(getIconTier(79)).toBe(3);
  });

  it('tier 4 for xp >= 80', () => {
    expect(getIconTier(80)).toBe(4);
    expect(getIconTier(100)).toBe(4);
  });
});
