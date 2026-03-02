import { SPAWN_MIN_DISTANCE, SPAWN_DISTANCE_VARIANCE } from '@void-sector/shared';
import { findNearbyCluster, createCluster, incrementClusterCount } from '../db/queries.js';

export function generateSpawnPosition(): { x: number; y: number } {
  const angle = Math.random() * 2 * Math.PI;
  const distance = SPAWN_MIN_DISTANCE + Math.random() * SPAWN_DISTANCE_VARIANCE;
  return {
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance),
  };
}

export async function assignToCluster(x: number, y: number): Promise<{ clusterId: string; x: number; y: number }> {
  const existing = await findNearbyCluster(x, y);
  if (existing) {
    await incrementClusterCount(existing.id);
    return { clusterId: existing.id, x, y };
  }
  const cluster = await createCluster(x, y);
  return { clusterId: cluster.id, x, y };
}
