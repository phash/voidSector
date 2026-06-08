import { describe, it, expect } from 'vitest';
import { scaledPirateLevel, PIRATE_MAX_LEVEL } from '../constants.js';

describe('scaledPirateLevel (BB4)', () => {
  it('base level from distance only when player + civ are zero', () => {
    // dist 100 → floor(100/50)+1 = 3
    expect(scaledPirateLevel(100, 0, 0)).toBe(3);
  });

  it('scales up with ACEP total (+1 per 3000 XP)', () => {
    expect(scaledPirateLevel(0, 0, 0)).toBe(1); // floor(0/50)+1
    expect(scaledPirateLevel(0, 6000, 0)).toBe(3); // 1 + 2
  });

  it('scales up with civ level (+0..3)', () => {
    expect(scaledPirateLevel(0, 0, 1)).toBe(4); // 1 + floor(1*3)
    expect(scaledPirateLevel(0, 0, 0.5)).toBe(2); // 1 + floor(1.5)=1
  });

  it('caps at PIRATE_MAX_LEVEL', () => {
    expect(scaledPirateLevel(5000, 99999, 1)).toBe(PIRATE_MAX_LEVEL);
  });

  it('treats negative/over-range inputs safely', () => {
    expect(scaledPirateLevel(0, -100, 5)).toBe(4); // acep clamped ≥0; civ clamped ≤1 → +3
  });
});
