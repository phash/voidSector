import { describe, it, expect } from 'vitest';
import { getAcepEffects } from '../engine/acepXpService.js';

describe('wreckDetection ACEP effect', () => {
  it('is false when explorer < 25', () => {
    const effects = getAcepEffects({ ausbau: 0, intel: 0, kampf: 0, explorer: 24, total: 24 });
    expect(effects.wreckDetection).toBe(false);
  });

  it('is true when explorer >= 25', () => {
    const effects = getAcepEffects({ ausbau: 0, intel: 0, kampf: 0, explorer: 25, total: 25 });
    expect(effects.wreckDetection).toBe(true);
  });
});
