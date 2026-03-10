// packages/server/src/engine/universeBootstrap.ts
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { UniverseTickEngine } from './universeTickEngine.js';
import { StrategicTickService } from './strategicTickService.js';
import { getAllHumanityReps, ensureKernweltStation, ensureZentrumQuadrant } from '../db/queries.js';
import { logger } from '../utils/logger.js';

dotenv.config();

// Strategic tick fires every 12 universe ticks (12 × 5s = 60s)
const STRATEGIC_TICK_INTERVAL = 12;

/** Singleton engine instance — set after startUniverseEngine() is called */
let _engine: UniverseTickEngine | null = null;

/** Returns the current universe tick count, or 0 if engine not started yet */
export function getUniverseTickCount(): number {
  return _engine?.getState().tickCount ?? 0;
}

/**
 * Wire up UniverseTickEngine + StrategicTickService and start the tick loop.
 * Call once from app.config.ts beforeListen.
 */
export async function startUniverseEngine(): Promise<void> {
  await ensureKernweltStation();
  await ensureZentrumQuadrant();
  logger.info('Kernwelt seeded: Zuhause@(0,0), Zentrum quadrant');

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

  _engine = engine;
  engine.start();
  logger.info('UniverseTickEngine started');
}
