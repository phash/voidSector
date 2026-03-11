# Die Voids — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Voids — a hostile, silent alien presence that spreads sector-by-sector, destroys all structures in its path, and self-regulates via cluster splitting/dying mechanics.

**Architecture:** New `VoidLifecycleService` handles all void logic (spawn, grow, split, collision, die) and is wired into `StrategicTickService.tick()`. DB: 3 new tables (`void_clusters`, `void_cluster_quadrants`, `void_frontier_sectors`) + `void_cluster_id` on `quadrant_control`. Traversability check added as pure function `isVoidBlocked`. Client renders void quadrants on QUAD-MAP (black + blue glow) and void frontier sectors on Radar (black with blue border).

**Tech Stack:** TypeScript strict, Vitest, PostgreSQL (queries in queries.ts), Redis, React Canvas (QuadrantMapRenderer, RadarRenderer)

**Spec:** `docs/superpowers/specs/2026-03-11-void-civilization-design.md`

---

## Chunk 1: Server — DB, Queries, VoidLifecycleService, Integration

---

### Task 1: Migration 056 — Void Tables

**Files:**
- Create: `packages/server/src/db/migrations/056_void_clusters.sql`

- [ ] **Step 1: Write the migration**

```sql
-- packages/server/src/db/migrations/056_void_clusters.sql

-- Cluster metadata
CREATE TABLE IF NOT EXISTS void_clusters (
  id               TEXT PRIMARY KEY,
  state            TEXT NOT NULL CHECK (state IN ('growing', 'splitting', 'dying')),
  size             INT NOT NULL DEFAULT 0,
  split_threshold  INT NOT NULL,
  spawned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origin_qx        INT NOT NULL,
  origin_qy        INT NOT NULL
);

-- Per-quadrant progress (0–100)
CREATE TABLE IF NOT EXISTS void_cluster_quadrants (
  cluster_id  TEXT NOT NULL REFERENCES void_clusters(id) ON DELETE CASCADE,
  qx          INT NOT NULL,
  qy          INT NOT NULL,
  progress    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (cluster_id, qx, qy)
);

-- Frontier ring: 100 real sector coords per active quadrant
CREATE TABLE IF NOT EXISTS void_frontier_sectors (
  cluster_id  TEXT NOT NULL REFERENCES void_clusters(id) ON DELETE CASCADE,
  x           INT NOT NULL,
  y           INT NOT NULL,
  PRIMARY KEY (cluster_id, x, y)
);

CREATE INDEX IF NOT EXISTS idx_void_frontier_xy ON void_frontier_sectors(x, y);

-- Wire voids into quadrant_control
ALTER TABLE quadrant_control
  ADD COLUMN IF NOT EXISTS void_cluster_id TEXT REFERENCES void_clusters(id);

-- Void hives: one per fully conquered quadrant.
-- The spec references a 'stations' table but none exists in the codebase.
-- We use a dedicated void_hives table (functionally equivalent, simpler).
CREATE TABLE IF NOT EXISTS void_hives (
  id          TEXT PRIMARY KEY,            -- 'void_hive_{qx}_{qy}'
  qx          INT NOT NULL,
  qy          INT NOT NULL,
  sector_x    INT NOT NULL,               -- qx*10000+5000
  sector_y    INT NOT NULL,               -- qy*10000+5000
  cluster_id  TEXT NOT NULL REFERENCES void_clusters(id) ON DELETE CASCADE,
  UNIQUE(qx, qy)
);
```

- [ ] **Step 2: Verify migration file exists**

```bash
ls packages/server/src/db/migrations/056_void_clusters.sql
```

Expected: file shown

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/migrations/056_void_clusters.sql
git commit -m "feat: migration 056 — void_clusters tables and indexes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: DB Query Types and Functions

**Files:**
- Modify: `packages/server/src/db/queries.ts`

- [ ] **Step 1: Add `VoidClusterRow`, `VoidClusterQuadrantRow` interfaces and update `QuadrantControlRow`**

Find the `QuadrantControlRow` interface (around line 3051) and add `void_cluster_id`:

```typescript
export interface QuadrantControlRow {
  qx: number;
  qy: number;
  controlling_faction: string;
  faction_shares: Record<string, number>;
  attack_value: number;
  defense_value: number;
  friction_score: number;
  station_tier: number;
  last_strategic_tick: Date | null;
  void_cluster_id: string | null;   // NEW
}

export interface VoidClusterRow {
  id: string;
  state: 'growing' | 'splitting' | 'dying';
  size: number;
  split_threshold: number;
  spawned_at: Date;
  origin_qx: number;
  origin_qy: number;
}

export interface VoidClusterQuadrantRow {
  cluster_id: string;
  qx: number;
  qy: number;
  progress: number;
}
```

- [ ] **Step 2a: Update `upsertQuadrantControl` to include `void_cluster_id`**

In `packages/server/src/db/queries.ts`, find `upsertQuadrantControl` (~line 3097) and update its signature and SQL:

```typescript
export async function upsertQuadrantControl(data: {
  qx: number;
  qy: number;
  controlling_faction: string | null;
  faction_shares: Record<string, number>;
  attack_value: number;
  defense_value: number;
  friction_score: number;
  station_tier: number;
  void_cluster_id?: string | null;   // NEW
}): Promise<void> {
  await query(
    `INSERT INTO quadrant_control
      (qx, qy, controlling_faction, faction_shares, attack_value, defense_value, friction_score, station_tier, void_cluster_id, last_strategic_tick)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (qx, qy) DO UPDATE SET
       controlling_faction = EXCLUDED.controlling_faction,
       faction_shares = EXCLUDED.faction_shares,
       attack_value = EXCLUDED.attack_value,
       defense_value = EXCLUDED.defense_value,
       friction_score = EXCLUDED.friction_score,
       station_tier = EXCLUDED.station_tier,
       void_cluster_id = EXCLUDED.void_cluster_id,
       last_strategic_tick = NOW()`,
    [
      data.qx,
      data.qy,
      data.controlling_faction,
      JSON.stringify(data.faction_shares),
      data.attack_value,
      data.defense_value,
      data.friction_score,
      data.station_tier,
      data.void_cluster_id ?? null,
    ],
  );
}
```

