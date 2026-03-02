import { SECTOR_WEIGHTS, SECTOR_TYPES, WORLD_SEED } from '@void-sector/shared';
import type { SectorData, SectorType } from '@void-sector/shared';

/**
 * Simple deterministic hash for coordinates.
 * Uses a variant of MurmurHash-like mixing.
 */
export function hashCoords(x: number, y: number, worldSeed: number): number {
  let h = worldSeed | 0;
  h = Math.imul(h ^ (x | 0), 0x9e3779b9);
  h = Math.imul(h ^ (y | 0), 0x517cc1b7);
  h = h ^ (h >>> 16);
  h = Math.imul(h, 0x85ebca6b);
  h = h ^ (h >>> 13);
  h = Math.imul(h, 0xc2b2ae35);
  h = h ^ (h >>> 16);
  return h >>> 0; // unsigned 32-bit
}

function sectorTypeFromSeed(seed: number): SectorType {
  const normalized = (seed % 10000) / 10000; // 0..1
  let cumulative = 0;
  for (const type of SECTOR_TYPES) {
    cumulative += SECTOR_WEIGHTS[type];
    if (normalized < cumulative) return type;
  }
  return 'empty'; // fallback
}

export function generateSector(
  x: number,
  y: number,
  discoveredBy: string | null
): SectorData {
  const seed = hashCoords(x, y, WORLD_SEED);
  const type = sectorTypeFromSeed(seed);

  return {
    x,
    y,
    type,
    seed,
    discoveredBy,
    discoveredAt: new Date().toISOString(),
    metadata: {},
  };
}
