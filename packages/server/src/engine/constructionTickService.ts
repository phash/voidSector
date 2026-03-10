import {
  getAllConstructionSites,
  setProgress,
  markPaused,
  deleteConstructionSiteById,
} from '../db/constructionQueries.js';
import { createStructure } from '../db/queries.js';
import { logger } from '../utils/logger.js';

/**
 * Completions emitted by the current tick. SectorRoom reads and clears this
 * array after calling processConstructionTick() in each universe tick.
 */
export const constructionCompletions: Array<{
  siteId: string;
  sectorX: number;
  sectorY: number;
}> = [];

function resourcesNeededAt(progress: number, total: number): number {
  return Math.ceil((progress * total) / 100);
}

export async function processConstructionTick(): Promise<void> {
  const sites = await getAllConstructionSites();
  if (sites.length === 0) return;

  for (const site of sites) {
    const nextProgress = site.progress + 1;
    const oreNeeded     = resourcesNeededAt(nextProgress, site.needed_ore);
    const gasNeeded     = resourcesNeededAt(nextProgress, site.needed_gas);
    const crystalNeeded = resourcesNeededAt(nextProgress, site.needed_crystal);

    const hasResources =
      site.deposited_ore     >= oreNeeded &&
      site.deposited_gas     >= gasNeeded &&
      site.deposited_crystal >= crystalNeeded;

    if (!hasResources) {
      if (!site.paused) await markPaused(site.id);
      continue;
    }

    if (nextProgress >= 100) {
      try {
        await createStructure(
          site.owner_id,
          site.type,
          site.sector_x,
          site.sector_y,
        );
        constructionCompletions.push({
          siteId: site.id,
          sectorX: site.sector_x,
          sectorY: site.sector_y,
        });
        await deleteConstructionSiteById(site.id);
        logger.info(
          { type: site.type, x: site.sector_x, y: site.sector_y },
          'Construction complete',
        );
      } catch (err: any) {
        if (err.code === '23505') {
          // Duplicate structure — delete site anyway
          await deleteConstructionSiteById(site.id);
          logger.warn({ siteId: site.id }, 'Construction complete: structure already existed');
        } else {
          logger.error({ err, siteId: site.id }, 'Failed to complete construction');
        }
      }
      continue;
    }

    await setProgress(site.id, nextProgress);
  }
}
