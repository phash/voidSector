import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { CombatV3State, CombatModule, NpcCombatStats } from '@void-sector/shared';
import { logger } from '../../utils/logger.js';
import { rejectGuest } from './utils.js';
import { initCombatV3, validateEnergyBudget, resolveRoundV3, attemptFleeV3 } from '../../engine/combatV3Engine.js';
import { generateNpcCombatStats } from '../../engine/npcCombatStats.js';

export class CombatV3Service {
  private sessions = new Map<string, { state: CombatV3State; npcStats: NpcCombatStats; npcId?: number }>();

  constructor(private ctx: ServiceContext) {}

  async handleCombatV3Start(client: Client, data: { npcLevel: number; npcId?: number }): Promise<void> {
    if (rejectGuest(client, 'Kampf')) return;
    const auth = client.auth as AuthPayload;

    if (this.sessions.has(auth.userId)) {
      client.send('error', { code: 'COMBAT_ACTIVE', message: 'Bereits im Kampf' });
      return;
    }

    // TODO: Load player modules from DB (player_modules_v2)
    // For now, create mock modules from ship stats
    const npcStats = generateNpcCombatStats(data.npcLevel);

    // Placeholder: build CombatModule[] from player's installed modules
    // This will be wired to the DB in the integration task
    const playerModules: CombatModule[] = []; // TODO: load from DB

    const state = initCombatV3(playerModules, npcStats);
    this.sessions.set(auth.userId, { state, npcStats, npcId: data.npcId });

    client.send('combatV3Start', { state });
    client.send('logEntry', `KAMPF BEGINNT — Gegner Level ${data.npcLevel}`);
  }

  async handleCombatV3Action(
    client: Client,
    data: { activeModules: string[]; tactic: 'assault' | 'balanced' | 'defensive' },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    const session = this.sessions.get(auth.userId);
    if (!session) {
      client.send('error', { code: 'NO_COMBAT', message: 'Kein aktiver Kampf' });
      return;
    }

    // Validate energy
    const validation = validateEnergyBudget(session.state, data.activeModules);
    if (!validation.valid) {
      client.send('error', { code: 'ENERGY_EXCEEDED', message: validation.error ?? 'Energy-Budget überschritten' });
      return;
    }

    const seed = Date.now() ^ (auth.userId.charCodeAt(0) * 31 + session.state.round);
    const { newState, roundResult } = resolveRoundV3(session.state, {
      activeModules: data.activeModules,
      tactic: data.tactic,
    }, seed);

    session.state = newState;

    client.send('combatV3Round', { state: newState, roundResult });

    if (newState.outcome) {
      await this.endCombat(client, auth, session, newState.outcome);
    }
  }

  async handleCombatV3Flee(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const session = this.sessions.get(auth.userId);
    if (!session) {
      client.send('error', { code: 'NO_COMBAT', message: 'Kein aktiver Kampf' });
      return;
    }

    const seed = Date.now() ^ auth.userId.charCodeAt(0);
    const { success, newState, log } = attemptFleeV3(session.state, seed);

    session.state = newState;

    if (success) {
      client.send('combatV3End', { outcome: 'fled', log });
      this.sessions.delete(auth.userId);
    } else {
      client.send('combatV3Round', {
        state: newState,
        roundResult: {
          round: newState.round,
          roundLog: [log],
          playerDamageDealt: 0,
          enemyDamageDealt: 0,
          playerShield: newState.playerShield,
          enemyShield: newState.enemyShield,
          playerArmorHp: newState.playerArmorHp,
          enemyArmorHp: newState.enemyArmorHp ?? 0,
          modulesDestroyed: [],
        },
      });
      if (newState.outcome) {
        await this.endCombat(client, auth, session, newState.outcome);
      }
    }
  }

  private async endCombat(
    client: Client,
    auth: AuthPayload,
    session: { state: CombatV3State; npcStats: NpcCombatStats; npcId?: number },
    outcome: string,
  ): Promise<void> {
    this.sessions.delete(auth.userId);

    if (outcome === 'victory') {
      // TODO: Generate loot, add credits, handle NPC death (outlaw dead_until)
      const lootCredits = 50 + session.npcStats.armorHp;
      client.send('combatV3End', { outcome, lootCredits });
      client.send('logEntry', `SIEG! +${lootCredits} Credits`);
    } else if (outcome === 'defeat') {
      // TODO: Set all modules to 50% HP in DB, lose cargo
      client.send('combatV3End', { outcome });
      client.send('logEntry', 'NIEDERLAGE — Module beschädigt, Cargo verloren');
    } else if (outcome === 'draw') {
      client.send('combatV3End', { outcome });
      client.send('logEntry', 'UNENTSCHIEDEN — Gegner zieht sich zurück');
    }
  }
}
