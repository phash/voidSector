import {
  getAllConstructionSites,
  setProgress,
  markPaused,
  deleteConstructionSiteById,
} from '../db/constructionQueries.js';
import { createStructure, insertPlayerJumpGate, upgradeJumpGate } from '../db/queries.js';
import { insertPlayerStation } from '../db/stationQueries.js';
import { sectorToQuadrant } from './quadrantEngine.js';
import { logger } from '../utils/logger.js';
import { constructionBus } from '../constructionBus.js';

function resourcesNeededAt(progress: number, total: number): number {
  return Math.ceil((progress * total) / 100);
}

export async function processConstructionTick(): Promise<void> {
  const sites = await getAllConstructionSites();
  if (sites.length === 0) return;

  for (const site of sites) {
    const nextProgress = site.progress + 1;
    const oreNeeded      = resourcesNeededAt(nextProgress, site.needed_ore);
    const gasNeeded      = resourcesNeededAt(nextProgress, site.needed_gas);
    const crystalNeeded  = resourcesNeededAt(nextProgress, site.needed_crystal);
    const creditsNeeded  = resourcesNeededAt(nextProgress, site.needed_credits);
    const artefactNeeded = resourcesNeededAt(nextProgress, site.needed_artefact);

    const hasResources =
      site.deposited_ore      >= oreNeeded &&
      site.deposited_gas      >= gasNeeded &&
      site.deposited_crystal  >= crystalNeeded &&
      site.deposited_credits  >= creditsNeeded &&
      site.deposited_artefact >= artefactNeeded;

    if (!hasResources) {
      if (!site.paused) await markPaused(site.id);
      continue;
    }

    if (nextProgress >= 100) {
      try {
        await completeConstruction(site);
        await deleteConstructionSiteById(site.id);
        constructionBus.emit('completed', {
          siteId: site.id,
          sectorX: site.sector_x,
          sectorY: site.sector_y,
          type: site.type,
          ownerId: site.owner_id,
          metadata: site.metadata,
        });
        logger.info(
          { type: site.type, x: site.sector_x, y: site.sector_y },
          'Construction complete',
        );
      } catch (err: any) {
        if (err.code === '23505') {
          await deleteConstructionSiteById(site.id);
          logger.warn({ siteId: site.id }, 'Construction complete: already existed');
        } else {
          logger.error({ err, siteId: site.id }, 'Failed to complete construction');
        }
      }
      continue;
    }

    await setProgress(site.id, nextProgress);
  }
}

async function completeConstruction(site: {
  owner_id: string;
  type: string;
  sector_x: number;
  sector_y: number;
  metadata: Record<string, any> | null;
}): Promise<void> {
  const { type, owner_id, sector_x, sector_y, metadata } = site;

  if (type === 'jumpgate') {
    const gateId = `pgate_${sector_x}_${sector_y}`;
    await insertPlayerJumpGate({ id: gateId, sectorX: sector_x, sectorY: sector_y, ownerId: owner_id });
    return;
  }

  if (type === 'station') {
    const { qx, qy } = sectorToQuadrant(sector_x, sector_y);
    await insertPlayerStation(owner_id, sector_x, sector_y, qx, qy);
    return;
  }

  // Jumpgate upgrades: jumpgate_conn_2, jumpgate_conn_3, jumpgate_dist_2, jumpgate_dist_3
  const upgradeMatch = type.match(/^jumpgate_(conn|dist)_(\d+)$/);
  if (upgradeMatch && metadata?.gateId) {
    const field = upgradeMatch[1] === 'conn' ? 'level_connection' : 'level_distance';
    const level = parseInt(upgradeMatch[2], 10);
    await upgradeJumpGate(metadata.gateId, field, level);
    return;
  }

  // Default: create structure (mining_station, etc.)
  await createStructure(owner_id, type, sector_x, sector_y);
}
