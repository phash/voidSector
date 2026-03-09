// packages/server/src/engine/strategicTickService.ts
import type { Redis } from 'ioredis';
import {
  getAllQuadrantControls,
  upsertQuadrantControl,
  getAllFactionConfigs,
  createNpcFleet,
  deleteArrivedNpcFleets,
} from '../db/queries.js';
import type { QuadrantControlRow } from '../db/queries.js';
import { FactionConfigService } from './factionConfigService.js';
import { calculateFriction, repValueToTier } from './frictionEngine.js';
import { findAllBorderPairs, getExpansionTarget } from './expansionEngine.js';
import { resolveStrategicTick, calculateBaseDefense } from './warfareEngine.js';
import { logger } from '../utils/logger.js';
import { processWissenTick } from './wissenTickHandler.js';

// rep store: maps faction_id → numeric reputation (-100..+100)
export type RepStore = Map<string, number>;

export class StrategicTickService {
  private factionConfig: FactionConfigService;

  constructor(private redis: Redis) {
    this.factionConfig = new FactionConfigService();
  }

  async init(): Promise<void> {
    await this.factionConfig.init();
  }

  async tick(repStore: RepStore): Promise<void> {
    await deleteArrivedNpcFleets();
    const allControls = await getAllQuadrantControls();

    // 1. Update friction + handle warfare at all human<→alien borders
    const borderPairs = findAllBorderPairs(allControls);
    for (const { a, b } of borderPairs) {
      if (a.controlling_faction !== 'human' && b.controlling_faction !== 'human') continue;
      const alienFaction = a.controlling_faction === 'human' ? b.controlling_faction : a.controlling_faction;
      const humanQ = a.controlling_faction === 'human' ? a : b;
      const alienQ = a.controlling_faction === 'human' ? b : a;

      const rep = repStore.get(alienFaction) ?? 0;
      const repTier = repValueToTier(rep);
      const factionCfg = this.factionConfig.getConfig(alienFaction);
      const aggression = factionCfg?.aggression ?? 1.0;
      const { score, state } = calculateFriction(repTier, aggression);

      // Update friction score on the quadrant
      await upsertQuadrantControl({
        qx: alienQ.qx,
        qy: alienQ.qy,
        controlling_faction: alienQ.controlling_faction,
        faction_shares: alienQ.faction_shares as Record<string, number>,
        attack_value: alienQ.attack_value,
        defense_value: alienQ.defense_value,
        friction_score: score,
        station_tier: alienQ.station_tier,
      });

      if (state === 'total_war') {
        await this.processWarfareTick(humanQ, alienQ, alienFaction);
      }
    }

    // 2. Alien expansion into unclaimed space
    await this.processAlienExpansion(allControls, repStore);

    // 3. Wissen generation for research labs
    await processWissenTick(60_000); // strategic tick interval ~60s
  }

  private async processWarfareTick(
    humanQ: QuadrantControlRow,
    alienQ: QuadrantControlRow,
    alienFaction: string
  ): Promise<void> {
    const result = resolveStrategicTick({
      attack: alienQ.attack_value,
      defense: humanQ.defense_value,
    });

    if (result.conquest) {
      await upsertQuadrantControl({
        qx: humanQ.qx,
        qy: humanQ.qy,
        controlling_faction: alienFaction,
        faction_shares: { [alienFaction]: 100 },
        attack_value: 0,
        defense_value: calculateBaseDefense(humanQ.station_tier, 200),
        friction_score: 0,
        station_tier: humanQ.station_tier,
      });
      const msg = `${alienFaction.toUpperCase()} CONQUEST — Quadrant [${humanQ.qx}/${humanQ.qy}] lost`;
      logger.warn({ alienFaction, qx: humanQ.qx, qy: humanQ.qy }, msg);
      await this.pushWarTickerEvent(msg);
    } else if (result.invasionRepelled) {
      const msg = `INVASION REPELLED — Quadrant [${humanQ.qx}/${humanQ.qy}] held`;
      logger.info({ alienFaction, qx: humanQ.qx, qy: humanQ.qy }, msg);
      await this.pushWarTickerEvent(msg);
    }
  }

  private async processAlienExpansion(
    allControls: QuadrantControlRow[],
    repStore: RepStore
  ): Promise<void> {
    const factions = this.factionConfig.getActiveFactions()
      .filter(f => f.faction_id !== 'human');

    for (const faction of factions) {
      const target = getExpansionTarget(
        faction.faction_id,
        allControls,
        faction.expansion_style as 'sphere' | 'wave' | 'jumpgate'
      );
      if (!target) continue;

      const rep = repStore.get(faction.faction_id) ?? 0;
      const repTier = repValueToTier(rep);
      const { state } = calculateFriction(repTier, faction.aggression);
      if (state === 'peaceful_halt') continue;

      const eta = new Date(Date.now() + faction.expansion_rate * 60_000);
      await createNpcFleet({
        faction: faction.faction_id,
        fleet_type: 'build_ship',
        from_qx: faction.home_qx,
        from_qy: faction.home_qy,
        to_qx: target.qx,
        to_qy: target.qy,
        strength: 50,
        eta,
      });

      logger.debug(
        { faction: faction.faction_id, to_qx: target.qx, to_qy: target.qy },
        'Alien expansion fleet dispatched'
      );
    }
  }

  async pushWarTickerEvent(message: string): Promise<void> {
    const event = JSON.stringify({ message, ts: Date.now() });
    await this.redis.lpush('war_ticker', event);
    await this.redis.ltrim('war_ticker', 0, 9);
  }
}
