// packages/server/src/engine/strategicTickService.ts
import type { Redis } from 'ioredis';
import {
  getAllQuadrantControls,
  upsertQuadrantControl,
  updateQuadrantFriction,
  createNpcFleet,
  getArrivedNpcFleets,
  deleteArrivedNpcFleets,
  logExpansionEvent,
  getExpiredPlayerQuestsWithItems,
  updateQuestStatus,
  getHumanFrontierMaxDistance,
} from '../db/queries.js';
import { removeFromInventory } from './inventoryService.js';
import { warBus } from '../warBus.js';
import { resetDeadOutlaws } from '../db/civQueries.js';
import type { QuadrantControlRow } from '../db/queries.js';
import { FactionConfigService } from './factionConfigService.js';
import { calculateFriction, frictionFromBase, pairEnmity, repValueToTier } from './frictionEngine.js';
import type { FrictionState } from './frictionEngine.js';
import { findAllBorderPairs, getExpansionTarget, shouldWakeAliens, expansionFrontierMax } from './expansionEngine.js';
import { resolveStrategicTick, calculateBaseDefense } from './warfareEngine.js';
import { logger } from '../utils/logger.js';
import { getConfig } from './gameConfigApply.js';
import { gameConfig } from './gameConfigService.js';
import { VoidLifecycleService } from './voidLifecycleService.js';
import { tickWreckSpawns } from './wreckSpawnEngine.js';
import { ConquestEngine } from './conquestEngine.js';

const AGGRESSION_MUL = parseFloat(process.env.ALIEN_AGGRESSION_MUL ?? '1');
const EXPANSION_RATE_MUL = parseFloat(process.env.ALIEN_EXPANSION_RATE_MUL ?? '1');

// rep store: maps faction_id → numeric reputation (-100..+100)
export type RepStore = Map<string, number>;

export class StrategicTickService {
  private tickCount = 0;
  private factionConfig: FactionConfigService;
  private voidLifecycle: VoidLifecycleService;
  private conquestEngine = new ConquestEngine();

  constructor(private redis: Redis) {
    this.factionConfig = new FactionConfigService();
    this.voidLifecycle = new VoidLifecycleService(redis);
  }

  async init(): Promise<void> {
    await this.factionConfig.init();
  }

