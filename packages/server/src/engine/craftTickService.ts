import { getAllActiveCraftSites, setCraftProgress, deleteCraftSite } from '../db/craftSiteQueries.js';
import { addWissen, getWissen } from '../db/queries.js';
import { addToInventory } from './inventoryService.js';

export async function processCraftTick(
  notifyPlayer: (playerId: string, event: string, data: any) => void,
): Promise<void> {
  const sites = await getAllActiveCraftSites();
  for (const site of sites) {
    if (site.paused) continue;

    // All resources must be fully deposited before progress starts
    const allDeposited =
      site.deposited_ore >= site.needed_ore &&
      site.deposited_gas >= site.needed_gas &&
      site.deposited_crystal >= site.needed_crystal &&
      site.deposited_credits >= site.needed_credits;
    if (!allDeposited) continue;

    const newProgress = site.progress + 5; // 5 progress per tick
    if (newProgress >= site.duration) {
      // Complete: add module to inventory, award Wissen, clean up
      await addToInventory(site.player_id, 'module', site.module_id, 1);
      await addWissen(site.player_id, 3);
      await deleteCraftSite(site.id);

      const wissen = await getWissen(site.player_id);
      notifyPlayer(site.player_id, 'craftComplete', { moduleId: site.module_id });
      notifyPlayer(site.player_id, 'inventoryUpdated', {});
      notifyPlayer(site.player_id, 'wissenUpdate', { wissen });
      notifyPlayer(site.player_id, 'logEntry', `HERSTELLUNG ABGESCHLOSSEN: ${site.module_id}`);
    } else {
      await setCraftProgress(site.id, newProgress);
    }
  }
}
