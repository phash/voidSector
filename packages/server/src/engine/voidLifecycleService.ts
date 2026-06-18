// packages/server/src/engine/voidLifecycleService.ts
// Game of Life implementation for Void civilization expansion.
// Each quadrant is a cell: alive (void) or dead (not void).
// Every strategic tick (60s), GoL rules are applied.
import type { Redis } from 'ioredis';
import type { VoidClusterRow } from '../db/queries.js';
import {
  getVoidClusters,
  upsertVoidCluster,
  getAllQuadrantControls,
  upsertQuadrantControl,
  deleteQuadrantControl,
  createVoidHive,
  deleteVoidHive,
  cleanupLegacyVoidData,
} from '../db/queries.js';
import { logger } from '../utils/logger.js';

export const QUADRANT_SIZE = 10_000;

// ─── Constants ───────────────────────────────────────────────────────────────

/** Single master cluster ID for the GoL void grid (FK reference for hives) */
export const VOID_GOL_CLUSTER_ID = 'void_gol';

/** Don't birth void cells within ±N quadrants of (0,0) */
export const VOID_ORIGIN_EXCLUSION = 100;

/** Number of initial GoL patterns to spawn */
const VOID_SPAWN_COUNT = 15;

/** Minimum Manhattan distance between spawn points */
const VOID_SPAWN_MIN_DISTANCE = 80;

/** After N consecutive stable ticks (no changes), inject a new pattern */
const VOID_STABLE_RESEED_TICKS = 20;

// ─── GoL Seed Patterns ──────────────────────────────────────────────────────

/** R-pentomino: classic methuselah, 5 cells → chaotic growth for ~1103 generations */
export const R_PENTOMINO: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 1, dy: 0 }, { dx: 2, dy: 0 },
  { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
  { dx: 1, dy: 2 },
];

/** Acorn: runs for 5206 generations, 7 cells */
export const ACORN: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 1, dy: 0 },
  { dx: 3, dy: 1 },
  { dx: 0, dy: 2 }, { dx: 1, dy: 2 }, { dx: 4, dy: 2 }, { dx: 5, dy: 2 }, { dx: 6, dy: 2 },
];

/** Diehard: dies completely after 130 generations, 7 cells */
export const DIEHARD: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 6, dy: 0 },
  { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
  { dx: 1, dy: 2 }, { dx: 5, dy: 2 }, { dx: 6, dy: 2 }, { dx: 7, dy: 2 },
];

export const GOL_PATTERNS = [R_PENTOMINO, ACORN, DIEHARD];

// ─── Pure Helpers (exported for testing) ─────────────────────────────────────

/**
 * Core Game of Life: compute which cells are born and which die.
 * Uses Moore neighborhood (8 neighbors).
 * Rules: alive + 2-3 neighbors → survive; dead + exactly 3 neighbors → born.
 * Cells cannot be born within the origin exclusion zone.
 */
export function computeNextGeneration(
  alive: Set<string>,
  originExclusion = 0,
): { born: string[]; died: string[] } {
  const neighborCounts = new Map<string, number>();

  for (const key of alive) {
    const [qx, qy] = key.split(':').map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nKey = `${qx + dx}:${qy + dy}`;
        neighborCounts.set(nKey, (neighborCounts.get(nKey) ?? 0) + 1);
      }
    }
  }

  const died: string[] = [];
  for (const key of alive) {
    const count = neighborCounts.get(key) ?? 0;
    if (count < 2 || count > 3) {
      died.push(key);
    }
  }

  const born: string[] = [];
  for (const [key, count] of neighborCounts) {
    if (alive.has(key)) continue;
    if (count === 3) {
      if (originExclusion > 0) {
        const [qx, qy] = key.split(':').map(Number);
        if (Math.max(Math.abs(qx), Math.abs(qy)) <= originExclusion) continue;
      }
      born.push(key);
    }
  }

  return { born, died };
}

/**
 * Pick spawn points for initial GoL patterns.
 * Distributes points across 8 directions at increasing distances from origin.
 */
export function pickGoLSpawnPoints(
  count: number,
  originExclusion: number,
  minDistance: number,
): Array<{ qx: number; qy: number }> {
  const points: Array<{ qx: number; qy: number }> = [];

  for (let ring = originExclusion + 20; points.length < count; ring += minDistance) {
    const dirs: Array<{ qx: number; qy: number }> = [
      { qx: ring, qy: ring },
      { qx: -ring, qy: ring },
      { qx: ring, qy: -ring },
      { qx: -ring, qy: -ring },
      { qx: ring, qy: 0 },
      { qx: -ring, qy: 0 },
      { qx: 0, qy: ring },
      { qx: 0, qy: -ring },
    ];

    for (const pt of dirs) {
      if (points.length >= count) break;
      const tooClose = points.some(
        (p) => Math.abs(p.qx - pt.qx) + Math.abs(p.qy - pt.qy) < minDistance,
      );
      if (!tooClose) points.push(pt);
    }
  }

  return points;
}

// ─── VoidLifecycleService ─────────────────────────────────────────────────────

export class VoidLifecycleService {
  private initialized = false;
  private stableTicks = 0;

  constructor(private redis: Redis) {}

  async tick(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
      this.initialized = true;
    }

    const allControls = await getAllQuadrantControls();
    const alive = new Set(
      allControls
        .filter((c) => c.controlling_faction === 'voids')
        .map((c) => `${c.qx}:${c.qy}`),
    );

