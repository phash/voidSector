import {
  NPC_STATION_LEVELS,
  NPC_XP_DECAY_PER_HOUR,
  NPC_XP_VISIT,
  NPC_XP_PER_TRADE_UNIT,
  NPC_PRICES,
  NPC_BUY_SPREAD,
  NPC_SELL_SPREAD,
  WORLD_SEED,
  RESOURCE_TYPES,
} from '@void-sector/shared';
import type {
  NpcStationData,
  NpcStationInventoryItem,
  MineableResourceType,
} from '@void-sector/shared';
import { hashCoords } from './worldgen.js';
import { getConfig } from './gameConfigApply.js';
import {
  getStationData,
  upsertStationData,
  getStationInventoryItem,
  upsertInventoryItem,
  getStationInventory,
  decrementStationStock,
} from '../db/npcStationQueries.js';

// ---------------------------------------------------------------------------
// Pure functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Derive station level from XP thresholds.
 * Returns the highest level whose xpThreshold is <= the given XP.
 */
export function getStationLevel(xp: number): { level: number; name: string; maxStock: number } {
  let best: (typeof NPC_STATION_LEVELS)[number] = NPC_STATION_LEVELS[0];
  for (const entry of NPC_STATION_LEVELS) {
    if (xp >= entry.xpThreshold) {
      best = entry;
    }
  }
  return { level: best.level, name: best.name, maxStock: best.maxStock };
}

/** Fraction of a surplus resource a visiting trader exports per stop. */
export const TRADER_EXPORT_FRACTION = 0.1;
/** A trader only exports from a resource above this fill ratio (only real surplus). */
export const TRADER_EXPORT_MIN_RATIO = 0.6;

/**
 * BB2 — the economic effect of a trader stopping at a station: it buys/exports
 * some of the station's most-abundant (surplus) resource and carries it off,
 * draining surplus toward scarcity so prices actually move. Pure: returns the
 * resource + amount to remove, or null if nothing is in real surplus.
 */
export function resolveTraderExport(
  items: { itemType: string; stock: number; maxStock: number }[],
): { itemType: string; amount: number } | null {
  let best: { itemType: string; amount: number } | null = null;
  let bestRatio = TRADER_EXPORT_MIN_RATIO;
  for (const it of items) {
    if (it.maxStock <= 0) continue;
    const ratio = it.stock / it.maxStock;
    if (ratio > bestRatio) {
      const amount = Math.max(1, Math.floor(it.stock * TRADER_EXPORT_FRACTION));
      best = { itemType: it.itemType, amount };
      bestRatio = ratio;
    }
  }
  return best;
}

/**
 * Apply a visiting trader's export at a station: read inventory, drain some of the
 * most-surplus resource (BB2 circulation). Returns what was exported, or null.
 */
export async function applyTraderExport(
  stationX: number,
  stationY: number,
): Promise<{ itemType: string; amount: number } | null> {
  const items = await getStationInventory(stationX, stationY);
  if (!items || items.length === 0) return null;
  const exp = resolveTraderExport(
    items.map((i) => ({ itemType: i.itemType, stock: i.stock, maxStock: i.maxStock })),
  );
  if (!exp) return null;
  await decrementStationStock(stationX, stationY, exp.itemType, exp.amount);
  return exp;
}

/**
 * Lazy stock calculation.
 * stock + (restockRate - consumptionRate) * elapsedHours, clamped [0, maxStock].
 */
export function calculateCurrentStock(
  item: NpcStationInventoryItem,
  now: Date = new Date(),
): number {
  const elapsedMs = now.getTime() - new Date(item.lastUpdated).getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  if (elapsedHours <= 0) return item.stock;

  const delta = (item.restockRate - item.consumptionRate) * elapsedHours;
  const newStock = item.stock + delta;
  return Math.max(0, Math.min(item.maxStock, Math.round(newStock)));
}

/**
 * Apply lazy XP decay since last decay timestamp.
 * XP never drops below the current level's threshold.
 */
