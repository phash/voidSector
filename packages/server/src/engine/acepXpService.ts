/**
 * ACEP XP Engine
 * Ships accumulate experience across 4 specialisation paths.
 * Budget: 100 XP total, max 50 per path — forces specialisation.
 */

import { query } from '../db/db.js';
import { calculateTraits } from './traitCalculator.js';

export type AcepPath = 'ausbau' | 'intel' | 'kampf' | 'explorer';

export const ACEP_PATH_CAP = 50;
export const ACEP_TOTAL_CAP = 100;

export interface AcepXpSummary {
  ausbau: number;
  intel: number;
  kampf: number;
  explorer: number;
  total: number;
}

const COL: Record<AcepPath, string> = {
  ausbau: 'acep_ausbau_xp',
  intel: 'acep_intel_xp',
  kampf: 'acep_kampf_xp',
  explorer: 'acep_explorer_xp',
};

/** Read current ACEP XP for a ship. Returns zeroes if ship not found. */
export async function getAcepXpSummary(shipId: string): Promise<AcepXpSummary> {
  const { rows } = await query<{
    acep_ausbau_xp: number;
    acep_intel_xp: number;
    acep_kampf_xp: number;
    acep_explorer_xp: number;
  }>(
    `SELECT acep_ausbau_xp, acep_intel_xp, acep_kampf_xp, acep_explorer_xp
     FROM ships WHERE id = $1`,
    [shipId],
  );
  if (rows.length === 0) return { ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0 };
  const r = rows[0];
  const ausbau = r.acep_ausbau_xp;
  const intel = r.acep_intel_xp;
  const kampf = r.acep_kampf_xp;
  const explorer = r.acep_explorer_xp;
  return { ausbau, intel, kampf, explorer, total: ausbau + intel + kampf + explorer };
}

/**
 * Add XP to a ship's specialisation path.
 * Respects per-path cap (50) and total cap (100).
 * No-ops silently if caps are already reached.
 */
export async function addAcepXp(shipId: string, path: AcepPath, amount: number): Promise<void> {
  if (amount <= 0) return;
  const current = await getAcepXpSummary(shipId);

  const pathValue = current[path];
  const remaining_path = ACEP_PATH_CAP - pathValue;
  const remaining_total = ACEP_TOTAL_CAP - current.total;
  const effective = Math.min(amount, remaining_path, remaining_total);

  if (effective <= 0) return; // Already capped

  const col = COL[path];
  await query(`UPDATE ships SET ${col} = ${col} + $1 WHERE id = $2`, [effective, shipId]);

  // Recalculate and persist traits after XP change
  const updated = await getAcepXpSummary(shipId);
  const traits = calculateTraits(updated);
  await query(`UPDATE ships SET acep_traits = $1 WHERE id = $2`, [JSON.stringify(traits), shipId]);
}

/**
 * Add ACEP XP for a player's active ship (looks up ship internally).
 * Fire-and-forget safe — call with .catch(() => {}) for non-critical hooks.
 */
export async function addAcepXpForPlayer(
  playerId: string,
  path: AcepPath,
  amount: number,
): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM ships WHERE owner_id = $1 AND active = TRUE LIMIT 1`,
    [playerId],
  );
  if (rows.length === 0) return;
  await addAcepXp(rows[0].id, path, amount);
}
