import colyseus from 'colyseus';
import type { Client } from 'colyseus';
const { Room, ServerError } = colyseus;

import { SectorRoomState, PlayerSchema } from './schema/SectorState.js';
import { verifyToken, type AuthPayload } from '../auth.js';
import { generateSector } from '../engine/worldgen.js';
import { calculateCurrentAP } from '../engine/ap.js';
import { stopMining } from '../engine/mining.js';
import { calculateBonuses } from '../engine/factionBonuses.js';
import type { FactionBonuses } from '../engine/factionBonuses.js';
import { recordVisit } from '../engine/npcStationEngine.js';
import { sectorToQuadrant } from '../engine/quadrantEngine.js';
import { adminBus } from '../adminBus.js';
import type { AdminBroadcastEvent, AdminQuestEvent } from '../adminBus.js';
import { commsBus } from '../commsBus.js';
import type { CommsBroadcastEvent } from '../commsBus.js';
import {
  getAPState,
  saveAPState,
  savePlayerPosition,
  getMiningState,
  saveMiningState,
  getFuelState,
  saveFuelState,
  getHyperdriveState,
  setHyperdriveState,
} from './services/RedisAPStore.js';
import {
  getSector,
  saveSector,
  addDiscovery,
  getPlayerDiscoveries,
  getPlayerCargo,
  addToCargo,
  getCargoTotal,
  getActiveShip,
  createShip,
  getPendingMessages,
  markMessagesDelivered,
  getRecentMessages,
  getStorageInventory,
  getPlayerCredits,
  getAlienCredits,
  getPlayerBookmarks,
  getPlayerFaction,
  getFactionUpgrades,
  getPlayerResearch,
  getActiveResearch,
  getActiveAutopilotRoute,
  pauseAutopilotRoute,
  updatePlayerStationRep,
} from '../db/queries.js';
import { getQuadrant } from '../db/quadrantQueries.js';
import {
  RECONNECTION_TIMEOUT_S,
  FEATURE_HYPERDRIVE_V2,
  calculateShipStats,
  createHyperdriveState,
  calculateCurrentCharge,
  HULLS,
  STATION_REP_VISIT,
} from '@void-sector/shared';
import type {
  SectorData,
  JumpMessage,
  MineMessage,
  JettisonMessage,
  BuildMessage,
  SendChatMessage,
  TransferMessage,
  NpcTradeMessage,
  UpgradeStructureMessage,
  PlaceOrderMessage,
  CreateSlateMessage,
  ActivateSlateMessage,
  NpcBuybackMessage,
  ListSlateMessage,
  CreateFactionMessage,
  FactionActionMessage,
  GetStationNpcsMessage,
  AcceptQuestMessage,
  AbandonQuestMessage,
  BattleActionMessage,
  CompleteScanEventMessage,
  RefuelMessage,
  SetBookmarkMessage,
  ClearBookmarkMessage,
  HyperJumpMessage,
  HullType,
  ShipStats,
  CombatV2State,
  CombatV2ActionMessage,
  CombatV2FleeMessage,
  ChatMessage,
} from '@void-sector/shared';
import type { ServiceContext } from './services/ServiceContext.js';
import { NavigationService } from './services/NavigationService.js';
import { ScanService } from './services/ScanService.js';
import { CombatService } from './services/CombatService.js';
import { MiningService } from './services/MiningService.js';
import { EconomyService } from './services/EconomyService.js';
import { FactionService } from './services/FactionService.js';
import { QuestService } from './services/QuestService.js';
import { ChatService } from './services/ChatService.js';
import { ShipService } from './services/ShipService.js';
import { WorldService } from './services/WorldService.js';
import { logger } from '../utils/logger.js';

interface SectorRoomOptions {
  quadrantX: number;
  quadrantY: number;
  sectorX: number;
  sectorY: number;
}

export class SectorRoom extends Room<SectorRoomState> {
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
  private mining!: MiningService;
  private economy!: EconomyService;
  private factions!: FactionService;
  private quests!: QuestService;
  private chat!: ChatService;
  private ships!: ShipService;
  private world!: WorldService;

