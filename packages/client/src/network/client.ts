import { Client, type Room } from 'colyseus.js';
import { useStore } from '../state/store';
import type { APState, SectorData, MiningState, CargoState, SectorResources, ChatMessage, ChatChannel, StructureType, ShipData } from '@void-sector/shared';

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
}

export const network = new GameNetwork();
