import { describe, it, expect } from 'vitest';
import { HULLS } from '@void-sector/shared';
import type { HullType } from '@void-sector/shared';

describe('hull lookup', () => {
  it('HULLS contains all defined hull types', () => {
    const types: HullType[] = ['scout', 'freighter', 'cruiser', 'explorer', 'battleship'];
    for (const hull of types) {
      expect(HULLS[hull]).toBeDefined();
      expect(HULLS[hull].baseJumpRange).toBeGreaterThan(0);
      expect(HULLS[hull].baseCargo).toBeGreaterThan(0);
      expect(HULLS[hull].baseScannerLevel).toBeGreaterThanOrEqual(1);
    }
  });

  it('scout hull returns correct stats', () => {
    const stats = HULLS['scout'];
    expect(stats.baseJumpRange).toBe(5);
    expect(stats.baseCargo).toBe(3);
    expect(stats.baseScannerLevel).toBe(1);
  });
});
