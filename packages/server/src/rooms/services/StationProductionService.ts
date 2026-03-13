import type { Client } from 'colyseus';
import type { Room } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { ItemType } from '@void-sector/shared';
import { getDistanceTier, getTierConfig } from '@void-sector/shared';
import {
  getOrCreateStationProduction,
  saveStationProduction,
} from '../../db/stationProductionQueries.js';
import { computeStationProductionState } from '../../engine/stationProductionEngine.js';
import {
  getOrInitStation,
  getStationLevel,
} from '../../engine/npcStationEngine.js';
import {
  getPlayerCredits,
  addCredits,
  deductCredits,
} from '../../db/queries.js';
import {
  addToInventory,
  removeFromInventory,
  canAddResource,
  getInventoryItem,
  getCargoState,
} from '../../engine/inventoryService.js';
import { getFuelState, saveFuelState } from './RedisAPStore.js';
import { pool } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

const VALID_ORE_RESOURCES = ['ore', 'gas', 'crystal'] as const;
type OreResource = (typeof VALID_ORE_RESOURCES)[number];

function isOreResource(id: string): id is OreResource {
  return VALID_ORE_RESOURCES.includes(id as OreResource);
}

export class StationProductionService {
  constructor(private ctx: ServiceContext) {}

  registerHandlers(room: Room): void {
    room.onMessage('getStationProduction', (client) => {
      this.handleGet(client).catch((err) => {
        logger.error({ err }, 'getStationProduction error');
        client.send('actionError', { code: 'INTERNAL', message: 'Server error' });
      });
    });

    room.onMessage(
      'buyFromStation',
      (client, msg: { itemId: string; quantity: number }) => {
        this.handleBuy(client, msg).catch((err) => {
          logger.error({ err }, 'buyFromStation error');
          client.send('actionError', { code: 'INTERNAL', message: 'Server error' });
        });
      },
    );

    room.onMessage(
      'sellToStation',
      (client, msg: { itemId: string; quantity: number }) => {
        this.handleSell(client, msg).catch((err) => {
          logger.error({ err }, 'sellToStation error');
          client.send('actionError', { code: 'INTERNAL', message: 'Server error' });
        });
      },
    );
  }

  private async handleGet(client: Client): Promise<void> {
    if (this.ctx._pst(client.sessionId) !== 'station') return;
    if (!this.ctx.checkRate(client.sessionId, 'stationGet', 1000)) return;

    const x = this.ctx._px(client.sessionId);
    const y = this.ctx._py(client.sessionId);

    const row = await getOrCreateStationProduction(pool, x, y);
    const station = await getOrInitStation(x, y);
    const level = getStationLevel(station.xp).level;
    const { state, updatedRow } = computeStationProductionState(row, x, y, level, Date.now());

    await saveStationProduction(pool, x, y, {
      resource_stockpile: updatedRow.resource_stockpile,
      passive_gen_last_tick: updatedRow.passive_gen_last_tick,
      queue_index: updatedRow.queue_index,
      current_item_started_at: updatedRow.current_item_started_at,
      finished_goods: updatedRow.finished_goods,
    });

    client.send('stationProductionUpdate', state);
  }

