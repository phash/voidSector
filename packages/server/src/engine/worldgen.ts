import {
  WORLD_SEED,
  SECTOR_RESOURCE_YIELDS,
  ANCIENT_STATION_CHANCE,
  NEBULA_ZONE_GRID,
  NEBULA_ZONE_CHANCE,
  NEBULA_ZONE_MIN_RADIUS,
  NEBULA_ZONE_MAX_RADIUS,
  NEBULA_SAFE_ORIGIN,
  BLACK_HOLE_SPAWN_CHANCE,
  BLACK_HOLE_MIN_DISTANCE,
  BLACK_HOLE_CLUSTER_GRID,
  BLACK_HOLE_CLUSTER_CHANCE,
  BLACK_HOLE_CLUSTER_MIN_RADIUS,
  BLACK_HOLE_CLUSTER_MAX_RADIUS,
  ENVIRONMENT_WEIGHTS,
  CONTENT_WEIGHTS,
  NEBULA_CONTENT_ENABLED,
} from '@void-sector/shared';
import { legacySectorType } from '@void-sector/shared';
import type {
  SectorData,
  SectorType,
  SectorResources,
  MineableResourceType,
  SectorEnvironment,
  SectorContent,
  QuadrantConfig,
  BlackHoleCluster,
} from '@void-sector/shared';

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

// Secondary hash for metadata decisions (uses different mixing than primary)
function hashSecondary(seed: number): number {
  let h = seed ^ 0xdeadbeef;
  h = Math.imul(h, 0x9e3779b9);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 0x100000000; // 0..1
}

// Tertiary hash — uncorrelated with primary and secondary
function hashTertiary(seed: number): number {
  let h = seed ^ 0xcafebabe;
  h = Math.imul(h, 0xc2b2ae35);
  h = h ^ (h >>> 13);
  h = Math.imul(h, 0x85ebca6b);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 0x100000000; // 0..1
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
        const radius =
          NEBULA_ZONE_MIN_RADIUS +
          radiusFraction * (NEBULA_ZONE_MAX_RADIUS - NEBULA_ZONE_MIN_RADIUS);
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
  }
  return false;
}

/**
 * Determines whether a coordinate falls inside a deterministic black hole cluster.
 * Black hole clusters are seeded on a coarse grid; each cluster center has a radius
 * of 0 to BLACK_HOLE_CLUSTER_MAX_RADIUS sectors. Only sectors far from origin qualify.
 */
export function isInBlackHoleCluster(x: number, y: number): BlackHoleCluster | null {
  const distFromOrigin = Math.max(Math.abs(x), Math.abs(y));
  if (distFromOrigin <= BLACK_HOLE_MIN_DISTANCE) return null;

  const grid = BLACK_HOLE_CLUSTER_GRID;
  const gridX = Math.round(x / grid);
  const gridY = Math.round(y / grid);

  for (let dgx = -1; dgx <= 1; dgx++) {
    for (let dgy = -1; dgy <= 1; dgy++) {
      const cx = (gridX + dgx) * grid;
      const cy = (gridY + dgy) * grid;

      // Must be far enough from origin
      if (Math.max(Math.abs(cx), Math.abs(cy)) <= BLACK_HOLE_MIN_DISTANCE) continue;

      // Use distinct XOR-mixed seed for black hole clusters
      const centerSeed = hashCoords(cx, cy, WORLD_SEED ^ 0xb1ac4001);
      const roll = (centerSeed >>> 0) / 0x100000000;

      if (roll < BLACK_HOLE_CLUSTER_CHANCE) {
        const radiusFraction = hashSecondary(centerSeed);
        const radius =
          BLACK_HOLE_CLUSTER_MIN_RADIUS +
          radiusFraction * (BLACK_HOLE_CLUSTER_MAX_RADIUS - BLACK_HOLE_CLUSTER_MIN_RADIUS);
        const dx = x - cx;
        const dy = y - cy;
        // Use Chebyshev distance for square-ish clusters
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= radius) {
          return { centerX: cx, centerY: cy, radius, seed: centerSeed };
        }
      }
    }
  }
  return null;
}

/**
 * Stage 1: Roll environment type.
 * nebula zones override the roll. Black hole clusters override everything.
 */
