// packages/server/src/engine/__tests__/voidLifecycleService.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeNextGeneration,
  pickGoLSpawnPoints,
  R_PENTOMINO,
  ACORN,
  DIEHARD,
  VOID_ORIGIN_EXCLUSION,
} from '../voidLifecycleService.js';

// ─── computeNextGeneration ───────────────────────────────────────────────────

describe('computeNextGeneration', () => {
  it('blinker oscillates between horizontal and vertical', () => {
    // Horizontal blinker: (-1,0), (0,0), (1,0)
    const alive = new Set(['-1:0', '0:0', '1:0']);
    const { born, died } = computeNextGeneration(alive);

    // Ends die (1 neighbor each), center survives (2 neighbors)
    expect(died.sort()).toEqual(['-1:0', '1:0']);
    // (0,-1) and (0,1) each have exactly 3 neighbors → born
    expect(born.sort()).toEqual(['0:-1', '0:1']);
  });

  it('blinker returns to original after two generations', () => {
    const gen0 = new Set(['-1:0', '0:0', '1:0']);
    const step1 = computeNextGeneration(gen0);
    const gen1 = new Set(gen0);
    for (const k of step1.died) gen1.delete(k);
    for (const k of step1.born) gen1.add(k);

    const step2 = computeNextGeneration(gen1);
    const gen2 = new Set(gen1);
    for (const k of step2.died) gen2.delete(k);
    for (const k of step2.born) gen2.add(k);

    expect([...gen2].sort()).toEqual([...gen0].sort());
  });

  it('block (2×2 still life) does not change', () => {
    const alive = new Set(['0:0', '0:1', '1:0', '1:1']);
    const { born, died } = computeNextGeneration(alive);
    expect(born).toHaveLength(0);
    expect(died).toHaveLength(0);
  });

  it('beehive (still life) does not change', () => {
    // Beehive: (1,0),(2,0),(0,1),(3,1),(1,2),(2,2)
    const alive = new Set(['1:0', '2:0', '0:1', '3:1', '1:2', '2:2']);
    const { born, died } = computeNextGeneration(alive);
    expect(born).toHaveLength(0);
    expect(died).toHaveLength(0);
  });

  it('single cell dies (underpopulation)', () => {
    const alive = new Set(['5:5']);
    const { born, died } = computeNextGeneration(alive);
    expect(died).toEqual(['5:5']);
    expect(born).toHaveLength(0);
  });

  it('two adjacent cells both die', () => {
    const alive = new Set(['0:0', '1:0']);
    const { born, died } = computeNextGeneration(alive);
    expect(died.sort()).toEqual(['0:0', '1:0']);
  });

  it('overcrowded center cell dies', () => {
    // Cross pattern: center has 4 neighbors
    const alive = new Set(['0:0', '0:1', '0:-1', '1:0', '-1:0']);
    const { born, died } = computeNextGeneration(alive);
    expect(died).toContain('0:0');
  });

  it('glider moves after one step and has 5 cells', () => {
    // Glider:
    //  .X.
    //  ..X
    //  XXX
    const alive = new Set(['1:0', '2:1', '0:2', '1:2', '2:2']);
    const { born, died } = computeNextGeneration(alive);

    const next = new Set(alive);
    for (const k of died) next.delete(k);
    for (const k of born) next.add(k);

    expect(next.size).toBe(5);
    // Glider should have moved — at least one cell not in original position
    const moved = [...next].some((k) => !alive.has(k));
    expect(moved).toBe(true);
  });

  it('respects origin exclusion zone — blocks births within zone', () => {
    // Place 3 cells just outside exclusion zone so a 4th would be born inside
    const excl = 10;
    const alive = new Set([`${excl + 1}:${excl}`, `${excl}:${excl + 1}`, `${excl + 1}:${excl + 1}`]);
    const { born } = computeNextGeneration(alive, excl);

    const blockedBirths = born.filter((key) => {
      const [qx, qy] = key.split(':').map(Number);
      return Math.max(Math.abs(qx), Math.abs(qy)) <= excl;
    });
    expect(blockedBirths).toHaveLength(0);
  });

  it('allows births outside exclusion zone', () => {
    const excl = 10;
    const alive = new Set([`${excl + 1}:${excl + 1}`, `${excl + 2}:${excl + 1}`, `${excl + 1}:${excl + 2}`]);
    const { born } = computeNextGeneration(alive, excl);

    // (excl+2, excl+2) should be born — it's outside exclusion
    expect(born).toContain(`${excl + 2}:${excl + 2}`);
  });

  it('returns empty arrays for empty input', () => {
    const alive = new Set<string>();
    const { born, died } = computeNextGeneration(alive);
    expect(born).toHaveLength(0);
    expect(died).toHaveLength(0);
  });

  it('handles negative coordinates', () => {
    const alive = new Set(['-1:-1', '0:-1', '-1:0']);
    const { born, died } = computeNextGeneration(alive);
    // L-shape with 3 cells: each has 2 neighbors → all survive
    expect(died).toHaveLength(0);
    // (0,0) has exactly 3 neighbors → born
    expect(born).toContain('0:0');
  });
});

