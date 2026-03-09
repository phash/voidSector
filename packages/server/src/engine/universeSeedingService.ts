import { WORLD_SEED, QUADRANT_SIZE } from '@void-sector/shared';
import {
  generateSectorEnvironment,
  generateSectorContents,
  type SectorEnvironmentRecord,
  type SectorContentRecord,
} from './sectorContentService.js';
import type { PlanetSubtype } from '@void-sector/shared';

export interface ExoticPlanetInfo {
  sectorX: number;
  sectorY: number;
  planetSubtype: PlanetSubtype;
  oreYield: number;
  crystalYield: number;
  exoticYield: number;
}

/**
 * Identifies all exotic-type planets within a given coordinate range.
 * Used to pre-generate "exotic planet" POI data for admin/exploration.
 */
export function findExoticPlanets(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  worldSeed: number = WORLD_SEED,
): ExoticPlanetInfo[] {
  const results: ExoticPlanetInfo[] = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const env = generateSectorEnvironment(x, y, worldSeed);
      if (
        env.environmentType === 'planet' &&
        env.planetSubtype &&
        ['exotic_a', 'exotic_b', 'exotic_c'].includes(env.planetSubtype)
      ) {
        results.push({
          sectorX: x,
          sectorY: y,
          planetSubtype: env.planetSubtype,
          ...getExoticPlanetYields(env.planetSubtype),
        });
      }
    }
  }
  return results;
}

/**
 * Returns resource yields for exotic planet types.
 */
export function getExoticPlanetYields(subtype: PlanetSubtype): {
  oreYield: number;
  crystalYield: number;
  exoticYield: number;
} {
  switch (subtype) {
    case 'exotic_a':
      return { oreYield: 250, crystalYield: 7, exoticYield: 75 };
    case 'exotic_b':
      return { oreYield: 25, crystalYield: 40, exoticYield: 115 };
    case 'exotic_c':
      return { oreYield: 15, crystalYield: 30, exoticYield: 150 };
    default:
      return { oreYield: 0, crystalYield: 0, exoticYield: 0 };
  }
}

/**
 * Universe statistics for a sampled region.
 * Useful for admin dashboards and balance validation.
 */
export interface UniverseStats {
  totalSectors: number;
  environmentCounts: Record<string, number>;
  planetSubtypeCounts: Record<string, number>;
  exoticPlanetCount: number;
  contentCounts: Record<string, number>;
}

/**
 * Sample a region of the universe and compute statistics.
 * For full universe stats, use a large sampleRate (e.g. 100 = every 100th sector).
 */
export function sampleUniverseStats(
  regionSize: number,
  sampleRate: number = 1,
  worldSeed: number = WORLD_SEED,
): UniverseStats {
  const stats: UniverseStats = {
    totalSectors: 0,
    environmentCounts: {},
    planetSubtypeCounts: {},
    exoticPlanetCount: 0,
    contentCounts: {},
  };

  for (let x = 0; x < regionSize; x += sampleRate) {
    for (let y = 0; y < regionSize; y += sampleRate) {
      const env = generateSectorEnvironment(x, y, worldSeed);
      stats.totalSectors++;
      stats.environmentCounts[env.environmentType] =
        (stats.environmentCounts[env.environmentType] ?? 0) + 1;

      if (env.planetSubtype) {
        stats.planetSubtypeCounts[env.planetSubtype] =
          (stats.planetSubtypeCounts[env.planetSubtype] ?? 0) + 1;
        if (['exotic_a', 'exotic_b', 'exotic_c'].includes(env.planetSubtype)) {
          stats.exoticPlanetCount++;
        }
      }

      const contents = generateSectorContents(x, y, env.environmentType, env.contentVariance, worldSeed);
      for (const c of contents) {
        stats.contentCounts[c.contentType] = (stats.contentCounts[c.contentType] ?? 0) + 1;
      }
    }
  }

  return stats;
}

/**
 * Generate all environment + content records for a single quadrant.
 * Returns the data without writing to DB (caller handles persistence).
 */
export function generateQuadrantData(
  quadrantX: number,
  quadrantY: number,
  worldSeed: number = WORLD_SEED,
): { environments: SectorEnvironmentRecord[]; contents: SectorContentRecord[] } {
  const environments: SectorEnvironmentRecord[] = [];
  const contents: SectorContentRecord[] = [];
  const baseX = quadrantX * QUADRANT_SIZE;
  const baseY = quadrantY * QUADRANT_SIZE;

  for (let sx = 0; sx < QUADRANT_SIZE; sx++) {
    for (let sy = 0; sy < QUADRANT_SIZE; sy++) {
      const absX = baseX + sx;
      const absY = baseY + sy;
      const env = generateSectorEnvironment(absX, absY, worldSeed);
      environments.push(env);
      const cs = generateSectorContents(absX, absY, env.environmentType, env.contentVariance, worldSeed);
      contents.push(...cs);
    }
  }

  return { environments, contents };
}
