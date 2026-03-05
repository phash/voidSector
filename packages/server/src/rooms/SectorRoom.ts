import colyseus from 'colyseus';
import type { Client } from 'colyseus';
const { Room, ServerError } = colyseus;

import { SectorRoomState, PlayerSchema } from './schema/SectorState.js';
import { verifyToken, type AuthPayload } from '../auth.js';
import { generateSector } from '../engine/worldgen.js';
import { calculateCurrentAP, spendAP } from '../engine/ap.js';
import { stopMining, calculateMinedAmount } from '../engine/mining.js';
import { generateStationNpcs, getStationFaction, hasShipyard } from '../engine/npcgen.js';
import { generateStationQuests } from '../engine/questgen.js';
import { validateJump, validateMine, validateJettison, validateBuild, validateTransfer, validateNpcTrade, validateCreateSlate, validateNpcBuyback, validateFactionAction, validateAcceptQuest, getReputationTier, calculateLevel } from '../engine/commands.js';
import { checkJumpGate, generateGateTarget } from '../engine/jumpgates.js';
import { checkDistressCall, generateDistressCallData, calculateRescueReward, canRescue } from '../engine/rescue.js';
import { calculateBonuses } from '../engine/factionBonuses.js';
import { calculateAutopilotPath, calculateAutopilotCosts, getNextSegment, STEP_INTERVAL_MS, STEP_INTERVAL_MIN_MS } from '../engine/autopilot.js';
import { hashCoords, isInBlackHoleCluster } from '../engine/worldgen.js';
import type { FactionBonuses } from '../engine/factionBonuses.js';
import { getOrInitStation, recordVisit, recordTrade, canBuyFromStation, canSellToStation, calculateCurrentStock, getStationLevel, calculatePrice } from '../engine/npcStationEngine.js';
import { getStationInventoryItem, upsertInventoryItem, getStationInventory } from '../db/npcStationQueries.js';
import { isRouteCycleDue, calculateRouteFuelCost, validateRouteConfig } from '../engine/tradeRoutes.js';
import { getOrCreateFactoryState, setActiveRecipe, collectOutput, getFactoryStatus, transferOutputToCargo } from '../engine/productionEngine.js';
import { placeKontorOrder, cancelKontorOrder, fillKontorOrder, getKontorOrders, getPlayerOrders } from '../engine/kontorEngine.js';
import { adminBus } from '../adminBus.js';
import type { AdminBroadcastEvent, AdminQuestEvent } from '../adminBus.js';
import { commsBus } from '../commsBus.js';
import type { CommsBroadcastEvent } from '../commsBus.js';
import { query } from '../db/client.js';
import { getAPState, saveAPState, savePlayerPosition, getPlayerPosition, getMiningState, saveMiningState, getFuelState, saveFuelState, getHyperdriveState, setHyperdriveState } from './services/RedisAPStore.js';
import { getSector, saveSector, addDiscovery, getPlayerDiscoveries, getPlayerCargo, addToCargo, jettisonCargo, getCargoTotal, awardBadge, hasAnyoneBadge, createStructure, deductCargo, saveMessage, getPendingMessages, markMessagesDelivered, getActiveShip, getRecentMessages, getPlayerBaseStructures, getStorageInventory, updateStorageResource, getPlayerCredits, addCredits, deductCredits, getAlienCredits, getPlayerStructure, upgradeStructureTier, createTradeOrder, getActiveTradeOrders, getPlayerTradeOrders, fulfillTradeOrder, cancelTradeOrder, findPlayerByUsername, createDataSlate, getPlayerSlates, getSlateById, deleteSlate, updateSlateStatus, updateSlateOwner, addSlateToCargo, removeSlateFromCargo, createSlateTradeOrder, getTradeOrderById, createFaction, getFactionById, getPlayerFaction, getFactionMembers, addFactionMember, removeFactionMember, updateMemberRank, updateFactionJoinMode, getFactionByCode, disbandFaction, createFactionInvite, getPlayerFactionInvites, respondToInvite, getPlayerIdByUsername, getFactionMembersByPlayerIds, getPlayerReputations, getPlayerReputation, setPlayerReputation, getPlayerUpgrades, upsertPlayerUpgrade, getActiveQuests, getActiveQuestCount, insertQuest, updateQuestStatus, getQuestById, addPlayerXp, setPlayerLevel, insertScanEvent, getPlayerScanEvents, completeScanEvent, insertBattleLog, insertBattleLogV2, updateQuestObjectives, getJumpGate, insertJumpGate, playerHasGateCode, addGateCode, getPlayerSurvivors, insertRescuedSurvivor, deletePlayerSurvivors, insertDistressCall, insertPlayerDistressCall, getPlayerDistressCalls, completeDistressCall, getFactionUpgrades, setFactionUpgrade, getPlayerTradeRoutes, insertTradeRoute, updateTradeRouteActive, deleteTradeRoute, updateTradeRouteLastCycle, getActiveTradeRoutes, getPlayerBookmarks, setPlayerBookmark, clearPlayerBookmark, isRouteDiscovered, getPlayerHomeBase, playerHasBaseAtSector, getPlayerShips, createShip, switchActiveShip, updateShipModules, renameShip, renameBase, getModuleInventory, addModuleToInventory, removeModuleFromInventory, getPlayerLevel, getSectorsInRange, addDiscoveriesBatch, getStationDefenses, installStationDefense, getStructureHp, updateStructureHp, insertStationBattleLog, getPlayerStructuresInSector, getPlayerResearch, addUnlockedModule, addBlueprint, getActiveResearch, startActiveResearch, deleteActiveResearch, getPlayerKnownJumpGates, addPlayerKnownJumpGate, saveAutopilotRoute, getActiveAutopilotRoute, updateAutopilotStep, pauseAutopilotRoute, cancelAutopilotRoute, completeAutopilotRoute, getPlayerStationRep, updatePlayerStationRep } from '../db/queries.js';
import { AP_COSTS, AP_COSTS_LOCAL_SCAN, AP_COSTS_BY_SCANNER, RADAR_RADIUS, RECONNECTION_TIMEOUT_S, STORAGE_TIERS, TRADING_POST_TIERS, SLATE_NPC_PRICE_PER_SECTOR, MAX_ACTIVE_QUESTS, QUEST_EXPIRY_DAYS, FACTION_UPGRADES, BATTLE_NEGOTIATE_COST_PER_LEVEL, FUEL_COST_PER_UNIT, FREE_REFUEL_MAX_SHIPS, JUMPGATE_FUEL_COST, RESCUE_AP_COST, RESCUE_DELIVER_AP_COST, RESCUE_EXPIRY_MINUTES, FACTION_UPGRADE_TIERS, MAX_TRADE_ROUTES, FREQUENCY_MATCH_THRESHOLD, NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD, NPC_STATION_LEVELS, HYPERJUMP_PIRATE_FUEL_PENALTY, AUTOPILOT_STEP_MS, EMERGENCY_WARP_FREE_RADIUS, EMERGENCY_WARP_CREDIT_PER_SECTOR, EMERGENCY_WARP_FUEL_GRANT, HULLS, MODULES, REP_PRICE_MODIFIERS, getFuelRepPriceModifier, STATION_REP_VISIT, STATION_REP_TRADE, FEATURE_COMBAT_V2, FEATURE_HYPERDRIVE_V2, BATTLE_AP_COST_FLEE, STATION_DEFENSE_DEFS, STATION_REPAIR_CR_PER_HP, STATION_REPAIR_ORE_PER_HP, JUMP_NORMAL_AP_COST, JUMP_NORMAL_MAX_RANGE, RESEARCH_TICK_MS, HULL_FUEL_MULTIPLIER, HULL_PRICES, STATION_SHIPYARD_LEVEL_THRESHOLD, HYPERJUMP_FUEL_PER_SECTOR, calculateShipStats, validateModuleInstall, calcHyperjumpAP, calcHyperjumpFuel, calcHyperjumpFuelV2, createHyperdriveState, calculateCurrentCharge, spendCharge, isModuleUnlocked, isModuleFreelyAvailable, canStartResearch, WORLD_SEED, BLACK_HOLE_SPAWN_CHANCE, BLACK_HOLE_MIN_DISTANCE } from '@void-sector/shared';
import type { SectorData, JumpMessage, MineMessage, JettisonMessage, ResourceType, MineableResourceType, CargoState, BuildMessage, SendChatMessage, ChatMessage, TransferMessage, NpcTradeMessage, UpgradeStructureMessage, PlaceOrderMessage, CreateSlateMessage, ActivateSlateMessage, NpcBuybackMessage, ListSlateMessage, CreateFactionMessage, FactionActionMessage, GetStationNpcsMessage, AcceptQuestMessage, AbandonQuestMessage, Quest, QuestObjective, PlayerReputation, PlayerUpgrade, ReputationTier, NpcFactionId, BattleActionMessage, CompleteScanEventMessage, PirateEncounter, BattleResult, RefuelMessage, UseJumpGateMessage, RescueMessage, DeliverSurvivorsMessage, FactionUpgradeMessage, ConfigureRouteMessage, ToggleRouteMessage, DeleteRouteMessage, FactionUpgradeChoice, SetBookmarkMessage, ClearBookmarkMessage, HyperJumpMessage, HullType, ShipStats, ShipModule, ShipRecord, CombatV2ActionMessage, CombatV2FleeMessage, CombatV2State, HyperdriveState, ResearchState, ProcessedItemType } from '@void-sector/shared';
import type { FirstContactEvent } from '@void-sector/shared';
import { sectorToQuadrant, getOrCreateQuadrant, nameQuadrant as nameQuadrantEngine, generateQuadrantName } from '../engine/quadrantEngine.js';
import { getPlayerKnownQuadrants, addPlayerKnownQuadrant, addPlayerKnownQuadrantsBatch, getQuadrant, getAllDiscoveredQuadrantCoords } from '../db/quadrantQueries.js';
import type { ServiceContext } from './services/ServiceContext.js';
import { NavigationService } from './services/NavigationService.js';
import { ScanService } from './services/ScanService.js';
import { CombatService } from './services/CombatService.js';
import { isInt, isPositiveInt, isGuest, rejectGuest, MAX_COORD } from './services/utils.js';

