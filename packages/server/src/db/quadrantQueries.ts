import { query } from './client.js';
import type { QuadrantData, QuadrantConfig } from '@void-sector/shared';

export async function getQuadrant(qx: number, qy: number): Promise<QuadrantData | null> {
  const { rows } = await query<any>(
    'SELECT * FROM quadrants WHERE qx = $1 AND qy = $2', [qx, qy]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    qx: r.qx, qy: r.qy, seed: r.seed,
    name: r.name, discoveredBy: r.discovered_by,
    discoveredAt: r.discovered_at?.toISOString() ?? null,
    config: r.config as QuadrantConfig,
  };
}

export async function upsertQuadrant(data: QuadrantData): Promise<void> {
  await query(
    `INSERT INTO quadrants (qx, qy, seed, name, discovered_by, discovered_at, config)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (qx, qy) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, quadrants.name),
       discovered_by = COALESCE(quadrants.discovered_by, EXCLUDED.discovered_by),
       config = EXCLUDED.config`,
    [data.qx, data.qy, data.seed, data.name, data.discoveredBy, data.discoveredAt, JSON.stringify(data.config)]
  );
}

export async function getPlayerKnownQuadrants(playerId: string): Promise<Array<{ qx: number; qy: number; learnedAt: string }>> {
  const { rows } = await query<any>(
    'SELECT qx, qy, learned_at FROM player_known_quadrants WHERE player_id = $1', [playerId]
  );
  return rows.map((r: any) => ({ qx: r.qx, qy: r.qy, learnedAt: r.learned_at?.toISOString() ?? '' }));
}

export async function addPlayerKnownQuadrant(playerId: string, qx: number, qy: number): Promise<void> {
  await query(
    `INSERT INTO player_known_quadrants (player_id, qx, qy) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`, [playerId, qx, qy]
  );
}

export async function quadrantNameExists(name: string): Promise<boolean> {
  const { rows } = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM quadrants WHERE LOWER(name) = LOWER($1)', [name]
  );
  return parseInt(rows[0].count) > 0;
}

export async function updateQuadrantName(qx: number, qy: number, name: string): Promise<void> {
  await query('UPDATE quadrants SET name = $1 WHERE qx = $2 AND qy = $3', [name, qx, qy]);
}

export async function getAllDiscoveredQuadrants(): Promise<QuadrantData[]> {
  const { rows } = await query<any>('SELECT * FROM quadrants');
  return rows.map((r: any) => ({
    qx: r.qx, qy: r.qy, seed: r.seed,
    name: r.name, discoveredBy: r.discovered_by,
    discoveredAt: r.discovered_at?.toISOString() ?? null,
    config: r.config as QuadrantConfig,
  }));
}
