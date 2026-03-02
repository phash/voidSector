import { Client, type Room } from 'colyseus.js';
import { useStore } from '../state/store';
import type { APState, SectorData } from '@void-sector/shared';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:2567';

class GameNetwork {
  private client: Client;
  private sectorRoom: Room | null = null;

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
    room.onMessage('jumpResult', async (data: {
      success: boolean;
      error?: string;
      newSector?: SectorData;
      apRemaining?: number;
    }) => {
      useStore.getState().setJumpPending(false);
      if (data.success && data.newSector) {
        useStore.getState().addDiscoveries([data.newSector]);
        useStore.getState().addLogEntry(
          `Jumped to (${data.newSector.x}, ${data.newSector.y}) — ${data.newSector.type}`
        );
        // Leave current room and join new sector
        await this.joinSector(data.newSector.x, data.newSector.y);
      } else {
        useStore.getState().addLogEntry(`Jump failed: ${data.error}`);
      }
    });

    // Scan result
    room.onMessage('scanResult', (data: {
      sectors: SectorData[];
      apRemaining: number;
    }) => {
      useStore.getState().addDiscoveries(data.sectors);
      useStore.getState().setAP({
        ...useStore.getState().ap!,
        current: data.apRemaining,
      });
      useStore.getState().addLogEntry(
        `Scan complete: ${data.sectors.length} sectors revealed`
      );
    });

    // Discoveries
    room.onMessage('discoveries', (data: Array<{ x: number; y: number }>) => {
      useStore.getState().addLogEntry(`Loaded ${data.length} discovered sectors`);
    });

    // Errors
    room.onMessage('error', (data: { code: string; message: string }) => {
      useStore.getState().addLogEntry(`ERROR: ${data.message}`);
    });

    room.onLeave((code) => {
      if (code > 1000) {
        useStore.getState().addLogEntry(`Disconnected (code: ${code})`);
      }
    });
  }

  sendJump(targetX: number, targetY: number) {
    if (!this.sectorRoom) return;
    useStore.getState().setJumpPending(true);
    this.sectorRoom.send('jump', { targetX, targetY });
  }

  sendScan() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('scan', {});
  }

  requestAP() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getAP', {});
  }

  requestDiscoveries() {
    if (!this.sectorRoom) return;
    this.sectorRoom.send('getDiscoveries', {});
  }
}

export const network = new GameNetwork();
