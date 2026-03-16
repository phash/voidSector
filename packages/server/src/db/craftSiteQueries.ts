import { query } from './client.js';

export interface CraftSite {
  id: string;
  player_id: string;
  ship_id: string;
  module_id: string;
  progress: number;
  duration: number;
  needed_ore: number;
  needed_gas: number;
  needed_crystal: number;
  needed_credits: number;
  deposited_ore: number;
  deposited_gas: number;
  deposited_crystal: number;
  deposited_credits: number;
  paused: boolean;
  created_at: Date;
}

export async function createCraftSite(
  playerId: string,
  shipId: string,
  moduleId: string,
  duration: number,
  needed: { ore: number; gas: number; crystal: number; credits: number },
): Promise<CraftSite> {
  const result = await query<CraftSite>(
    `INSERT INTO craft_sites
       (player_id, ship_id, module_id, duration,
        needed_ore, needed_gas, needed_crystal, needed_credits)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [playerId, shipId, moduleId, duration,
     needed.ore, needed.gas, needed.crystal, needed.credits],
  );
  return result.rows[0];
}

export async function getCraftSiteByShipId(shipId: string): Promise<CraftSite | null> {
  const result = await query<CraftSite>(
    'SELECT * FROM craft_sites WHERE ship_id = $1',
    [shipId],
  );
  return result.rows[0] ?? null;
}

export async function getCraftSiteByPlayerId(playerId: string): Promise<CraftSite | null> {
  const result = await query<CraftSite>(
    'SELECT * FROM craft_sites WHERE player_id = $1',
    [playerId],
  );
  return result.rows[0] ?? null;
}

export async function getAllActiveCraftSites(): Promise<CraftSite[]> {
  const result = await query<CraftSite>(
    'SELECT * FROM craft_sites ORDER BY created_at',
  );
  return result.rows;
}

export async function depositCraftResources(
  siteId: string,
  resources: { ore: number; gas: number; crystal: number; credits: number },
): Promise<void> {
  await query(
    `UPDATE craft_sites
     SET deposited_ore     = deposited_ore     + $2,
         deposited_gas     = deposited_gas     + $3,
         deposited_crystal = deposited_crystal + $4,
         deposited_credits = deposited_credits + $5,
         paused = false
     WHERE id = $1`,
    [siteId, resources.ore, resources.gas, resources.crystal, resources.credits],
  );
}

export async function setCraftProgress(siteId: string, progress: number): Promise<void> {
  await query(
    'UPDATE craft_sites SET progress = $2 WHERE id = $1',
    [siteId, progress],
  );
}

export async function markCraftPaused(siteId: string): Promise<void> {
  await query('UPDATE craft_sites SET paused = true WHERE id = $1', [siteId]);
}

export async function deleteCraftSite(siteId: string): Promise<void> {
  await query('DELETE FROM craft_sites WHERE id = $1', [siteId]);
}
