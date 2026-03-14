import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { CombatState, RoundInput, EnemyModule } from '../../engine/combatTypes.js';
import type {
  CombatV2State,
  CombatTactic,
  SpecialAction,
  PirateEncounter,
  BattleOutcome,
  BattleResult,
  ShipStats,
} from '@void-sector/shared';

import { addAcepXpForPlayer, getAcepXpSummary } from '../../engine/acepXpService.js';
import { getAcepEffects } from '../../engine/acepXpService.js';
import { awardWissenAndNotify } from '../../engine/wissenService.js';
import { calculateTraits } from '../../engine/traitCalculator.js';
import { getPersonalityComment } from '../../engine/personalityMessages.js';
import { destroyShipAndCreateLegacy, ejectPod } from '../../engine/permadeathService.js';
import {
  initCombat,
  calculateAvailableEp,
  calculateEpCost,
  resolveRound,
} from '../../engine/combatEngine.js';
import { initCombatV2, resolveRoundV2, attemptFleeV2 } from '../../engine/combatV2Engine.js';
import { rejectGuest } from './utils.js';
import { getAPState, saveAPState } from './RedisAPStore.js';
import { calculateCurrentAP } from '../../engine/ap.js';
import {
  getCargoState,
  addToInventory,
  removeFromInventory,
} from '../../engine/inventoryService.js';
import {
  getPlayerCredits,
  addCredits,
  deductCredits,
  insertCombatLog,
  getPlayerStructuresInSector,
  installStationDefense,
  getStructureHp,
  updateStructureHp,
  getActiveShip,
  updateShipModules,
} from '../../db/queries.js';
import {
  STATION_DEFENSE_DEFS,
  STATION_REPAIR_CR_PER_HP,
  STATION_REPAIR_ORE_PER_HP,
  calculateShipStats,
  MODULE_HP_BY_TIER,
} from '@void-sector/shared';
import { logger } from '../../utils/logger.js';

// ─── In-memory combat session store ──────────────────────────────────────────

/** Active Kampfsystem-v1 combat sessions, keyed by playerId */
const activeCombatSessions = new Map<string, CombatState>();

/** Active Combat V2 sessions, keyed by playerId */
const activeCombatV2Sessions = new Map<string, { state: CombatV2State; shipStats: ShipStats }>();

// ─── CombatService ────────────────────────────────────────────────────────────

export class CombatService {
  constructor(private ctx: ServiceContext) {}

