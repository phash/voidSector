import colyseus from 'colyseus';
import type { Client } from 'colyseus';
const { Room, ServerError } = colyseus;

import { SectorRoomState, PlayerSchema } from './schema/SectorState.js';
import { verifyToken, type AuthPayload } from '../auth.js';
import { generateSector } from '../engine/worldgen.js';
import { spendAP, calculateCurrentAP } from '../engine/ap.js';
import { getAPState, saveAPState, savePlayerPosition } from './services/RedisAPStore.js';
import { getSector, saveSector, addDiscovery, getPlayerDiscoveries } from '../db/queries.js';
import { AP_COSTS, RADAR_RADIUS, RECONNECTION_TIMEOUT_S, SHIP_CLASSES } from '@void-sector/shared';
import type { SectorData, JumpMessage } from '@void-sector/shared';

interface SectorRoomOptions {
  sectorX: number;
  sectorY: number;
}

export class SectorRoom extends Room<SectorRoomState> {
  autoDispose = true;

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

    this.roomId = `sector:${sectorX}:${sectorY}`;

    // Handle jump message
    this.onMessage('jump', async (client, data: JumpMessage) => {
      await this.handleJump(client, data);
    });

    // Handle scan message
    this.onMessage('scan', async (client) => {
      await this.handleScan(client);
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

    // Record discovery
    await addDiscovery(auth.userId, this.state.sector.x, this.state.sector.y);

    // Send initial AP state
    const ap = await getAPState(auth.userId);
    const updated = calculateCurrentAP(ap);
    await saveAPState(auth.userId, updated);
    client.send('apUpdate', updated);
  }

  async onLeave(client: Client, consented: boolean) {
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

    this.state.players.delete(client.sessionId);
    this.state.playerCount = this.state.players.size;
  }

  private async handleJump(client: Client, data: JumpMessage) {
    const auth = client.auth as AuthPayload;
    const { targetX, targetY } = data;

    // Validate range — use default ship jump range for MVP
    const defaultJumpRange = SHIP_CLASSES.aegis_scout_mk1.jumpRange;
    const dx = Math.abs(targetX - this.state.sector.x);
    const dy = Math.abs(targetY - this.state.sector.y);
    if (dx > defaultJumpRange || dy > defaultJumpRange || (dx === 0 && dy === 0)) {
      client.send('jumpResult', { success: false, error: 'Target out of range' });
      return;
    }

    // Spend AP
    const ap = await getAPState(auth.userId);
    const newAP = spendAP(ap, AP_COSTS.jump);
    if (!newAP) {
      client.send('jumpResult', { success: false, error: 'Not enough AP' });
      return;
    }
    await saveAPState(auth.userId, newAP);

    // Load or generate target sector
    let targetSector = await getSector(targetX, targetY);
    if (!targetSector) {
      targetSector = generateSector(targetX, targetY, auth.userId);
      await saveSector(targetSector);
    }

    // Record discovery
    await addDiscovery(auth.userId, targetX, targetY);

    // Tell client to switch rooms
    client.send('jumpResult', {
      success: true,
      newSector: targetSector,
      apRemaining: newAP.current,
    });

    // Client will leave this room and join the new sector room
  }

  private async handleScan(client: Client) {
    const auth = client.auth as AuthPayload;

    const ap = await getAPState(auth.userId);
    const newAP = spendAP(ap, AP_COSTS.scan);
    if (!newAP) {
      client.send('error', { code: 'NO_AP', message: 'Not enough AP to scan' });
      return;
    }
    await saveAPState(auth.userId, newAP);

    // Get surrounding sectors
    const surroundings: SectorData[] = [];
    for (let dx = -RADAR_RADIUS; dx <= RADAR_RADIUS; dx++) {
      for (let dy = -RADAR_RADIUS; dy <= RADAR_RADIUS; dy++) {
        const sx = this.state.sector.x + dx;
        const sy = this.state.sector.y + dy;
        let sector = await getSector(sx, sy);
        if (!sector) {
          sector = generateSector(sx, sy, auth.userId);
          await saveSector(sector);
        }
        await addDiscovery(auth.userId, sx, sy);
        surroundings.push(sector);
      }
    }

    client.send('scanResult', { sectors: surroundings, apRemaining: newAP.current });
  }
}
