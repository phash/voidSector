import type { Client } from 'colyseus';
import {
  TUTORIAL_MINE_ORE_TARGET,
  TUTORIAL_REWARD_CREDITS,
  TUTORIAL_REWARD_WISSEN,
  TUTORIAL_TOTAL_STEPS,
} from '@void-sector/shared';
import type { ServiceContext } from './ServiceContext.js';
import {
  applyTutorialEvent,
  type TutorialEngineState,
  type TutorialEvent,
} from '../../engine/tutorialEngine.js';
import { awardWissenAndNotify } from '../../engine/wissenService.js';
import { logger } from '../../utils/logger.js';
import {
  addCredits,
  createTutorialProgress,
  getPlayerCredits,
  getTutorialProgress,
  saveTutorialProgress,
} from '../../db/queries.js';

/**
 * Tutorial-Kette für Neuspieler: BEWEGEN → SCANNEN → MINEN → LIEFERN.
 * Fortschritt wird aus bestehenden Aktionen erkannt (Hooks via ServiceContext).
 * Bestandsspieler ohne tutorial_progress-Row werden gecached und erzeugen
 * keinen DB-Hit pro Aktion.
 */
export class TutorialService {
  private cache = new Map<string, TutorialEngineState | 'inactive'>();

  constructor(private ctx: ServiceContext) {}

  async initOnJoin(client: Client, playerId: string, isNewPlayer: boolean): Promise<void> {
    try {
      if (isNewPlayer) await createTutorialProgress(playerId);
      const row = await getTutorialProgress(playerId);
      if (!row || row.completed_at) {
        this.cache.set(playerId, 'inactive');
        return;
      }
      const state: TutorialEngineState = { step: row.step, oreMined: row.ore_mined, done: false };
      this.cache.set(playerId, state);
      this.sendState(client, state);
    } catch (err) {
      logger.error({ err, playerId }, 'tutorial init failed');
    }
  }

  onLeave(playerId: string): void {
    this.cache.delete(playerId);
  }

  async onMove(client: Client, playerId: string): Promise<void> {
    await this.handleEvent(client, playerId, { type: 'move' });
  }

  async onScan(client: Client, playerId: string): Promise<void> {
    await this.handleEvent(client, playerId, { type: 'scan' });
  }

  async onMined(client: Client, playerId: string, resource: string, amount: number): Promise<void> {
    await this.handleEvent(client, playerId, { type: 'mine', resource, amount });
  }

  async onStarterBounty(client: Client, playerId: string): Promise<void> {
    await this.handleEvent(client, playerId, { type: 'starter_bounty' });
  }

  private sendState(client: Client, s: TutorialEngineState): void {
    this.ctx.send(client, 'tutorialUpdate', {
      step: s.step,
      total: TUTORIAL_TOTAL_STEPS,
      oreMined: s.oreMined,
      oreTarget: TUTORIAL_MINE_ORE_TARGET,
      done: s.done,
    });
  }

  private async loadState(playerId: string): Promise<TutorialEngineState | 'inactive'> {
    const cached = this.cache.get(playerId);
    if (cached) return cached;
    const row = await getTutorialProgress(playerId);
    if (!row || row.completed_at) {
      this.cache.set(playerId, 'inactive');
      return 'inactive';
    }
    const state: TutorialEngineState = { step: row.step, oreMined: row.ore_mined, done: false };
    this.cache.set(playerId, state);
    return state;
  }

  private async handleEvent(client: Client, playerId: string, event: TutorialEvent): Promise<void> {
    try {
      const state = await this.loadState(playerId);
      if (state === 'inactive') return;
      const result = applyTutorialEvent(state, event);
      if (!result.changed) return;
      this.cache.set(playerId, result.state);
      await saveTutorialProgress(playerId, result.state.step, result.state.oreMined, result.state.done);
      if (result.completed) {
        this.cache.set(playerId, 'inactive');
        await addCredits(playerId, TUTORIAL_REWARD_CREDITS);
        awardWissenAndNotify(client, playerId, TUTORIAL_REWARD_WISSEN);
        this.ctx.send(client, 'creditsUpdate', { credits: await getPlayerCredits(playerId) });
        this.ctx.send(client, 'tutorialComplete', {
          rewardCredits: TUTORIAL_REWARD_CREDITS,
          rewardWissen: TUTORIAL_REWARD_WISSEN,
        });
        this.ctx.send(
          client,
          'logEntry',
          `TUTORIAL ABGESCHLOSSEN — ${TUTORIAL_REWARD_CREDITS} CR + ${TUTORIAL_REWARD_WISSEN} Wissen erhalten. Gute Reise, Pilot!`,
        );
      } else {
        this.sendState(client, result.state);
      }
    } catch (err) {
      logger.error({ err, playerId, event: event.type }, 'tutorial event failed');
    }
  }
}