export function applyXpDecay(station: NpcStationData, now: Date = new Date()): NpcStationData {
  const elapsedMs = now.getTime() - new Date(station.lastXpDecay).getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  if (elapsedHours <= 0) return station;

  const decay =
    ((getConfig('NPC_XP_DECAY_PER_HOUR') as typeof NPC_XP_DECAY_PER_HOUR) ??
      NPC_XP_DECAY_PER_HOUR) * elapsedHours;
  const currentLevel = getStationLevel(station.xp);
  const levelThreshold = NPC_STATION_LEVELS.find(
    (l) => l.level === currentLevel.level,
  )!.xpThreshold;

  const newXp = Math.max(levelThreshold, Math.floor(station.xp - decay));

  return {
    ...station,
    xp: newXp,
    level: getStationLevel(newXp).level,
    lastXpDecay: now.toISOString(),
  };
}

/**
 * Dynamic pricing: at 100% stock => 1x base, at 0% stock => 2x base.
 * Formula: Math.round(basePrice * (2 - stockRatio))
 */
export function calculatePrice(basePrice: number, stockRatio: number): number {
  return Math.round(basePrice * (2 - stockRatio));
}

// ---------------------------------------------------------------------------
// DB-backed functions
// ---------------------------------------------------------------------------

/**
 * Initialise station inventory rows for ore/gas/crystal.
 * Uses hashCoords for deterministic starting stock (50-80% of maxStock, varied per resource).
 */
export async function initStationInventory(x: number, y: number, maxStock: number): Promise<void> {
  const resources: MineableResourceType[] = ['ore', 'gas', 'crystal'];
  const now = new Date().toISOString();

  for (let i = 0; i < resources.length; i++) {
    const res = resources[i];
    // Use a distinct seed per resource type by mixing in the index
    const seed = hashCoords(x + i * 7, y + i * 13, WORLD_SEED);
    const fraction = ((seed >>> 0) % 31) / 30; // 0..1
    const startRatio = 0.5 + fraction * 0.3; // 0.5..0.8
    const startStock = Math.round(maxStock * startRatio);

    // Gas restocks at ~360/hour so the lazy-restock in consumeStationGas keeps up
    // with the fuel engine's consumption rate (1 gas per 10s = 360/hour).
    // Ore/crystal use the slower default rates.
    const restockRate = res === 'gas' ? 360 : maxStock * 0.02;
    const consumptionRate = res === 'gas' ? 0 : maxStock * 0.015;

    await upsertInventoryItem({
      stationX: x,
      stationY: y,
      itemType: res,
      stock: startStock,
      maxStock,
      restockRate,
      consumptionRate,
      lastUpdated: now,
    });
  }
}

/** Megastation XP floor — getStationLevel(MEGASTATION_XP) === level 5. */
const MEGASTATION_XP = 15000;

/**
 * Ensure 0:0 is the galaxy's strong trade station: level 5 (Megastation,
 * maxStock 8000) with ore/gas/crystal seeded. Idempotent — upgrades an
 * existing level-1 Kernwelt row in place. Called at boot and by cleanSlateReset.
 */
export async function ensureOriginTradeStation(): Promise<void> {
  const level = getStationLevel(MEGASTATION_XP); // { level: 5, maxStock: 8000, ... }
  await upsertStationData({
    stationX: 0,
    stationY: 0,
    level: level.level,
    xp: MEGASTATION_XP,
    visitCount: 0,
    tradeVolume: 0,
    lastXpDecay: new Date().toISOString(),
  });
  await initStationInventory(0, 0, level.maxStock);
}

/**
 * Get or initialise a station record. If no DB row exists, creates one
 * from deterministic seed data and also initialises inventory.
 */
export async function getOrInitStation(x: number, y: number): Promise<NpcStationData> {
  const existing = await getStationData(x, y);
  if (existing) {
    // Backfill ore/gas/crystal if station was created without resource inventory
    // (e.g. by the fuel system which only creates a fuel row)
    const inventory = await getStationInventory(x, y);
    const hasResources = RESOURCE_TYPES.every((r) =>
      inventory.some((item) => item.itemType === r),
    );
    if (!hasResources) {
      const level = getStationLevel(existing.xp);
      await initStationInventory(x, y, level.maxStock);
    }
    return existing;
  }

  const level = getStationLevel(0);
  const now = new Date().toISOString();
  const station: NpcStationData = {
    stationX: x,
    stationY: y,
    level: level.level,
    xp: 0,
    visitCount: 0,
    tradeVolume: 0,
    lastXpDecay: now,
  };

  await upsertStationData(station);
  await initStationInventory(x, y, level.maxStock);
  return station;
}

