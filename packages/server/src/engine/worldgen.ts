import { SECTOR_WEIGHTS, SECTOR_TYPES, WORLD_SEED, SECTOR_RESOURCE_YIELDS, ANCIENT_STATION_CHANCE, NEBULA_ZONE_GRID, NEBULA_ZONE_CHANCE, NEBULA_ZONE_MIN_RADIUS, NEBULA_ZONE_MAX_RADIUS, NEBULA_SAFE_ORIGIN, QUAD_SECTOR_SIZE, QUAD_FACTOR_MIN, QUAD_FACTOR_MAX, QUAD_AUTONAME_PREFIXES, QUAD_AUTONAME_SUFFIXES, EMPTY_ENCOUNTER_CHANCES, EMPTY_ENCOUNTER_SCANNER_BONUS } from '@void-sector/shared';
import type { SectorData, SectorType, SectorResources, ResourceType, QuadrantConfig, QuadrantData, EmptyEncounterResult } from '@void-sector/shared';

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

function sectorTypeFromSeedWithConfig(seed: number, cfg: QuadrantConfig): SectorType {
  // Build adjusted weights from quadrant config factors, then renormalize
  const adjusted: Record<string, number> = {};
  let total = 0;
  for (const type of SECTOR_TYPES) {
    let w = SECTOR_WEIGHTS[type];
    if (type === 'empty')        w *= cfg.emptyRatio;
    else if (type === 'station') w *= cfg.stationDensity;
    else if (type === 'pirate')  w *= cfg.pirateDensity;
    else if (type === 'nebula')  w *= cfg.nebulaThreshold;
    adjusted[type] = w;
    total += w;
  }
  const normalized = (seed >>> 0) / 0x100000000;
  let cumulative = 0;
  for (const type of SECTOR_TYPES) {
    cumulative += adjusted[type] / total;
    if (normalized < cumulative) return type as SectorType;
  }
  return 'empty';
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

/** Converts sector coordinates to quadrant coordinates. */
export function coordsToQuadrant(x: number, y: number): { qx: number; qy: number } {
  return {
    qx: Math.floor(x / QUAD_SECTOR_SIZE),
    qy: Math.floor(y / QUAD_SECTOR_SIZE),
  };
}

/** Derives a per-quadrant factor in [QUAD_FACTOR_MIN, QUAD_FACTOR_MAX] from a seed integer. */
function quadFactor(seed: number): number {
  return QUAD_FACTOR_MIN + ((seed >>> 0) / 0xFFFFFFFF) * (QUAD_FACTOR_MAX - QUAD_FACTOR_MIN);
}

/** Generates a deterministic QuadrantConfig from quadrant coordinates. */
export function generateQuadrantConfig(qx: number, qy: number): { seed: number; config: QuadrantConfig } {
  const seed = hashCoords(qx ^ 0xDEAD, qy ^ 0xBEEF, WORLD_SEED);
  const s1 = hashCoords(qx, qy, seed);
  const s2 = hashCoords(qx + 1, qy, seed);
  const s3 = hashCoords(qx, qy + 1, seed);
  const s4 = hashCoords(qx + 1, qy + 1, seed);
  const s5 = hashCoords(qx - 1, qy, seed);
  return {
    seed,
    config: {
      resourceFactor:  quadFactor(seed),
      stationDensity:  quadFactor(s1),
      pirateDensity:   quadFactor(s2),
      nebulaThreshold: quadFactor(s3),
      emptyRatio:      quadFactor(s4),
    },
  };
}

/** Generates a deterministic auto-name for a quadrant from its seed. */
export function generateQuadrantAutoName(seed: number): string {
  const pi = ((seed >>> 0) % QUAD_AUTONAME_PREFIXES.length);
  const si = (((seed >>> 16) >>> 0) % QUAD_AUTONAME_SUFFIXES.length);
  return `${QUAD_AUTONAME_PREFIXES[pi]} ${QUAD_AUTONAME_SUFFIXES[si]}`;
}

/**
 * Rolls an empty-sector rare encounter. Returns null if no encounter fires.
 * Scanner level above 1 grants a bonus to detection rates.
 */
export function rollEmptyEncounter(
  x: number, y: number, scannerLevel: number,
): EmptyEncounterResult | null {
  const seed = hashCoords(x, y, WORLD_SEED ^ 0xEC0EC0);
  const roll = (seed >>> 0) / 0xFFFFFFFF;
  const bonus = 1 + Math.max(0, scannerLevel - 1) * EMPTY_ENCOUNTER_SCANNER_BONUS;

  const npcChance      = EMPTY_ENCOUNTER_CHANCES.driftingNpc * bonus;
  const alienChance    = EMPTY_ENCOUNTER_CHANCES.alienSig * bonus;
  const artifactChance = EMPTY_ENCOUNTER_CHANCES.artifactWreck * bonus;

  if (roll < npcChance) {
    return { type: 'driftingNpc', message: 'DRIFTING VESSEL DETECTED — Transmitting trade request.' };
  }
  const roll2 = hashSecondary(seed ^ 0x1);
  if (roll2 < alienChance) {
    return { type: 'alienSig', message: 'UNKNOWN SIGNATURE — Origin unclassifiable. Approach with caution.' };
  }
  const roll3 = hashSecondary(seed ^ 0x2);
  if (roll3 < artifactChance) {
    return { type: 'artifactWreck', message: 'DERELICT STRUCTURE — Salvageable materials detected.' };
  }
  return null;
}

export function generateSector(
  x: number,
  y: number,
  discoveredBy: string | null,
  quadrantConfig?: QuadrantConfig,
): SectorData {
  const seed = hashCoords(x, y, WORLD_SEED);

  // Apply quadrant density modifiers to sector type weights
  let type: SectorType;
  if (isInNebulaZone(x, y)) {
    // Nebula zones always win (quadrant modifiers don't override hard zone membership)
    type = 'nebula';
  } else if (quadrantConfig) {
    type = sectorTypeFromSeedWithConfig(seed, quadrantConfig);
  } else {
    type = sectorTypeFromSeed(seed);
  }

  // Special metadata: some stations are ancient variants
  const metadata: Record<string, unknown> = {};
  if (type === 'station') {
    const secondaryRoll = hashSecondary(seed);
    if (secondaryRoll < ANCIENT_STATION_CHANCE) {
      metadata.stationVariant = 'ancient';
    }
  }

  // Apply quadrant resource factor
  const resources = generateResources(type, seed);
  if (quadrantConfig && quadrantConfig.resourceFactor !== 1) {
    const rf = quadrantConfig.resourceFactor;
    resources.ore     = Math.round(resources.ore * rf);
    resources.gas     = Math.round(resources.gas * rf);
    resources.crystal = Math.round(resources.crystal * rf);
  }

  return {
    x,
    y,
    type,
    seed,
    resources,
    discoveredBy,
    discoveredAt: null,
    metadata,
  };
}
