import {
  NPC_PRICES,
  NPC_BUY_SPREAD,
  NPC_SELL_SPREAD,
  NPC_PROCESSED_PRICES,
  NPC_STATION_LEVEL_XP,
  NPC_STATION_MAX_STOCK,
  NPC_STATION_CONSUMPTION,
  NPC_STATION_RESTOCK,
  NPC_STATION_XP_VISIT,
  NPC_STATION_XP_PER_UNIT,
  NPC_STATION_XP_DECAY_PER_HOUR,
  REP_PRICE_MODIFIERS,
} from '@void-sector/shared';
import type { AnyItemType, NpcStationData, NpcStationInventoryItem, ProcessedItemType, ResourceType, ReputationTier } from '@void-sector/shared';

const MS_PER_HOUR = 3_600_000;

/**
 * Returns the base price for any item type (raw resource or processed good).
 */
export function getBasePrice(itemType: AnyItemType): number {
  if (itemType in NPC_PRICES) return NPC_PRICES[itemType as ResourceType];
  return NPC_PROCESSED_PRICES[itemType as ProcessedItemType] ?? 0;
}

/**
 * Compute current stock using lazy evaluation (no server tick required).
 */
export function calculateCurrentStock(
  stock: number,
  maxStock: number,
  consumptionRate: number,
  restockRate: number,
  lastUpdated: number,
  now: number = Date.now(),
): number {
  const elapsedHours = (now - lastUpdated) / MS_PER_HOUR;
  const net = (restockRate - consumptionRate) * elapsedHours;
  return Math.min(maxStock, Math.max(0, Math.round(stock + net)));
}

/**
 * Determine station level from XP.
 */
export function getStationLevel(xp: number): number {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(NPC_STATION_LEVEL_XP)) {
    if (xp >= threshold) level = Number(lvl);
  }
  return level;
}

/**
 * Apply XP decay: stations lose XP slowly when inactive.
 * Returns new XP value.
 */
export function applyXpDecay(xp: number, level: number, lastDecayAt: number, now: number = Date.now()): number {
  const minXp = NPC_STATION_LEVEL_XP[level] ?? 0;
  const elapsedHours = (now - lastDecayAt) / MS_PER_HOUR;
  const decayed = Math.floor(NPC_STATION_XP_DECAY_PER_HOUR * elapsedHours);
  return Math.max(minXp, xp - decayed);
}

/**
 * Build inventory item list for a station based on its level and DB rows.
 * stockMap: { itemType -> { stock, maxStock, consumptionRate, restockRate, lastUpdated } }
 */
export function buildInventoryItems(
  level: number,
  stockMap: Map<string, { stock: number; maxStock: number; consumptionRate: number; restockRate: number; lastUpdated: number }>,
  repTier: ReputationTier,
  now: number = Date.now(),
): NpcStationInventoryItem[] {
  const maxStockForLevel = NPC_STATION_MAX_STOCK[level] ?? {};
  const repMod = REP_PRICE_MODIFIERS[repTier] ?? 1.0;
  const items: NpcStationInventoryItem[] = [];

  for (const [itemType, maxSt] of Object.entries(maxStockForLevel)) {
    const row = stockMap.get(itemType);
    const consumptionRate = NPC_STATION_CONSUMPTION[level]?.[itemType as AnyItemType] ?? 0;
    const restockRate = NPC_STATION_RESTOCK[level]?.[itemType as AnyItemType] ?? 0;

    const currentStock = row
      ? calculateCurrentStock(row.stock, row.maxStock, row.consumptionRate, row.restockRate, row.lastUpdated, now)
      : 0;

    const basePrice = getBasePrice(itemType as AnyItemType);
    const buyPrice = Math.floor(basePrice * NPC_SELL_SPREAD * repMod);   // NPC pays player
    const sellPrice = Math.ceil(basePrice * NPC_BUY_SPREAD * repMod);    // Player pays NPC

    // Stock-level price modifier for buying from player
    const stockRatio = maxSt > 0 ? currentStock / maxSt : 1;
    let adjustedBuyPrice = buyPrice;
    if (stockRatio > 0.7) adjustedBuyPrice = Math.floor(buyPrice * 0.9);     // overstocked → lower buy
    else if (stockRatio < 0.2) adjustedBuyPrice = Math.ceil(buyPrice * 1.2); // scarce → higher buy

    items.push({
      itemType: itemType as AnyItemType,
      stock: currentStock,
      maxStock: maxSt,
      buyPrice: adjustedBuyPrice,
      sellPrice: currentStock > 0 ? sellPrice : 0,
      available: currentStock > 0,
      accepts: currentStock < maxSt,
    });
  }

  return items;
}

/**
 * Calculate XP gains from a trade transaction.
 */
export function calcTradeXp(unitCount: number): number {
  return unitCount * NPC_STATION_XP_PER_UNIT;
}

export { NPC_STATION_XP_VISIT };
