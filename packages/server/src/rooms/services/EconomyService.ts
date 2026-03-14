import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type {
  NpcTradeMessage,
  UpgradeStructureMessage,
  PlaceOrderMessage,
  TransferMessage,
  RefuelMessage,
  MineableResourceType,
  ProcessedItemType,
} from '@void-sector/shared';

import { validateNpcTrade, validateTransfer, getReputationTier } from '../../engine/commands.js';
import { addAcepXpForPlayer, getAcepXpSummary } from '../../engine/acepXpService.js';
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
  getOrCreateFactoryState,
  setActiveRecipe,
  collectOutput,
  getFactoryStatus,
  transferOutputToCargo,
} from '../../engine/productionEngine.js';
import {
  placeKontorOrder,
  cancelKontorOrder,
  fillKontorOrder,
  getKontorOrders,
} from '../../engine/kontorEngine.js';
import { query } from '../../db/client.js';
import { getFuelState, saveFuelState } from './RedisAPStore.js';
import {
  getPlayerCredits,
  addCredits,
  deductCredits,
  getStorageInventory,
  updateStorageResource,
  getPlayerStructure,
  upgradeStructureTier,
  createTradeOrder,
  playerHasBaseAtSector,
  getPlayerBaseStructures,
  getPlayerShips,
  getPlayerReputation,
  getPlayerStationRep,
  updatePlayerStationRep,
  getPlayerResearch,
  getActiveShip,
} from '../../db/queries.js';
import {
  addToInventory,
  removeFromInventory,
  getCargoState,
  getResourceTotal,
} from '../../engine/inventoryService.js';
import { isPositiveInt, rejectGuest } from './utils.js';
import {
  NPC_PRICES,
  NPC_BUY_SPREAD,
  NPC_SELL_SPREAD,
  NPC_STATION_LEVELS,
  STORAGE_TIERS,
  TRADING_POST_TIERS,
  FUEL_COST_PER_UNIT,
  FREE_REFUEL_MAX_SHIPS,
  REP_PRICE_MODIFIERS,
  getFuelRepPriceModifier,
  STATION_REP_TRADE,
  getAcepLevel,
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
    const hasBase = await playerHasBaseAtSector(
      auth.userId,
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    if (!isStation && !hasBase) {
      client.send('npcTradeResult', { success: false, error: 'Must be at a station or your base' });
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
    } else {
      // Home base trade: use storage
      const storageStruct = await getPlayerStructure(auth.userId, 'storage');
      const storageTier = storageStruct?.tier ?? 1;
      const storage = await getStorageInventory(auth.userId);

      const result = validateNpcTrade(
        action,
        resource,
        amount,
        currentCredits,
        storage,
        storageTier,
      );
      if (!result.valid) {
        client.send('npcTradeResult', { success: false, error: result.error });
        return;
      }

      if (action === 'buy') {
        result.totalPrice = Math.ceil(result.totalPrice * bonuses.tradePriceMultiplier);
      }

      if (action === 'sell') {
        await updateStorageResource(auth.userId, resource, -amount);
        const newCredits = await addCredits(auth.userId, result.totalPrice);
        const updatedStorage = await getStorageInventory(auth.userId);
        client.send('npcTradeResult', {
          success: true,
          credits: newCredits,
          storage: updatedStorage,
        });
        client.send('creditsUpdate', { credits: newCredits });
        client.send('storageUpdate', updatedStorage);
      } else {
        const deducted = await deductCredits(auth.userId, result.totalPrice);
        if (!deducted) {
          client.send('npcTradeResult', { success: false, error: 'Credits changed' });
          return;
        }
        await updateStorageResource(auth.userId, resource, amount);
        const newCredits = await getPlayerCredits(auth.userId);
        const updatedStorage = await getStorageInventory(auth.userId);
        client.send('npcTradeResult', {
          success: true,
          credits: newCredits,
          storage: updatedStorage,
        });
        client.send('creditsUpdate', { credits: newCredits });
        client.send('storageUpdate', updatedStorage);
      }
    }
  }

  // ── Upgrade Structure ──

  async handleUpgradeStructure(client: Client, data: UpgradeStructureMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const { structureId } = data;

    const struct = await query<{ id: string; type: string; tier: number; owner_id: string }>(
      'SELECT id, type, tier, owner_id FROM structures WHERE id = $1',
      [structureId],
    );
    const row = struct.rows[0];
    if (!row || row.owner_id !== auth.userId) {
      client.send('upgradeResult', { success: false, error: 'Structure not found' });
      return;
    }

    const tierMap =
      row.type === 'storage'
        ? STORAGE_TIERS
        : row.type === 'trading_post'
          ? TRADING_POST_TIERS
          : null;
    if (!tierMap) {
      client.send('upgradeResult', { success: false, error: 'Not upgradeable' });
      return;
    }

    const nextTier = row.tier + 1;
    const nextConfig = tierMap[nextTier];
    if (!nextConfig) {
      client.send('upgradeResult', { success: false, error: 'Already max tier' });
      return;
    }

    const cost = nextConfig.upgradeCost;
    if (cost > 0) {
      const deducted = await deductCredits(auth.userId, cost);
      if (!deducted) {
        client.send('upgradeResult', { success: false, error: `Need ${cost} credits` });
        return;
      }
    }

    const newTier = await upgradeStructureTier(structureId);
    const upgradeCredits = await getPlayerCredits(auth.userId);
    client.send('upgradeResult', { success: true, newTier, creditsRemaining: upgradeCredits });
    client.send('creditsUpdate', { credits: upgradeCredits });

    const structures = await getPlayerBaseStructures(auth.userId);
    client.send('baseData', { structures });
  }

  // ── Place Order ──

  async handlePlaceOrder(client: Client, data: PlaceOrderMessage): Promise<void> {
    if (rejectGuest(client, 'Markthandel')) return;
    if (
      !isPositiveInt(data.amount) ||
      !isPositiveInt(data.pricePerUnit) ||
      data.pricePerUnit > 999999
    ) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Invalid amount or price' });
      return;
    }
    if (!VALID_MINE_RESOURCES.includes(data.resource)) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Invalid resource type' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const { resource, amount, pricePerUnit, type } = data;

    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    if (!tradingPost || tradingPost.tier < 2) {
      client.send('error', { code: 'NO_MARKET', message: 'Need Trading Post Tier 2+' });
      return;
    }

    if (type === 'sell') {
      const storage = await getStorageInventory(auth.userId);
      if (storage[resource as keyof typeof storage] < amount) {
        client.send('error', {
          code: 'INSUFFICIENT',
          message: `Not enough ${resource} in storage`,
        });
        return;
      }
      await updateStorageResource(auth.userId, resource, -amount);
    } else {
      const totalCost = pricePerUnit * amount;
      const deducted = await deductCredits(auth.userId, totalCost);
      if (!deducted) {
        client.send('error', { code: 'INSUFFICIENT', message: 'Not enough credits' });
        return;
      }
    }

    const order = await createTradeOrder(auth.userId, resource, amount, pricePerUnit, type);
    client.send('orderPlaced', { success: true, orderId: order.id });
  }

  // ── Transfer ──

  async handleTransfer(client: Client, data: TransferMessage): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'transfer', 500)) {
      client.send('transferResult', { success: false, error: 'Too fast' });
      return;
    }
    if (!isPositiveInt(data.amount) || !VALID_TRANSFER_RESOURCES.includes(data.resource)) {
      client.send('transferResult', { success: false, error: 'Invalid transfer parameters' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const { resource, amount, direction } = data;

    const hasBase = await playerHasBaseAtSector(
      auth.userId,
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    if (!hasBase) {
      client.send('transferResult', { success: false, error: 'Must be at your base' });
      return;
    }

    const storageStruct = await getPlayerStructure(auth.userId, 'storage');
    const storageTier = storageStruct?.tier ?? 1;

    const currentCargo = await getCargoState(auth.userId);
    const storage = await getStorageInventory(auth.userId);
    const result = validateTransfer(
      direction,
      resource,
      amount,
      currentCargo,
      storage,
      storageTier,
    );
    if (!result.valid) {
      client.send('transferResult', { success: false, error: result.error });
      return;
    }

    if (direction === 'toStorage') {
      await removeFromInventory(auth.userId, 'resource', resource, amount);
      await updateStorageResource(auth.userId, resource, amount);
    } else {
      await updateStorageResource(auth.userId, resource, -amount);
      await addToInventory(auth.userId, 'resource', resource, amount);
    }

    const updatedCargo = await getCargoState(auth.userId);
    const updatedStorage = await getStorageInventory(auth.userId);
    client.send('transferResult', { success: true, cargo: updatedCargo, storage: updatedStorage });
    client.send('cargoUpdate', updatedCargo);
    client.send('storageUpdate', updatedStorage);
  }

  // ── Refuel ──

  async handleRefuel(client: Client, data: RefuelMessage): Promise<void> {
    if (!isPositiveInt(data.amount)) {
      client.send('refuelResult', { success: false, error: 'Invalid amount' });
      return;
    }
    const auth = client.auth as AuthPayload;

    // Must be at a station or own base
    const isStation = this.ctx._pst(client.sessionId) === 'station';
    const hasBase = await playerHasBaseAtSector(
      auth.userId,
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    if (!isStation && !hasBase) {
      client.send('refuelResult', {
        success: false,
        error: 'Must be at a station or your base to refuel',
      });
      return;
    }

    const ship = this.ctx.getShipForClient(client.sessionId);
    const currentFuel = (await getFuelState(auth.userId)) ?? 0;
    const tankSpace = ship.fuelMax - currentFuel;

    if (tankSpace <= 0) {
      client.send('refuelResult', { success: false, error: 'Fuel tank is full' });
      return;
    }

    const amount = Math.min(data.amount, tankSpace);

    const playerShips = await getPlayerShips(auth.userId);
    const isFreeRefuel = hasBase && !isStation && playerShips.length <= FREE_REFUEL_MAX_SHIPS;

    // Check station fuel stock — cap fill amount to what the station has available
    let availableAmount = amount;
    if (isStation && !isFreeRefuel) {
      const sx = this.ctx._px(client.sessionId);
      const sy = this.ctx._py(client.sessionId);
      const { fuel: stationFuel } = await getStationFuelAndGas(sx, sy);
      availableAmount = Math.min(amount, stationFuel);
      if (availableAmount <= 0) {
        client.send('refuelResult', { success: false, error: 'Station fuel depleted' });
        return;
      }
    }

    // Apply reputation price modifier at stations -- use the better of station-rep vs faction-rep
    let priceModifier = 1.0;
    if (isStation && !isFreeRefuel) {
      const sx = this.ctx._px(client.sessionId);
      const sy = this.ctx._py(client.sessionId);

      // Faction reputation modifier
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

      // Use the better (lower) modifier
      priceModifier = Math.min(factionModifier, stationModifier);
    }

    const cost = isFreeRefuel ? 0 : Math.ceil(availableAmount * FUEL_COST_PER_UNIT * priceModifier);

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

    if (isStation && !isFreeRefuel) {
      const sx = this.ctx._px(client.sessionId);
      const sy = this.ctx._py(client.sessionId);
      await deductStationFuelStock(sx, sy, availableAmount);
    }

    const remainingCredits = await getPlayerCredits(auth.userId);

    client.send('refuelResult', {
      success: true,
      fuel: { current: newFuel, max: ship.fuelMax },
      credits: remainingCredits,
    });
  }

  // ── Factory Handlers ──

  async handleFactoryStatus(client: Client): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'factoryStatus', 500)) return;
    const auth = client.auth as AuthPayload;

    // Find factory at player's base
    const factoryStruct = await getPlayerStructure(auth.userId, 'factory');
    if (!factoryStruct) {
      client.send('factoryUpdate', { error: 'No factory built' });
      return;
    }

    await getOrCreateFactoryState(factoryStruct.id, auth.userId);
    const status = await getFactoryStatus(factoryStruct.id);
    client.send('factoryUpdate', status);
  }

  async handleFactorySetRecipe(client: Client, data: { recipeId: string }): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'factorySetRecipe', 1000)) return;
    if (rejectGuest(client, 'factory')) return;
    const auth = client.auth as AuthPayload;

    if (!data?.recipeId || typeof data.recipeId !== 'string') {
      client.send('factoryUpdate', { error: 'Invalid recipe ID' });
      return;
    }

    const shipForFactory = await getActiveShip(auth.userId);
    const acepXpFactory = shipForFactory ? await getAcepXpSummary(shipForFactory.id) : { ausbau: 0 };
    if (getAcepLevel(acepXpFactory.ausbau) < 2) {
      client.send('error', { code: 'FACTORY_LOCKED', message: 'Fabrik erfordert AUSBAU Level 2' });
      return;
    }

    const factoryStruct = await getPlayerStructure(auth.userId, 'factory');
    if (!factoryStruct) {
      client.send('factoryUpdate', { error: 'No factory built' });
      return;
    }

    await getOrCreateFactoryState(factoryStruct.id, auth.userId);
    const research = await getPlayerResearch(auth.userId);
    const result = await setActiveRecipe(
      factoryStruct.id,
      data.recipeId,
      research?.blueprints ?? [],
    );

    if (!result.success) {
      client.send('factoryUpdate', { error: result.error });
      return;
    }

    const status = await getFactoryStatus(factoryStruct.id);
    client.send('factoryUpdate', status);
  }

  async handleFactoryCollect(client: Client): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'factoryCollect', 1000)) return;
    if (rejectGuest(client, 'factory')) return;
    const auth = client.auth as AuthPayload;

    const factoryStruct = await getPlayerStructure(auth.userId, 'factory');
    if (!factoryStruct) {
      client.send('factoryUpdate', { error: 'No factory built' });
      return;
    }

    const storage = await getStorageInventory(auth.userId);
    const result = await collectOutput(factoryStruct.id, storage);

    if (result.error) {
      client.send('factoryUpdate', { error: result.error });
      return;
    }

    // Deduct consumed resources from storage
    for (const [resource, amount] of Object.entries(result.consumed)) {
      if (amount > 0) {
        await updateStorageResource(auth.userId, resource as any, -amount);
      }
    }

    // Send updated factory status + updated storage
    const status = await getFactoryStatus(factoryStruct.id);
    const updatedStorage = await getStorageInventory(auth.userId);
    client.send('factoryUpdate', status);
    client.send('storageUpdate', updatedStorage);
  }

  async handleFactoryTransfer(
    client: Client,
    data: { itemType: string; amount: number },
  ): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'factoryTransfer', 500)) return;
    if (rejectGuest(client, 'factory')) return;
    const auth = client.auth as AuthPayload;

    if (!data?.itemType || !isPositiveInt(data?.amount)) {
      client.send('factoryUpdate', { error: 'Invalid transfer parameters' });
      return;
    }

    const factoryStruct = await getPlayerStructure(auth.userId, 'factory');
    if (!factoryStruct) {
      client.send('factoryUpdate', { error: 'No factory built' });
      return;
    }

    const result = await transferOutputToCargo(
      factoryStruct.id,
      data.itemType as ProcessedItemType,
      data.amount,
    );
    if (!result.success) {
      client.send('factoryUpdate', { error: result.error });
      return;
    }

    // Add to player cargo
    await addToInventory(auth.userId, 'resource', data.itemType, data.amount);

    // Send updates
    const status = await getFactoryStatus(factoryStruct.id);
    const cargo = await getCargoState(auth.userId);
    client.send('factoryUpdate', status);
    client.send('cargoUpdate', cargo);
  }

  // ── Kontor Handlers ──

  async handleKontorPlaceOrder(
    client: Client,
    data: { itemType: string; itemId: string; amount: number; pricePerUnit: number },
  ): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'kontorPlaceOrder', 1000)) return;
    if (rejectGuest(client, 'kontor')) return;
    const auth = client.auth as AuthPayload;

    if (!data?.itemType || typeof data.itemType !== 'string') {
      client.send('kontorUpdate', { error: 'Invalid item type' });
      return;
    }
    if (!data?.itemId || typeof data.itemId !== 'string') {
      client.send('kontorUpdate', { error: 'Invalid item ID' });
      return;
    }
    if (!isPositiveInt(data?.amount) || !isPositiveInt(data?.pricePerUnit)) {
      client.send('kontorUpdate', { error: 'Invalid order parameters' });
      return;
    }

    const result = await placeKontorOrder(
      auth.userId,
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
      data.itemType as import('@void-sector/shared').ItemType,
      data.itemId,
      data.amount,
      data.pricePerUnit,
    );

    if (!result.success) {
      client.send('kontorUpdate', { error: result.error });
      return;
    }

    const orders = await getKontorOrders(
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    client.send('kontorUpdate', { orders, placed: result.order });
  }

  async handleKontorCancelOrder(client: Client, data: { orderId: string }): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'kontorCancelOrder', 1000)) return;
    if (rejectGuest(client, 'kontor')) return;
    const auth = client.auth as AuthPayload;

    if (!data?.orderId || typeof data.orderId !== 'string') {
      client.send('kontorUpdate', { error: 'Invalid order ID' });
      return;
    }

    const result = await cancelKontorOrder(data.orderId, auth.userId);

    if (!result.success) {
      client.send('kontorUpdate', { error: result.error });
      return;
    }

    const orders = await getKontorOrders(
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    client.send('kontorUpdate', { orders, refunded: result.refunded });
  }

  async handleKontorSellTo(
    client: Client,
    data: { orderId: string; amount: number },
  ): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'kontorSellTo', 500)) return;
    if (rejectGuest(client, 'kontor')) return;
    const auth = client.auth as AuthPayload;

    if (!data?.orderId || typeof data.orderId !== 'string') {
      client.send('kontorUpdate', { error: 'Invalid order ID' });
      return;
    }
    if (!isPositiveInt(data?.amount)) {
      client.send('kontorUpdate', { error: 'Invalid amount' });
      return;
    }

    const result = await fillKontorOrder(data.orderId, auth.userId, data.amount);

    if (!result.success) {
      client.send('kontorUpdate', { error: result.error });
      return;
    }

    const orders = await getKontorOrders(
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    const cargo = await getCargoState(auth.userId);
    client.send('kontorUpdate', { orders, earned: result.earned });
    client.send('cargoUpdate', cargo);
  }

  async handleKontorGetOrders(client: Client): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'kontorGetOrders', 500)) return;
    const orders = await getKontorOrders(
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    client.send('kontorUpdate', { orders });
  }
}
