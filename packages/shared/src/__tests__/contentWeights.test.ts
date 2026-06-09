import { describe, it, expect } from 'vitest';
import { CONTENT_WEIGHTS, CIV_STATIONS_ENABLED, ALIEN_EXPANSION_ENABLED } from '../constants';

describe('CONTENT_WEIGHTS (worldgen)', () => {
  it('never rolls a station sector (only 0:0 is a station)', () => {
    expect(CONTENT_WEIGHTS.station).toBe(0);
  });

  it('weights still sum to 1.0', () => {
    const sum = Object.values(CONTENT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 6);
  });
});

describe('world-generation kill-switches (sole-station launch)', () => {
  it('NPC civ-station generation is off', () => {
    expect(CIV_STATIONS_ENABLED).toBe(false);
  });
  it('alien expansion is frozen (Phase 2 replaces this with the wake-trigger)', () => {
    expect(ALIEN_EXPANSION_ENABLED).toBe(false);
  });
});
