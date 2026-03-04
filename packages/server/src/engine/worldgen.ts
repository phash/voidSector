import { SECTOR_WEIGHTS, SECTOR_TYPES, WORLD_SEED, SECTOR_RESOURCE_YIELDS, ANCIENT_STATION_CHANCE, NEBULA_ZONE_GRID, NEBULA_ZONE_CHANCE, NEBULA_ZONE_MIN_RADIUS, NEBULA_ZONE_MAX_RADIUS, NEBULA_SAFE_ORIGIN, BLACK_HOLE_SPAWN_CHANCE, BLACK_HOLE_MIN_DISTANCE } from '@void-sector/shared';
import { deriveEnvironment, deriveContents } from '@void-sector/shared';
import type { SectorData, SectorType, SectorResources, MineableResourceType, SectorEnvironment, SectorContent } from '@void-sector/shared';

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
  const types: MineableResourceType[] = ['ore', 'gas', 'crystal'];
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

/**
 * Determines whether a coordinate falls inside a seed-based nebula zone.
 * Nebula zones are organic blobs generated on a coarse grid; zone centers
 * further than NEBULA_SAFE_ORIGIN from the origin are potential nebula seeds.
 */
export function isInNebulaZone(x: number, y: number): boolean {
  const grid = NEBULA_ZONE_GRID;
  const gridX = Math.round(x / grid);
  const gridY = Math.round(y / grid);

  for (let dgx = -1; dgx <= 1; dgx++) {
    for (let dgy = -1; dgy <= 1; dgy++) {
      const cx = (gridX + dgx) * grid;
      const cy = (gridY + dgy) * grid;

      // Keep a safe zone around the origin
      if (cx * cx + cy * cy < NEBULA_SAFE_ORIGIN * NEBULA_SAFE_ORIGIN) continue;

      // Use XOR-mixed seed so nebula zones are uncorrelated with normal sector types
      const centerSeed = hashCoords(cx, cy, WORLD_SEED ^ 0xa5a5a5a5);
      const roll = (centerSeed >>> 0) / 0x100000000;

      if (roll < NEBULA_ZONE_CHANCE) {
        const radiusFraction = hashSecondary(centerSeed);
        const radius = NEBULA_ZONE_MIN_RADIUS + radiusFraction * (NEBULA_ZONE_MAX_RADIUS - NEBULA_ZONE_MIN_RADIUS);
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
  }
  return false;
}

// Secondary hash for metadata decisions (uses different mixing than primary)
function hashSecondary(seed: number): number {
  let h = seed ^ 0xdeadbeef;
  h = Math.imul(h, 0x9e3779b9);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 0x100000000; // 0..1
}

export function generateSector(
  x: number,
  y: number,
  discoveredBy: string | null
): SectorData {
  const seed = hashCoords(x, y, WORLD_SEED);
  const distFromOrigin = Math.max(Math.abs(x), Math.abs(y));

  // Black hole check — rare, only far from origin
  if (distFromOrigin > BLACK_HOLE_MIN_DISTANCE) {
    const bhRoll = ((seed >>> 0) & 0xFF) / 255;
    if (bhRoll < BLACK_HOLE_SPAWN_CHANCE) {
      return {
        x, y, seed,
        environment: 'black_hole' as SectorEnvironment,
        contents: [],
        type: 'empty',
        discoveredBy,
        discoveredAt: null,
        metadata: {},
        resources: { ore: 0, gas: 0, crystal: 0 },
      };
    }
  }

  // Legacy type generation (preserved for determinism)
  const type = isInNebulaZone(x, y) ? 'nebula' : sectorTypeFromSeed(seed);

  // Derive environment and contents from legacy type
  const environment = deriveEnvironment(type);
  const contents = deriveContents(type);

  // Special metadata: some stations are ancient variants
  const metadata: Record<string, unknown> = {};
  if (type === 'station') {
    const secondaryRoll = hashSecondary(seed);
    if (secondaryRoll < ANCIENT_STATION_CHANCE) {
      metadata.stationVariant = 'ancient';
    }
  }

  return {
    x, y, seed,
    environment,
    contents,
    type,
    resources: generateResources(type, seed),
    discoveredBy,
    discoveredAt: null,
    metadata,
  };
}
