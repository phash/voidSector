import { query } from './client.js';
import type { WreckItem, WreckSize, WreckStatus, WreckSlateMetadata } from '@void-sector/shared';

export interface WreckRow {
  id: string;
  quadrant_x: number;
  quadrant_y: number;
  sector_x: number;
  sector_y: number;
  tier: number;
  size: WreckSize;
  items: WreckItem[];
  difficulty_modifier: number;
  status: WreckStatus;
  spawned_at: string;
  exhausted_at: string | null;
}

export async function getWreckAtSector(
  sectorX: number,
  sectorY: number,
): Promise<WreckRow | null> {
  const { rows } = await query<WreckRow>(
    `SELECT * FROM wrecks WHERE sector_x = $1 AND sector_y = $2 AND status != 'exhausted' LIMIT 1`,
    [sectorX, sectorY],
  );
  return rows[0] ?? null;
}

export async function getWreckById(wreckId: string): Promise<WreckRow | null> {
  const { rows } = await query<WreckRow>(
    `SELECT * FROM wrecks WHERE id = $1`,
    [wreckId],
  );
  return rows[0] ?? null;
}

export async function getActiveWreckCount(qx: number, qy: number): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM wrecks WHERE quadrant_x = $1 AND quadrant_y = $2 AND status IN ('intact','investigated')`,
    [qx, qy],
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

export async function insertWreck(data: {
  quadrantX: number;
  quadrantY: number;
  sectorX: number;
  sectorY: number;
  tier: number;
  size: WreckSize;
  items: WreckItem[];
}): Promise<WreckRow> {
  const { rows } = await query<WreckRow>(
    `INSERT INTO wrecks (quadrant_x, quadrant_y, sector_x, sector_y, tier, size, items)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.quadrantX, data.quadrantY, data.sectorX, data.sectorY, data.tier, data.size, JSON.stringify(data.items)],
  );
  return rows[0];
}

export async function updateWreckStatus(wreckId: string, status: WreckStatus): Promise<void> {
  const extra = status === 'exhausted' ? ', exhausted_at = NOW()' : '';
  await query(`UPDATE wrecks SET status = $1${extra} WHERE id = $2`, [status, wreckId]);
}

export async function updateWreckItem(
  wreckId: string,
  itemIndex: number,
  salvaged: boolean,
): Promise<void> {
  await query(
    `UPDATE wrecks SET items = jsonb_set(items, $1, $2) WHERE id = $3`,
    [`{${itemIndex},salvaged}`, JSON.stringify(salvaged), wreckId],
  );
}

export async function updateWreckModifier(wreckId: string, modifier: number): Promise<void> {
  await query(`UPDATE wrecks SET difficulty_modifier = $1 WHERE id = $2`, [modifier, wreckId]);
}

export async function pickRandomWreckableSector(
  qx: number,
  qy: number,
): Promise<{ sectorX: number; sectorY: number } | null> {
  // Pick a sector in quadrant with no active wreck, no station/pirate_zone, no star/black_hole
  const { rows } = await query<{ x: number; y: number }>(
    `SELECT s.x, s.y FROM sectors s
     WHERE s.quadrant_x = $1 AND s.quadrant_y = $2
       AND (s.environment_type IS NULL OR s.environment_type NOT IN ('star','black_hole'))
       AND NOT (s.contents @> '["station"]'::jsonb)
       AND NOT (s.contents @> '["pirate_zone"]'::jsonb)
       AND NOT EXISTS (
         SELECT 1 FROM wrecks w
         WHERE w.sector_x = s.x AND w.sector_y = s.y AND w.status != 'exhausted'
       )
     ORDER BY RANDOM() LIMIT 1`,
    [qx, qy],
  );
  if (rows.length === 0) return null;
  return { sectorX: rows[0].x, sectorY: rows[0].y };
}

// Wreck Slate Metadata
export async function insertWreckSlateMetadata(data: WreckSlateMetadata): Promise<void> {
  await query(
    `INSERT INTO wreck_slate_metadata (id, player_id, sector_x, sector_y, sector_type, has_jumpgate, wreck_tier)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [data.id, data.playerId, data.sectorX, data.sectorY, data.sectorType, data.hasJumpgate, data.wreckTier],
  );
}

export async function getWreckSlateMetadata(slateId: string): Promise<WreckSlateMetadata | null> {
  const { rows } = await query<{
    id: string; player_id: string; sector_x: number; sector_y: number;
    sector_type: string | null; has_jumpgate: boolean; wreck_tier: number;
  }>(
    `SELECT * FROM wreck_slate_metadata WHERE id = $1`,
    [slateId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id, playerId: r.player_id, sectorX: r.sector_x, sectorY: r.sector_y,
    sectorType: r.sector_type, hasJumpgate: r.has_jumpgate, wreckTier: r.wreck_tier,
  };
}

export async function deleteWreckSlateMetadata(slateId: string): Promise<void> {
  await query(`DELETE FROM wreck_slate_metadata WHERE id = $1`, [slateId]);
}
