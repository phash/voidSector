import Redis from 'ioredis';
import dotenv from 'dotenv';
import type { APState } from '@void-sector/shared';
import { createAPState } from '../../engine/ap.js';

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
  playerId: string
): Promise<{ x: number; y: number } | null> {
  const data = await redis.hgetall(`player:pos:${playerId}`);
  if (!data.x) return null;
  return { x: Number(data.x), y: Number(data.y) };
}

export async function savePlayerPosition(
  playerId: string,
  x: number,
  y: number
): Promise<void> {
  await redis.hset(`player:pos:${playerId}`, { x: String(x), y: String(y) });
}

export { redis };
