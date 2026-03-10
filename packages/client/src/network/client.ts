import { Client, type Room } from 'colyseus.js';
import { useStore } from '../state/store';
import { QUADRANT_SIZE } from '@void-sector/shared';
import type {
  APState,
  SectorData,
  SectorEnvironment,
  SectorContent,
  MiningState,
  CargoState,
  SectorResources,
  ChatMessage,
  ChatChannel,
  StructureType,
  StorageInventory,
  DataSlate,
  FactionDataMessage,
  FuelState,
  JumpGateInfo,
  JumpGateMapEntry,
  UseJumpGateResultMessage,
  FrequencyMatchResultMessage,
  RescueSurvivor,
  RescueResultMessage,
  DeliverSurvivorsResultMessage,
  DistressCall,
  FactionUpgradeState,
  FactionUpgradeResultMessage,
  FactionUpgradeChoice,
  TradeRoute,
  ConfigureRouteMessage,
  ConfigureRouteResultMessage,
  CreateCustomSlateMessage,
  Bookmark,
  CombatV2State,
  CombatV2RoundResult,
  StationCombatEvent,
  AdminMessage,
  AdminQuestNotification,
  FirstContactEvent,
  HyperdriveState,
  AutoRefuelConfig,
  PlayerJumpGate,
  JumpGateDestination,
  QuadrantControlState,
  NpcFleetState,
  CivShip,
  WarTickerEvent,
  InventoryItem,
  ConstructionSiteState,
  NpcTradeResultMessage,
  AcepPath,
} from '@void-sector/shared';
import type {
  ClientShipData,
  StoryEventPayload,
  AlienEncounterEventPayload,
  StoryProgressPayload,
  CommunityQuestPayload,
  TrackedQuest,
} from '../state/gameSlice';

/** Schema-level player object from Colyseus room state. */
interface RoomPlayerSchema {
  username: string;
  x: number;
  y: number;
  connected: boolean;
  onChange(cb: () => void): void;
}

/** Players map from Colyseus room state with onAdd/onRemove callbacks. */
interface RoomPlayersMap {
  onAdd(cb: (player: RoomPlayerSchema, sessionId: string) => void): void;
  onRemove(cb: (player: RoomPlayerSchema, sessionId: string) => void): void;
}

/** Colyseus room state shape for SectorRoom. */
interface SectorRoomState {
  players: RoomPlayersMap;
}

/** Discovery data item as sent by the server, includes optional sector fields. */
interface DiscoveryItem {
  x: number;
  y: number;
  type?: string;
  seed?: number;
  discoveredAt?: number;
  environment?: string;
  contents?: string[];
  discoveredBy?: string | null;
  metadata?: Record<string, unknown>;
}

function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const loc = window.location;
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  // Always derive from window.location so LAN/tunnel access works.
  // In dev mode, Vite proxies WS upgrade requests to the game server.
  return `${protocol}//${loc.host}`;
}

function sectorToQuadrant(x: number, y: number): { qx: number; qy: number } {
  const half = Math.floor(QUADRANT_SIZE / 2);
  return { qx: Math.floor((x + half) / QUADRANT_SIZE), qy: Math.floor((y + half) / QUADRANT_SIZE) };
}

/** Check if a monitor is currently visible (desktop activeProgram or mobile activeMonitor).
 * COMMS is always visible on desktop (dedicated Section 6). */
function isMonitorVisible(monitorId: string): boolean {
  const store = useStore.getState();
  if (store.activeProgram === monitorId || store.activeMonitor === monitorId) return true;
  // COMMS is always visible in the cockpit layout (Section 6)
  if (monitorId === 'COMMS') return true;
  return false;
}

class GameNetwork {
  private client: Client | null = null;
  private sectorRoom: Room | null = null;
  private reconnecting = false;
  private intentionalLeave = false;
  private currentQuadrant: { qx: number; qy: number } | null = null;

  private ensureClient(): Client {
    if (!this.client) {
      this.client = new Client(getWsUrl());
    }
    return this.client;
  }

  async joinSector(x: number, y: number): Promise<void> {
    const store = useStore.getState();
    if (!store.token) throw new Error('Not authenticated');

    const { qx: targetQx, qy: targetQy } = sectorToQuadrant(x, y);

    // Same quadrant: send moveSector message (no room leave/join)
    if (
      this.sectorRoom &&
      this.currentQuadrant &&
      this.currentQuadrant.qx === targetQx &&
      this.currentQuadrant.qy === targetQy
    ) {
      const oldPos = store.position;
      this.sectorRoom.send('moveSector', { sectorX: x, sectorY: y });
      if (oldPos.x !== x || oldPos.y !== y) {
        store.startShipMoveAnimation(oldPos.x, oldPos.y, x, y);
      }
      store.setPosition({ x, y });
      setTimeout(() => useStore.getState().resetPan(), 600);
      store.addLogEntry(`Entered sector (${x}, ${y})`);
      return;
    }

    // Different quadrant: leave old room and join new quadrant room
    if (this.sectorRoom) {
      this.intentionalLeave = true;
      await this.sectorRoom.leave();
      this.sectorRoom = null;
      store.clearPlayers();
    }

    this.ensureClient().http.authToken = store.token;

    this.sectorRoom = await this.ensureClient().joinOrCreate('sector', {
      quadrantX: targetQx,
      quadrantY: targetQy,
      sectorX: x,
      sectorY: y,
    });

    this.currentQuadrant = { qx: targetQx, qy: targetQy };
    this.setupRoomListeners(this.sectorRoom);
    store.setPosition({ x, y });
    store.resetPan();
    store.addLogEntry(`Entered sector (${x}, ${y})`);
  }

