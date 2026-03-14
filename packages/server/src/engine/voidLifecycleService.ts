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
const VOID_SPAWN_INTERVAL_TICKS = 10;
const VOID_MIN_CLUSTER_COUNT = 32;
const VOID_MAX_CLUSTER_COUNT = 48;
const VOID_ORIGIN_EXCLUSION = 100;
const VOID_SPAWN_MIN_DISTANCE = 50;

// ─── Pure Helpers (exported for testing) ─────────────────────────────────────

/**
 * Compute the 100-sector frontier line for a quadrant at the given progress.
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
 */
export function pickSpawnPoint(
  claimedKeys: Set<string>,
  searchRadius: number,
  minDistance: number,
): { qx: number; qy: number } | null {
  const claimedCoords: Array<{ qx: number; qy: number }> = [];
  for (const key of claimedKeys) {
    const [qxStr, qyStr] = key.split(':');
    claimedCoords.push({ qx: Number(qxStr), qy: Number(qyStr) });
  }

  for (let qx = -searchRadius; qx <= searchRadius; qx++) {
    for (let qy = -searchRadius; qy <= searchRadius; qy++) {
      const key = `${qx}:${qy}`;
      if (claimedKeys.has(key)) continue;

      if (Math.max(Math.abs(qx), Math.abs(qy)) <= VOID_ORIGIN_EXCLUSION) continue;

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
 * Partition quadrants into n groups using nearest-centroid (k-means seed selection).
 */
export function computeSplitGroups(
  quadrants: VoidClusterQuadrantRow[],
  n: number,
): { groups: VoidClusterQuadrantRow[][]; abandoned: VoidClusterQuadrantRow[] } {
  if (quadrants.length === 0) return { groups: [], abandoned: [] };
  if (n >= quadrants.length) return { groups: quadrants.map((q) => [q]), abandoned: [] };

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

  const groups: VoidClusterQuadrantRow[][] = seeds.map(() => []);
  for (const q of quadrants) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < seeds.length; i++) {
      const d = Math.abs(seeds[i].qx - q.qx) + Math.abs(seeds[i].qy - q.qy);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    groups[bestIdx].push(q);
  }

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

    const toDie = pickDyingClusters(clusters);
    for (const c of toDie) {
      await upsertVoidCluster({ ...c, state: 'dying' });
      logger.info({ clusterId: c.id }, 'Void cluster marked dying (pop-cap)');
    }

    const refreshed = await getVoidClusters();
    for (const cluster of refreshed) {
      await this.processCluster(cluster);
    }

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
        });
        await createVoidHive(q.qx, q.qy, cluster.id);
        await deleteVoidFrontierSectorsForQuadrant(cluster.id, q.qx, q.qy);
        newSize++;

        const completedSet = new Set(
          quadrants
            .filter((cq) => cq.progress === 100 || (cq.qx === q.qx && cq.qy === q.qy))
            .map((cq) => `${cq.qx}:${cq.qy}`),
        );
        const syntheticControls = allControls.map((c) =>
          completedSet.has(`${c.qx}:${c.qy}`)
            ? { ...c, controlling_faction: 'voids' }
            : c,
        );
        const target = getExpansionTarget('voids', syntheticControls, 'sphere');
        if (target) {
          await upsertVoidClusterQuadrant(cluster.id, target.qx, target.qy, 0);
          logger.debug(
            { clusterId: cluster.id, qx: target.qx, qy: target.qy },
            'Void expanding',
          );
        }
      } else {
        const sectors = computeFrontierSectors(q.qx, q.qy, newProgress);
        await replaceVoidFrontierSectors(cluster.id, q.qx, q.qy, sectors);
      }
    }

    const shouldSplit = newSize >= cluster.split_threshold;
    await upsertVoidCluster({
      ...cluster,
      size: newSize,
      state: shouldSplit ? 'splitting' : 'growing',
    });

    if (shouldSplit) {
      logger.info(
        { clusterId: cluster.id, size: newSize },
        'Void cluster reached split threshold',
      );
    }

    await this.checkCollision(cluster.id);
  }

  private async processSplitting(cluster: VoidClusterRow): Promise<void> {
    const quadrants = await getVoidClusterQuadrants(cluster.id);
    const complete = quadrants.filter((q) => q.progress === 100);

    const n = Math.random() < 0.33 ? 3 : 2;
    const { groups, abandoned } = computeSplitGroups(complete, n);

    for (const q of abandoned) {
      await this.releaseQuadrant(cluster.id, q.qx, q.qy);
    }

    for (const group of groups) {
      const newId = `vc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const threshold = 8 + Math.floor(Math.random() * 9);
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
        });
      }
    }

    const inProgress = quadrants.filter((q) => q.progress < 100);
    for (const q of inProgress) {
      await deleteVoidClusterQuadrant(cluster.id, q.qx, q.qy);
      await deleteVoidFrontierSectorsForQuadrant(cluster.id, q.qx, q.qy);
    }

    await deleteVoidCluster(cluster.id);
    logger.info(
      { clusterId: cluster.id, groups: groups.length, abandoned: abandoned.length },
      'Void cluster split',
    );
  }

  private async processDying(cluster: VoidClusterRow): Promise<void> {
    const quadrants = await getVoidClusterQuadrants(cluster.id);
    if (quadrants.length === 0) {
      await deleteVoidCluster(cluster.id);
      return;
    }

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
      controlling_faction: null,
      faction_shares: {},
      attack_value: 0,
      defense_value: 0,
      friction_score: 0,
      station_tier: 0,
      void_cluster_id: null,
    });
    await deleteVoidHive(qx, qy);
    await deleteVoidClusterQuadrant(clusterId, qx, qy);
    await deleteVoidFrontierSectorsForQuadrant(clusterId, qx, qy);
    logger.debug({ clusterId, qx, qy }, 'Void released quadrant');
  }

  private async checkCollision(clusterId: string): Promise<void> {
    const allClusters = await getVoidClusters();
    const allControls = await getAllQuadrantControls();

    const ownQuadrants = allControls.filter(
      (c) => c.void_cluster_id === clusterId && c.controlling_faction === 'voids',
    );

    for (const other of allClusters) {
      if (other.id === clusterId) continue;
      const otherQuadrants = allControls.filter(
        (c) => c.void_cluster_id === other.id && c.controlling_faction === 'voids',
      );

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
        await this.resolveCollision(
          clusterId,
          ownQuadrants.map((q) => ({ qx: q.qx, qy: q.qy })),
          other.id,
          otherQuadrants.map((q) => ({ qx: q.qx, qy: q.qy })),
        );
      }
    }
  }

  private async resolveCollision(
    idA: string,
    quadrantsA: Array<{ qx: number; qy: number }>,
    idB: string,
    quadrantsB: Array<{ qx: number; qy: number }>,
  ): Promise<void> {
    const centroidB = {
      qx: mean(quadrantsB.map((q) => q.qx)),
      qy: mean(quadrantsB.map((q) => q.qy)),
    };
    const centroidA = {
      qx: mean(quadrantsA.map((q) => q.qx)),
      qy: mean(quadrantsA.map((q) => q.qy)),
    };

    const keepA = [...quadrantsA]
      .sort((a, b) => dist(b, centroidB) - dist(a, centroidB))
      .slice(0, Math.max(3, Math.ceil(quadrantsA.length / 2)));
    const keepB = [...quadrantsB]
      .sort((a, b) => dist(b, centroidA) - dist(a, centroidA))
      .slice(0, Math.max(3, Math.ceil(quadrantsB.length / 2)));

    const toReleaseA = quadrantsA.filter(
      (q) => !keepA.some((k) => k.qx === q.qx && k.qy === q.qy),
    );
    const toReleaseB = quadrantsB.filter(
      (q) => !keepB.some((k) => k.qx === q.qx && k.qy === q.qy),
    );

    for (const q of toReleaseA) await this.releaseQuadrant(idA, q.qx, q.qy);
    for (const q of toReleaseB) await this.releaseQuadrant(idB, q.qx, q.qy);

    logger.info(
      { idA, idB, releasedA: toReleaseA.length, releasedB: toReleaseB.length },
      'Void cluster collision resolved',
    );
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
    logger.info(
      { clusterId: id, qx: point.qx, qy: point.qy, threshold },
      'Void cluster spawned',
    );
  }
}

function dist(
  a: { qx: number; qy: number },
  b: { qx: number; qy: number },
): number {
  return Math.abs(a.qx - b.qx) + Math.abs(a.qy - b.qy);
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}