// ─── pickGoLSpawnPoints ──────────────────────────────────────────────────────

describe('pickGoLSpawnPoints', () => {
  it('returns requested number of spawn points', () => {
    const points = pickGoLSpawnPoints(15, 100, 80);
    expect(points).toHaveLength(15);
  });

  it('returns fewer points if ring exhausted before count', () => {
    // Very tight constraints with huge minDistance
    const points = pickGoLSpawnPoints(100, 100, 5000);
    expect(points.length).toBeGreaterThan(0);
    expect(points.length).toBeLessThanOrEqual(100);
  });

  it('all points are outside origin exclusion zone', () => {
    const points = pickGoLSpawnPoints(15, 100, 80);
    for (const { qx, qy } of points) {
      expect(Math.max(Math.abs(qx), Math.abs(qy))).toBeGreaterThan(100);
    }
  });

  it('points maintain minimum distance from each other', () => {
    const points = pickGoLSpawnPoints(15, 100, 80);
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dist =
          Math.abs(points[i].qx - points[j].qx) +
          Math.abs(points[i].qy - points[j].qy);
        expect(dist).toBeGreaterThanOrEqual(80);
      }
    }
  });

  it('distributes points across multiple quadrants (pos/neg coordinates)', () => {
    const points = pickGoLSpawnPoints(8, 100, 80);
    const hasPositiveX = points.some((p) => p.qx > 0);
    const hasNegativeX = points.some((p) => p.qx < 0);
    const hasPositiveY = points.some((p) => p.qy > 0);
    const hasNegativeY = points.some((p) => p.qy < 0);
    expect(hasPositiveX).toBe(true);
    expect(hasNegativeX).toBe(true);
    expect(hasPositiveY).toBe(true);
    expect(hasNegativeY).toBe(true);
  });
});

// ─── GoL Patterns ────────────────────────────────────────────────────────────

describe('GoL patterns', () => {
  it('R-pentomino has 5 cells', () => {
    expect(R_PENTOMINO).toHaveLength(5);
  });

  it('Acorn has 7 cells', () => {
    expect(ACORN).toHaveLength(7);
  });

  it('Diehard has 7 cells', () => {
    expect(DIEHARD).toHaveLength(7);
  });

  it('R-pentomino produces changes after one generation (it is a methuselah)', () => {
    const alive = new Set(
      R_PENTOMINO.map(({ dx, dy }) => `${200 + dx}:${200 + dy}`),
    );
    const { born, died } = computeNextGeneration(alive);
    expect(born.length + died.length).toBeGreaterThan(0);
  });

  it('Acorn produces changes after one generation', () => {
    const alive = new Set(
      ACORN.map(({ dx, dy }) => `${200 + dx}:${200 + dy}`),
    );
    const { born, died } = computeNextGeneration(alive);
    expect(born.length + died.length).toBeGreaterThan(0);
  });

  it('Diehard produces changes after one generation', () => {
    const alive = new Set(
      DIEHARD.map(({ dx, dy }) => `${200 + dx}:${200 + dy}`),
    );
    const { born, died } = computeNextGeneration(alive);
    expect(born.length + died.length).toBeGreaterThan(0);
  });

  it('R-pentomino grows over multiple generations', () => {
    let alive = new Set(
      R_PENTOMINO.map(({ dx, dy }) => `${200 + dx}:${200 + dy}`),
    );

    // Run 10 generations and check the population changes
    for (let gen = 0; gen < 10; gen++) {
      const { born, died } = computeNextGeneration(alive);
      for (const k of died) alive.delete(k);
      for (const k of born) alive.add(k);
    }

    // R-pentomino should have grown significantly after 10 generations
    expect(alive.size).toBeGreaterThan(R_PENTOMINO.length);
  });

  it('patterns have no duplicate cells', () => {
    for (const pattern of [R_PENTOMINO, ACORN, DIEHARD]) {
      const keys = pattern.map(({ dx, dy }) => `${dx}:${dy}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
