import { describe, it, expect } from 'vitest';
import { CONTENT_WEIGHTS } from '../constants';

describe('CONTENT_WEIGHTS (worldgen)', () => {
  it('never rolls a station sector (only 0:0 is a station)', () => {
    expect(CONTENT_WEIGHTS.station).toBe(0);
  });

  it('weights still sum to 1.0', () => {
    const sum = Object.values(CONTENT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 6);
  });
});
