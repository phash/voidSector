import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { CombatV3State, NpcCombatStats, ShipModule } from '@void-sector/shared';
import { MODULE_MAP } from '@void-sector/shared';
import { logger } from '../../utils/logger.js';
import { rejectGuest } from './utils.js';
import {
  initCombatV3,
  validateEnergyBudget,
  resolveRoundV3,
  attemptFleeV3,
  buildCombatModules,
} from '../../engine/combatV3Engine.js';
import { generateNpcCombatStats } from '../../engine/npcCombatStats.js';
import { getActiveShip, updateShipModules, addCredits } from '../../db/queries.js';
import { markCivShipDead } from '../../db/civQueries.js';
import { getCargoState, removeFromInventory } from '../../engine/inventoryService.js';

/** How long a defeated outlaw NPC stays destroyed before respawning. */
const OUTLAW_RESPAWN_MS = 30 * 60 * 1000;
/** Fraction of each resource lost on combat defeat. */
const DEFEAT_CARGO_LOSS = 0.25;
/** Module HP fraction retained after a combat defeat. */
const DEFEAT_MODULE_HP = 0.5;

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

    const npcStats = generateNpcCombatStats(data.npcLevel);

    // Build the player's combat loadout from the modules installed on the active ship.
    const ship = await getActiveShip(auth.userId);
    const playerModules = buildCombatModules(ship?.modules ?? []);

    if (playerModules.length === 0) {
      client.send('error', {
        code: 'NO_MODULES',
        message: 'Kein kampftaugliches Modul installiert — rüste dein Schiff aus (ACEP → Module).',
      });
      return;
    }

    // Apply faction/ACEP combat bonus (#528 combat_plating, ACEP kampf) to weapon attack.
    const bonuses = await this.ctx.getPlayerBonuses(auth.userId);
    if (bonuses.combatMultiplier && bonuses.combatMultiplier !== 1) {
      for (const m of playerModules) {
        if (m.category.startsWith('weapon') && typeof m.stats.atk === 'number') {
          m.stats = { ...m.stats, atk: Math.round(m.stats.atk * bonuses.combatMultiplier) };
        }
      }
    }

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
      const lootCredits = 50 + session.npcStats.armorHp;
      try {
        await addCredits(auth.userId, lootCredits);
        // Destroy a defeated outlaw NPC ship (revived later by resetDeadOutlaws).
        if (session.npcId != null) {
          await markCivShipDead(session.npcId, new Date(Date.now() + OUTLAW_RESPAWN_MS));
        }
      } catch (err) {
        logger.error({ err, userId: auth.userId }, 'combatV3 victory reward failed');
      }
      client.send('combatV3End', { outcome, lootCredits });
      client.send('logEntry', `SIEG! +${lootCredits} Credits`);
    } else if (outcome === 'defeat') {
      try {
        await this.applyDefeatPenalty(auth.userId);
      } catch (err) {
        logger.error({ err, userId: auth.userId }, 'combatV3 defeat penalty failed');
      }
      client.send('combatV3End', { outcome });
      client.send('logEntry', 'NIEDERLAGE — Module beschädigt, Cargo verloren');
    } else if (outcome === 'draw') {
      client.send('combatV3End', { outcome });
      client.send('logEntry', 'UNENTSCHIEDEN — Gegner zieht sich zurück');
    }
  }

  /** Defeat penalty: every installed module drops to 50% HP and a quarter of each resource is lost. */
  private async applyDefeatPenalty(userId: string): Promise<void> {
    const ship = await getActiveShip(userId);
    if (ship) {
      const damaged: ShipModule[] = ship.modules.map((m) => {
        const def = MODULE_MAP.get(m.moduleId);
        const maxHp = def?.hitpoints ?? m.currentHp ?? 0;
        return { ...m, currentHp: Math.floor(maxHp * DEFEAT_MODULE_HP) };
      });
      await updateShipModules(ship.id, damaged);
    }

    const cargo = await getCargoState(userId);
    for (const resource of ['ore', 'gas', 'crystal'] as const) {
      const lost = Math.floor((cargo[resource] ?? 0) * DEFEAT_CARGO_LOSS);
      if (lost > 0) {
        await removeFromInventory(userId, 'resource', resource, lost);
      }
    }
  }
}