  async loginAsGuest(): Promise<void> {
    const API_URL = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${API_URL}/api/guest`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Guest login failed');
    const store = useStore.getState();
    store.setAuth(data.token, data.player.id, data.player.username, true);
    const pos = data.lastPosition ?? { x: 0, y: 0 };
    await this.joinSector(pos.x, pos.y);
  }

  private setupRoomListeners(room: Room) {
    // State change: sync players
    (room.state as unknown as SectorRoomState).players.onAdd(
      (player: RoomPlayerSchema, sessionId: string) => {
        const store = useStore.getState();
        store.setPlayer(sessionId, {
          sessionId,
          username: player.username,
          x: player.x,
          y: player.y,
          connected: player.connected,
        });
        // Alert if another player enters our sector
        if (player.x === store.position.x && player.y === store.position.y) {
          store.addLogEntry(`KONTAKT: ${player.username} betritt Sektor`);
          if (!isMonitorVisible('NAV-COM')) {
            store.setAlert('NAV-COM', true);
          }
        }
        // Track position changes within the quadrant room
        player.onChange(() => {
          const s = useStore.getState();
          const prev = s.players[sessionId];
          s.setPlayer(sessionId, {
            sessionId,
            username: player.username,
            x: player.x,
            y: player.y,
            connected: player.connected,
          });
          // Alert if player moved INTO our sector
          const wasInSector = prev && prev.x === s.position.x && prev.y === s.position.y;
          const nowInSector = player.x === s.position.x && player.y === s.position.y;
          if (!wasInSector && nowInSector) {
            s.addLogEntry(`KONTAKT: ${player.username} betritt Sektor`);
            if (!isMonitorVisible('NAV-COM')) {
              s.setAlert('NAV-COM', true);
            }
          }
        });
      },
    );

    (room.state as unknown as SectorRoomState).players.onRemove(
      (_player: RoomPlayerSchema, sessionId: string) => {
        useStore.getState().removePlayer(sessionId);
      },
    );

    // Sector data (sent by server on join and on moveSector)
    room.onMessage('sectorData', (sector: SectorData) => {
      const store = useStore.getState();
      store.setCurrentSector(sector);
      store.addDiscoveries([sector]);
      // Clear player gate info — server will re-send if new sector has a gate
      store.setPlayerGateInfo(null);
      // Sector type help tips
      if (sector.type === 'nebula') store.showTip('first_nebula');
      else if (sector.type === 'station') store.showTip('first_station');
      else if (sector.type === 'asteroid_field') store.showTip('first_asteroid');
      // Stats: track station visits
      if (sector.type === 'station') {
        store.addToStatSet('stationsVisited', `${sector.x}:${sector.y}`);
      }
    });

    // AP updates
    room.onMessage('apUpdate', (ap: APState) => {
      useStore.getState().setAP(ap);
    });

    // Jump result
    room.onMessage(
      'jumpResult',
      (data: {
        success: boolean;
        error?: string;
        newSector?: SectorData;
        apRemaining?: number;
        fuelRemaining?: number;
        crossQuadrant?: boolean;
      }) => {
        useStore.getState().setJumpPending(false);
        if (data.fuelRemaining !== undefined) {
          const currentFuel = useStore.getState().fuel;
          if (currentFuel) {
            useStore.setState({ fuel: { ...currentFuel, current: data.fuelRemaining } });
          }
        }
        if (data.success && data.newSector) {
          const store = useStore.getState();
          const dx = data.newSector.x - store.position.x;
          const dy = data.newSector.y - store.position.y;
          store.startJumpAnimation(dx, dy);
          const newSector = data.newSector;
          const needsRoomChange = data.crossQuadrant === true;
          // Update position immediately to prevent stale coordinates on rapid clicks
          if (!needsRoomChange) {
            store.setPosition({ x: newSector.x, y: newSector.y });
          }
          setTimeout(async () => {
            useStore.getState().addDiscoveries([newSector]);
            useStore
              .getState()
              .addLogEntry(`Jumped to (${newSector.x}, ${newSector.y}) — ${newSector.type}`);
            if (needsRoomChange) {
              // Cross-quadrant: need to leave and join new quadrant room
              await this.joinSector(newSector.x, newSector.y);
            } else {
              // Same quadrant: server already moved us, update remaining state
              useStore.getState().setCurrentSector(newSector);
              useStore.getState().resetPan();
            }
            useStore.getState().clearJumpAnimation();
          }, 800);
        } else {
          useStore.getState().addLogEntry(`Jump failed: ${data.error}`);
        }
      },
    );

    // Scan result (area scan)
    room.onMessage('scanResult', (data: { sectors: SectorData[]; apRemaining: number }) => {
      const store = useStore.getState();
      // Don't clear scan animation immediately — let it finish naturally
      store.setScanPending(false);
      // Track newly revealed sectors for brightness burst animation
      const burstKeys = data.sectors
        .filter((s) => !store.discoveries[`${s.x}:${s.y}`])
        .map((s) => `${s.x}:${s.y}`);
      store.addDiscoveries(data.sectors);
      if (burstKeys.length > 0) {
        store.addScanBurstTimestamps(burstKeys, performance.now());
      }
      const currentAP = store.ap;
      if (currentAP) {
        store.setAP({ ...currentAP, current: data.apRemaining });
      }
      store.addLogEntry(`Scan complete: ${data.sectors.length} sectors revealed`);
      // Stats: count area scan
      store.incrementStat('sectorsScanned');
      // Alert LOG if interesting sectors found
      const hasInteresting = data.sectors.some(
        (s) => s.type === 'pirate' || s.type === 'anomaly' || s.type === 'station',
      );
      if (hasInteresting) {
        if (!isMonitorVisible('LOG')) {
          store.setAlert('LOG', true);
        }
      }
    });

    // Local scan result
    room.onMessage(
      'localScanResult',
      (data: {
        resources: SectorResources;
        hiddenSignatures: boolean;
        wrecks?: Array<{
          id: string;
          playerName: string;
          radarIconData: { tier: number; path: string };
          lastLogEntry: string | null;
          hasSalvage: boolean;
        }>;
      }) => {
        const store = useStore.getState();
        store.setScanPending(false);
        if (store.currentSector) {
          const updatedSector = { ...store.currentSector, resources: data.resources };
          store.setCurrentSector(updatedSector);
          store.addDiscoveries([updatedSector]);
        }
        if (data.hiddenSignatures) {
          store.addLogEntry('UNKNOWN SIGNATURES DETECTED — SCANNER UPGRADE REQUIRED');
        }
        store.addLogEntry(
          `Local scan: Ore ${data.resources.ore}, Gas ${data.resources.gas}, Crystal ${data.resources.crystal}`,
        );
        // Report wrecks detected in this sector
        if (data.wrecks && data.wrecks.length > 0) {
          for (const wreck of data.wrecks) {
            const salvageNote = wreck.hasSalvage ? ' [BERGBAR]' : '';
            store.addLogEntry(
              `WRACK ENTDECKT: ${wreck.playerName} (T${wreck.radarIconData.tier}/${wreck.radarIconData.path})${salvageNote}`,
            );
          }
        }
        // Stats: count scan
        store.incrementStat('sectorsScanned');
        // Stats: check for players in same sector
        const playersHere = Object.values(store.players).filter(
          (p) => p.x === store.position.x && p.y === store.position.y,
        );
        if (playersHere.length > 0) {
          store.incrementStat('playersEncountered');
        }
      },
    );

    // Discoveries (from scan/jump — server sends array of sector coords)
    room.onMessage('discoveries', (data: DiscoveryItem[]) => {
      const store = useStore.getState();
      const sectorData: SectorData[] = [];
      for (const d of data) {
        if (d.type) {
          sectorData.push({
            x: d.x,
            y: d.y,
            type: d.type as SectorData['type'],
            seed: d.seed ?? 0,
            resources: { ore: 0, gas: 0, crystal: 0 },
            environment: (d.environment ?? 'empty') as SectorEnvironment,
            contents: (d.contents ?? []) as SectorContent[],
            discoveredBy: d.discoveredBy ?? null,
            discoveredAt: d.discoveredAt != null ? String(d.discoveredAt) : null,
            metadata: d.metadata ?? {},
          });
        }
      }
      if (sectorData.length > 0) {
        store.addDiscoveries(sectorData);
      }
      store.addLogEntry(`Loaded ${data.length} discovered sectors`);
    });

    // Errors
    room.onMessage('error', (data: { code: string; message: string }) => {
      const store = useStore.getState();
      // Reset pending states on any error to prevent permanent UI lockout
      if (store.scanPending) store.setScanPending(false);
      if (store.jumpPending) store.setJumpPending(false);
      // Set inline error for action-specific panels
      const inlineCodes = [
        'NO_RESOURCES',
        'MINE_FAILED',
        'NOT_MINING',
        'RATE_LIMIT',
        'BUILD_FAIL',
        'INSUFFICIENT',
        'INVALID_INPUT',
      ];
      if (inlineCodes.some((c) => data.code.startsWith(c))) {
        store.setActionError(data);
      }
      if (data.code === 'GUEST_RESTRICTED') {
        store.addLogEntry(
          `GAST-EINSCHRÄNKUNG: ${data.message} — Registriere dich für vollen Zugang!`,
        );
      } else {
        store.addLogEntry(`ERROR: ${data.message}`);
      }
    });

    // Mining updates
    room.onMessage('miningUpdate', (data: MiningState) => {
      const store = useStore.getState();
      const wasMining = store.mining?.active;
      store.setMining(data);
      // Alert when mining completes (was active, now not)
      if (wasMining && !data.active) {
        if (!isMonitorVisible('MINING')) {
          store.setAlert('MINING', true);
        }
      }
    });

    // Cargo updates
    room.onMessage('cargoUpdate', (data: CargoState) => {
      useStore.getState().setCargo(data);
    });

    // Ship data (new designer format: id, ownerId, hullType, name, modules, stats, fuel, active)
    room.onMessage('shipData', (data: ClientShipData) => {
      useStore.getState().setShip(data);
    });

    // Fuel updates
    room.onMessage('fuelUpdate', (data: FuelState) => {
      useStore.getState().setFuel(data);
      if (data.current < data.max * 0.15) useStore.getState().showTip('low_fuel');
    });

    // Hyperdrive state
    room.onMessage('hyperdriveUpdate', (data: HyperdriveState) => {
      useStore.getState().setHyperdriveState(data);
    });

    // Auto-refuel config
    room.onMessage('autoRefuelConfig', (data: AutoRefuelConfig) => {
      useStore.getState().setAutoRefuelConfig(data);
    });

    // --- Ship designer messages ---

    room.onMessage('shipList', (data: { ships: any[] }) => {
      useStore.setState({ shipList: data.ships });
      // Refresh ACEP fields on active ship from latest server data
      const activeShip = data.ships.find((s: any) => s.active);
      if (activeShip) {
        const current = useStore.getState().ship;
        if (current) {
          useStore.setState({
            ship: {
              ...current,
              acepXp: activeShip.acepXp,
              acepEffects: activeShip.acepEffects,
              acepGeneration: activeShip.acepGeneration,
              acepTraits: activeShip.acepTraits,
            },
          });
        }
      }
    });

    room.onMessage('moduleInventory', (data: { modules: string[] }) => {
      useStore.setState({ moduleInventory: data.modules });
    });

    room.onMessage('moduleInstalled', (data: { modules: any[]; stats: any }) => {
      const ship = useStore.getState().ship;
      if (ship) {
        useStore.setState({
          ship: { ...ship, modules: data.modules, stats: data.stats },
        });
      }
    });

    room.onMessage(
      'moduleRemoved',
      (data: { modules: any[]; stats: any; returnedModule: string }) => {
        const ship = useStore.getState().ship;
        if (ship) {
          useStore.setState({
            ship: { ...ship, modules: data.modules, stats: data.stats },
          });
        }
        const inv = useStore.getState().moduleInventory;
        useStore.setState({ moduleInventory: [...inv, data.returnedModule] });
      },
    );

    room.onMessage('buyModuleResult', (data: { success: boolean; moduleId: string }) => {
      if (data.success) {
        useStore.getState().addLogEntry(`Module ${data.moduleId} purchased`);
      }
    });

    room.onMessage('shipRenamed', (data: { shipId: string; name: string }) => {
      const ship = useStore.getState().ship;
      if (ship && ship.id === data.shipId) {
        useStore.setState({ ship: { ...ship, name: data.name } });
      }
    });

    room.onMessage('baseRenamed', (data: { name: string }) => {
      useStore.setState({ baseName: data.name });
    });

    // Tech-Baum: Research
    room.onMessage('researchState', (data) => {
      useStore.getState().setResearch({
        unlockedModules: data.unlockedModules ?? [],
        blueprints: data.blueprints ?? [],
        activeResearch: data.activeResearch ?? null,
        activeResearch2: data.activeResearch2 ?? null,
        wissen: data.wissen ?? 0,
        wissenRate: data.wissenRate ?? 0,
      });
      if (data.typedArtefacts) {
        useStore.getState().setTypedArtefacts(data.typedArtefacts);
      }
      if (data.labTier !== undefined) {
        useStore.getState().setLabTier(data.labTier);
      }
    });

    room.onMessage('researchResult', (data) => {
      if (data.success) {
        const current = useStore.getState().research;
        const patch: any = {};
        if (data.unlockedModules !== undefined) {
          patch.research = {
            ...current,
            unlockedModules: data.unlockedModules,
            blueprints: data.blueprints ?? current.blueprints,
            activeResearch:
              data.activeResearch !== undefined ? data.activeResearch : current.activeResearch,
            activeResearch2:
              data.activeResearch2 !== undefined ? data.activeResearch2 : current.activeResearch2,
            wissen: data.wissen !== undefined ? data.wissen : current.wissen,
            wissenRate: data.wissenRate !== undefined ? data.wissenRate : current.wissenRate,
          };
        }
        if (data.activeResearch !== undefined && !patch.research) {
          patch.research = {
            ...current,
            activeResearch: data.activeResearch,
            activeResearch2:
              data.activeResearch2 !== undefined ? data.activeResearch2 : current.activeResearch2,
            wissen: data.wissen !== undefined ? data.wissen : current.wissen,
          };
          // Artefacts were deducted by server — request fresh snapshot
          this.requestResearchState();
        }
        if (data.activated) {
          patch.pendingBlueprint = null;
        }
        if (Object.keys(patch).length) useStore.setState(patch);
      }
    });

    room.onMessage('blueprintFound', (data) => {
      const current = useStore.getState().research;
      useStore.setState({
        research: {
          ...current,
          blueprints: [...current.blueprints, data.moduleId],
        },
        pendingBlueprint: data.moduleId,
      });
    });

    room.onMessage(
      'refuelResult',
      (data: { success: boolean; error?: string; fuel?: FuelState; credits?: number }) => {
        const store = useStore.getState();
        if (data.success) {
          if (data.fuel) {
            store.setFuel(data.fuel);
          }
          if (data.credits !== undefined) {
            store.setCredits(data.credits);
          }
          store.addLogEntry('Refueled successfully');
        } else {
          store.addLogEntry(`Refuel failed: ${data.error}`);
        }
      },
    );

    // Chat messages
    room.onMessage('chatMessage', (data: ChatMessage) => {
      const store = useStore.getState();
      store.addChatMessage(data);
      // Alert if COMMS is not visible in any sidebar slot or main
      if (!isMonitorVisible('COMMS')) {
        store.setAlert('COMMS', true);
      }
      // Per-channel alert if message is on a different channel than active
      if (data.channel && data.channel !== store.chatChannel) {
        store.setChannelAlert(data.channel, true);
      }
    });

    // Chat history (loaded on join)
    room.onMessage('chatHistory', (messages: ChatMessage[]) => {
      const store = useStore.getState();
      for (const msg of messages) {
        store.addChatMessage(msg);
      }
    });

    // Base data
    room.onMessage('baseData', (data: { structures: any[] }) => {
      useStore.getState().setBaseStructures(data.structures);
    });

    // Build results
    room.onMessage('buildResult', (data: { success: boolean; error?: string; structure?: any }) => {
      if (data.success) {
        useStore.getState().addLogEntry(`Built ${data.structure?.type} at current sector`);
      } else {
        useStore.getState().addLogEntry(`Build failed: ${data.error}`);
      }
    });

    // Credits update
    room.onMessage('creditsUpdate', (data: { credits: number }) => {
      useStore.getState().setCredits(data.credits);
    });

    // Alien credits update
    room.onMessage('alienCreditsUpdate', (data: { alienCredits: number }) => {
      useStore.setState({ alienCredits: data.alienCredits });
    });

    // Alien interaction result — show in log and update rep store
    room.onMessage(
      'alienInteractResult',
      (data: {
        success: boolean;
        factionId?: string;
        action?: string;
        message?: string;
        error?: string;
        repAfter?: number;
        repTier?: string;
        reputations?: Record<string, number>;
      }) => {
        const store = useStore.getState();
        if (data.message) {
          store.addLogEntry(data.message);
        } else if (!data.success && data.error) {
          store.addLogEntry(`[${data.factionId?.toUpperCase() ?? 'ALIEN'}] ${data.error}`);
        }
        if (data.reputations) {
          useStore.setState({ alienReputations: data.reputations });
        }
      },
    );

    // Storage update
    room.onMessage('storageUpdate', (data: StorageInventory) => {
      useStore.getState().setStorage(data);
    });

    // Transfer result
    room.onMessage('transferResult', (data: { success: boolean; error?: string }) => {
      const store = useStore.getState();
      if (data.success) {
        store.addLogEntry('Transfer complete');
      } else {
        store.addLogEntry(`Transfer failed: ${data.error}`);
      }
    });

    // NPC trade result
    room.onMessage('npcTradeResult', (data: NpcTradeResultMessage) => {
      const store = useStore.getState();
      if (data.success) {
        store.addLogEntry('Trade complete');
        if (data.partial) {
          store.setTradeMessage(`Nur ${data.soldAmount}x verkauft — Station ist fast voll`);
        } else {
          store.setTradeMessage(null);
        }
      } else {
        store.addLogEntry(`Trade failed: ${data.error}`);
        store.setTradeMessage(null);
      }
    });

    room.onMessage('npcStationUpdate', (data: any) => {
      useStore.getState().setNpcStationData(data);
    });

    room.onMessage('factoryUpdate', (data: any) => {
      useStore.getState().setFactoryState(data);
    });

    room.onMessage('kontorUpdate', (data: any) => {
      if (data.orders) {
        useStore.getState().setKontorOrders(data.orders);
      }
    });

    // Upgrade result
    room.onMessage(
      'upgradeResult',
      (data: { success: boolean; error?: string; newTier?: number }) => {
        const store = useStore.getState();
        if (data.success) {
          store.addLogEntry(`Upgraded to tier ${data.newTier}`);
        } else {
          store.addLogEntry(`Upgrade failed: ${data.error}`);
        }
      },
    );

    // Trade orders
    room.onMessage('tradeOrders', (data: { orders: any[] }) => {
      useStore.getState().setTradeOrders(data.orders);
    });

    room.onMessage('myOrders', (data: { orders: any[] }) => {
      useStore.getState().setMyOrders(data.orders);
    });

    room.onMessage('orderPlaced', (data: { success: boolean }) => {
      if (data.success) {
        useStore.getState().addLogEntry('Order placed');
      }
    });

    room.onMessage('cancelOrderResult', (data: { success: boolean }) => {
      if (data.success) {
        useStore.getState().addLogEntry('Order cancelled');
      }
    });

    // Data Slate handlers
    room.onMessage('mySlates', (data: { slates: DataSlate[] }) => {
      useStore.getState().setMySlates(data.slates);
    });

    room.onMessage('createSlateResult', (data: any) => {
      const store = useStore.getState();
      if (data.success) {
        store.addLogEntry('DATA SLATE ERSTELLT');
        if (data.cargo) store.setCargo(data.cargo);
        if (data.ap) store.setAP(data.ap);
        this.sectorRoom?.send('getMySlates');
      } else {
        store.addLogEntry(`SLATE FEHLER: ${data.error}`);
      }
    });

    room.onMessage('activateSlateResult', (data: any) => {
      const store = useStore.getState();
      if (data.success) {
        store.addLogEntry(`SLATE AKTIVIERT — ${data.sectorsAdded} Sektoren entdeckt`);
        this.sectorRoom?.send('getMySlates');
        this.sectorRoom?.send('getDiscoveries');
      } else {
        store.addLogEntry(`AKTIVIERUNG FEHLGESCHLAGEN: ${data.error}`);
      }
    });

    room.onMessage('npcBuybackResult', (data: any) => {
      const store = useStore.getState();
      if (data.success) {
        store.addLogEntry(`SLATE VERKAUFT — +${data.creditsEarned} CR`);
        store.setCredits(data.credits);
        this.sectorRoom?.send('getMySlates');
      } else {
        store.addLogEntry(`VERKAUF FEHLGESCHLAGEN: ${data.error}`);
      }
    });

    room.onMessage('slateOrderAccepted', (data: any) => {
      if (data.success) {
        useStore.getState().addLogEntry('SLATE GEKAUFT');
        this.sectorRoom?.send('getMySlates');
      }
    });

    // Faction handlers
    room.onMessage('factionData', (data: FactionDataMessage) => {
      const store = useStore.getState();
      store.setFaction(data.faction);
      store.setFactionMembers(data.members);
      store.setFactionInvites(data.invites);
    });

    room.onMessage('createFactionResult', (data: any) => {
      const store = useStore.getState();
      if (data.success) {
        store.addLogEntry('FRAKTION GEGRÜNDET');
      } else {
        store.addLogEntry(`FEHLER: ${data.error}`);
      }
    });

    room.onMessage('factionActionResult', (data: any) => {
      const store = useStore.getState();
      if (data.success) {
        store.addLogEntry(`FRAKTION: ${data.action.toUpperCase()} OK`);
      } else {
        store.addLogEntry(`FRAKTION FEHLER: ${data.error}`);
      }
    });

    // Phase 4: NPC Ecosystem
    room.onMessage('stationNpcsResult', (data) => {
      const store = useStore.getState();
      store.addLogEntry(
        `Station: ${data.npcs.length} NPCs, ${data.quests.length} Quests verfügbar`,
      );
      window.dispatchEvent(new CustomEvent('stationNpcsResult', { detail: data }));
    });

    room.onMessage('acceptQuestResult', (data) => {
      const store = useStore.getState();
      if (data.success && data.quest) {
        store.setActiveQuests([...store.activeQuests, data.quest]);
        store.addLogEntry(`Quest angenommen: ${data.quest.title}`);
      } else {
        store.addLogEntry(`Quest-Fehler: ${data.error}`);
      }
    });

    room.onMessage('abandonQuestResult', (data) => {
      const store = useStore.getState();
      if (!data.success) store.addLogEntry(`Fehler: ${data.error}`);
    });

    room.onMessage('activeQuests', (data) => {
      useStore.getState().setActiveQuests(data.quests);
    });

    room.onMessage('questProgress', (data) => {
      const store = useStore.getState();
      const quests = store.activeQuests.map((q) =>
        q.id === data.questId ? { ...q, objectives: data.objectives } : q,
      );
      store.setActiveQuests(quests);
      store.addLogEntry('Quest-Fortschritt aktualisiert');
      if (!isMonitorVisible('QUESTS')) store.setAlert('QUESTS', true);
    });

    room.onMessage('questComplete', (data: { id: string; title: string; rewards: any }) => {
      useStore.getState().addQuestComplete({ id: data.id, title: data.title, rewards: data.rewards });
    });

    room.onMessage('trackedQuestsUpdate', (data: { quests: TrackedQuest[] }) => {
      useStore.getState().setTrackedQuests(data.quests);
    });

    room.onMessage('trackQuestResult', (data: { success: boolean; error?: string }) => {
      if (!data.success && data.error === 'MAX_TRACKED_REACHED') {
        useStore.getState().setActionError({ code: 'MAX_TRACKED_REACHED', message: 'Maximal 5 Quests können gleichzeitig verfolgt werden.' });
      }
    });

    room.onMessage('reputationUpdate', (data) => {
      const store = useStore.getState();
      store.setReputations(data.reputations);
      store.setPlayerUpgrades(data.upgrades);
    });

    room.onMessage('battleResult', (data) => {
      const store = useStore.getState();
      const encounter = store.activeBattle;
      store.setActiveBattle(null);
      if (data.success && data.result && encounter) {
        store.setLastBattleResult({ encounter, result: data.result });
      }
    });

    room.onMessage('pirateAmbush', (data) => {
      const store = useStore.getState();
      store.setActiveBattle(data.encounter);
      store.addLogEntry(`PIRATEN-HINTERHALT bei (${data.sectorX}, ${data.sectorY})!`);
    });

    room.onMessage('ancientRuinScan', (data) => {
      const store = useStore.getState();
      store.setActiveAncientRuinScan(data);
      store.addLogEntry(`ANCIENT RUIN — ${data.fragmentText.split('\n')[0]}`);
    });

    room.onMessage('combatV2Init', (data: { state: CombatV2State }) => {
      useStore.getState().setActiveCombatV2(data.state);
    });

    room.onMessage('combatV2Result', (data: CombatV2RoundResult) => {
      const store = useStore.getState();
      if (data.state) {
        store.setActiveCombatV2(data.state.status === 'active' ? data.state : null);
      }
      if (data.finalResult) {
        const encounter = store.activeBattle ?? store.activeCombatV2?.encounter;
        if (encounter) {
          store.setLastBattleResult({ encounter, result: data.finalResult as any });
        }
        store.setActiveCombatV2(null);
        store.setActiveBattle(null);
      }
    });

    // Permadeath: ship destroyed in combat → clear combat state, show notification
    room.onMessage(
      'permadeath',
      (data: {
        wreckId: string;
        newShipId: string;
        legacyXp: { ausbau: number; intel: number; kampf: number; explorer: number };
        message: string;
      }) => {
        const store = useStore.getState();
        store.addLogEntry(data.message);
        store.setActiveCombatV2(null);
        store.setActiveBattle(null);
        // shipData for the new ship is sent by server before this message
      },
    );

    // Eject Pod: cargo lost, combat ended
    room.onMessage('ejectPodResult', (data: { success: boolean }) => {
      if (data.success) {
        useStore.getState().setActiveCombatV2(null);
      }
    });

    room.onMessage('newsResult', (data: { recentNews: any[]; discoveries30m: any[] }) => {
      useStore.getState().setNewsItems(data.recentNews ?? []);
    });

    room.onMessage(
      'territoryResult',
      (data: { success: boolean; message: string; claim?: any; combat?: any }) => {
        useStore.getState().addLogEntry(data.message);
      },
    );

    room.onMessage('myTerritories', (data: { territories: any[] }) => {
      const store = useStore.getState();
      if (data.territories.length === 0) {
        store.addLogEntry('TERRITORIUM: Keine Ansprüche registriert.');
      } else {
        store.addLogEntry(`TERRITORIUM: ${data.territories.length} Ansprüche —`);
        for (const t of data.territories) {
          store.addLogEntry(
            `  ⬡ [${t.quadrant_x}:${t.quadrant_y}] ${t.defense_rating} — ${t.victories} Siege`,
          );
        }
      }
    });

    room.onMessage('allTerritories', (data: { claims: any[] }) => {
      const map: Record<string, { playerName: string; playerId: string; defenseRating: string }> =
        {};
      for (const c of data.claims) {
        map[`${c.quadrant_x}:${c.quadrant_y}`] = {
          playerName: c.player_name,
          playerId: c.player_id,
          defenseRating: c.defense_rating,
        };
      }
      useStore.getState().setTerritoryMap(map);
    });

    room.onMessage('stationUnderAttack', (data: StationCombatEvent) => {
      useStore.getState().setStationCombatEvent(data);
      useStore
        .getState()
        .addLogEntry(`STATION UNTER ANGRIFF in (${data.sectorX}, ${data.sectorY})!`);
    });

    room.onMessage('stationDefended', (data: StationCombatEvent) => {
      useStore.getState().setStationCombatEvent(null);
      useStore.getState().addLogEntry('Station erfolgreich verteidigt!');
    });

    room.onMessage('scanEventCompleted', (data: { eventId: string }) => {
      useStore.getState().removeScanEvent(data.eventId);
    });

    room.onMessage('scanEventDiscovered', (data) => {
      const store = useStore.getState();
      store.addScanEvent(data.event);
      if (!isMonitorVisible('QUESTS')) store.setAlert('QUESTS', true);
      // Context-sensitive help tips
      const eventType = data.event?.eventType;
      if (eventType === 'distress_signal') store.showTip('first_distress');
      else if (eventType === 'pirate_ambush') store.showTip('first_pirate');
      else if (eventType === 'anomaly_reading') store.showTip('first_anomaly');
    });

    room.onMessage('logEntry', (data) => {
      useStore.getState().addLogEntry(typeof data === 'string' ? data : (data.message ?? ''));
    });

    // --- Phase 5: Deep Systems ---

    // JumpGate info (sent when entering a sector with a gate)
    room.onMessage('jumpGateInfo', (data: JumpGateInfo) => {
      useStore.getState().setJumpGateInfo(data);
    });

    room.onMessage('knownJumpGates', (data: { gates: JumpGateMapEntry[] }) => {
      useStore.getState().setKnownJumpGates(data.gates);
    });

    room.onMessage('useJumpGateResult', (data: UseJumpGateResultMessage) => {
      const store = useStore.getState();
      if (data.success) {
        store.setJumpGateInfo(null);
        if (data.fuel) store.setFuel(data.fuel);
        store.addLogEntry(`JUMPGATE — Teleportiert nach (${data.targetX}, ${data.targetY})`);
      } else if (data.requiresMinigame) {
        store.addLogEntry('JUMPGATE — Frequenz-Matching erforderlich');
      } else {
        store.addLogEntry(`JUMPGATE FEHLER: ${data.error}`);
      }
    });

    room.onMessage('frequencyMatchResult', (data: FrequencyMatchResultMessage) => {
      const store = useStore.getState();
      if (data.matched) {
        store.addLogEntry('FREQUENZ-MATCH ERFOLGREICH — Gate aktiviert');
      } else {
        store.addLogEntry('FREQUENZ-MATCH FEHLGESCHLAGEN');
      }
    });

    // Player-built jumpgate info (sent when entering a sector with a player gate)
    room.onMessage(
      'playerGateInfo',
      (data: { gate: PlayerJumpGate; destinations: JumpGateDestination[] }) => {
        useStore.getState().setPlayerGateInfo(data);
      },
    );

    // Player gate travel result
    room.onMessage(
      'playerGateResult',
      (data: {
        success: boolean;
        error?: string;
        newSector?: SectorData;
        targetX?: number;
        targetY?: number;
        credits?: number;
        hops?: number;
        tollPaid?: number;
        crossQuadrant?: boolean;
      }) => {
        const store = useStore.getState();
        if (data.success && data.newSector) {
          const dx = data.newSector.x - store.position.x;
          const dy = data.newSector.y - store.position.y;
          store.startJumpAnimation(dx, dy);
          const newSector = data.newSector;
          const needsRoomChange = data.crossQuadrant === true;
          if (!needsRoomChange) {
            store.setPosition({ x: newSector.x, y: newSector.y });
          }
          if (data.credits !== undefined) store.setCredits(data.credits);
          setTimeout(async () => {
            useStore.getState().addDiscoveries([newSector]);
            useStore
              .getState()
              .addLogEntry(
                `GATE-SPRUNG nach (${newSector.x}, ${newSector.y}) — ${data.hops ?? 1} Hop(s), ${data.tollPaid ?? 0} CR Maut`,
              );
            if (needsRoomChange) {
              await this.joinSector(newSector.x, newSector.y);
            } else {
              useStore.getState().setCurrentSector(newSector);
              useStore.getState().resetPan();
            }
            useStore.getState().clearJumpAnimation();
          }, 800);
        } else {
          store.addLogEntry(`GATE-SPRUNG FEHLER: ${data.error}`);
        }
      },
    );

    // Jumpgate upgraded / toll changed
    room.onMessage(
      'jumpgateUpdated',
      (data: {
        success: boolean;
        gateId?: string;
        field?: string;
        newLevel?: number;
        tollCredits?: number;
      }) => {
        if (data.success) {
          useStore.getState().addLogEntry('Jumpgate aktualisiert');
        }
      },
    );

    // Jumpgate dismantled
    room.onMessage(
      'jumpgateDismantled',
      (data: { success: boolean; refund?: Record<string, number> }) => {
        if (data.success) {
          useStore.getState().setPlayerGateInfo(null);
          useStore.getState().addLogEntry('Jumpgate abgebaut');
        }
      },
    );

    // Jumpgate link result (link created via gate slate)
    room.onMessage('jumpgateLinkResult', (data: { success: boolean }) => {
      if (data.success) {
        useStore.getState().addLogEntry('Gate verknüpft');
      }
    });

    // Jumpgate unlink result
    room.onMessage('jumpgateUnlinkResult', (data: { success: boolean }) => {
      if (data.success) {
        useStore.getState().addLogEntry('Verbindung getrennt');
      }
    });

    // Rescue
    room.onMessage('rescueResult', (data: RescueResultMessage) => {
      const store = useStore.getState();
      if (data.success) {
        store.addLogEntry(
          `${data.survivorsRescued} ÜBERLEBENDE GEBORGEN — ${data.safeSlotsFree} Slots frei`,
        );
      } else {
        store.addLogEntry(`RETTUNG FEHLGESCHLAGEN: ${data.error}`);
      }
    });

    room.onMessage('deliverSurvivorsResult', (data: DeliverSurvivorsResultMessage) => {
      const store = useStore.getState();
      if (data.success) {
        store.setRescuedSurvivors([]);
        if (data.credits !== undefined) store.setCredits(data.credits);
        store.addLogEntry(
          `ÜBERLEBENDE ABGELIEFERT — +${data.credits} CR, +${data.rep} REP, +${data.xp} XP`,
        );
      } else {
        store.addLogEntry(`ABLIEFERUNG FEHLGESCHLAGEN: ${data.error}`);
      }
    });

    room.onMessage('rescuedSurvivorsUpdate', (data: RescueSurvivor[]) => {
      useStore.getState().setRescuedSurvivors(data);
    });

    room.onMessage('distressCallReceived', (data: DistressCall) => {
      const store = useStore.getState();
      store.addDistressCall(data);
      store.addLogEntry(
        `NOTRUF EMPFANGEN — Richtung: ${data.direction}, ~${data.estimatedDistance} Sektoren`,
      );
      if (!isMonitorVisible('LOG')) store.setAlert('LOG', true);
      if (!isMonitorVisible('COMMS')) store.setAlert('COMMS', true);
    });

    // Faction Upgrades
    room.onMessage('factionUpgradesUpdate', (data: FactionUpgradeState[]) => {
      useStore.getState().setFactionUpgrades(data);
    });

    room.onMessage('factionUpgradeResult', (data: FactionUpgradeResultMessage) => {
      const store = useStore.getState();
      if (data.success && data.upgrades) {
        store.setFactionUpgrades(data.upgrades);
        store.addLogEntry('FRAKTIONS-UPGRADE AKTIVIERT');
      } else {
        store.addLogEntry(`UPGRADE FEHLER: ${data.error}`);
      }
    });

    // Bookmarks
    room.onMessage('bookmarksUpdate', (data: { bookmarks: Bookmark[] }) => {
      useStore.getState().setBookmarks(data.bookmarks);
    });

    // Trade Routes
    room.onMessage('tradeRoutesUpdate', (data: TradeRoute[]) => {
      useStore.getState().setTradeRoutes(data);
    });

    room.onMessage('configureRouteResult', (data: ConfigureRouteResultMessage) => {
      const store = useStore.getState();
      if (data.success && data.route) {
        store.setTradeRoutes([...store.tradeRoutes, data.route]);
        store.addLogEntry('HANDELSROUTE KONFIGURIERT');
      } else {
        store.addLogEntry(`ROUTEN-FEHLER: ${data.error}`);
      }
    });

    room.onMessage(
      'toggleRouteResult',
      (data: { success: boolean; error?: string; routeId?: string; active?: boolean }) => {
        const store = useStore.getState();
        if (data.success && data.routeId !== undefined) {
          const updated = store.tradeRoutes.map((r) =>
            r.id === data.routeId ? { ...r, active: data.active! } : r,
          );
          store.setTradeRoutes(updated);
        }
      },
    );

    room.onMessage(
      'deleteRouteResult',
      (data: { success: boolean; error?: string; routeId?: string }) => {
        const store = useStore.getState();
        if (data.success && data.routeId) {
          store.setTradeRoutes(store.tradeRoutes.filter((r) => r.id !== data.routeId));
          store.addLogEntry('HANDELSROUTE GELÖSCHT');
        }
      },
    );

    // --- Hyperjump / Autopilot ---

    room.onMessage(
      'autopilotStart',
      (data: {
        targetX: number;
        targetY: number;
        totalSteps: number;
        costs?: { totalFuel: number; totalAP: number; estimatedTime: number };
        currentStep?: number;
      }) => {
        const store = useStore.getState();
        store.setAutopilot({
          targetX: data.targetX,
          targetY: data.targetY,
          remaining: data.totalSteps,
          active: true,
        });
        store.setNavTarget({ x: data.targetX, y: data.targetY });
        store.setAutopilotStatus({
          targetX: data.targetX,
          targetY: data.targetY,
          currentStep: data.currentStep ?? 0,
          totalSteps: data.totalSteps,
          status: 'active',
          useHyperjump: false,
        });
      },
    );

    room.onMessage(
      'autopilotUpdate',
      (data: {
        x: number;
        y: number;
        remaining: number;
        currentStep?: number;
        totalSteps?: number;
      }) => {
        const store = useStore.getState();
        store.setPosition({ x: data.x, y: data.y });
        store.setAutopilot({
          ...(store.autopilot || { targetX: 0, targetY: 0, active: true }),
          remaining: data.remaining,
        });
        // Update autopilot status with progress
        const existing = store.autopilotStatus;
        if (existing) {
          store.setAutopilotStatus({
            ...existing,
            currentStep: data.currentStep ?? existing.totalSteps - data.remaining,
            totalSteps: data.totalSteps ?? existing.totalSteps,
            status: 'active',
          });
        }
        // Auto-center camera on ship during autopilot
        store.resetPan();
      },
    );

    room.onMessage('autopilotComplete', async (data: { x: number; y: number }) => {
      const store = useStore.getState();
      store.setAutopilot(null);
      store.setAutopilotStatus(null);
      store.setNavTarget(null);
      if (data.x >= 0 && data.y >= 0) {
        store.setPosition({ x: data.x, y: data.y });
        store.addLogEntry(`Autopilot: Ankunft bei (${data.x}, ${data.y})`);
        // Join the destination sector room so subsequent moves work
        try {
          await this.joinSector(data.x, data.y);
        } catch (err) {
          store.addLogEntry(`Sector-Join nach Autopilot fehlgeschlagen: ${(err as Error).message}`);
        }
      } else {
        // Cancelled: rejoin current sector from store.position
        const pos = store.position;
        store.addLogEntry('Autopilot abgebrochen.');
        try {
          await this.joinSector(pos.x, pos.y);
        } catch {
          // Best effort — already at current position room
        }
      }
      store.resetPan();
    });

    room.onMessage('autopilotPaused', (data: { reason: string; currentStep: number }) => {
      const store = useStore.getState();
      const existing = store.autopilotStatus;
      store.setAutopilotStatus({
        targetX: existing?.targetX ?? store.autopilot?.targetX ?? 0,
        targetY: existing?.targetY ?? store.autopilot?.targetY ?? 0,
        currentStep: data.currentStep,
        totalSteps: existing?.totalSteps ?? 0,
        status: 'paused',
        useHyperjump: existing?.useHyperjump ?? false,
        pauseReason: data.reason,
      });
      store.setAutopilot(null);
      store.addLogEntry(`Autopilot pausiert: ${data.reason}`);
    });

    room.onMessage('autopilotCancelled', async () => {
      const store = useStore.getState();
      store.setAutopilot(null);
      store.setAutopilotStatus(null);
      store.setNavTarget(null);
      store.addLogEntry('Autopilot abgebrochen.');
      // Rejoin current position sector to fix room desync
      try {
        await this.joinSector(store.position.x, store.position.y);
      } catch {
        // Best effort
      }
    });

    room.onMessage(
      'autopilotStatus',
      (data: {
        active: boolean;
        targetX?: number;
        targetY?: number;
        currentStep?: number;
        totalSteps?: number;
        remaining?: number;
        eta?: number;
        useHyperjump?: boolean;
      }) => {
        const store = useStore.getState();
        if (!data.active) {
          store.setAutopilotStatus(null);
          return;
        }
        store.setAutopilotStatus({
          targetX: data.targetX ?? 0,
          targetY: data.targetY ?? 0,
          currentStep: data.currentStep ?? 0,
          totalSteps: data.totalSteps ?? 0,
          status: 'active',
          useHyperjump: data.useHyperjump ?? false,
          eta: data.eta,
        });
        if (data.targetX !== undefined && data.targetY !== undefined) {
          store.setNavTarget({ x: data.targetX, y: data.targetY });
        }
      },
    );

    room.onMessage(
      'emergencyWarpResult',
      (data: {
        success: boolean;
        error?: string;
        newSector?: SectorData;
        fuelGranted?: number;
        creditCost?: number;
        credits?: number;
      }) => {
        if (data.success && data.newSector) {
          const store = useStore.getState();
          store.startJumpAnimation(0, 0);
          const newSector = data.newSector;
          const costMsg =
            data.creditCost && data.creditCost > 0
              ? ` (Kosten: ${data.creditCost} Credits)`
              : ' (GRATIS)';
          setTimeout(async () => {
            store.addDiscoveries([newSector]);
            store.addLogEntry(`NOTWARP zur Basis (${newSector.x}, ${newSector.y})${costMsg}`);
            if (data.credits !== undefined) {
              useStore.setState({ credits: data.credits });
            }
            await this.joinSector(newSector.x, newSector.y);
            useStore.getState().clearJumpAnimation();
          }, 800);
        } else {
          useStore.getState().addLogEntry(`Notwarp fehlgeschlagen: ${data.error}`);
        }
      },
    );

    room.onMessage('allDiscoveries', (data: { discoveries: DiscoveryItem[] }) => {
      const store = useStore.getState();
      // Merge discovery timestamps
      const timestamps: Record<string, number> = { ...store.discoveryTimestamps };
      const sectorData: SectorData[] = [];
      for (const d of data.discoveries) {
        const key = `${d.x}:${d.y}`;
        if (d.discoveredAt != null) {
          timestamps[key] = d.discoveredAt;
        }
        // Populate fog-of-war map with sector data if available
        if (d.type) {
          sectorData.push({
            x: d.x,
            y: d.y,
            type: d.type as SectorData['type'],
            seed: d.seed ?? 0,
            resources: { ore: 0, gas: 0, crystal: 0 },
            environment: (d.environment ?? 'empty') as SectorEnvironment,
            contents: (d.contents ?? []) as SectorContent[],
            discoveredBy: d.discoveredBy ?? null,
            discoveredAt: d.discoveredAt != null ? String(d.discoveredAt) : null,
            metadata: d.metadata ?? {},
          });
        }
      }
      store.setDiscoveryTimestamps(timestamps);
      if (sectorData.length > 0) {
        store.addDiscoveries(sectorData);
      }
    });

    // --- Admin Messages ---

    room.onMessage('adminMessage', (data: AdminMessage) => {
      const store = useStore.getState();
      store.addChatMessage({
        id: data.id,
        senderId: 'admin',
        senderName: data.senderName,
        channel: 'direct' as ChatChannel,
        content: data.content,
        sentAt: Date.parse(data.createdAt),
        delayed: false,
      });
      if (!isMonitorVisible('COMMS')) {
        store.setAlert('COMMS', true);
      }
    });

    room.onMessage('adminQuestOffer', (data: AdminQuestNotification) => {
      const store = useStore.getState();
      store.addLogEntry(`New quest available: ${data.title}`);
      if (!isMonitorVisible('QUESTS')) {
        store.setAlert('QUESTS', true);
      }
    });

    // --- Quadrant System ---

    room.onMessage('quadrantInfo', (data: { qx: number; qy: number; name?: string | null }) => {
      const store = useStore.getState();
      store.setCurrentQuadrant(data);
      store.addToStatSet('quadrantsVisited', `${data.qx}:${data.qy}`);
    });

    room.onMessage('firstContact', (data: FirstContactEvent) => {
      const store = useStore.getState();
      store.setFirstContactEvent(data);
      store.addLogEntry(`[QUADRANT] First contact: ${data.quadrant.name ?? data.autoName}`);
      store.incrementStat('quadrantsFirstDiscovered');
    });

    room.onMessage(
      'knownQuadrants',
      (data: {
        quadrants: Array<{
          qx: number;
          qy: number;
          learnedAt: string;
          name?: string;
          discoveredByName?: string;
        }>;
      }) => {
        useStore.getState().setKnownQuadrants(data.quadrants);
      },
    );

    room.onMessage(
      'syncQuadrantsResult',
      (data: {
        success: boolean;
        quadrants?: Array<{
          qx: number;
          qy: number;
          learnedAt: string;
          name?: string;
          discoveredByName?: string;
        }>;
        synced?: number;
        error?: string;
      }) => {
        const store = useStore.getState();
        if (data.success && data.quadrants) {
          store.setKnownQuadrants(data.quadrants);
          store.addLogEntry(`[QUADRANT] Synced ${data.synced ?? data.quadrants.length} quadrants`);
        } else {
          store.addLogEntry(`[QUADRANT] Sync failed: ${data.error}`);
        }
      },
    );

    room.onMessage('nameQuadrantResult', (data: { success: boolean; error?: string }) => {
      const store = useStore.getState();
      if (data.success) {
        store.setFirstContactEvent(null);
        store.addLogEntry('[QUADRANT] Quadrant named successfully');
      } else {
        store.addLogEntry(`[QUADRANT] Naming failed: ${data.error}`);
      }
    });

    // --- AQ Story / Community Quest ---

    room.onMessage('storyEvent', (data: StoryEventPayload) => {
      useStore.getState().setStoryEvent(data);
    });

    room.onMessage('storyProgress', (data: StoryProgressPayload) => {
      useStore.getState().setStoryProgress(data);
    });

    room.onMessage('storyChoiceResult', () => {
      useStore.getState().setStoryEvent(null);
      network.requestStoryProgress();
    });

    room.onMessage('alienEncounterEvent', (data: AlienEncounterEventPayload) => {
      useStore.getState().setAlienEncounterEvent(data);
    });

    room.onMessage('alienEncounterResolved', () => {
      useStore.getState().setAlienEncounterEvent(null);
    });

    room.onMessage('humanityReps', (data) => {
      useStore.getState().setHumanityReps(data);
    });

    room.onMessage('recruitingFactionsUpdate', (data: any[]) => {
      useStore.getState().setRecruitingFactions(data);
    });

    room.onMessage('activeCommunityQuest', (data: { quest: CommunityQuestPayload | null }) => {
      useStore.getState().setActiveCommunityQuest(data.quest);
    });

    room.onMessage('quadrantControls', (data: QuadrantControlState[]) => {
      useStore.getState().setQuadrantControls(data);
    });

    room.onMessage('visitedQuadrants', (data: Array<{ qx: number; qy: number }>) => {
      useStore.getState().setVisitedQuadrants(data);
    });

    room.onMessage('npcFleets', (data: NpcFleetState[]) => {
      useStore.getState().setNpcFleets(data);
    });

    room.onMessage('civ_ships_tick', (data: CivShip[]) => {
      useStore.getState().setCivShips(data);
    });

    room.onMessage('constructionSiteCreated', (data: { site: ConstructionSiteState }) => {
      useStore.getState().upsertConstructionSite(data.site);
    });
    room.onMessage('constructionSiteUpdate', (data: ConstructionSiteState) => {
      useStore.getState().upsertConstructionSite(data);
    });
    room.onMessage('constructionSiteCompleted', (data: { siteId: string }) => {
      useStore.getState().removeConstructionSite(data.siteId);
    });

    room.onMessage('warTicker', (data: WarTickerEvent) => {
      useStore.getState().addWarTickerEvent(data);
    });

    room.onMessage('inventoryState', (data: { items: InventoryItem[] }) => {
      useStore.getState().setInventory(data.items);
    });

    room.onMessage('inventoryUpdated', () => {
      room.send('getInventory');
    });

    room.onLeave(async (code) => {
      if (this.intentionalLeave) {
        this.intentionalLeave = false;
        return;
      }
      if (code > 1000 && !this.reconnecting) {
        this.reconnecting = true;
        const store = useStore.getState();
        store.addLogEntry(`VERBINDUNG VERLOREN (Code: ${code}) — Reconnect...`);

        let attempt = 0;
        const maxRetries = 5;
        const baseDelay = 1000;

        while (attempt < maxRetries) {
          attempt++;
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 15000);
          await new Promise((r) => setTimeout(r, delay));
          useStore.getState().addLogEntry(`Reconnect Versuch ${attempt}/${maxRetries}...`);
          try {
            await this.joinSector(store.position.x, store.position.y);
            useStore.getState().addLogEntry('VERBINDUNG WIEDERHERGESTELLT');
            this.reconnecting = false;
            return;
          } catch {
            /* continue */
          }
        }
        useStore.getState().addLogEntry('RECONNECT FEHLGESCHLAGEN — Bitte Seite neu laden');
        this.reconnecting = false;
      }
    });
  }

  sendJump(targetX: number, targetY: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    useStore.getState().setJumpPending(true);
    this.sectorRoom.send('jump', { targetX, targetY });
  }

  sendScan() {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    this.sectorRoom.send('scan', {});
  }

  sendLocalScan() {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    useStore.getState().startScanAnimation('local');
    this.sectorRoom.send('localScan', {});
    // Safety: clear scanPending if server never responds
    setTimeout(() => {
      const s = useStore.getState();
      if (s.scanPending) {
        s.setScanPending(false);
        s.clearScanAnimation();
      }
    }, 10000);
  }

  sendAreaScan() {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    useStore.getState().startScanAnimation('area');
    this.sectorRoom.send('areaScan', {});
    // Safety: clear scanPending if server never responds
    setTimeout(() => {
      const s = useStore.getState();
      if (s.scanPending) {
        s.setScanPending(false);
        s.clearScanAnimation();
      }
    }, 10000);
  }

  requestAP() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getAP', {});
  }

  requestDiscoveries() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getDiscoveries', {});
  }

  sendMine(resource: string) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    this.sectorRoom.send('mine', { resource });
  }

  sendStopMine() {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    this.sectorRoom.send('stopMine', {});
  }

  sendJettison(resource: string) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    this.sectorRoom.send('jettison', { resource });
  }

  requestCargo() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getCargo', {});
  }

  requestMiningStatus() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getMiningStatus', {});
  }

  sendChat(channel: ChatChannel, content: string, recipientId?: string) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    this.sectorRoom.send('chat', { channel, content, recipientId });
  }

  requestBase() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getBase', {});
  }

  sendBuild(type: StructureType) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    this.sectorRoom.send('build', { type });
  }

  sendDepositConstruction(siteId: string, ore: number, gas: number, crystal: number) {
    this.sectorRoom?.send('depositConstruction', { siteId, ore, gas, crystal });
  }

  sendTransfer(resource: string, amount: number, direction: 'toStorage' | 'fromStorage') {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('transfer', { resource, amount, direction });
  }

  sendNpcTrade(resource: string, amount: number, action: 'buy' | 'sell') {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('npcTrade', { resource, amount, action });
  }

  requestNpcStationData(): void {
    this.sectorRoom?.send('getNpcStation');
  }

  sendUpgradeStructure(structureId: string) {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('upgradeStructure', { structureId });
  }

  sendPlaceOrder(resource: string, amount: number, pricePerUnit: number, type: 'buy' | 'sell') {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('placeOrder', { resource, amount, pricePerUnit, type });
  }

  requestTradeOrders() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getTradeOrders', {});
  }

  requestMyOrders() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getMyOrders', {});
  }

  requestStorage() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getStorage', {});
  }

  requestCredits() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getCredits', {});
  }

  sendCancelOrder(orderId: string) {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('cancelOrder', { orderId });
  }

  // Data Slates
  sendCreateSlate(slateType: 'sector' | 'area' | 'jumpgate') {
    this.sectorRoom?.send('createSlate', { slateType });
  }

  requestMySlates() {
    this.sectorRoom?.send('getMySlates');
  }

  sendActivateSlate(slateId: string) {
    this.sectorRoom?.send('activateSlate', { slateId });
  }

  sendNpcBuyback(slateId: string) {
    this.sectorRoom?.send('npcBuybackSlate', { slateId });
  }

  sendListSlate(slateId: string, price: number) {
    this.sectorRoom?.send('listSlate', { slateId, price });
  }

  sendAcceptSlateOrder(orderId: string) {
    this.sectorRoom?.send('acceptSlateOrder', { orderId });
  }

  // Factions
  requestFaction() {
    this.sectorRoom?.send('getFaction');
  }

  sendCreateFaction(name: string, tag: string, joinMode: string) {
    this.sectorRoom?.send('createFaction', { name, tag, joinMode });
  }

  sendFactionAction(action: string, opts: Record<string, any> = {}) {
    this.sectorRoom?.send('factionAction', { action, ...opts });
  }

  sendRespondInvite(inviteId: string, accept: boolean) {
    this.sectorRoom?.send('respondInvite', { inviteId, accept });
  }

  requestStationNpcs(sectorX: number, sectorY: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('getStationNpcs', { sectorX, sectorY });
  }

  sendAcceptQuest(templateId: string, stationX: number, stationY: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('acceptQuest', { templateId, stationX, stationY });
  }

  sendAbandonQuest(questId: string) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('abandonQuest', { questId });
  }

  sendDeliverQuestResources(questId: string, sectorX: number, sectorY: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('deliverQuestResources', { questId, sectorX, sectorY });
  }

  requestActiveQuests() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getActiveQuests', {});
  }

  sendTrackQuest(questId: string, tracked: boolean) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('trackQuest', { questId, tracked });
  }

  requestTrackedQuests() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getTrackedQuests', {});
  }

  sendBattleAction(action: string, sectorX: number, sectorY: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('battleAction', { action, sectorX, sectorY });
  }

  sendCombatV2Action(tactic: string, specialAction: string, sectorX: number, sectorY: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('combatV2Action', { tactic, specialAction, sectorX, sectorY });
  }

  sendCombatV2Flee(sectorX: number, sectorY: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('combatV2Flee', { sectorX, sectorY });
  }

  sendEjectPod(sectorX: number, sectorY: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('ejectPod', { sectorX, sectorY });
  }

  sendInstallDefense(defenseType: string) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('installDefense', { defenseType });
  }

  sendRepairStation(sectorX: number, sectorY: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('repairStation', { sectorX, sectorY });
  }

  sendCompleteScanEvent(eventId: string) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('completeScanEvent', { eventId });
  }

  sendAlienInteract(factionId: string, action: string, payload?: Record<string, unknown>) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('alienInteract', { factionId, action, payload });
  }

  requestReputation() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getReputation', {});
  }

  sendRefuel(amount: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    this.sectorRoom.send('refuel', { amount });
  }

  // --- Phase 5: Deep Systems ---

  sendUseJumpGate(gateId: string, accessCode?: string) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('useJumpGate', { gateId, accessCode });
  }

  sendFrequencyMatch(gateId: string, matched: boolean) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('frequencyMatch', { gateId, matched });
  }

  sendRescue(sectorX: number, sectorY: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('rescue', { sectorX, sectorY });
  }

  sendDeliverSurvivors(stationX: number, stationY: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('deliverSurvivors', { stationX, stationY });
  }

  sendFactionUpgrade(tier: number, choice: FactionUpgradeChoice) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('factionUpgrade', { tier, choice });
  }

  sendConfigureRoute(config: ConfigureRouteMessage) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('configureRoute', config);
  }

  sendToggleRoute(routeId: string, active: boolean) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('toggleRoute', { routeId, active });
  }

  sendDeleteRoute(routeId: string) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('deleteRoute', { routeId });
  }

  // Bookmarks
  requestBookmarks() {
    this.sectorRoom?.send('getBookmarks');
  }
  sendSetBookmark(slot: number, sectorX: number, sectorY: number, label: string) {
    this.sectorRoom?.send('setBookmark', { slot, sectorX, sectorY, label });
  }
  sendClearBookmark(slot: number) {
    this.sectorRoom?.send('clearBookmark', { slot });
  }

  // Hyperjump / Autopilot
  sendHyperJump(targetX: number, targetY: number) {
    this.sectorRoom?.send('hyperJump', { targetX, targetY });
  }

  sendStartAutopilot(targetX: number, targetY: number, useHyperjump: boolean = false) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('startAutopilot', { targetX, targetY, useHyperjump });
  }

  sendCancelAutopilot() {
    this.sectorRoom?.send('cancelAutopilot');
  }

  sendGetAutopilotStatus() {
    this.sectorRoom?.send('getAutopilotStatus');
  }

  sendSetAutoRefuel(enabled: boolean, maxPricePerUnit: number) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('setAutoRefuel', { enabled, maxPricePerUnit });
  }

  sendEmergencyWarp() {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    this.sectorRoom.send('emergencyWarp');
  }

  sendCreateCustomSlate(data: CreateCustomSlateMessage) {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('createCustomSlate', data);
  }

  // --- Player Gates ---

  sendUpgradeJumpgate(gateId: string, upgradeType: string) {
    this.sectorRoom?.send('upgradeJumpgate', { gateId, upgradeType });
  }

  sendDismantleJumpgate(gateId: string) {
    this.sectorRoom?.send('dismantleJumpgate', { gateId });
  }

  sendSetJumpgateToll(gateId: string, toll: number) {
    this.sectorRoom?.send('setJumpgateToll', { gateId, toll });
  }

  sendLinkJumpgate(slateId: string) {
    this.sectorRoom?.send('linkJumpgate', { slateId });
  }

  sendUnlinkJumpgate(gateId: string, linkedGateId: string) {
    this.sectorRoom?.send('unlinkJumpgate', { gateId, linkedGateId });
  }

  sendUsePlayerGate(gateId: string, destinationGateId: string) {
    this.sectorRoom?.send('usePlayerGate', { gateId, destinationGateId });
  }

  // --- Ship designer ---

  sendGetShips() {
    this.sectorRoom?.send('getShips');
  }

  sendInstallModule(shipId: string, moduleId: string, slotIndex: number) {
    this.sectorRoom?.send('installModule', { shipId, moduleId, slotIndex });
  }

  sendRemoveModule(shipId: string, slotIndex: number) {
    this.sectorRoom?.send('removeModule', { shipId, slotIndex });
  }

  sendBuyModule(moduleId: string) {
    this.sectorRoom?.send('buyModule', { moduleId });
  }

  sendRenameShip(shipId: string, name: string) {
    this.sectorRoom?.send('renameShip', { shipId, name });
  }

  sendAcepBoost(path: AcepPath) {
    this.sectorRoom?.send('acepBoost', { path });
  }

  sendRenameBase(name: string) {
    this.sectorRoom?.send('renameBase', { name });
  }

  sendGetModuleInventory() {
    this.sectorRoom?.send('getModuleInventory');
  }

  // Tech-Baum: Research
  sendStartResearch(moduleId: string, slot: 1 | 2 = 1, artefactsToUse?: Record<string, number>) {
    this.sectorRoom?.send('startResearch', { moduleId, slot, artefactsToUse });
  }
  sendCancelResearch(slot: 1 | 2 = 1) {
    this.sectorRoom?.send('cancelResearch', { slot });
  }
  sendClaimResearch(slot: 1 | 2 = 1) {
    this.sectorRoom?.send('claimResearch', { slot });
  }
  sendActivateBlueprint(moduleId: string) {
    this.sectorRoom?.send('activateBlueprint', { moduleId });
  }
  requestResearchState() {
    this.sectorRoom?.send('getResearchState', {});
  }

  // Factory
  requestFactoryStatus() {
    this.sectorRoom?.send('factoryStatus');
  }
  sendFactorySetRecipe(recipeId: string) {
    this.sectorRoom?.send('factorySetRecipe', { recipeId });
  }
  sendFactoryCollect() {
    this.sectorRoom?.send('factoryCollect');
  }
  sendFactoryTransfer(itemType: string, amount: number) {
    this.sectorRoom?.send('factoryTransfer', { itemType, amount });
  }

  // Kontor
  requestKontorOrders(): void {
    this.sectorRoom?.send('kontorGetOrders');
  }
  sendKontorPlaceOrder(itemType: string, amount: number, pricePerUnit: number): void {
    this.sectorRoom?.send('kontorPlaceOrder', { itemType, amount, pricePerUnit });
  }
  sendKontorCancel(orderId: string): void {
    this.sectorRoom?.send('kontorCancelOrder', { orderId });
  }
  sendKontorSellTo(orderId: string, amount: number): void {
    this.sectorRoom?.send('kontorSellTo', { orderId, amount });
  }

  // News
  requestNews() {
    this.sectorRoom?.send('getNews');
  }

  // Territory
  sendClaimTerritory() {
    this.sectorRoom?.send('claimTerritory');
  }
  sendDefendTerritory() {
    this.sectorRoom?.send('defendTerritory');
  }
  requestTerritory(quadrantX?: number, quadrantY?: number) {
    this.sectorRoom?.send('getTerritory', { quadrantX, quadrantY });
  }
  requestMyTerritories() {
    this.sectorRoom?.send('listMyTerritories');
  }
  requestAllTerritories() {
    this.sectorRoom?.send('getAllTerritories');
  }

  // Quadrant system
  requestKnownQuadrants() {
    this.sectorRoom?.send('getKnownQuadrants');
  }
  requestSyncQuadrants() {
    this.sectorRoom?.send('syncQuadrants');
  }
  sendNameQuadrant(qx: number, qy: number, name: string) {
    this.sectorRoom?.send('nameQuadrant', { qx, qy, name });
  }

  // --- AQ Story / Community Quest ---

  sendStoryChoice(chapterId: number, branchChoice: string | null) {
    this.sectorRoom?.send('storyChoice', { chapterId, branchChoice });
  }

  requestStoryProgress() {
    this.sectorRoom?.send('getStoryProgress', {});
  }

  requestActiveCommunityQuest() {
    this.sectorRoom?.send('getActiveCommunityQuest', {});
  }

  contributeToQuest(amount: number) {
    this.sectorRoom?.send('contributeToQuest', { amount });
  }

  resolveAlienEncounter(factionId: string, eventType: string, accepted: boolean) {
    this.sectorRoom?.send('resolveAlienEncounter', { factionId, eventType, accepted });
  }

  requestHumanityReps() {
    this.sectorRoom?.send('getHumanityReps');
  }

  sendSetRecruiting(isRecruiting: boolean, slogan: string | null): void {
    this.sectorRoom?.send('setRecruiting', { isRecruiting, slogan });
  }

  // --- Unified Inventory ---

  requestInventory() {
    this.sectorRoom?.send('getInventory');
  }

  sendCraftModule(blueprintId: string) {
    this.sectorRoom?.send('craftModule', { blueprintId });
  }
}

export const network = new GameNetwork();
