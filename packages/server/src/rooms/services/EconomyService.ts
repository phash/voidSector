import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type {
  NpcTradeMessage,
  RefuelMessage,
  MineableResourceType,
} from '@void-sector/shared';

import { getReputationTier } from '../../engine/commands.js';
import { addAcepXpForPlayer } from '../../engine/acepXpService.js';
import { getStationFaction } from '../../engine/npcgen.js';
import {
  getOrInitStation,
  recordTrade,
  canBuyFromStation,
  canSellToStation,
  calculateCurrentStock,
  getStationLevel,
  calculatePrice,
} from '../../engine/npcStationEngine.js';
import {
  getStationInventoryItem,
  upsertInventoryItem,
  getStationInventory,
  getStationFuelAndGas,
  deductStationFuelStock,
} from '../../db/npcStationQueries.js';
import {
  getPlayerStationAt,
  updateStationCargo,
} from '../../db/stationQueries.js';
import { resolveOwnStationRefuel } from './stationRefuelDecision.js';
import { getFuelState, saveFuelState } from './RedisAPStore.js';
import {
  getPlayerCredits,
  addCredits,
  deductCredits,
  getPlayerReputation,
  getPlayerStationRep,
  updatePlayerStationRep,
} from '../../db/queries.js';
import {
  addToInventory,
  removeFromInventory,
  getCargoState,
  getResourceTotal,
} from '../../engine/inventoryService.js';
import { isPositiveInt } from './utils.js';
import {
  NPC_PRICES,
  NPC_BUY_SPREAD,
  NPC_SELL_SPREAD,
  NPC_STATION_LEVELS,
  FUEL_COST_PER_UNIT,
  REP_PRICE_MODIFIERS,
  getFuelRepPriceModifier,
  STATION_REP_TRADE,
} from '@void-sector/shared';

const VALID_MINE_RESOURCES = ['ore', 'gas', 'crystal'];
const VALID_TRANSFER_RESOURCES = ['ore', 'gas', 'crystal', 'artefact'];

export class EconomyService {
  constructor(private ctx: ServiceContext) {}

  // ── NPC Station helpers ──

  async sendNpcStationUpdate(client: Client, sx: number, sy: number): Promise<void> {
    const station = await getOrInitStation(sx, sy);
    // fuel is handled separately via handleRefuel — exclude from trade inventory
    const inventory = (await getStationInventory(sx, sy)).filter((i) => i.itemType !== 'fuel');
    const level = getStationLevel(station.xp);
    const now = new Date();
    const items = inventory.map((item) => {
      const currentStock = calculateCurrentStock(item, now);
      const stockRatio = item.maxStock > 0 ? currentStock / item.maxStock : 0;
      const basePrice = NPC_PRICES[item.itemType as MineableResourceType] || 0;
      return {
        itemType: item.itemType,
        stock: currentStock,
        maxStock: item.maxStock,
        buyPrice: Math.ceil(calculatePrice(basePrice, stockRatio) * NPC_BUY_SPREAD),
        sellPrice: Math.floor(calculatePrice(basePrice, stockRatio) * NPC_SELL_SPREAD),
      };
    });
    // Snapshot calculated stock to DB so subsequent canSellToStation/canBuyFromStation
    // calls don't drift due to time-based restock between display and trade (#237)
    for (let i = 0; i < inventory.length; i++) {
      const item = inventory[i];
      const snapshotStock = items[i].stock;
      if (item.stock !== snapshotStock) {
        item.stock = snapshotStock;
        item.lastUpdated = now.toISOString();
        await upsertInventoryItem(item);
      }
    }
    const nextLevel = NPC_STATION_LEVELS.find((l) => l.xpThreshold > station.xp);
    const { fuel: stationFuel, gas: stationGas } = await getStationFuelAndGas(sx, sy);
    client.send('npcStationUpdate', {
      level: level.level,
      name: level.name,
      xp: station.xp,
      nextLevelXp: nextLevel?.xpThreshold ?? station.xp,
      inventory: items,
      stationFuel,
      stationGas,
    });
  }

  // ── NPC Trade ──

