import colyseus from 'colyseus';
import type { Client } from 'colyseus';
const { Room, ServerError } = colyseus;

import { SectorRoomState, PlayerSchema } from './schema/SectorState.js';
import { verifyToken, type AuthPayload } from '../auth.js';
import { generateSector } from '../engine/worldgen.js';
import { calculateCurrentAP } from '../engine/ap.js';
import { stopMining, calculateMinedAmount } from '../engine/mining.js';
import { validateJump, validateMine, validateJettison, validateLocalScan, validateAreaScan, validateBuild, validateTransfer, validateNpcTrade, validateCreateSlate, validateNpcBuyback } from '../engine/commands.js';
import { query } from '../db/client.js';
import { getAPState, saveAPState, savePlayerPosition, getMiningState, saveMiningState } from './services/RedisAPStore.js';
import { getSector, saveSector, addDiscovery, getPlayerDiscoveries, getPlayerCargo, addToCargo, jettisonCargo, getCargoTotal, awardBadge, hasAnyoneBadge, createStructure, deductCargo, saveMessage, getPendingMessages, markMessagesDelivered, getActiveShip, getRecentMessages, getPlayerBaseStructures, getStorageInventory, updateStorageResource, getPlayerCredits, addCredits, deductCredits, getPlayerStructure, upgradeStructureTier, createTradeOrder, getActiveTradeOrders, getPlayerTradeOrders, fulfillTradeOrder, cancelTradeOrder, findPlayerByUsername, createDataSlate, getPlayerSlates, getSlateById, deleteSlate, updateSlateStatus, updateSlateOwner, addSlateToCargo, removeSlateFromCargo, createSlateTradeOrder, getTradeOrderById } from '../db/queries.js';
import { AP_COSTS, AP_COSTS_LOCAL_SCAN, AP_COSTS_BY_SCANNER, RADAR_RADIUS, RECONNECTION_TIMEOUT_S, SHIP_CLASSES, STORAGE_TIERS, TRADING_POST_TIERS, SLATE_NPC_PRICE_PER_SECTOR } from '@void-sector/shared';
import type { SectorData, JumpMessage, MineMessage, JettisonMessage, ResourceType, CargoState, BuildMessage, SendChatMessage, ChatMessage, TransferMessage, NpcTradeMessage, UpgradeStructureMessage, PlaceOrderMessage, CreateSlateMessage, ActivateSlateMessage, NpcBuybackMessage, ListSlateMessage } from '@void-sector/shared';

interface SectorRoomOptions {
  sectorX: number;
  sectorY: number;
}

export class SectorRoom extends Room<SectorRoomState> {
  autoDispose = true;
  private clientShips = new Map<string, typeof SHIP_CLASSES[keyof typeof SHIP_CLASSES]>();

  private getShipForClient(sessionId: string) {
    return this.clientShips.get(sessionId) ?? SHIP_CLASSES.aegis_scout_mk1;
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

    this.clientShips.delete(client.sessionId);
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
      const ship = this.getShipForClient(client.sessionId);
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
      this.getShipForClient(client.sessionId).jumpRange,
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

    // Tell client to switch rooms
    client.send('jumpResult', {
      success: true,
      newSector: targetSector,
      apRemaining: jumpResult.newAP!.current,
    });

    // Client will leave this room and join the new sector room
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

    const radius = scanResult.radius;
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

    client.send('scanResult', { sectors, apRemaining: scanResult.newAP!.current });
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

    // Faction channel not yet implemented
    if (data.channel === 'faction') {
      client.send('error', { code: 'NOT_IMPLEMENTED', message: 'Faction channel coming soon' });
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
}
