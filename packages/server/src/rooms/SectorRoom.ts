import colyseus from 'colyseus';
import type { Client } from 'colyseus';
const { Room, ServerError } = colyseus;

import { SectorRoomState, PlayerSchema } from './schema/SectorState.js';
import { verifyToken, type AuthPayload } from '../auth.js';
import { generateSector } from '../engine/worldgen.js';
import { calculateCurrentAP } from '../engine/ap.js';
import { stopMining, calculateMinedAmount } from '../engine/mining.js';
import { generateStationNpcs, getStationFaction, getPirateLevel } from '../engine/npcgen.js';
import { generateStationQuests } from '../engine/questgen.js';
import { validateJump, validateMine, validateJettison, validateLocalScan, validateAreaScan, validateBuild, validateTransfer, validateNpcTrade, validateCreateSlate, validateNpcBuyback, validateFactionAction, validateAcceptQuest, validateBattleAction, createPirateEncounter, getReputationTier, calculateLevel } from '../engine/commands.js';
import { checkScanEvent } from '../engine/scanEvents.js';
import { checkJumpGate, generateGateTarget } from '../engine/jumpgates.js';
import { checkDistressCall, generateDistressCallData, calculateRescueReward, canRescue } from '../engine/rescue.js';
import { calculateBonuses } from '../engine/factionBonuses.js';
import type { FactionBonuses } from '../engine/factionBonuses.js';
import { isRouteCycleDue, calculateRouteFuelCost, validateRouteConfig } from '../engine/tradeRoutes.js';
import { query } from '../db/client.js';
import { getAPState, saveAPState, savePlayerPosition, getPlayerPosition, getMiningState, saveMiningState, getFuelState, saveFuelState } from './services/RedisAPStore.js';
import { getSector, saveSector, addDiscovery, getPlayerDiscoveries, getPlayerCargo, addToCargo, jettisonCargo, getCargoTotal, awardBadge, hasAnyoneBadge, createStructure, deductCargo, saveMessage, getPendingMessages, markMessagesDelivered, getActiveShip, getRecentMessages, getPlayerBaseStructures, getStorageInventory, updateStorageResource, getPlayerCredits, addCredits, deductCredits, getPlayerStructure, upgradeStructureTier, createTradeOrder, getActiveTradeOrders, getPlayerTradeOrders, fulfillTradeOrder, cancelTradeOrder, findPlayerByUsername, createDataSlate, getPlayerSlates, getSlateById, deleteSlate, updateSlateStatus, updateSlateOwner, addSlateToCargo, removeSlateFromCargo, createSlateTradeOrder, getTradeOrderById, createFaction, getFactionById, getPlayerFaction, getFactionMembers, addFactionMember, removeFactionMember, updateMemberRank, updateFactionJoinMode, getFactionByCode, disbandFaction, createFactionInvite, getPlayerFactionInvites, respondToInvite, getPlayerIdByUsername, getFactionMembersByPlayerIds, getPlayerReputations, getPlayerReputation, setPlayerReputation, getPlayerUpgrades, upsertPlayerUpgrade, getActiveQuests, getActiveQuestCount, insertQuest, updateQuestStatus, getQuestById, addPlayerXp, setPlayerLevel, insertScanEvent, getPlayerScanEvents, completeScanEvent, insertBattleLog, updateQuestObjectives, getJumpGate, insertJumpGate, playerHasGateCode, addGateCode, getPlayerSurvivors, insertRescuedSurvivor, deletePlayerSurvivors, insertDistressCall, insertPlayerDistressCall, getPlayerDistressCalls, completeDistressCall, getFactionUpgrades, setFactionUpgrade, getPlayerTradeRoutes, insertTradeRoute, updateTradeRouteActive, deleteTradeRoute, updateTradeRouteLastCycle, getActiveTradeRoutes, getPlayerBookmarks, setPlayerBookmark, clearPlayerBookmark, isRouteDiscovered, getPlayerHomeBase, playerHasBaseAtSector } from '../db/queries.js';
import { AP_COSTS, AP_COSTS_LOCAL_SCAN, AP_COSTS_BY_SCANNER, RADAR_RADIUS, RECONNECTION_TIMEOUT_S, SHIP_CLASSES, STORAGE_TIERS, TRADING_POST_TIERS, SLATE_NPC_PRICE_PER_SECTOR, MAX_ACTIVE_QUESTS, QUEST_EXPIRY_DAYS, FACTION_UPGRADES, BATTLE_NEGOTIATE_COST_PER_LEVEL, FUEL_COST_PER_UNIT, JUMPGATE_FUEL_COST, RESCUE_AP_COST, RESCUE_DELIVER_AP_COST, RESCUE_EXPIRY_MINUTES, FACTION_UPGRADE_TIERS, MAX_TRADE_ROUTES, FREQUENCY_MATCH_THRESHOLD, NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD, FAR_JUMP_AP_DISCOUNT, AUTOPILOT_STEP_MS, EMERGENCY_WARP_FREE_RADIUS, EMERGENCY_WARP_CREDIT_PER_SECTOR, EMERGENCY_WARP_FUEL_GRANT } from '@void-sector/shared';
import type { SectorData, JumpMessage, MineMessage, JettisonMessage, ResourceType, CargoState, BuildMessage, SendChatMessage, ChatMessage, TransferMessage, NpcTradeMessage, UpgradeStructureMessage, PlaceOrderMessage, CreateSlateMessage, ActivateSlateMessage, NpcBuybackMessage, ListSlateMessage, CreateFactionMessage, FactionActionMessage, GetStationNpcsMessage, AcceptQuestMessage, AbandonQuestMessage, Quest, QuestObjective, PlayerReputation, PlayerUpgrade, ReputationTier, NpcFactionId, BattleActionMessage, CompleteScanEventMessage, PirateEncounter, BattleResult, RefuelMessage, UseJumpGateMessage, RescueMessage, DeliverSurvivorsMessage, FactionUpgradeMessage, ConfigureRouteMessage, ToggleRouteMessage, DeleteRouteMessage, FactionUpgradeChoice, SetBookmarkMessage, ClearBookmarkMessage, FarJumpMessage } from '@void-sector/shared';

interface SectorRoomOptions {
  sectorX: number;
  sectorY: number;
}

export class SectorRoom extends Room<SectorRoomState> {
  autoDispose = true;
  private clientShips = new Map<string, typeof SHIP_CLASSES[keyof typeof SHIP_CLASSES]>();
  private autopilotTimers = new Map<string, ReturnType<typeof setInterval>>();

  private getShipForClient(sessionId: string) {
    return this.clientShips.get(sessionId) ?? SHIP_CLASSES.aegis_scout_mk1;
  }

  private async getPlayerBonuses(playerId: string): Promise<FactionBonuses> {
    const faction = await getPlayerFaction(playerId);
    if (!faction) return calculateBonuses([]);
    const upgrades = await getFactionUpgrades(faction.id);
    return calculateBonuses(upgrades.map(u => ({ tier: u.tier, choice: u.choice as 'A' | 'B' })));
  }

  static async onAuth(token: string) {
    if (!token) throw new ServerError(401, 'No token');
    try {
      return verifyToken(token);
    } catch {
      throw new ServerError(403, 'Invalid token');
    }
  }

