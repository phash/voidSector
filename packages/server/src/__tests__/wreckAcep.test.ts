import { describe, it, expect } from 'vitest';
import { getAcepEffects, type AcepXpSummary } from '../engine/acepXpService.js';

const summary = (over: Partial<AcepXpSummary> = {}): AcepXpSummary => ({
  ausbau: 0, intel: 0, kampf: 0, explorer: 0, defense: 0, trader: 0, miner: 0, total: 0, ...over,
});

// wreckDetection unlocks at INTEL level 5 (see getAcepEffects).
describe('wreckDetection ACEP effect', () => {
  it('is false below intel level 5', () => {
    expect(getAcepEffects(summary({ intel: 4 })).wreckDetection).toBe(false);
  });

  it('is true at intel level 5+', () => {
    expect(getAcepEffects(summary({ intel: 5 })).wreckDetection).toBe(true);
    expect(getAcepEffects(summary({ intel: 10 })).wreckDetection).toBe(true);
  });
});
