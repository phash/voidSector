import { describe, it, expect, vi } from 'vitest';

// Mock DB so the pure functions import without a live connection.
vi.mock('../../db/client.js', () => ({ query: vi.fn() }));
vi.mock('../../db/queries.js', () => ({
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  deductWissen: vi.fn(),
}));

import { getAusbauGating, getAcepEffects, type AcepXpSummary } from '../acepXpService.js';

const summary = (over: Partial<AcepXpSummary> = {}): AcepXpSummary => ({
  ausbau: 0, intel: 0, kampf: 0, explorer: 0, defense: 0, trader: 0, miner: 0, total: 0, ...over,
});

// getAusbauGating is keyed on the AUSBAU *level* (0..10), not raw XP.
describe('getAusbauGating (level-based)', () => {
  it('level 0: lab tier 1, no factory', () => {
    const g = getAusbauGating(0);
    expect(g.maxLabTier).toBe(1);
    expect(g.factoryUnlocked).toBe(false);
  });

  it('level 1: still lab tier 1, no factory', () => {
    expect(getAusbauGating(1).maxLabTier).toBe(1);
    expect(getAusbauGating(1).factoryUnlocked).toBe(false);
  });

  it('level 2: lab tier 2, factory unlocked', () => {
    const g = getAusbauGating(2);
    expect(g.maxLabTier).toBe(2);
    expect(g.factoryUnlocked).toBe(true);
  });

  it('levels 5 / 7 / 10 map to lab tiers 3 / 4 / 5', () => {
    expect(getAusbauGating(5).maxLabTier).toBe(3);
    expect(getAusbauGating(7).maxLabTier).toBe(4);
    expect(getAusbauGating(10).maxLabTier).toBe(5);
    expect(getAusbauGating(10).factorySpeedBonus).toBe(0.5);
  });
});

describe('getAcepEffects (level-based bonuses)', () => {
  it('scales with path levels', () => {
    const e = getAcepEffects(summary({ ausbau: 6, intel: 6, kampf: 5, miner: 4, defense: 3 }));
    expect(e.extraModuleSlots).toBe(2); // floor(6/3)
    expect(e.scanRadiusBonus).toBe(2); // floor(6/3)
    expect(e.combatDamageBonus).toBeCloseTo(0.10); // 5 * 0.02
    expect(e.miningBonus).toBeCloseTo(0.12); // 4 * 0.03
    expect(e.shieldRegenBonus).toBeCloseTo(0.09); // 3 * 0.03
  });

  it('gates explorer perks at level thresholds', () => {
    expect(getAcepEffects(summary({ explorer: 4 })).ancientDetection).toBe(false);
    expect(getAcepEffects(summary({ explorer: 5 })).ancientDetection).toBe(true);
    expect(getAcepEffects(summary({ explorer: 10 })).helionDecoderEnabled).toBe(true);
  });

  it('zero levels yield no bonuses', () => {
    const e = getAcepEffects(summary());
    expect(e.extraModuleSlots).toBe(0);
    expect(e.combatDamageBonus).toBe(0);
    expect(e.cargoMultiplier).toBe(1);
  });
});