  /** Get a player's current sector X coordinate */
  private _px(sid: string): number {
    return this.state.players.get(sid)?.x ?? 0;
  }
  /** Get a player's current sector Y coordinate */
  private _py(sid: string): number {
    return this.state.players.get(sid)?.y ?? 0;
  }
  /** Get a player's current sector type from cache */
  private _pst(sid: string): string {
    return this.playerSectorData.get(sid)?.type ?? 'empty';
  }

  private checkRate(sessionId: string, action: string, intervalMs: number): boolean {
    let map = this.rateLimits.get(sessionId);
    if (!map) {
      map = new Map();
      this.rateLimits.set(sessionId, map);
    }
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
    return calculateBonuses(upgrades.map((u) => ({ tier: u.tier, choice: u.choice as 'A' | 'B' })));
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
      broadcastToFaction: (msg, memberIds) => {
        for (const c of this.clients) {
          const cAuth = c.auth as AuthPayload;
          if (memberIds.has(cAuth.userId)) {
            c.send('chatMessage', msg);
          }
        }
      },
      broadcastToSector: (msg, sectorX, sectorY) => {
        for (const c of this.clients) {
          if (this._px(c.sessionId) === sectorX && this._py(c.sessionId) === sectorY) {
            c.send('chatMessage', msg);
          }
        }
      },
      sendToPlayer: (userId, type, data) => {
        const recipient = this.clients.find((c) => (c.auth as AuthPayload).userId === userId);
        if (recipient) {
          recipient.send(type, data);
        }
      },
      disposeCallbacks: this.disposeCallbacks,
      roomId: this.roomId,
      // These will be wired to WorldService/QuestService after instantiation
      checkFirstContact: null as any,
      checkQuestProgress: null as any,
      checkAndEmitDistressCalls: null as any,
      applyReputationChange: null as any,
      applyXpGain: null as any,
    };

    // Instantiate services
    this.navigation = new NavigationService(this.serviceCtx);
    this.scanning = new ScanService(this.serviceCtx);
    this.combat = new CombatService(this.serviceCtx);
    this.mining = new MiningService(this.serviceCtx);
    this.economy = new EconomyService(this.serviceCtx);
    this.factions = new FactionService(this.serviceCtx);
    this.quests = new QuestService(this.serviceCtx);
    this.chat = new ChatService(this.serviceCtx);
    this.ships = new ShipService(this.serviceCtx);
    this.world = new WorldService(this.serviceCtx);

    // Wire cross-service callbacks
    this.serviceCtx.checkQuestProgress = this.quests.checkQuestProgress.bind(this.quests);
    this.serviceCtx.applyReputationChange = this.quests.applyReputationChange.bind(this.quests);
    this.serviceCtx.applyXpGain = this.quests.applyXpGain.bind(this.quests);
    this.serviceCtx.checkFirstContact = this.world.checkFirstContact.bind(this.world);
    this.serviceCtx.checkAndEmitDistressCalls = this.world.checkAndEmitDistressCalls.bind(
      this.world,
    );

    // ── Navigation ──────────────────────────────────────────────────
    this.onMessage('moveSector', async (client, data: { sectorX: number; sectorY: number }) => {
      try {
        await this.navigation.handleMoveSector(client, data);
      } catch (err) {
        logger.error({ err }, 'moveSector error');
        client.send('error', { code: 'MOVE_FAILED', message: 'Failed to move sector' });
      }
    });
    this.onMessage('jump', async (client, data: JumpMessage) => {
      try {
        await this.navigation.handleJump(client, data);
      } catch (err) {
        logger.error({ err }, 'Jump unhandled error');
        client.send('jumpResult', { success: false, error: 'Server error' });
      }
    });
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