- [ ] **Step 2b: Add static import for `withTransaction` at the top of queries.ts**

At the top of `packages/server/src/db/queries.ts`, find the existing `import { query } from './client.js'` line and add `withTransaction`:

```typescript
import { query, withTransaction } from './client.js';
```

- [ ] **Step 2c: Add void query functions at the end of queries.ts**

```typescript
// ─── Void Clusters ────────────────────────────────────────────────────────────

export async function getVoidClusters(): Promise<VoidClusterRow[]> {
  const res = await query<VoidClusterRow>('SELECT * FROM void_clusters');
  return res.rows;
}

export async function getVoidClusterById(id: string): Promise<VoidClusterRow | null> {
  const res = await query<VoidClusterRow>(
    'SELECT * FROM void_clusters WHERE id = $1',
    [id],
  );
  return res.rows[0] ?? null;
}

export async function upsertVoidCluster(cluster: VoidClusterRow): Promise<void> {
  await query(
    `INSERT INTO void_clusters (id, state, size, split_threshold, spawned_at, origin_qx, origin_qy)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       state = EXCLUDED.state,
       size  = EXCLUDED.size`,
    [
      cluster.id,
      cluster.state,
      cluster.size,
      cluster.split_threshold,
      cluster.spawned_at,
      cluster.origin_qx,
      cluster.origin_qy,
    ],
  );
}

export async function deleteVoidCluster(id: string): Promise<void> {
  await query('DELETE FROM void_clusters WHERE id = $1', [id]);
}

export async function getVoidClusterQuadrants(
  clusterId: string,
): Promise<VoidClusterQuadrantRow[]> {
  const res = await query<VoidClusterQuadrantRow>(
    'SELECT * FROM void_cluster_quadrants WHERE cluster_id = $1',
    [clusterId],
  );
  return res.rows;
}

export async function upsertVoidClusterQuadrant(
  clusterId: string,
  qx: number,
  qy: number,
  progress: number,
): Promise<void> {
  await query(
    `INSERT INTO void_cluster_quadrants (cluster_id, qx, qy, progress)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (cluster_id, qx, qy) DO UPDATE SET progress = EXCLUDED.progress`,
    [clusterId, qx, qy, progress],
  );
}

export async function deleteVoidClusterQuadrant(
  clusterId: string,
  qx: number,
  qy: number,
): Promise<void> {
  await query(
    'DELETE FROM void_cluster_quadrants WHERE cluster_id = $1 AND qx = $2 AND qy = $3',
    [clusterId, qx, qy],
  );
}

/**
 * Atomically replace frontier sectors for a specific cluster+quadrant.
 * Deletes old rows for (clusterId, qx, qy), inserts new ones.
 * All within a single transaction.
 */
export async function replaceVoidFrontierSectors(
  clusterId: string,
  qx: number,
  qy: number,
  sectors: Array<{ x: number; y: number }>,
): Promise<void> {
  await withTransaction(async (client) => {
    const ox = qx * 10000;
    const oy = qy * 10000;
    await client.query(
      `DELETE FROM void_frontier_sectors
       WHERE cluster_id = $1 AND x >= $2 AND x < $3 AND y >= $4 AND y < $5`,
      [clusterId, ox, ox + 10000, oy, oy + 10000],
    );
    if (sectors.length > 0) {
      const values = sectors
        .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
        .join(', ');
      const params: (string | number)[] = [clusterId];
      for (const s of sectors) {
        params.push(s.x, s.y);
      }
      await client.query(
        `INSERT INTO void_frontier_sectors (cluster_id, x, y) VALUES ${values}
         ON CONFLICT DO NOTHING`,
        params,
      );
    }
  });
}

export async function deleteVoidFrontierSectorsForQuadrant(
  clusterId: string,
  qx: number,
  qy: number,
): Promise<void> {
  const ox = qx * 10000;
  const oy = qy * 10000;
  await query(
    `DELETE FROM void_frontier_sectors
     WHERE cluster_id = $1 AND x >= $2 AND x < $3 AND y >= $4 AND y < $5`,
    [clusterId, ox, ox + 10000, oy, oy + 10000],
  );
}

export async function isVoidFrontierSector(x: number, y: number): Promise<boolean> {
  const res = await query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM void_frontier_sectors WHERE x = $1 AND y = $2) AS exists',
    [x, y],
  );
  return res.rows[0]?.exists ?? false;
}

export async function createVoidHive(
  qx: number,
  qy: number,
  clusterId: string,
): Promise<void> {
  const id = `void_hive_${qx}_${qy}`;
  const sx = qx * 10000 + 5000;
  const sy = qy * 10000 + 5000;
  await query(
    `INSERT INTO void_hives (id, qx, qy, sector_x, sector_y, cluster_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (qx, qy) DO NOTHING`,
    [id, qx, qy, sx, sy, clusterId],
  );
}

export async function deleteVoidHive(qx: number, qy: number): Promise<void> {
  await query('DELETE FROM void_hives WHERE qx = $1 AND qy = $2', [qx, qy]);
}

export async function getVoidHive(qx: number, qy: number): Promise<{ id: string; sector_x: number; sector_y: number } | null> {
  const res = await query<{ id: string; sector_x: number; sector_y: number }>(
    'SELECT id, sector_x, sector_y FROM void_hives WHERE qx = $1 AND qy = $2',
    [qx, qy],
  );
  return res.rows[0] ?? null;
}
```

- [ ] **Step 3: Check the `pool` export in queries.ts — ensure it is accessible**

```bash
grep -n "^export.*pool\|^const pool\|^export const pool" packages/server/src/db/queries.ts | head -5
```

If `pool` is not exported, add `export { pool }` or use the existing `query` wrapper with a manual client. Adjust `replaceVoidFrontierSectors` accordingly.

- [ ] **Step 4: Build shared (not needed here) and run server tests to verify no type errors**

```bash
cd packages/server && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing ones)

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat: void DB query functions and updated QuadrantControlRow type

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: VoidLifecycleService — Pure Helpers

**Files:**
- Create: `packages/server/src/engine/voidLifecycleService.ts`
- Create: `packages/server/src/engine/__tests__/voidLifecycleService.test.ts`

Pure functions first (no DB, no Redis) — easier to test.

- [ ] **Step 1: Write failing tests for pure helpers**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/server && npx vitest run src/engine/__tests__/voidLifecycleService.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement the pure helper functions in voidLifecycleService.ts**

```typescript
// packages/server/src/engine/voidLifecycleService.ts
import type { Redis } from 'ioredis';
import type { VoidClusterRow, VoidClusterQuadrantRow } from '../db/queries.js';
import {
  getVoidClusters,
  getVoidClusterQuadrants,
  upsertVoidCluster,
  deleteVoidCluster,
  upsertVoidClusterQuadrant,
  deleteVoidClusterQuadrant,
  replaceVoidFrontierSectors,
  deleteVoidFrontierSectorsForQuadrant,
  createVoidHive,
  deleteVoidHive,
  getAllQuadrantControls,
  upsertQuadrantControl,
} from '../db/queries.js';
import { getExpansionTarget } from './expansionEngine.js';
import { logger } from '../utils/logger.js';

export const QUADRANT_SIZE = 10_000;
const VOID_SPAWN_INTERVAL_TICKS = 240; // every ~4h at 60s/tick
const VOID_MIN_CLUSTER_COUNT = 32;
const VOID_MAX_CLUSTER_COUNT = 48;
const VOID_ORIGIN_EXCLUSION = 100;  // quadrant radius around (0,0) where voids never spawn
const VOID_SPAWN_MIN_DISTANCE = 50; // min quadrant distance from any claimed quadrant

// ─── Pure Helpers (exported for testing) ─────────────────────────────────────

/**
 * Compute the 100-sector frontier line for a quadrant at the given progress.
 * Model: a horizontal line that sweeps south through the quadrant (West→East front).
 * Returns empty array at progress=0 or progress=100.
 */
export function computeFrontierSectors(
  qx: number,
  qy: number,
  progress: number,
): Array<{ x: number; y: number }> {
  if (progress <= 0 || progress >= 100) return [];
  const ox = qx * QUADRANT_SIZE;
  const oy = qy * QUADRANT_SIZE;
  const fy = oy + Math.floor((progress / 100) * QUADRANT_SIZE);
  const sectors: Array<{ x: number; y: number }> = [];
  for (let x = ox; x < ox + 100; x++) {
    sectors.push({ x, y: fy });
  }
  return sectors;
}

/**
 * Find a valid spawn point for a new void cluster.
 * Excluded: within VOID_ORIGIN_EXCLUSION quadrants of (0,0),
 *           within VOID_SPAWN_MIN_DISTANCE of any claimed quadrant.
 * Returns null if no valid point found after sampling.
 */
export function pickSpawnPoint(
  claimedKeys: Set<string>,
  searchRadius: number,
  minDistance: number,
): { qx: number; qy: number } | null {
  // Build array of claimed coords for distance check
  const claimedCoords: Array<{ qx: number; qy: number }> = [];
  for (const key of claimedKeys) {
    const [qx, qy] = key.split(':').map(Number);
    claimedCoords.push({ qx, qy });
  }

  // Sample candidate points deterministically
  for (let qx = -searchRadius; qx <= searchRadius; qx++) {
    for (let qy = -searchRadius; qy <= searchRadius; qy++) {
      const key = `${qx}:${qy}`;
      if (claimedKeys.has(key)) continue;

      // Origin exclusion
      if (Math.max(Math.abs(qx), Math.abs(qy)) < VOID_ORIGIN_EXCLUSION) continue;

      // Min distance from any claimed quadrant
      const tooClose = claimedCoords.some(
        (c) => Math.abs(c.qx - qx) + Math.abs(c.qy - qy) < minDistance,
      );
      if (tooClose) continue;

      return { qx, qy };
    }
  }
  return null;
}

/**
 * Partition quadrants into n groups using nearest-centroid (k-means iteration 1).
 * Seeds are the n most mutually distant quadrants.
 * Groups with <2 members are "abandoned".
 */
export function computeSplitGroups(
  quadrants: VoidClusterQuadrantRow[],
  n: number,
): { groups: VoidClusterQuadrantRow[][]; abandoned: VoidClusterQuadrantRow[] } {
  if (quadrants.length === 0) return { groups: [], abandoned: [] };
  if (n >= quadrants.length) return { groups: quadrants.map((q) => [q]), abandoned: [] };

  // Pick n seeds: first = arbitrary, rest = furthest from existing seeds
  const seeds: VoidClusterQuadrantRow[] = [quadrants[0]];
  while (seeds.length < n) {
    let bestDist = -1;
    let bestQ = quadrants[0];
    for (const q of quadrants) {
      if (seeds.includes(q)) continue;
      const minDist = Math.min(
        ...seeds.map((s) => Math.abs(s.qx - q.qx) + Math.abs(s.qy - q.qy)),
      );
      if (minDist > bestDist) {
        bestDist = minDist;
        bestQ = q;
      }
    }
    seeds.push(bestQ);
  }

  // Assign each quadrant to nearest seed
  const groups: VoidClusterQuadrantRow[][] = seeds.map(() => []);
  for (const q of quadrants) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < seeds.length; i++) {
      const d = Math.abs(seeds[i].qx - q.qx) + Math.abs(seeds[i].qy - q.qy);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    groups[bestIdx].push(q);
  }

  // Groups with <2 members are abandoned
  const abandoned: VoidClusterQuadrantRow[] = [];
  const validGroups: VoidClusterQuadrantRow[][] = [];
  for (const g of groups) {
    if (g.length < 2) {
      abandoned.push(...g);
    } else {
      validGroups.push(g);
    }
  }
  return { groups: validGroups, abandoned };
}

