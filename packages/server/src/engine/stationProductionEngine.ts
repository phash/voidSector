import {
  type StationTierConfig,
  type StationProductionState,
  getDistanceTier,
  getTierConfig,
  BASE_ANKAUF_PREISE,
} from '@void-sector/shared';
import type { StationProductionRow } from '../db/stationProductionQueries.js';

export function getScarcityMultiplier(current: number, max: number): number {
  const ratio = max === 0 ? 0 : current / max;
  if (ratio < 0.25) return 1.5;
  if (ratio < 0.5) return 1.2;
  if (ratio < 0.75) return 1.0;
  return 0.8;
}

export function calculatePassiveGen(
  current: { ore: number; gas: number; crystal: number },
  lastTick: Date,
  now: Date,
  tierConfig: StationTierConfig,
): { ore: number; gas: number; crystal: number } {
  const elapsedHours = (now.getTime() - lastTick.getTime()) / 3_600_000;
  const max = tierConfig.maxStockpilePerResource;
  const gen = tierConfig.passiveGenPerHour;
  return {
    ore: Math.min(max, current.ore + gen.ore * elapsedHours),
    gas: Math.min(max, current.gas + gen.gas * elapsedHours),
    crystal: Math.min(max, current.crystal + gen.crystal * elapsedHours),
  };
}

export function advanceProductionQueue(
  row: StationProductionRow,
  tierConfig: StationTierConfig,
  nowMs: number,
): StationProductionRow {
  const result: StationProductionRow = {
    ...row,
    resource_stockpile: { ...row.resource_stockpile },
    finished_goods: { ...row.finished_goods },
  };

  const items = tierConfig.items;

  const tryStart = (): boolean => {
    const item = items[result.queue_index];
    // Don't start if output buffer is already full — skip without consuming resources
    const currentStock = result.finished_goods[item.itemId] ?? 0;
    if (currentStock >= item.maxStock) return false;
    const cost = item.resourceCost;
    const sp = result.resource_stockpile;
    if ((sp.ore ?? 0) < (cost.ore ?? 0)) return false;
    if ((sp.gas ?? 0) < (cost.gas ?? 0)) return false;
    if ((sp.crystal ?? 0) < (cost.crystal ?? 0)) return false;
    result.resource_stockpile = {
      ore: (sp.ore ?? 0) - (cost.ore ?? 0),
      gas: (sp.gas ?? 0) - (cost.gas ?? 0),
      crystal: (sp.crystal ?? 0) - (cost.crystal ?? 0),
    };
    result.current_item_started_at = new Date(nowMs);
    return true;
  };

  if (result.current_item_started_at === null) {
    // Try each item in order, skipping those with full output buffers
    const startIndex = result.queue_index;
    let tried = 0;
    while (tried < items.length) {
      const item = items[result.queue_index];
      const currentStock = result.finished_goods[item.itemId] ?? 0;
      if (currentStock >= item.maxStock) {
        // Output buffer full — advance queue index and try next item
        result.queue_index = (result.queue_index + 1) % items.length;
        tried++;
        if (result.queue_index === startIndex) break; // all items full
        continue;
      }
      tryStart();
      break;
    }
    return result;
  }

  for (let i = 0; i < 100; i++) {
    const item = items[result.queue_index];
    const elapsed = nowMs - result.current_item_started_at!.getTime();
    if (elapsed < item.durationSeconds * 1000) break;

    const current = result.finished_goods[item.itemId] ?? 0;
    if (current < item.maxStock) {
      result.finished_goods[item.itemId] = current + 1;
    }

    result.queue_index = (result.queue_index + 1) % items.length;
    result.current_item_started_at = null;

    // Try each item in order, skipping those with full output buffers
    const startIndex = result.queue_index;
    let tried = 0;
    let started = false;
    while (tried < items.length) {
      const nextItem = items[result.queue_index];
      const nextStock = result.finished_goods[nextItem.itemId] ?? 0;
      if (nextStock >= nextItem.maxStock) {
        result.queue_index = (result.queue_index + 1) % items.length;
        tried++;
        if (result.queue_index === startIndex) break; // all items full
        continue;
      }
      started = tryStart();
      break;
    }
    if (!started) break;
  }

  return result;
}

export function computeStationProductionState(
  row: StationProductionRow,
  x: number,
  y: number,
  level: number,
  nowMs: number,
): { state: StationProductionState; updatedRow: StationProductionRow } {
  const tier = getDistanceTier(x, y);
  const tierConfig = getTierConfig(tier);
  const now = new Date(nowMs);

  const newStockpile = calculatePassiveGen(
    row.resource_stockpile,
    row.passive_gen_last_tick,
    now,
    tierConfig,
  );
  const rowWithGen: StationProductionRow = {
    ...row,
    resource_stockpile: newStockpile,
    passive_gen_last_tick: now,
  };

  const updatedRow = advanceProductionQueue(rowWithGen, tierConfig, nowMs);

  const max = tierConfig.maxStockpilePerResource;
  const sp = updatedRow.resource_stockpile;
  const ankaufPreise = {
    ore: Math.round(BASE_ANKAUF_PREISE.ore * getScarcityMultiplier(sp.ore, max)),
    gas: Math.round(BASE_ANKAUF_PREISE.gas * getScarcityMultiplier(sp.gas, max)),
    crystal: Math.round(BASE_ANKAUF_PREISE.crystal * getScarcityMultiplier(sp.crystal, max)),
  };

  const startIdx =
    updatedRow.current_item_started_at !== null
      ? (updatedRow.queue_index + 1) % tierConfig.items.length
      : updatedRow.queue_index;
  const upcomingQueue: string[] = [];
  for (let i = 0; i < 5; i++) {
    upcomingQueue.push(tierConfig.items[(startIdx + i) % tierConfig.items.length].itemId);
  }

  const kaufPreise: Record<string, number> = {};
  const maxFinishedGoods: Record<string, number> = {};
  for (const item of tierConfig.items) {
    kaufPreise[item.itemId] = item.buyPrice;
    maxFinishedGoods[item.itemId] = item.maxStock;
  }

  const currentItemCfg = tierConfig.items[updatedRow.queue_index];
  const currentItem = updatedRow.current_item_started_at
    ? {
        itemId: currentItemCfg.itemId,
        startedAtMs: updatedRow.current_item_started_at.getTime(),
        durationSeconds: currentItemCfg.durationSeconds,
      }
    : null;

  const state: StationProductionState = {
    sectorX: x,
    sectorY: y,
    level,
    distanceTier: tier,
    moduleTierLabel: tierConfig.moduleTierLabel,
    resourceStockpile: {
      ore: Math.floor(sp.ore),
      gas: Math.floor(sp.gas),
      crystal: Math.floor(sp.crystal),
    },
    maxStockpile: { ore: max, gas: max, crystal: max },
    currentItem,
    upcomingQueue,
    finishedGoods: updatedRow.finished_goods,
    maxFinishedGoods,
    ankaufPreise,
    kaufPreise,
  };

  return { state, updatedRow };
}