const VALID_MINE_RESOURCES = ['ore', 'gas', 'crystal'];
const VALID_TRANSFER_RESOURCES = ['ore', 'gas', 'crystal', 'artefact'];
const VALID_STRUCTURE_TYPES = ['comm_relay', 'mining_station', 'base', 'storage', 'trading_post', 'defense_turret', 'station_shield', 'ion_cannon', 'factory', 'research_lab', 'kontor'];

function sanitizeChat(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

interface SectorRoomOptions {
  quadrantX: number;
  quadrantY: number;
  sectorX: number;
  sectorY: number;
}

export class SectorRoom extends Room<SectorRoomState> {
  autoDispose = true;
  private clientShips = new Map<string, ShipStats>();
  private clientHullTypes = new Map<string, HullType>();
  private combatV2States = new Map<string, CombatV2State>();
  private autopilotTimers = new Map<string, ReturnType<typeof setInterval>>();
  private rateLimits = new Map<string, Map<string, number>>();
  private disposeCallbacks: Array<() => void> = [];

  // Quadrant-based room: tracks which quadrant this room serves
  private quadrantX: number = 0;
  private quadrantY: number = 0;
  // Per-player sector data cache (each player may be in a different sector within the quadrant)
  private playerSectorData = new Map<string, SectorData>();

  // Service architecture
  private serviceCtx!: ServiceContext;
  private navigation!: NavigationService;
  private scanning!: ScanService;
  private combat!: CombatService;

  /** Get a player's current sector X coordinate */
  private _px(sid: string): number { return this.state.players.get(sid)?.x ?? 0; }
  /** Get a player's current sector Y coordinate */
  private _py(sid: string): number { return this.state.players.get(sid)?.y ?? 0; }
  /** Get a player's current sector type from cache */
  private _pst(sid: string): string { return this.playerSectorData.get(sid)?.type ?? 'empty'; }

  private checkRate(sessionId: string, action: string, intervalMs: number): boolean {
    let map = this.rateLimits.get(sessionId);
    if (!map) { map = new Map(); this.rateLimits.set(sessionId, map); }
    const last = map.get(action) ?? 0;
    if (Date.now() - last < intervalMs) return false;
    map.set(action, Date.now());
    return true;
  }

  private getShipForClient(sessionId: string): ShipStats {
    return this.clientShips.get(sessionId) ?? calculateShipStats('scout', []);
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
    const { quadrantX, quadrantY } = options;
    this.setState(new SectorRoomState());

    // Quadrant-based room: one room per quadrant, not per sector
    this.quadrantX = quadrantX;
    this.quadrantY = quadrantY;
    this.roomId = `quadrant_${quadrantX}_${quadrantY}`;

    // Create shared service context
    this.serviceCtx = {
      state: this.state,
      quadrantX: this.quadrantX,
      quadrantY: this.quadrantY,
      clientShips: this.clientShips,
      clientHullTypes: this.clientHullTypes,
      combatV2States: this.combatV2States,
      autopilotTimers: this.autopilotTimers,
      playerSectorData: this.playerSectorData,
      checkRate: this.checkRate.bind(this),
      getShipForClient: this.getShipForClient.bind(this),
      getPlayerBonuses: this.getPlayerBonuses.bind(this),
      _px: this._px.bind(this),
      _py: this._py.bind(this),
      _pst: this._pst.bind(this),
      send: (client, type, data) => client.send(type, data),
      broadcast: (type, data, opts) => this.broadcast(type, data, opts),
      disposeCallbacks: this.disposeCallbacks,
      roomId: this.roomId,
      checkFirstContact: this.checkFirstContact.bind(this),
      checkQuestProgress: this.checkQuestProgress.bind(this),
      checkAndEmitDistressCalls: this.checkAndEmitDistressCalls.bind(this),
      applyReputationChange: this.applyReputationChange.bind(this),
      applyXpGain: this.applyXpGain.bind(this),
    };
    this.navigation = new NavigationService(this.serviceCtx);
    this.scanning = new ScanService(this.serviceCtx);
    this.combat = new CombatService(this.serviceCtx);

    // Handle intra-quadrant sector move (no room leave/join needed)
    this.onMessage('moveSector', async (client, data: { sectorX: number; sectorY: number }) => {
      try {
        await this.navigation.handleMoveSector(client, data);
      } catch (err) {
        console.error('[MOVE_SECTOR] Error:', err);
        client.send('error', { code: 'MOVE_FAILED', message: 'Failed to move sector' });
      }
    });

    // Handle jump message
    this.onMessage('jump', async (client, data: JumpMessage) => {
      try {
        await this.navigation.handleJump(client, data);
      } catch (err) {
        console.error('[JUMP] Unhandled error:', err);
        client.send('jumpResult', { success: false, error: 'Server error' });
      }
    });

    // Handle local scan message
    this.onMessage('localScan', async (client) => {
      try {
        await this.scanning.handleLocalScan(client);
      } catch (err) {
        console.error('[LOCAL_SCAN] Unhandled error:', err);
        client.send('localScanResult', { error: 'Server error' });
      }
    });

    // Handle area scan message (with backward compat for 'scan')
    this.onMessage('areaScan', async (client) => {
      try {
        await this.scanning.handleAreaScan(client);
      } catch (err) {
        console.error('[AREA_SCAN] Unhandled error:', err);
        client.send('scanResult', { sectors: [], error: 'Server error' });
      }
    });
    this.onMessage('scan', async (client) => {
      try {
        await this.scanning.handleAreaScan(client);
      } catch (err) {
        console.error('[SCAN] Unhandled error:', err);
        client.send('scanResult', { sectors: [], error: 'Server error' });
      }
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
      await this.combat.handleBattleAction(client, data);
    });
    this.onMessage('combatV2Action', async (client, data: CombatV2ActionMessage) => {
      await this.combat.handleCombatV2Action(client, data);
    });
    this.onMessage('combatV2Flee', async (client, data: CombatV2FleeMessage) => {
      await this.combat.handleCombatV2Flee(client, data);
    });
    this.onMessage('installDefense', async (client, data: { defenseType: string }) => {
      await this.combat.handleInstallDefense(client, data);
    });
    this.onMessage('repairStation', async (client, data: { sectorX: number; sectorY: number }) => {
      await this.combat.handleRepairStation(client, data);
    });
    this.onMessage('completeScanEvent', async (client, data: CompleteScanEventMessage) => {
      await this.scanning.handleCompleteScanEvent(client, data);
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

    // Hyperjump + autopilot (delegated to NavigationService)
    this.onMessage('hyperJump', async (client, data: HyperJumpMessage) => {
      await this.navigation.handleHyperJump(client, data);
    });
    this.onMessage('emergencyWarp', async (client) => {
      await this.navigation.handleEmergencyWarp(client);
    });
    this.onMessage('cancelAutopilot', async (client) => {
      await this.navigation.handleCancelAutopilot(client);
    });
    this.onMessage('startAutopilot', async (client, data) => {
      await this.navigation.handleStartAutopilot(client, data);
    });
    this.onMessage('getAutopilotStatus', async (client) => {
      await this.navigation.handleGetAutopilotStatus(client);
    });

    // Phase 7: Ship designer
    this.onMessage('getShips', async (client) => {
      const auth = client.auth as AuthPayload;
      const ships = await getPlayerShips(auth.userId);
      const shipsWithStats = ships.map(s => ({
        ...s,
        stats: calculateShipStats(s.hullType, s.modules),
      }));
      client.send('shipList', { ships: shipsWithStats });
    });

    this.onMessage('switchShip', async (client, data: { shipId: string }) => {
      const auth = client.auth as AuthPayload;
      // Must be at home base
      const homeBase = await getPlayerHomeBase(auth.userId);
      if (this._px(client.sessionId) !== homeBase.x || this._py(client.sessionId) !== homeBase.y) {
        client.send('error', { code: 'NOT_AT_BASE', message: 'Must be at home base to switch ships' });
        return;
      }
      const success = await switchActiveShip(auth.userId, data.shipId);
      if (!success) {
        client.send('error', { code: 'SWITCH_FAIL', message: 'Ship not found' });
        return;
      }
      // Reload new ship stats
      const newShip = await getActiveShip(auth.userId);
      if (newShip) {
        const newStats = calculateShipStats(newShip.hullType, newShip.modules);
        this.clientShips.set(client.sessionId, newStats);
        this.clientHullTypes.set(client.sessionId, newShip.hullType);
        const fuelState = await getFuelState(auth.userId);
        client.send('shipData', {
          id: newShip.id, ownerId: auth.userId, hullType: newShip.hullType,
          name: newShip.name, modules: newShip.modules, stats: newStats,
          fuel: fuelState ?? newStats.fuelMax, active: true,
        });
      }
    });

    this.onMessage('installModule', async (client, data: { moduleId: string; slotIndex: number }) => {
      const auth = client.auth as AuthPayload;
      const ship = await getActiveShip(auth.userId);
      if (!ship) return;
      const validation = validateModuleInstall(ship.hullType, ship.modules, data.moduleId, data.slotIndex);
      if (!validation.valid) {
        client.send('error', { code: 'INSTALL_FAIL', message: validation.error! });
        return;
      }
      // Remove from inventory
      const removed = await removeModuleFromInventory(auth.userId, data.moduleId);
      if (!removed) {
        client.send('error', { code: 'NO_MODULE', message: 'Module not in inventory' });
        return;
      }
      // Install
      const newModules: ShipModule[] = [...ship.modules, { moduleId: data.moduleId, slotIndex: data.slotIndex }];
      await updateShipModules(ship.id, newModules);
      // Recalculate and send
      const newStats = calculateShipStats(ship.hullType, newModules);
      this.clientShips.set(client.sessionId, newStats);
      client.send('moduleInstalled', { modules: newModules, stats: newStats });
    });

    this.onMessage('removeModule', async (client, data: { slotIndex: number }) => {
      const auth = client.auth as AuthPayload;
      const ship = await getActiveShip(auth.userId);
      if (!ship) return;
      const mod = ship.modules.find(m => m.slotIndex === data.slotIndex);
      if (!mod) {
        client.send('error', { code: 'EMPTY_SLOT', message: 'No module in that slot' });
        return;
      }
      // Remove from ship
      const newModules = ship.modules.filter(m => m.slotIndex !== data.slotIndex);
      await updateShipModules(ship.id, newModules);
      // Add back to inventory
      await addModuleToInventory(auth.userId, mod.moduleId);
      // Recalculate
      const newStats = calculateShipStats(ship.hullType, newModules);
      this.clientShips.set(client.sessionId, newStats);
      client.send('moduleRemoved', { modules: newModules, stats: newStats, returnedModule: mod.moduleId });
    });

    this.onMessage('buyModule', async (client, data: { moduleId: string }) => {
      const auth = client.auth as AuthPayload;
      const moduleDef = MODULES[data.moduleId];
      if (!moduleDef) {
        client.send('error', { code: 'UNKNOWN_MODULE', message: 'Unknown module' });
        return;
      }
      // Check if module is unlocked (research/blueprint/tier1)
      const dbResearch = await getPlayerResearch(auth.userId);
      const researchState: ResearchState = { ...dbResearch, activeResearch: null };
      if (!isModuleUnlocked(data.moduleId, researchState)) {
        client.send('error', { code: 'MODULE_LOCKED', message: 'Module not researched' });
        return;
      }
      // Must be at station or home base
      const homeBase = await getPlayerHomeBase(auth.userId);
      const isStation = this._pst(client.sessionId) === 'station';
      const isHomeBase = this._px(client.sessionId) === homeBase.x && this._py(client.sessionId) === homeBase.y;
      if (!isStation && !isHomeBase) {
        client.send('error', { code: 'WRONG_LOCATION', message: 'Must be at a station or home base' });
        return;
      }
      // Check credits
      const credits = await getPlayerCredits(auth.userId);
      if (credits < moduleDef.cost.credits) {
        client.send('error', { code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits' });
        return;
      }
      // Check resource costs from cargo
      const cargo = await getPlayerCargo(auth.userId);
      const cargoMap: Record<string, number> = { ore: cargo.ore, gas: cargo.gas, crystal: cargo.crystal, artefact: cargo.artefact };
      for (const [res, amount] of Object.entries(moduleDef.cost)) {
        if (res === 'credits') continue;
        const have = cargoMap[res] ?? 0;
        if (have < (amount as number)) {
          client.send('error', { code: 'INSUFFICIENT_RESOURCES', message: `Need ${amount} ${res}` });
          return;
        }
      }
      // Deduct credits
      await deductCredits(auth.userId, moduleDef.cost.credits);
      // Deduct resources from cargo
      for (const [res, amount] of Object.entries(moduleDef.cost)) {
        if (res === 'credits' || !amount) continue;
        await deductCargo(auth.userId, res, amount as number);
      }
      // Add to module inventory
      await addModuleToInventory(auth.userId, data.moduleId);
      // Send updates
      const remainingCredits = await getPlayerCredits(auth.userId);
      client.send('creditsUpdate', { credits: remainingCredits });
      client.send('buyModuleResult', { success: true, moduleId: data.moduleId });
      const inventory = await getModuleInventory(auth.userId);
      client.send('moduleInventory', { modules: inventory });
    });

    this.onMessage('buyHull', async (client, data: { hullType: string; name?: string; shipColor?: string }) => {
      if (rejectGuest(client, 'Schiffskauf')) return;
      const auth = client.auth as AuthPayload;
      const hullDef = HULLS[data.hullType as HullType];
      if (!hullDef) {
        client.send('error', { code: 'UNKNOWN_HULL', message: 'Unknown hull type' });
        return;
      }
      // Must be at station or home base
      const homeBase = await getPlayerHomeBase(auth.userId);
      const isStation = this._pst(client.sessionId) === 'station';
      const isHomeBase = this._px(client.sessionId) === homeBase.x && this._py(client.sessionId) === homeBase.y;
      if (!isStation && !isHomeBase) {
        client.send('error', { code: 'WRONG_LOCATION', message: 'Must be at a station or home base' });
        return;
      }
      // If at an NPC station (not home base), check shipyard availability
      if (isStation && !isHomeBase) {
        const sx = this._px(client.sessionId);
        const sy = this._py(client.sessionId);
        const station = await getOrInitStation(sx, sy);
        const stationLevelInfo = getStationLevel(station.xp);
        if (!hasShipyard(stationLevelInfo.level)) {
          client.send('error', { code: 'NO_SHIPYARD', message: `Station needs level ${STATION_SHIPYARD_LEVEL_THRESHOLD}+ for shipyard` });
          return;
        }
      }
      // Check level
      const playerLevel = await getPlayerLevel(auth.userId);
      if (playerLevel < hullDef.unlockLevel) {
        client.send('error', { code: 'LEVEL_TOO_LOW', message: `Need level ${hullDef.unlockLevel}` });
        return;
      }
      // Check credits (use HULL_PRICES)
      const price = HULL_PRICES[data.hullType as HullType] ?? hullDef.unlockCost;
      const credits = await getPlayerCredits(auth.userId);
      if (credits < price) {
        client.send('error', { code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits' });
        return;
      }
      // Deduct credits
      if (price > 0) {
        await deductCredits(auth.userId, price);
      }
      // Create new ship (becomes active, old one deactivated)
      const newShip = await createShip(auth.userId, data.hullType as HullType, data.name?.slice(0, 20) || hullDef.name, hullDef.baseFuel);
      const newStats = calculateShipStats(newShip.hullType, newShip.modules);
      this.clientShips.set(client.sessionId, newStats);
      this.clientHullTypes.set(client.sessionId, newShip.hullType);
      // Reset fuel
      await saveFuelState(auth.userId, hullDef.baseFuel);
      // Persist cosmetic ship color
      const shipColor = data.shipColor?.slice(0, 7) || undefined;
      client.send('shipData', {
        id: newShip.id, ownerId: auth.userId, hullType: newShip.hullType,
        name: newShip.name, modules: newShip.modules, stats: newStats,
        fuel: hullDef.baseFuel, active: true, shipColor,
      });
      const remainingCredits = await getPlayerCredits(auth.userId);
      client.send('creditsUpdate', { credits: remainingCredits });
    });

    this.onMessage('renameShip', async (client, data: { shipId: string; name: string }) => {
      const auth = client.auth as AuthPayload;
      const success = await renameShip(data.shipId, auth.userId, data.name);
      if (success) {
        client.send('shipRenamed', { shipId: data.shipId, name: data.name.slice(0, 20) });
      }
    });

    this.onMessage('renameBase', async (client, data: { name: string }) => {
      const auth = client.auth as AuthPayload;
      await renameBase(auth.userId, data.name);
      client.send('baseRenamed', { name: data.name.slice(0, 20) });
    });

    this.onMessage('getModuleInventory', async (client) => {
      const auth = client.auth as AuthPayload;
      const inventory = await getModuleInventory(auth.userId);
      client.send('moduleInventory', { modules: inventory });
    });

    // Tech-Baum: Research
    this.onMessage('startResearch', (client, data) => this.handleStartResearch(client, data));
    this.onMessage('cancelResearch', (client) => this.handleCancelResearch(client));
    this.onMessage('claimResearch', (client) => this.handleClaimResearch(client));
    this.onMessage('activateBlueprint', (client, data) => this.handleActivateBlueprint(client, data));
    this.onMessage('getResearchState', (client) => this.handleGetResearchState(client));

    // NPC Station data request
    this.onMessage('getNpcStation', async (client) => {
      if (this._pst(client.sessionId) !== 'station') return;
      await this.sendNpcStationUpdate(client, this._px(client.sessionId), this._py(client.sessionId));
    });

    // Trade route processing interval
    this.clock.setInterval(() => {
      this.processTradeRoutes().catch(err => console.error('[TRADE ROUTES] Tick error:', err));
    }, 60000);

    // --- Admin Bus ---
    const onBroadcast = (event: AdminBroadcastEvent) => {
      for (const client of this.clients) {
        const auth = client.auth as AuthPayload;
        if (event.scope === 'universal' || event.targetPlayers.includes(auth.userId)) {
          client.send('adminMessage', {
            id: event.messageId,
            senderName: event.senderName,
            content: event.content,
            scope: event.scope,
            channel: event.channel,
            allowReply: event.allowReply,
            createdAt: new Date().toISOString(),
          });
        }
      }
    };
    const onQuestCreated = (event: AdminQuestEvent) => {
      for (const client of this.clients) {
        const auth = client.auth as AuthPayload;
        if (event.scope === 'universal' || event.targetPlayers.includes(auth.userId)) {
          client.send('adminQuestOffer', {
            questId: event.questId,
            title: event.title,
            description: event.description,
            scope: event.scope,
          });
        }
      }
    };
    adminBus.on('adminBroadcast', onBroadcast);
    adminBus.on('adminQuestCreated', onQuestCreated);

    // Cross-room COMMS relay for sector/quadrant channels
    const onCommsBroadcast = (event: CommsBroadcastEvent) => {
      // Skip messages from the same quadrant room (already broadcast locally)
      const { qx: eventQx, qy: eventQy } = sectorToQuadrant(event.sectorX, event.sectorY);
      if (eventQx === this.quadrantX && eventQy === this.quadrantY) return;

      if (event.channel === 'quadrant' && event.quadrantX === this.quadrantX && event.quadrantY === this.quadrantY) {
        this.broadcast('chatMessage', event.message);
      }
      // For direct messages relayed cross-room
      if (event.message.channel === 'direct' && event.message.recipientId) {
        for (const c of this.clients) {
          const cAuth = c.auth as AuthPayload;
          if (cAuth.userId === event.message.recipientId) {
            c.send('chatMessage', event.message);
          }
        }
      }
    };
    commsBus.on('commsBroadcast', onCommsBroadcast);

    this.disposeCallbacks.push(() => {
      adminBus.off('adminBroadcast', onBroadcast);
      adminBus.off('adminQuestCreated', onQuestCreated);
      commsBus.off('commsBroadcast', onCommsBroadcast);
    });

    // ── Factory Handlers ──

    this.onMessage('factoryStatus', async (client) => {
      if (!this.checkRate(client.sessionId, 'factoryStatus', 500)) return;
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
    });

    this.onMessage('factorySetRecipe', async (client, data: { recipeId: string }) => {
      if (!this.checkRate(client.sessionId, 'factorySetRecipe', 1000)) return;
      if (rejectGuest(client, 'factory')) return;
      const auth = client.auth as AuthPayload;

      if (!data?.recipeId || typeof data.recipeId !== 'string') {
        client.send('factoryUpdate', { error: 'Invalid recipe ID' });
        return;
      }

      const factoryStruct = await getPlayerStructure(auth.userId, 'factory');
      if (!factoryStruct) {
        client.send('factoryUpdate', { error: 'No factory built' });
        return;
      }

      await getOrCreateFactoryState(factoryStruct.id, auth.userId);
      const research = await getPlayerResearch(auth.userId);
      const result = await setActiveRecipe(factoryStruct.id, data.recipeId, research?.blueprints ?? []);

      if (!result.success) {
        client.send('factoryUpdate', { error: result.error });
        return;
      }

      const status = await getFactoryStatus(factoryStruct.id);
      client.send('factoryUpdate', status);
    });

    this.onMessage('factoryCollect', async (client) => {
      if (!this.checkRate(client.sessionId, 'factoryCollect', 1000)) return;
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
    });

    this.onMessage('factoryTransfer', async (client, data: { itemType: string; amount: number }) => {
      if (!this.checkRate(client.sessionId, 'factoryTransfer', 500)) return;
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

      const result = await transferOutputToCargo(factoryStruct.id, data.itemType as ProcessedItemType, data.amount);
      if (!result.success) {
        client.send('factoryUpdate', { error: result.error });
        return;
      }

      // Add to player cargo
      await addToCargo(auth.userId, data.itemType as any, data.amount);

      // Send updates
      const status = await getFactoryStatus(factoryStruct.id);
      const cargo = await getPlayerCargo(auth.userId);
      client.send('factoryUpdate', status);
      client.send('cargoUpdate', cargo);
    });

    // ── Kontor Handlers ──

    this.onMessage('kontorPlaceOrder', async (client, data: { itemType: string; amount: number; pricePerUnit: number }) => {
      if (!this.checkRate(client.sessionId, 'kontorPlaceOrder', 1000)) return;
      if (rejectGuest(client, 'kontor')) return;
      const auth = client.auth as AuthPayload;

      if (!data?.itemType || typeof data.itemType !== 'string') {
        client.send('kontorUpdate', { error: 'Invalid item type' });
        return;
      }
      if (!isPositiveInt(data?.amount) || !isPositiveInt(data?.pricePerUnit)) {
        client.send('kontorUpdate', { error: 'Invalid order parameters' });
        return;
      }

      const result = await placeKontorOrder(
        auth.userId,
        this._px(client.sessionId),
        this._py(client.sessionId),
        data.itemType,
        data.amount,
        data.pricePerUnit
      );

      if (!result.success) {
        client.send('kontorUpdate', { error: result.error });
        return;
      }

      const orders = await getKontorOrders(this._px(client.sessionId), this._py(client.sessionId));
      client.send('kontorUpdate', { orders, placed: result.order });
    });

    this.onMessage('kontorCancelOrder', async (client, data: { orderId: string }) => {
      if (!this.checkRate(client.sessionId, 'kontorCancelOrder', 1000)) return;
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

      const orders = await getKontorOrders(this._px(client.sessionId), this._py(client.sessionId));
      client.send('kontorUpdate', { orders, refunded: result.refunded });
    });

    this.onMessage('kontorSellTo', async (client, data: { orderId: string; amount: number }) => {
      if (!this.checkRate(client.sessionId, 'kontorSellTo', 500)) return;
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

      const orders = await getKontorOrders(this._px(client.sessionId), this._py(client.sessionId));
      const cargo = await getPlayerCargo(auth.userId);
      client.send('kontorUpdate', { orders, earned: result.earned });
      client.send('cargoUpdate', cargo);
    });

    this.onMessage('kontorGetOrders', async (client) => {
      if (!this.checkRate(client.sessionId, 'kontorGetOrders', 500)) return;
      const orders = await getKontorOrders(this._px(client.sessionId), this._py(client.sessionId));
      client.send('kontorUpdate', { orders });
    });

    // -----------------------------------------------------------------------
    // Quadrant handlers
    // -----------------------------------------------------------------------

    this.onMessage('nameQuadrant', async (client, data: { qx: number; qy: number; name: string }) => {
      if (!this.checkRate(client.sessionId, 'nameQuadrant', 1000)) return;
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
        this.broadcast('announcement', {
          message: `Quadrant (${data.qx},${data.qy}) named "${data.name.trim()}" by ${auth.username}`,
          type: 'quadrant_named',
        });
      }
    });

    this.onMessage('getKnownQuadrants', async (client) => {
      if (!this.checkRate(client.sessionId, 'getKnownQuadrants', 500)) return;
      if (rejectGuest(client, 'getKnownQuadrants')) return;
      const auth = client.auth as AuthPayload;
      const known = await getPlayerKnownQuadrants(auth.userId);
      client.send('knownQuadrants', { quadrants: known });
    });

    this.onMessage('getKnownJumpGates', async (client) => {
      if (!this.checkRate(client.sessionId, 'getKnownJumpGates', 500)) return;
      if (rejectGuest(client, 'getKnownJumpGates')) return;
      const auth = client.auth as AuthPayload;
      const gates = await getPlayerKnownJumpGates(auth.userId);
      client.send('knownJumpGates', { gates });
    });

    this.onMessage('syncQuadrants', async (client) => {
      if (!this.checkRate(client.sessionId, 'syncQuadrants', 2000)) return;
      if (rejectGuest(client, 'syncQuadrants')) return;
      const auth = client.auth as AuthPayload;

      // Only allowed at stations
      const isStation = this._pst(client.sessionId) === 'station';
      if (!isStation) {
        client.send('syncQuadrantsResult', { success: false, error: 'Must be at a station to sync quadrant data' });
        return;
      }

      // Get all publicly known quadrant coords and batch-insert into player's known list
      const allCoords = await getAllDiscoveredQuadrantCoords();
      await addPlayerKnownQuadrantsBatch(auth.userId, allCoords);

      const known = await getPlayerKnownQuadrants(auth.userId);
      client.send('syncQuadrantsResult', { success: true, quadrants: known, synced: allCoords.length });
    });
  }

  async onJoin(client: Client, options: any, auth: AuthPayload) {
    try {
      // Player joins a specific sector within this quadrant room
      const sectorX = options?.sectorX ?? 0;
      const sectorY = options?.sectorY ?? 0;

      const player = new PlayerSchema();
      player.sessionId = client.sessionId;
      player.userId = auth.userId;
      player.username = auth.username;
      player.x = sectorX;
      player.y = sectorY;
      player.connected = true;

      this.state.players.set(client.sessionId, player);
      this.state.playerCount = this.state.players.size;

      // Load or generate sector for this player
      let sectorData = await getSector(sectorX, sectorY);
      if (!sectorData) {
        sectorData = generateSector(sectorX, sectorY, auth.userId);
        await saveSector(sectorData);
      }
      this.playerSectorData.set(client.sessionId, sectorData);

      // Send sector data to client
      client.send('sectorData', sectorData);

      // Send quadrant info (name + coords)
      const quadrantData = await getQuadrant(this.quadrantX, this.quadrantY);
      client.send('quadrantInfo', {
        qx: this.quadrantX,
        qy: this.quadrantY,
        name: quadrantData?.name ?? null,
      });

      // Save position
      await savePlayerPosition(auth.userId, sectorX, sectorY);

      // Load active ship (or create default scout on first login)
      let shipRecord = await getActiveShip(auth.userId);
      if (!shipRecord) {
        shipRecord = await createShip(auth.userId, 'scout', 'AEGIS', HULLS.scout.baseFuel);
      }
      const stats = calculateShipStats(shipRecord.hullType, shipRecord.modules);
      this.clientShips.set(client.sessionId, stats);
      this.clientHullTypes.set(client.sessionId, shipRecord.hullType);

      // Send ship data to client
      const fuelState = await getFuelState(auth.userId);
      client.send('shipData', {
        id: shipRecord.id,
        ownerId: auth.userId,
        hullType: shipRecord.hullType,
        name: shipRecord.name,
        modules: shipRecord.modules,
        stats,
        fuel: fuelState ?? stats.fuelMax,
        active: true,
      });

      // Init fuel state in Redis
      if (fuelState === null) {
        await saveFuelState(auth.userId, stats.fuelMax);
      }
      const fuelCurrent = fuelState ?? stats.fuelMax;
      client.send('fuelUpdate', { current: fuelCurrent, max: stats.fuelMax });

      // Record discovery
      await addDiscovery(auth.userId, sectorX, sectorY);

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

      // Send alien credits
      const alienCredits = await getAlienCredits(auth.userId);
      client.send('alienCreditsUpdate', { alienCredits });

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

      // Send all discoveries for hyperjump map
      const allDiscoveries = await getPlayerDiscoveries(auth.userId);
      client.send('allDiscoveries', { discoveries: allDiscoveries });

      // Phase 4: Send reputation + active quests
      await this.sendReputationUpdate(client, auth.userId);
      await this.sendActiveQuests(client, auth.userId);

      // Send research state
      const researchData = await getPlayerResearch(auth.userId);
      const activeResearch = await getActiveResearch(auth.userId);
      client.send('researchState', {
        unlockedModules: researchData.unlockedModules,
        blueprints: researchData.blueprints,
        activeResearch: activeResearch,
      });

      // Record NPC station visit for XP and per-station reputation
      if (sectorData.type === 'station') {
        recordVisit(sectorX, sectorY).catch(() => {});
        updatePlayerStationRep(auth.userId, sectorX, sectorY, STATION_REP_VISIT).catch(() => {});

        // Auto-refuel at station when FEATURE_HYPERDRIVE_V2 is enabled
        if (FEATURE_HYPERDRIVE_V2) {
          await this.navigation.tryAutoRefuel(client, auth, stats);
        }
      }

      // Send initial hyperdrive state when V2 is enabled
      if (FEATURE_HYPERDRIVE_V2 && stats.hyperdriveRange > 0) {
        let hdState = await getHyperdriveState(auth.userId);
        if (!hdState) {
          hdState = createHyperdriveState(stats);
          await setHyperdriveState(auth.userId, hdState);
        }
        client.send('hyperdriveUpdate', {
          charge: calculateCurrentCharge(hdState),
          maxCharge: hdState.maxCharge,
          regenPerSecond: hdState.regenPerSecond,
          lastTick: hdState.lastTick,
        });
      }

      // Resume active autopilot route if one exists
      try {
        const activeRoute = await getActiveAutopilotRoute(auth.userId);
        if (activeRoute && activeRoute.currentStep < activeRoute.totalSteps) {
          client.send('autopilotStart', {
            targetX: activeRoute.targetX,
            targetY: activeRoute.targetY,
            totalSteps: activeRoute.totalSteps,
            currentStep: activeRoute.currentStep,
            resumed: true,
          });
          this.navigation.startAutopilotTimer(client, auth, activeRoute.path, activeRoute.currentStep, activeRoute.useHyperjump, stats);
        }
      } catch (err) {
        console.error('[JOIN] Autopilot resume error:', err);
      }
    } catch (err) {
      console.error('[JOIN] Error:', err);
      client.send('error', { code: 'JOIN_FAILED', message: 'Failed to join sector' });
      client.leave();
    }
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

    // Clean up autopilot timer and pause DB route for resume on rejoin
    const autopilotTimer = this.autopilotTimers.get(client.sessionId);
    if (autopilotTimer) {
      clearInterval(autopilotTimer);
      this.autopilotTimers.delete(client.sessionId);
      try {
        const auth = client.auth as AuthPayload;
        await pauseAutopilotRoute(auth.userId);
      } catch {
        // Don't block leave on autopilot pause failure
      }
    }

    this.clientShips.delete(client.sessionId);
    this.clientHullTypes.delete(client.sessionId);
    this.rateLimits.delete(client.sessionId);
    this.playerSectorData.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.state.playerCount = this.state.players.size;
  }

  async onDispose() {
    for (const cb of this.disposeCallbacks) {
      cb();
    }
  }

  // handleMoveSector → NavigationService

  // handleJump, handleHyperJump, handleCancelAutopilot, handleStartAutopilot,
  // handleGetAutopilotStatus, startAutopilotTimer, tryAutoRefuel → NavigationService

  private async handleRefuel(client: Client, data: RefuelMessage) {
    if (!isPositiveInt(data.amount)) {
      client.send('refuelResult', { success: false, error: 'Invalid amount' });
      return;
    }
    const auth = client.auth as AuthPayload;

    // Must be at a station or own base
    const isStation = this._pst(client.sessionId) === 'station';
    const hasBaseHere = await playerHasBaseAtSector(
      auth.userId, this._px(client.sessionId), this._py(client.sessionId)
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

    const playerShips = await getPlayerShips(auth.userId);
    const isFreeRefuel = hasBaseHere && playerShips.length <= FREE_REFUEL_MAX_SHIPS;

    // Apply reputation price modifier at stations — use the better of station-rep vs faction-rep
    let priceModifier = 1.0;
    if (isStation && !isFreeRefuel) {
      const sx = this._px(client.sessionId);
      const sy = this._py(client.sessionId);

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

    const cost = isFreeRefuel ? 0 : Math.ceil(amount * FUEL_COST_PER_UNIT * priceModifier);

    if (cost > 0) {
      const credits = await getPlayerCredits(auth.userId);
      if (credits < cost) {
        client.send('refuelResult', { success: false, error: 'Not enough credits' });
        return;
      }
      await deductCredits(auth.userId, cost);
    }

    const newFuel = currentFuel + amount;
    await saveFuelState(auth.userId, newFuel);

    const remainingCredits = await getPlayerCredits(auth.userId);

    client.send('refuelResult', {
      success: true,
      fuel: { current: newFuel, max: ship.fuelMax },
      credits: remainingCredits,
    });
  }

  // handleEmergencyWarp → NavigationService

  private async handleMine(client: Client, data: MineMessage) {
    if (!this.checkRate(client.sessionId, 'mine', 500)) { client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' }); return; }
    if (!data.resource || !VALID_MINE_RESOURCES.includes(data.resource)) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Invalid resource type' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const { resource } = data;

    const sectorData = await getSector(this._px(client.sessionId), this._py(client.sessionId));
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
      this._px(client.sessionId),
      this._py(client.sessionId),
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
    if (rejectGuest(client, 'Abwerfen')) return;
    const auth = client.auth as AuthPayload;
    const { resource } = data;

    const cargo = await getPlayerCargo(auth.userId);
    const currentAmount = cargo[resource as keyof CargoState] ?? 0;

    const result = validateJettison(resource, currentAmount);
    if (!result.valid) {
      client.send('error', { code: 'JETTISON_FAILED', message: result.error! });
      return;
    }

    const jettisoned = await jettisonCargo(auth.userId, resource);
    const updatedCargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    client.send('logEntry', `FRACHT ABGEWORFEN: ${jettisoned} ${resource.toUpperCase()}`);
  }

  private async handleBuild(client: Client, data: BuildMessage) {
    if (rejectGuest(client, 'Bauen')) return;
    if (!this.checkRate(client.sessionId, 'build', 2000)) { client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' }); return; }
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
          client.send('buildResult', { success: false, error: `Insufficient ${resource} (concurrent modification)` });
          return;
        }
      }
    }

    let structure;
    try {
      structure = await createStructure(
        auth.userId, data.type,
        this._px(client.sessionId), this._py(client.sessionId)
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
      sectorX: this._px(client.sessionId),
      sectorY: this._py(client.sessionId),
    });
  }

  private async handleChat(client: Client, data: SendChatMessage) {
    if (!this.checkRate(client.sessionId, 'chat', 500)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Zu viele Nachrichten — bitte kurz warten' });
      return;
    }
    if (isGuest(client) && data.channel === 'faction') {
      client.send('error', { code: 'GUEST_RESTRICTED', message: 'Fraktions-Chat ist für Gäste nicht verfügbar' });
      return;
    }
    const auth = client.auth as AuthPayload;

    // Validate channel
    const VALID_CHANNELS = ['direct', 'faction', 'sector', 'quadrant'] as const;
    if (!VALID_CHANNELS.includes(data.channel as any)) {
      client.send('error', { code: 'INVALID_CHANNEL', message: 'Unknown channel' });
      return;
    }

    const cleanContent = sanitizeChat(data.content.trim());
    if (!cleanContent || cleanContent.length === 0) return;
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
      const msg = await saveMessage(auth.userId, null, 'faction', cleanContent);
      const chatMsg: ChatMessage = {
        id: msg.id,
        senderId: auth.userId,
        senderName: auth.username,
        channel: 'faction',
        content: cleanContent,
        sentAt: new Date(msg.sent_at).getTime(),
        delayed: false,
      };
      const memberIds = new Set(await getFactionMembersByPlayerIds(faction.id));
      for (const c of this.clients) {
        const cAuth = c.auth as AuthPayload;
        if (memberIds.has(cAuth.userId)) {
          c.send('chatMessage', chatMsg);
        }
      }
      return;
    }

    const msg = await saveMessage(auth.userId, data.recipientId ?? null, data.channel, cleanContent);

    const chatMsg: ChatMessage = {
      id: msg.id,
      senderId: auth.userId,
      senderName: auth.username,
      channel: data.channel,
      recipientId: data.recipientId,
      content: cleanContent,
      sentAt: new Date(msg.sent_at).getTime(),
      delayed: false,
    };

    if (data.channel === 'sector') {
      const senderX = this._px(client.sessionId);
      const senderY = this._py(client.sessionId);
      for (const c of this.clients) {
        if (this._px(c.sessionId) === senderX && this._py(c.sessionId) === senderY) {
          c.send('chatMessage', chatMsg);
        }
      }
      // Also emit to commsBus for other rooms at the same coordinates
      const { qx, qy } = sectorToQuadrant(this._px(client.sessionId), this._py(client.sessionId));
      commsBus.broadcast({
        channel: 'sector',
        sectorX: this._px(client.sessionId),
        sectorY: this._py(client.sessionId),
        quadrantX: qx,
        quadrantY: qy,
        message: chatMsg,
      });
    } else if (data.channel === 'quadrant') {
      // Broadcast to all players in this room (same quadrant)
      this.broadcast('chatMessage', chatMsg);
      // Emit to commsBus for other rooms in the same quadrant
      const { qx, qy } = sectorToQuadrant(this._px(client.sessionId), this._py(client.sessionId));
      commsBus.broadcast({
        channel: 'quadrant',
        sectorX: this._px(client.sessionId),
        sectorY: this._py(client.sessionId),
        quadrantX: qx,
        quadrantY: qy,
        message: chatMsg,
      });
    } else if (data.channel === 'direct' && data.recipientId) {
      const recipientClient = this.clients.find(
        c => (c.auth as AuthPayload).userId === data.recipientId
      );
      if (recipientClient) {
        recipientClient.send('chatMessage', chatMsg);
      }
      // Also emit to commsBus for cross-room direct delivery
      const { qx, qy } = sectorToQuadrant(this._px(client.sessionId), this._py(client.sessionId));
      commsBus.broadcast({
        channel: 'sector', // use sector channel for routing, message.channel is 'direct'
        sectorX: this._px(client.sessionId),
        sectorY: this._py(client.sessionId),
        quadrantX: qx,
        quadrantY: qy,
        message: chatMsg,
      });
      client.send('chatMessage', chatMsg);
    }
  }

  private async handleTransfer(client: Client, data: TransferMessage) {
    if (!this.checkRate(client.sessionId, 'transfer', 500)) { client.send('transferResult', { success: false, error: 'Too fast' }); return; }
    if (!isPositiveInt(data.amount) || !VALID_TRANSFER_RESOURCES.includes(data.resource)) {
      client.send('transferResult', { success: false, error: 'Invalid transfer parameters' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const { resource, amount, direction } = data;

    const player = await findPlayerByUsername(auth.username);
    if (!player) { client.send('error', { code: 'NO_PLAYER', message: 'Player not found' }); return; }
    if (this._px(client.sessionId) !== player.homeBase.x || this._py(client.sessionId) !== player.homeBase.y) {
      client.send('transferResult', { success: false, error: 'Must be at home base' });
      return;
    }

    const storageStruct = await getPlayerStructure(auth.userId, 'storage');
    // Home base always provides basic tier 1 storage, even without a storage structure
    const storageTier = storageStruct?.tier ?? 1;

    const currentCargo = await getPlayerCargo(auth.userId);
    const storage = await getStorageInventory(auth.userId);
    const result = validateTransfer(direction, resource, amount, currentCargo, storage, storageTier);
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

  private async sendNpcStationUpdate(client: Client, sx: number, sy: number): Promise<void> {
    const station = await getOrInitStation(sx, sy);
    const inventory = await getStationInventory(sx, sy);
    const level = getStationLevel(station.xp);
    const items = inventory.map(item => {
      const currentStock = calculateCurrentStock(item);
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
    const nextLevel = NPC_STATION_LEVELS.find(l => l.xpThreshold > station.xp);
    client.send('npcStationUpdate', {
      level: level.level,
      name: level.name,
      xp: station.xp,
      nextLevelXp: nextLevel?.xpThreshold ?? station.xp,
      inventory: items,
    });
  }

  private async handleNpcTrade(client: Client, data: NpcTradeMessage) {
    if (!this.checkRate(client.sessionId, 'npcTrade', 250)) {
      client.send('npcTradeResult', { success: false, error: 'Too fast — please wait' });
      return;
    }
    if (data.resource === 'artefact') {
      client.send('npcTradeResult', { success: false, error: 'Artefakte können nicht an NPCs gehandelt werden' });
      return;
    }
    if (!isPositiveInt(data.amount) || !VALID_MINE_RESOURCES.includes(data.resource)) {
      client.send('npcTradeResult', { success: false, error: 'Invalid trade parameters' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const { resource, amount, action } = data;

    const player = await findPlayerByUsername(auth.username);
    if (!player) return;

    const isStation = this._pst(client.sessionId) === 'station';
    const isHomeBase = this._px(client.sessionId) === player.homeBase.x &&
                       this._py(client.sessionId) === player.homeBase.y;
    if (!isStation && !isHomeBase) {
      client.send('npcTradeResult', { success: false, error: 'Must be at a station or home base' });
      return;
    }

    const currentCredits = await getPlayerCredits(auth.userId);

    // Apply faction trade price bonus (discount on buy prices)
    const bonuses = await this.getPlayerBonuses(auth.userId);

    if (isStation) {
      // Station trade: use cargo with dynamic pricing from NPC station engine
      const cargo = await getPlayerCargo(auth.userId);
      const cargoTotal = await getCargoTotal(auth.userId);
      const shipStats = this.getShipForClient(client.sessionId);
      const sx = this._px(client.sessionId);
      const sy = this._py(client.sessionId);

      if (action === 'sell') {
        // Check cargo has enough
        if (cargo[resource as MineableResourceType] < amount) {
          client.send('npcTradeResult', { success: false, error: `Not enough ${resource} in cargo` });
          return;
        }
        // Check station can accept
        const sellCheck = await canSellToStation(sx, sy, resource, amount);
        if (!sellCheck.ok) {
          client.send('npcTradeResult', { success: false, error: 'Station cannot accept more of this resource' });
          return;
        }
        // Execute trade
        const deducted = await deductCargo(auth.userId, resource, amount);
        if (!deducted) { client.send('npcTradeResult', { success: false, error: 'Cargo changed' }); return; }
        // Update station stock
        const invItem = await getStationInventoryItem(sx, sy, resource);
        if (invItem) {
          invItem.stock = Math.min(invItem.stock + amount, invItem.maxStock);
          invItem.lastUpdated = new Date().toISOString();
          await upsertInventoryItem(invItem);
        }
        const newCredits = await addCredits(auth.userId, sellCheck.price);
        await recordTrade(sx, sy, amount);
        updatePlayerStationRep(auth.userId, sx, sy, STATION_REP_TRADE).catch(() => {});
        const updatedCargo = await getPlayerCargo(auth.userId);
        client.send('npcTradeResult', { success: true, credits: newCredits });
        client.send('creditsUpdate', { credits: newCredits });
        client.send('cargoUpdate', updatedCargo);
        // Send station info update (rich format with inventory)
        await this.sendNpcStationUpdate(client, sx, sy);
      } else {
        // Buy: check station has stock
        const buyCheck = await canBuyFromStation(sx, sy, resource, amount);
        if (!buyCheck.ok) {
          client.send('npcTradeResult', { success: false, error: 'Station does not have enough stock' });
          return;
        }
        // Apply faction bonus
        let totalPrice = buyCheck.price;
        totalPrice = Math.ceil(totalPrice * bonuses.tradePriceMultiplier);
        // Check credits
        if (currentCredits < totalPrice) {
          client.send('npcTradeResult', { success: false, error: `Need ${totalPrice} credits (have ${currentCredits})` });
          return;
        }
        // Check cargo space
        if (cargoTotal + amount > shipStats.cargoCap) {
          client.send('npcTradeResult', { success: false, error: 'Cargo full' });
          return;
        }
        // Execute trade
        const deducted = await deductCredits(auth.userId, totalPrice);
        if (!deducted) { client.send('npcTradeResult', { success: false, error: 'Credits changed' }); return; }
        await addToCargo(auth.userId, resource, amount);
        // Update station stock
        const invItem = await getStationInventoryItem(sx, sy, resource);
        if (invItem) {
          invItem.stock = Math.max(invItem.stock - amount, 0);
          invItem.lastUpdated = new Date().toISOString();
          await upsertInventoryItem(invItem);
        }
        const newCredits = await getPlayerCredits(auth.userId);
        await recordTrade(sx, sy, amount);
        updatePlayerStationRep(auth.userId, sx, sy, STATION_REP_TRADE).catch(() => {});
        const updatedCargo = await getPlayerCargo(auth.userId);
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

      const result = validateNpcTrade(action, resource, amount, currentCredits, storage, storageTier);
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
    if (rejectGuest(client, 'Markthandel')) return;
    if (!isPositiveInt(data.amount) || !isPositiveInt(data.pricePerUnit) || data.pricePerUnit > 999999) {
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
    if (rejectGuest(client, 'Data Slates erstellen')) return;
    const auth = client.auth as AuthPayload;
    if (!['sector', 'area'].includes(data.slateType)) {
      client.send('createSlateResult', { success: false, error: 'Invalid slate type' });
      return;
    }

    const ship = this.getShipForClient(client.sessionId);
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const cargo = await getPlayerCargo(auth.userId);
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;

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
    const sectorX = this._px(client.sessionId);
    const sectorY = this._py(client.sessionId);

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
    if (rejectGuest(client, 'Fraktionen')) return;
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
    if (rejectGuest(client, 'Fraktionen')) return;
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

  private async checkQuestProgress(client: Client, playerId: string, action: string, context: Record<string, any>) {
    const rows = await getActiveQuests(playerId);
    const cargo = await getPlayerCargo(playerId);
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

    const gate = await getJumpGate(this._px(client.sessionId), this._py(client.sessionId));
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

    const gate = await getJumpGate(this._px(client.sessionId), this._py(client.sessionId));
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
    if (data.sectorX !== this._px(client.sessionId) || data.sectorY !== this._py(client.sessionId)) {
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

  private async handleDeliverSurvivors(client: Client, data: DeliverSurvivorsMessage): Promise<void> {
    const auth = client.auth as AuthPayload;

    // Must be at a station
    if (this._pst(client.sessionId) !== 'station') {
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
            const fuelCost = calculateRouteFuelCost(tradingPost.sector_x, tradingPost.sector_y, route.targetX, route.targetY);
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
                  const price = NPC_PRICES[route.sellResource as MineableResourceType] * NPC_SELL_SPREAD;
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
            console.error(`[TRADE ROUTE] Error processing ${route.id}:`, err);
          }
        }
      } catch (err) {
        console.error(`[TRADE ROUTES] Error for owner ${ownerId}:`, err);
      }
    }
  }

  // ─── Tech-Baum: Research Handlers ──────────────────────────────────

  private async handleGetResearchState(client: Client) {
    const auth = client.auth as AuthPayload;
    const research = await getPlayerResearch(auth.userId);
    const active = await getActiveResearch(auth.userId);
    client.send('researchState', {
      unlockedModules: research.unlockedModules,
      blueprints: research.blueprints,
      activeResearch: active,
    });
  }

  private async handleStartResearch(client: Client, data: { moduleId: string }) {
    const auth = client.auth as AuthPayload;
    const mod = MODULES[data.moduleId];
    if (!mod || !mod.researchCost) {
      client.send('researchResult', { success: false, error: 'Invalid module' });
      return;
    }

    // Must be at home base
    const homeBase = await getPlayerHomeBase(auth.userId);
    if (!homeBase || homeBase.x !== this._px(client.sessionId) || homeBase.y !== this._py(client.sessionId)) {
      client.send('researchResult', { success: false, error: 'Must be at home base' });
      return;
    }

    // Build research state
    const dbResearch = await getPlayerResearch(auth.userId);
    const active = await getActiveResearch(auth.userId);
    const researchState: ResearchState = {
      unlockedModules: dbResearch.unlockedModules,
      blueprints: dbResearch.blueprints,
      activeResearch: active,
    };

    // Get player resources
    const credits = await getPlayerCredits(auth.userId);
    const cargo = await getPlayerCargo(auth.userId);
    const storage = await getStorageInventory(auth.userId);

    const resources = {
      credits,
      ore: cargo.ore + (storage?.ore ?? 0),
      gas: cargo.gas + (storage?.gas ?? 0),
      crystal: cargo.crystal + (storage?.crystal ?? 0),
      artefact: cargo.artefact + (storage?.artefact ?? 0),
    };

    // Check faction tiers for special modules
    const reps = await getPlayerReputations(auth.userId);
    const factionTiers: Record<string, string> = {};
    for (const rep of reps) {
      const tier = getReputationTier(rep.reputation);
      factionTiers[rep.faction_id] = tier;
    }

    const validation = canStartResearch(data.moduleId, researchState, resources, factionTiers);
    if (!validation.valid) {
      client.send('researchResult', { success: false, error: validation.error });
      return;
    }

    // Deduct costs (from credits first, then cargo for resources)
    const cost = mod.researchCost!;
    await deductCredits(auth.userId, cost.credits);
    if (cost.ore) await deductCargo(auth.userId, 'ore', cost.ore);
    if (cost.gas) await deductCargo(auth.userId, 'gas', cost.gas);
    if (cost.crystal) await deductCargo(auth.userId, 'crystal', cost.crystal);
    if (cost.artefact) await deductCargo(auth.userId, 'artefact', cost.artefact);

    // Start research timer
    const now = Date.now();
    const durationMs = (mod.researchDurationMin ?? 5) * RESEARCH_TICK_MS;
    await startActiveResearch(auth.userId, data.moduleId, now, now + durationMs);

    client.send('researchResult', {
      success: true,
      activeResearch: { moduleId: data.moduleId, startedAt: now, completesAt: now + durationMs },
    });
  }

  private async handleCancelResearch(client: Client) {
    const auth = client.auth as AuthPayload;
    const active = await getActiveResearch(auth.userId);
    if (!active) {
      client.send('researchResult', { success: false, error: 'No active research' });
      return;
    }
    await deleteActiveResearch(auth.userId);
    client.send('researchResult', { success: true, activeResearch: null });
  }

  private async handleClaimResearch(client: Client) {
    const auth = client.auth as AuthPayload;
    const active = await getActiveResearch(auth.userId);
    if (!active) {
      client.send('researchResult', { success: false, error: 'No active research' });
      return;
    }
    if (Date.now() < active.completesAt) {
      client.send('researchResult', { success: false, error: 'Research not complete' });
      return;
    }

    await addUnlockedModule(auth.userId, active.moduleId);
    await deleteActiveResearch(auth.userId);

    const research = await getPlayerResearch(auth.userId);
    client.send('researchResult', {
      success: true,
      claimed: active.moduleId,
      unlockedModules: research.unlockedModules,
      activeResearch: null,
    });
    client.send('logEntry', `FORSCHUNG ABGESCHLOSSEN: ${MODULES[active.moduleId]?.name ?? active.moduleId}`);
  }

  private async handleActivateBlueprint(client: Client, data: { moduleId: string }) {
    const auth = client.auth as AuthPayload;
    const research = await getPlayerResearch(auth.userId);
    if (!research.blueprints.includes(data.moduleId)) {
      client.send('researchResult', { success: false, error: 'Blueprint not found' });
      return;
    }

    // Move from blueprints to unlocked
    await addUnlockedModule(auth.userId, data.moduleId);
    // Remove from blueprints array
    await query(
      `UPDATE player_research SET blueprints = array_remove(blueprints, $2::text) WHERE user_id = $1`,
      [auth.userId, data.moduleId]
    );

    const updated = await getPlayerResearch(auth.userId);
    client.send('researchResult', {
      success: true,
      activated: data.moduleId,
      unlockedModules: updated.unlockedModules,
      blueprints: updated.blueprints,
    });
    client.send('logEntry', `BLAUPAUSE AKTIVIERT: ${MODULES[data.moduleId]?.name ?? data.moduleId}`);
  }

  // ---------------------------------------------------------------------------
  // Quadrant first-contact detection
  // ---------------------------------------------------------------------------
  private async checkFirstContact(client: Client, auth: AuthPayload, targetX: number, targetY: number) {
    try {
      const { qx, qy } = sectorToQuadrant(targetX, targetY);
      const currentQ = sectorToQuadrant(this._px(client.sessionId), this._py(client.sessionId));

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
        } as FirstContactEvent);

        // Broadcast to all connected players
        this.broadcast('announcement', {
          message: `[${quadrant.name}] charted by ${auth.username}`,
          type: 'quadrant_discovery',
        });
      } else {
        // Quadrant exists but player may not know it yet
        await addPlayerKnownQuadrant(auth.userId, qx, qy);
      }
    } catch (err) {
      console.error('[checkFirstContact] Error:', err);
    }
  }
}
