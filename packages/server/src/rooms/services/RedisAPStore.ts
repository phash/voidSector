import Redis from 'ioredis';
import dotenv from 'dotenv';
import type { APState, MiningState, HyperdriveState } from '@void-sector/shared';
import { createAPState } from '../../engine/ap.js';
import { createMiningState } from '../../engine/mining.js';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const KEY_PREFIX = 'player:ap:';

export async function getAPState(playerId: string): Promise<APState> {
  const data = await redis.hgetall(`${KEY_PREFIX}${playerId}`);
  if (!data.current) {
    const fresh = createAPState();
    await saveAPState(playerId, fresh);
    return fresh;
  }
  return {
    current: Number(data.current),
    max: Number(data.max),
    lastTick: Number(data.lastTick),
    regenPerSecond: Number(data.regenPerSecond),
  };
}

export async function saveAPState(playerId: string, ap: APState): Promise<void> {
  await redis.hset(`${KEY_PREFIX}${playerId}`, {
    current: String(ap.current),
    max: String(ap.max),
    lastTick: String(ap.lastTick),
    regenPerSecond: String(ap.regenPerSecond),
  });
}

export async function getPlayerPosition(
  playerId: string,
): Promise<{ x: number; y: number } | null> {
  const data = await redis.hgetall(`player:pos:${playerId}`);
  if (!data.x) return null;
  return { x: Number(data.x), y: Number(data.y) };
}

export async function savePlayerPosition(playerId: string, x: number, y: number): Promise<void> {
  await redis.hset(`player:pos:${playerId}`, { x: String(x), y: String(y) });
}

const MINING_PREFIX = 'player:mining:';

export async function getMiningState(playerId: string): Promise<MiningState> {
  const data = await redis.hgetall(`${MINING_PREFIX}${playerId}`);
  if (!data.active) return createMiningState();
  return {
    active: data.active === 'true',
    resource: (data.resource as MiningState['resource']) || null,
    sectorX: Number(data.sectorX),
    sectorY: Number(data.sectorY),
    startedAt: data.startedAt ? Number(data.startedAt) : null,
    rate: Number(data.rate),
    sectorYield: Number(data.sectorYield),
    mineAll: data.mineAll === 'true',
  };
}

export async function saveMiningState(playerId: string, state: MiningState): Promise<void> {
  if (!state.active) {
    await redis.del(`${MINING_PREFIX}${playerId}`);
    return;
  }
  await redis.hset(`${MINING_PREFIX}${playerId}`, {
    active: String(state.active),
    resource: state.resource || '',
    sectorX: String(state.sectorX),
    sectorY: String(state.sectorY),
    startedAt: String(state.startedAt || 0),
    rate: String(state.rate),
    sectorYield: String(state.sectorYield),
    mineAll: String(state.mineAll),
  });
}

const FUEL_PREFIX = 'player:fuel:';

export async function getFuelState(userId: string): Promise<number | null> {
  const val = await redis.get(`${FUEL_PREFIX}${userId}`);
  return val !== null ? parseFloat(val) : null;
}

export async function saveFuelState(userId: string, fuel: number): Promise<void> {
  await redis.set(`${FUEL_PREFIX}${userId}`, fuel.toString());
}

const HYPERDRIVE_PREFIX = 'player:hyperdrive:';

export async function getHyperdriveState(userId: string): Promise<HyperdriveState | null> {
  const data = await redis.hgetall(`${HYPERDRIVE_PREFIX}${userId}`);
  if (!data.charge) return null;
  return {
    charge: Number(data.charge),
    maxCharge: Number(data.maxCharge),
    regenPerSecond: Number(data.regenPerSecond),
    lastTick: Number(data.lastTick),
  };
}

export async function setHyperdriveState(userId: string, state: HyperdriveState): Promise<void> {
  await redis.hset(`${HYPERDRIVE_PREFIX}${userId}`, {
    charge: String(state.charge),
    maxCharge: String(state.maxCharge),
    regenPerSecond: String(state.regenPerSecond),
    lastTick: String(state.lastTick),
  });
}

export async function getMiningStoryCounter(playerId: string): Promise<number> {
  const val = await redis.get(`mining:story:${playerId}`);
  return val ? parseInt(val, 10) : 0;
}

export async function setMiningStoryCounter(playerId: string, value: number): Promise<void> {
  await redis.set(`mining:story:${playerId}`, String(value));
}

export { redis };

const SALVAGE_PREFIX = 'player:salvage:';

export interface SalvageSession {
  wreckId: string;
  itemIndex: number;
  startedAt: number;
  duration: number;
  resolveChance: number;
}

export async function getSalvageSession(playerId: string): Promise<SalvageSession | null> {
  const data = await redis.hgetall(`${SALVAGE_PREFIX}${playerId}`);
  if (!data.wreckId) return null;
  return {
    wreckId: data.wreckId,
    itemIndex: Number(data.itemIndex),
    startedAt: Number(data.startedAt),
    duration: Number(data.duration),
    resolveChance: Number(data.resolveChance),
  };
}

export async function saveSalvageSession(
  playerId: string,
  session: SalvageSession,
): Promise<void> {
  await redis.hset(`${SALVAGE_PREFIX}${playerId}`, {
    wreckId: session.wreckId,
    itemIndex: String(session.itemIndex),
    startedAt: String(session.startedAt),
    duration: String(session.duration),
    resolveChance: String(session.resolveChance),
  });
  // TTL: duration + 30s crash protection
  await redis.pexpire(`${SALVAGE_PREFIX}${playerId}`, session.duration + 30_000);
}

export async function clearSalvageSession(playerId: string): Promise<void> {
  await redis.del(`${SALVAGE_PREFIX}${playerId}`);
}