  private async handleBuy(
    client: Client,
    msg: { itemId: string; quantity: number },
  ): Promise<void> {
    if (this.ctx._pst(client.sessionId) !== 'station') return;
    if (!this.ctx.checkRate(client.sessionId, 'stationBuy', 500)) return;

    const x = this.ctx._px(client.sessionId);
    const y = this.ctx._py(client.sessionId);
    const auth = client.auth as AuthPayload;
    const playerId = auth.userId;

    const { itemId, quantity } = msg;
    if (!itemId || !Number.isInteger(quantity) || quantity <= 0) {
      client.send('actionError', { code: 'INVALID', message: 'Invalid buy parameters' });
      return;
    }

    const tier = getDistanceTier(x, y);
    const tierConfig = getTierConfig(tier);
    const itemCfg = tierConfig.items.find((i) => i.itemId === itemId);
    if (!itemCfg) {
      client.send('actionError', { code: 'INVALID', message: 'Item not available at this station' });
      return;
    }

    // Load production state
    const row = await getOrCreateStationProduction(pool, x, y);
    const station = await getOrInitStation(x, y);
    const level = getStationLevel(station.xp).level;
    const { state, updatedRow } = computeStationProductionState(row, x, y, level, Date.now());

    // Check finished goods availability
    const available = state.finishedGoods[itemId] ?? 0;
    if (available < quantity) {
      client.send('actionError', {
        code: 'INSUFFICIENT_STOCK',
        message: `Only ${available} available`,
      });
      return;
    }

    // Calculate total cost
    const totalCost = itemCfg.buyPrice * quantity;
    const credits = await getPlayerCredits(playerId);
    if (credits < totalCost) {
      client.send('actionError', {
        code: 'INSUFFICIENT_CREDITS',
        message: `Need ${totalCost} credits, have ${credits}`,
      });
      return;
    }

    // Fuel special case: goes to Redis fuel state, not inventory
    if (itemId === 'fuel') {
      const ship = this.ctx.getShipForClient(client.sessionId);
      const currentFuel = (await getFuelState(playerId)) ?? 0;
      const tankSpace = ship.fuelMax - currentFuel;
      if (tankSpace <= 0) {
        client.send('actionError', { code: 'CARGO_FULL', message: 'Fuel tank is full' });
        return;
      }
      const effectiveQuantity = Math.min(quantity, tankSpace);
      const effectiveCost = itemCfg.buyPrice * effectiveQuantity;

      const deducted = await deductCredits(playerId, effectiveCost);
      if (!deducted) {
        client.send('actionError', { code: 'INSUFFICIENT_CREDITS', message: 'Insufficient credits' });
        return;
      }

      const newFuel = currentFuel + effectiveQuantity;
      await saveFuelState(playerId, newFuel);

      const newFinishedGoods = { ...updatedRow.finished_goods };
      newFinishedGoods[itemId] = Math.max(0, (newFinishedGoods[itemId] ?? 0) - effectiveQuantity);
      updatedRow.finished_goods = newFinishedGoods;

      await saveStationProduction(pool, x, y, {
        resource_stockpile: updatedRow.resource_stockpile,
        passive_gen_last_tick: updatedRow.passive_gen_last_tick,
        queue_index: updatedRow.queue_index,
        current_item_started_at: updatedRow.current_item_started_at,
        finished_goods: updatedRow.finished_goods,
      });

      const newCredits = await getPlayerCredits(playerId);
      client.send('stationProductionUpdate', state);
      client.send('creditsUpdate', { credits: newCredits });
      client.send('fuelUpdate', { current: newFuel, max: ship.fuelMax });
      return;
    }

    // Check cargo capacity for resource-type items
    const itemType: ItemType = itemCfg.category === 'MODULE' ? 'module' : 'resource';
    if (itemType === 'resource') {
      const canAdd = await canAddResource(playerId, quantity);
      if (!canAdd) {
        client.send('actionError', { code: 'CARGO_FULL', message: 'Cargo hold is full' });
        return;
      }
    }

    // Execute: deduct credits, add to inventory, decrement finished goods
    const deducted = await deductCredits(playerId, totalCost);
    if (!deducted) {
      client.send('actionError', { code: 'INSUFFICIENT_CREDITS', message: 'Insufficient credits' });
      return;
    }

    await addToInventory(playerId, itemType, itemId, quantity);

    const newFinishedGoods = { ...updatedRow.finished_goods };
    newFinishedGoods[itemId] = Math.max(0, (newFinishedGoods[itemId] ?? 0) - quantity);
    updatedRow.finished_goods = newFinishedGoods;

    await saveStationProduction(pool, x, y, {
      resource_stockpile: updatedRow.resource_stockpile,
      passive_gen_last_tick: updatedRow.passive_gen_last_tick,
      queue_index: updatedRow.queue_index,
      current_item_started_at: updatedRow.current_item_started_at,
      finished_goods: updatedRow.finished_goods,
    });

    const newCredits = await getPlayerCredits(playerId);
    const updatedCargo = await getCargoState(playerId);
    client.send('stationProductionUpdate', state);
    client.send('creditsUpdate', { credits: newCredits });
    client.send('cargoUpdate', updatedCargo);
  }

