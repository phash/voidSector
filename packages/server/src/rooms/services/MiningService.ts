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
import { getMiningState, saveMiningState, getMiningStoryCounter, setMiningStoryCounter } from './RedisAPStore.js';
import { getSector, updateSectorResources, getMiningStoryIndex, updateMiningStoryIndex } from '../../db/queries.js';
import {
  addToInventory,
  removeFromInventory,
  getResourceTotal,
  getCargoState,
} from '../../engine/inventoryService.js';
import { rejectGuest } from './utils.js';

const VALID_MINE_RESOURCES = ['ore', 'gas', 'crystal'];
const MINE_ALL_ORDER: MineableResourceType[] = ['ore', 'gas', 'crystal'];
const STORY_THRESHOLD = 10;

/**
 * Update mining story progress. Returns new storyIndex if advanced, null otherwise.
 */
export async function updateStoryProgress(
  playerId: string,
  minedAmount: number,
): Promise<number | null> {
  if (minedAmount <= 0) return null;

  const counter = await getMiningStoryCounter(playerId);
  const total = counter + minedAmount;
  const advancements = Math.floor(total / STORY_THRESHOLD);
  const remainder = total % STORY_THRESHOLD;

  if (advancements > 0) {
    const currentIndex = await getMiningStoryIndex(playerId);
    const newIndex = currentIndex + advancements;
    await updateMiningStoryIndex(playerId, newIndex);
    await setMiningStoryCounter(playerId, remainder);
    return newIndex;
  }

  await setMiningStoryCounter(playerId, total);
  return null;
}

export class MiningService {
  private autoStopTimers = new Map<string, NodeJS.Timeout>();

  constructor(private ctx: ServiceContext) {}

  hasTimer(playerId: string): boolean {
    return this.autoStopTimers.has(playerId);
  }

  setTimerForTest(playerId: string, timer: NodeJS.Timeout): void {
    this.autoStopTimers.set(playerId, timer);
  }