    // ── Scanning ────────────────────────────────────────────────────
    this.onMessage('localScan', async (client) => {
      try {
        await this.scanning.handleLocalScan(client);
      } catch (err) {
        logger.error({ err }, 'localScan unhandled error');
        client.send('localScanResult', { error: 'Server error' });
      }
    });
    this.onMessage('areaScan', async (client) => {
      try {
        await this.scanning.handleAreaScan(client);
      } catch (err) {
        logger.error({ err }, 'areaScan unhandled error');
        client.send('scanResult', { sectors: [], error: 'Server error' });
      }
    });
    this.onMessage('scan', async (client) => {
      try {
        await this.scanning.handleAreaScan(client);
      } catch (err) {
        logger.error({ err }, 'scan unhandled error');
        client.send('scanResult', { sectors: [], error: 'Server error' });
      }
    });
    this.onMessage('completeScanEvent', async (client, data: CompleteScanEventMessage) => {
      await this.scanning.handleCompleteScanEvent(client, data);
    });

    // ── Combat ──────────────────────────────────────────────────────
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

    // ── Mining ──────────────────────────────────────────────────────
    this.onMessage('mine', async (client, data: MineMessage) => {
      await this.mining.handleMine(client, data);
    });
    this.onMessage('stopMine', async (client) => {
      await this.mining.handleStopMine(client);
    });
    this.onMessage('jettison', async (client, data: JettisonMessage) => {
      await this.mining.handleJettison(client, data);
    });

    // ── Economy ─────────────────────────────────────────────────────
    this.onMessage('transfer', async (client, data: TransferMessage) => {
      await this.economy.handleTransfer(client, data);
    });
    this.onMessage('npcTrade', async (client, data: NpcTradeMessage) => {
      await this.economy.handleNpcTrade(client, data);
    });
    this.onMessage('upgradeStructure', async (client, data: UpgradeStructureMessage) => {
      await this.economy.handleUpgradeStructure(client, data);
    });
    this.onMessage('placeOrder', async (client, data: PlaceOrderMessage) => {
      await this.economy.handlePlaceOrder(client, data);
    });
    this.onMessage('refuel', async (client, data: RefuelMessage) => {
      await this.economy.handleRefuel(client, data);
    });
    this.onMessage('getNpcStation', async (client) => {
      if (this._pst(client.sessionId) !== 'station') return;
      await this.economy.sendNpcStationUpdate(
        client,
        this._px(client.sessionId),
        this._py(client.sessionId),
      );
    });
    this.onMessage('factoryStatus', async (client) => {
      await this.economy.handleFactoryStatus(client);
    });
    this.onMessage('factorySetRecipe', async (client, data: { recipeId: string }) => {
      await this.economy.handleFactorySetRecipe(client, data);
    });
    this.onMessage('factoryCollect', async (client) => {
      await this.economy.handleFactoryCollect(client);
    });
    this.onMessage(
      'factoryTransfer',
      async (client, data: { itemType: string; amount: number }) => {
        await this.economy.handleFactoryTransfer(client, data);
      },
    );
    this.onMessage(
      'kontorPlaceOrder',
      async (client, data: { itemType: string; amount: number; pricePerUnit: number }) => {
        await this.economy.handleKontorPlaceOrder(client, data);
      },
    );
    this.onMessage('kontorCancelOrder', async (client, data: { orderId: string }) => {
      await this.economy.handleKontorCancelOrder(client, data);
    });
    this.onMessage('kontorSellTo', async (client, data: { orderId: string; amount: number }) => {
      await this.economy.handleKontorSellTo(client, data);
    });
    this.onMessage('kontorGetOrders', async (client) => {
      await this.economy.handleKontorGetOrders(client);
    });

    // ── Factions ────────────────────────────────────────────────────
    this.onMessage('createFaction', async (client, data: CreateFactionMessage) => {
      await this.factions.handleCreateFaction(client, data);
    });
    this.onMessage('getFaction', async (client) => {
      await this.factions.sendFactionData(client);
    });
    this.onMessage('factionAction', async (client, data: FactionActionMessage) => {
      await this.factions.handleFactionAction(client, data);
    });
    this.onMessage('respondInvite', async (client, data: { inviteId: string; accept: boolean }) => {
      await this.factions.handleRespondInvite(client, data);
    });
    this.onMessage('factionUpgrade', (client, data) =>
      this.factions.handleFactionUpgrade(client, data),
    );

