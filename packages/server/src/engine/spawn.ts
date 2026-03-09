import { findNearbyCluster, createCluster, incrementClusterCount } from '../db/queries.js';

export function generateSpawnPosition(): { x: number; y: number } {
  // Spawn within radius 5 of world origin (0:0).
  const x = 1 + Math.floor(Math.random() * 5);
  const y = 1 + Math.floor(Math.random() * 5);
  return { x, y };
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
