import { SECTOR_WEIGHTS, SECTOR_TYPES, WORLD_SEED } from '@void-sector/shared';
import type { SectorData, SectorType } from '@void-sector/shared';

/**
 * Simple deterministic hash for coordinates.
 * Uses a variant of MurmurHash-like mixing.
 */
export function hashCoords(x: number, y: number, worldSeed: number): number {
  // Add distinct prime offsets to x/y to break (n,n)/(-n,-n) symmetry
  let hx = ((x | 0) + 0x9e3779b9) | 0;
  hx = Math.imul(hx ^ (worldSeed | 0), 0x85ebca6b);
  hx = hx ^ (hx >>> 16);
  let hy = ((y | 0) + 0x517cc1b7) | 0;
  hy = Math.imul(hy ^ (worldSeed | 0), 0xc2b2ae35);
  hy = hy ^ (hy >>> 16);
  let h = Math.imul(hx ^ hy, 0x9e3779b9);
  h = h ^ (h >>> 13);
  h = Math.imul(h, 0x85ebca6b);
  h = h ^ (h >>> 16);
  return h >>> 0; // unsigned 32-bit
}

function sectorTypeFromSeed(seed: number): SectorType {
  const normalized = seed / 0x100000000; // full 32-bit range to [0, 1)
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
    discoveredAt: null,
    metadata: {},
  };
}