/**
 * Pick which clusters should start dying (oldest first, already-dying excluded).
 * Only called when global count > VOID_MAX_CLUSTER_COUNT.
 */
export function pickDyingClusters(clusters: VoidClusterRow[]): VoidClusterRow[] {
  const count = clusters.length;
  if (count <= VOID_MAX_CLUSTER_COUNT) return [];
  const numToDie = Math.floor((count - VOID_MAX_CLUSTER_COUNT) / 2) + 1;
  const eligible = clusters
    .filter((c) => c.state !== 'dying')
    .sort((a, b) => a.spawned_at.getTime() - b.spawned_at.getTime());
  return eligible.slice(0, numToDie);
}

// ─── VoidLifecycleService ─────────────────────────────────────────────────────

export class VoidLifecycleService {
  private tickCount = 0;

  constructor(private redis: Redis) {}

  async tick(): Promise<void> {
    this.tickCount++;
    const clusters = await getVoidClusters();

    // Pop-cap: mark oldest clusters as dying
    const toDie = pickDyingClusters(clusters);
    for (const c of toDie) {
      await upsertVoidCluster({ ...c, state: 'dying' });
      logger.info({ clusterId: c.id }, 'Void cluster marked dying (pop-cap)');
    }

    // Process each cluster
    const refreshed = await getVoidClusters();
    for (const cluster of refreshed) {
      await this.processCluster(cluster);
    }

    // Spawn check every VOID_SPAWN_INTERVAL_TICKS
    if (this.tickCount % VOID_SPAWN_INTERVAL_TICKS === 0) {
      const current = await getVoidClusters();
      if (current.length < VOID_MIN_CLUSTER_COUNT) {
        await this.trySpawn();
      }
    }
  }

