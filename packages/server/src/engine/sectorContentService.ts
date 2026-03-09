import {
  WORLD_SEED,
  SECTOR_ENVIRONMENT_WEIGHTS,
  PLANET_SUBTYPE_WEIGHTS,
  DENSITY_STATION_NEAR,
  DENSITY_STATION_FAR,
  DENSITY_PIRATE_NEAR,
  DENSITY_PIRATE_FAR,
  DENSITY_DISTANCE_THRESHOLD,
} from '@void-sector/shared';
import type { SectorEnvironment, PlanetSubtype, SectorContent } from '@void-sector/shared';
import { hashCoords } from './worldgen.js';

export interface SectorEnvironmentRecord {
  sectorX: number;
  sectorY: number;
  environmentType: SectorEnvironment;
  planetSubtype: PlanetSubtype | null;
  isImpassable: boolean;
  contentVariance: number;
}

export interface SectorContentRecord {
  sectorX: number;
  sectorY: number;
  contentType: SectorContent;
  oreYield: number;
  gasYield: number;
  crystalYield: number;
  exoticYield: number;
  /** null = permanent POI, timestamp ms = temporary (respawns) */
  respawnAt: number | null;
}

// Chebyshev distance from absolute origin (0,0)
function chebyshevDistance(x: number, y: number): number {
  return Math.max(Math.abs(x), Math.abs(y));
}

function getDistanceMultiplier(x: number, y: number, nearValue: number, farValue: number): number {
  const dist = chebyshevDistance(x, y);
  const t = Math.min(dist / DENSITY_DISTANCE_THRESHOLD, 1.0);
  return nearValue + (farValue - nearValue) * t;
}

/**
 * Pick a weighted random key from a weight map using a 0..1 value.
 */
function pickWeighted(weights: Record<string, number>, rng: number): string {
  let total = 0;
  for (const w of Object.values(weights)) total += w;
  let cursor = rng * total;
  for (const [key, w] of Object.entries(weights)) {
    cursor -= w;
    if (cursor <= 0) return key;
  }
  return Object.keys(weights)[0];
}

/**
 * Deterministically generate the environment for a sector from world seed.
 * Does NOT read the DB — pure computation.
 */
export function generateSectorEnvironment(
  sectorX: number,
  sectorY: number,
  worldSeed: number = WORLD_SEED,
): SectorEnvironmentRecord {
  const seed = hashCoords(sectorX, sectorY, worldSeed);
  const rng1 = (seed >>> 0) / 0x100000000;
  const rng2 = ((seed ^ 0xdeadbeef) >>> 0) / 0x100000000;
  const rng3 = ((seed ^ 0xbeefcafe) >>> 0) / 0x100000000;

  const environmentType = pickWeighted(SECTOR_ENVIRONMENT_WEIGHTS, rng1) as SectorEnvironment;
  const isImpassable = environmentType === 'star' || environmentType === 'black_hole';

  let planetSubtype: PlanetSubtype | null = null;
  if (environmentType === 'planet') {
    planetSubtype = pickWeighted(PLANET_SUBTYPE_WEIGHTS, rng2) as PlanetSubtype;
  }

  // Content variance: 0.2 to 1.8 (±80%) for per-quadrant resource variety
  const contentVariance = 0.2 + rng3 * 1.6;

  return {
    sectorX,
    sectorY,
    environmentType,
    planetSubtype,
    isImpassable,
    contentVariance,
  };
}

/**
 * Deterministically generate contents for a sector.
 * Takes distance-based density into account (stations more common near origin).
 */