  private async handleSell(
    client: Client,
    msg: { itemId: string; quantity: number },
  ): Promise<void> {
    if (this.ctx._pst(client.sessionId) !== 'station') return;
    if (!this.ctx.checkRate(client.sessionId, 'stationSell', 500)) return;

    const x = this.ctx._px(client.sessionId);
    const y = this.ctx._py(client.sessionId);
    const auth = client.auth as AuthPayload;
    const playerId = auth.userId;

    const { itemId, quantity } = msg;
    if (!itemId || !Number.isInteger(quantity) || quantity <= 0) {
      client.send('actionError', { code: 'INVALID', message: 'Invalid sell parameters' });
      return;
    }

    // Only ore/gas/crystal can be sold to station
    if (!isOreResource(itemId)) {
      client.send('actionError', {
        code: 'INVALID',
        message: 'Only ore, gas, and crystal can be sold to station production',
      });
      return;
    }

    // Check player has enough in cargo
    const currentAmount = await getInventoryItem(playerId, 'resource', itemId);
    if (currentAmount < quantity) {
      client.send('actionError', {
        code: 'INSUFFICIENT_CARGO',
        message: `Only ${currentAmount} ${itemId} in cargo`,
      });
      return;
    }

    // Load production state
    const row = await getOrCreateStationProduction(pool, x, y);
    const station = await getOrInitStation(x, y);
    const level = getStationLevel(station.xp).level;
    const { state, updatedRow } = computeStationProductionState(row, x, y, level, Date.now());

    const tierConfig = getTierConfig(getDistanceTier(x, y));
    const maxStockpile = tierConfig.maxStockpilePerResource;

    const currentStockpile = state.resourceStockpile[itemId as OreResource];
    const spaceAvailable = maxStockpile - currentStockpile;
    if (spaceAvailable <= 0) {
      client.send('actionError', {
        code: 'STOCKPILE_FULL',
        message: `Station ${itemId} stockpile is full`,
      });
      return;
    }

    const effectiveQuantity = Math.min(quantity, spaceAvailable);
    const pricePerUnit = state.ankaufPreise[itemId as OreResource];
    const earned = pricePerUnit * effectiveQuantity;

    // Execute: remove from player inventory, add credits, increment stockpile
    await removeFromInventory(playerId, 'resource', itemId, effectiveQuantity);
    const newCredits = await addCredits(playerId, earned);

    const newStockpile = {
      ...updatedRow.resource_stockpile,
      [itemId]: currentStockpile + effectiveQuantity,
    };
    updatedRow.resource_stockpile = newStockpile;

    await saveStationProduction(pool, x, y, {
      resource_stockpile: updatedRow.resource_stockpile,
      passive_gen_last_tick: updatedRow.passive_gen_last_tick,
      queue_index: updatedRow.queue_index,
      current_item_started_at: updatedRow.current_item_started_at,
      finished_goods: updatedRow.finished_goods,
    });

    const updatedCargo = await getCargoState(playerId);
    client.send('stationProductionUpdate', state);
    client.send('creditsUpdate', { credits: newCredits });
    client.send('cargoUpdate', updatedCargo);

    if (effectiveQuantity < quantity) {
      client.send('actionError', {
        code: 'PARTIAL_SELL',
        message: `Sold ${effectiveQuantity} of ${quantity} (stockpile capacity limited)`,
      });
    }
  }
}
