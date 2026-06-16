/**
 * Headless action-cores for ship automation.
 * Pure-ish functions (playerId, args) => Promise<CoreResult> that
 * read/write Redis + Postgres WITHOUT a Colyseus client.
 * Combat is intentionally excluded from the MVP.
 */
import { calculateCurrentAP } from '../ap.js';
import {
  getPlayerPosition,
  savePlayerPosition,
  getAPState,
  saveAPState,
  getFuelState,
  saveFuelState,
} from '../../rooms/services/RedisAPStore.js';
import {
  getActiveShip,
  getSector,
  saveSector,
  addDiscovery,
  updateSectorResources,
  addCredits,
} from '../../db/queries.js';
import {
  getStationData,
  getStationInventoryItem,
  upsertInventoryItem,
} from '../../db/npcStationQueries.js';
import { generateSector } from '../worldgen.js';
import { calculateShipStats } from '@void-sector/shared';
import {
  getCargoState,
  getResourceTotal,
  addToInventory,
  removeFromInventory,
} from '../inventoryService.js';
import {
  canSellToStation,
  calculateCurrentStock,
  recordTrade,
} from '../npcStationEngine.js';

/** AP cost for a local sector scan — mirrors AP_COSTS_LOCAL_SCAN from shared. */
const SCAN_AP_COST = 1;

// ─── Result types ─────────────────────────────────────────────────────────────

export type CoreOk<T extends object> = { ok: true } & T;
export type CorePause = { ok: false; reason: string };
export type CoreResult<T extends object = object> = CoreOk<T> | CorePause;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the sign of n: -1, 0, or 1. */
function sign(n: number): number {
  return n < 0 ? -1 : n > 0 ? 1 : 0;
}

/** Load ship + compute stats in one go. */
async function shipStats(playerId: string) {
  const ship = await getActiveShip(playerId);
  const modules = ship?.modules ?? [];
  return calculateShipStats(modules);
}

/** Ensure a sector exists in DB (generate + save if missing). */
async function ensureSector(x: number, y: number, playerId: string) {
  let sector = await getSector(x, y);
  if (!sector) {
    sector = generateSector(x, y, playerId);
    await saveSector(sector);
  }
  return sector;
}

// ─── coreMoveOneSector ────────────────────────────────────────────────────────

export type MoveResult = CoreResult<{ x: number; y: number; arrived: boolean }>;

/**
 * Steps the player one sector toward (targetX, targetY).
 * Spends apCostJump AP and fuelPerJump fuel.
 * If already at target, returns arrived:true without spending resources.
 */
export async function coreMoveOneSector(
  playerId: string,
  targetX: number,
  targetY: number,
): Promise<MoveResult> {
  const pos = await getPlayerPosition(playerId);
  const curX = pos?.x ?? 0;
  const curY = pos?.y ?? 0;

  // Already there — no-op
  if (curX === targetX && curY === targetY) {
    return { ok: true, x: curX, y: curY, arrived: true };
  }

  const [stats, apState, fuel] = await Promise.all([
    shipStats(playerId),
    getAPState(playerId),
    getFuelState(playerId),
  ]);

  const apCost = stats.apCostJump ?? 1;
  const fuelCost = stats.fuelPerJump ?? 10;
  const currentFuel = fuel ?? 0;

  // Check resources before spending
  const updatedAP = calculateCurrentAP(apState);
  if (updatedAP.current < apCost) {
    return { ok: false, reason: `Zu wenig AP (benötigt ${apCost}, vorhanden ${updatedAP.current})` };
  }
  if (currentFuel < fuelCost) {
    return { ok: false, reason: `Treibstoff reicht nicht (benötigt ${fuelCost}, vorhanden ${currentFuel})` };
  }

  // Step one sector toward target (Chebyshev / cardinal + diagonal)
  const dx = sign(targetX - curX);
  const dy = sign(targetY - curY);
  const newX = curX + dx;
  const newY = curY + dy;

  // Spend AP
  const newAP = { ...updatedAP, current: updatedAP.current - apCost };

  // Ensure destination sector exists
  await ensureSector(newX, newY, playerId);

  // Persist all side-effects
  await Promise.all([
    savePlayerPosition(playerId, newX, newY),
    saveAPState(playerId, newAP),
    saveFuelState(playerId, currentFuel - fuelCost),
    addDiscovery(playerId, newX, newY),
  ]);

  const arrived = newX === targetX && newY === targetY;
  return { ok: true, x: newX, y: newY, arrived };
}

// ─── coreScan ─────────────────────────────────────────────────────────────────

export type ScanResult = CoreResult<{
  sectorType: string;
  resources: { ore: number; gas: number; crystal: number };
}>;

/**
 * Scans the player's current sector.
 * Spends AP_COSTS_LOCAL_SCAN AP and returns sector resources.
 */
