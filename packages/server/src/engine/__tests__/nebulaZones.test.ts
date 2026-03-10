import { describe, it, expect } from 'vitest';
import { isInNebulaZone } from '../worldgen.js';

describe('isInNebulaZone distribution', () => {
  it('produces nebula sectors in a 500x500 quadrant far from origin', () => {
    // Sample a 500×500 quadrant at (1000, 1000) — safely past NEBULA_SAFE_ORIGIN=200
    let nebulaCount = 0;
    const total = 500 * 500;
    for (let dx = 0; dx < 500; dx++) {
      for (let dy = 0; dy < 500; dy++) {
        if (isInNebulaZone(1000 + dx, 1000 + dy)) nebulaCount++;
      }
    }
    const fraction = nebulaCount / total;
    // With 1-2 blobs of ~20-200 sectors in 250,000 total sectors:
    // expect at least some nebula exists, but less than 50% coverage
    expect(fraction).toBeLessThan(0.5);
    expect(nebulaCount).toBeGreaterThan(0);
  });

  it('has no nebula within NEBULA_SAFE_ORIGIN of origin', () => {
    let found = false;
    for (let x = -200; x <= 200 && !found; x++) {
      for (let y = -200; y <= 200 && !found; y++) {
        if (isInNebulaZone(x, y)) found = true;
      }
    }
    expect(found).toBe(false);
  });
});
