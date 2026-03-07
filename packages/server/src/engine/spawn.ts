import { SPAWN_MIN_DISTANCE, SPAWN_DISTANCE_VARIANCE } from '@void-sector/shared';
import { findNearbyCluster, createCluster, incrementClusterCount } from '../db/queries.js';

export function generateSpawnPosition(): { x: number; y: number } {
  // Spawn near origin (quadrant 0:0) — the edge of the known universe.
  // Humans believe this is the center of everything. They are wrong.
  const SPAWN_Q_MAX = 5;
  const QUADRANT_SIZE = 10_000;
  const qx = Math.floor(Math.random() * (SPAWN_Q_MAX + 1));
  const qy = Math.floor(Math.random() * (SPAWN_Q_MAX + 1));
  // Keep a small buffer from absolute 0 so the first sector isn't the literal corner
  const sx = 100 + Math.floor(Math.random() * (QUADRANT_SIZE - 100));
  const sy = 100 + Math.floor(Math.random() * (QUADRANT_SIZE - 100));
  return { x: qx * QUADRANT_SIZE + sx, y: qy * QUADRANT_SIZE + sy };
}

export async function assignToCluster(
  x: number,
  y: number,
): Promise<{ clusterId: string; x: number; y: number }> {
  const existing = await findNearbyCluster(x, y);
  if (existing) {
    await incrementClusterCount(existing.id);
    return { clusterId: existing.id, x, y };
  }
  const cluster = await createCluster(x, y);
  return { clusterId: cluster.id, x, y };
}
