// packages/server/src/engine/universeBootstrap.ts
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { UniverseTickEngine } from './universeTickEngine.js';
import { StrategicTickService } from './strategicTickService.js';
import { getAllHumanityReps, ensureKernweltStation, ensureZentrumQuadrant, ensureAlienHomeQuadrants, getAllFactionConfigs } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import { QUADRANT_SIZE } from '@void-sector/shared';
import { assertAlienHomesFarFromOrigin } from './alienHomeGuard.js';
import { ensureCivStations, spawnMissingDrones } from './civStationService.js';
import { processCivTick, getOnlinePlayerAnchors } from './civShipService.js';
import { processConstructionTick } from './constructionTickService.js';
import { processStationBuildTick } from './stationBuildTick.js';
import { processStationMiningTick } from './stationMiningService.js';
import { runStationFuelProductionTick } from './stationFuelEngine.js';

dotenv.config();

// Strategic tick fires every 12 universe ticks (12 × 5s = 60s)
const STRATEGIC_TICK_INTERVAL = 12;
// Fuel production tick fires every 2 universe ticks (2 × 5s = 10s)
const FUEL_PRODUCTION_TICK_INTERVAL = 2;

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
  const alienSeeded = await ensureAlienHomeQuadrants();
  logger.info({ alienSeeded }, 'Universe seeded: Zentrum@(0,0) + alien homeworlds');
  const factionHomes = await getAllFactionConfigs();
  assertAlienHomesFarFromOrigin(factionHomes, QUADRANT_SIZE, 1000);

  await ensureCivStations();
  // SP10 (#512/#513/#537): drones now spawn LAZILY in-tick, only near online
  // players (spawnMissingDrones(anchors)) — no startup all-stations sweep.
  logger.info('CivShips: stations seeded (drones spawn lazily near players)');

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const strategicTick = new StrategicTickService(redis);
  await strategicTick.init();

  const engine = new UniverseTickEngine(async (result) => {
    // SP10 (#512/#513/#537): lazy civ ticking — only ships/stations near online
    // players are simulated, bounded + capped, so it no longer OOMs on the full
    // ~24k ships / ~8k stations. With nobody online both calls early-return.
    const anchors = await getOnlinePlayerAnchors();
    await processCivTick(anchors);
    // Spawn drones near players every ~12 ticks (60s) to keep it cheap.
    if (result.tickCount % STRATEGIC_TICK_INTERVAL === 0) {
      await spawnMissingDrones(anchors).catch((err) =>
        logger.error({ err }, 'spawnMissingDrones error'),
      );
    }
    await processConstructionTick();
    await processStationBuildTick();
    await processStationMiningTick();

    // Fuel production tick (every 10 s) — must come BEFORE strategic tick early-return guard
    if (result.tickCount % FUEL_PRODUCTION_TICK_INTERVAL === 0) {
      runStationFuelProductionTick().catch((err) =>
        logger.error({ err }, 'stationFuelProduction tick error'),
      );
    }

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