/**
 * Record a player visit: adds NPC_XP_VISIT XP and increments visit count.
 */
export async function recordVisit(x: number, y: number): Promise<void> {
  const station = await getOrInitStation(x, y);
  const decayed = applyXpDecay(station);
  const newXp = decayed.xp + ((getConfig('NPC_XP_VISIT') as typeof NPC_XP_VISIT) ?? NPC_XP_VISIT);
  const newLevel = getStationLevel(newXp);

  await upsertStationData({
    ...decayed,
    xp: newXp,
    level: newLevel.level,
    visitCount: decayed.visitCount + 1,
  });
}

/**
 * Record a trade: adds units * NPC_XP_PER_TRADE_UNIT XP and accumulates trade volume.
 */
export async function recordTrade(x: number, y: number, units: number): Promise<void> {
  const station = await getOrInitStation(x, y);
  const decayed = applyXpDecay(station);
  const newXp =
    decayed.xp +
    units * ((getConfig('NPC_XP_PER_TRADE_UNIT') as typeof NPC_XP_PER_TRADE_UNIT) ?? NPC_XP_PER_TRADE_UNIT);
  const newLevel = getStationLevel(newXp);

  await upsertStationData({
    ...decayed,
    xp: newXp,
    level: newLevel.level,
    tradeVolume: decayed.tradeVolume + units,
  });
}

/**
 * Check whether a player can buy `amount` units of `itemType` from a station.
 * Returns availability info and the total price (using NPC_BUY_SPREAD).
 */
export async function canBuyFromStation(
  x: number,
  y: number,
  itemType: string,
  amount: number,
): Promise<{ ok: boolean; stock: number; price: number }> {
  await getOrInitStation(x, y);
  const item = await getStationInventoryItem(x, y, itemType);
  if (!item) return { ok: false, stock: 0, price: 0 };

  const currentStock = calculateCurrentStock(item);
  const stockRatio = item.maxStock > 0 ? currentStock / item.maxStock : 0;
  const basePrice = NPC_PRICES[itemType as MineableResourceType] ?? 0;
  const dynamicPrice = calculatePrice(basePrice, stockRatio);
  const unitPrice = Math.round(
    dynamicPrice * ((getConfig('NPC_BUY_SPREAD') as typeof NPC_BUY_SPREAD) ?? NPC_BUY_SPREAD),
  );
  const totalPrice = unitPrice * amount;

  return {
    ok: currentStock >= amount,
    stock: currentStock,
    price: totalPrice,
  };
}

/**
 * Check whether a player can sell `amount` units of `itemType` to a station.
 * Returns remaining capacity info and total price (using NPC_SELL_SPREAD).
 */
export async function canSellToStation(
  x: number,
  y: number,
  itemType: string,
  amount: number,
): Promise<{ ok: boolean; capacity: number; price: number; effectiveAmount: number }> {
  await getOrInitStation(x, y);
  const item = await getStationInventoryItem(x, y, itemType);
  if (!item) return { ok: false, capacity: 0, price: 0, effectiveAmount: 0 };

  const currentStock = calculateCurrentStock(item);
  const remainingCapacity = item.maxStock - currentStock;
  const effectiveAmount = Math.min(amount, remainingCapacity);
  const stockRatio = item.maxStock > 0 ? currentStock / item.maxStock : 0;
  const basePrice = NPC_PRICES[itemType as MineableResourceType] ?? 0;
  const dynamicPrice = calculatePrice(basePrice, stockRatio);
  const unitPrice = Math.round(
    dynamicPrice * ((getConfig('NPC_SELL_SPREAD') as typeof NPC_SELL_SPREAD) ?? NPC_SELL_SPREAD),
  );
  const totalPrice = unitPrice * effectiveAmount;

  return {
    ok: effectiveAmount > 0,
    capacity: remainingCapacity,
    price: totalPrice,
    effectiveAmount,
  };
}