function rollEnvironment(x: number, y: number, seed: number): SectorEnvironment {
  const distFromOrigin = Math.max(Math.abs(x), Math.abs(y));

  // Black hole: standalone chance (rare, far from origin)
  if (distFromOrigin > BLACK_HOLE_MIN_DISTANCE) {
    const bhRoll = (seed >>> 0) / 0x100000000;
    if (bhRoll < BLACK_HOLE_SPAWN_CHANCE) {
      return 'black_hole';
    }
  }

  // Black hole clusters
  if (isInBlackHoleCluster(x, y)) {
    return 'black_hole';
  }

  // Nebula zone override
  if (isInNebulaZone(x, y)) {
    return 'nebula';
  }

  // Weighted roll for remaining environments
  const normalized = hashSecondary(seed);
  let cumulative = 0;
  for (const [env, weight] of Object.entries(ENVIRONMENT_WEIGHTS)) {
    cumulative += weight;
    if (normalized < cumulative) return env as SectorEnvironment;
  }
  return 'empty';
}

/**
 * Stage 2: Roll content for a sector (what's inside the environment).
 * Black holes never have content. Empty and nebula sectors both get a content roll.
 */
function rollContent(seed: number, environment: SectorEnvironment): SectorContent[] {
  if (environment === 'black_hole') return [];

  // For nebula, only roll content if enabled
  if (environment === 'nebula' && !NEBULA_CONTENT_ENABLED) return [];

  // Use tertiary hash for content roll (uncorrelated with environment roll)
  const roll = hashTertiary(seed);
  let cumulative = 0;
  for (const [contentKey, weight] of Object.entries(CONTENT_WEIGHTS)) {
    cumulative += weight;
    if (roll < cumulative) {
      if (contentKey === 'none') return [];
      if (contentKey === 'pirate') return ['pirate_zone', 'asteroid_field'];
      return [contentKey as SectorContent];
    }
  }
  return [];
}

function generateResources(type: SectorType, seed: number): SectorResources {
  const base = SECTOR_RESOURCE_YIELDS[type];
  const resources: SectorResources = { ore: 0, gas: 0, crystal: 0 };
  const types: MineableResourceType[] = ['ore', 'gas', 'crystal'];
  for (let i = 0; i < types.length; i++) {
    const res = types[i];
    if (base[res] === 0) continue;
    // Use seed bits to vary ±30%
    const variation = ((seed >>> (i * 8)) & 0xff) / 255; // 0..1
    const factor = 0.7 + variation * 0.6; // 0.7..1.3
    resources[res] = Math.round(base[res] * factor);
  }
  return resources;
}

export function generateSector(x: number, y: number, discoveredBy: string | null, isFrontier = true): SectorData {
  const seed = hashCoords(x, y, WORLD_SEED);

  // Stage 1: Roll environment
  const environment = rollEnvironment(x, y, seed);

  // Black holes are impassable with no content or resources
  if (environment === 'black_hole') {
    return {
      x,
      y,
      seed,
      environment,
      contents: [],
      type: 'empty',
      discoveredBy,
      discoveredAt: null,
      metadata: {},
      resources: { ore: 0, gas: 0, crystal: 0 },
      impassable: true,
    };
  }

  // Stage 2: Roll content
  let contents = rollContent(seed, environment);

  // Frontier rule: pirates only spawn in frontier quadrants.
  // Strip pirate_zone but preserve asteroid_field (the rocks remain).
  if (!isFrontier && contents.includes('pirate_zone')) {
    contents = contents.filter((c) => c !== 'pirate_zone');
  }

  // Derive legacy type from environment + contents
  const type = legacySectorType(environment, contents);

  // Special metadata: some stations are ancient variants
  const metadata: Record<string, unknown> = {};
  if (contents.includes('station')) {
    const secondaryRoll = hashSecondary(seed);
    if (secondaryRoll < ANCIENT_STATION_CHANCE) {
      metadata.stationVariant = 'ancient';
    }
  }

  return {
    x,
    y,
    seed,
    environment,
    contents,
    type,
    resources: generateResources(type, seed),
    discoveredBy,
    discoveredAt: null,
    metadata,
  };
}

/**
 * Apply quadrant-level resource scaling to sector resources.
 * Pure function — does not modify the input.
 */
export function applyQuadrantFactors(
  resources: SectorResources,
  config: QuadrantConfig,
): SectorResources {
  return {
    ore: Math.round(resources.ore * config.resourceFactor),
    gas: Math.round(resources.gas * config.resourceFactor),
    crystal: Math.round(resources.crystal * config.resourceFactor),
  };
}