export async function coreScan(playerId: string): Promise<ScanResult> {
  const [pos, apState] = await Promise.all([
    getPlayerPosition(playerId),
    getAPState(playerId),
  ]);

  const x = pos?.x ?? 0;
  const y = pos?.y ?? 0;

  const updatedAP = calculateCurrentAP(apState);
  if (updatedAP.current < SCAN_AP_COST) {
    return {
      ok: false,
      reason: `Zu wenig AP für Scan (benötigt ${SCAN_AP_COST}, vorhanden ${updatedAP.current})`,
    };
  }

  const newAP = { ...updatedAP, current: updatedAP.current - SCAN_AP_COST };

  const sector = await ensureSector(x, y, playerId);
  const resources = sector.resources ?? { ore: 0, gas: 0, crystal: 0 };

  await Promise.all([
    saveAPState(playerId, newAP),
    addDiscovery(playerId, x, y),
  ]);

  return {
    ok: true,
    sectorType: sector.type,
    resources: {
      ore: resources.ore,
      gas: resources.gas,
      crystal: resources.crystal,
    },
  };
}

// ─── coreMine ─────────────────────────────────────────────────────────────────

export type MineResult = CoreResult<{ mined: number }>;

/** Mining mode: fill cargo to capacity, or extract a fixed amount. */
export type MineMode = 'until_full' | 'amount';

/**
 * Mines resources from the player's current sector.
 * Does NOT consume AP/fuel — mining is a manual action step only.
 * Loops ore → gas → crystal, taking as much as cargo space allows (and amount
 * cap allows in 'amount' mode).
 */
export async function coreMine(
  playerId: string,
  mode: MineMode,
  amount: number,
): Promise<MineResult> {
  const [pos, stats, resourceTotal] = await Promise.all([
    getPlayerPosition(playerId),
    shipStats(playerId),
    getResourceTotal(playerId),
  ]);

  const x = pos?.x ?? 0;
  const y = pos?.y ?? 0;
  const cargoCap = stats.cargoCap ?? 20;
  let space = cargoCap - resourceTotal;

  if (space <= 0) {
    return { ok: false, reason: 'Frachtraum voll' };
  }

  if (mode === 'amount') {
    space = Math.min(space, amount);
  }

  const sector = await ensureSector(x, y, playerId);
  const res = { ...( sector.resources ?? { ore: 0, gas: 0, crystal: 0 }) };

  const resourceOrder: Array<'ore' | 'gas' | 'crystal'> = ['ore', 'gas', 'crystal'];
  let totalMined = 0;

  for (const r of resourceOrder) {
    if (space <= 0) break;
    const avail = res[r] ?? 0;
    if (avail <= 0) continue;

    const take = Math.min(avail, space);
    res[r] -= take;
    space -= take;
    totalMined += take;

    await addToInventory(playerId, 'resource', r, take);
    await updateSectorResources(x, y, res, r);
  }

  return { ok: true, mined: totalMined };
}

// ─── coreSell ─────────────────────────────────────────────────────────────────

export type SellMode = 'all';
export type SellResult = CoreResult<{ credits: number }>;

/**
 * Sells the player's cargo resources at the NPC station in the current sector.
 * Uses the same canSellToStation / price logic as EconomyService.handleNpcTrade
 * so prices are always consistent.
 *
 * Implementation note: sell logic is inlined here (not extracted from EconomyService)
 * to avoid altering the Colyseus-coupled service class and risking regressions.
 * Both paths call the same underlying npcStationEngine functions so prices match.
 */
export async function coreSell(playerId: string, _mode: SellMode): Promise<SellResult> {
  const pos = await getPlayerPosition(playerId);
  const sx = pos?.x ?? 0;
  const sy = pos?.y ?? 0;

  // Check that a station exists at this sector
  const station = await getStationData(sx, sy);
  if (!station) {
    return { ok: false, reason: 'Keine Station hier zum Verkaufen' };
  }

  const cargo = await getCargoState(playerId);
  const resources: Array<'ore' | 'gas' | 'crystal'> = ['ore', 'gas', 'crystal'];

  let totalCredits = 0;

  for (const r of resources) {
    const qty = cargo[r] ?? 0;
    if (qty <= 0) continue;

    const sellCheck = await canSellToStation(sx, sy, r, qty);
    if (!sellCheck.ok) continue;

    const effectiveAmount = sellCheck.effectiveAmount;
    await removeFromInventory(playerId, 'resource', r, effectiveAmount);

    // Update station stock
    const invItem = await getStationInventoryItem(sx, sy, r);
    if (invItem) {
      const currentStock = calculateCurrentStock(invItem);
      invItem.stock = Math.min(currentStock + effectiveAmount, invItem.maxStock);
      invItem.lastUpdated = new Date().toISOString();
      await upsertInventoryItem(invItem);
    }

    await addCredits(playerId, sellCheck.price);
    totalCredits += sellCheck.price;
    recordTrade(sx, sy, effectiveAmount).catch(() => {});
  }

  return { ok: true, credits: totalCredits };
}
