import { describe, it, expect } from 'vitest';
import { refineryCreditsPerTick, sensorScanBonus } from '../stationPassiveEffects.js';

describe('refineryCreditsPerTick', () => {
  it('is zero without a refinery and scales with level', () => {
    expect(refineryCreditsPerTick(0)).toBe(0);
    expect(refineryCreditsPerTick(3)).toBe(6); // 2 * 3
  });
});

describe('sensorScanBonus', () => {
  it('is zero without a sensor and scales with level', () => {
    expect(sensorScanBonus(0)).toBe(0);
    expect(sensorScanBonus(4)).toBe(4); // 1 * 4
  });
});