  async handleNpcTrade(client: Client, data: NpcTradeMessage): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'npcTrade', 250)) {
      client.send('npcTradeResult', { success: false, error: 'Too fast — please wait' });
      return;
    }
    if (data.resource === 'artefact') {
      client.send('npcTradeResult', {
        success: false,
        error: 'Artefakte können nicht an NPCs gehandelt werden',
      });
      return;
    }
    if (!isPositiveInt(data.amount) || !VALID_MINE_RESOURCES.includes(data.resource)) {
      client.send('npcTradeResult', { success: false, error: 'Invalid trade parameters' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const { resource, amount, action } = data;

    const isStation = this.ctx._pst(client.sessionId) === 'station';
    if (!isStation) {
      client.send('npcTradeResult', { success: false, error: 'Must be at a station' });
      return;
    }

    const currentCredits = await getPlayerCredits(auth.userId);

    // Apply faction trade price bonus (discount on buy prices)
    const bonuses = await this.ctx.getPlayerBonuses(auth.userId);

    if (isStation) {
      // Station trade: use cargo with dynamic pricing from NPC station engine
      const cargo = await getCargoState(auth.userId);
      const cargoTotal = await getResourceTotal(auth.userId);
      const shipStats = this.ctx.getShipForClient(client.sessionId);
      const sx = this.ctx._px(client.sessionId);
      const sy = this.ctx._py(client.sessionId);

      if (action === 'sell') {
        // Capture full-cargo state before selling (for ACEP XP)
        const wasFullLoad = cargoTotal >= shipStats.cargoCap * 0.8;
        // Check cargo has enough
        if (cargo[resource as MineableResourceType] < amount) {
          client.send('npcTradeResult', {
            success: false,
            error: `Not enough ${resource} in cargo`,
          });
          return;
        }
        // Check station capacity — effectiveAmount may be less than requested
        const sellCheck = await canSellToStation(sx, sy, resource, amount);
        if (!sellCheck.ok) {
          client.send('npcTradeResult', {
            success: false,
            error: 'Station kann diese Ressource nicht mehr aufnehmen',
          });
          return;
        }
        const effectiveAmount = sellCheck.effectiveAmount;
        // Execute trade with effectiveAmount
        const deducted = await removeFromInventory(auth.userId, 'resource', resource, effectiveAmount)
          .then(() => true)
          .catch(() => false);
        if (!deducted) {
          client.send('npcTradeResult', { success: false, error: 'Cargo changed' });
          return;
        }
        // Update station stock — use calculated stock, not raw DB stock (#237)
        const invItem = await getStationInventoryItem(sx, sy, resource);
        if (invItem) {
          const currentStationStock = calculateCurrentStock(invItem);
          invItem.stock = Math.min(currentStationStock + effectiveAmount, invItem.maxStock);
          invItem.lastUpdated = new Date().toISOString();
          await upsertInventoryItem(invItem);
        }
        const newCredits = await addCredits(auth.userId, sellCheck.price);
        await recordTrade(sx, sy, effectiveAmount);
        updatePlayerStationRep(auth.userId, sx, sy, STATION_REP_TRADE).catch(() => {});
        const updatedCargo = await getCargoState(auth.userId);
        const partial = effectiveAmount < amount;
        client.send('npcTradeResult', {
          success: true,
          credits: newCredits,
          ...(partial && { partial: true, soldAmount: effectiveAmount }),
        });
        client.send('creditsUpdate', { credits: newCredits });
        client.send('cargoUpdate', updatedCargo);
        // ACEP: AUSBAU-XP for selling full cargo load (spec: +2 when ≥80% full)
        if (wasFullLoad) {
          addAcepXpForPlayer(auth.userId, 'ausbau', 2).catch(() => {});
        }
        // Auto-progress delivery quests targeting this station
        await this.ctx.onResourceSoldAtStation(client, auth.userId, sx, sy, resource, effectiveAmount);
        // Send station info update (rich format with inventory)
        await this.sendNpcStationUpdate(client, sx, sy);
      } else {
        // Buy: check station has stock
        const buyCheck = await canBuyFromStation(sx, sy, resource, amount);
        if (!buyCheck.ok) {
          client.send('npcTradeResult', {
            success: false,
            error: 'Station does not have enough stock',
          });
          return;
        }
        // Apply faction bonus
        let totalPrice = buyCheck.price;
        totalPrice = Math.ceil(totalPrice * bonuses.tradePriceMultiplier);
        // Check credits
        if (currentCredits < totalPrice) {
          client.send('npcTradeResult', {
            success: false,
            error: `Need ${totalPrice} credits (have ${currentCredits})`,
          });
          return;
        }
        // Check cargo space
        if (cargoTotal + amount > shipStats.cargoCap) {
          client.send('npcTradeResult', { success: false, error: 'Cargo full' });
          return;
        }
        // Execute trade
        const deducted = await deductCredits(auth.userId, totalPrice);
        if (!deducted) {
          client.send('npcTradeResult', { success: false, error: 'Credits changed' });
          return;
        }
        await addToInventory(auth.userId, 'resource', resource, amount);
        // Update station stock — use calculated stock, not raw DB stock (#237)
        const invItem = await getStationInventoryItem(sx, sy, resource);
        if (invItem) {
          const currentStationStock = calculateCurrentStock(invItem);
          invItem.stock = Math.max(currentStationStock - amount, 0);
          invItem.lastUpdated = new Date().toISOString();
          await upsertInventoryItem(invItem);
        }
        const newCredits = await getPlayerCredits(auth.userId);
        await recordTrade(sx, sy, amount);
        updatePlayerStationRep(auth.userId, sx, sy, STATION_REP_TRADE).catch(() => {});
        const updatedCargo = await getCargoState(auth.userId);
        client.send('npcTradeResult', { success: true, credits: newCredits });
        client.send('creditsUpdate', { credits: newCredits });
        client.send('cargoUpdate', updatedCargo);
        // Send station info update (rich format with inventory)
        await this.sendNpcStationUpdate(client, sx, sy);
      }
    }
  }


  // ── Refuel ──

  async handleRefuel(client: Client, data: RefuelMessage): Promise<void> {
    if (!isPositiveInt(data.amount)) {
      client.send('refuelResult', { success: false, error: 'Invalid amount' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const sx = this.ctx._px(client.sessionId);
    const sy = this.ctx._py(client.sessionId);
    const ship = this.ctx.getShipForClient(client.sessionId);
    const currentFuel = (await getFuelState(auth.userId)) ?? 0;
    const tankSpace = ship.fuelMax - currentFuel;

    // Must be at an NPC station OR at the player's own station
    const ownStation = await getPlayerStationAt(sx, sy);
    const atOwnStation = !!ownStation && ownStation.owner_id === auth.userId;
    const isStation = this.ctx._pst(client.sessionId) === 'station';
    if (!isStation && !atOwnStation) {
      client.send('refuelResult', {
        success: false,
        error: 'Must be at a station to refuel',
      });
      return;
    }

    if (tankSpace <= 0) {
      client.send('refuelResult', { success: false, error: 'Fuel tank is full' });
      return;
    }

    const amount = Math.min(data.amount, tankSpace);

    // Free refuel from own station's stored fuel — no credits deducted
    if (atOwnStation) {
      const own = resolveOwnStationRefuel(
        { owner_id: ownStation!.owner_id, cargo_contents: ownStation!.cargo_contents },
        auth.userId,
        amount,
      );
      if (own.ok) {
        const newFuel = currentFuel + own.amount;
        // Deduct the station's fuel first — if this write fails, the ship is not credited.
        await updateStationCargo(ownStation!.id, { ...ownStation!.cargo_contents, fuel: own.newStationFuel });
        await saveFuelState(auth.userId, newFuel);
        client.send('refuelResult', {
          success: true,
          fuel: { current: newFuel, max: ship.fuelMax },
          credits: await getPlayerCredits(auth.userId),
        });
        return;
      }
    }

    // NPC station refuel path
    // Check station fuel stock — cap fill amount to what the station has available
    const { fuel: stationFuel } = await getStationFuelAndGas(sx, sy);
    const availableAmount = Math.min(amount, stationFuel);
    if (availableAmount <= 0) {
      client.send('refuelResult', { success: false, error: 'Station fuel depleted' });
      return;
    }

    // Apply reputation price modifier at stations -- use the better of station-rep vs faction-rep
    const sectorFaction = getStationFaction(sx, sy);
    let factionModifier = 1.0;
    if (sectorFaction) {
      const factionRep = await getPlayerReputation(auth.userId, sectorFaction);
      const tier = getReputationTier(factionRep);
      factionModifier = REP_PRICE_MODIFIERS[tier] ?? 1.0;
    }

    // Per-station reputation modifier (more granular)
    const stationRep = await getPlayerStationRep(auth.userId, sx, sy);
    const stationModifier = getFuelRepPriceModifier(stationRep);
    const priceModifier = Math.min(factionModifier, stationModifier);

    const cost = Math.ceil(availableAmount * FUEL_COST_PER_UNIT * priceModifier);

    if (cost > 0) {
      const credits = await getPlayerCredits(auth.userId);
      if (credits < cost) {
        client.send('refuelResult', { success: false, error: 'Not enough credits' });
        return;
      }
      await deductCredits(auth.userId, cost);
    }

    const newFuel = currentFuel + availableAmount;
    await saveFuelState(auth.userId, newFuel);
    await deductStationFuelStock(sx, sy, availableAmount);

    const remainingCredits = await getPlayerCredits(auth.userId);

    client.send('refuelResult', {
      success: true,
      fuel: { current: newFuel, max: ship.fuelMax },
      credits: remainingCredits,
    });
  }


}
