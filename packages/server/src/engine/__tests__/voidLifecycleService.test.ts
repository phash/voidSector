// packages/server/src/engine/__tests__/voidLifecycleService.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeFrontierSectors,
  pickSpawnPoint,
  computeSplitGroups,
  pickDyingClusters,
} from '../voidLifecycleService.js';
import type { VoidClusterRow, VoidClusterQuadrantRow } from '../../db/queries.js';

function makeCluster(id: string, overrides: Partial<VoidClusterRow> = {}): VoidClusterRow {
  return {
    id,
    state: 'growing',
    size: 0,
    split_threshold: 12,
    spawned_at: new Date('2026-01-01'),
    origin_qx: 200,
    origin_qy: 200,
    ...overrides,
  };
}

function makeQRow(clusterId: string, qx: number, qy: number, progress = 100): VoidClusterQuadrantRow {
  return { cluster_id: clusterId, qx, qy, progress };
}

// ─── computeFrontierSectors ───────────────────────────────────────────────────
describe('computeFrontierSectors', () => {
  it('returns empty array for progress 0', () => {
    expect(computeFrontierSectors(5, 5, 0)).toHaveLength(0);
  });

  it('returns 100 sectors for any progress 1–99', () => {
    expect(computeFrontierSectors(5, 5, 1)).toHaveLength(100);
    expect(computeFrontierSectors(5, 5, 50)).toHaveLength(100);
    expect(computeFrontierSectors(5, 5, 99)).toHaveLength(100);
  });

  it('returns empty array for progress 100 (fully void, no frontier needed)', () => {
    expect(computeFrontierSectors(5, 5, 100)).toHaveLength(0);
  });

  it('frontier y advances with progress', () => {
    const at1 = computeFrontierSectors(5, 5, 1);
    const at50 = computeFrontierSectors(5, 5, 50);
    const fy1 = at1[0].y;
    const fy50 = at50[0].y;
    expect(fy50).toBeGreaterThan(fy1);
  });

  it('all x values are within quadrant bounds', () => {
    const sectors = computeFrontierSectors(5, 5, 50);
    const ox = 5 * 10000;
    for (const s of sectors) {
      expect(s.x).toBeGreaterThanOrEqual(ox);
      expect(s.x).toBeLessThan(ox + 100);
    }
  });
});

// ─── pickSpawnPoint ───────────────────────────────────────────────────────────
describe('pickSpawnPoint', () => {
  it('returns null when there are no unclaimed quadrants far enough away', () => {
    // All nearby quadrants are claimed
    const claimed = new Set(['110:110', '110:111', '111:110', '111:111']);
    const result = pickSpawnPoint(claimed, 100, 50);
    expect(result).toBeNull();
  });

  it('returns a point outside the origin exclusion zone', () => {
    const claimed = new Set<string>();
    const result = pickSpawnPoint(claimed, 50, 50);
    if (result) {
      const distFromOrigin = Math.max(Math.abs(result.qx), Math.abs(result.qy));
      expect(distFromOrigin).toBeGreaterThanOrEqual(100);
    }
  });
});

// ─── computeSplitGroups ───────────────────────────────────────────────────────
describe('computeSplitGroups', () => {
  it('splits 10 quadrants into 2 groups', () => {
    const quadrants = [
      makeQRow('c1', 200, 200), makeQRow('c1', 201, 200), makeQRow('c1', 202, 200),
      makeQRow('c1', 200, 201), makeQRow('c1', 201, 201),
      makeQRow('c1', 205, 205), makeQRow('c1', 206, 205), makeQRow('c1', 207, 205),
      makeQRow('c1', 205, 206), makeQRow('c1', 206, 206),
    ];
    const groups = computeSplitGroups(quadrants, 2);
    expect(groups.groups).toHaveLength(2);
    expect(groups.abandoned.length).toBeGreaterThanOrEqual(0);
    // Every quadrant is either in a group or abandoned
    const allAssigned = [
      ...groups.groups.flatMap((g) => g),
      ...groups.abandoned,
    ];
    expect(allAssigned).toHaveLength(quadrants.length);
  });

  it('marks isolated quadrants (groups with <2 members) as abandoned', () => {
    // 1 quadrant alone, far away — will be isolated
    const quadrants = [
      makeQRow('c1', 200, 200), makeQRow('c1', 201, 200),
      makeQRow('c1', 210, 210), // isolated
    ];
    const groups = computeSplitGroups(quadrants, 2);
    // The isolated one should be abandoned
    const abandonedCoords = groups.abandoned.map((q) => `${q.qx}:${q.qy}`);
    expect(abandonedCoords).toContain('210:210');
  });
});

// ─── pickDyingClusters ────────────────────────────────────────────────────────
describe('pickDyingClusters', () => {
  it('returns empty when count <= 48', () => {
    const clusters = Array.from({ length: 48 }, (_, i) =>
      makeCluster(`c${i}`, { spawned_at: new Date(2026, 0, i + 1) }),
    );
    expect(pickDyingClusters(clusters)).toHaveLength(0);
  });

  it('marks oldest clusters when count > 48', () => {
    const clusters = Array.from({ length: 50 }, (_, i) =>
      makeCluster(`c${i}`, { spawned_at: new Date(2026, 0, i + 1) }),
    );
    const dying = pickDyingClusters(clusters);
    // count=50, floor((50-48)/2)+1 = 2
    expect(dying).toHaveLength(2);
    // oldest = c0, c1
    expect(dying.map((c) => c.id)).toContain('c0');
    expect(dying.map((c) => c.id)).toContain('c1');
  });

  it('does not pick already-dying clusters', () => {
    const clusters = Array.from({ length: 50 }, (_, i) =>
      makeCluster(`c${i}`, {
        spawned_at: new Date(2026, 0, i + 1),
        state: i < 5 ? 'dying' : 'growing',
      }),
    );
    const dying = pickDyingClusters(clusters);
    // Should only pick from non-dying
    for (const c of dying) {
      expect(c.state).not.toBe('dying');
    }
  });
});
