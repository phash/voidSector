import { SECTOR_WEIGHTS, SECTOR_TYPES, WORLD_SEED, SECTOR_RESOURCE_YIELDS } from '@void-sector/shared';
import type { SectorData, SectorType, SectorResources, ResourceType } from '@void-sector/shared';

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
  return h | 0; // signed 32-bit (fits PostgreSQL INTEGER)
}

function sectorTypeFromSeed(seed: number): SectorType {
  const normalized = (seed >>> 0) / 0x100000000; // treat as unsigned, normalize to [0, 1)
  let cumulative = 0;
  for (const type of SECTOR_TYPES) {
    cumulative += SECTOR_WEIGHTS[type];
    if (normalized < cumulative) return type;
  }
  return 'empty'; // fallback
}

function generateResources(type: SectorType, seed: number): SectorResources {
  const base = SECTOR_RESOURCE_YIELDS[type];
  const resources: SectorResources = { ore: 0, gas: 0, crystal: 0 };
  const types: ResourceType[] = ['ore', 'gas', 'crystal'];
  for (let i = 0; i < types.length; i++) {
    const res = types[i];
    if (base[res] === 0) continue;
    // Use seed bits to vary ±30%
    const variation = ((seed >>> (i * 8)) & 0xFF) / 255; // 0..1
    const factor = 0.7 + variation * 0.6; // 0.7..1.3
    resources[res] = Math.round(base[res] * factor);
  }
  return resources;
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
    resources: generateResources(type, seed),
    discoveredBy,
    discoveredAt: null,
    metadata: {},
  };
}
