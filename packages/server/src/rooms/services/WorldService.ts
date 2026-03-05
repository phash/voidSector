import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type {
  BuildMessage,
  CreateSlateMessage,
  ActivateSlateMessage,
  NpcBuybackMessage,
  ListSlateMessage,
  UseJumpGateMessage,
  RescueMessage,
  DeliverSurvivorsMessage,
  ConfigureRouteMessage,
  ToggleRouteMessage,
  DeleteRouteMessage,
  SetBookmarkMessage,
  ClearBookmarkMessage,
  MineableResourceType,
} from '@void-sector/shared';

import { logger } from '../../utils/logger.js';
import { calculateCurrentAP } from '../../engine/ap.js';
import { validateBuild, validateCreateSlate, validateNpcBuyback } from '../../engine/commands.js';
import {
  checkDistressCall,
  generateDistressCallData,
  calculateRescueReward,
  canRescue,
} from '../../engine/rescue.js';
import {
  isRouteCycleDue,
  calculateRouteFuelCost,
  validateRouteConfig,
} from '../../engine/tradeRoutes.js';
import {
  sectorToQuadrant,
  getOrCreateQuadrant,
  nameQuadrant as nameQuadrantEngine,
  generateQuadrantName,
} from '../../engine/quadrantEngine.js';
import {
  JUMPGATE_FUEL_COST,
  RESCUE_AP_COST,
  RESCUE_EXPIRY_MINUTES,
  NPC_PRICES,
  NPC_BUY_SPREAD,
  NPC_SELL_SPREAD,
} from '@void-sector/shared';
import {
  getAPState,
  saveAPState,
  getMiningState,
  getFuelState,
  saveFuelState,
} from './RedisAPStore.js';
import {
  getSector,
  getPlayerDiscoveries,
  addDiscovery,
  getPlayerCargo,
  createStructure,
  deductCargo,
  getPlayerBaseStructures,
  getStorageInventory,
  updateStorageResource,
  getPlayerCredits,
  addCredits,
  deductCredits,
  getActiveTradeOrders,
  getPlayerTradeOrders,
  cancelTradeOrder,
  fulfillTradeOrder,
  createDataSlate,
  getPlayerSlates,
  getSlateById,
  deleteSlate,
  updateSlateStatus,
  updateSlateOwner,
  addSlateToCargo,
  removeSlateFromCargo,
  createSlateTradeOrder,
  getTradeOrderById,
  getPlayerStructure,
  getPlayerBookmarks,
  setPlayerBookmark,
  clearPlayerBookmark,
  getJumpGate,
  playerHasGateCode,
  addGateCode,
  getPlayerSurvivors,
  insertRescuedSurvivor,
  deletePlayerSurvivors,
  insertDistressCall,
  insertPlayerDistressCall,
  getPlayerTradeRoutes,
  insertTradeRoute,
  updateTradeRouteActive,
  deleteTradeRoute,
  updateTradeRouteLastCycle,
  getActiveTradeRoutes,
  getPlayerKnownJumpGates,
} from '../../db/queries.js';
import {
  getPlayerKnownQuadrants,
  addPlayerKnownQuadrant,
  addPlayerKnownQuadrantsBatch,
  getQuadrant,
  getAllDiscoveredQuadrantCoords,
} from '../../db/quadrantQueries.js';
import { isInt, rejectGuest } from './utils.js';

const VALID_STRUCTURE_TYPES = [
  'comm_relay',
  'mining_station',
  'base',
  'storage',
  'trading_post',
  'defense_turret',
  'station_shield',
  'ion_cannon',
  'factory',
  'research_lab',
  'kontor',
];

export class WorldService {
  constructor(private ctx: ServiceContext) {}

  // ── Simple Data Getters ─────────────────────────────────────────────

  async handleGetAP(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const ap = await getAPState(auth.userId);
    const updated = calculateCurrentAP(ap);
    await saveAPState(auth.userId, updated);
    client.send('apUpdate', updated);
  }

  async handleGetDiscoveries(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const discoveries = await getPlayerDiscoveries(auth.userId);
    client.send('discoveries', discoveries);
  }

  async handleGetCargo(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const cargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', cargo);
  }

  async handleGetMiningStatus(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const mining = await getMiningState(auth.userId);
    client.send('miningUpdate', mining);
  }

  async handleGetBase(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const structures = await getPlayerBaseStructures(auth.userId);
    client.send('baseData', { structures });
  }

