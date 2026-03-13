// packages/server/src/engine/strategicTickService.ts
import type { Redis } from 'ioredis';
import {
  getAllQuadrantControls,
  upsertQuadrantControl,
  createNpcFleet,
  getArrivedNpcFleets,
  deleteArrivedNpcFleets,
  logExpansionEvent,
  getExpiredPlayerQuestsWithItems,
  updateQuestStatus,
} from '../db/queries.js';
import { removeFromInventory } from './inventoryService.js';
import type { QuadrantControlRow } from '../db/queries.js';
import { FactionConfigService } from './factionConfigService.js';
import { calculateFriction, repValueToTier } from './frictionEngine.js';
import { findAllBorderPairs, getExpansionTarget } from './expansionEngine.js';
import { resolveStrategicTick, calculateBaseDefense } from './warfareEngine.js';
import { logger } from '../utils/logger.js';
import { VoidLifecycleService } from './voidLifecycleService.js';
import { tickWreckSpawns } from './wreckSpawnEngine.js';

const AGGRESSION_MUL = parseFloat(process.env.ALIEN_AGGRESSION_MUL ?? '1');
const EXPANSION_RATE_MUL = parseFloat(process.env.ALIEN_EXPANSION_RATE_MUL ?? '1');

// rep store: maps faction_id → numeric reputation (-100..+100)
export type RepStore = Map<string, number>;

export class StrategicTickService {
  private tickCount = 0;
  private factionConfig: FactionConfigService;
  private voidLifecycle: VoidLifecycleService;

  constructor(private redis: Redis) {
    this.factionConfig = new FactionConfigService();
    this.voidLifecycle = new VoidLifecycleService(redis);
  }

  async init(): Promise<void> {
    await this.factionConfig.init();
  }

  async tick(repStore: RepStore): Promise<void> {
    await this.processArrivedFleets();
    const allControls = await getAllQuadrantControls();

    // 1. Update friction + handle warfare at all human<→alien borders
    const borderPairs = findAllBorderPairs(allControls);
    for (const { a, b } of borderPairs) {
      if (a.controlling_faction !== 'humans' && b.controlling_faction !== 'humans') continue;
      const alienFaction =
        a.controlling_faction === 'humans' ? b.controlling_faction : a.controlling_faction;
      const humanQ = a.controlling_faction === 'humans' ? a : b;
      const alienQ = a.controlling_faction === 'humans' ? b : a;

      const rep = repStore.get(alienFaction) ?? 0;
      const repTier = repValueToTier(rep);
      const factionCfg = this.factionConfig.getConfig(alienFaction);
      const aggression = (factionCfg?.aggression ?? 1.0) * AGGRESSION_MUL;
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
    await this.processAlienExpansion(allControls);

    // 3. Void civilization lifecycle
    await this.voidLifecycle.tick();

    // 4. Cleanup expired quest items (prisoner, data_slate)
    await this.cleanupExpiredQuestItems();

    this.tickCount++;
    if (this.tickCount % 10 === 0) {
      await tickWreckSpawns().catch((err) =>
        logger.error({ err }, 'tickWreckSpawns error'),
      );
    }
  }

  private async cleanupExpiredQuestItems(): Promise<void> {
    const expired = await getExpiredPlayerQuestsWithItems();
    for (const quest of expired) {
      const objectives = quest.objectives as any[];
      // Bounty: remove prisoner if combat was fulfilled
      const combatObj = objectives?.find((o: any) => o.type === 'bounty_combat');
      if (combatObj?.fulfilled) {
        await removeFromInventory(quest.player_id, 'prisoner', quest.id, 1);
      }
      // Scan: remove data_slate if scan done but not delivered
      const scanDone = objectives?.some((o: any) => o.type === 'scan' && o.fulfilled);
      const deliverDone = objectives?.some((o: any) => o.type === 'scan_deliver' && o.fulfilled);
      if (scanDone && !deliverDone) {
        await removeFromInventory(quest.player_id, 'data_slate', quest.id, 1);
      }
      await updateQuestStatus(quest.id, 'expired');
    }
    if (expired.length > 0) {
      logger.info({ count: expired.length }, 'Expired quest items cleaned up');
    }
  }

  private async processWarfareTick(
    humanQ: QuadrantControlRow,
    alienQ: QuadrantControlRow,
    alienFaction: string,
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
      await logExpansionEvent(alienFaction, humanQ.qx, humanQ.qy, 'conquered');
      await logExpansionEvent('humans', humanQ.qx, humanQ.qy, 'lost');
      const msg = `${alienFaction.toUpperCase()} CONQUEST — Quadrant [${humanQ.qx}/${humanQ.qy}] lost`;
      logger.warn({ alienFaction, qx: humanQ.qx, qy: humanQ.qy }, msg);
      await this.pushWarTickerEvent(msg);
    } else if (result.invasionRepelled) {
      const msg = `INVASION REPELLED — Quadrant [${humanQ.qx}/${humanQ.qy}] held`;
      logger.info({ alienFaction, qx: humanQ.qx, qy: humanQ.qy }, msg);
      await this.pushWarTickerEvent(msg);
    }
  }

  private async processArrivedFleets(): Promise<void> {
    const arrived = await getArrivedNpcFleets();
    if (arrived.length === 0) {
      await deleteArrivedNpcFleets();
      return;
    }

    for (const fleet of arrived) {
      if (fleet.fleet_type === 'build_ship') {
        // Colonize target quadrant
        await upsertQuadrantControl({
          qx: fleet.to_qx,
          qy: fleet.to_qy,
          controlling_faction: fleet.faction,
          faction_shares: { [fleet.faction]: 100 },
          attack_value: 0,
          defense_value: calculateBaseDefense(1, fleet.strength),
          friction_score: 0,
          station_tier: 1,
        });
        logger.info(
          { faction: fleet.faction, qx: fleet.to_qx, qy: fleet.to_qy },
          'Alien fleet colonized quadrant',
        );
      }
    }

    await deleteArrivedNpcFleets();
  }

  private async processAlienExpansion(
    allControls: QuadrantControlRow[],
  ): Promise<void> {
    const factions = this.factionConfig.getActiveFactions().filter((f) => f.faction_id !== 'humans');

    for (const faction of factions) {
      const target = getExpansionTarget(
        faction.faction_id,
        allControls,
        faction.expansion_style as 'sphere' | 'wave' | 'jumpgate',
      );
      if (!target) continue;

      // Expansion into unclaimed space is not gated by friction —
      // friction only governs warfare at faction borders.
      const eta = new Date(Date.now() + (faction.expansion_rate / EXPANSION_RATE_MUL) * 60_000);
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

      await logExpansionEvent(faction.faction_id, target.qx, target.qy, 'colonized');
      logger.debug(
        { faction: faction.faction_id, to_qx: target.qx, to_qy: target.qy },
        'Alien expansion fleet dispatched',
      );
    }
  }

  async pushWarTickerEvent(message: string): Promise<void> {
    const event = JSON.stringify({ message, ts: Date.now() });
    await this.redis.lpush('war_ticker', event);
    await this.redis.ltrim('war_ticker', 0, 9);
  }
}
