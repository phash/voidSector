import { RESEARCH_LAB_WISSEN_RATE, WISSEN_SECTOR_MULTIPLIERS } from '@void-sector/shared';
import { query } from '../db/client.js';
import { addWissen } from '../db/queries.js';
import { logger } from '../utils/logger.js';

/**
 * Calculates Wissen gained for a single lab in a given elapsed time.
 *
 * @param labTier - Lab tier 1-5 (0 = no lab, returns 0)
 * @param sectorContentTypes - Sector type identifiers present at the lab's location
 * @param elapsedMs - Elapsed time in milliseconds
 * @returns Wissen gained (floored integer)
 */
export function calculateWissenGain(
  labTier: number,
  sectorContentTypes: string[],
  elapsedMs: number,
): number {
  if (labTier <= 0) return 0;
  const baseRatePerHour = RESEARCH_LAB_WISSEN_RATE[labTier] ?? 0;
  if (baseRatePerHour === 0) return 0;

  let multiplier = 1.0;
  for (const contentType of sectorContentTypes) {
    const m = WISSEN_SECTOR_MULTIPLIERS[contentType];
    if (m !== undefined) multiplier *= m;
  }

  const hours = elapsedMs / 3_600_000;
  return Math.floor(baseRatePerHour * multiplier * hours);
}

/**
 * Processes Wissen generation for all players who own research labs.
 * Called once per strategic tick (~60s elapsed).
 *
 * Schema notes:
 * - structures: owner_id, type, sector_x, sector_y, tier
 * - sectors: x, y, type, environment, contents (TEXT[])
 *   (sectors uses x/y, not sector_x/sector_y)
 */
export async function processWissenTick(elapsedMs: number): Promise<void> {
  // Find all research_lab structures with tier > 0
  const { rows: labs } = await query<{
    owner_id: string;
    tier: number;
    sector_x: number;
    sector_y: number;
  }>(
    `SELECT owner_id, tier, sector_x, sector_y
     FROM structures
     WHERE type = 'research_lab' AND tier > 0`,
    [],
  );

  if (labs.length === 0) return;

  for (const lab of labs) {
    try {
      // Get sector type, environment, and contents for multiplier calculation
      // sectors table uses x/y columns (not sector_x/sector_y)
      const { rows: sectorRows } = await query<{
        type: string | null;
        environment: string | null;
        contents: string[] | null;
      }>(
        `SELECT type, environment, contents
         FROM sectors
         WHERE x = $1 AND y = $2
         LIMIT 1`,
        [lab.sector_x, lab.sector_y],
      );

      const contentTypes: string[] = [];
      if (sectorRows[0]) {
        const { type, environment, contents } = sectorRows[0];
        if (type) contentTypes.push(type);
        if (environment && environment !== 'empty') contentTypes.push(environment);
        if (contents && contents.length > 0) {
          for (const c of contents) {
            if (c && !contentTypes.includes(c)) contentTypes.push(c);
          }
        }
      }

      const gain = calculateWissenGain(lab.tier, contentTypes, elapsedMs);
      if (gain > 0) {
        await addWissen(lab.owner_id, gain);
      }
    } catch (err) {
      logger.warn(
        { err, ownerId: lab.owner_id, sectorX: lab.sector_x, sectorY: lab.sector_y },
        'Wissen tick failed for lab',
      );
    }
  }
}