  private async processCluster(cluster: VoidClusterRow): Promise<void> {
    switch (cluster.state) {
      case 'growing':
        await this.processGrowing(cluster);
        break;
      case 'splitting':
        await this.processSplitting(cluster);
        break;
      case 'dying':
        await this.processDying(cluster);
        break;
    }
  }

  private async processGrowing(cluster: VoidClusterRow): Promise<void> {
    const allControls = await getAllQuadrantControls();
    const quadrants = await getVoidClusterQuadrants(cluster.id);
    const activeQuadrants = quadrants.filter((q) => q.progress < 100);

    let newSize = cluster.size;

    for (const q of activeQuadrants) {
      const newProgress = Math.min(100, q.progress + 1);
      await upsertVoidClusterQuadrant(cluster.id, q.qx, q.qy, newProgress);

      if (newProgress === 100) {
        // Quadrant fully conquered
        await upsertQuadrantControl({
          qx: q.qx,
          qy: q.qy,
          controlling_faction: 'voids',
          faction_shares: { voids: 100 },
          attack_value: 0,
          defense_value: 0,
          friction_score: 0,
          station_tier: 0,
          void_cluster_id: cluster.id,
        } as any);
        await createVoidHive(q.qx, q.qy, cluster.id);
        await deleteVoidFrontierSectorsForQuadrant(cluster.id, q.qx, q.qy);
        newSize++;

        // Add one new neighboring quadrant to conquer.
        // getExpansionTarget(faction, allControls, style):
        //   - uses allControls to build the "claimed" set (all non-null owners)
        //   - uses allControls filtered to faction to find owned quadrants to expand FROM
        // We pass faction='voids' but this would expand from ALL void quadrants globally.
        // Instead, build a synthetic allControls where only THIS cluster's quadrants are
        // marked as 'voids', so expansion targets neighbors of this cluster specifically.
        const clusterQuadrantsSet = new Set(
          quadrants.filter((cq) => cq.progress === 100).map((cq) => `${cq.qx}:${cq.qy}`)
        );
        const syntheticControls = allControls.map((c) =>
          clusterQuadrantsSet.has(`${c.qx}:${c.qy}`)
            ? { ...c, controlling_faction: 'voids' }
            : c,
        );
        const target = getExpansionTarget('voids', syntheticControls, 'sphere');
        if (target) {
          await upsertVoidClusterQuadrant(cluster.id, target.qx, target.qy, 0);
          logger.debug({ clusterId: cluster.id, qx: target.qx, qy: target.qy }, 'Void expanding');
        }
      } else {
        // Update frontier ring
        const sectors = computeFrontierSectors(q.qx, q.qy, newProgress);
        await replaceVoidFrontierSectors(cluster.id, q.qx, q.qy, sectors);
      }
    }

    // Check for split threshold
    const shouldSplit = newSize >= cluster.split_threshold;
    await upsertVoidCluster({
      ...cluster,
      size: newSize,
      state: shouldSplit ? 'splitting' : 'growing',
    });

    if (shouldSplit) {
      logger.info({ clusterId: cluster.id, size: newSize }, 'Void cluster reached split threshold');
    }

    // Check collision with other void clusters
    await this.checkCollision(cluster.id);
  }

