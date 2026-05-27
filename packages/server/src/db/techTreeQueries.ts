import { query } from './client.js';

export interface TechTreeRow {
  player_id: string;
  researched_nodes: Record<string, number>;
  total_researched: number;
  last_reset_at: string | null;
}

// ─── player_research_v2 ───────────────────────────────────────────────────────

export async function getPlayerResearchV2(playerId: string): Promise<string[]> {
  const { rows } = await query(
    'SELECT node_id FROM player_research_v2 WHERE player_id = $1',
    [playerId],
  );
  return rows.map((r: any) => r.node_id);
}

export async function addPlayerResearchV2(playerId: string, nodeId: string): Promise<void> {
  await query(
    `INSERT INTO player_research_v2 (player_id, node_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [playerId, nodeId],
  );
}

// ─── player_modules_v2 ───────────────────────────────────────────────────────

export async function getPlayerModulesV2(playerId: string): Promise<Array<{
  id: number; moduleId: string; slot: string; currentHp: number; installed: boolean;
}>> {
  const { rows } = await query<{
    id: number; moduleId: string; slot: string; currentHp: number; installed: boolean;
  }>(
    'SELECT id, module_id as "moduleId", slot, current_hp as "currentHp", installed FROM player_modules_v2 WHERE player_id = $1 ORDER BY slot',
    [playerId],
  );
  return rows;
}

export async function installPlayerModule(
  playerId: string, moduleId: string, slot: string, maxHp: number,
): Promise<void> {
  await query(
    `INSERT INTO player_modules_v2 (player_id, module_id, slot, current_hp)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (player_id, slot) DO UPDATE SET module_id = $2, current_hp = $4, installed = TRUE`,
    [playerId, moduleId, slot, maxHp],
  );
}

export async function removePlayerModule(playerId: string, slot: string): Promise<void> {
  await query(
    'DELETE FROM player_modules_v2 WHERE player_id = $1 AND slot = $2',
    [playerId, slot],
  );
}

export async function updateModuleHp(playerId: string, slot: string, hp: number): Promise<void> {
  await query(
    'UPDATE player_modules_v2 SET current_hp = $3 WHERE player_id = $1 AND slot = $2',
    [playerId, slot, hp],
  );
}

export async function setAllModulesHpPercent(playerId: string, percent: number): Promise<void> {
  await query(
    `UPDATE player_modules_v2 SET current_hp = GREATEST(0, FLOOR(current_hp * $2))
     WHERE player_id = $1`,
    [playerId, percent],
  );
}

// ─── legacy player_tech_tree ─────────────────────────────────────────────────

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
