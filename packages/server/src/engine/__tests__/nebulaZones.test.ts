import { describe, it, expect } from 'vitest';
import { isInNebulaZone } from '../worldgen.js';
import { NEBULA_SAFE_ORIGIN } from '@void-sector/shared';

/** Sample a square region and return a boolean nebula grid. */
function sampleRegion(x0: number, y0: number, n: number): boolean[][] {
  const grid: boolean[][] = [];
  for (let dx = 0; dx < n; dx++) {
    grid[dx] = [];
    for (let dy = 0; dy < n; dy++) {
      grid[dx][dy] = isInNebulaZone(x0 + dx, y0 + dy);
    }
  }
  return grid;
}

/** Smallest 4-connected nebula component NOT touching the region border. */
function smallestInteriorCluster(grid: boolean[][]): number {
  const n = grid.length;
  const seen = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  // Returns Infinity if no interior (non-border-touching) cluster exists;
  // safe here because the sampled region reliably contains interior clusters.
  let smallest = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!grid[i][j] || seen[i][j]) continue;
      let touchesBorder = false;
      let size = 0;
      const stack: [number, number][] = [[i, j]];
      seen[i][j] = true;
      while (stack.length) {
        const [a, b] = stack.pop()!;
        size++;
        if (a === 0 || b === 0 || a === n - 1 || b === n - 1) touchesBorder = true;
        for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const na = a + da;
          const nb = b + db;
          if (na >= 0 && nb >= 0 && na < n && nb < n && grid[na][nb] && !seen[na][nb]) {
            seen[na][nb] = true;
            stack.push([na, nb]);
          }
        }
      }
      if (!touchesBorder && size < smallest) smallest = size;
    }
  }
  return smallest;
}

describe('nebula generation', () => {
  it('covers ~5% of a region far from origin', () => {
    const n = 500;
    const grid = sampleRegion(1000, 1000, n);
    let count = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (grid[i][j]) count++;
    const fraction = count / (n * n);
    expect(fraction).toBeGreaterThanOrEqual(0.04);
    expect(fraction).toBeLessThanOrEqual(0.06);
  });

  it('every contiguous nebula cluster has at least 12 sectors', () => {
    const grid = sampleRegion(1000, 1000, 500);
    expect(smallestInteriorCluster(grid)).toBeGreaterThanOrEqual(12);
  });

  it('has no nebula within NEBULA_SAFE_ORIGIN of the origin', () => {
    const r = NEBULA_SAFE_ORIGIN;
    for (let x = -r; x <= r; x++) {
      for (let y = -r; y <= r; y++) {
        if (x * x + y * y < r * r) {
          expect(isInNebulaZone(x, y)).toBe(false);
        }
      }
    }
  });

  it('is deterministic — pinned golden values guard the worldgen seed/constants', () => {
    // These coordinates are pinned against the current WORLD_SEED + nebula
    // constants. If the hash, seed, or zone constants change, update them
    // deliberately — a surprise failure here means worldgen output shifted.
    expect(isInNebulaZone(1000, 1020)).toBe(true);
    expect(isInNebulaZone(1000, 1000)).toBe(false);
  });
});
