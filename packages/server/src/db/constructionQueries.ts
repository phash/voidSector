import { query } from './client.js';

export interface ConstructionSite {
  id: string;
  owner_id: string;
  type: string;
  sector_x: number;
  sector_y: number;
  progress: number;
  needed_ore: number;
  needed_gas: number;
  needed_crystal: number;
  needed_credits: number;
  needed_artefact: number;
  deposited_ore: number;
  deposited_gas: number;
  deposited_crystal: number;
  deposited_credits: number;
  deposited_artefact: number;
  paused: boolean;
  metadata: Record<string, any> | null;
  created_at: Date;
}

export async function createConstructionSite(
  ownerId: string,
  type: string,
  sectorX: number,
  sectorY: number,
  costs: {
    ore?: number;
    gas?: number;
    crystal?: number;
    credits?: number;
    artefact?: number;
  },
  metadata?: Record<string, any>,
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO construction_sites
       (owner_id, type, sector_x, sector_y,
        needed_ore, needed_gas, needed_crystal, needed_credits, needed_artefact,
        metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      ownerId, type, sectorX, sectorY,
      costs.ore ?? 0, costs.gas ?? 0, costs.crystal ?? 0,
      costs.credits ?? 0, costs.artefact ?? 0,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
  return result.rows[0].id;
}

export async function getConstructionSite(
  sectorX: number,
  sectorY: number,
): Promise<ConstructionSite | null> {
  const result = await query<ConstructionSite>(
    'SELECT * FROM construction_sites WHERE sector_x=$1 AND sector_y=$2',
    [sectorX, sectorY],
  );
  return result.rows[0] ?? null;
}

export async function getConstructionSiteById(id: string): Promise<ConstructionSite | null> {
  const result = await query<ConstructionSite>(
    'SELECT * FROM construction_sites WHERE id=$1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getAllConstructionSites(): Promise<ConstructionSite[]> {
  const result = await query<ConstructionSite>(
    'SELECT * FROM construction_sites ORDER BY created_at',
  );
  return result.rows;
}

export async function depositResources(
  siteId: string,
  ore: number,
  gas: number,
  crystal: number,
  credits: number,
  artefact: number,
): Promise<void> {
  await query(
    `UPDATE construction_sites
     SET deposited_ore     = deposited_ore     + $2,
         deposited_gas     = deposited_gas     + $3,
         deposited_crystal = deposited_crystal + $4,
         deposited_credits = deposited_credits + $5,
         deposited_artefact= deposited_artefact+ $6,
         paused = false
     WHERE id = $1`,
    [siteId, ore, gas, crystal, credits, artefact],
  );
}

export async function setProgress(siteId: string, newProgress: number): Promise<void> {
  await query(
    'UPDATE construction_sites SET progress=$2, paused=false WHERE id=$1',
    [siteId, newProgress],
  );
}

export async function markPaused(siteId: string): Promise<void> {
  await query('UPDATE construction_sites SET paused=true WHERE id=$1', [siteId]);
}

export async function deleteConstructionSiteById(id: string): Promise<void> {
  await query('DELETE FROM construction_sites WHERE id=$1', [id]);
}
