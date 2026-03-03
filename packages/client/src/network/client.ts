import { Client, type Room } from 'colyseus.js';
import { useStore } from '../state/store';
import type { APState, SectorData, MiningState, CargoState, SectorResources, ChatMessage, ChatChannel, StructureType, ShipData, StorageInventory, DataSlate, FactionDataMessage } from '@void-sector/shared';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:2567';

class GameNetwork {
  private client: Client;
  private sectorRoom: Room | null = null;
  private reconnecting = false;

  constructor() {
    this.client = new Client(WS_URL);
  }

  async joinSector(x: number, y: number): Promise<void> {
    const store = useStore.getState();
    if (!store.token) throw new Error('Not authenticated');

    // Leave current room
    if (this.sectorRoom) {
      await this.sectorRoom.leave();
      this.sectorRoom = null;
      store.clearPlayers();
    }

    this.client.http.authToken = store.token;

    this.sectorRoom = await this.client.joinOrCreate('sector', {
      sectorX: x,
      sectorY: y,
    });

    this.setupRoomListeners(this.sectorRoom);
    store.setPosition({ x, y });
    store.addLogEntry(`Entered sector (${x}, ${y})`);
  }

  private setupRoomListeners(room: Room) {
    // State change: sync players
    (room.state as any).players.onAdd((player: any, sessionId: string) => {
      useStore.getState().setPlayer(sessionId, {
        sessionId,
        username: player.username,
        x: player.x,
        y: player.y,
        connected: player.connected,
      });
    });

    (room.state as any).players.onRemove((_player: any, sessionId: string) => {
      useStore.getState().removePlayer(sessionId);
    });

    // Sector data
    room.onStateChange.once((state: any) => {
      const sector: SectorData = {
        x: state.sector.x,
        y: state.sector.y,
        type: state.sector.sectorType,
        seed: state.sector.seed,
        discoveredBy: null,
        discoveredAt: null,
        metadata: {},
      };
      useStore.getState().setCurrentSector(sector);
      useStore.getState().addDiscoveries([sector]);
    });

    // AP updates
    room.onMessage('apUpdate', (ap: APState) => {
      useStore.getState().setAP(ap);
    });

    // Jump result
    room.onMessage('jumpResult', (data: {
      success: boolean;
      error?: string;
      newSector?: SectorData;
      apRemaining?: number;
    }) => {
      useStore.getState().setJumpPending(false);
      if (data.success && data.newSector) {
        const store = useStore.getState();
        const dx = data.newSector.x - store.position.x;
        const dy = data.newSector.y - store.position.y;
        store.startJumpAnimation(dx, dy);
        // Delay sector join until animation completes
        const newSector = data.newSector;
        setTimeout(async () => {
          useStore.getState().addDiscoveries([newSector]);
          useStore.getState().addLogEntry(
            `Jumped to (${newSector.x}, ${newSector.y}) — ${newSector.type}`
          );
          await this.joinSector(newSector.x, newSector.y);
          useStore.getState().clearJumpAnimation();
        }, 800);
      } else {
        useStore.getState().addLogEntry(`Jump failed: ${data.error}`);
      }
    });

    // Scan result
    room.onMessage('scanResult', (data: {
      sectors: SectorData[];
      apRemaining: number;
    }) => {
      const store = useStore.getState();
      store.addDiscoveries(data.sectors);
      const currentAP = store.ap;
      if (currentAP) {
        store.setAP({ ...currentAP, current: data.apRemaining });
      }
      store.addLogEntry(
        `Scan complete: ${data.sectors.length} sectors revealed`
      );
      // Alert LOG if interesting sectors found
      const hasInteresting = data.sectors.some(
        (s) => s.type === 'pirate' || s.type === 'anomaly' || s.type === 'station'
      );
      if (hasInteresting) {
        const logVisible = store.sidebarSlots.includes('LOG')
          || store.leftSidebarSlots.includes('LOG')
          || store.mainMonitorMode === 'LOG';
        if (!logVisible) {
          store.setAlert('LOG', true);
        }
      }
    });

    // Local scan result
    room.onMessage('localScanResult', (data: { resources: SectorResources; hiddenSignatures: boolean }) => {
      const store = useStore.getState();
      if (store.currentSector) {
        const updatedSector = { ...store.currentSector, resources: data.resources };
        store.setCurrentSector(updatedSector);
        store.addDiscoveries([updatedSector]);
      }
      if (data.hiddenSignatures) {
        store.addLogEntry('UNKNOWN SIGNATURES DETECTED — SCANNER UPGRADE REQUIRED');
      }
      store.addLogEntry(`Local scan: Ore ${data.resources.ore}, Gas ${data.resources.gas}, Crystal ${data.resources.crystal}`);
    });

    // Discoveries
    room.onMessage('discoveries', (data: Array<{ x: number; y: number }>) => {
      useStore.getState().addLogEntry(`Loaded ${data.length} discovered sectors`);
    });

    // Errors
    room.onMessage('error', (data: { code: string; message: string }) => {
      useStore.getState().addLogEntry(`ERROR: ${data.message}`);
    });

    // Mining updates
    room.onMessage('miningUpdate', (data: MiningState) => {
      const store = useStore.getState();
      const wasMining = store.mining?.active;
      store.setMining(data);
      // Alert when mining completes (was active, now not)
      if (wasMining && !data.active) {
        const visible = store.sidebarSlots.includes('MINING')
          || store.leftSidebarSlots.includes('MINING')
          || store.mainMonitorMode === 'MINING';
        if (!visible) {
          store.setAlert('MINING', true);
        }
      }
    });

    // Cargo updates
    room.onMessage('cargoUpdate', (data: CargoState) => {
      useStore.getState().setCargo(data);
    });

    // Ship data
    room.onMessage('shipData', (data: ShipData) => {
      useStore.getState().setShip(data);
    });

    // Chat messages
    room.onMessage('chatMessage', (data: ChatMessage) => {
      const store = useStore.getState();
      store.addChatMessage(data);
      // Alert if COMMS is not visible in any sidebar slot or main
      const visible = store.sidebarSlots.includes('COMMS')
        || store.leftSidebarSlots.includes('COMMS')
        || store.mainMonitorMode === 'COMMS';
      if (!visible) {
        store.setAlert('COMMS', true);
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
    room.onMessage('npcTradeResult', (data: { success: boolean; error?: string }) => {
      const store = useStore.getState();
      if (data.success) {
        store.addLogEntry('Trade complete');
      } else {
        store.addLogEntry(`Trade failed: ${data.error}`);
      }
    });

    // Upgrade result
    room.onMessage('upgradeResult', (data: { success: boolean; error?: string; newTier?: number }) => {
      const store = useStore.getState();
      if (data.success) {
        store.addLogEntry(`Upgraded to tier ${data.newTier}`);
      } else {
        store.addLogEntry(`Upgrade failed: ${data.error}`);
      }
    });

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
      store.addLogEntry(`Station: ${data.npcs.length} NPCs, ${data.quests.length} Quests verfügbar`);
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
      const quests = store.activeQuests.map(q =>
        q.id === data.questId ? { ...q, objectives: data.objectives } : q
      );
      store.setActiveQuests(quests);
      store.addLogEntry('Quest-Fortschritt aktualisiert');
      const visible = store.sidebarSlots.includes('QUESTS')
        || store.leftSidebarSlots.includes('QUESTS')
        || store.mainMonitorMode === 'QUESTS';
      if (!visible) store.setAlert('QUESTS', true);
    });

    room.onMessage('reputationUpdate', (data) => {
      const store = useStore.getState();
      store.setReputations(data.reputations);
      store.setPlayerUpgrades(data.upgrades);
    });

    room.onMessage('battleResult', (data) => {
      const store = useStore.getState();
      store.setActiveBattle(null);
      if (data.success && data.result) {
        store.addLogEntry(`Kampf: ${data.result.outcome}`);
      }
    });

    room.onMessage('pirateAmbush', (data) => {
      const store = useStore.getState();
      store.setActiveBattle(data.encounter);
      store.addLogEntry(`PIRATEN-HINTERHALT bei (${data.sectorX}, ${data.sectorY})!`);
    });

    room.onMessage('scanEventDiscovered', (data) => {
      const store = useStore.getState();
      store.addScanEvent(data.event);
      const visible = store.sidebarSlots.includes('QUESTS')
        || store.leftSidebarSlots.includes('QUESTS')
        || store.mainMonitorMode === 'QUESTS';
      if (!visible) store.setAlert('QUESTS', true);
    });

    room.onMessage('logEntry', (data) => {
      useStore.getState().addLogEntry(typeof data === 'string' ? data : data.message ?? '');
    });

    room.onLeave(async (code) => {
      if (code > 1000 && !this.reconnecting) {
        this.reconnecting = true;
        useStore.getState().addLogEntry(`Disconnected (code: ${code}) — reconnecting...`);
        const store = useStore.getState();
        try {
          await this.joinSector(store.position.x, store.position.y);
          useStore.getState().addLogEntry('Reconnected');
        } catch {
          useStore.getState().addLogEntry('Reconnect failed');
        } finally {
          this.reconnecting = false;
        }
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
    this.sectorRoom.send('localScan', {});
  }

  sendAreaScan() {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED — rejoin required');
      return;
    }
    this.sectorRoom.send('areaScan', {});
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

  sendTransfer(resource: string, amount: number, direction: 'toStorage' | 'fromStorage') {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('transfer', { resource, amount, direction });
  }

  sendNpcTrade(resource: string, amount: number, action: 'buy' | 'sell') {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('npcTrade', { resource, amount, action });
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
  sendCreateSlate(slateType: 'sector' | 'area') {
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
    if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
    this.sectorRoom.send('getStationNpcs', { sectorX, sectorY });
  }

  sendAcceptQuest(templateId: string, stationX: number, stationY: number) {
    if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
    this.sectorRoom.send('acceptQuest', { templateId, stationX, stationY });
  }

  sendAbandonQuest(questId: string) {
    if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
    this.sectorRoom.send('abandonQuest', { questId });
  }

  requestActiveQuests() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getActiveQuests', {});
  }

  sendBattleAction(action: string, sectorX: number, sectorY: number) {
    if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
    this.sectorRoom.send('battleAction', { action, sectorX, sectorY });
  }

  sendCompleteScanEvent(eventId: string) {
    if (!this.sectorRoom) { useStore.getState().addLogEntry('NOT CONNECTED'); return; }
    this.sectorRoom.send('completeScanEvent', { eventId });
  }

  requestReputation() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getReputation', {});
  }
}

export const network = new GameNetwork();
