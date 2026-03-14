import { describe, it, expect } from 'vitest';
import { validateCreateSlate, validateNpcBuyback } from '../commands.js';
import { SLATE_AP_COST_SECTOR, SLATE_AP_COST_AREA, SLATE_AREA_RADIUS } from '@void-sector/shared';

describe('validateCreateSlate', () => {
  const baseState = {
    ap: 5,
    scannerLevel: 1,
    slateCount: 2,
    memory: 6,
  };

  it('rejects if not enough AP for sector slate', () => {
    const result = validateCreateSlate({ ...baseState, ap: 0 }, 'sector');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('AP');
  });

  it('rejects if memory is full', () => {
    const result = validateCreateSlate({ ...baseState, slateCount: 6, memory: 6 }, 'sector');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Memory');
  });

  it('accepts valid sector slate', () => {
    const result = validateCreateSlate(baseState, 'sector');
    expect(result.valid).toBe(true);
    expect(result.apCost).toBe(SLATE_AP_COST_SECTOR);
  });

  it('calculates area slate AP cost from scanner level', () => {
    const result = validateCreateSlate({ ...baseState, ap: 10, scannerLevel: 2 }, 'area');
    expect(result.valid).toBe(true);
    expect(result.apCost).toBe(SLATE_AP_COST_AREA + 2 * 2);
    expect(result.radius).toBe(SLATE_AREA_RADIUS[2]);
  });

  it('rejects area slate if not enough AP', () => {
    const result = validateCreateSlate({ ...baseState, ap: 2, scannerLevel: 3 }, 'area');
    expect(result.valid).toBe(false);
  });
});

describe('validateNpcBuyback', () => {
  it('rejects if player has no trading post', () => {
    const result = validateNpcBuyback(false, 3);
    expect(result.valid).toBe(false);
  });

  it('calculates correct payout', () => {
    const result = validateNpcBuyback(true, 5);
    expect(result.valid).toBe(true);
    expect(result.payout).toBe(25);
  });
});
