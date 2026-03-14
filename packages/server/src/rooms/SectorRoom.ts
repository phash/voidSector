import colyseus from 'colyseus';
import type { Client } from 'colyseus';
const { Room, ServerError } = colyseus;

import { SectorRoomState, PlayerSchema } from './schema/SectorState.js';
import { verifyToken, type AuthPayload } from '../auth.js';
import { generateSector } from '../engine/worldgen.js';
import { calculateCurrentAP, spendAP } from '../engine/ap.js';
import { stopMining } from '../engine/mining.js';
import { calculateBonuses } from '../engine/factionBonuses.js';
import type { FactionBonuses } from '../engine/factionBonuses.js';
import { getAcepXpSummary, getAcepEffects, type AcepPath } from '../engine/acepXpService.js';
import { recordVisit } from '../engine/npcStationEngine.js';
import { sectorToQuadrant } from '../engine/quadrantEngine.js';
import { isFrontierQuadrant } from '../engine/expansionEngine.js';
import { adminBus } from '../adminBus.js';
import type { AdminBroadcastEvent, AdminQuestEvent, AdminPlayerUpdateEvent } from '../adminBus.js';
import { commsBus } from '../commsBus.js';
import type { CommsBroadcastEvent } from '../commsBus.js';
import { civShipBus } from '../civShipBus.js';
import type { CivShipsTickEvent } from '../civShipBus.js';
import { constructionBus } from '../constructionBus.js';
import type { ConstructionCompletedEvent } from '../constructionBus.js';
import { friendsBus } from '../friendsBus.js';
import type { FriendBusEvent } from '../friendsBus.js';
import { FriendsService } from './services/FriendsService.js';
import Redis from 'ioredis';

const onlineRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
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
import { getCargoState, addToInventory, getResourceTotal, removeFromInventory } from '../engine/inventoryService.js';
import {
  getSector,
  saveSector,
  addDiscovery,
  getPlayerDiscoveries,
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
  getWissen,
  getWissenSpent,
  getTypedArtefacts,
  getActiveAutopilotRoute,
  pauseAutopilotRoute,
  updatePlayerStationRep,
  getRecentNews,
  getQuadrantDiscoveriesSince,
  addAlienReputation,
  contributeHumanityRep,
  getAllHumanityReps,
  getAllQuadrantControls,
  getActiveNpcFleets,
  recordQuadrantVisit,
  getVisitedQuadrantSet,
  getAllAlienReputations,
  getInventory,
  getInventoryItem,
  getMiningStoryIndex,
} from '../db/queries.js';
import { getQuadrant, addPlayerKnownQuadrant } from '../db/quadrantQueries.js';
import { civQueries } from '../db/civQueries.js';
import { query } from '../db/client.js';
import {
  RECONNECTION_TIMEOUT_S,
  calculateShipStats,
  calculateApRegen,
  createHyperdriveState,
  calculateCurrentCharge,
  STATION_REP_VISIT,
  COSMIC_FACTION_IDS,
  HYPERDRIVE_CHARGE_PER_GAS,
  getAcepLevel,
  FUEL_MIN_TANK,
  BASE_FUEL_CAPACITY,
  CONQUEST_POOL_MAX,
} from '@void-sector/shared';
import type {
  SectorData,
  JumpMessage,
  MineMessage,
  JettisonMessage,
  BuildMessage,
  DepositConstructionMessage,
  SendChatMessage,
  TransferMessage,
  NpcTradeMessage,
  UpgradeStructureMessage,
  PlaceOrderMessage,
  CreateSlateMessage,
  CreateCustomSlateMessage,
  ActivateSlateMessage,
  NpcBuybackMessage,
  ListSlateMessage,
  CreateFactionMessage,
  FactionActionMessage,
  GetStationNpcsMessage,
  AcceptQuestMessage,
  AbandonQuestMessage,
  CompleteScanEventMessage,
  RefuelMessage,
  SetBookmarkMessage,
  ClearBookmarkMessage,
  HyperJumpMessage,
  ShipStats,
  ChatMessage,
  QuadrantControlState,
  NpcFleetState,
  InventoryItem,
} from '@void-sector/shared';
import type { ServiceContext } from './services/ServiceContext.js';
import { NavigationService } from './services/NavigationService.js';
import { ScanService } from './services/ScanService.js';
import { CombatService } from './services/CombatService.js';
import { MiningService, updateStoryProgress } from './services/MiningService.js';
import { WreckService } from './services/WreckService.js';
import { EconomyService } from './services/EconomyService.js';
import { FactionService } from './services/FactionService.js';
import { QuestService } from './services/QuestService.js';
import { ChatService } from './services/ChatService.js';
import { ShipService } from './services/ShipService.js';
import { WorldService } from './services/WorldService.js';
import { AlienInteractionService } from './services/AlienInteractionService.js';
import type { AlienInteractMessage } from './services/AlienInteractionService.js';
import { TerritoryService } from './services/TerritoryService.js';
import { StoryQuestChainService } from './services/StoryQuestChainService.js';
import { CommunityQuestService } from './services/CommunityQuestService.js';
import { StationProductionService } from './services/StationProductionService.js';
import { RepairService } from './services/RepairService.js';
import { TechTreeService } from './services/TechTreeService.js';
import {
  rollForEncounter,
  isInteractiveEncounter,
  ALIEN_ENCOUNTER_TABLE,
} from '../engine/alienEncounterGen.js';
import { applyBranchEffects } from '../engine/storyQuestChain.js';
import { getHumanityRepTier } from '../engine/humanityRepTier.js';
import { getDirectTradeService } from '../engine/directTradeService.js';
import { logger } from '../utils/logger.js';
import { captureError } from '../utils/errorLogTransport.js';

interface SectorRoomOptions {
  quadrantX: number;
  quadrantY: number;
  sectorX: number;
  sectorY: number;
}

