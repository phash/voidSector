import { query } from './client.js';

export interface TechTreeRow {
  player_id: string;
  researched_nodes: Record<string, number>;
  total_researched: number;
  last_reset_at: string | null;
}

export async function getOrCreateTechTree(playerId: string): Promise<TechTreeRow> {
  const { rows } = await query<TechTreeRow>(
    `INSERT INTO player_tech_tree (player_id)
     VALUES ($1)
     ON CONFLICT (player_id) DO UPDATE SET player_id = player_tech_tree.player_id
     RETURNING *`,
    [playerId],
  );
  return rows[0];
}

export async function saveTechTree(
  playerId: string,
  researchedNodes: Record<string, number>,
  totalResearched: number,
): Promise<void> {
  await query(
    `UPDATE player_tech_tree
     SET researched_nodes = $2, total_researched = $3
     WHERE player_id = $1`,
    [playerId, JSON.stringify(researchedNodes), totalResearched],
  );
}

export async function resetTechTree(playerId: string): Promise<void> {
  await query(
    `UPDATE player_tech_tree
     SET researched_nodes = '{}', total_researched = 0, last_reset_at = NOW()
     WHERE player_id = $1`,
    [playerId],
  );
}
