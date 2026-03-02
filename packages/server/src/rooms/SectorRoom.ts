import colyseus from 'colyseus';
import type { Client } from 'colyseus';
const { Room, ServerError } = colyseus;

import { SectorRoomState, PlayerSchema } from './schema/SectorState.js';
import { verifyToken, type AuthPayload } from '../auth.js';
import { generateSector } from '../engine/worldgen.js';
import { calculateCurrentAP } from '../engine/ap.js';
import { stopMining, calculateMinedAmount } from '../engine/mining.js';
import { validateJump, validateScan, validateMine, validateJettison } from '../engine/commands.js';
import { getAPState, saveAPState, savePlayerPosition, getMiningState, saveMiningState } from './services/RedisAPStore.js';
import { getSector, saveSector, addDiscovery, getPlayerDiscoveries, getPlayerCargo, addToCargo, jettisonCargo, getCargoTotal } from '../db/queries.js';
import { AP_COSTS, RADAR_RADIUS, RECONNECTION_TIMEOUT_S, SHIP_CLASSES } from '@void-sector/shared';
import type { SectorData, JumpMessage, MineMessage, JettisonMessage, ResourceType, CargoState } from '@void-sector/shared';

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

    // Send initial cargo
    const cargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', cargo);

    // Send mining state
    const miningState = await getMiningState(auth.userId);
    client.send('miningUpdate', miningState);
  }

  async onLeave(client: Client, consented: boolean) {
    // Auto-stop mining when leaving
    try {
      const auth = client.auth as AuthPayload;
      const mining = await getMiningState(auth.userId);
      if (mining.active) {
        const cargoTotal = await getCargoTotal(auth.userId);
        const ship = SHIP_CLASSES.aegis_scout_mk1;
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

    this.state.players.delete(client.sessionId);
    this.state.playerCount = this.state.players.size;
  }

  private async handleJump(client: Client, data: JumpMessage) {
    const auth = client.auth as AuthPayload;
    const { targetX, targetY } = data;

    // Auto-stop mining before jumping
    const mining = await getMiningState(auth.userId);
    if (mining.active) {
      const cargoTotal = await getCargoTotal(auth.userId);
      const ship = SHIP_CLASSES.aegis_scout_mk1;
      const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
      const result = stopMining(mining, cargoSpace);
      if (result.mined > 0 && result.resource) {
        await addToCargo(auth.userId, result.resource, result.mined);
      }
      await saveMiningState(auth.userId, result.newState);
      client.send('miningUpdate', result.newState);
      const cargo = await getPlayerCargo(auth.userId);
      client.send('cargoUpdate', cargo);
    }

    // Validate jump
    const ap = await getAPState(auth.userId);
    const jumpResult = validateJump(
      ap,
      this.state.sector.x,
      this.state.sector.y,
      targetX,
      targetY,
      SHIP_CLASSES.aegis_scout_mk1.jumpRange,
      AP_COSTS.jump,
    );
    if (!jumpResult.valid) {
      client.send('jumpResult', { success: false, error: jumpResult.error });
      return;
    }
    await saveAPState(auth.userId, jumpResult.newAP!);

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
      apRemaining: jumpResult.newAP!.current,
    });

    // Client will leave this room and join the new sector room
  }

  private async handleScan(client: Client) {
    const auth = client.auth as AuthPayload;

    const ap = await getAPState(auth.userId);
    const scanResult = validateScan(ap, AP_COSTS.scan);
    if (!scanResult.valid) {
      client.send('error', { code: 'NO_AP', message: scanResult.error });
      return;
    }
    await saveAPState(auth.userId, scanResult.newAP!);

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

    client.send('scanResult', { sectors: surroundings, apRemaining: scanResult.newAP!.current });
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
    const ship = SHIP_CLASSES.aegis_scout_mk1;

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
    const ship = SHIP_CLASSES.aegis_scout_mk1;
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
}