  async tick(repStore: RepStore): Promise<void> {
    await this.processArrivedFleets();
    // QW3: revive outlaws whose death timer has expired (was never called → outlaws
    // stayed dead permanently, bleeding the hostile NPC population to zero).
    const revived = await resetDeadOutlaws().catch(() => 0);
    if (revived > 0) {
      await this.pushWarTickerEvent(`${revived} Outlaw-Schiff(e) wieder gesichtet.`).catch(() => {});
    }
    const allControls = await getAllQuadrantControls();

    // 1. Update friction + handle warfare at ALL borders. Human↔alien uses
    //    humanity reputation; alien↔alien and alien↔void (BB3) use a deterministic
    //    per-pair enmity so the whole galaxy is a living multi-faction conflict.
    const borderPairs = findAllBorderPairs(allControls);
    for (const { a, b } of borderPairs) {
      const aHuman = a.controlling_faction === 'humans';
      const bHuman = b.controlling_faction === 'humans';

      let frictionResult: { score: number; state: FrictionState };
      let attackerQ: QuadrantControlRow;
      let defenderQ: QuadrantControlRow;
      let attackerFaction: string;

      if (aHuman || bHuman) {
        const humanQ = aHuman ? a : b;
        const alienQ = aHuman ? b : a;
        const alienFaction = alienQ.controlling_faction;
        const rep = repStore.get(alienFaction) ?? 0;
        const aggression = (this.factionConfig.getConfig(alienFaction)?.aggression ?? 1.0) * AGGRESSION_MUL;
        frictionResult = calculateFriction(repValueToTier(rep), aggression);
        attackerQ = alienQ;
        defenderQ = humanQ;
        attackerFaction = alienFaction;
      } else {
        // alien↔alien or alien↔void: pair enmity, the higher-attack side attacks.
        const aggA = this.factionConfig.getConfig(a.controlling_faction)?.aggression ?? 1.0;
        const aggB = this.factionConfig.getConfig(b.controlling_faction)?.aggression ?? 1.0;
        const enmity = pairEnmity(a.controlling_faction, b.controlling_faction);
        frictionResult = frictionFromBase(enmity, Math.max(aggA, aggB) * AGGRESSION_MUL);
        if (a.attack_value >= b.attack_value) {
          attackerQ = a;
          defenderQ = b;
        } else {
          attackerQ = b;
          defenderQ = a;
        }
        attackerFaction = attackerQ.controlling_faction;
      }

      // Friction is informational — update the score ONLY (never the faction, which a
      // stale snapshot would revert if this quadrant was conquered earlier this tick).
      await updateQuadrantFriction(attackerQ.qx, attackerQ.qy, frictionResult.score);

      if (frictionResult.state === 'total_war') {
        await this.processWarfareTick(defenderQ, attackerQ, attackerFaction);
      }
    }

    // 2. Alien expansion — dormant until a human reaches the alien ring (~1000
    //    sectors / 2 quadrants), then expands within the player frontier + margin.
    const humanFrontier = await getHumanFrontierMaxDistance();
    const alreadyAwake = (getConfig('aliens_awakened') as boolean) ?? false;
    const waking = shouldWakeAliens(alreadyAwake, humanFrontier);
    if (waking) {
      await gameConfig.set('aliens_awakened', true, 'aliens', 'Humans reached the alien ring');
      await this.pushWarTickerEvent('◆ Etwas Fremdes erwacht in der Tiefe…').catch(() => undefined);
      logger.info({ humanFrontier }, 'Aliens awakened — expansion enabled');
    }
    if (alreadyAwake || waking) {
      await this.processAlienExpansion(allControls, expansionFrontierMax(humanFrontier));
    }

    // 3. Player station conquest
    await this.conquestEngine.tick().catch((err) =>
      logger.error({ err }, 'ConquestEngine tick error'),
    );

    // 4. Void civilization lifecycle
    await this.voidLifecycle.tick();

    // 5. Cleanup expired quest items (prisoner, data_slate)
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
    defenderQ: QuadrantControlRow,
    attackerQ: QuadrantControlRow,
    attackerFaction: string,
  ): Promise<void> {
    const result = resolveStrategicTick({
      attack: attackerQ.attack_value,
      defense: defenderQ.defense_value,
    });
    const defenderFaction = defenderQ.controlling_faction;

    if (result.conquest) {
      await upsertQuadrantControl({
        qx: defenderQ.qx,
        qy: defenderQ.qy,
        controlling_faction: attackerFaction,
        faction_shares: { [attackerFaction]: 100 },
        attack_value: 0,
        defense_value: calculateBaseDefense(defenderQ.station_tier, 200),
        friction_score: 0,
        station_tier: defenderQ.station_tier,
      });
      await logExpansionEvent(attackerFaction, defenderQ.qx, defenderQ.qy, 'conquered');
      await logExpansionEvent(defenderFaction, defenderQ.qx, defenderQ.qy, 'lost');
      const msg = `${attackerFaction.toUpperCase()} eroberten Quadrant [${defenderQ.qx}/${defenderQ.qy}] von ${defenderFaction.toUpperCase()}`;
      logger.warn({ attackerFaction, defenderFaction, qx: defenderQ.qx, qy: defenderQ.qy }, msg);
      await this.pushWarTickerEvent(msg);
    } else if (result.invasionRepelled) {
      const msg = `${defenderFaction.toUpperCase()} hielt Quadrant [${defenderQ.qx}/${defenderQ.qy}] gegen ${attackerFaction.toUpperCase()}`;
      logger.info({ attackerFaction, defenderFaction, qx: defenderQ.qx, qy: defenderQ.qy }, msg);
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
    frontierMax: number,
  ): Promise<void> {
    const factions = this.factionConfig.getActiveFactions().filter((f) => f.faction_id !== 'humans');

    for (const faction of factions) {
      const target = getExpansionTarget(
        faction.faction_id,
        allControls,
        faction.expansion_style as 'sphere' | 'wave' | 'jumpgate',
        frontierMax,
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
    const ts = Date.now();
    await this.redis.lpush('war_ticker', JSON.stringify({ message, ts }));
    await this.redis.ltrim('war_ticker', 0, 9);
    // Push live to connected players (QW2) — rooms subscribe and broadcast.
    warBus.broadcast({ message, ts });
  }
}
