/**
 * ACEP XP Engine
 * Ships accumulate experience across 4 specialisation paths.
 * Budget: 100 XP total, max 50 per path — forces specialisation.
 */

import { query } from '../db/client.js';
import { calculateTraits } from './traitCalculator.js';
import { deductCredits, addCredits, deductWissen } from '../db/queries.js';
import {
  ACEP_BOOST_COST_TIERS,
  getAcepBoostCost,
  type AcepPath,
} from '@void-sector/shared';

// Re-export so existing server imports keep working
export type { AcepPath };
export { ACEP_BOOST_COST_TIERS, getAcepBoostCost };

export const ACEP_PATH_CAP = 50;
export const ACEP_TOTAL_CAP = 100;

export interface AcepXpSummary {
  ausbau: number;
  intel: number;
  kampf: number;
  explorer: number;
  total: number;
}

/**
 * Gameplay bonuses derived from ACEP XP.
 * These are applied on top of faction bonuses.
 */
export interface AcepEffects {
  // AUSBAU — construction & logistics
  extraModuleSlots: number; // 0–4 additional module slots
  cargoMultiplier: number; // 1.0 – 1.5 (cargo capacity multiplier)
  miningBonus: number; // additive fraction for mining rate: 0 – 0.3
  // INTEL — scanning & navigation
  scanRadiusBonus: number; // additional sectors added to scan radius: 0–3
  stalenessMultiplier: number; // how much longer discovered sectors stay fresh: 1.0–2.0
  // KAMPF — combat
  combatDamageBonus: number; // additive faction to combatMultiplier: 0 – 0.2
  shieldRegenBonus: number; // fraction: 0 – 0.3
  // EXPLORER — exploration
  ancientDetection: boolean; // reveals ancient ruin markers on radar
  anomalyChanceBonus: number; // extra probability for anomaly scan events: 0 – 0.1
  helionDecoderEnabled: boolean; // helion decoder without module at 50 XP
  wreckDetection: boolean; // reveals Tier-4/5 wrecks on radar without local scan
}

/** Compute gameplay effects from current ACEP XP (pure, no DB call). */
export function getAcepEffects(xp: AcepXpSummary): AcepEffects {
  const a = xp.ausbau;
  const i = xp.intel;
  const k = xp.kampf;
  const e = xp.explorer;

  return {
    // AUSBAU: slots at 10/25/40/50, cargo grows linearly
    extraModuleSlots: a >= 50 ? 4 : a >= 40 ? 3 : a >= 25 ? 2 : a >= 10 ? 1 : 0,
    cargoMultiplier: 1.0 + a * 0.01, // +1% per XP, max +50% at cap
    miningBonus: a * 0.006, // up to +30% mining rate at cap

    // INTEL: +1 radius at 20 XP, +2 at 40 XP, +3 at 50 XP; staleness doubles at cap
    scanRadiusBonus: i >= 50 ? 3 : i >= 40 ? 2 : i >= 20 ? 1 : 0,
    stalenessMultiplier: 1.0 + i * 0.02, // up to 2.0× at cap

    // KAMPF: damage up to +20%, shield regen up to +30%
    combatDamageBonus: k * 0.004,
    shieldRegenBonus: k * 0.006,

    // EXPLORER: ancient detection at 25 XP, helion decoder at 50 XP
    ancientDetection: e >= 25,
    anomalyChanceBonus: e * 0.002, // up to +0.1 at cap
    helionDecoderEnabled: e >= 50,
    wreckDetection: e >= 25,
  };
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

// Backward-compat alias for server code that imported getBoostCost
export { getAcepBoostCost as getBoostCost };

/**
 * Spend Credits + Wissen to add +5 XP to a specific ACEP path.
 * Returns an error string on failure, undefined on success.
 */
export async function boostAcepPath(
  shipId: string,
  path: AcepPath,
  playerId: string,
): Promise<string | undefined> {
  const xp = await getAcepXpSummary(shipId);
  if (xp.total >= ACEP_TOTAL_CAP) return 'ACEP-Gesamt-Cap erreicht';

  const currentPathXp = xp[path];
  const cost = getAcepBoostCost(currentPathXp);
  if (!cost) return 'Pfad-Cap erreicht';

  const creditsOk = await deductCredits(playerId, cost.credits);
  if (!creditsOk) return 'Zu wenig Credits';

  const wissenOk = await deductWissen(playerId, cost.wissen);
  if (!wissenOk) {
    await addCredits(playerId, cost.credits); // refund credits
    return 'Zu wenig Wissen';
  }

  await addAcepXp(shipId, path, 5);
  return undefined; // success
}
