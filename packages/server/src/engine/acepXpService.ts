/**
 * ACEP XP Engine v2
 * Ships accumulate experience across 7 specialisation paths.
 * Levels 1-10 per path, exponential costs, soft global cap.
 */

import { query } from '../db/client.js';
import { calculateTraits } from './traitCalculator.js';
import { deductCredits, addCredits, deductWissen } from '../db/queries.js';
import {
  ACEP_PATH_CAP,
  ACEP_ALL_PATHS,
  getAcepBoostCost,
  type AcepPath,
} from '@void-sector/shared';

// Re-export so existing server imports keep working
export type { AcepPath };
export { getAcepBoostCost };

export interface AcepXpSummary {
  ausbau: number;
  intel: number;
  kampf: number;
  explorer: number;
  defense: number;
  trader: number;
  miner: number;
  total: number;
}

/**
 * Gameplay bonuses derived from ACEP XP.
 */
export interface AcepEffects {
  extraModuleSlots: number;
  cargoMultiplier: number;
  miningBonus: number;
  scanRadiusBonus: number;
  stalenessMultiplier: number;
  combatDamageBonus: number;
  shieldRegenBonus: number;
  ancientDetection: boolean;
  anomalyChanceBonus: number;
  helionDecoderEnabled: boolean;
  wreckDetection: boolean;
}

export function getAcepEffects(xp: AcepXpSummary): AcepEffects {
  return {
    extraModuleSlots: Math.floor(xp.ausbau / 3),
    cargoMultiplier: 1.0 + xp.ausbau * 0.03,
    miningBonus: xp.miner * 0.03,
    scanRadiusBonus: Math.floor(xp.intel / 3),
    stalenessMultiplier: 1.0 + xp.intel * 0.1,
    combatDamageBonus: xp.kampf * 0.02,
    shieldRegenBonus: xp.defense * 0.03,
    ancientDetection: xp.explorer >= 5,
    anomalyChanceBonus: xp.explorer * 0.01,
    helionDecoderEnabled: xp.explorer >= 10,
    wreckDetection: xp.intel >= 5,
  };
}

/** AUSBAU gating for lab/factory access */
export function getAusbauGating(ausbauLevel: number): {
  maxLabTier: number;
  factoryUnlocked: boolean;
  factorySpeedBonus: number;
} {
  if (ausbauLevel >= 10) return { maxLabTier: 5, factoryUnlocked: true, factorySpeedBonus: 0.5 };
  if (ausbauLevel >= 7) return { maxLabTier: 4, factoryUnlocked: true, factorySpeedBonus: 0.3 };
  if (ausbauLevel >= 5) return { maxLabTier: 3, factoryUnlocked: true, factorySpeedBonus: 0.15 };
  if (ausbauLevel >= 2) return { maxLabTier: 2, factoryUnlocked: true, factorySpeedBonus: 0 };
  return { maxLabTier: 1, factoryUnlocked: false, factorySpeedBonus: 0 };
}

const COL: Record<AcepPath, string> = {
  ausbau: 'acep_ausbau_xp',
  intel: 'acep_intel_xp',
  kampf: 'acep_kampf_xp',
  explorer: 'acep_explorer_xp',
  defense: 'acep_defense_xp',
  trader: 'acep_trader_xp',
  miner: 'acep_miner_xp',
};

const ALL_COLS = Object.values(COL).join(', ');

/** Read current ACEP XP for a ship. Returns zeroes if ship not found. */
export async function getAcepXpSummary(shipId: string): Promise<AcepXpSummary> {
  const { rows } = await query<Record<string, number>>(
    `SELECT ${ALL_COLS} FROM ships WHERE id = $1`,
    [shipId],
  );
  if (rows.length === 0) {
    return { ausbau: 0, intel: 0, kampf: 0, explorer: 0, defense: 0, trader: 0, miner: 0, total: 0 };
  }
  const r = rows[0];
  const ausbau = r.acep_ausbau_xp ?? 0;
  const intel = r.acep_intel_xp ?? 0;
  const kampf = r.acep_kampf_xp ?? 0;
  const explorer = r.acep_explorer_xp ?? 0;
  const defense = r.acep_defense_xp ?? 0;
  const trader = r.acep_trader_xp ?? 0;
  const miner = r.acep_miner_xp ?? 0;
  return {
    ausbau, intel, kampf, explorer, defense, trader, miner,
    total: ausbau + intel + kampf + explorer + defense + trader + miner,
  };
}

/**
 * Add XP to a ship's specialisation path.
 * Respects per-path cap (10 levels).
 */
export async function addAcepXp(shipId: string, path: AcepPath, amount: number): Promise<void> {
  if (amount <= 0) return;
  const current = await getAcepXpSummary(shipId);

  const pathValue = current[path];
  const remaining = ACEP_PATH_CAP - pathValue;
  const effective = Math.min(amount, remaining);

  if (effective <= 0) return;

  const col = COL[path];
  await query(`UPDATE ships SET ${col} = ${col} + $1 WHERE id = $2`, [effective, shipId]);

  // Recalculate and persist traits after XP change
  const updated = await getAcepXpSummary(shipId);
  const traits = calculateTraits(updated);
  await query(`UPDATE ships SET acep_traits = $1 WHERE id = $2`, [JSON.stringify(traits), shipId]);
}

/**
 * Add ACEP XP for a player's active ship.
 * Fire-and-forget safe.
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

// Backward-compat alias
export { getAcepBoostCost as getBoostCost };

/**
 * Spend Credits + Wissen to add +1 level to a specific ACEP path.
 * Exponential costs with soft global cap.
 */
export async function boostAcepPath(
  shipId: string,
  path: AcepPath,
  playerId: string,
): Promise<string | undefined> {
  const xp = await getAcepXpSummary(shipId);
  const currentLevel = xp[path];

  const cost = getAcepBoostCost(currentLevel, xp.total);
  if (!cost) return 'Pfad-Cap erreicht (Level 10)';

  const creditsOk = await deductCredits(playerId, cost.credits);
  if (!creditsOk) return `Zu wenig Credits (${cost.credits} benötigt)`;

  const wissenOk = await deductWissen(playerId, cost.wissen);
  if (!wissenOk) {
    await addCredits(playerId, cost.credits); // refund
    return `Zu wenig Wissen (${cost.wissen} benötigt)`;
  }

  await addAcepXp(shipId, path, 1);
  return undefined;
}