export function generateSectorContents(
  sectorX: number,
  sectorY: number,
  environmentType: SectorEnvironment,
  contentVariance: number,
  worldSeed: number = WORLD_SEED,
): SectorContentRecord[] {
  if (environmentType === 'star' || environmentType === 'black_hole') return [];

  const contents: SectorContentRecord[] = [];
  const seed = hashCoords(sectorX, sectorY, worldSeed + 1); // offset to avoid correlation with env seed
  const rngStation = ((seed ^ 0x11111111) >>> 0) / 0x100000000;
  const rngPirate = ((seed ^ 0x22222222) >>> 0) / 0x100000000;
  const rngMeteor = ((seed ^ 0x33333333) >>> 0) / 0x100000000;
  const rngRelic = ((seed ^ 0x44444444) >>> 0) / 0x100000000;
  const rngNpc = ((seed ^ 0x55555555) >>> 0) / 0x100000000;
  const rngRuin = ((seed ^ 0x66666666) >>> 0) / 0x100000000;

  // Station: 8% base, density-adjusted
  const stationMult = getDistanceMultiplier(
    sectorX,
    sectorY,
    DENSITY_STATION_NEAR,
    DENSITY_STATION_FAR,
  );
  if (
    (environmentType === 'empty' || environmentType === 'planet') &&
    rngStation < 0.08 * stationMult * contentVariance
  ) {
    contents.push({
      sectorX,
      sectorY,
      contentType: 'station',
      oreYield: 0,
      gasYield: 0,
      crystalYield: 0,
      exoticYield: 0,
      respawnAt: null,
    });
  }

  // Pirate zone: 10% base in non-nebula, density-adjusted (more far from origin)
  const pirateMult = getDistanceMultiplier(
    sectorX,
    sectorY,
    DENSITY_PIRATE_NEAR,
    DENSITY_PIRATE_FAR,
  );
  if (environmentType !== 'nebula' && rngPirate < 0.1 * pirateMult * contentVariance) {
    contents.push({
      sectorX,
      sectorY,
      contentType: 'pirate_zone',
      oreYield: 0,
      gasYield: 0,
      crystalYield: 0,
      exoticYield: 0,
      respawnAt: null,
    });
  }

  // Meteor: 5% chance in asteroid/empty sectors, temporary (2h respawn)
  if (
    (environmentType === 'asteroid' || environmentType === 'empty') &&
    rngMeteor < 0.05 * contentVariance
  ) {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    contents.push({
      sectorX,
      sectorY,
      contentType: 'meteor',
      oreYield: 20 + Math.floor(rngMeteor * 30), // 20-50
      gasYield: 2 + Math.floor(rngMeteor * 3), // 2-5
      crystalYield: 3 + Math.floor(rngMeteor * 5), // 3-8
      exoticYield: rngMeteor < 0.35 ? 15 + Math.floor(rngMeteor * 25) : 0, // 35% exotic chance
      respawnAt: Date.now() + TWO_HOURS_MS,
    });
  }

  // Relic: 2% chance in nebula sectors
  if (environmentType === 'nebula' && rngRelic < 0.02) {
    contents.push({
      sectorX,
      sectorY,
      contentType: 'relic',
      oreYield: 0,
      gasYield: 0,
      crystalYield: 0,
      exoticYield: 5 + Math.floor(rngRelic * 20), // 5-25 exotic from relics
      respawnAt: null,
    });
  }

  // Ancient ruin: 2% base, uniform across all non-star non-black-hole environments
  // Slightly more common far from origin (Ancients spread everywhere)
  const ruinMult = getDistanceMultiplier(sectorX, sectorY, 0.8, 1.2);
  if (rngRuin < 0.02 * ruinMult * contentVariance) {
    contents.push({
      sectorX,
      sectorY,
      contentType: 'ruin',
      oreYield: 0,
      gasYield: 0,
      crystalYield: 0,
      exoticYield: 0,
      respawnAt: null,
    });
  }

  // NPC ship: 3% chance in non-black-hole, non-star sectors
  if (rngNpc < 0.03) {
    contents.push({
      sectorX,
      sectorY,
      contentType: 'npc_ship',
      oreYield: 0,
      gasYield: 0,
      crystalYield: 0,
      exoticYield: 0,
      respawnAt: null,
    });
  }

  return contents;
}

/**
 * Returns distance-based density multiplier for stations (utility for tests/admin).
 */
export function getStationDensityMultiplier(sectorX: number, sectorY: number): number {
  return getDistanceMultiplier(sectorX, sectorY, DENSITY_STATION_NEAR, DENSITY_STATION_FAR);
}

/**
 * Returns distance-based density multiplier for pirates (utility for tests/admin).
 */
export function getPirateDensityMultiplier(sectorX: number, sectorY: number): number {
  return getDistanceMultiplier(sectorX, sectorY, DENSITY_PIRATE_NEAR, DENSITY_PIRATE_FAR);
}