    // ── Quests / NPC ────────────────────────────────────────────────
    this.onMessage('getStationNpcs', async (client, data: GetStationNpcsMessage) => {
      await this.quests.handleGetStationNpcs(client, data);
    });
    this.onMessage('acceptQuest', async (client, data: AcceptQuestMessage) => {
      await this.quests.handleAcceptQuest(client, data);
    });
    this.onMessage('abandonQuest', async (client, data: AbandonQuestMessage) => {
      await this.quests.handleAbandonQuest(client, data);
    });
    this.onMessage('getActiveQuests', async (client) => {
      await this.quests.handleGetActiveQuests(client);
    });
    this.onMessage('getReputation', async (client) => {
      await this.quests.handleGetReputation(client);
    });

    // ── Chat ────────────────────────────────────────────────────────
    this.onMessage('chat', async (client, data: SendChatMessage) => {
      await this.chat.handleChat(client, data);
    });

    // ── Ship / Research ─────────────────────────────────────────────
    this.onMessage('getShips', async (client) => {
      await this.ships.handleGetShips(client);
    });
    this.onMessage('switchShip', async (client, data: { shipId: string }) => {
      await this.ships.handleSwitchShip(client, data);
    });
    this.onMessage(
      'installModule',
      async (client, data: { moduleId: string; slotIndex: number }) => {
        await this.ships.handleInstallModule(client, data);
      },
    );
    this.onMessage('removeModule', async (client, data: { slotIndex: number }) => {
      await this.ships.handleRemoveModule(client, data);
    });
    this.onMessage('buyModule', async (client, data: { moduleId: string }) => {
      await this.ships.handleBuyModule(client, data);
    });
    this.onMessage(
      'buyHull',
      async (client, data: { hullType: string; name?: string; shipColor?: string }) => {
        await this.ships.handleBuyHull(client, data);
      },
    );
    this.onMessage('renameShip', async (client, data: { shipId: string; name: string }) => {
      await this.ships.handleRenameShip(client, data);
    });
    this.onMessage('renameBase', async (client, data: { name: string }) => {
      await this.ships.handleRenameBase(client, data);
    });
    this.onMessage('getModuleInventory', async (client) => {
      await this.ships.handleGetModuleInventory(client);
    });
    this.onMessage('startResearch', (client, data) => this.ships.handleStartResearch(client, data));
    this.onMessage('cancelResearch', (client) => this.ships.handleCancelResearch(client));
    this.onMessage('claimResearch', (client) => this.ships.handleClaimResearch(client));
    this.onMessage('activateBlueprint', (client, data) =>
      this.ships.handleActivateBlueprint(client, data),
    );
    this.onMessage('getResearchState', (client) => this.ships.handleGetResearchState(client));

    // ── World / Data Queries ────────────────────────────────────────
    this.onMessage('getAP', async (client) => {
      await this.world.handleGetAP(client);
    });
    this.onMessage('getDiscoveries', async (client) => {
      await this.world.handleGetDiscoveries(client);
    });
    this.onMessage('getCargo', async (client) => {
      await this.world.handleGetCargo(client);
    });
    this.onMessage('getMiningStatus', async (client) => {
      await this.world.handleGetMiningStatus(client);
    });
    this.onMessage('getBase', async (client) => {
      await this.world.handleGetBase(client);
    });
    this.onMessage('getCredits', async (client) => {
      await this.world.handleGetCredits(client);
    });
    this.onMessage('getStorage', async (client) => {
      await this.world.handleGetStorage(client);
    });
    this.onMessage('getTradeOrders', async (client) => {
      await this.world.handleGetTradeOrders(client);
    });
    this.onMessage('getMyOrders', async (client) => {
      await this.world.handleGetMyOrders(client);
    });
    this.onMessage('cancelOrder', async (client, data: { orderId: string }) => {
      await this.world.handleCancelOrder(client, data);
    });
    this.onMessage('getMySlates', async (client) => {
      await this.world.handleGetMySlates(client);
    });
    this.onMessage('build', async (client, data: BuildMessage) => {
      await this.world.handleBuild(client, data);
    });
    this.onMessage('createSlate', async (client, data: CreateSlateMessage) => {
      await this.world.handleCreateSlate(client, data);
    });
    this.onMessage('activateSlate', async (client, data: ActivateSlateMessage) => {
      await this.world.handleActivateSlate(client, data);
    });
    this.onMessage('npcBuybackSlate', async (client, data: NpcBuybackMessage) => {
      await this.world.handleNpcBuyback(client, data);
    });
    this.onMessage('listSlate', async (client, data: ListSlateMessage) => {
      await this.world.handleListSlate(client, data);
    });
    this.onMessage('acceptSlateOrder', async (client, data: { orderId: string }) => {
      await this.world.handleAcceptSlateOrder(client, data);
    });