  // ══════════════════════════════════════════════════════════════════════════
  // Kampfsystem v1 — new energy-based round combat
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `combatInit` — start a new combat encounter.
   * Called from scan events (pirate ambush) or sector entry.
   */
  async handleCombatInit(
    client: Client,
    data: { enemyType: string; enemyLevel: number; sectorX: number; sectorY: number },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    const playerId = auth.userId;

    // Check rate limit
    if (!this.ctx.checkRate(client.sessionId, 'combatInit', 2000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }

    // Load ship from DB
    const ship = await getActiveShip(playerId);
    if (!ship) {
      client.send('combatInitResult', { success: false, error: 'No active ship found' });
      return;
    }

    // Derive player HP from ship stats
    const shipStats = calculateShipStats(ship.modules);
    const playerMaxHp = shipStats.hp;
    const playerHp = playerMaxHp; // start at full HP per encounter

    // Build enemy modules
    const enemyModules = this.generateEnemyModules(data.enemyType, data.enemyLevel);
    const enemyMaxHp = data.enemyLevel * 50;

    // Initialise combat state
    const state = initCombat({
      playerId,
      playerHp,
      playerMaxHp,
      playerModules: ship.modules,
      enemyType: data.enemyType,
      enemyLevel: data.enemyLevel,
      enemyHp: enemyMaxHp,
      enemyMaxHp,
      enemyModules,
    });

    // EXPLORER L5 passive: auto-reveal all enemy modules on init
    let explorerReveal = false;
    try {
      const acepXp = await getAcepXpSummary(ship.id);
      const effects = getAcepEffects(acepXp);
      // explorer >= 50 == L5 (ACEP_PATH_CAP)
      if (effects.helionDecoderEnabled || acepXp.explorer >= 50) {
        for (const mod of state.enemyModules) {
          mod.revealed = true;
        }
        explorerReveal = true;
      }
    } catch {
      // Non-fatal — ACEP unavailable
    }

    // Store session
    activeCombatSessions.set(playerId, state);

    logger.info(
      { playerId, enemyType: data.enemyType, enemyLevel: data.enemyLevel },
      'combatInit: session started',
    );

    client.send('combatInitResult', {
      success: true,
      state,
      explorerReveal,
    });

    if (explorerReveal) {
      client.send('logEntry', 'EXPLORER PASSIVE: Feind-Module vollständig aufgedeckt.');
    }
    client.send('logEntry', `KAMPF BEGONNEN: ${data.enemyType} (Stufe ${data.enemyLevel})`);
  }

  /**
   * `combatRound` — submit inputs for one round and get the result.
   */
  async handleCombatRound(
    client: Client,
    data: {
      input: RoundInput;
      sectorX: number;
      sectorY: number;
    },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    const playerId = auth.userId;

    const state = activeCombatSessions.get(playerId);
    if (!state) {
      client.send('combatRoundResult', { success: false, error: 'No active combat session' });
      return;
    }

    const input: RoundInput = data.input;

    // Validate EP
    const availableEp = calculateAvailableEp(state);
    const epCost = calculateEpCost(input.energyAllocations);
    if (epCost > availableEp) {
      client.send('combatRoundResult', {
        success: false,
        error: `Nicht genug EP (verfügbar: ${availableEp.toFixed(1)}, benötigt: ${epCost})`,
      });
      return;
    }

    // Resolve round
    const result = resolveRound(state, input);
    activeCombatSessions.set(playerId, result.newState);

    if (result.outcome !== 'ongoing') {
      // Combat ended — finalize
      await this.finalizeCombat(
        client,
        auth,
        result.newState,
        result.outcome,
        { sectorX: data.sectorX, sectorY: data.sectorY },
        result.moduleDamageEvents,
      );
      return;
    }

    client.send('combatRoundResult', {
      success: true,
      round: result,
      state: result.newState,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Kampfsystem v2 — tactic-based round combat
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `combatV2Start` — initialize a new v2 combat encounter.
   * Called from pirate-zone sector entry or scan events.
   */
  async handleCombatV2Start(
    client: Client,
    encounter: PirateEncounter,
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    const playerId = auth.userId;

    // Load ship from DB
    const ship = await getActiveShip(playerId);
    if (!ship) {
      client.send('combatV2Started', { success: false, error: 'No active ship found' });
      return;
    }

    // Derive ship stats
    const shipStats = calculateShipStats(ship.modules);

    // Initialize combat v2 state
    const state = initCombatV2(encounter, shipStats);

    // Store session
    activeCombatV2Sessions.set(playerId, { state, shipStats });

    logger.info(
      { playerId, pirateLevel: encounter.pirateLevel },
      'combatV2Start: session started',
    );

    client.send('combatV2Started', { success: true, state });
    client.send('logEntry', `KAMPF BEGONNEN: Pirat Stufe ${encounter.pirateLevel}`);
  }

  /**
   * `combatV2Action` — submit tactic + special action for one round.
   */
  async handleCombatV2Action(
    client: Client,
    data: { tactic: CombatTactic; specialAction: SpecialAction; sectorX: number; sectorY: number },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    const playerId = auth.userId;

    const session = activeCombatV2Sessions.get(playerId);
    if (!session) {
      client.send('combatV2RoundResult', { success: false, error: 'No active combat session' });
      return;
    }
    if (session.state.status !== 'active') {
      client.send('combatV2RoundResult', { success: false, error: 'Combat already ended' });
      return;
    }

    // Resolve round
    const seed = Date.now();
    const { round, newState } = resolveRoundV2(
      session.state,
      data.tactic,
      data.specialAction,
      session.shipStats,
      seed,
    );

    // Update session
    session.state = newState;
    activeCombatV2Sessions.set(playerId, session);

    // Check if combat ended
    let finalResult: BattleResult | undefined;
    if (newState.status !== 'active') {
      finalResult = await this.finalizeCombatV2(
        client,
        auth,
        newState,
        { sectorX: data.sectorX, sectorY: data.sectorY },
      );
    }

    client.send('combatV2RoundResult', {
      success: true,
      round,
      state: newState,
      finalResult,
    });
  }

  /**
   * `combatV2Flee` — attempt to flee from v2 combat. Costs 2 AP.
   */
  async handleCombatV2Flee(
    client: Client,
    data: { sectorX: number; sectorY: number },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    const playerId = auth.userId;

    const session = activeCombatV2Sessions.get(playerId);
    if (!session) {
      client.send('combatV2RoundResult', { success: false, error: 'No active combat session' });
      return;
    }
    if (session.state.status !== 'active') {
      client.send('combatV2RoundResult', { success: false, error: 'Combat already ended' });
      return;
    }

    // Check AP (flee costs 2 AP)
    const apState = await getAPState(playerId);
    const currentAp = calculateCurrentAP(apState, Date.now());
    if (currentAp.current < 2) {
      client.send('combatV2RoundResult', {
        success: false,
        error: 'Nicht genug AP für Flucht (2 AP benötigt)',
      });
      return;
    }

    // Deduct AP
    const updatedAp = { ...currentAp, current: currentAp.current - 2 };
    await saveAPState(playerId, updatedAp);
    client.send('apUpdate', updatedAp);

    // Attempt flee
    const seed = Date.now();
    const fleeResult = attemptFleeV2(session.state, seed);

    if (fleeResult.success) {
      // Fled successfully — delete session, finalize
      activeCombatV2Sessions.delete(playerId);

      // Write combat log
      try {
        await insertCombatLog({
          playerId,
          quadrantX: this.ctx.quadrantX,
          quadrantY: this.ctx.quadrantY,
          sectorX: data.sectorX,
          sectorY: data.sectorY,
          enemyType: `pirate_lv${session.state.encounter.pirateLevel}`,
          enemyLevel: session.state.encounter.pirateLevel,
          outcome: 'fled',
          rounds: session.state.currentRound,
          playerHpEnd: session.state.playerHp,
          modulesDamaged: [],
          loot: {},
        });
      } catch (err) {
        logger.warn({ err }, 'combatLog insert failed (flee)');
      }

      client.send('combatV2RoundResult', {
        success: true,
        state: fleeResult.newState,
        finalResult: { outcome: 'escaped' as BattleOutcome },
      });
      client.send('logEntry', 'FLUCHT ERFOLGREICH — Kampf abgebrochen.');
    } else {
      // Flee failed — update session state, combat continues
      session.state = fleeResult.newState;
      activeCombatV2Sessions.set(playerId, session);

      client.send('combatV2RoundResult', {
        success: true,
        state: fleeResult.newState,
        fleeAttemptFailed: true,
      });
      client.send('logEntry', 'FLUCHT FEHLGESCHLAGEN — Kampf geht weiter.');
    }
  }

  /**
   * Finalize a combat v2: award loot on victory, handle permadeath on defeat, write combat_log.
   */
  private async finalizeCombatV2(
    client: Client,
    auth: AuthPayload,
    state: CombatV2State,
    position: { sectorX: number; sectorY: number },
  ): Promise<BattleResult> {
    const playerId = auth.userId;

    // Remove session
    activeCombatV2Sessions.delete(playerId);

    // Map status to outcome
    const outcomeMap: Record<string, BattleOutcome> = {
      victory: 'victory',
      defeat: 'defeat',
      escaped: 'escaped',
      auto_flee: 'escaped',
    };
    const outcome: BattleOutcome = outcomeMap[state.status] ?? 'escaped';
    let loot: { credits?: number; ore?: number; crystal?: number } = {};

    if (outcome === 'victory') {
      loot = this.generateLoot(state.encounter.pirateLevel);

      if (loot.credits) {
        await addCredits(playerId, loot.credits);
        client.send('creditsUpdate', { credits: await getPlayerCredits(playerId) });
      }
      if (loot.ore && loot.ore > 0) {
        await addToInventory(playerId, 'resource', 'ore', loot.ore);
      }
      if (loot.crystal && loot.crystal > 0) {
        await addToInventory(playerId, 'resource', 'crystal', loot.crystal);
      }
      if ((loot.ore ?? 0) > 0 || (loot.crystal ?? 0) > 0) {
        client.send('cargoUpdate', await getCargoState(playerId));
      }

      // Quest + ACEP XP
      await this.ctx.checkQuestProgress(client, playerId, 'battle_won', {
        sectorX: position.sectorX,
        sectorY: position.sectorY,
      });
      addAcepXpForPlayer(playerId, 'kampf', 10).catch(() => {});
      this._emitPersonalityComment(client, playerId, 'combat_victory').catch(() => {});

      const npcWissen = Math.min(8, Math.max(3, Math.ceil(state.encounter.pirateLevel / 2)));
      awardWissenAndNotify(client, playerId, npcWissen);

      client.send('logEntry', `SIEG! Pirat Stufe ${state.encounter.pirateLevel} besiegt. +${loot.credits ?? 0} CR`);
    } else if (outcome === 'defeat') {
      this._emitPersonalityComment(client, playerId, 'combat_defeat').catch(() => {});
      await this._handlePermadeath(client, auth, position.sectorX, position.sectorY);
      client.send('logEntry', 'NIEDERLAGE. Schiff zerstört.');
    } else {
      // auto_flee
      client.send('logEntry', 'AUTO-FLUCHT — Maximale Rundenanzahl erreicht.');
    }

    // Write combat log
    try {
      await insertCombatLog({
        playerId,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        sectorX: position.sectorX,
        sectorY: position.sectorY,
        enemyType: `pirate_lv${state.encounter.pirateLevel}`,
        enemyLevel: state.encounter.pirateLevel,
        outcome,
        rounds: state.currentRound,
        playerHpEnd: state.playerHp,
        modulesDamaged: [],
        loot,
      });
    } catch (err) {
      logger.warn({ err }, 'combatLog insert failed (v2)');
    }

    return {
      outcome,
      lootCredits: loot.credits,
      lootResources: {
        ore: loot.ore,
        crystal: loot.crystal,
      },
    };
  }

  /**
   * Finalise a combat: persist module HP, award/punish loot, write combat_log, notify client.
   */
  private async finalizeCombat(
    client: Client,
    auth: AuthPayload,
    state: CombatState,
    outcome: 'victory' | 'defeat' | 'fled' | 'draw' | 'ejected',
    position: { sectorX: number; sectorY: number },
    moduleDamageEvents: Array<{ moduleId: string; category: string; hpBefore: number; hpAfter: number }>,
  ): Promise<void> {
    const playerId = auth.userId;

    // Remove session
    activeCombatSessions.delete(playerId);

    // Persist updated module HP to DB
    const ship = await getActiveShip(playerId);
    let loot: { credits?: number; ore?: number; crystal?: number } = {};

    if (ship) {
      // Merge currentHp from combat state back into ship modules
      const updatedModules = ship.modules.map((m) => {
        const combatMod = state.playerModules.find((pm) => pm.moduleId === m.moduleId);
        if (combatMod && combatMod.currentHp !== undefined) {
          return { ...m, currentHp: combatMod.currentHp };
        }
        return m;
      });
      await updateShipModules(ship.id, updatedModules);

      // Update ctx ship cache
      const stats = calculateShipStats(updatedModules);
      this.ctx.clientShips.set(client.sessionId, stats);
    }

    // ── Outcome effects ──────────────────────────────────────────────────
    if (outcome === 'victory') {
      loot = this.generateLoot(state.enemyLevel);
      if (loot.credits) {
        await addCredits(playerId, loot.credits);
        client.send('creditsUpdate', { credits: await getPlayerCredits(playerId) });
      }
      if (loot.ore && loot.ore > 0) {
        await addToInventory(playerId, 'resource', 'ore', loot.ore);
      }
      if (loot.crystal && loot.crystal > 0) {
        await addToInventory(playerId, 'resource', 'crystal', loot.crystal);
      }
      if ((loot.ore ?? 0) > 0 || (loot.crystal ?? 0) > 0) {
        client.send('cargoUpdate', await getCargoState(playerId));
      }

      // Quest + ACEP XP
      await this.ctx.checkQuestProgress(client, playerId, 'battle_won', {
        sectorX: position.sectorX,
        sectorY: position.sectorY,
      });
      addAcepXpForPlayer(playerId, 'kampf', 10).catch(() => {});
      this._emitPersonalityComment(client, playerId, 'combat_victory').catch(() => {});
      const npcWissen = Math.min(8, Math.max(3, Math.ceil(state.enemyLevel / 2)));
      awardWissenAndNotify(client, playerId, npcWissen);  // +3-8 depending on enemy strength

      client.send('logEntry', `SIEG! ${state.enemyType} besiegt. +${loot.credits ?? 0} CR`);
    } else if (outcome === 'defeat') {
      this._emitPersonalityComment(client, playerId, 'combat_defeat').catch(() => {});
      await this._handlePermadeath(client, auth, position.sectorX, position.sectorY);
      client.send('logEntry', 'NIEDERLAGE. Schiff beschädigt.');
    } else if (outcome === 'ejected') {
      // Emergency eject: clear all cargo
      await ejectPod(playerId);
      client.send('cargoUpdate', await getCargoState(playerId));
      client.send('logEntry', 'NOTAUSSTIEG — Kapsel ausgestoßen. Gesamte Ladung verloren.');
    } else if (outcome === 'fled') {
      client.send('logEntry', 'FLUCHT ERFOLGREICH. Kampf abgebrochen.');
    } else if (outcome === 'draw') {
      client.send('logEntry', 'UNENTSCHIEDEN. Maximale Rundenanzahl erreicht.');
    }

    // ── Write combat_log ─────────────────────────────────────────────────
    try {
      await insertCombatLog({
        playerId,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        sectorX: position.sectorX,
        sectorY: position.sectorY,
        enemyType: state.enemyType,
        enemyLevel: state.enemyLevel,
        outcome,
        rounds: state.round - 1,
        playerHpEnd: state.playerHp,
        modulesDamaged: moduleDamageEvents.map((e) => ({
          moduleId: e.moduleId,
          hpBefore: e.hpBefore,
          hpAfter: e.hpAfter,
        })),
        loot,
      });
    } catch (err) {
      logger.warn({ err }, 'combatLog insert failed');
    }

    // ── Send final result to client ──────────────────────────────────────
    client.send('combatRoundResult', {
      success: true,
      outcome,
      state,
      loot,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Enemy module generation
  // ══════════════════════════════════════════════════════════════════════════

  generateEnemyModules(enemyType: string, enemyLevel: number): EnemyModule[] {
    const tier = Math.min(5, Math.ceil(enemyLevel / 2));
    const maxHp = MODULE_HP_BY_TIER[tier as keyof typeof MODULE_HP_BY_TIER] ?? 20;
    const modules: EnemyModule[] = [];

    // All enemies have weapon + drive
    modules.push({ category: 'weapon', tier, currentHp: maxHp, maxHp, powerLevel: 'high', revealed: false });
    modules.push({ category: 'drive', tier, currentHp: maxHp, maxHp, powerLevel: 'high', revealed: false });

    // Level 2+ get shield
    if (enemyLevel >= 2) {
      modules.push({ category: 'shield', tier, currentHp: maxHp, maxHp, powerLevel: 'high', revealed: false });
    }

    // Level 4+ get generator
    if (enemyLevel >= 4) {
      modules.push({ category: 'generator', tier, currentHp: maxHp, maxHp, powerLevel: 'high', revealed: false });
    }

    return modules;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Loot generation
  // ══════════════════════════════════════════════════════════════════════════

  private generateLoot(enemyLevel: number): { credits: number; ore?: number; crystal?: number } {
    const base = enemyLevel * 50;
    return {
      credits: base + Math.floor(Math.random() * base),
      ore: enemyLevel >= 2 ? Math.floor(Math.random() * 5 * enemyLevel) : undefined,
      crystal: enemyLevel >= 4 ? Math.floor(Math.random() * 2 * enemyLevel) : undefined,
    };
  }

  async handleInstallDefense(client: Client, data: { defenseType: string }): Promise<void> {
    if (rejectGuest(client, 'Verteidigung bauen')) return;
    if (!this.ctx.checkRate(client.sessionId, 'build', 2000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const def = STATION_DEFENSE_DEFS[data.defenseType];
    if (!def) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Unknown defense type' });
      return;
    }

    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);
    const structures = await getPlayerStructuresInSector(auth.userId, sectorX, sectorY);
    const hasBase = structures.some((s) => s.type === 'base');
    if (!hasBase) {
      client.send('installDefenseResult', {
        success: false,
        error: 'Keine Basis in diesem Sektor',
      });
      return;
    }

    const credits = await getPlayerCredits(auth.userId);
    if (credits < def.cost.credits) {
      client.send('installDefenseResult', { success: false, error: 'Nicht genug Credits' });
      return;
    }
    const cargo = await getCargoState(auth.userId);
    for (const [resource, amount] of Object.entries(def.cost)) {
      if (resource === 'credits') continue;
      if ((cargo[resource as keyof typeof cargo] ?? 0) < (amount ?? 0)) {
        client.send('installDefenseResult', { success: false, error: `Nicht genug ${resource}` });
        return;
      }
    }

    // Deduct resources
    await deductCredits(auth.userId, def.cost.credits);
    for (const [resource, amount] of Object.entries(def.cost)) {
      if (resource === 'credits' || !amount) continue;
      await removeFromInventory(auth.userId, 'resource', resource, amount);
    }

    try {
      const result = await installStationDefense(auth.userId, sectorX, sectorY, data.defenseType);
      client.send('installDefenseResult', {
        success: true,
        defenseType: data.defenseType,
        id: result.id,
      });
      const updatedCargo = await getCargoState(auth.userId);
      client.send('cargoUpdate', updatedCargo);
      client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    } catch (err: any) {
      if (err.code === '23505') {
        client.send('installDefenseResult', {
          success: false,
          error: 'Verteidigung bereits installiert',
        });
        return;
      }
      client.send('installDefenseResult', { success: false, error: 'Installation fehlgeschlagen' });
    }
  }

  async handleRepairStation(
    client: Client,
    data: { sectorX: number; sectorY: number },
  ): Promise<void> {
    if (rejectGuest(client, 'Reparieren')) return;
    const auth = client.auth as AuthPayload;

    const hp = await getStructureHp(auth.userId, data.sectorX, data.sectorY);
    if (!hp) {
      client.send('repairResult', { success: false, error: 'Keine Basis gefunden' });
      return;
    }
    if (hp.currentHp >= hp.maxHp) {
      client.send('repairResult', { success: false, error: 'Basis ist nicht beschädigt' });
      return;
    }

    const hpToRepair = hp.maxHp - hp.currentHp;
    const costCredits = hpToRepair * STATION_REPAIR_CR_PER_HP;
    const costOre = hpToRepair * STATION_REPAIR_ORE_PER_HP;

    const credits = await getPlayerCredits(auth.userId);
    if (credits < costCredits) {
      client.send('repairResult', {
        success: false,
        error: `Kosten: ${costCredits} CR, ${costOre} Erz — nicht genug Credits`,
      });
      return;
    }
    const cargo = await getCargoState(auth.userId);
    if ((cargo.ore ?? 0) < costOre) {
      client.send('repairResult', {
        success: false,
        error: `Kosten: ${costCredits} CR, ${costOre} Erz — nicht genug Erz`,
      });
      return;
    }

    await deductCredits(auth.userId, costCredits);
    await removeFromInventory(auth.userId, 'resource', 'ore', costOre);
    await updateStructureHp(auth.userId, data.sectorX, data.sectorY, hp.maxHp);

    client.send('repairResult', { success: true, newHp: hp.maxHp, maxHp: hp.maxHp });
    const updatedCargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
  }

  /** Emergency pod eject — only valid during an active combat session when HP < 15. */
  async handleEjectPod(client: Client, data: { sectorX: number; sectorY: number }): Promise<void> {
    const auth = client.auth as AuthPayload;
    if (rejectGuest(client, 'ejectPod')) return;

    const playerId = auth.userId;
    const state = activeCombatSessions.get(playerId);

    // Eject is only valid during an active combat session when HP < 15
    if (!state) {
      client.send('error', { code: 'EJECT_FAIL', message: 'Kein aktiver Kampf' });
      return;
    }
    const hpPercent = state.playerMaxHp > 0 ? (state.playerHp / state.playerMaxHp) * 100 : 0;
    if (hpPercent >= 15) {
      client.send('error', {
        code: 'EJECT_FAIL',
        message: 'Rumpf noch zu stabil für Notausstieg (HP ≥ 15%)',
      });
      return;
    }

    // End combat session
    activeCombatSessions.delete(playerId);

    // Clear all cargo (pod jettison)
    await ejectPod(auth.userId);

    client.send('cargoUpdate', await getCargoState(auth.userId));
    client.send(
      'logEntry',
      '⚠ NOTAUSSTIEG — Kapsel ausgestoßen. Gesamte Ladung verloren. Schiff überlebt.',
    );
    client.send('ejectPodResult', { success: true });
  }

  /** Destroy the active ship on permadeath and create a legacy successor. */
  private async _handlePermadeath(
    client: Client,
    auth: AuthPayload,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    const ship = await getActiveShip(auth.userId);
    if (!ship) return;

    const result = await destroyShipAndCreateLegacy({
      playerId: auth.userId,
      shipId: ship.id,
      playerName: auth.username,
      quadrantX: this.ctx.quadrantX,
      quadrantY: this.ctx.quadrantY,
      sectorX,
      sectorY,
      modules: ship.modules.map((m: any) => (typeof m === 'string' ? m : (m.type ?? String(m)))),
      lastLogEntry: `Zerstört im Kampf bei [${sectorX}:${sectorY}]`,
    });

    // Look up and send new ship data to client
    const newShip = await getActiveShip(auth.userId);
    if (newShip) {
      const stats = calculateShipStats(newShip.modules);
      // Update room's ship cache
      this.ctx.clientShips.set(client.sessionId, stats);
      const acepXp = await getAcepXpSummary(newShip.id);
      client.send('shipData', {
        id: newShip.id,
        ownerId: auth.userId,
        name: newShip.name,
        modules: newShip.modules,
        stats,
        fuel: stats.fuelMax,
        active: true,
        acepXp,
      });
    }

    // Notify client of permadeath
    client.send('permadeath', {
      wreckId: result.wreckId,
      newShipId: result.newShipId,
      legacyXp: result.legacyXp,
      message:
        '[ PERMADEATH ] Schiff zerstört — Erbschafts-Protokoll aktiviert. Neue Einheit übernimmt Kommando.',
    });
    client.send('logEntry', '[ PERMADEATH ] Schiff vernichtet. Erbschafts-Protokoll aktiviert.');
  }

  private async _emitPersonalityComment(
    client: Client,
    playerId: string,
    context: Parameters<typeof getPersonalityComment>[1],
  ): Promise<void> {
    const ship = await getActiveShip(playerId);
    if (!ship) return;
    const xp = await getAcepXpSummary(ship.id);
    const traits = calculateTraits(xp);
    const comment = getPersonalityComment(traits, context);
    if (comment) {
      client.send('logEntry', comment);
    }
  }
}