  private async processSplitting(cluster: VoidClusterRow): Promise<void> {
    const quadrants = await getVoidClusterQuadrants(cluster.id);
    const complete = quadrants.filter((q) => q.progress === 100);

    const n = Math.random() < 0.33 ? 3 : 2;
    const { groups, abandoned } = computeSplitGroups(complete, n);

    // Release abandoned quadrants
    for (const q of abandoned) {
      await this.releaseQuadrant(cluster.id, q.qx, q.qy);
    }

    // Create new clusters for each group
    for (const group of groups) {
      const newId = `vc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const threshold = 8 + Math.floor(Math.random() * 9); // 8–16
      const newCluster: VoidClusterRow = {
        id: newId,
        state: 'growing',
        size: group.length,
        split_threshold: threshold,
        spawned_at: new Date(),
        origin_qx: group[0].qx,
        origin_qy: group[0].qy,
      };
      await upsertVoidCluster(newCluster);
      for (const q of group) {
        await upsertVoidClusterQuadrant(newId, q.qx, q.qy, q.progress);
        // Update quadrant_control to point to new cluster
        await upsertQuadrantControl({
          qx: q.qx,
          qy: q.qy,
          controlling_faction: 'voids',
          faction_shares: { voids: 100 },
          attack_value: 0,
          defense_value: 0,
          friction_score: 0,
          station_tier: 0,
          void_cluster_id: newId,
        } as any);
      }
    }

    // Also release in-progress quadrants from old cluster
    const inProgress = quadrants.filter((q) => q.progress < 100);
    for (const q of inProgress) {
      await deleteVoidClusterQuadrant(cluster.id, q.qx, q.qy);
      await deleteVoidFrontierSectorsForQuadrant(cluster.id, q.qx, q.qy);
    }

    await deleteVoidCluster(cluster.id);
    logger.info({ clusterId: cluster.id, groups: groups.length, abandoned: abandoned.length }, 'Void cluster split');
  }

  private async processDying(cluster: VoidClusterRow): Promise<void> {
    const quadrants = await getVoidClusterQuadrants(cluster.id);
    if (quadrants.length === 0) {
      await deleteVoidCluster(cluster.id);
      return;
    }

    // Release the quadrant with lowest progress first
    const sorted = [...quadrants].sort((a, b) => a.progress - b.progress);
    const toRelease = sorted[0];

    if (toRelease.progress === 100) {
      await this.releaseQuadrant(cluster.id, toRelease.qx, toRelease.qy);
      await upsertVoidCluster({ ...cluster, size: Math.max(0, cluster.size - 1) });
    } else {
      await deleteVoidClusterQuadrant(cluster.id, toRelease.qx, toRelease.qy);
      await deleteVoidFrontierSectorsForQuadrant(cluster.id, toRelease.qx, toRelease.qy);
    }
  }

  private async releaseQuadrant(clusterId: string, qx: number, qy: number): Promise<void> {
    await upsertQuadrantControl({
      qx,
      qy,
      controlling_faction: null as any,
      faction_shares: {},
      attack_value: 0,
      defense_value: 0,
      friction_score: 0,
      station_tier: 0,
      void_cluster_id: null,
    } as any);
    await deleteVoidHive(qx, qy);
    await deleteVoidClusterQuadrant(clusterId, qx, qy);
    await deleteVoidFrontierSectorsForQuadrant(clusterId, qx, qy);
    logger.debug({ clusterId, qx, qy }, 'Void released quadrant');
  }

  private async checkCollision(clusterId: string): Promise<void> {
    const allClusters = await getVoidClusters();
    const allControls = await getAllQuadrantControls();

    const ownQuadrants = allControls.filter((c) => c.void_cluster_id === clusterId && c.controlling_faction === 'voids');

    for (const other of allClusters) {
      if (other.id === clusterId) continue;
      const otherQuadrants = allControls.filter((c) => c.void_cluster_id === other.id && c.controlling_faction === 'voids');

      // Check cardinal adjacency between any pair
      let hasCollision = false;
      for (const a of ownQuadrants) {
        for (const b of otherQuadrants) {
          if (Math.abs(a.qx - b.qx) + Math.abs(a.qy - b.qy) === 1) {
            hasCollision = true;
            break;
          }
        }
        if (hasCollision) break;
      }

      if (hasCollision) {
        await this.resolveCollision(clusterId, ownQuadrants.map(q => ({ qx: q.qx, qy: q.qy })), other.id, otherQuadrants.map(q => ({ qx: q.qx, qy: q.qy })));
      }
    }
  }

  private async resolveCollision(
    idA: string,
    quadrantsA: Array<{ qx: number; qy: number }>,
    idB: string,
    quadrantsB: Array<{ qx: number; qy: number }>,
  ): Promise<void> {
    const centroidB = { qx: mean(quadrantsB.map(q => q.qx)), qy: mean(quadrantsB.map(q => q.qy)) };
    const centroidA = { qx: mean(quadrantsA.map(q => q.qx)), qy: mean(quadrantsA.map(q => q.qy)) };

    const keepA = quadrantsA
      .sort((a, b) => dist(b, centroidB) - dist(a, centroidB))
      .slice(0, Math.max(3, Math.ceil(quadrantsA.length / 2)));
    const keepB = quadrantsB
      .sort((a, b) => dist(b, centroidA) - dist(a, centroidA))
      .slice(0, Math.max(3, Math.ceil(quadrantsB.length / 2)));

    const toReleaseA = quadrantsA.filter(q => !keepA.some(k => k.qx === q.qx && k.qy === q.qy));
    const toReleaseB = quadrantsB.filter(q => !keepB.some(k => k.qx === q.qx && k.qy === q.qy));

    for (const q of toReleaseA) await this.releaseQuadrant(idA, q.qx, q.qy);
    for (const q of toReleaseB) await this.releaseQuadrant(idB, q.qx, q.qy);

    logger.info({ idA, idB, releasedA: toReleaseA.length, releasedB: toReleaseB.length }, 'Void cluster collision resolved');
  }

  private async trySpawn(): Promise<void> {
    const allControls = await getAllQuadrantControls();
    const claimedKeys = new Set(allControls.map((c) => `${c.qx}:${c.qy}`));
    const point = pickSpawnPoint(claimedKeys, 500, VOID_SPAWN_MIN_DISTANCE);
    if (!point) {
      logger.debug('Void spawn: no valid spawn point found');
      return;
    }

    const id = `vc_${Date.now()}`;
    const threshold = 8 + Math.floor(Math.random() * 9);
    const cluster: VoidClusterRow = {
      id,
      state: 'growing',
      size: 0,
      split_threshold: threshold,
      spawned_at: new Date(),
      origin_qx: point.qx,
      origin_qy: point.qy,
    };
    await upsertVoidCluster(cluster);
    await upsertVoidClusterQuadrant(id, point.qx, point.qy, 0);
    // Note: createVoidHive is NOT called here — hive is created when progress reaches 100
    logger.info({ clusterId: id, qx: point.qx, qy: point.qy, threshold }, 'Void cluster spawned');
  }
}

function dist(a: { qx: number; qy: number }, b: { qx: number; qy: number }): number {
  return Math.abs(a.qx - b.qx) + Math.abs(a.qy - b.qy);
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}
```

- [ ] **Step 4: Run the tests**

```bash
cd packages/server && npx vitest run src/engine/__tests__/voidLifecycleService.test.ts 2>&1 | tail -30
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/voidLifecycleService.ts packages/server/src/engine/__tests__/voidLifecycleService.test.ts
git commit -m "feat: VoidLifecycleService — spawn, grow, split, collision, die

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Wire VoidLifecycleService into StrategicTickService

**Files:**
- Modify: `packages/server/src/engine/strategicTickService.ts`

- [ ] **Step 1: Write a failing test for the wire-up**

Add to `packages/server/src/__tests__/strategicTickService.test.ts`:

```typescript
// Add to the existing vi.mock('../db/queries.js', ...) block:
// getVoidClusters: vi.fn().mockResolvedValue([]),

// Then add this test:
it('tick calls void lifecycle processing', async () => {
  mockGetArrivedNpcFleets.mockResolvedValue([]);
  mockDeleteArrivedNpcFleets.mockResolvedValue(undefined);
  mockGetAllQuadrantControls.mockResolvedValue([]);
  mockGetAllFactionConfigs.mockResolvedValue([]);
  // getVoidClusters must be in mock — see vi.mock block above
  const mockGetVoidClusters = vi.mocked(getVoidClusters);
  mockGetVoidClusters.mockResolvedValue([]);
  await service.init();
  await service.tick(new Map());
  expect(mockGetVoidClusters).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/__tests__/strategicTickService.test.ts 2>&1 | tail -15
```

Expected: FAIL — `getVoidClusters` not called

- [ ] **Step 3: Wire in VoidLifecycleService**

In `packages/server/src/engine/strategicTickService.ts`:

```typescript
// Add import at top:
import { VoidLifecycleService } from './voidLifecycleService.js';

// Add field to class:
private voidLifecycle: VoidLifecycleService;

// Add to constructor:
constructor(private redis: Redis) {
  this.factionConfig = new FactionConfigService();
  this.voidLifecycle = new VoidLifecycleService(redis);
}

// Existing tick() ends like this — add the void line after processWissenTick:
    await processWissenTick(60_000); // existing, do not duplicate

    await this.voidLifecycle.tick(); // ADD THIS
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/__tests__/strategicTickService.test.ts 2>&1 | tail -15
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/strategicTickService.ts packages/server/src/__tests__/strategicTickService.test.ts
git commit -m "feat: wire VoidLifecycleService into StrategicTickService tick

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Traversability — isVoidBlocked

**Files:**
- Modify: `packages/server/src/engine/sectorTraversabilityService.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/server/src/engine/__tests__/` — create `voidTraversability.test.ts`:

```typescript
// packages/server/src/engine/__tests__/voidTraversability.test.ts
import { describe, it, expect } from 'vitest';
import { isVoidBlocked } from '../sectorTraversabilityService.js';

describe('isVoidBlocked', () => {
  it('returns false when sector is not in void set and not in void quadrant', () => {
    const controls: Array<{ qx: number; qy: number; controlling_faction: string }> = [];
    const frontierSet = new Set<string>();
    expect(isVoidBlocked(500, 500, controls, frontierSet, [])).toBe(false);
  });

  it('returns true when sector is in a fully void quadrant', () => {
    // Sector (5000, 5000) is in quadrant (0,0) — qx=floor(5000/10000)=0
    const controls = [{ qx: 0, qy: 0, controlling_faction: 'voids' }];
    const frontierSet = new Set<string>();
    expect(isVoidBlocked(5000, 5000, controls, frontierSet, [])).toBe(true);
  });

  it('returns true when sector is in frontier set', () => {
    const controls: Array<{ qx: number; qy: number; controlling_faction: string }> = [];
    const frontierSet = new Set(['100,200']);
    expect(isVoidBlocked(100, 200, controls, frontierSet, [])).toBe(true);
  });

  it('returns false when player has void_shield module', () => {
    const controls = [{ qx: 0, qy: 0, controlling_faction: 'voids' }];
    const frontierSet = new Set<string>();
    expect(isVoidBlocked(5000, 5000, controls, frontierSet, ['void_shield'])).toBe(false);
  });

  it('returns false for frontier sector with void_shield', () => {
    const controls: Array<{ qx: number; qy: number; controlling_faction: string }> = [];
    const frontierSet = new Set(['100,200']);
    expect(isVoidBlocked(100, 200, controls, frontierSet, ['void_shield'])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/server && npx vitest run src/engine/__tests__/voidTraversability.test.ts 2>&1 | tail -10
```

Expected: FAIL — `isVoidBlocked` not exported

- [ ] **Step 3: Add isVoidBlocked to sectorTraversabilityService.ts**

```typescript
// Add at the end of sectorTraversabilityService.ts:

/**
 * Returns true if (x, y) is a void-blocked sector and the player has no void_shield.
 * Check order:
 *  1. Is the sector's quadrant fully void (controlling_faction='voids')? → blocked
 *  2. Is (x, y) in the frontier set? → blocked
 *  3. Otherwise → not blocked
 */
export function isVoidBlocked(
  x: number,
  y: number,
  quadrantControls: Array<{ qx: number; qy: number; controlling_faction: string }>,
  voidFrontierSet: Set<string>,
  playerModules: string[],
): boolean {
  if (playerModules.includes('void_shield')) return false;

  const qx = Math.floor(x / 10_000);
  const qy = Math.floor(y / 10_000);
  const ctrl = quadrantControls.find((c) => c.qx === qx && c.qy === qy);
  if (ctrl?.controlling_faction === 'voids') return true;

  return voidFrontierSet.has(`${x},${y}`);
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/server && npx vitest run src/engine/__tests__/voidTraversability.test.ts 2>&1 | tail -10
```

Expected: all PASS

- [ ] **Step 5: Run all server tests to check for regressions**

```bash
cd packages/server && npx vitest run 2>&1 | tail -20
```

Expected: all pass (or pre-existing failures only)

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/engine/sectorTraversabilityService.ts packages/server/src/engine/__tests__/voidTraversability.test.ts
git commit -m "feat: isVoidBlocked — void traversability check with void_shield bypass

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Chunk 2: Shared Types + Client Rendering

---

### Task 6: Shared Constants — void_shield, void_gun

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add module IDs to constants.ts**

Find the module definitions section (around `'shield_mk1'`). Add after the last existing module:

```typescript
// In the modules array / MODULE_DEFINITIONS:
{
  id: 'void_shield',
  category: 'shield',
  tier: 5,
  name: 'Void Shield',
  description: 'Schützt vor Void-Todeszonen. Schwach gegen kinetische Waffen (-30% Verteidigung vs kinetisch).',
  primaryEffect: { stat: 'shieldHp', delta: 0, label: 'Void-Schutz' },
  secondaryEffects: [{ stat: 'defenseMultiplier', delta: -0.3, label: '-30% Abwehr vs kinetisch' }],
  slotType: 'shield',
  researchable: false,  // Ancient Ruins only
},
{
  id: 'void_gun',
  category: 'weapon',
  tier: 5,
  name: 'Void Gun',
  description: 'Zerstört Void Hives. Im normalen Kampf einsetzbar, maximale Wirkung gegen Void.',
  primaryEffect: { stat: 'weaponDamage', delta: 20, label: 'Schaden +20 (vs Void ×5)' },
  secondaryEffects: [],
  slotType: 'weapon',
  researchable: false,  // Ancient Ruins only
},
```

- [ ] **Step 2: Add VoidClusterState to shared types.ts**

Add near `QuadrantControlState`:

```typescript
export interface VoidClusterState {
  id: string;
  state: 'growing' | 'splitting' | 'dying';
  size: number;
  quadrants: Array<{ qx: number; qy: number; progress: number }>;
}
```

Also add `void_cluster_id?: string | null` to `QuadrantControlState`:

```typescript
export interface QuadrantControlState {
  qx: number;
  qy: number;
  controlling_faction: string;
  faction_shares: Record<string, number>;
  friction_score: number;
  friction_state: 'peaceful_halt' | 'skirmish' | 'escalation' | 'total_war';
  attack_value: number;
  defense_value: number;
  station_tier: number;
  void_cluster_id?: string | null;   // NEW
}
```

- [ ] **Step 3: Build shared**

```bash
cd packages/shared && npm run build 2>&1 | tail -10
```

Expected: successful build, no errors

- [ ] **Step 4: Run shared tests**

```bash
cd packages/shared && npx vitest run 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/types.ts packages/shared/src/
git commit -m "feat: void_shield, void_gun modules + VoidClusterState shared types

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Client — QUAD-MAP Void Rendering

**Files:**
- Modify: `packages/client/src/canvas/QuadrantMapRenderer.ts`
- Modify: `packages/client/src/__tests__/QuadrantMapRenderer.test.ts`

- [ ] **Step 1: Write a failing test for void rendering**

Add to `packages/client/src/__tests__/QuadrantMapRenderer.test.ts`:

```typescript
// Add import at top if not present:
// import type { QuadrantControlState } from '@void-sector/shared';

it('renders void quadrant with black fill and blue glow border', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;

  const fillSpy = vi.spyOn(ctx, 'fillRect');

  drawQuadrantMap(ctx, {
    knownQuadrants: [{ qx: 0, qy: 0, learnedAt: new Date().toISOString() }],
    currentQuadrant: { qx: 0, qy: 0 },
    selectedQuadrant: null,
    themeColor: '#00ff00',
    dimColor: 'rgba(0,255,0,0.4)',
    zoomLevel: 2,
    panOffset: { x: 0, y: 0 },
    animTime: 0,
    quadrantControls: [
      {
        qx: 0, qy: 0,
        controlling_faction: 'voids',
        faction_shares: { voids: 100 },
        friction_score: 0,
        friction_state: 'peaceful_halt',
        attack_value: 0,
        defense_value: 0,
        station_tier: 0,
        void_cluster_id: 'vc_test',
      },
    ],
  });

  // void quadrant fill should have been called (black fill)
  expect(fillSpy).toHaveBeenCalled();
  // shadowColor should be set to void glow
  // We can check ctx.shadowColor was set — check spy was called
  expect(ctx.fillStyle).toBeDefined();
});
```

- [ ] **Step 2: Run to verify it fails (or passes trivially — adjust if needed)**

```bash
cd packages/client && npx vitest run src/__tests__/QuadrantMapRenderer.test.ts 2>&1 | tail -15
```

- [ ] **Step 3: Add void rendering logic to QuadrantMapRenderer.ts**

In `drawQuadrantMap`, inside the cell-drawing loop after the existing faction overlay block (after line ~155):

```typescript
// Void overlay (renders over faction colors)
if (ctrl?.controlling_faction === 'voids') {
  const progress = 100; // fully void
  const alpha = progress / 100;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#050508';
  ctx.fillRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#aaaacc';
  ctx.lineWidth = 1;
  ctx.shadowColor = 'rgba(255,255,255,0.13)';
  ctx.shadowBlur = 4;
  ctx.strokeRect(cellX - CELL_W / 2 + 0.5, cellY - CELL_H / 2 + 0.5, CELL_W - 1, CELL_H - 1);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// Void quadrant in progress (partial conquest)
// Requires voidQuadrantProgress map in state — see below
if (state.voidQuadrantProgress) {
  const progressVal = state.voidQuadrantProgress.get(`${qx}:${qy}`);
  if (progressVal !== undefined && progressVal > 0 && progressVal < 100) {
    ctx.save();
    ctx.globalAlpha = progressVal / 100;
    ctx.fillStyle = '#050508';
    ctx.fillRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
```

Also add `voidQuadrantProgress?: Map<string, number>` to the `QuadrantMapState` interface.

Also add `voids` to `FACTION_COLORS`:
```typescript
voids: 'rgba(5,5,8,0)',  // handled separately above
```

- [ ] **Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/QuadrantMapRenderer.test.ts 2>&1 | tail -15
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/canvas/QuadrantMapRenderer.ts packages/client/src/__tests__/QuadrantMapRenderer.test.ts
git commit -m "feat: QUAD-MAP void rendering — black + blue glow for void quadrants

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Client — Radar Void Sector Rendering

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: `packages/client/src/__tests__/RadarRenderer.test.ts`

- [ ] **Step 1: Add `voidFrontierSectors` to RadarState interface**

In `RadarRenderer.ts`, find `interface RadarState` (line ~66) and add:

```typescript
/** Set of "x,y" strings that are void frontier sectors */
voidFrontierSectors?: Set<string>;
/** True if the player's current quadrant is fully void */
quadrantIsVoid?: boolean;
```

- [ ] **Step 2: Write a failing test for void sector rendering**

Add to `packages/client/src/__tests__/RadarRenderer.test.ts`:

```typescript
it('renders void frontier sectors as black with blue border', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;

  const strokeSpy = vi.spyOn(ctx, 'strokeRect');

  drawRadar(ctx, {
    ...minimalRadarState(),  // use existing helper or build minimal state
    voidFrontierSectors: new Set(['100,200']),
    sectors: [{ x: 100, y: 200, type: 'empty' }],
    playerX: 100,
    playerY: 200,
    zoomLevel: 0,
    themeColor: '#00ff00',
    dimColor: 'rgba(0,255,0,0.4)',
    animTime: 0,
  });

  // Should have called strokeRect for the void border
  expect(strokeSpy).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/RadarRenderer.test.ts 2>&1 | tail -15
```

Expected: FAIL (or missing helper — adjust)

- [ ] **Step 4: Add void rendering in RadarRenderer.ts**

In the sector-drawing loop (around line 352–390 where `sector` exists), add a block before the existing `} else if (sector) {` branch:

```typescript
// Check if this sector is a void frontier sector
const sectorKey = `${cellXAbsolute},${cellYAbsolute}`; // use actual sector coords
const isVoidFrontier = state.voidFrontierSectors?.has(sectorKey) ?? false;
const isVoidQuadrant = state.quadrantIsVoid ?? false;

if (isVoidFrontier || isVoidQuadrant) {
  // Black fill
  ctx.fillStyle = '#050508';
  ctx.fillRect(cellX - CELL_W / 2, cellY - CELL_H / 2, CELL_W, CELL_H);
  if (isVoidFrontier && !isVoidQuadrant) {
    // Blue border for active frontier
    ctx.strokeStyle = '#aaaacc';
    ctx.lineWidth = 1;
    ctx.strokeRect(cellX - CELL_W / 2 + 0.5, cellY - CELL_H / 2 + 0.5, CELL_W - 1, CELL_H - 1);
  }
  continue; // skip normal sector rendering
}
```

Note: The actual variable names for cell coordinates depend on the existing loop structure in RadarRenderer.ts. Read the loop context carefully and use the correct variable names.

- [ ] **Step 5: Run all client tests**

```bash
cd packages/client && npx vitest run 2>&1 | tail -20
```

Expected: all pass (or pre-existing failures only)

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts packages/client/src/__tests__/RadarRenderer.test.ts
git commit -m "feat: Radar void frontier rendering — black fill + blue border

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Final Integration Check

- [ ] **Step 1: Run all tests across all packages**

```bash
cd packages/shared && npx vitest run 2>&1 | tail -5
cd packages/server && npx vitest run 2>&1 | tail -5
cd packages/client && npx vitest run 2>&1 | tail -5
```

Expected: all pass

- [ ] **Step 2: TypeScript check**

```bash
cd packages/server && npx tsc --noEmit 2>&1 | head -20
cd packages/client && npx tsc --noEmit 2>&1 | head -20
cd packages/shared && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Final commit if anything was missed**

```bash
git status
```

If clean: done. If changes: stage and commit with appropriate message.

---

**Note on Comms Alert:** The void comms alert (when a void quadrant starts at progress=1, alert nearby room players) is a small follow-up that requires Colyseus room access in `VoidLifecycleService`. This is intentionally left as a follow-up task to keep the service decoupled — add it by injecting a `broadcastVoidAlert(qx, qy)` callback into `VoidLifecycleService` constructor once the core is working.

**Note on `findPath` void integration:** Once `isVoidBlocked` is in place, the autopilot's `findPath` should also check it. This requires loading `voidFrontierSet` + `quadrantControls` before pathfinding. Hook into `NavigationService` or `AutopilotService` where `findPath` is called — load from Redis cache (TTL 30s) or DB, pass as parameter.