  async handleGetCredits(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const credits = await getPlayerCredits(auth.userId);
    client.send('creditsUpdate', { credits });
  }

  async handleGetStorage(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const storage = await getStorageInventory(auth.userId);
    client.send('storageUpdate', storage);
  }

  async handleGetTradeOrders(client: Client): Promise<void> {
    const orders = await getActiveTradeOrders();
    client.send('tradeOrders', { orders });
  }

  async handleGetMyOrders(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const orders = await getPlayerTradeOrders(auth.userId);
    client.send('myOrders', { orders });
  }

  async handleCancelOrder(client: Client, data: { orderId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const cancelled = await cancelTradeOrder(data.orderId, auth.userId);
    client.send('cancelOrderResult', { success: cancelled });
  }

  async handleGetMySlates(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const slates = await getPlayerSlates(auth.userId);
    client.send('mySlates', { slates: slates.map(this.mapSlateRow) });
  }

  // ── Bookmarks ───────────────────────────────────────────────────────

  async handleGetBookmarks(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const bookmarks = await getPlayerBookmarks(auth.userId);
    client.send('bookmarksUpdate', { bookmarks });
  }

  async handleSetBookmark(client: Client, data: SetBookmarkMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    if (data.slot < 1 || data.slot > 5) {
      client.send('error', { code: 'INVALID_SLOT', message: 'Bookmark slot must be 1-5' });
      return;
    }
    await setPlayerBookmark(auth.userId, data.slot, data.sectorX, data.sectorY, data.label);
    const bookmarks = await getPlayerBookmarks(auth.userId);
    client.send('bookmarksUpdate', { bookmarks });
  }

  async handleClearBookmark(client: Client, data: ClearBookmarkMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    await clearPlayerBookmark(auth.userId, data.slot);
    const bookmarks = await getPlayerBookmarks(auth.userId);
    client.send('bookmarksUpdate', { bookmarks });
  }

  // ── Build ───────────────────────────────────────────────────────────

  async handleBuild(client: Client, data: BuildMessage): Promise<void> {
    if (rejectGuest(client, 'Bauen')) return;
    if (!this.ctx.checkRate(client.sessionId, 'build', 2000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    if (!data.type || !VALID_STRUCTURE_TYPES.includes(data.type)) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Invalid structure type' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const cargo = await getPlayerCargo(auth.userId);

    const result = validateBuild(currentAP, cargo, data.type);
    if (!result.valid) {
      client.send('error', { code: 'BUILD_FAIL', message: result.error! });
      return;
    }

    await saveAPState(auth.userId, result.newAP!);

    for (const [resource, amount] of Object.entries(result.costs)) {
      if (amount > 0) {
        const deducted = await deductCargo(auth.userId, resource, amount);
        if (!deducted) {
          client.send('buildResult', {
            success: false,
            error: `Insufficient ${resource} (concurrent modification)`,
          });
          return;
        }
      }
    }

    let structure;
    try {
      structure = await createStructure(
        auth.userId,
        data.type,
        this.ctx._px(client.sessionId),
        this.ctx._py(client.sessionId),
      );
    } catch (err: any) {
      if (err.code === '23505') {
        client.send('buildResult', {
          success: false,
          error: 'Structure already exists in this sector',
        });
        return;
      }
      client.send('buildResult', { success: false, error: 'Build failed — try again' });
      return;
    }

    client.send('buildResult', { success: true, structure });
    client.send('apUpdate', result.newAP!);
    const updatedCargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    this.ctx.broadcast('structureBuilt', {
      structure,
      sectorX: this.ctx._px(client.sessionId),
      sectorY: this.ctx._py(client.sessionId),
    });
  }

  // ── Slate Handlers ──────────────────────────────────────────────────

  private mapSlateRow(row: any) {
    return {
      id: row.id,
      creatorId: row.creator_id,
      creatorName: row.creator_name,
      ownerId: row.owner_id,
      slateType: row.slate_type,
      sectorData: row.sector_data,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  async handleCreateSlate(client: Client, data: CreateSlateMessage): Promise<void> {
    if (rejectGuest(client, 'Data Slates erstellen')) return;
    const auth = client.auth as AuthPayload;
    if (!['sector', 'area'].includes(data.slateType)) {
      client.send('createSlateResult', { success: false, error: 'Invalid slate type' });
      return;
    }

    const ship = this.ctx.getShipForClient(client.sessionId);
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const cargo = await getPlayerCargo(auth.userId);
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;

    const validation = validateCreateSlate(
      {
        ap: currentAP.current,
        scannerLevel: ship.scannerLevel,
        cargoTotal,
        cargoCap: ship.cargoCap,
      },
      data.slateType,
    );
    if (!validation.valid) {
      client.send('createSlateResult', { success: false, error: validation.error });
      return;
    }

    // Gather sector data
    let sectorData: any[];
    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);

    if (data.slateType === 'sector') {
      const sector = await getSector(sectorX, sectorY);
      const resources = sector?.resources ?? { ore: 0, gas: 0, crystal: 0 };
      sectorData = [
        {
          x: sectorX,
          y: sectorY,
          type: sector?.type ?? 'empty',
          ore: resources.ore ?? 0,
          gas: resources.gas ?? 0,
          crystal: resources.crystal ?? 0,
        },
      ];
    } else {
      const radius = validation.radius!;
      const discoveries = await getPlayerDiscoveries(auth.userId);
      sectorData = [];
      for (const disc of discoveries) {
        if (Math.abs(disc.x - sectorX) <= radius && Math.abs(disc.y - sectorY) <= radius) {
          const sector = await getSector(disc.x, disc.y);
          if (sector) {
            const resources = sector.resources ?? { ore: 0, gas: 0, crystal: 0 };
            sectorData.push({
              x: disc.x,
              y: disc.y,
              type: sector.type ?? 'empty',
              ore: resources.ore ?? 0,
              gas: resources.gas ?? 0,
              crystal: resources.crystal ?? 0,
            });
          }
        }
      }
    }

    if (sectorData.length === 0) {
      client.send('createSlateResult', { success: false, error: 'No sector data to record' });
      return;
    }

    // Deduct AP
    currentAP.current -= validation.apCost!;
    await saveAPState(auth.userId, currentAP);

    // Create slate + add to cargo
    const slate = await createDataSlate(auth.userId, data.slateType, sectorData);
    await addSlateToCargo(auth.userId);
    const updatedCargo = await getPlayerCargo(auth.userId);

    client.send('createSlateResult', {
      success: true,
      slate: { id: slate.id, slateType: data.slateType, sectorData, status: 'available' },
      cargo: updatedCargo,
      ap: currentAP.current,
    });
    client.send('apUpdate', currentAP);
  }

  async handleActivateSlate(client: Client, data: ActivateSlateMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const slate = await getSlateById(data.slateId);

    if (!slate || slate.owner_id !== auth.userId) {
      client.send('activateSlateResult', { success: false, error: 'Slate not found' });
      return;
    }
    if (slate.status !== 'available') {
      client.send('activateSlateResult', { success: false, error: 'Slate is listed on market' });
      return;
    }

    // Add sectors to discoveries
    const sectors = slate.sector_data as any[];
    for (const s of sectors) {
      await addDiscovery(auth.userId, s.x, s.y);
    }

    // Remove from cargo + delete slate
    await removeSlateFromCargo(auth.userId);
    await deleteSlate(data.slateId);

    client.send('activateSlateResult', { success: true, sectorsAdded: sectors.length });
    const cargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', cargo);
  }

  async handleNpcBuyback(client: Client, data: NpcBuybackMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    const slate = await getSlateById(data.slateId);

    if (!slate || slate.owner_id !== auth.userId || slate.status !== 'available') {
      client.send('npcBuybackResult', { success: false, error: 'Slate not found or unavailable' });
      return;
    }

    const sectorCount = (slate.sector_data as any[]).length;
    const validation = validateNpcBuyback(!!tradingPost, sectorCount);
    if (!validation.valid) {
      client.send('npcBuybackResult', { success: false, error: validation.error });
      return;
    }

    await addCredits(auth.userId, validation.payout!);
    await removeSlateFromCargo(auth.userId);
    await deleteSlate(data.slateId);

    const credits = await getPlayerCredits(auth.userId);
    client.send('npcBuybackResult', { success: true, credits, creditsEarned: validation.payout });
    const cargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', cargo);
  }

  async handleListSlate(client: Client, data: ListSlateMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    if (!tradingPost || tradingPost.tier < 2) {
      client.send('error', { code: 'NO_MARKET', message: 'Need Trading Post Tier 2' });
      return;
    }

    const slate = await getSlateById(data.slateId);
    if (!slate || slate.owner_id !== auth.userId || slate.status !== 'available') {
      client.send('error', { code: 'INVALID_SLATE', message: 'Slate not found or already listed' });
      return;
    }

    await updateSlateStatus(data.slateId, 'listed');
    await removeSlateFromCargo(auth.userId);
    await createSlateTradeOrder(auth.userId, data.slateId, data.price);

    client.send('orderPlaced', { success: true });
    const cargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', cargo);
  }

  async handleAcceptSlateOrder(client: Client, data: { orderId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const order = await getTradeOrderById(data.orderId);
    if (!order || order.fulfilled || order.resource !== 'slate') {
      client.send('error', { code: 'INVALID_ORDER', message: 'Order not found' });
      return;
    }

    const buyerCredits = await getPlayerCredits(auth.userId);
    if (buyerCredits < order.price_per_unit) {
      client.send('error', { code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits' });
      return;
    }

    const cargo = await getPlayerCargo(auth.userId);
    const ship = this.ctx.getShipForClient(client.sessionId);
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
    if (cargoTotal >= ship.cargoCap) {
      client.send('error', { code: 'CARGO_FULL', message: 'No cargo space' });
      return;
    }

    await deductCredits(auth.userId, order.price_per_unit);
    await addCredits(order.player_id, order.price_per_unit);
    await updateSlateOwner(order.slate_id, auth.userId);
    await addSlateToCargo(auth.userId);
    await fulfillTradeOrder(data.orderId);

    client.send('slateOrderAccepted', { success: true });
    const updatedCredits = await getPlayerCredits(auth.userId);
    client.send('creditsUpdate', { credits: updatedCredits });
    const updatedCargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', updatedCargo);
  }

  // ── Jump Gate Handlers ──────────────────────────────────────────────

  async handleUseJumpGate(client: Client, data: UseJumpGateMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const { gateId, accessCode } = data;

    const gate = await getJumpGate(this.ctx._px(client.sessionId), this.ctx._py(client.sessionId));
    if (!gate || gate.id !== gateId) {
      client.send('useJumpGateResult', { success: false, error: 'No gate at this location' });
      return;
    }

    // Check code
    if (gate.requiresCode) {
      const hasCode = await playerHasGateCode(auth.userId, gateId);
      if (!hasCode) {
        if (!accessCode || accessCode !== gate.accessCode) {
          client.send('useJumpGateResult', { success: false, error: 'Invalid access code' });
          return;
        }
        await addGateCode(auth.userId, gateId);
      }
    }

    // Check minigame requirement
    if (gate.requiresMinigame) {
      client.send('useJumpGateResult', { success: true, requiresMinigame: true });
      return;
    }

    // Deduct fuel
    const currentFuel = await getFuelState(auth.userId);
    if (currentFuel === null || currentFuel < JUMPGATE_FUEL_COST) {
      client.send('useJumpGateResult', { success: false, error: 'Not enough fuel' });
      return;
    }
    await saveFuelState(auth.userId, currentFuel - JUMPGATE_FUEL_COST);

    client.send('useJumpGateResult', {
      success: true,
      targetX: gate.targetX,
      targetY: gate.targetY,
      fuel: {
        current: currentFuel - JUMPGATE_FUEL_COST,
        max: this.ctx.getShipForClient(client.sessionId).fuelMax,
      },
    });
  }

  async handleFrequencyMatch(
    client: Client,
    data: { gateId: string; matched: boolean },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;

    if (!data.matched) {
      client.send('useJumpGateResult', { success: false, error: 'Frequency match failed' });
      return;
    }

    const gate = await getJumpGate(this.ctx._px(client.sessionId), this.ctx._py(client.sessionId));
    if (!gate || gate.id !== data.gateId) {
      client.send('useJumpGateResult', { success: false, error: 'Gate not found' });
      return;
    }

    const currentFuel = await getFuelState(auth.userId);
    if (currentFuel === null || currentFuel < JUMPGATE_FUEL_COST) {
      client.send('useJumpGateResult', { success: false, error: 'Not enough fuel' });
      return;
    }
    await saveFuelState(auth.userId, currentFuel - JUMPGATE_FUEL_COST);

    client.send('useJumpGateResult', {
      success: true,
      targetX: gate.targetX,
      targetY: gate.targetY,
      fuel: {
        current: currentFuel - JUMPGATE_FUEL_COST,
        max: this.ctx.getShipForClient(client.sessionId).fuelMax,
      },
    });
  }

  // ── Rescue Handlers ─────────────────────────────────────────────────

  async handleRescue(client: Client, data: RescueMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const ship = this.ctx.getShipForClient(client.sessionId);

    // Must be at the sector
    if (
      data.sectorX !== this.ctx._px(client.sessionId) ||
      data.sectorY !== this.ctx._py(client.sessionId)
    ) {
      client.send('rescueResult', { success: false, error: 'Not at rescue location' });
      return;
    }

    // Check safe slots
    const survivors = await getPlayerSurvivors(auth.userId);
    const safeSlots = (ship as any).safeSlots ?? 1;
    if (!canRescue(safeSlots, survivors.length)) {
      client.send('rescueResult', { success: false, error: 'No free safe slots' });
      return;
    }

    // Check AP
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    if (currentAP.current < RESCUE_AP_COST) {
      client.send('rescueResult', { success: false, error: 'Not enough AP' });
      return;
    }
    const newAP = { ...currentAP, current: currentAP.current - RESCUE_AP_COST };
    await saveAPState(auth.userId, newAP);

    // Add survivor
    const id = `rescue_${auth.userId}_${Date.now()}`;
    await insertRescuedSurvivor(id, auth.userId, data.sectorX, data.sectorY, 1, 'scan_event');

    client.send('rescueResult', {
      success: true,
      survivorsRescued: 1,
      safeSlotsFree: safeSlots - survivors.length - 1,
    });
    client.send('apUpdate', { current: newAP.current, max: newAP.max });
  }

  async handleDeliverSurvivors(client: Client, data: DeliverSurvivorsMessage): Promise<void> {
    const auth = client.auth as AuthPayload;

    // Must be at a station
    if (this.ctx._pst(client.sessionId) !== 'station') {
      client.send('deliverSurvivorsResult', { success: false, error: 'Must be at a station' });
      return;
    }

    const survivors = await getPlayerSurvivors(auth.userId);
    if (survivors.length === 0) {
      client.send('deliverSurvivorsResult', { success: false, error: 'No survivors to deliver' });
      return;
    }

    // Calculate rewards
    let totalCredits = 0,
      totalRep = 0,
      totalXp = 0;
    for (const s of survivors) {
      const reward = calculateRescueReward(
        s.sourceType as 'scan_event' | 'npc_quest' | 'comm_distress',
      );
      totalCredits += reward.credits * s.survivorCount;
      totalRep += reward.rep * s.survivorCount;
      totalXp += reward.xp * s.survivorCount;
    }

    await deletePlayerSurvivors(auth.userId);
    await addCredits(auth.userId, totalCredits);
    await this.ctx.applyXpGain(auth.userId, totalXp, client);

    client.send('deliverSurvivorsResult', {
      success: true,
      credits: totalCredits,
      rep: totalRep,
      xp: totalXp,
    });
  }

  // ── Distress Call Detection ─────────────────────────────────────────

  async checkAndEmitDistressCalls(
    client: Client,
    userId: string,
    playerX: number,
    playerY: number,
  ): Promise<void> {
    const ship = this.ctx.getShipForClient(client.sessionId);
    const commRange = ship.commRange;

    // Check nearby sectors for distress calls
    const searchRadius = Math.ceil(commRange / 10);
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const sx = playerX + dx;
        const sy = playerY + dy;
        if (dx === 0 && dy === 0) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > commRange) continue;

        if (checkDistressCall(sx, sy)) {
          const distressId = `distress_${sx}_${sy}`;
          const expiresAt = new Date(Date.now() + RESCUE_EXPIRY_MINUTES * 60 * 1000);

          try {
            await insertDistressCall(distressId, sx, sy, 1, expiresAt);
          } catch {
            /* already exists */
          }

          const callData = generateDistressCallData(playerX, playerY, sx, sy);
          await insertPlayerDistressCall(
            userId,
            distressId,
            callData.direction,
            callData.estimatedDistance,
          );

          client.send('distressCallReceived', {
            id: distressId,
            direction: callData.direction,
            estimatedDistance: callData.estimatedDistance,
            receivedAt: Date.now(),
            expiresAt: expiresAt.getTime(),
            targetX: sx,
            targetY: sy,
          });
        }
      }
    }
  }

  // ── Trade Route Handlers ────────────────────────────────────────────

  async handleConfigureRoute(client: Client, data: ConfigureRouteMessage): Promise<void> {
    const auth = client.auth as AuthPayload;

    // Validate trading post
    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    if (!tradingPost) {
      client.send('configureRouteResult', { success: false, error: 'Trading post not found' });
      return;
    }

    // Validate config
    const routes = await getPlayerTradeRoutes(auth.userId);
    const validation = validateRouteConfig({
      cycleMinutes: data.cycleMinutes,
      routeCount: routes.length,
    });
    if (!validation.valid) {
      client.send('configureRouteResult', { success: false, error: validation.error });
      return;
    }

    const id = `route_${auth.userId}_${Date.now()}`;
    await insertTradeRoute({
      id,
      ownerId: auth.userId,
      tradingPostId: tradingPost.id,
      targetX: data.targetX,
      targetY: data.targetY,
      sellResource: data.sellResource,
      sellAmount: data.sellAmount,
      buyResource: data.buyResource,
      buyAmount: data.buyAmount,
      cycleMinutes: data.cycleMinutes,
    });

    const route = {
      id,
      ownerId: auth.userId,
      tradingPostId: tradingPost.id,
      targetX: data.targetX,
      targetY: data.targetY,
      sellResource: data.sellResource,
      sellAmount: data.sellAmount,
      buyResource: data.buyResource,
      buyAmount: data.buyAmount,
      cycleMinutes: data.cycleMinutes,
      active: true,
      lastCycleAt: null,
    };

    client.send('configureRouteResult', { success: true, route });
  }

  async handleToggleRoute(client: Client, data: ToggleRouteMessage): Promise<void> {
    await updateTradeRouteActive(data.routeId, data.active);
    client.send('toggleRouteResult', { success: true });
  }

  async handleDeleteRoute(client: Client, data: DeleteRouteMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const deleted = await deleteTradeRoute(data.routeId, auth.userId);
    client.send('deleteRouteResult', {
      success: deleted,
      error: deleted ? undefined : 'Route not found',
    });
  }

  async processTradeRoutes(): Promise<void> {
    const routes = await getActiveTradeRoutes();

    // Group routes by owner to avoid repeated queries
    const routesByOwner = new Map<string, typeof routes>();
    for (const route of routes) {
      const ownerRoutes = routesByOwner.get(route.ownerId) ?? [];
      ownerRoutes.push(route);
      routesByOwner.set(route.ownerId, ownerRoutes);
    }

    for (const [ownerId, ownerRoutes] of routesByOwner) {
      try {
        // Load owner data once
        const tradingPost = await getPlayerStructure(ownerId, 'trading_post');
        if (!tradingPost) {
          for (const r of ownerRoutes) await updateTradeRouteActive(r.id, false);
          continue;
        }

        let currentFuel = await getFuelState(ownerId);

        for (const route of ownerRoutes) {
          const lastCycle = route.lastCycleAt ? new Date(route.lastCycleAt).getTime() : null;
          if (!isRouteCycleDue(lastCycle, route.cycleMinutes)) continue;

          try {
            // Calculate fuel cost
            const fuelCost = calculateRouteFuelCost(
              tradingPost.sector_x,
              tradingPost.sector_y,
              route.targetX,
              route.targetY,
            );
            if (!currentFuel || currentFuel < fuelCost) {
              await updateTradeRouteActive(route.id, false);
              continue;
            }

            // Execute sell
            if (route.sellResource && route.sellAmount > 0) {
              const storage = await getStorageInventory(ownerId);
              if (storage) {
                const available = storage[route.sellResource as keyof typeof storage] || 0;
                const sellQty = Math.min(route.sellAmount, available);
                if (sellQty > 0) {
                  const price =
                    NPC_PRICES[route.sellResource as MineableResourceType] * NPC_SELL_SPREAD;
                  await addCredits(ownerId, Math.floor(sellQty * price));
                  await updateStorageResource(ownerId, route.sellResource, -sellQty);
                }
              }
            }

            // Execute buy
            if (route.buyResource && route.buyAmount > 0) {
              const credits = await getPlayerCredits(ownerId);
              const price = NPC_PRICES[route.buyResource as MineableResourceType] * NPC_BUY_SPREAD;
              const affordable = Math.floor(credits / price);
              const buyQty = Math.min(route.buyAmount, affordable);
              if (buyQty > 0) {
                await deductCredits(ownerId, Math.floor(buyQty * price));
                await updateStorageResource(ownerId, route.buyResource, buyQty);
              }
            }

            // Deduct fuel
            currentFuel = currentFuel - fuelCost;
            await saveFuelState(ownerId, currentFuel);

            // Update last cycle
            await updateTradeRouteLastCycle(route.id);
          } catch (err) {
            logger.error({ err, routeId: route.id }, 'Trade route processing error');
          }
        }
      } catch (err) {
        logger.error({ err, ownerId }, 'Trade routes error for owner');
      }
    }
  }

  // ── Quadrant Handlers ───────────────────────────────────────────────

  async handleNameQuadrant(
    client: Client,
    data: { qx: number; qy: number; name: string },
  ): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'nameQuadrant', 1000)) return;
    if (rejectGuest(client, 'nameQuadrant')) return;
    const auth = client.auth as AuthPayload;

    if (!isInt(data?.qx) || !isInt(data?.qy) || typeof data?.name !== 'string') {
      client.send('nameQuadrantResult', { success: false, error: 'Invalid input' });
      return;
    }

    const result = await nameQuadrantEngine(data.qx, data.qy, data.name.trim(), auth.userId);
    client.send('nameQuadrantResult', result);

    if (result.success) {
      // Broadcast the new name to all connected players
      this.ctx.broadcast('announcement', {
        message: `Quadrant (${data.qx},${data.qy}) named "${data.name.trim()}" by ${auth.username}`,
        type: 'quadrant_named',
      });
    }
  }

  async handleGetKnownQuadrants(client: Client): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'getKnownQuadrants', 500)) return;
    if (rejectGuest(client, 'getKnownQuadrants')) return;
    const auth = client.auth as AuthPayload;
    const known = await getPlayerKnownQuadrants(auth.userId);
    client.send('knownQuadrants', { quadrants: known });
  }

  async handleGetKnownJumpGates(client: Client): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'getKnownJumpGates', 500)) return;
    if (rejectGuest(client, 'getKnownJumpGates')) return;
    const auth = client.auth as AuthPayload;
    const gates = await getPlayerKnownJumpGates(auth.userId);
    client.send('knownJumpGates', { gates });
  }

  async handleSyncQuadrants(client: Client): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'syncQuadrants', 2000)) return;
    if (rejectGuest(client, 'syncQuadrants')) return;
    const auth = client.auth as AuthPayload;

    // Only allowed at stations
    const isStation = this.ctx._pst(client.sessionId) === 'station';
    if (!isStation) {
      client.send('syncQuadrantsResult', {
        success: false,
        error: 'Must be at a station to sync quadrant data',
      });
      return;
    }

    // Get all publicly known quadrant coords and batch-insert into player's known list
    const allCoords = await getAllDiscoveredQuadrantCoords();
    await addPlayerKnownQuadrantsBatch(auth.userId, allCoords);

    const known = await getPlayerKnownQuadrants(auth.userId);
    client.send('syncQuadrantsResult', {
      success: true,
      quadrants: known,
      synced: allCoords.length,
    });
  }

  // ── First Contact ───────────────────────────────────────────────────

  async checkFirstContact(
    client: Client,
    auth: AuthPayload,
    targetX: number,
    targetY: number,
  ): Promise<void> {
    try {
      const { qx, qy } = sectorToQuadrant(targetX, targetY);
      const currentQ = sectorToQuadrant(
        this.ctx._px(client.sessionId),
        this.ctx._py(client.sessionId),
      );

      // Only check if entering a different quadrant
      if (qx === currentQ.qx && qy === currentQ.qy) return;

      // Check if quadrant exists already
      const existing = await getQuadrant(qx, qy);
      if (!existing) {
        // First contact! Create quadrant with player as discoverer
        const quadrant = await getOrCreateQuadrant(qx, qy, auth.userId);
        const autoName = generateQuadrantName(quadrant.seed);

        client.send('firstContact', {
          quadrant,
          canName: true,
          autoName,
        });

        // Broadcast to all connected players
        this.ctx.broadcast('announcement', {
          message: `[${quadrant.name}] charted by ${auth.username}`,
          type: 'quadrant_discovery',
        });
      } else {
        // Quadrant exists but player may not know it yet
        await addPlayerKnownQuadrant(auth.userId, qx, qy);
      }
    } catch (err) {
      logger.error({ err }, 'checkFirstContact error');
    }
  }
}
