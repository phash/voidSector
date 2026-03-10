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
import {
  getStationData,
  upsertStationData,
  getStationInventoryItem,
  upsertInventoryItem,
  getStationInventory,
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

  const decay = NPC_XP_DECAY_PER_HOUR * elapsedHours;
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

    // Restock and consumption rates: restock slightly > consumption so stations
    // tend to slowly fill up when left alone.
    const baseRestock = maxStock * 0.02; // 2% of max per hour
    const baseConsumption = maxStock * 0.015; // 1.5% of max per hour

    await upsertInventoryItem({
      stationX: x,
      stationY: y,
      itemType: res,
      stock: startStock,
      maxStock,
      restockRate: baseRestock,
      consumptionRate: baseConsumption,
      lastUpdated: now,
    });
  }
}

/**
 * Get or initialise a station record. If no DB row exists, creates one
 * from deterministic seed data and also initialises inventory.
 */
export async function getOrInitStation(x: number, y: number): Promise<NpcStationData> {
  const existing = await getStationData(x, y);
  if (existing) return existing;

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
  const newXp = decayed.xp + NPC_XP_VISIT;
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
  const newXp = decayed.xp + units * NPC_XP_PER_TRADE_UNIT;
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
  const unitPrice = Math.round(dynamicPrice * NPC_BUY_SPREAD);
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
  const unitPrice = Math.round(dynamicPrice * NPC_SELL_SPREAD);
  const totalPrice = unitPrice * effectiveAmount;

  return {
    ok: effectiveAmount > 0,
    capacity: remainingCapacity,
    price: totalPrice,
    effectiveAmount,
  };
}
