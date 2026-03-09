// packages/server/src/engine/universeBootstrap.ts
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { UniverseTickEngine } from './universeTickEngine.js';
import { StrategicTickService } from './strategicTickService.js';
import { getAllHumanityReps } from '../db/queries.js';
import { logger } from '../utils/logger.js';

dotenv.config();

// Strategic tick fires every 12 universe ticks (12 × 5s = 60s)
const STRATEGIC_TICK_INTERVAL = 12;

/**
 * Wire up UniverseTickEngine + StrategicTickService and start the tick loop.
 * Call once from app.config.ts beforeListen.
 */
export async function startUniverseEngine(): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const strategicTick = new StrategicTickService(redis);
  await strategicTick.init();

  const engine = new UniverseTickEngine(async (result) => {
    if (result.tickCount % STRATEGIC_TICK_INTERVAL !== 0) return;

    const repsRecord = await getAllHumanityReps();
    const repStore = new Map<string, number>(Object.entries(repsRecord));
    await strategicTick.tick(repStore);

    logger.debug(
      { tickCount: result.tickCount, factions: repStore.size },
      'Strategic tick complete',
    );
  });

  engine.start();
  logger.info('UniverseTickEngine started');
}