    // ── Jump Gates / Rescue ─────────────────────────────────────────
    this.onMessage('useJumpGate', (client, data) => this.world.handleUseJumpGate(client, data));
    this.onMessage('frequencyMatch', (client, data) =>
      this.world.handleFrequencyMatch(client, data),
    );
    this.onMessage('rescue', (client, data) => this.world.handleRescue(client, data));
    this.onMessage('deliverSurvivors', (client, data) =>
      this.world.handleDeliverSurvivors(client, data),
    );

    // ── Trade Routes ────────────────────────────────────────────────
    this.onMessage('configureRoute', (client, data) =>
      this.world.handleConfigureRoute(client, data),
    );
    this.onMessage('toggleRoute', (client, data) => this.world.handleToggleRoute(client, data));
    this.onMessage('deleteRoute', (client, data) => this.world.handleDeleteRoute(client, data));

    // ── Bookmarks ───────────────────────────────────────────────────
    this.onMessage('getBookmarks', async (client) => {
      await this.world.handleGetBookmarks(client);
    });
    this.onMessage('setBookmark', async (client, data: SetBookmarkMessage) => {
      await this.world.handleSetBookmark(client, data);
    });
    this.onMessage('clearBookmark', async (client, data: ClearBookmarkMessage) => {
      await this.world.handleClearBookmark(client, data);
    });

    // ── Quadrants ───────────────────────────────────────────────────
    this.onMessage(
      'nameQuadrant',
      async (client, data: { qx: number; qy: number; name: string }) => {
        await this.world.handleNameQuadrant(client, data);
      },
    );
    this.onMessage('getKnownQuadrants', async (client) => {
      await this.world.handleGetKnownQuadrants(client);
    });
    this.onMessage('getKnownJumpGates', async (client) => {
      await this.world.handleGetKnownJumpGates(client);
    });
    this.onMessage('syncQuadrants', async (client) => {
      await this.world.handleSyncQuadrants(client);
    });

    // ── Trade Route Processing Interval ─────────────────────────────
    this.clock.setInterval(() => {
      this.world
        .processTradeRoutes()
        .catch((err) => logger.error({ err }, 'Trade routes tick error'));
    }, 60000);

    // ── Admin Bus ───────────────────────────────────────────────────
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

      if (
        event.channel === 'quadrant' &&
        event.quadrantX === this.quadrantX &&
        event.quadrantY === this.quadrantY
      ) {
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
  }

  async onJoin(client: Client, options: any, auth?: AuthPayload) {
    if (!auth) {
      throw new ServerError(401, 'Missing auth payload');
    }
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
      await this.quests.sendReputationUpdate(client, auth.userId);
      await this.quests.sendActiveQuests(client, auth.userId);

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
          this.navigation.startAutopilotTimer(
            client,
            auth,
            activeRoute.path,
            activeRoute.currentStep,
            activeRoute.useHyperjump,
            stats,
          );
        }
      } catch (err) {
        logger.error({ err }, 'Join autopilot resume error');
      }
    } catch (err) {
      logger.error({ err }, 'Join error');
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
}