  async onCreate(options: SectorRoomOptions) {
    const { sectorX, sectorY } = options;
    this.setState(new SectorRoomState());

    // Load or generate sector
    let sectorData = await getSector(sectorX, sectorY);
    if (!sectorData) {
      sectorData = generateSector(sectorX, sectorY, null);
      await saveSector(sectorData);
    }

    this.state.sector.x = sectorData.x;
    this.state.sector.y = sectorData.y;
    this.state.sector.sectorType = sectorData.type;
    this.state.sector.seed = sectorData.seed;

    this.roomId = `sector_${sectorX}_${sectorY}`;

    // Handle jump message
    this.onMessage('jump', async (client, data: JumpMessage) => {
      await this.handleJump(client, data);
    });

    // Handle local scan message
    this.onMessage('localScan', async (client) => {
      await this.handleLocalScan(client);
    });

    // Handle area scan message (with backward compat for 'scan')
    this.onMessage('areaScan', async (client) => {
      await this.handleAreaScan(client);
    });
    this.onMessage('scan', async (client) => {
      await this.handleAreaScan(client);
    });

    // Handle AP query
    this.onMessage('getAP', async (client) => {
      const auth = client.auth as AuthPayload;
      const ap = await getAPState(auth.userId);
      const updated = calculateCurrentAP(ap);
      await saveAPState(auth.userId, updated);
      client.send('apUpdate', updated);
    });

    // Handle discoveries query
    this.onMessage('getDiscoveries', async (client) => {
      const auth = client.auth as AuthPayload;
      const discoveries = await getPlayerDiscoveries(auth.userId);
      client.send('discoveries', discoveries);
    });

    this.onMessage('mine', async (client, data: MineMessage) => {
      await this.handleMine(client, data);
    });

    this.onMessage('stopMine', async (client) => {
      await this.handleStopMine(client);
    });

    this.onMessage('jettison', async (client, data: JettisonMessage) => {
      await this.handleJettison(client, data);
    });

    this.onMessage('getCargo', async (client) => {
      const auth = client.auth as AuthPayload;
      const cargo = await getPlayerCargo(auth.userId);
      client.send('cargoUpdate', cargo);
    });

    this.onMessage('getMiningStatus', async (client) => {
      const auth = client.auth as AuthPayload;
      const mining = await getMiningState(auth.userId);
      client.send('miningUpdate', mining);
    });

    this.onMessage('build', async (client, data: BuildMessage) => {
      await this.handleBuild(client, data);
    });

    this.onMessage('chat', async (client, data: SendChatMessage) => {
      await this.handleChat(client, data);
    });

    this.onMessage('getBase', async (client) => {
      const auth = client.auth as AuthPayload;
      const structures = await getPlayerBaseStructures(auth.userId);
      client.send('baseData', { structures });
    });

    this.onMessage('getCredits', async (client) => {
      const auth = client.auth as AuthPayload;
      const credits = await getPlayerCredits(auth.userId);
      client.send('creditsUpdate', { credits });
    });

    this.onMessage('transfer', async (client, data: TransferMessage) => {
      await this.handleTransfer(client, data);
    });

    this.onMessage('npcTrade', async (client, data: NpcTradeMessage) => {
      await this.handleNpcTrade(client, data);
    });

    this.onMessage('upgradeStructure', async (client, data: UpgradeStructureMessage) => {
      await this.handleUpgradeStructure(client, data);
    });

    this.onMessage('placeOrder', async (client, data: PlaceOrderMessage) => {
      await this.handlePlaceOrder(client, data);
    });

    this.onMessage('getTradeOrders', async (client) => {
      const orders = await getActiveTradeOrders();
      client.send('tradeOrders', { orders });
    });

    this.onMessage('getMyOrders', async (client) => {
      const auth = client.auth as AuthPayload;
      const orders = await getPlayerTradeOrders(auth.userId);
      client.send('myOrders', { orders });
    });

    this.onMessage('cancelOrder', async (client, data: { orderId: string }) => {
      const auth = client.auth as AuthPayload;
      const cancelled = await cancelTradeOrder(data.orderId, auth.userId);
      client.send('cancelOrderResult', { success: cancelled });
    });

    this.onMessage('getStorage', async (client) => {
      const auth = client.auth as AuthPayload;
      const storage = await getStorageInventory(auth.userId);
      client.send('storageUpdate', storage);
    });

    this.onMessage('createSlate', async (client, data: CreateSlateMessage) => {
      await this.handleCreateSlate(client, data);
    });

    this.onMessage('getMySlates', async (client) => {
      const auth = client.auth as AuthPayload;
      const slates = await getPlayerSlates(auth.userId);
      client.send('mySlates', { slates: slates.map(this.mapSlateRow) });
    });

    this.onMessage('activateSlate', async (client, data: ActivateSlateMessage) => {
      await this.handleActivateSlate(client, data);
    });

    this.onMessage('npcBuybackSlate', async (client, data: NpcBuybackMessage) => {
      await this.handleNpcBuyback(client, data);
    });

    this.onMessage('listSlate', async (client, data: ListSlateMessage) => {
      await this.handleListSlate(client, data);
    });

    this.onMessage('acceptSlateOrder', async (client, data: { orderId: string }) => {
      await this.handleAcceptSlateOrder(client, data);
    });

    this.onMessage('createFaction', async (client, data: CreateFactionMessage) => {
      await this.handleCreateFaction(client, data);
    });

    this.onMessage('getFaction', async (client) => {
      await this.sendFactionData(client);
    });

    this.onMessage('factionAction', async (client, data: FactionActionMessage) => {
      await this.handleFactionAction(client, data);
    });

    this.onMessage('respondInvite', async (client, data: { inviteId: string; accept: boolean }) => {
      await this.handleRespondInvite(client, data);
    });

    // Phase 4: NPC Ecosystem
    this.onMessage('getStationNpcs', async (client, data: GetStationNpcsMessage) => {
      await this.handleGetStationNpcs(client, data);
    });
    this.onMessage('acceptQuest', async (client, data: AcceptQuestMessage) => {
      await this.handleAcceptQuest(client, data);
    });
    this.onMessage('abandonQuest', async (client, data: AbandonQuestMessage) => {
      await this.handleAbandonQuest(client, data);
    });
    this.onMessage('getActiveQuests', async (client) => {
      await this.handleGetActiveQuests(client);
    });
    this.onMessage('getReputation', async (client) => {
      await this.handleGetReputation(client);
    });
    this.onMessage('battleAction', async (client, data: BattleActionMessage) => {
      await this.handleBattleAction(client, data);
    });
    this.onMessage('completeScanEvent', async (client, data: CompleteScanEventMessage) => {
      await this.handleCompleteScanEvent(client, data);
    });

    // Phase 5: Fuel
    this.onMessage('refuel', async (client, data: RefuelMessage) => {
      await this.handleRefuel(client, data);
    });

    // Phase 5: Deep Systems
    this.onMessage('useJumpGate', (client, data) => this.handleUseJumpGate(client, data));
    this.onMessage('frequencyMatch', (client, data) => this.handleFrequencyMatch(client, data));
    this.onMessage('rescue', (client, data) => this.handleRescue(client, data));
    this.onMessage('deliverSurvivors', (client, data) => this.handleDeliverSurvivors(client, data));
    this.onMessage('factionUpgrade', (client, data) => this.handleFactionUpgrade(client, data));
    this.onMessage('configureRoute', (client, data) => this.handleConfigureRoute(client, data));
    this.onMessage('toggleRoute', (client, data) => this.handleToggleRoute(client, data));
    this.onMessage('deleteRoute', (client, data) => this.handleDeleteRoute(client, data));

    // Bookmarks
    this.onMessage('getBookmarks', async (client) => {
      const auth = client.auth as AuthPayload;
      const bookmarks = await getPlayerBookmarks(auth.userId);
      client.send('bookmarksUpdate', { bookmarks });
    });

    this.onMessage('setBookmark', async (client, data: SetBookmarkMessage) => {
      const auth = client.auth as AuthPayload;
      if (data.slot < 1 || data.slot > 5) {
        client.send('error', { code: 'INVALID_SLOT', message: 'Bookmark slot must be 1-5' });
        return;
      }
      await setPlayerBookmark(auth.userId, data.slot, data.sectorX, data.sectorY, data.label);
      const bookmarks = await getPlayerBookmarks(auth.userId);
      client.send('bookmarksUpdate', { bookmarks });
    });

    this.onMessage('clearBookmark', async (client, data: ClearBookmarkMessage) => {
      const auth = client.auth as AuthPayload;
      await clearPlayerBookmark(auth.userId, data.slot);
      const bookmarks = await getPlayerBookmarks(auth.userId);
      client.send('bookmarksUpdate', { bookmarks });
    });

    // Far-nav: far-jump + autopilot
    this.onMessage('farJump', async (client, data: FarJumpMessage) => {
      await this.handleFarJump(client, data);
    });
    this.onMessage('emergencyWarp', async (client) => {
      await this.handleEmergencyWarp(client);
    });
    this.onMessage('cancelAutopilot', async (client) => {
      this.handleCancelAutopilot(client);
    });

    // Trade route processing interval
    this.clock.setInterval(() => {
      this.processTradeRoutes().catch(err => console.error('[TRADE ROUTES] Tick error:', err));
    }, 60000);
  }

