import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type {
  MineMessage,
  JettisonMessage,
  CargoState,
  MineableResourceType,
} from '@void-sector/shared';
import { MINING_RATE_PER_SECOND } from '@void-sector/shared';

import { validateMine, validateJettison } from '../../engine/commands.js';
import { addAcepXpForPlayer } from '../../engine/acepXpService.js';
import { stopMining } from '../../engine/mining.js';
import { getMiningState, saveMiningState } from './RedisAPStore.js';
import { getSector } from '../../db/queries.js';
import {
  addToInventory,
  removeFromInventory,
  getResourceTotal,
  getCargoState,
} from '../../engine/inventoryService.js';
import { rejectGuest } from './utils.js';

const VALID_MINE_RESOURCES = ['ore', 'gas', 'crystal'];

export class MiningService {
  constructor(private ctx: ServiceContext) {}

  async handleMine(client: Client, data: MineMessage): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'mine', 500)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    if (!data.resource || !VALID_MINE_RESOURCES.includes(data.resource)) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Invalid resource type' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const { resource } = data;

    const sectorData = await getSector(
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    if (!sectorData?.resources) {
      client.send('error', { code: 'NO_RESOURCES', message: 'No resources in this sector' });
      return;
    }

    const current = await getMiningState(auth.userId);
    const cargoTotal = await getResourceTotal(auth.userId);
    const ship = this.ctx.getShipForClient(client.sessionId);

    const result = validateMine(
      resource,
      sectorData.resources,
      current,
      cargoTotal,
      ship.cargoCap,
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    if (!result.valid) {
      client.send('error', { code: 'MINE_FAILED', message: result.error! });
      return;
    }

    // Apply ship module bonus and faction mining bonus
    const bonuses = await this.ctx.getPlayerBonuses(auth.userId);
    result.state!.rate = MINING_RATE_PER_SECOND
      * (1 + (ship.miningBonus ?? 0))
      * bonuses.miningRateMultiplier;

    await saveMiningState(auth.userId, result.state!);
    client.send('miningUpdate', result.state!);
  }

  async handleStopMine(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;

    const mining = await getMiningState(auth.userId);
    if (!mining.active) {
      client.send('error', { code: 'NOT_MINING', message: 'Not currently mining' });
      return;
    }

    const cargoTotal = await getResourceTotal(auth.userId);
    const ship = this.ctx.getShipForClient(client.sessionId);
    const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
    const result = stopMining(mining, cargoSpace);

    if (result.mined > 0 && result.resource) {
      await addToInventory(auth.userId, 'resource', result.resource, result.mined);
      // ACEP: AUSBAU-XP for mining/resource collection (spec: +1 per 5 units mined)
      const miningXp = Math.floor(result.mined / 5);
      if (miningXp > 0) {
        addAcepXpForPlayer(auth.userId, 'ausbau', miningXp).catch(() => {});
      }
    }

    await saveMiningState(auth.userId, result.newState);

    const cargo = await getCargoState(auth.userId);
    client.send('miningUpdate', result.newState);
    client.send('cargoUpdate', cargo);
  }

  async handleJettison(client: Client, data: JettisonMessage): Promise<void> {
    if (rejectGuest(client, 'Abwerfen')) return;
    const auth = client.auth as AuthPayload;
    const { resource } = data;

    const cargo = await getCargoState(auth.userId);
    const currentAmount = cargo[resource as keyof CargoState] ?? 0;

    const result = validateJettison(resource, currentAmount);
    if (!result.valid) {
      client.send('error', { code: 'JETTISON_FAILED', message: result.error! });
      return;
    }

    await removeFromInventory(auth.userId, 'resource', resource, currentAmount);
    const updatedCargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    client.send('logEntry', `FRACHT ABGEWORFEN: ${currentAmount} ${resource.toUpperCase()}`);
  }
}
