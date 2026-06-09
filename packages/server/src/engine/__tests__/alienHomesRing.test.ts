import { describe, it, expect } from 'vitest';
import { quadrantNearestSectorDistance } from '../alienHomeGuard.js';
import { QUADRANT_SIZE } from '@void-sector/shared';

const RING_HOMES: Record<string, { qx: number; qy: number }> = {
  kthari: { qx: 3, qy: 1 },
  archivists: { qx: -1, qy: 4 },
  consortium: { qx: 5, qy: -2 },
  mycelians: { qx: -6, qy: -3 },
  mirror_minds: { qx: 2, qy: 7 },
  silent_swarm: { qx: -8, qy: 4 },
  tourist_guild: { qx: 4, qy: -9 },
};

describe('migration 093 alien ring homes', () => {
  it('places all 7 homes inside the 1000–5000 sector ring', () => {
    for (const [faction, { qx, qy }] of Object.entries(RING_HOMES)) {
      const d = quadrantNearestSectorDistance(qx, qy, QUADRANT_SIZE);
      expect(d, `${faction} distance`).toBeGreaterThanOrEqual(1000);
      expect(d, `${faction} distance`).toBeLessThanOrEqual(5000);
    }
  });
  it('has no two factions sharing a home quadrant and none at origin', () => {
    const keys = Object.values(RING_HOMES).map((h) => `${h.qx}:${h.qy}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain('0:0');
  });
});