  private clearTimer(playerId: string): void {
    const timer = this.autoStopTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.autoStopTimers.delete(playerId);
    }
  }

  clearAllTimers(): void {
    for (const timer of this.autoStopTimers.values()) {
      clearTimeout(timer);
    }
    this.autoStopTimers.clear();
  }

  private setAutoStopTimer(
    client: Client,
    playerId: string,
    sectorYield: number,
    rate: number,
    cargoSpace: number,
  ): void {
    this.clearTimer(playerId);

    const resourceTimeout = Math.ceil(sectorYield / rate) * 1000;
    const cargoTimeout = Math.ceil(cargoSpace / rate) * 1000;
    const timeout = Math.min(resourceTimeout, cargoTimeout);

    const timer = setTimeout(async () => {
      this.autoStopTimers.delete(playerId);
      await this.handleAutoStop(client, playerId);
    }, timeout);

    this.autoStopTimers.set(playerId, timer);
  }

  private async handleAutoStop(client: Client, playerId: string): Promise<void> {
    const mining = await getMiningState(playerId);
    if (!mining.active) return;

    const cargoTotal = await getResourceTotal(playerId);
    const ship = this.ctx.getShipForClient(client.sessionId);
    const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
    const result = stopMining(mining, cargoSpace);

    // FIX #279: Always deplete resource from sector, even if mined=0 (cargo full case)
    if (result.mined > 0 && result.resource) {
      await addToInventory(playerId, 'resource', result.resource, result.mined);
      const miningXp = Math.floor(result.mined / 5);
      if (miningXp > 0) {
        addAcepXpForPlayer(playerId, 'ausbau', miningXp).catch(() => {});
      }
    }
    // Deplete sector resources regardless of cargo (result.mined could be 0 if cargo full)
    if (result.resource && mining.sectorYield > 0) {
      await this.depleteResource(
        mining.sectorX, mining.sectorY,
        result.resource as MineableResourceType, result.mined,
      );
    }

    await saveMiningState(playerId, result.newState);

    // Story progress (before potential chain — this segment's mined amount counts)
    const newStoryIndex = await updateStoryProgress(playerId, result.mined);
    if (newStoryIndex !== null) {
      client.send('miningStoryUpdate', { storyIndex: newStoryIndex });
    }

    // Mine-all chaining
    if (mining.mineAll) {
      const newCargoTotal = await getResourceTotal(playerId);
      const newCargoSpace = Math.max(0, ship.cargoCap - newCargoTotal);
      if (newCargoSpace > 0) {
        const sectorData = await getSector(mining.sectorX, mining.sectorY);
        if (sectorData?.resources) {
          let foundResource = false;
          for (const res of MINE_ALL_ORDER) {
            if (sectorData.resources[res] > 0) {
              foundResource = true;
              const nextResult = validateMine(
                res, sectorData.resources, result.newState,
                newCargoTotal, ship.cargoCap,
                mining.sectorX, mining.sectorY, true,
              );
              if (nextResult.valid && nextResult.state) {
                const bonuses = await this.ctx.getPlayerBonuses(playerId);
                nextResult.state.rate = MINING_RATE_PER_SECOND
                  * (1 + (ship.miningBonus ?? 0))
                  * bonuses.miningRateMultiplier;

                await saveMiningState(playerId, nextResult.state);
                client.send('miningUpdate', nextResult.state);
                this.setAutoStopTimer(
                  client, playerId,
                  nextResult.state.sectorYield,
                  nextResult.state.rate,
                  newCargoSpace,
                );
                return;
              }
            }
          }
          // FIX #279: If no resources left and mineAll was active, stop mining and notify
          if (!foundResource) {
            client.send('logEntry', 'SEKTOR ERSCHÖPFT — MINING BEENDET');
          }
        }
      }
    }

    const cargo = await getCargoState(playerId);
    client.send('miningUpdate', result.newState);
    client.send('cargoUpdate', cargo);

    // Send updated sector resources so client bars sync
    const updatedSector = await getSector(mining.sectorX, mining.sectorY);
    if (updatedSector) {
      client.send('sectorData', updatedSector);
    }
  }

  private async depleteResource(
    sectorX: number,
    sectorY: number,
    resource: MineableResourceType,
    amount: number,
  ): Promise<void> {
    const sectorData = await getSector(sectorX, sectorY);
    if (!sectorData?.resources) return;
    const resources = {
      ore: sectorData.resources.ore,
      gas: sectorData.resources.gas,
      crystal: sectorData.resources.crystal,
    };
    resources[resource] = Math.max(0, resources[resource] - amount);
    await updateSectorResources(sectorX, sectorY, resources, resource);
  }

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
    const mineAll = data.mineAll ?? false;

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
      resource, sectorData.resources, current,
      cargoTotal, ship.cargoCap,
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
      mineAll,
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

    // Set auto-stop timer
    const cargoSpace = Math.max(0, ship.cargoCap - cargoTotal);
    this.setAutoStopTimer(
      client, auth.userId,
      result.state!.sectorYield,
      result.state!.rate,
      cargoSpace,
    );
  }

  async handleStopMine(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;

    this.clearTimer(auth.userId);

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
      await this.depleteResource(
        mining.sectorX, mining.sectorY,
        result.resource as MineableResourceType, result.mined,
      );
      const miningXp = Math.floor(result.mined / 5);
      if (miningXp > 0) {
        addAcepXpForPlayer(auth.userId, 'ausbau', miningXp).catch(() => {});
      }
    }

    await saveMiningState(auth.userId, result.newState);

    const cargo = await getCargoState(auth.userId);
    client.send('miningUpdate', result.newState);
    client.send('cargoUpdate', cargo);

    // Story progress
    const newIndex = await updateStoryProgress(auth.userId, result.mined);
    if (newIndex !== null) {
      client.send('miningStoryUpdate', { storyIndex: newIndex });
    }

    // Send updated sector resources so client bars sync
    const updatedSector = await getSector(mining.sectorX, mining.sectorY);
    if (updatedSector) {
      client.send('sectorData', updatedSector);
    }
  }

  async handleToggleMineAll(client: Client, data: { mineAll: boolean }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const mining = await getMiningState(auth.userId);
    if (!mining.active) return;
    mining.mineAll = data.mineAll;
    await saveMiningState(auth.userId, mining);
    client.send('miningUpdate', mining);
  }

  async handleJettison(client: Client, data: JettisonMessage): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'jettison', 500)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
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
