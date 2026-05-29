import { query } from './client.js';

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

// ─── category_tech (tier gating #527) ────────────────────────────────────────

/** Returns the player's per-category unlocked-tier map (missing category => caller treats as 1). */
export async function getCategoryTiers(playerId: string): Promise<Record<string, number>> {
  const { rows } = await query<{ category_tech: Record<string, number> }>(
    'SELECT category_tech FROM players WHERE id = $1',
    [playerId],
  );
  return rows[0]?.category_tech ?? {};
}

/** Sets a category's unlocked tier (atomic jsonb_set; category key whitelisted by caller). */
export async function bumpCategoryTier(playerId: string, category: string, newTier: number): Promise<void> {
  await query(
    `UPDATE players SET category_tech = jsonb_set(COALESCE(category_tech, '{}'), $2, to_jsonb($3::int), true) WHERE id = $1`,
    [playerId, `{${category}}`, newTier],
  );
}