    // No voids → seed initial GoL patterns
    if (alive.size === 0) {
      await this.seed(allControls.map((c) => `${c.qx}:${c.qy}`));
      this.stableTicks = 0;
      return;
    }

    // Compute next generation
    const { born: rawBorn, died } = computeNextGeneration(alive, VOID_ORIGIN_EXCLUSION);

    // Filter births: don't overwrite quadrants already controlled by other factions
    const claimedByOthers = new Set(
      allControls
        .filter((c) => c.controlling_faction && c.controlling_faction !== 'voids')
        .map((c) => `${c.qx}:${c.qy}`),
    );
    const born = rawBorn.filter((key) => !claimedByOthers.has(key));

    if (born.length === 0 && died.length === 0) {
      this.stableTicks++;
      if (this.stableTicks >= VOID_STABLE_RESEED_TICKS) {
        // Inject a new pattern to keep things evolving
        await this.injectPattern(alive, allControls.map((c) => `${c.qx}:${c.qy}`));
        this.stableTicks = 0;
      }
      return;
    }

    this.stableTicks = 0;

    // Apply deaths
    for (const key of died) {
      const [qx, qy] = key.split(':').map(Number);
      await this.releaseQuadrant(qx, qy);
    }

    // Apply births
    for (const key of born) {
      const [qx, qy] = key.split(':').map(Number);
      await this.claimQuadrant(qx, qy);
    }

    logger.info(
      { born: born.length, died: died.length, total: alive.size - died.length + born.length },
      'Void GoL tick',
    );
  }

  private async initialize(): Promise<void> {
    const clusters = await getVoidClusters();
    const hasMaster = clusters.some((c) => c.id === VOID_GOL_CLUSTER_ID);

    if (!hasMaster) {
      // Create master GoL cluster
      await upsertVoidCluster({
        id: VOID_GOL_CLUSTER_ID,
        state: 'growing',
        size: 0,
        split_threshold: 999999,
        spawned_at: new Date(),
        origin_qx: 0,
        origin_qy: 0,
      });

      // Clean up legacy void data (old cluster system)
      if (clusters.length > 0) {
        await cleanupLegacyVoidData(VOID_GOL_CLUSTER_ID);
        logger.info(
          { legacyClusters: clusters.length },
          'Cleaned up legacy void cluster data',
        );
      }
    }
  }

  private async seed(claimedKeys: string[]): Promise<void> {
    const claimed = new Set(claimedKeys);
    const spawnPoints = pickGoLSpawnPoints(
      VOID_SPAWN_COUNT,
      VOID_ORIGIN_EXCLUSION,
      VOID_SPAWN_MIN_DISTANCE,
    );

    let totalCells = 0;
    for (let i = 0; i < spawnPoints.length; i++) {
      const { qx, qy } = spawnPoints[i];
      const pattern = GOL_PATTERNS[i % GOL_PATTERNS.length];

      for (const { dx, dy } of pattern) {
        const cellQx = qx + dx;
        const cellQy = qy + dy;
        const key = `${cellQx}:${cellQy}`;
        if (claimed.has(key)) continue;
        if (Math.max(Math.abs(cellQx), Math.abs(cellQy)) <= VOID_ORIGIN_EXCLUSION) continue;

        await this.claimQuadrant(cellQx, cellQy);
        claimed.add(key);
        totalCells++;
      }
    }

    logger.info(
      { spawnPoints: spawnPoints.length, totalCells },
      'Void GoL seeded',
    );
  }

  /** Inject a single R-pentomino near existing void territory to restart evolution */
  private async injectPattern(
    alive: Set<string>,
    claimedKeys: string[],
  ): Promise<void> {
    const claimed = new Set(claimedKeys);

    // Pick a random alive cell and place R-pentomino offset from it
    const aliveArr = [...alive];
    for (let attempt = 0; attempt < aliveArr.length; attempt++) {
      const key = aliveArr[attempt];
      const [qx, qy] = key.split(':').map(Number);
      const ox = qx + 5;
      const oy = qy + 5;
      if (Math.max(Math.abs(ox), Math.abs(oy)) <= VOID_ORIGIN_EXCLUSION) continue;

      let placed = 0;
      for (const { dx, dy } of R_PENTOMINO) {
        const cellKey = `${ox + dx}:${oy + dy}`;
        if (claimed.has(cellKey)) continue;
        await this.claimQuadrant(ox + dx, oy + dy);
        claimed.add(cellKey);
        placed++;
      }

      if (placed > 0) {
        logger.info({ qx: ox, qy: oy, placed }, 'Void GoL injected pattern (stable reseed)');
        return;
      }
    }
  }

  private async claimQuadrant(qx: number, qy: number): Promise<void> {
    await upsertQuadrantControl({
      qx,
      qy,
      controlling_faction: 'voids',
      faction_shares: { voids: 100 },
      attack_value: 0,
      defense_value: 0,
      friction_score: 0,
      station_tier: 0,
      void_cluster_id: VOID_GOL_CLUSTER_ID,
    });
    await createVoidHive(qx, qy, VOID_GOL_CLUSTER_ID);
  }

  private async releaseQuadrant(qx: number, qy: number): Promise<void> {
    // Released = unclaimed. Delete the control row instead of upserting a null
    // faction (controlling_faction is NOT NULL → the old null upsert threw every
    // strategic tick). A missing row is treated as unclaimed. (upstream fix 73a0bca)
    await deleteQuadrantControl(qx, qy);
    await deleteVoidHive(qx, qy);
  }
}