  async onJoin(client: Client, _options: any, auth: AuthPayload) {
    const player = new PlayerSchema();
    player.sessionId = client.sessionId;
    player.userId = auth.userId;
    player.username = auth.username;
    player.x = this.state.sector.x;
    player.y = this.state.sector.y;
    player.connected = true;

    this.state.players.set(client.sessionId, player);
    this.state.playerCount = this.state.players.size;

    // Save position
    await savePlayerPosition(auth.userId, this.state.sector.x, this.state.sector.y);

    // Load active ship
    const activeShip = await getActiveShip(auth.userId);
    const shipClass = activeShip?.shipClass ?? 'aegis_scout_mk1';
    const shipStats = SHIP_CLASSES[shipClass];
    this.clientShips.set(client.sessionId, shipStats);

    // Send ship data to client
    client.send('shipData', {
      id: '',
      ownerId: auth.userId,
      shipClass,
      fuel: activeShip?.fuel ?? shipStats.fuelMax,
      fuelMax: shipStats.fuelMax,
      jumpRange: shipStats.jumpRange,
      apCostJump: shipStats.apCostJump,
      cargoCap: shipStats.cargoCap,
      scannerLevel: shipStats.scannerLevel,
      safeSlots: shipStats.safeSlots,
      active: true,
    });

    // Init fuel state in Redis
    const existingFuel = await getFuelState(auth.userId);
    if (existingFuel === null) {
      await saveFuelState(auth.userId, shipStats.fuelMax);
    }
    const fuelCurrent = existingFuel ?? shipStats.fuelMax;
    client.send('fuelUpdate', { current: fuelCurrent, max: shipStats.fuelMax });

    // Record discovery
    await addDiscovery(auth.userId, this.state.sector.x, this.state.sector.y);

    // Send initial AP state
    const ap = await getAPState(auth.userId);
    const updated = calculateCurrentAP(ap);
    await saveAPState(auth.userId, updated);
    client.send('apUpdate', updated);

    // Send initial cargo
    const cargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', cargo);

    // Send credits
    const credits = await getPlayerCredits(auth.userId);
    client.send('creditsUpdate', { credits });

    // Send storage
    const storageInv = await getStorageInventory(auth.userId);
    client.send('storageUpdate', storageInv);

    // Send mining state
    const miningState = await getMiningState(auth.userId);
    client.send('miningUpdate', miningState);

    // Deliver pending messages
    const pending = await getPendingMessages(auth.userId);
    if (pending.length > 0) {
      for (const msg of pending) {
        client.send('chatMessage', {
          id: msg.id,
          senderId: msg.sender_id,
          senderName: msg.sender_name,
          channel: msg.channel,
          recipientId: msg.recipient_id,
          content: msg.content,
          sentAt: new Date(msg.sent_at).getTime(),
          delayed: true,
        } as ChatMessage);
      }
      await markMessagesDelivered(pending.map((m: any) => m.id));
    }

    // Send recent local chat history for this sector
    const sectorChannel = `local`;
    const recentMessages = await getRecentMessages(sectorChannel, 50);
    if (recentMessages.length > 0) {
      const history: ChatMessage[] = recentMessages.map((msg: any) => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.sender_name,
        channel: msg.channel,
        recipientId: msg.recipient_id,
        content: msg.content,
        sentAt: new Date(msg.sent_at).getTime(),
        delayed: false,
      }));
      client.send('chatHistory', history);
    }

    // Send bookmarks
    const bookmarks = await getPlayerBookmarks(auth.userId);
    client.send('bookmarksUpdate', { bookmarks });

    // Send all discoveries for far-nav map
    const allDiscoveries = await getPlayerDiscoveries(auth.userId);
    client.send('allDiscoveries', { discoveries: allDiscoveries });

    // Phase 4: Send reputation + active quests
    await this.sendReputationUpdate(client, auth.userId);
    await this.sendActiveQuests(client, auth.userId);
  }

  async onLeave(client: Client, consented: boolean) {
    // Auto-stop mining when leaving
    try {
      const auth = client.auth as AuthPayload;
      const mining = await getMiningState(auth.userId);
      if (mining.active) {
        const cargoTotal = await getCargoTotal(auth.userId);
        const ship = this.getShipForClient(client.sessionId);
        const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
        const result = stopMining(mining, cargoSpace);
        if (result.mined > 0 && result.resource) {
          await addToCargo(auth.userId, result.resource, result.mined);
        }
        await saveMiningState(auth.userId, result.newState);
      }
    } catch {
      // Don't block leave on mining cleanup failure
    }

    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;

    if (!consented) {
      try {
        await this.allowReconnection(client, RECONNECTION_TIMEOUT_S);
        if (player) player.connected = true;
        return;
      } catch {
        // reconnection timed out
      }
    }

    // Clean up autopilot timer
    const autopilotTimer = this.autopilotTimers.get(client.sessionId);
    if (autopilotTimer) {
      clearInterval(autopilotTimer);
      this.autopilotTimers.delete(client.sessionId);
    }

    this.clientShips.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.state.playerCount = this.state.players.size;
  }

  private async handleJump(client: Client, data: JumpMessage) {
    const auth = client.auth as AuthPayload;
    const { targetX, targetY } = data;

    // Check fuel
    const ship = this.getShipForClient(client.sessionId);
    const currentFuel = await getFuelState(auth.userId);
    const fuelCost = ship.fuelPerJump;
    if (currentFuel === null || currentFuel < fuelCost) {
      client.send('jumpResult', { success: false, error: 'Not enough fuel' });
      return;
    }

    // Check mining state and validate jump (rejects if mining is active)
    const mining = await getMiningState(auth.userId);
    const ap = await getAPState(auth.userId);
    const jumpResult = validateJump(
      ap,
      this.state.sector.x,
      this.state.sector.y,
      targetX,
      targetY,
      ship.jumpRange,
      AP_COSTS.jump,
      mining?.active ?? false,
    );
    if (!jumpResult.valid) {
      client.send('jumpResult', { success: false, error: jumpResult.error });
      return;
    }
    await saveAPState(auth.userId, jumpResult.newAP!);

    // Deduct fuel
    const newFuel = currentFuel - fuelCost;
    await saveFuelState(auth.userId, newFuel);

    // Load or generate target sector
    let targetSector = await getSector(targetX, targetY);
    if (!targetSector) {
      targetSector = generateSector(targetX, targetY, auth.userId);
      await saveSector(targetSector);
    }

    // Record discovery
    await addDiscovery(auth.userId, targetX, targetY);

    // Check for origin badge
    if (targetX === 0 && targetY === 0) {
      const isFirst = !(await hasAnyoneBadge('ORIGIN_FIRST'));
      const badgeType = isFirst ? 'ORIGIN_FIRST' : 'ORIGIN_REACHED';
      const awarded = await awardBadge(auth.userId, badgeType);
      if (awarded) {
        client.send('badgeAwarded', { badgeType });
        if (isFirst) {
          this.broadcast('announcement', {
            message: `${auth.username} is the FIRST to reach the Origin!`,
            type: 'origin_first',
          });
        }
      }
    }

    // Phase 4: Check quest progress for arrive/fetch/delivery
    await this.checkQuestProgress(client, auth.userId, 'arrive', { sectorX: targetX, sectorY: targetY });

    // Phase 5: Check for JumpGate at target sector
    let gateInfo = null;
    if (checkJumpGate(targetX, targetY)) {
      let gate = await getJumpGate(targetX, targetY);
      if (!gate) {
        const gateData = generateGateTarget(targetX, targetY);
        const gateId = `gate_${targetX}_${targetY}`;
        await insertJumpGate({ id: gateId, sectorX: targetX, sectorY: targetY, ...gateData });
        gate = { id: gateId, sectorX: targetX, sectorY: targetY, ...gateData };
      }
      const hasCode = gate.requiresCode ? await playerHasGateCode(auth.userId, gate.id) : true;
      gateInfo = {
        id: gate.id,
        gateType: gate.gateType,
        requiresCode: gate.requiresCode,
        requiresMinigame: gate.requiresMinigame,
        hasCode,
      };
    }

    // Tell client to switch rooms
    client.send('jumpResult', {
      success: true,
      newSector: targetSector,
      apRemaining: jumpResult.newAP!.current,
      fuelRemaining: newFuel,
      gateInfo,
    });

    // Phase 5: Check for distress calls in comm range
    await this.checkAndEmitDistressCalls(client, auth.userId, targetX, targetY);

    // Client will leave this room and join the new sector room
  }

  private async handleFarJump(client: Client, data: FarJumpMessage) {
    const auth = client.auth as AuthPayload;
    const { targetX, targetY } = data;

    // Reject if already in autopilot
    if (this.autopilotTimers.has(client.sessionId)) {
      client.send('error', { code: 'FAR_JUMP_FAIL', message: 'Autopilot already active' });
      return;
    }

    // Validate target is discovered
    const discovered = await isRouteDiscovered(auth.userId, targetX, targetY);
    if (!discovered) {
      client.send('error', { code: 'FAR_JUMP_FAIL', message: 'Target sector not discovered' });
      return;
    }

    // Check mining state (reject if mining is active)
    const mining = await getMiningState(auth.userId);
    if (mining?.active) {
      client.send('error', { code: 'FAR_JUMP_FAIL', message: 'Cannot far-jump while mining' });
      return;
    }

    // Get current position
    const pos = await getPlayerPosition(auth.userId);
    if (!pos) {
      client.send('error', { code: 'FAR_JUMP_FAIL', message: 'Position unknown' });
      return;
    }
    const dx = targetX - pos.x;
    const dy = targetY - pos.y;
    const distance = Math.abs(dx) + Math.abs(dy);
    if (distance <= 1) {
      client.send('error', { code: 'FAR_JUMP_FAIL', message: 'Use normal jump for adjacent sectors' });
      return;
    }

    // Get ship stats
    const ship = this.getShipForClient(client.sessionId);

    // Calculate costs with far-jump discount
    const apCost = Math.ceil(distance * ship.apCostJump * FAR_JUMP_AP_DISCOUNT);
    const fuelCost = distance * ship.fuelPerJump;

    // Validate AP
    const ap = await getAPState(auth.userId);
    const updated = calculateCurrentAP(ap);
    if (updated.current < apCost) {
      client.send('error', { code: 'FAR_JUMP_FAIL', message: `Not enough AP (need ${apCost}, have ${updated.current})` });
      return;
    }

    // Validate fuel
    const currentFuel = await getFuelState(auth.userId);
    if (currentFuel === null || currentFuel < fuelCost) {
      client.send('error', { code: 'FAR_JUMP_FAIL', message: `Not enough fuel (need ${fuelCost}, have ${currentFuel ?? 0})` });
      return;
    }

    // Deduct AP upfront
    const newAP = { ...updated, current: updated.current - apCost };
    await saveAPState(auth.userId, newAP);
    client.send('apUpdate', newAP);

    // Deduct fuel upfront
    const newFuel = currentFuel - fuelCost;
    await saveFuelState(auth.userId, newFuel);
    client.send('fuelUpdate', { current: newFuel, max: ship.fuelMax });

    // Build step list (Manhattan path: X first, then Y)
    const steps: { x: number; y: number }[] = [];
    let cx = pos.x;
    let cy = pos.y;
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    for (let i = 0; i < Math.abs(dx); i++) { cx += stepX; steps.push({ x: cx, y: cy }); }
    for (let i = 0; i < Math.abs(dy); i++) { cy += stepY; steps.push({ x: cx, y: cy }); }

    // Start autopilot
    let stepIndex = 0;
    client.send('autopilotStart', { targetX, targetY, totalSteps: steps.length });

    const timer = setInterval(async () => {
      try {
        if (stepIndex >= steps.length) {
          clearInterval(timer);
          this.autopilotTimers.delete(client.sessionId);
          // Save final position and record discovery
          await savePlayerPosition(auth.userId, targetX, targetY);
          await addDiscovery(auth.userId, targetX, targetY);
          // Load or generate target sector
          let targetSector = await getSector(targetX, targetY);
          if (!targetSector) {
            targetSector = generateSector(targetX, targetY, auth.userId);
            await saveSector(targetSector);
          }
          client.send('autopilotComplete', { x: targetX, y: targetY, sector: targetSector });
          return;
        }
        const step = steps[stepIndex];
        // Save position and record discovery for intermediate step
        await savePlayerPosition(auth.userId, step.x, step.y);
        await addDiscovery(auth.userId, step.x, step.y);
        stepIndex++;
        client.send('autopilotUpdate', { x: step.x, y: step.y, remaining: steps.length - stepIndex });
      } catch (err) {
        console.error('[FAR_JUMP] Autopilot step error:', err);
        clearInterval(timer);
        this.autopilotTimers.delete(client.sessionId);
        client.send('autopilotComplete', { x: -1, y: -1 });
      }
    }, AUTOPILOT_STEP_MS);

    this.autopilotTimers.set(client.sessionId, timer);
  }

  private handleCancelAutopilot(client: Client) {
    const timer = this.autopilotTimers.get(client.sessionId);
    if (timer) {
      clearInterval(timer);
      this.autopilotTimers.delete(client.sessionId);
      client.send('autopilotComplete', { x: -1, y: -1 });
    }
  }

  private async handleRefuel(client: Client, data: RefuelMessage) {
    const auth = client.auth as AuthPayload;

    // Must be at a station or own base
    const isStation = this.state.sector.sectorType === 'station';
    const hasBaseHere = await playerHasBaseAtSector(
      auth.userId, this.state.sector.x, this.state.sector.y
    );
    if (!isStation && !hasBaseHere) {
      client.send('refuelResult', { success: false, error: 'Must be at a station or your base to refuel' });
      return;
    }

    const ship = this.getShipForClient(client.sessionId);
    const currentFuel = await getFuelState(auth.userId) ?? 0;
    const tankSpace = ship.fuelMax - currentFuel;

    if (tankSpace <= 0) {
      client.send('refuelResult', { success: false, error: 'Fuel tank is full' });
      return;
    }

    const amount = Math.min(data.amount, tankSpace);
    const cost = Math.ceil(amount * FUEL_COST_PER_UNIT);

    const credits = await getPlayerCredits(auth.userId);
    if (credits < cost) {
      client.send('refuelResult', { success: false, error: 'Not enough credits' });
      return;
    }

    await deductCredits(auth.userId, cost);
    const newFuel = currentFuel + amount;
    await saveFuelState(auth.userId, newFuel);

    const remainingCredits = await getPlayerCredits(auth.userId);

    client.send('refuelResult', {
      success: true,
      fuel: { current: newFuel, max: ship.fuelMax },
      credits: remainingCredits,
    });
  }

  private async handleEmergencyWarp(client: Client) {
    const auth = client.auth as AuthPayload;

    // Only available when fuel is empty
    const ship = this.getShipForClient(client.sessionId);
    const currentFuel = await getFuelState(auth.userId) ?? 0;
    if (currentFuel > 0) {
      client.send('emergencyWarpResult', { success: false, error: 'Emergency warp only available when fuel is empty' });
      return;
    }

    // Reject if autopilot is active
    if (this.autopilotTimers.has(client.sessionId)) {
      client.send('emergencyWarpResult', { success: false, error: 'Cannot warp during autopilot' });
      return;
    }

    // Reject if mining is active
    const mining = await getMiningState(auth.userId);
    if (mining?.active) {
      client.send('emergencyWarpResult', { success: false, error: 'Cannot warp while mining' });
      return;
    }

    // Get home base coordinates
    const homeBase = await getPlayerHomeBase(auth.userId);
    const currentX = this.state.sector.x;
    const currentY = this.state.sector.y;
    const distance = Math.abs(homeBase.x - currentX) + Math.abs(homeBase.y - currentY);

    // Already at home base
    if (distance === 0) {
      client.send('emergencyWarpResult', { success: false, error: 'Already at home base' });
      return;
    }

    // Calculate cost — free within radius, credits per sector beyond
    let creditCost = 0;
    if (distance > EMERGENCY_WARP_FREE_RADIUS) {
      creditCost = (distance - EMERGENCY_WARP_FREE_RADIUS) * EMERGENCY_WARP_CREDIT_PER_SECTOR;
      const credits = await getPlayerCredits(auth.userId);
      if (credits < creditCost) {
        client.send('emergencyWarpResult', {
          success: false,
          error: `Not enough credits (need ${creditCost}, have ${credits})`,
        });
        return;
      }
      await deductCredits(auth.userId, creditCost);
    }

    // Load or generate home base sector
    let targetSector = await getSector(homeBase.x, homeBase.y);
    if (!targetSector) {
      targetSector = generateSector(homeBase.x, homeBase.y, auth.userId);
      await saveSector(targetSector);
    }

    // Grant emergency fuel
    await saveFuelState(auth.userId, EMERGENCY_WARP_FUEL_GRANT);
    client.send('fuelUpdate', { current: EMERGENCY_WARP_FUEL_GRANT, max: ship.fuelMax });

    // Save new position
    await savePlayerPosition(auth.userId, homeBase.x, homeBase.y);

    // Record discovery of home sector
    await addDiscovery(auth.userId, homeBase.x, homeBase.y);

    // Get remaining credits
    const remainingCredits = await getPlayerCredits(auth.userId);

    // Send result — client will handle room switch like a jump
    client.send('emergencyWarpResult', {
      success: true,
      newSector: targetSector,
      fuelGranted: EMERGENCY_WARP_FUEL_GRANT,
      creditCost,
      credits: remainingCredits,
    });
  }

  private async handleLocalScan(client: Client) {
    const auth = client.auth as AuthPayload;
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const scannerLevel = this.getShipForClient(client.sessionId).scannerLevel;

    const result = validateLocalScan(currentAP, AP_COSTS_LOCAL_SCAN, scannerLevel);
    if (!result.valid) {
      client.send('error', { code: 'LOCAL_SCAN_FAIL', message: result.error! });
      return;
    }

    await saveAPState(auth.userId, result.newAP!);

    const sectorData = await getSector(this.state.sector.x, this.state.sector.y);
    const resources = sectorData?.resources ?? { ore: 0, gas: 0, crystal: 0 };

    client.send('localScanResult', {
      resources,
      hiddenSignatures: result.hiddenSignatures,
    });
    client.send('apUpdate', result.newAP!);

    // Phase 4: Check for scan events
    await this.checkAndEmitScanEvents(client, [{ x: this.state.sector.x, y: this.state.sector.y }]);
  }

  private async handleAreaScan(client: Client) {
    const auth = client.auth as AuthPayload;
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const scannerLevel = this.getShipForClient(client.sessionId).scannerLevel;

    const scanResult = validateAreaScan(currentAP, scannerLevel);
    if (!scanResult.valid) {
      client.send('error', { code: 'SCAN_FAIL', message: scanResult.error! });
      return;
    }

    await saveAPState(auth.userId, scanResult.newAP!);

    // Apply faction scan radius bonus
    const bonuses = await this.getPlayerBonuses(auth.userId);
    const radius = scanResult.radius + bonuses.scanRadiusBonus;
    const sectorX = this.state.sector.x;
    const sectorY = this.state.sector.y;
    const sectors: SectorData[] = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const tx = sectorX + dx;
        const ty = sectorY + dy;
        let sector = await getSector(tx, ty);
        if (!sector) {
          sector = generateSector(tx, ty, auth.userId);
          await saveSector(sector);
        }
        await addDiscovery(auth.userId, tx, ty);
        sectors.push(sector);
      }
    }

    // Phase 4: Check for scan events in scanned sectors (skip pirate ambush — remote scan can't trigger physical encounters)
    await this.checkAndEmitScanEvents(client, sectors.map(s => ({ x: s.x, y: s.y })), false);

    client.send('scanResult', { sectors, apRemaining: scanResult.newAP!.current });

    // Phase 4: Check quest progress for scan quests
    for (const s of sectors) {
      await this.checkQuestProgress(client, auth.userId, 'scan', { sectorX: s.x, sectorY: s.y });
    }
  }

  private async handleMine(client: Client, data: MineMessage) {
    const auth = client.auth as AuthPayload;
    const { resource } = data;

    const sectorData = await getSector(this.state.sector.x, this.state.sector.y);
    if (!sectorData?.resources) {
      client.send('error', { code: 'NO_RESOURCES', message: 'No resources in this sector' });
      return;
    }

    const current = await getMiningState(auth.userId);
    const cargoTotal = await getCargoTotal(auth.userId);
    const ship = this.getShipForClient(client.sessionId);

    const result = validateMine(
      resource,
      sectorData.resources,
      current,
      cargoTotal,
      ship.cargoCap,
      this.state.sector.x,
      this.state.sector.y,
    );
    if (!result.valid) {
      client.send('error', { code: 'MINE_FAILED', message: result.error! });
      return;
    }

    // Apply faction mining bonus
    const bonuses = await this.getPlayerBonuses(auth.userId);
    result.state!.rate *= bonuses.miningRateMultiplier;

    await saveMiningState(auth.userId, result.state!);
    client.send('miningUpdate', result.state!);
  }

  private async handleStopMine(client: Client) {
    const auth = client.auth as AuthPayload;

    const mining = await getMiningState(auth.userId);
    if (!mining.active) {
      client.send('error', { code: 'NOT_MINING', message: 'Not currently mining' });
      return;
    }

    const cargoTotal = await getCargoTotal(auth.userId);
    const ship = this.getShipForClient(client.sessionId);
    const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
    const result = stopMining(mining, cargoSpace);

    if (result.mined > 0 && result.resource) {
      await addToCargo(auth.userId, result.resource, result.mined);
    }

    await saveMiningState(auth.userId, result.newState);

    const cargo = await getPlayerCargo(auth.userId);
    client.send('miningUpdate', result.newState);
    client.send('cargoUpdate', cargo);
  }

  private async handleJettison(client: Client, data: JettisonMessage) {
    const auth = client.auth as AuthPayload;
    const { resource } = data;

    const cargo = await getPlayerCargo(auth.userId);
    const currentAmount = cargo[resource as keyof CargoState] ?? 0;

    const result = validateJettison(resource, currentAmount);
    if (!result.valid) {
      client.send('error', { code: 'JETTISON_FAILED', message: result.error! });
      return;
    }

    await jettisonCargo(auth.userId, resource);
    const updatedCargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', updatedCargo);
  }

  private async handleBuild(client: Client, data: BuildMessage) {
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
          client.send('buildResult', { success: false, error: `Insufficient ${resource} (concurrent modification)` });
          return;
        }
      }
    }

    let structure;
    try {
      structure = await createStructure(
        auth.userId, data.type,
        this.state.sector.x, this.state.sector.y
      );
    } catch (err: any) {
      if (err.code === '23505') {
        client.send('buildResult', { success: false, error: 'Structure already exists in this sector' });
        return;
      }
      client.send('buildResult', { success: false, error: 'Build failed — try again' });
      return;
    }

    client.send('buildResult', { success: true, structure });
    client.send('apUpdate', result.newAP!);
    const updatedCargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    this.broadcast('structureBuilt', {
      structure,
      sectorX: this.state.sector.x,
      sectorY: this.state.sector.y,
    });
  }

  private async handleChat(client: Client, data: SendChatMessage) {
    const auth = client.auth as AuthPayload;

    // Validate channel
    const VALID_CHANNELS = ['local', 'direct', 'faction'] as const;
    if (!VALID_CHANNELS.includes(data.channel as any)) {
      client.send('error', { code: 'INVALID_CHANNEL', message: 'Unknown channel' });
      return;
    }

    if (!data.content || data.content.trim().length === 0) return;
    if (data.content.length > 500) {
      client.send('error', { code: 'MSG_TOO_LONG', message: 'Message too long (max 500 chars)' });
      return;
    }

    if (data.channel === 'faction') {
      const faction = await getPlayerFaction(auth.userId);
      if (!faction) {
        client.send('error', { code: 'NO_FACTION', message: 'Not in a faction' });
        return;
      }
      const msg = await saveMessage(auth.userId, null, 'faction', data.content.trim());
      const chatMsg: ChatMessage = {
        id: msg.id,
        senderId: auth.userId,
        senderName: auth.username,
        channel: 'faction',
        content: data.content.trim(),
        sentAt: new Date(msg.sent_at).getTime(),
        delayed: false,
      };
      const memberIds = await getFactionMembersByPlayerIds(faction.id);
      for (const c of this.clients) {
        const cAuth = c.auth as AuthPayload;
        if (memberIds.includes(cAuth.userId)) {
          c.send('chatMessage', chatMsg);
        }
      }
      return;
    }

    const msg = await saveMessage(auth.userId, data.recipientId ?? null, data.channel, data.content.trim());

    const chatMsg: ChatMessage = {
      id: msg.id,
      senderId: auth.userId,
      senderName: auth.username,
      channel: data.channel,
      recipientId: data.recipientId,
      content: data.content.trim(),
      sentAt: new Date(msg.sent_at).getTime(),
      delayed: false,
    };

    if (data.channel === 'local') {
      this.broadcast('chatMessage', chatMsg);
    } else if (data.channel === 'direct' && data.recipientId) {
      const recipientClient = this.clients.find(
        c => (c.auth as AuthPayload).userId === data.recipientId
      );
      if (recipientClient) {
        recipientClient.send('chatMessage', chatMsg);
      }
      client.send('chatMessage', chatMsg);
    }
  }

  private async handleTransfer(client: Client, data: TransferMessage) {
    const auth = client.auth as AuthPayload;
    const { resource, amount, direction } = data;

    const player = await findPlayerByUsername(auth.username);
    if (!player) { client.send('error', { code: 'NO_PLAYER', message: 'Player not found' }); return; }
    if (this.state.sector.x !== player.homeBase.x || this.state.sector.y !== player.homeBase.y) {
      client.send('transferResult', { success: false, error: 'Must be at home base' });
      return;
    }

    const storageStruct = await getPlayerStructure(auth.userId, 'storage');
    if (!storageStruct) {
      client.send('transferResult', { success: false, error: 'No storage built' });
      return;
    }

    const currentCargo = await getPlayerCargo(auth.userId);
    const storage = await getStorageInventory(auth.userId);
    const result = validateTransfer(direction, resource, amount, currentCargo, storage, storageStruct.tier);
    if (!result.valid) {
      client.send('transferResult', { success: false, error: result.error });
      return;
    }

    if (direction === 'toStorage') {
      const deducted = await deductCargo(auth.userId, resource, amount);
      if (!deducted) { client.send('transferResult', { success: false, error: 'Cargo changed' }); return; }
      await updateStorageResource(auth.userId, resource, amount);
    } else {
      await updateStorageResource(auth.userId, resource, -amount);
      await addToCargo(auth.userId, resource, amount);
    }

    const updatedCargo = await getPlayerCargo(auth.userId);
    const updatedStorage = await getStorageInventory(auth.userId);
    client.send('transferResult', { success: true, cargo: updatedCargo, storage: updatedStorage });
    client.send('cargoUpdate', updatedCargo);
    client.send('storageUpdate', updatedStorage);
  }

  private async handleNpcTrade(client: Client, data: NpcTradeMessage) {
    const auth = client.auth as AuthPayload;
    const { resource, amount, action } = data;

    const player = await findPlayerByUsername(auth.username);
    if (!player) return;
    if (this.state.sector.x !== player.homeBase.x || this.state.sector.y !== player.homeBase.y) {
      client.send('npcTradeResult', { success: false, error: 'Must be at home base' });
      return;
    }

    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    if (!tradingPost) {
      client.send('npcTradeResult', { success: false, error: 'No trading post built' });
      return;
    }

    const storageStruct = await getPlayerStructure(auth.userId, 'storage');
    const storageTier = storageStruct?.tier ?? 1;
    const currentCredits = await getPlayerCredits(auth.userId);
    const storage = await getStorageInventory(auth.userId);

    const result = validateNpcTrade(action, resource, amount, currentCredits, storage, storageTier);
    if (!result.valid) {
      client.send('npcTradeResult', { success: false, error: result.error });
      return;
    }

    // Apply faction trade price bonus (discount on buy prices)
    const bonuses = await this.getPlayerBonuses(auth.userId);
    if (action === 'buy') {
      result.totalPrice = Math.ceil(result.totalPrice * bonuses.tradePriceMultiplier);
    }

    if (action === 'sell') {
      await updateStorageResource(auth.userId, resource, -amount);
      const newCredits = await addCredits(auth.userId, result.totalPrice);
      const updatedStorage = await getStorageInventory(auth.userId);
      client.send('npcTradeResult', { success: true, credits: newCredits, storage: updatedStorage });
      client.send('creditsUpdate', { credits: newCredits });
      client.send('storageUpdate', updatedStorage);
    } else {
      const deducted = await deductCredits(auth.userId, result.totalPrice);
      if (!deducted) { client.send('npcTradeResult', { success: false, error: 'Credits changed' }); return; }
      await updateStorageResource(auth.userId, resource, amount);
      const newCredits = await getPlayerCredits(auth.userId);
      const updatedStorage = await getStorageInventory(auth.userId);
      client.send('npcTradeResult', { success: true, credits: newCredits, storage: updatedStorage });
      client.send('creditsUpdate', { credits: newCredits });
      client.send('storageUpdate', updatedStorage);
    }
  }

  private async handleUpgradeStructure(client: Client, data: UpgradeStructureMessage) {
    const auth = client.auth as AuthPayload;
    const { structureId } = data;

    const struct = await query<{ id: string; type: string; tier: number; owner_id: string }>(
      'SELECT id, type, tier, owner_id FROM structures WHERE id = $1',
      [structureId]
    );
    const row = struct.rows[0];
    if (!row || row.owner_id !== auth.userId) {
      client.send('upgradeResult', { success: false, error: 'Structure not found' });
      return;
    }

    const tierMap = row.type === 'storage' ? STORAGE_TIERS : row.type === 'trading_post' ? TRADING_POST_TIERS : null;
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

  private async handlePlaceOrder(client: Client, data: PlaceOrderMessage) {
    const auth = client.auth as AuthPayload;
    const { resource, amount, pricePerUnit, type } = data;

    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    if (!tradingPost || tradingPost.tier < 2) {
      client.send('error', { code: 'NO_MARKET', message: 'Need Trading Post Tier 2+' });
      return;
    }

    if (amount <= 0 || pricePerUnit <= 0) {
      client.send('error', { code: 'INVALID_ORDER', message: 'Invalid amount or price' });
      return;
    }

    if (type === 'sell') {
      const storage = await getStorageInventory(auth.userId);
      if (storage[resource as keyof typeof storage] < amount) {
        client.send('error', { code: 'INSUFFICIENT', message: `Not enough ${resource} in storage` });
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

  private async handleCreateSlate(client: Client, data: CreateSlateMessage) {
    const auth = client.auth as AuthPayload;
    if (!['sector', 'area'].includes(data.slateType)) {
      client.send('createSlateResult', { success: false, error: 'Invalid slate type' });
      return;
    }

    const ship = this.getShipForClient(client.sessionId);
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const cargo = await getPlayerCargo(auth.userId);
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates;

    const validation = validateCreateSlate(
      { ap: currentAP.current, scannerLevel: ship.scannerLevel, cargoTotal, cargoCap: ship.cargoCap },
      data.slateType
    );
    if (!validation.valid) {
      client.send('createSlateResult', { success: false, error: validation.error });
      return;
    }

    // Gather sector data
    let sectorData: any[];
    const sectorX = this.state.sector.x;
    const sectorY = this.state.sector.y;

    if (data.slateType === 'sector') {
      const sector = await getSector(sectorX, sectorY);
      const resources = sector?.resources ?? { ore: 0, gas: 0, crystal: 0 };
      sectorData = [{
        x: sectorX, y: sectorY,
        type: sector?.type ?? 'empty',
        ore: resources.ore ?? 0, gas: resources.gas ?? 0, crystal: resources.crystal ?? 0,
      }];
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
              x: disc.x, y: disc.y,
              type: sector.type ?? 'empty',
              ore: resources.ore ?? 0, gas: resources.gas ?? 0, crystal: resources.crystal ?? 0,
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

  private async handleActivateSlate(client: Client, data: ActivateSlateMessage) {
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

  private async handleNpcBuyback(client: Client, data: NpcBuybackMessage) {
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

  private async handleListSlate(client: Client, data: ListSlateMessage) {
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

  private async handleAcceptSlateOrder(client: Client, data: { orderId: string }) {
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
    const ship = this.getShipForClient(client.sessionId);
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates;
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

  private async sendFactionData(client: Client) {
    const auth = client.auth as AuthPayload;
    const factionRow = await getPlayerFaction(auth.userId);

    if (!factionRow) {
      const invites = await getPlayerFactionInvites(auth.userId);
      client.send('factionData', { faction: null, members: [], invites });
      return;
    }

    const members = await getFactionMembers(factionRow.id);
    const invites = await getPlayerFactionInvites(auth.userId);

    client.send('factionData', {
      faction: {
        id: factionRow.id,
        name: factionRow.name,
        tag: factionRow.tag,
        leaderId: factionRow.leader_id,
        leaderName: factionRow.leader_name,
        joinMode: factionRow.join_mode,
        inviteCode: factionRow.invite_code,
        memberCount: Number(factionRow.member_count),
        createdAt: new Date(factionRow.created_at).getTime(),
      },
      members: members.map(m => ({
        playerId: m.player_id,
        playerName: m.player_name,
        rank: m.rank,
        joinedAt: new Date(m.joined_at).getTime(),
      })),
      invites,
    });
  }

  private async handleCreateFaction(client: Client, data: CreateFactionMessage) {
    const auth = client.auth as AuthPayload;

    if (!data.name || data.name.trim().length < 3 || data.name.trim().length > 64) {
      client.send('createFactionResult', { success: false, error: 'Name must be 3-64 characters' });
      return;
    }
    if (!data.tag || data.tag.trim().length < 3 || data.tag.trim().length > 5) {
      client.send('createFactionResult', { success: false, error: 'Tag must be 3-5 characters' });
      return;
    }
    if (!['open', 'code', 'invite'].includes(data.joinMode)) {
      client.send('createFactionResult', { success: false, error: 'Invalid join mode' });
      return;
    }

    const existing = await getPlayerFaction(auth.userId);
    if (existing) {
      client.send('createFactionResult', { success: false, error: 'Already in a faction' });
      return;
    }

    try {
      await createFaction(auth.userId, data.name.trim(), data.tag.trim().toUpperCase(), data.joinMode);
      await this.sendFactionData(client);
      client.send('createFactionResult', { success: true });
    } catch (err: any) {
      if (err.code === '23505') {
        client.send('createFactionResult', { success: false, error: 'Name or tag already taken' });
      } else {
        throw err;
      }
    }
  }

  private async handleFactionAction(client: Client, data: FactionActionMessage) {
    const auth = client.auth as AuthPayload;
    const myFaction = await getPlayerFaction(auth.userId);

    if (data.action === 'join') {
      return this.handleJoinFaction(client, auth, data);
    }
    if (data.action === 'joinCode') {
      return this.handleJoinByCode(client, auth, data);
    }
    if (data.action === 'leave') {
      return this.handleLeaveFaction(client, auth, myFaction);
    }

    if (!myFaction) {
      client.send('factionActionResult', { success: false, action: data.action, error: 'Not in a faction' });
      return;
    }

    const myRank = myFaction.player_rank;

    if (data.action === 'invite') {
      return this.handleFactionInvite(client, auth, myFaction, data);
    }

    if (data.action === 'disband') {
      const v = validateFactionAction('disband', myRank);
      if (!v.valid) {
        client.send('factionActionResult', { success: false, action: 'disband', error: v.error });
        return;
      }
      await disbandFaction(myFaction.id);
      client.send('factionActionResult', { success: true, action: 'disband' });
      await this.sendFactionData(client);
      return;
    }

    if (data.action === 'setJoinMode') {
      const v = validateFactionAction('setJoinMode', myRank);
      if (!v.valid) {
        client.send('factionActionResult', { success: false, action: 'setJoinMode', error: v.error });
        return;
      }
      if (!data.joinMode || !['open', 'code', 'invite'].includes(data.joinMode)) {
        client.send('factionActionResult', { success: false, action: 'setJoinMode', error: 'Invalid mode' });
        return;
      }
      await updateFactionJoinMode(myFaction.id, data.joinMode);
      client.send('factionActionResult', { success: true, action: 'setJoinMode' });
      await this.sendFactionData(client);
      return;
    }

    if (!data.targetPlayerId) {
      client.send('factionActionResult', { success: false, action: data.action, error: 'No target' });
      return;
    }

    const targetMembers = await getFactionMembers(myFaction.id);
    const target = targetMembers.find(m => m.player_id === data.targetPlayerId);
    if (!target) {
      client.send('factionActionResult', { success: false, action: data.action, error: 'Target not in faction' });
      return;
    }

    const v = validateFactionAction(data.action, myRank, target.rank);
    if (!v.valid) {
      client.send('factionActionResult', { success: false, action: data.action, error: v.error });
      return;
    }

    if (data.action === 'kick') {
      await removeFactionMember(myFaction.id, data.targetPlayerId);
    } else if (data.action === 'promote') {
      await updateMemberRank(myFaction.id, data.targetPlayerId, 'officer');
    } else if (data.action === 'demote') {
      await updateMemberRank(myFaction.id, data.targetPlayerId, 'member');
    }

    client.send('factionActionResult', { success: true, action: data.action });
    await this.sendFactionData(client);
  }

  private async handleJoinFaction(client: Client, auth: AuthPayload, data: FactionActionMessage) {
    if (!data.targetPlayerId) {
      client.send('factionActionResult', { success: false, action: 'join', error: 'No faction specified' });
      return;
    }
    const existing = await getPlayerFaction(auth.userId);
    if (existing) {
      client.send('factionActionResult', { success: false, action: 'join', error: 'Already in a faction' });
      return;
    }
    const faction = await getFactionById(data.targetPlayerId);
    if (!faction || faction.join_mode !== 'open') {
      client.send('factionActionResult', { success: false, action: 'join', error: 'Faction not open' });
      return;
    }
    await addFactionMember(data.targetPlayerId, auth.userId);
    client.send('factionActionResult', { success: true, action: 'join' });
    await this.sendFactionData(client);
  }

  private async handleJoinByCode(client: Client, auth: AuthPayload, data: FactionActionMessage) {
    if (!data.code) {
      client.send('factionActionResult', { success: false, action: 'joinCode', error: 'No code' });
      return;
    }
    const existing = await getPlayerFaction(auth.userId);
    if (existing) {
      client.send('factionActionResult', { success: false, action: 'joinCode', error: 'Already in a faction' });
      return;
    }
    const faction = await getFactionByCode(data.code.toUpperCase());
    if (!faction || faction.join_mode !== 'code') {
      client.send('factionActionResult', { success: false, action: 'joinCode', error: 'Invalid code' });
      return;
    }
    await addFactionMember(faction.id, auth.userId);
    client.send('factionActionResult', { success: true, action: 'joinCode' });
    await this.sendFactionData(client);
  }

  private async handleLeaveFaction(client: Client, auth: AuthPayload, faction: any) {
    if (!faction) {
      client.send('factionActionResult', { success: false, action: 'leave', error: 'Not in faction' });
      return;
    }
    if (faction.player_rank === 'leader') {
      client.send('factionActionResult', { success: false, action: 'leave', error: 'Leader cannot leave — disband instead' });
      return;
    }
    await removeFactionMember(faction.id, auth.userId);
    client.send('factionActionResult', { success: true, action: 'leave' });
    await this.sendFactionData(client);
  }

  private async handleFactionInvite(client: Client, auth: AuthPayload, faction: any, data: FactionActionMessage) {
    const v = validateFactionAction('invite', faction.player_rank);
    if (!v.valid) {
      client.send('factionActionResult', { success: false, action: 'invite', error: v.error });
      return;
    }
    if (!data.targetPlayerName) {
      client.send('factionActionResult', { success: false, action: 'invite', error: 'No player name' });
      return;
    }
    const targetId = await getPlayerIdByUsername(data.targetPlayerName);
    if (!targetId) {
      client.send('factionActionResult', { success: false, action: 'invite', error: 'Player not found' });
      return;
    }
    const targetFaction = await getPlayerFaction(targetId);
    if (targetFaction) {
      client.send('factionActionResult', { success: false, action: 'invite', error: 'Player already in a faction' });
      return;
    }
    await createFactionInvite(faction.id, auth.userId, targetId);
    client.send('factionActionResult', { success: true, action: 'invite' });
  }

  private async handleRespondInvite(client: Client, data: { inviteId: string; accept: boolean }) {
    const auth = client.auth as AuthPayload;
    const invite = await respondToInvite(data.inviteId, auth.userId, data.accept);
    if (!invite) {
      client.send('factionActionResult', { success: false, action: 'respondInvite', error: 'Invite not found' });
      return;
    }
    if (data.accept) {
      await addFactionMember(invite.faction_id, auth.userId);
    }
    client.send('factionActionResult', { success: true, action: 'respondInvite' });
    await this.sendFactionData(client);
  }

  // --- Phase 4: NPC Ecosystem Handlers ---

  private async handleGetStationNpcs(client: Client, data: GetStationNpcsMessage) {
    const auth = client.auth as AuthPayload;
    const npcs = generateStationNpcs(data.sectorX, data.sectorY);
    const reps = await getPlayerReputations(auth.userId);
    const faction = getStationFaction(data.sectorX, data.sectorY);
    const factionRep = reps.find(r => r.faction_id === faction)?.reputation ?? 0;
    const tier = getReputationTier(factionRep) as ReputationTier;
    const dayOfYear = Math.floor(Date.now() / 86400000);
    const quests = generateStationQuests(data.sectorX, data.sectorY, dayOfYear, tier);
    client.send('stationNpcsResult', { npcs, quests });
  }

  private async handleAcceptQuest(client: Client, data: AcceptQuestMessage) {
    const auth = client.auth as AuthPayload;
    const count = await getActiveQuestCount(auth.userId);
    const validation = validateAcceptQuest(count);
    if (!validation.valid) {
      client.send('acceptQuestResult', { success: false, error: validation.error });
      return;
    }

    // Regenerate quest from template to validate it exists
    const reps = await getPlayerReputations(auth.userId);
    const faction = getStationFaction(data.stationX, data.stationY);
    const factionRep = reps.find(r => r.faction_id === faction)?.reputation ?? 0;
    const tier = getReputationTier(factionRep) as ReputationTier;
    const dayOfYear = Math.floor(Date.now() / 86400000);
    const available = generateStationQuests(data.stationX, data.stationY, dayOfYear, tier);
    const questTemplate = available.find(q => q.templateId === data.templateId);

    if (!questTemplate) {
      client.send('acceptQuestResult', { success: false, error: 'Quest not available' });
      return;
    }

    const expiresAt = new Date(Date.now() + QUEST_EXPIRY_DAYS * 86400000);
    const questId = await insertQuest(
      auth.userId, data.templateId, data.stationX, data.stationY,
      questTemplate.objectives, questTemplate.rewards, expiresAt,
    );

    const quest: Quest = {
      id: questId,
      templateId: data.templateId,
      npcName: questTemplate.npcName,
      npcFactionId: questTemplate.npcFactionId,
      title: questTemplate.title,
      description: questTemplate.description,
      stationX: data.stationX,
      stationY: data.stationY,
      objectives: questTemplate.objectives,
      rewards: questTemplate.rewards,
      status: 'active',
      acceptedAt: Date.now(),
      expiresAt: expiresAt.getTime(),
    };

    client.send('acceptQuestResult', { success: true, quest });
    client.send('logEntry', `Quest angenommen: ${quest.title}`);
  }

  private async handleAbandonQuest(client: Client, data: AbandonQuestMessage) {
    const auth = client.auth as AuthPayload;
    const updated = await updateQuestStatus(data.questId, 'abandoned');
    client.send('abandonQuestResult', { success: updated, error: updated ? undefined : 'Quest not found' });
    if (updated) {
      await this.sendActiveQuests(client, auth.userId);
    }
  }

  private async handleGetActiveQuests(client: Client) {
    const auth = client.auth as AuthPayload;
    await this.sendActiveQuests(client, auth.userId);
  }

  private async sendActiveQuests(client: Client, playerId: string) {
    const rows = await getActiveQuests(playerId);
    const quests: Quest[] = rows.map(r => ({
      id: r.id,
      templateId: r.template_id,
      npcName: '',
      npcFactionId: 'independent' as NpcFactionId,
      title: r.template_id,
      description: '',
      stationX: r.station_x,
      stationY: r.station_y,
      objectives: r.objectives,
      rewards: r.rewards,
      status: r.status,
      acceptedAt: new Date(r.accepted_at).getTime(),
      expiresAt: new Date(r.expires_at).getTime(),
    }));
    client.send('activeQuests', { quests });
  }

  private async handleGetReputation(client: Client) {
    const auth = client.auth as AuthPayload;
    await this.sendReputationUpdate(client, auth.userId);
  }

  private async sendReputationUpdate(client: Client, playerId: string) {
    const reps = await getPlayerReputations(playerId);
    const upgrades = await getPlayerUpgrades(playerId);

    const reputations: PlayerReputation[] = ['traders', 'scientists', 'pirates', 'ancients'].map(fid => {
      const rep = reps.find(r => r.faction_id === fid)?.reputation ?? 0;
      return { factionId: fid as NpcFactionId, reputation: rep, tier: getReputationTier(rep) as ReputationTier };
    });

    const playerUpgrades: PlayerUpgrade[] = upgrades.map(u => ({
      upgradeId: u.upgrade_id as any,
      active: u.active,
      unlockedAt: new Date(u.unlocked_at).getTime(),
    }));

    client.send('reputationUpdate', { reputations, upgrades: playerUpgrades });
  }

  private async applyReputationChange(playerId: string, factionId: NpcFactionId, delta: number, client: Client) {
    const newRep = await setPlayerReputation(playerId, factionId, delta);
    const tier = getReputationTier(newRep);

    // Check upgrade unlock/deactivation
    for (const [upgradeId, upgrade] of Object.entries(FACTION_UPGRADES)) {
      if (upgrade.factionId === factionId) {
        const shouldBeActive = tier === 'honored';
        await upsertPlayerUpgrade(playerId, upgradeId, shouldBeActive);
      }
    }

    await this.sendReputationUpdate(client, playerId);
  }

  private async applyXpGain(playerId: string, xp: number, client: Client) {
    const result = await addPlayerXp(playerId, xp);
    const newLevel = calculateLevel(result.xp);
    if (newLevel > result.level) {
      await setPlayerLevel(playerId, newLevel);
      client.send('logEntry', `LEVEL UP! Du bist jetzt Level ${newLevel}`);
    }
  }

  private async handleBattleAction(client: Client, data: BattleActionMessage) {
    const auth = client.auth as AuthPayload;
    const ship = this.getShipForClient(client.sessionId);
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const credits = await getPlayerCredits(auth.userId);
    const cargo = await getPlayerCargo(auth.userId);
    const pirateRep = await getPlayerReputation(auth.userId, 'pirates');

    const pirateLevel = getPirateLevel(data.sectorX, data.sectorY);
    const encounter = createPirateEncounter(pirateLevel, data.sectorX, data.sectorY, pirateRep);

    // Ship attack power (base from ship class + combat_plating upgrade + faction bonus)
    let shipAttack = 10;
    const upgrades = await getPlayerUpgrades(auth.userId);
    if (upgrades.some(u => u.upgrade_id === 'combat_plating' && u.active)) {
      shipAttack = Math.round(shipAttack * 1.2);
    }
    const bonuses = await this.getPlayerBonuses(auth.userId);
    shipAttack = Math.round(shipAttack * bonuses.combatMultiplier);

    const battleSeed = Date.now() ^ (data.sectorX * 31 + data.sectorY * 17);
    const validation = validateBattleAction(
      data.action, currentAP, encounter, credits, cargo, shipAttack, battleSeed,
    );

    if (!validation.valid) {
      client.send('battleResult', { success: false, error: validation.error });
      return;
    }

    const result = validation.result!;

    // Apply AP cost (flee)
    if (validation.newAP) {
      await saveAPState(auth.userId, validation.newAP);
      client.send('apUpdate', validation.newAP);
    }

    // Apply outcomes
    if (result.outcome === 'victory' && result.lootCredits) {
      await addCredits(auth.userId, result.lootCredits);
      client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
      if (result.lootResources) {
        for (const [res, amount] of Object.entries(result.lootResources)) {
          if (amount && amount > 0) await addToCargo(auth.userId, res, amount);
        }
        client.send('cargoUpdate', await getPlayerCargo(auth.userId));
      }
    }

    if (result.outcome === 'defeat' && result.cargoLost) {
      for (const [res, amount] of Object.entries(result.cargoLost)) {
        if (amount && amount > 0) await deductCargo(auth.userId, res, amount);
      }
      client.send('cargoUpdate', await getPlayerCargo(auth.userId));
    }

    if (result.outcome === 'negotiated') {
      await deductCredits(auth.userId, encounter.negotiateCost);
      client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    }

    // Reputation changes
    if (result.repChange) {
      await this.applyReputationChange(auth.userId, 'pirates', result.repChange, client);
    }

    // XP
    if (result.xpGained) {
      await this.applyXpGain(auth.userId, result.xpGained, client);
    }

    // Log battle
    await insertBattleLog(auth.userId, pirateLevel, data.sectorX, data.sectorY, data.action, result.outcome, result.lootResources ?? null);

    client.send('battleResult', { success: true, encounter, result });

    // Log entry
    const outcomeMessages: Record<string, string> = {
      victory: `SIEG! Piraten besiegt. +${result.lootCredits ?? 0} CR`,
      defeat: 'NIEDERLAGE. Cargo verloren.',
      escaped: 'Erfolgreich geflohen!',
      caught: 'Flucht fehlgeschlagen — Kampf erzwungen.',
      negotiated: `Verhandelt. -${encounter.negotiateCost} CR`,
    };
    client.send('logEntry', outcomeMessages[result.outcome] ?? `Kampf: ${result.outcome}`);

    // Check bounty quests
    if (result.outcome === 'victory') {
      await this.checkQuestProgress(client, auth.userId, 'battle_won', { sectorX: data.sectorX, sectorY: data.sectorY });
    }
  }

  private async checkAndEmitScanEvents(client: Client, scannedSectors: { x: number; y: number }[], includeImmediateEvents = true) {
    const auth = client.auth as AuthPayload;
    for (const sector of scannedSectors) {
      const eventResult = checkScanEvent(sector.x, sector.y);
      if (!eventResult.hasEvent || !eventResult.eventType) continue;

      if (eventResult.isImmediate && eventResult.eventType === 'pirate_ambush') {
        if (!includeImmediateEvents) continue;
        const pirateLevel = (eventResult.data?.pirateLevel as number) ?? 1;
        const pirateRep = await getPlayerReputation(auth.userId, 'pirates');
        const encounter = createPirateEncounter(pirateLevel, sector.x, sector.y, pirateRep);
        client.send('pirateAmbush', { encounter, sectorX: sector.x, sectorY: sector.y });
        client.send('logEntry', `WARNUNG: Piraten-Hinterhalt bei (${sector.x}, ${sector.y})!`);
      } else {
        const eventId = await insertScanEvent(
          auth.userId, sector.x, sector.y,
          eventResult.eventType, eventResult.data ?? {},
        );
        if (eventId) {
          client.send('scanEventDiscovered', {
            event: {
              id: eventId,
              eventType: eventResult.eventType,
              sectorX: sector.x,
              sectorY: sector.y,
              status: 'discovered',
              data: eventResult.data ?? {},
              createdAt: Date.now(),
            },
          });
          const eventNames: Record<string, string> = {
            distress_signal: 'Notsignal',
            anomaly_reading: 'Anomalie',
            artifact_find: 'Artefakt-Signal',
          };
          client.send('logEntry', `${eventNames[eventResult.eventType] ?? 'Event'} entdeckt bei (${sector.x}, ${sector.y})`);
        }
      }
    }
  }

  private async handleCompleteScanEvent(client: Client, data: CompleteScanEventMessage) {
    const auth = client.auth as AuthPayload;
    const events = await getPlayerScanEvents(auth.userId, 'discovered');
    const event = events.find(e => e.id === data.eventId);

    if (!event) {
      client.send('logEntry', 'Event nicht gefunden.');
      return;
    }

    const completed = await completeScanEvent(data.eventId, auth.userId);
    if (!completed) return;

    // Apply rewards based on event type
    const eventData = event.data as Record<string, number>;
    if (eventData.rewardCredits) {
      await addCredits(auth.userId, eventData.rewardCredits);
      client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    }
    if (eventData.rewardXp) {
      await this.applyXpGain(auth.userId, eventData.rewardXp, client);
    }
    if (eventData.rewardRep) {
      const repFaction = event.event_type === 'anomaly_reading' ? 'scientists'
        : event.event_type === 'artifact_find' ? 'ancients'
        : 'traders';
      await this.applyReputationChange(auth.userId, repFaction as NpcFactionId, eventData.rewardRep, client);
    }

    client.send('logEntry', `Event abgeschlossen! +${eventData.rewardCredits ?? 0} CR`);
  }

  private async checkQuestProgress(client: Client, playerId: string, action: string, context: Record<string, any>) {
    const rows = await getActiveQuests(playerId);
    for (const row of rows) {
      const objectives = row.objectives as QuestObjective[];
      let updated = false;

      for (const obj of objectives) {
        if (obj.fulfilled) continue;

        if (obj.type === 'scan' && action === 'scan' && obj.targetX === context.sectorX && obj.targetY === context.sectorY) {
          obj.fulfilled = true;
          updated = true;
        }

        if (obj.type === 'fetch' && action === 'arrive' && context.sectorX === row.station_x && context.sectorY === row.station_y) {
          const cargo = await getPlayerCargo(playerId);
          if (obj.resource && obj.amount && ((cargo as any)[obj.resource] ?? 0) >= obj.amount) {
            obj.fulfilled = true;
            updated = true;
          }
        }

        if (obj.type === 'delivery' && action === 'arrive' && obj.targetX === context.sectorX && obj.targetY === context.sectorY) {
          obj.fulfilled = true;
          updated = true;
        }

        if (obj.type === 'bounty' && action === 'battle_won' && obj.targetX === context.sectorX && obj.targetY === context.sectorY) {
          obj.fulfilled = true;
          updated = true;
        }
      }

      if (updated) {
        await updateQuestObjectives(row.id, objectives);
        client.send('questProgress', { questId: row.id, objectives });

        if (objectives.every(o => o.fulfilled)) {
          await updateQuestStatus(row.id, 'completed');
          const rewards = row.rewards;

          if (rewards.credits) {
            await addCredits(playerId, rewards.credits);
            client.send('creditsUpdate', { credits: await getPlayerCredits(playerId) });
          }
          if (rewards.xp) await this.applyXpGain(playerId, rewards.xp, client);
          if (rewards.reputation) {
            // Determine quest faction from template_id prefix
            const factionId = row.template_id.split('_')[0] as string;
            const validFactions = ['traders', 'scientists', 'pirates', 'ancients'];
            if (validFactions.includes(factionId)) {
              await this.applyReputationChange(playerId, factionId as NpcFactionId, rewards.reputation, client);
            }
          }
          if (rewards.reputationPenalty && rewards.rivalFactionId) {
            await this.applyReputationChange(playerId, rewards.rivalFactionId as NpcFactionId, -rewards.reputationPenalty, client);
          }

          // Deduct fetch resources from cargo
          for (const obj of objectives) {
            if (obj.type === 'fetch' && obj.resource && obj.amount) {
              await deductCargo(playerId, obj.resource, obj.amount);
            }
          }
          client.send('cargoUpdate', await getPlayerCargo(playerId));

          client.send('logEntry', `Quest abgeschlossen: +${rewards.credits ?? 0} CR, +${rewards.xp ?? 0} XP`);
          await this.sendActiveQuests(client, playerId);
        }
      }
    }
  }

  // ─── Phase 5: Jump Gate Handlers ──────────────────────────────────

  private async handleUseJumpGate(client: Client, data: UseJumpGateMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const { gateId, accessCode } = data;

    const gate = await getJumpGate(this.state.sector.x, this.state.sector.y);
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
      fuel: { current: currentFuel - JUMPGATE_FUEL_COST, max: this.getShipForClient(client.sessionId).fuelMax },
    });
  }

  private async handleFrequencyMatch(client: Client, data: { gateId: string; matched: boolean }): Promise<void> {
    const auth = client.auth as AuthPayload;

    if (!data.matched) {
      client.send('useJumpGateResult', { success: false, error: 'Frequency match failed' });
      return;
    }

    const gate = await getJumpGate(this.state.sector.x, this.state.sector.y);
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
      fuel: { current: currentFuel - JUMPGATE_FUEL_COST, max: this.getShipForClient(client.sessionId).fuelMax },
    });
  }

  // ─── Phase 5: Rescue Handlers ─────────────────────────────────────

  private async handleRescue(client: Client, data: RescueMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const ship = this.getShipForClient(client.sessionId);

    // Must be at the sector
    if (data.sectorX !== this.state.sector.x || data.sectorY !== this.state.sector.y) {
      client.send('rescueResult', { success: false, error: 'Not at rescue location' });
      return;
    }

    // Check safe slots
    const survivors = await getPlayerSurvivors(auth.userId);
    if (!canRescue(ship.safeSlots, survivors.length)) {
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
      safeSlotsFree: ship.safeSlots - survivors.length - 1,
    });
    client.send('apUpdate', { current: newAP.current, max: newAP.max });
  }

  private async handleDeliverSurvivors(client: Client, data: DeliverSurvivorsMessage): Promise<void> {
    const auth = client.auth as AuthPayload;

    // Must be at a station
    if (this.state.sector.sectorType !== 'station') {
      client.send('deliverSurvivorsResult', { success: false, error: 'Must be at a station' });
      return;
    }

    const survivors = await getPlayerSurvivors(auth.userId);
    if (survivors.length === 0) {
      client.send('deliverSurvivorsResult', { success: false, error: 'No survivors to deliver' });
      return;
    }

    // Calculate rewards
    let totalCredits = 0, totalRep = 0, totalXp = 0;
    for (const s of survivors) {
      const reward = calculateRescueReward(s.sourceType as 'scan_event' | 'npc_quest' | 'comm_distress');
      totalCredits += reward.credits * s.survivorCount;
      totalRep += reward.rep * s.survivorCount;
      totalXp += reward.xp * s.survivorCount;
    }

    await deletePlayerSurvivors(auth.userId);
    await addCredits(auth.userId, totalCredits);
    await this.applyXpGain(auth.userId, totalXp, client);

    client.send('deliverSurvivorsResult', {
      success: true,
      credits: totalCredits,
      rep: totalRep,
      xp: totalXp,
    });
  }

  // ─── Phase 5: Faction Upgrade Handler ─────────────────────────────

  private async handleFactionUpgrade(client: Client, data: FactionUpgradeMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const { tier, choice } = data;

    // Validate tier exists
    const tierDef = FACTION_UPGRADE_TIERS[tier];
    if (!tierDef) {
      client.send('factionUpgradeResult', { success: false, error: 'Invalid tier' });
      return;
    }

    // Must be in a faction as leader
    const faction = await getPlayerFaction(auth.userId);
    if (!faction) {
      client.send('factionUpgradeResult', { success: false, error: 'Not in a faction' });
      return;
    }

    const members = await getFactionMembers(faction.id);
    const member = members.find((m: any) => m.player_id === auth.userId);
    if (!member || member.rank !== 'leader') {
      client.send('factionUpgradeResult', { success: false, error: 'Only faction leader can upgrade' });
      return;
    }

    // Check prerequisites (previous tiers must be chosen)
    const existing = await getFactionUpgrades(faction.id);
    if (tier > 1 && !existing.some((u: any) => u.tier === tier - 1)) {
      client.send('factionUpgradeResult', { success: false, error: `Tier ${tier - 1} must be chosen first` });
      return;
    }
    if (existing.some((u: any) => u.tier === tier)) {
      client.send('factionUpgradeResult', { success: false, error: 'Tier already chosen' });
      return;
    }

    // Check credits
    const credits = await getPlayerCredits(auth.userId);
    if (credits < tierDef.cost) {
      client.send('factionUpgradeResult', { success: false, error: 'Not enough credits' });
      return;
    }

    await deductCredits(auth.userId, tierDef.cost);
    await setFactionUpgrade(faction.id, tier, choice, auth.userId);

    const upgrades = await getFactionUpgrades(faction.id);
    client.send('factionUpgradeResult', {
      success: true,
      upgrades: upgrades.map((u: any) => ({ tier: u.tier, choice: u.choice as FactionUpgradeChoice, chosenAt: Date.now() })),
    });
  }

  // ─── Phase 5: Trade Route Handlers ────────────────────────────────

  private async handleConfigureRoute(client: Client, data: ConfigureRouteMessage): Promise<void> {
    const auth = client.auth as AuthPayload;

    // Validate trading post
    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    if (!tradingPost) {
      client.send('configureRouteResult', { success: false, error: 'Trading post not found' });
      return;
    }

    // Validate config
    const routes = await getPlayerTradeRoutes(auth.userId);
    const validation = validateRouteConfig({ cycleMinutes: data.cycleMinutes, routeCount: routes.length });
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

  private async handleToggleRoute(client: Client, data: ToggleRouteMessage): Promise<void> {
    await updateTradeRouteActive(data.routeId, data.active);
    client.send('toggleRouteResult', { success: true });
  }

  private async handleDeleteRoute(client: Client, data: DeleteRouteMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const deleted = await deleteTradeRoute(data.routeId, auth.userId);
    client.send('deleteRouteResult', { success: deleted, error: deleted ? undefined : 'Route not found' });
  }

  // ─── Phase 5: Distress Call Detection ─────────────────────────────

  private async checkAndEmitDistressCalls(client: Client, userId: string, playerX: number, playerY: number): Promise<void> {
    const ship = this.getShipForClient(client.sessionId);
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
          } catch { /* already exists */ }

          const callData = generateDistressCallData(playerX, playerY, sx, sy);
          await insertPlayerDistressCall(userId, distressId, callData.direction, callData.estimatedDistance);

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

  // ─── Phase 5: Trade Route Processor ───────────────────────────────

  private async processTradeRoutes(): Promise<void> {
    const routes = await getActiveTradeRoutes();
    for (const route of routes) {
      const lastCycle = route.lastCycleAt ? new Date(route.lastCycleAt).getTime() : null;
      if (!isRouteCycleDue(lastCycle, route.cycleMinutes)) continue;

      try {
        // Get owner's trading post
        const tradingPost = await getPlayerStructure(route.ownerId, 'trading_post');
        if (!tradingPost) {
          await updateTradeRouteActive(route.id, false);
          continue;
        }

        // Calculate fuel cost
        const fuelCost = calculateRouteFuelCost(tradingPost.sector_x, tradingPost.sector_y, route.targetX, route.targetY);
        const currentFuel = await getFuelState(route.ownerId);
        if (!currentFuel || currentFuel < fuelCost) {
          await updateTradeRouteActive(route.id, false);
          continue;
        }

        // Execute sell
        if (route.sellResource && route.sellAmount > 0) {
          const storage = await getStorageInventory(route.ownerId);
          if (storage) {
            const available = storage[route.sellResource as keyof typeof storage] || 0;
            const sellQty = Math.min(route.sellAmount, available);
            if (sellQty > 0) {
              const price = NPC_PRICES[route.sellResource as ResourceType] * NPC_SELL_SPREAD;
              await addCredits(route.ownerId, Math.floor(sellQty * price));
              await updateStorageResource(route.ownerId, route.sellResource, -sellQty);
            }
          }
        }

        // Execute buy
        if (route.buyResource && route.buyAmount > 0) {
          const credits = await getPlayerCredits(route.ownerId);
          const price = NPC_PRICES[route.buyResource as ResourceType] * NPC_BUY_SPREAD;
          const affordable = Math.floor(credits / price);
          const buyQty = Math.min(route.buyAmount, affordable);
          if (buyQty > 0) {
            await deductCredits(route.ownerId, Math.floor(buyQty * price));
            await updateStorageResource(route.ownerId, route.buyResource, buyQty);
          }
        }

        // Deduct fuel
        await saveFuelState(route.ownerId, currentFuel - fuelCost);

        // Update last cycle
        await updateTradeRouteLastCycle(route.id);
      } catch (err) {
        console.error(`[TRADE ROUTE] Error processing ${route.id}:`, err);
      }
    }
  }
}
