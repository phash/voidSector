import { describe, it, expect, vi } from 'vitest';

// Mock DB dependencies so the pure calculateWissenGain can be tested in isolation
vi.mock('../db/client.js', () => ({ query: vi.fn() }));
vi.mock('../db/queries.js', () => ({ addWissen: vi.fn() }));
vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { calculateWissenGain } from '../engine/wissenTickHandler.js';

describe('calculateWissenGain', () => {
  it('returns 0 for lab tier 0 (no lab)', () => {
    expect(calculateWissenGain(0, [], 3_600_000)).toBe(0);
  });

  it('returns base rate for lab tier 1 over 1 hour (5 Wissen)', () => {
    // Lab I = 5/h, 1h = 3_600_000 ms → gain = 5
    expect(calculateWissenGain(1, [], 3_600_000)).toBe(5);
  });

  it('applies asteroid_field multiplier (×1.2)', () => {
    // 5 × 1.2 = 6
    expect(calculateWissenGain(1, ['asteroid_field'], 3_600_000)).toBe(6);
  });

  it('applies ancient_jumpgate multiplier (×5.0)', () => {
    // 5 × 5.0 = 25
    expect(calculateWissenGain(1, ['ancient_jumpgate'], 3_600_000)).toBe(25);
  });

  it('multiplies stacked multipliers (nebula ×1.5 + anomaly ×2.0)', () => {
    // Lab II = 12/h × 1.5 × 2.0 = 36/h over 1h
    expect(calculateWissenGain(2, ['nebula', 'anomaly'], 3_600_000)).toBe(36);
  });

  it('floors the result (no fractional Wissen)', () => {
    // Lab I = 5/h, 30min = 1_800_000 ms → 2.5 → floor → 2
    expect(calculateWissenGain(1, [], 1_800_000)).toBe(2);
  });

  it('lab tier 5 with no multipliers, 1 hour = 80 Wissen', () => {
    expect(calculateWissenGain(5, [], 3_600_000)).toBe(80);
  });
});