export class SectorRoom extends Room<SectorRoomState> {
  private clientShips = new Map<string, ShipStats>();
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
  private wreckService!: WreckService;
  private economy!: EconomyService;
  private factions!: FactionService;
  private quests!: QuestService;
  private chat!: ChatService;
  private friends!: FriendsService;
  private ships!: ShipService;
  private world!: WorldService;
  private alienInteraction!: AlienInteractionService;
  private territory!: TerritoryService;
  private storyChain!: StoryQuestChainService;
  private communityQuests!: CommunityQuestService;
  private stationProduction!: StationProductionService;
  private repair!: RepairService;
  private techTree!: TechTreeService;
  private encounterSteps = new Map<string, number>(); // playerId -> steps since last encounter

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
    return this.clientShips.get(sessionId) ?? calculateShipStats([]);
  }

  private async getPlayerBonuses(playerId: string): Promise<FactionBonuses> {
    const faction = await getPlayerFaction(playerId);
    const upgrades = faction ? await getFactionUpgrades(faction.id) : [];
    const bonuses = calculateBonuses(
      upgrades.map((u) => ({ tier: u.tier, choice: u.choice as 'A' | 'B' })),
    );

    // Blend in ACEP effects on top of faction bonuses
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM ships WHERE owner_id = $1 AND active = TRUE LIMIT 1`,
      [playerId],
    );
    if (rows.length > 0) {
      const acepXp = await getAcepXpSummary(rows[0].id);
      const fx = getAcepEffects(acepXp);
      bonuses.miningRateMultiplier *= 1 + fx.miningBonus;
      bonuses.cargoCapBonus += Math.floor(acepXp.ausbau / 10); // +1 cargo slot per 10 AUSBAU XP
      bonuses.scanRadiusBonus += fx.scanRadiusBonus;
      bonuses.combatMultiplier *= 1 + fx.combatDamageBonus;
      bonuses.extraModuleSlots = fx.extraModuleSlots;
      bonuses.ancientDetection = fx.ancientDetection;
      bonuses.helionDecoderEnabled = fx.helionDecoderEnabled;
    }

    return bonuses;
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
      // These will be wired to WorldService/QuestService/CommunityQuestService after instantiation
      checkFirstContact: null as any,
      checkQuestProgress: null as any,
      checkAndEmitDistressCalls: null as any,
      applyReputationChange: null as any,
      applyXpGain: null as any,
      contributeToCommunityQuest: null as any,
      detectAndSendPlayerGate: null as any,
      onResourceSoldAtStation: null as any,
      deductAP: async (playerId: string, cost: number): Promise<boolean> => {
        const ap = await getAPState(playerId);
        const newAP = spendAP(ap, cost);
        if (!newAP) return false;
        await saveAPState(playerId, newAP);
        return true;
      },
    };

    // Instantiate services
    this.navigation = new NavigationService(this.serviceCtx);
    this.scanning = new ScanService(this.serviceCtx);
    this.combat = new CombatService(this.serviceCtx);
    this.mining = new MiningService(this.serviceCtx);
    this.wreckService = new WreckService(this.serviceCtx);
    this.economy = new EconomyService(this.serviceCtx);
    this.factions = new FactionService(this.serviceCtx);
    this.quests = new QuestService(this.serviceCtx);
    this.chat = new ChatService(this.serviceCtx);
    this.friends = new FriendsService(this.serviceCtx);
    this.ships = new ShipService(this.serviceCtx);
    this.world = new WorldService(this.serviceCtx);
    this.repair = new RepairService(this.serviceCtx);
    this.techTree = new TechTreeService(this.serviceCtx);
    this.alienInteraction = new AlienInteractionService(this.serviceCtx);
    this.territory = new TerritoryService(this.serviceCtx);
    this.storyChain = new StoryQuestChainService();
    this.communityQuests = new CommunityQuestService();
    await this.communityQuests.seedInitialIfEmpty().catch(() => {});
    this.stationProduction = new StationProductionService(this.serviceCtx);
    this.stationProduction.registerHandlers(this);

    // Wire cross-service callbacks
    this.serviceCtx.checkQuestProgress = this.quests.checkQuestProgress.bind(this.quests);
    this.serviceCtx.onResourceSoldAtStation = this.quests.onResourceSoldAtStation.bind(this.quests);
    this.serviceCtx.applyReputationChange = this.quests.applyReputationChange.bind(this.quests);
    this.serviceCtx.applyXpGain = this.quests.applyXpGain.bind(this.quests);
    this.serviceCtx.checkFirstContact = this.world.checkFirstContact.bind(this.world);
    this.serviceCtx.checkAndEmitDistressCalls = this.world.checkAndEmitDistressCalls.bind(
      this.world,
    );
    this.serviceCtx.contributeToCommunityQuest = this.communityQuests.contribute.bind(
      this.communityQuests,
    );
    this.serviceCtx.detectAndSendPlayerGate = this.navigation.detectAndSendPlayerGate.bind(
      this.navigation,
    );

    // ── Navigation ──────────────────────────────────────────────────
    this.onMessage('moveSector', async (client, data: { sectorX: number; sectorY: number }) => {
      try {
        await this.navigation.handleMoveSector(client, data);
        // #144: trigger pirate encounters on sector entry
        const sectorData = this.playerSectorData.get(client.sessionId);
        if (sectorData) {
          await this.scanning.checkAndEmitScanEvents(
            client,
            [{ x: data.sectorX, y: data.sectorY, environment: sectorData.environment }],
            true,
          );
        }

        // Story trigger + spontaneous encounter
        const moveSectorAuth = client.auth as { userId: string; username?: string } | null;
        if (moveSectorAuth?.userId) {
          const storyTrigger = await this.storyChain
            .checkTrigger(
              moveSectorAuth.userId,
              this.serviceCtx.quadrantX,
              this.serviceCtx.quadrantY,
            )
            .catch(() => null);
          if (storyTrigger) client.send('storyEvent', storyTrigger);

          const steps = (this.encounterSteps.get(moveSectorAuth.userId) ?? 0) + 1;
          this.encounterSteps.set(moveSectorAuth.userId, steps);
          const encounter = await rollForEncounter(
            moveSectorAuth.userId,
            data.sectorX,
            data.sectorY,
            this.serviceCtx.quadrantX,
            this.serviceCtx.quadrantY,
            steps,
          );
          if (encounter) {
            this.encounterSteps.set(moveSectorAuth.userId, 0);
            client.send('alienEncounterEvent', encounter);
          }
        }
      } catch (err) {
        logger.error({ err }, 'moveSector error');
        captureError(err as Error, 'moveSector').catch(() => {});
        client.send('error', { code: 'MOVE_FAILED', message: 'Failed to move sector' });
      }
    });
    this.onMessage('jump', async (client, data: JumpMessage) => {
      try {
        await this.navigation.handleJump(client, data);
        // #144: trigger pirate encounters on sector entry (same as moveSector)
        const sectorData = this.playerSectorData.get(client.sessionId);
        if (sectorData) {
          await this.scanning.checkAndEmitScanEvents(
            client,
            [{ x: data.targetX, y: data.targetY, environment: sectorData.environment }],
            true,
          );
        }
      } catch (err) {
        logger.error({ err }, 'Jump unhandled error');
        captureError(err as Error, 'handleJump').catch(() => {});
        client.send('jumpResult', { success: false, error: 'Server error' });
      }
    });
    this.onMessage('hyperJump', async (client, data: HyperJumpMessage) => {
      await this.navigation.handleHyperJump(client, data);
    });
    this.onMessage('chargeHyperdrive', async (client) => {
      const auth = client.auth as AuthPayload;
      const gasAmount = await getInventoryItem(auth.userId, 'resource', 'gas');
      if (gasAmount < 1) {
        client.send('error', { code: 'NO_GAS', message: 'Kein Gas im Cargo.' });
        return;
      }
      const hdState = await getHyperdriveState(auth.userId);
      if (!hdState || hdState.maxCharge <= 0) {
        client.send('error', { code: 'NO_HYPERDRIVE', message: 'Kein Hyperdrive installiert.' });
        return;
      }
      const currentCharge = calculateCurrentCharge(hdState);
      if (currentCharge >= hdState.maxCharge) {
        client.send('error', { code: 'CHARGE_FULL', message: 'Hyperdrive bereits voll.' });
        return;
      }
      await removeFromInventory(auth.userId, 'resource', 'gas', 1);
      const newCharge = Math.min(hdState.maxCharge, currentCharge + HYPERDRIVE_CHARGE_PER_GAS);
      const newState = { ...hdState, charge: newCharge, lastTick: Date.now() };
      await setHyperdriveState(auth.userId, newState);
      client.send('hyperdriveUpdate', newState);
      const cargo = await getCargoState(auth.userId);
      client.send('cargoUpdate', cargo);
    });
    this.onMessage('cancelAutopilot', async (client) => {
      await this.navigation.handleCancelAutopilot(client);
    });
    this.onMessage('startAutopilot', async (client, data) => {
      await this.navigation.handleStartAutopilot(client, data);
    });
    this.onMessage('startSlowFlight', async (client, data: { targetX: number; targetY: number }) => {
      await this.navigation.handleSlowFlight(client, data);
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
        captureError(err as Error, 'handleLocalScan').catch(() => {});
        client.send('localScanResult', { error: 'Server error' });
      }
    });
    this.onMessage('areaScan', async (client) => {
      try {
        await this.scanning.handleAreaScan(client);
      } catch (err) {
        logger.error({ err }, 'areaScan unhandled error');
        captureError(err as Error, 'handleAreaScan').catch(() => {});
        client.send('scanResult', { sectors: [], error: 'Server error' });
      }
    });
    this.onMessage('scan', async (client) => {
      try {
        await this.scanning.handleAreaScan(client);
      } catch (err) {
        logger.error({ err }, 'scan unhandled error');
        captureError(err as Error, 'handleAreaScan').catch(() => {});
        client.send('scanResult', { sectors: [], error: 'Server error' });
      }
    });
    this.onMessage('completeScanEvent', (client, data: CompleteScanEventMessage) => {
      this.scanning.handleCompleteScanEvent(client, data).catch((err) =>
        logger.error({ err }, 'completeScanEvent error'),
      );
    });
    this.onMessage('salvageWreck', (client, data: { wreckId: string }) => {
      this.scanning.handleSalvageWreck(client, data).catch((err) =>
        logger.error({ err }, 'salvageWreck error'),
      );
    });

    this.onMessage('investigateWreck', (client, data) => {
      this.wreckService.handleInvestigate(client, data).catch((err) =>
        logger.error({ err }, 'investigateWreck error'),
      );
    });

    this.onMessage('startSalvage', (client, data) => {
      this.wreckService.handleStartSalvage(client, data).catch((err) =>
        logger.error({ err }, 'startSalvage error'),
      );
    });

    this.onMessage('cancelSalvage', (client) => {
      this.wreckService.handleCancelSalvage(client).catch((err) =>
        logger.error({ err }, 'cancelSalvage error'),
      );
    });
    this.onMessage('consumeWreckSlate', (client, data) => {
      this.wreckService.handleConsumeSlate(client, data).catch((err) =>
        logger.error({ err }, 'consumeWreckSlate error'),
      );
    });
    this.onMessage('feedSlateToGate', (client, data) => {
      this.wreckService.handleFeedSlateToGate(client, data).catch((err) =>
        logger.error({ err }, 'feedSlateToGate error'),
      );
    });

    // ── Combat ──────────────────────────────────────────────────────
    this.onMessage('ejectPod', async (client, data: { sectorX: number; sectorY: number }) => {
      await this.combat.handleEjectPod(client, data);
    });
    this.onMessage('installDefense', async (client, data: { defenseType: string }) => {
      await this.combat.handleInstallDefense(client, data);
    });
    this.onMessage('repairStation', async (client, data: { sectorX: number; sectorY: number }) => {
      await this.combat.handleRepairStation(client, data);
    });
    // Kampfsystem v1 — energy-based round combat
    this.onMessage('combatInit', async (client, data) => {
      await this.combat.handleCombatInit(client, data);
    });
    this.onMessage('combatRound', async (client, data) => {
      await this.combat.handleCombatRound(client, data);
    });
    this.onMessage('repairModule', async (client, data: { moduleId: string }) => {
      await this.repair.handleRepairModule(client, data);
    });
    this.onMessage('stationRepair', async (client, data) => {
      await this.repair.handleStationRepair(client, data);
    });

    // ── Mining ──────────────────────────────────────────────────────
    this.onMessage('mine', async (client, data: MineMessage) => {
      await this.mining.handleMine(client, data);
    });
    this.onMessage('stopMine', async (client) => {
      await this.mining.handleStopMine(client);
    });
    this.onMessage('toggleMineAll', async (client, data: { mineAll: boolean }) => {
      await this.mining.handleToggleMineAll(client, data);
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
      async (
        client,
        data: { itemType: string; itemId: string; amount: number; pricePerUnit: number },
      ) => {
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
    this.onMessage('setRecruiting', (client, data) =>
      this.factions.handleSetRecruiting(client, data),
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
    this.onMessage('trackQuest', async (client, data: { questId: string; tracked: boolean }) => {
      await this.quests.handleTrackQuest(client, data);
    });
    this.onMessage('getTrackedQuests', async (client) => {
      await this.quests.handleGetTrackedQuests(client);
    });
    this.onMessage(
      'deliverQuestResources',
      async (client, data: { questId: string; sectorX: number; sectorY: number }) => {
        await this.quests.handleDeliverQuestResources(client, data);
      },
    );

    // ── Alien Interactions ──────────────────────────────────────────
    this.onMessage('alienInteract', async (client, data: AlienInteractMessage) => {
      await this.alienInteraction.handleAlienInteract(client, data);
    });

    // ── Territory ───────────────────────────────────────────────────
    this.onMessage('claimTerritory', async (client) => {
      await this.territory.handleClaimTerritory(client);
    });
    this.onMessage(
      'getTerritory',
      async (client, data: { quadrantX?: number; quadrantY?: number }) => {
        await this.territory.handleGetTerritory(client, data);
      },
    );
    this.onMessage('listMyTerritories', async (client) => {
      await this.territory.handleListMyTerritories(client);
    });
    this.onMessage('defendTerritory', async (client) => {
      await this.territory.handleDefendTerritory(client);
    });
    this.onMessage('getAllTerritories', async (client) => {
      await this.territory.handleGetAllTerritories(client);
    });

    // ── News ────────────────────────────────────────────────────────
    this.onMessage('getNews', async (client) => {
      const [recentNews, discoveries30m] = await Promise.all([
        getRecentNews(30),
        getQuadrantDiscoveriesSince(30),
      ]);
      client.send('newsResult', { recentNews, discoveries30m });
    });

    // ── Chat ────────────────────────────────────────────────────────
    this.onMessage('chat', async (client, data: SendChatMessage) => {
      await this.chat.handleChat(client, data);
    });

    // ── Ship / Research ─────────────────────────────────────────────
    this.onMessage('getShips', async (client) => {
      await this.ships.handleGetShips(client);
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
    this.onMessage('renameShip', async (client, data: { shipId: string; name: string }) => {
      await this.ships.handleRenameShip(client, data);
    });
    this.onMessage('renameBase', async (client, data: { name: string }) => {
      await this.ships.handleRenameBase(client, data);
    });
    this.onMessage('getModuleInventory', async (client) => {
      await this.ships.handleGetModuleInventory(client);
    });
    this.onMessage('getInventory', async (client) => {
      const auth = client.auth as AuthPayload;
      const items = await getInventory(auth.userId);
      client.send('inventoryState', { items });
    });
    this.onMessage('activateBlueprint', (client, data) =>
      this.ships.handleActivateBlueprint(client, data),
    );
    this.onMessage('craftModule', (client, data) => this.ships.handleCraftModule(client, data));
    this.onMessage('createBlueprintCopy', (client, data) =>
      this.ships.handleCreateBlueprintCopy(client, data),
    );
    this.onMessage('acepBoost', (client, data: { path: AcepPath }) =>
      this.ships.handleAcepBoost(client, data),
    );

    // ── Tech Tree ───────────────────────────────────────────────────
    this.onMessage('getTechTree', (client) => this.techTree.handleGetTechTree(client));
    this.onMessage('researchTechNode', (client, data) => this.techTree.handleResearchNode(client, data));
    this.onMessage('resetTechTree', (client) => this.techTree.handleResetTree(client));

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
    this.onMessage('depositConstruction', async (client, data: DepositConstructionMessage) => {
      await this.world.handleDepositConstruction(client, data);
    });
    this.onMessage('createSlate', async (client, data: CreateSlateMessage) => {
      await this.world.handleCreateSlate(client, data);
    });
    this.onMessage('createSlateFromScan', async (client) => {
      await this.world.handleCreateSlateFromScan(client);
    });
    this.onMessage('createCustomSlate', async (client, data: CreateCustomSlateMessage) => {
      await this.world.handleCreateCustomSlate(client, data);
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
    this.onMessage(
      'upgradeJumpgate',
      async (client, data: { gateId: string; upgradeType: string }) => {
        await this.world.handleUpgradeJumpgate(client, data);
      },
    );
    this.onMessage('dismantleJumpgate', async (client, data: { gateId: string }) => {
      await this.world.handleDismantleJumpgate(client, data);
    });
    this.onMessage('setJumpgateToll', async (client, data: { gateId: string; toll: number }) => {
      await this.world.handleSetJumpgateToll(client, data);
    });
    this.onMessage('linkJumpgate', async (client, data: { slateId: string }) => {
      await this.world.handleLinkJumpgate(client, data);
    });
    this.onMessage(
      'unlinkJumpgate',
      async (client, data: { gateId: string; linkedGateId: string }) => {
        await this.world.handleUnlinkJumpgate(client, data);
      },
    );
    this.onMessage(
      'usePlayerGate',
      async (client, data: { gateId: string; destinationGateId: string }) => {
        await this.navigation.handleUsePlayerGate(client, data);
      },
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

    // ── Story / Community Quests / Alien Encounters ─────────────────
    this.onMessage(
      'storyChoice',
      async (client, data: { chapterId: number; branchChoice: string | null }) => {
        const auth = client.auth as { userId: string } | null;
        if (!auth?.userId) return;
        const chapterCompleted = await this.storyChain
          .completeChapter(auth.userId, data.chapterId, data.branchChoice ?? null)
          .catch(() => false);
        // Story Branch Effekte auch auf Menschheits-Rep anwenden (÷3 skaliert)
        // Only runs when completeChapter actually executed (not a duplicate submission)
        if (chapterCompleted && data.branchChoice) {
          const branchEffects = applyBranchEffects(data.chapterId, data.branchChoice);
          for (const [factionId, delta] of Object.entries(branchEffects)) {
            const humanityDelta = Math.round((delta as number) / 3);
            if (humanityDelta !== 0) {
              await contributeHumanityRep(factionId, humanityDelta).catch(() => {});
            }
          }
        }
        client.send('storyChoiceResult', { success: true, chapterId: data.chapterId });
      },
    );

    this.onMessage('getStoryProgress', async (client) => {
      const auth = client.auth as { userId: string } | null;
      if (!auth?.userId) return;
      const progress = await this.storyChain.getProgress(auth.userId).catch(() => null);
      if (progress) client.send('storyProgress', progress);
    });

    this.onMessage('getActiveCommunityQuest', async (client) => {
      const quest = await this.communityQuests.getActivePayload().catch(() => null);
      client.send('activeCommunityQuest', { quest });
    });

    this.onMessage('contributeToQuest', async (client, data: { amount: number }) => {
      const auth = client.auth as { userId: string } | null;
      if (!auth?.userId) return;
      const amount = Math.max(1, Math.min(data.amount ?? 1, 100)); // cap at 100 per contribution
      await this.communityQuests.contribute(auth.userId, amount).catch(() => {});
      const quest = await this.communityQuests.getActivePayload().catch(() => null);
      client.send('activeCommunityQuest', { quest });
    });

    this.onMessage(
      'resolveAlienEncounter',
      async (client, data: { factionId: string; eventType: string; accepted: boolean }) => {
        const auth = client.auth as { userId: string } | null;
        if (!auth?.userId) return;

        // Look up encounter from server-side table — never trust client-supplied rep values
        const entry = ALIEN_ENCOUNTER_TABLE.find(
          (e) => e.factionId === data.factionId && e.eventType === data.eventType,
        );
        if (!entry) return; // Unknown encounter — ignore

        const delta = data.accepted ? entry.repOnAccept : entry.repOnDecline;
        if (delta !== 0) {
          await addAlienReputation(auth.userId, data.factionId, delta).catch(() => {});
        }
        if (isInteractiveEncounter(data.factionId)) {
          const humanityDelta = data.accepted ? 3 : -2;
          await contributeHumanityRep(data.factionId, humanityDelta).catch(() => {});
        }
        client.send('alienEncounterResolved', { factionId: data.factionId, repDelta: delta });
      },
    );

    this.onMessage('getHumanityReps', async (client) => {
      const rawReps = await getAllHumanityReps();
      const repsWithTiers: Record<string, { repValue: number; tier: string }> = {};
      for (const [factionId, repValue] of Object.entries(rawReps)) {
        repsWithTiers[factionId] = { repValue, tier: getHumanityRepTier(repValue) };
      }
      client.send('humanityReps', repsWithTiers);
    });

    // ── Direct Trade ─────────────────────────────────────────────────
    this.onMessage('tradeRequest', (client, data: { targetPlayerId: string }) => {
      const auth = client.auth as AuthPayload;
      getDirectTradeService()
        .initiateTrade(auth.userId, data.targetPlayerId)
        .then((tradeId) => {
          client.send('tradeStarted', { tradeId });
          // Notify target if in same room
          this.clients.forEach((c) => {
            if ((c.auth as AuthPayload)?.userId === data.targetPlayerId) {
              c.send('tradeInvite', { tradeId, fromPlayerId: auth.userId });
            }
          });
        })
        .catch((err) => {
          logger.error({ err }, 'tradeRequest error');
          captureError(err as Error, 'initiateTrade').catch(() => {});
          client.send('error', { code: 'TRADE_FAILED', message: 'Failed to start trade' });
        });
    });
    this.onMessage(
      'tradeOffer',
      (client, data: { tradeId: string; items: InventoryItem[]; credits: number }) => {
        const auth = client.auth as AuthPayload;
        getDirectTradeService()
          .updateOffer(data.tradeId, auth.userId, data.items, data.credits)
          .then(() => {
            client.send('tradeOfferUpdated', { tradeId: data.tradeId });
          })
          .catch((err) => {
            client.send('error', { code: 'TRADE_ERROR', message: err.message });
          });
      },
    );
    this.onMessage('tradeConfirm', (client, data: { tradeId: string }) => {
      const auth = client.auth as AuthPayload;
      getDirectTradeService()
        .getSession(data.tradeId)
        .then(async (session) => {
          const bothConfirmed = await getDirectTradeService().confirm(data.tradeId, auth.userId);
          if (bothConfirmed) {
            await getDirectTradeService().executeTrade(data.tradeId);
            client.send('tradeComplete', { tradeId: data.tradeId });
            // Notify the other player too
            const otherPlayerId =
              session?.fromPlayerId === auth.userId ? session?.toPlayerId : session?.fromPlayerId;
            if (otherPlayerId) {
              this.clients.forEach((c) => {
                if ((c.auth as AuthPayload)?.userId === otherPlayerId) {
                  c.send('tradeComplete', { tradeId: data.tradeId });
                }
              });
            }
          }
        })
        .catch((err) => {
          logger.error({ err }, 'tradeConfirm error');
          captureError(err as Error, 'confirmTrade').catch(() => {});
          client.send('error', {
            code: 'TRADE_CONFIRM_FAILED',
            message: 'Failed to confirm trade',
          });
        });
    });
    this.onMessage('tradeCancel', (client, data: { tradeId: string }) => {
      getDirectTradeService()
        .cancelTrade(data.tradeId)
        .then(() => {
          client.send('tradeCancelled', { tradeId: data.tradeId });
        })
        .catch((err) => {
          logger.error({ err }, 'tradeCancel error');
          captureError(err as Error, 'cancelTrade').catch(() => {});
        });
    });

    // ── Conquest Pool Deposit ────────────────────────────────────────
    this.onMessage('STATION_DEPOSIT_CONQUEST', async (client, msg: { stationId: number; amount: number }) => {
      const amount = Math.max(0, Math.floor(Number(msg.amount) || 0));
      if (amount <= 0) return;

      const station = await civQueries.getStationById(msg.stationId);
      if (!station || station.mode === 'factory') {
        client.send('actionError', { code: 'CONQUEST_NOT_ACTIVE', message: 'Station nicht im Conquest-Modus.' });
        return;
      }

      const remaining = CONQUEST_POOL_MAX - station.conquest_pool;
      const actual = Math.min(amount, remaining);
      if (actual <= 0) {
        client.send('actionError', { code: 'CONQUEST_POOL_FULL', message: 'Conquest-Pool bereits voll.' });
        return;
      }

      const newPool = await civQueries.depositConquestPool(msg.stationId, actual, CONQUEST_POOL_MAX);
      client.send('CONQUEST_POOL_UPDATED', { stationId: msg.stationId, newPool, newMode: station.mode });
      const auth = client.auth as AuthPayload;
      logger.info({ playerId: auth.userId, stationId: msg.stationId, deposited: actual, newPool }, 'conquest pool deposit');
    });

    // ── Friends System ────────────────────────────────────────────
    this.onMessage('sendFriendRequest', async (client, data: { targetPlayerId: string }) => {
      await this.friends.sendRequest(client, data.targetPlayerId);
    });
    this.onMessage('acceptFriendRequest', async (client, data: { requestId: string }) => {
      await this.friends.acceptRequest(client, data.requestId);
    });
    this.onMessage('declineFriendRequest', async (client, data: { requestId: string }) => {
      await this.friends.declineRequest(client, data.requestId);
    });
    this.onMessage('removeFriend', async (client, data: { friendId: string }) => {
      await this.friends.removeFriend(client, data.friendId);
    });
    this.onMessage('blockPlayer', async (client, data: { targetPlayerId: string }) => {
      await this.friends.blockPlayer(client, data.targetPlayerId);
    });
    this.onMessage('unblockPlayer', async (client, data: { targetPlayerId: string }) => {
      await this.friends.unblockPlayer(client, data.targetPlayerId);
    });
    this.onMessage('getPlayerCard', async (client, data: { playerId: string }) => {
      await this.friends.getPlayerCard(client, data.playerId);
    });

    // ── Trade Route Processing Interval ─────────────────────────────
    this.clock.setInterval(() => {
      this.world
        .processTradeRoutes()
        .catch((err) => {
          logger.error({ err }, 'Trade routes tick error');
          captureError(err as Error, 'processTradeRoutes').catch(() => {});
        });
    }, 60000);

    // ── Community Quest Rotation — every hour ────────────────────────
    this.clock.setInterval(
      async () => {
        await this.communityQuests.checkAndAdvanceRotation().catch(() => {});
      },
      60 * 60 * 1000,
    );

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
    const onPlayerUpdate = (event: AdminPlayerUpdateEvent) => {
      for (const client of this.clients) {
        const auth = client.auth as AuthPayload;
        if (auth.userId === event.playerId) {
          if (event.updates.credits !== undefined) {
            client.send('creditsUpdate', { credits: event.updates.credits });
          }
          if (event.updates.cargo !== undefined) {
            // Send full cargo refresh after admin edit
            getCargoState(event.playerId)
              .then((cargo) => client.send('cargoUpdate', cargo))
              .catch(() => {});
          }
          if (event.updates.positionX !== undefined && event.updates.positionY !== undefined) {
            client.send('adminTeleport', {
              x: event.updates.positionX,
              y: event.updates.positionY,
            });
          }
        }
      }
    };
    adminBus.on('adminBroadcast', onBroadcast);
    adminBus.on('adminQuestCreated', onQuestCreated);
    adminBus.on('adminPlayerUpdate', onPlayerUpdate);

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
    // CivShips — broadcast visible NPC ships to clients in this quadrant
    const onCivShipsTick = (event: CivShipsTickEvent) => {
      if (event.qx !== this.quadrantX || event.qy !== this.quadrantY) return;
      this.broadcast('civ_ships_tick', event.ships);
    };
    civShipBus.on('civShipsTick', onCivShipsTick);

    // Construction completions — broadcast to clients when a site in this quadrant finishes
    const onConstructionCompleted = (event: ConstructionCompletedEvent) => {
      const { qx, qy } = sectorToQuadrant(event.sectorX, event.sectorY);
      if (qx !== this.quadrantX || qy !== this.quadrantY) return;
      this.broadcast('constructionSiteCompleted', { siteId: event.siteId });
      this.broadcast('structureBuilt', { sectorX: event.sectorX, sectorY: event.sectorY });
    };
    constructionBus.on('completed', onConstructionCompleted);

    commsBus.on('commsBroadcast', onCommsBroadcast);

    // Friends bus — relay friend events to target clients in this room
    const onFriendEvent = (event: FriendBusEvent) => {
      const client = this.clients.find(c => (c.auth as AuthPayload).userId === event.targetPlayerId);
      if (client) client.send(event.type, event.payload);
    };
    friendsBus.on('friendEvent', onFriendEvent);

    this.disposeCallbacks.push(() => {
      adminBus.off('adminBroadcast', onBroadcast);
      adminBus.off('adminQuestCreated', onQuestCreated);
      adminBus.off('adminPlayerUpdate', onPlayerUpdate);
      commsBus.off('commsBroadcast', onCommsBroadcast);
      civShipBus.off('civShipsTick', onCivShipsTick);
      constructionBus.off('completed', onConstructionCompleted);
      friendsBus.off('friendEvent', onFriendEvent);
    });
  }

  async onJoin(client: Client, options: any, auth?: AuthPayload) {
    if (!auth) {
      throw new ServerError(401, 'Missing auth payload');
    }
    try {
      // Track player as online in Redis
      await onlineRedis.sadd('online_players', auth.userId);

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
      const allPlayers = Array.from(this.state.players.entries()).map(([sid, p]) => ({
        sid,
        username: p.username,
        x: p.x,
        y: p.y,
      }));
      logger.info(
        {
          username: auth.username,
          sectorX,
          sectorY,
          playerCount: this.state.playerCount,
          roomId: this.roomId,
          allPlayers,
        },
        'Player joined room',
      );

      // Load or generate sector for this player
      let sectorData = await getSector(sectorX, sectorY);
      if (!sectorData) {
        {
          const { qx, qy } = sectorToQuadrant(sectorX, sectorY);
          const _controls = await getAllQuadrantControls();
          sectorData = generateSector(sectorX, sectorY, auth.userId, isFrontierQuadrant(qx, qy, _controls));
        }
        await saveSector(sectorData);
      }
      this.playerSectorData.set(client.sessionId, sectorData);

      // Send sector data to client
      client.send('sectorData', sectorData);

      // Send existing construction site at this sector (if any)
      await this.world.sendConstructionSiteOnJoin(client, sectorX, sectorY);

      // Send quadrant info (name + coords)
      const quadrantData = await getQuadrant(this.quadrantX, this.quadrantY);
      client.send('quadrantInfo', {
        qx: this.quadrantX,
        qy: this.quadrantY,
        name: quadrantData?.name ?? null,
      });

      // Record quadrant visit for Fog-of-War
      await recordQuadrantVisit(auth.userId, this.quadrantX, this.quadrantY);
      // Ensure starting quadrant is in player's known quadrant list
      await addPlayerKnownQuadrant(auth.userId, this.quadrantX, this.quadrantY);

      // Save position
      await savePlayerPosition(auth.userId, sectorX, sectorY);

      // Load active ship (or create default scout on first login)
      let shipRecord = await getActiveShip(auth.userId);
      if (!shipRecord) {
        shipRecord = await createShip(auth.userId, 'AEGIS', BASE_FUEL_CAPACITY);
      }
      const stats = calculateShipStats(shipRecord.modules);
      this.clientShips.set(client.sessionId, stats);

      // Send ship data to client
      const fuelState = await getFuelState(auth.userId);
      const acepXp = await getAcepXpSummary(shipRecord.id);
      // Init fuel state in Redis; migrate stale pre-overhaul values (< FUEL_MIN_TANK)
      const stale = fuelState !== null && fuelState < FUEL_MIN_TANK;
      if (fuelState === null || stale) {
        await saveFuelState(auth.userId, stats.fuelMax);
      }
      const fuelCurrent = fuelState === null || stale ? stats.fuelMax : fuelState;

      client.send('shipData', {
        id: shipRecord.id,
        ownerId: auth.userId,
        name: shipRecord.name,
        modules: shipRecord.modules,
        stats,
        fuel: fuelCurrent,
        active: true,
        acepXp,
      });
      client.send('fuelUpdate', { current: fuelCurrent, max: stats.fuelMax });

      // Send mining story progress
      const storyIndex = await getMiningStoryIndex(auth.userId);
      client.send('miningStoryUpdate', { storyIndex });

      // Record discovery
      await addDiscovery(auth.userId, sectorX, sectorY);

      // Send initial AP state — recalculate regenPerSecond from current modules
      const ap = await getAPState(auth.userId);
      const regenFromModules = calculateApRegen(shipRecord.modules);
      const updated = calculateCurrentAP({ ...ap, regenPerSecond: regenFromModules });
      await saveAPState(auth.userId, updated);
      client.send('apUpdate', updated);

      // Send initial cargo
      const cargo = await getCargoState(auth.userId);
      client.send('cargoUpdate', cargo);

      // Send initial slates
      await this.world.handleGetMySlates(client);

      // Send unified inventory state
      const inventoryItems = await getInventory(auth.userId);
      client.send('inventoryState', { items: inventoryItems });

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
      await this.quests.handleGetTrackedQuests(client);
      // Send recruiting factions to new client
      await this.factions.sendRecruitingFactions(client);

      // Send research state
      const researchData = await getPlayerResearch(auth.userId);
      const activeResearch = await getActiveResearch(auth.userId, 1);
      const activeResearch2 = await getActiveResearch(auth.userId, 2);
      const wissen = await getWissen(auth.userId);
      const wissenSpent = await getWissenSpent(auth.userId);
      const typedArtefacts = await getTypedArtefacts(auth.userId);
      const labTier = getAcepLevel(acepXp.ausbau);
      client.send('researchState', {
        unlockedModules: researchData.unlockedModules,
        blueprints: researchData.blueprints,
        activeResearch,
        activeResearch2,
        wissen,
        wissenSpent,
        wissenRate: 0,
        typedArtefacts,
        labTier,
      });

      // Send friends data
      const [friendsList, pendingRequests, blockedPlayers] = await Promise.all([
        this.friends.getFriendsListWithOnline(auth.userId),
        this.friends.getPendingRequestsList(auth.userId),
        this.friends.getBlockedList(auth.userId),
      ]);
      client.send('friendsList', friendsList);
      client.send('pendingRequests', pendingRequests);
      client.send('blockedPlayers', blockedPlayers);

      // Record NPC station visit for XP and per-station reputation
      if (sectorData.type === 'station') {
        recordVisit(sectorX, sectorY).catch(() => {});
        updatePlayerStationRep(auth.userId, sectorX, sectorY, STATION_REP_VISIT).catch(() => {});

        // Auto-refuel at station
        await this.navigation.tryAutoRefuel(client, auth, stats);
      }

      // Detect jumpgate in sector (also works for D-pad arrivals via cross-quadrant join)
      await this.navigation.detectAndSendJumpGate(client, auth, sectorX, sectorY);

      // Detect player-built jumpgate in sector
      await this.navigation.detectAndSendPlayerGate(client, sectorX, sectorY);

      // Send initial hyperdrive state
      if (stats.hyperdriveRange > 0) {
        let hdState = await getHyperdriveState(auth.userId);
        if (!hdState) {
          hdState = createHyperdriveState(stats);
          await setHyperdriveState(auth.userId, hdState);
        } else if (hdState.maxCharge !== stats.hyperdriveRange) {
          // Balance update: rescale charge proportionally to new maxCharge
          const ratio = hdState.maxCharge > 0 ? hdState.charge / hdState.maxCharge : 1;
          hdState = {
            ...hdState,
            charge: Math.round(stats.hyperdriveRange * ratio),
            maxCharge: stats.hyperdriveRange,
            regenPerSecond: stats.hyperdriveRegen,
          };
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
        captureError(err as Error, 'autopilotResume').catch(() => {});
      }

      // Broadcast initial expansion state (filtered by visited quadrants for Fog-of-War)
      try {
        const [controlRows, fleetRows, visitedSet, alienReps] = await Promise.all([
          getAllQuadrantControls(),
          getActiveNpcFleets(),
          getVisitedQuadrantSet(auth.userId),
          getAllAlienReputations(auth.userId),
        ]);
        const alienFactionIds = new Set<string>(COSMIC_FACTION_IDS.filter((id) => id !== 'humans'));
        const contactedAlienIds = new Set<string>(Object.keys(alienReps));
        const controls: QuadrantControlState[] = controlRows
          .filter((r) => visitedSet.has(`${r.qx}:${r.qy}`))
          .map((r) => {
            let friction_state: QuadrantControlState['friction_state'] = 'peaceful_halt';
            if (r.friction_score > 80) friction_state = 'total_war';
            else if (r.friction_score > 50) friction_state = 'escalation';
            else if (r.friction_score > 20) friction_state = 'skirmish';
            // Hide alien faction info until player has made contact
            const isAlien = alienFactionIds.has(r.controlling_faction);
            const controlling_faction =
              isAlien && !contactedAlienIds.has(r.controlling_faction)
                ? 'humans'
                : r.controlling_faction;
            return {
              qx: r.qx,
              qy: r.qy,
              controlling_faction,
              faction_shares: r.faction_shares,
              friction_score: r.friction_score,
              friction_state,
              attack_value: r.attack_value,
              defense_value: r.defense_value,
              station_tier: r.station_tier,
            };
          });
        const fleets: NpcFleetState[] = fleetRows.map((r) => ({
          id: r.id,
          faction: r.faction,
          fleet_type: r.fleet_type as NpcFleetState['fleet_type'],
          from_qx: r.from_qx,
          from_qy: r.from_qy,
          to_qx: r.to_qx,
          to_qy: r.to_qy,
          eta: new Date(r.eta).getTime(),
        }));
        client.send('quadrantControls', controls);
        client.send('npcFleets', fleets);
        client.send(
          'visitedQuadrants',
          Array.from(visitedSet).map((key) => {
            const [qx, qy] = key.split(':').map(Number);
            return { qx, qy };
          }),
        );
      } catch (err) {
        logger.error({ err }, 'Join expansion state broadcast error');
        captureError(err as Error, 'broadcastExpansionState').catch(() => {});
      }
    } catch (err) {
      logger.error({ err }, 'Join error');
      captureError(err as Error, 'onJoin').catch(() => {});
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
        const cargoTotal = await getResourceTotal(auth.userId);
        const ship = this.getShipForClient(client.sessionId);
        const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
        const result = stopMining(mining, cargoSpace);
        if (result.mined > 0 && result.resource) {
          await addToInventory(auth.userId, 'resource', result.resource, result.mined);
          // Story progress (fire and forget — player is leaving)
          updateStoryProgress(auth.userId, result.mined).catch(() => {});
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

    // Remove from online players set (truly disconnected)
    const leaveAuthForOnline = client.auth as AuthPayload | null;
    if (leaveAuthForOnline?.userId) {
      await onlineRedis.srem('online_players', leaveAuthForOnline.userId);
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
    this.rateLimits.delete(client.sessionId);
    this.playerSectorData.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.state.playerCount = this.state.players.size;

    const leaveAuth = client.auth as { userId?: string } | null;
    if (leaveAuth?.userId) {
      this.encounterSteps.delete(leaveAuth.userId);
    }
  }

  async onDispose() {
    this.mining.clearAllTimers();
    this.wreckService.clearAllTimers();
    for (const cb of this.disposeCallbacks) {
      cb();
    }
  }
}
