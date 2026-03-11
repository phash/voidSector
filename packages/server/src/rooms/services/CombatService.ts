import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type {
  BattleActionMessage,
  CombatV2ActionMessage,
  CombatV2FleeMessage,
} from '@void-sector/shared';
import type { CombatState, RoundInput, EnemyModule } from '../../engine/combatTypes.js';

import { calculateCurrentAP, spendAP } from '../../engine/ap.js';
import { addAcepXpForPlayer, getAcepXpSummary } from '../../engine/acepXpService.js';
import { getAcepEffects } from '../../engine/acepXpService.js';
import { calculateTraits } from '../../engine/traitCalculator.js';
import { getPersonalityComment } from '../../engine/personalityMessages.js';
import { destroyShipAndCreateLegacy, ejectPod } from '../../engine/permadeathService.js';
import { validateBattleAction, createPirateEncounter } from '../../engine/commands.js';
import { getPirateLevel } from '../../engine/npcgen.js';
import {
  initCombatV2,
  resolveRound as resolveRoundV2,
  attemptFlee,
  combatV2ToResult,
} from '../../engine/combatV2.js';
import {
  initCombat,
  calculateAvailableEp,
  calculateEpCost,
  resolveRound,
} from '../../engine/combatEngine.js';
import { rejectGuest } from './utils.js';
import { getAPState, saveAPState } from './RedisAPStore.js';
import {
  getCargoState,
  addToInventory,
  removeFromInventory,
} from '../../engine/inventoryService.js';
import {
  getPlayerCredits,
  addCredits,
  deductCredits,
  getPlayerReputation,
  getPlayerUpgrades,
  insertBattleLog,
  insertBattleLogV2,
  insertCombatLog,
  getPlayerStructuresInSector,
  installStationDefense,
  getStructureHp,
  updateStructureHp,
  getActiveShip,
  getAllQuadrantControls,
  updateShipModules,
} from '../../db/queries.js';
import { isFrontierQuadrant } from '../../engine/expansionEngine.js';
import { sectorToQuadrant } from '../../engine/quadrantEngine.js';
import {
  FEATURE_COMBAT_V2,
  BATTLE_AP_COST_FLEE,
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
    const shipStats = calculateShipStats(ship.hullType, ship.modules);
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
      const stats = calculateShipStats(ship.hullType, updatedModules);
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

  // ══════════════════════════════════════════════════════════════════════════
  // Legacy combat handlers (kept for backward compatibility)
  // ══════════════════════════════════════════════════════════════════════════

  async handleBattleAction(client: Client, data: BattleActionMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const ship = this.ctx.getShipForClient(client.sessionId);
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const credits = await getPlayerCredits(auth.userId);
    const cargo = await getCargoState(auth.userId);
    const pirateRep = await getPlayerReputation(auth.userId, 'pirates');

    // Frontier guard: pirates only fight in frontier quadrants
    const { qx: bQx, qy: bQy } = sectorToQuadrant(data.sectorX, data.sectorY);
    const bControls = await getAllQuadrantControls();
    if (!isFrontierQuadrant(bQx, bQy, bControls)) {
      client.send('actionError', {
        code: 'NO_PIRATES',
        message: 'Dieser Sektor liegt tief im Zivilisationsgebiet. Keine Piraten mehr aktiv.',
      });
      return;
    }

    const pirateLevel = getPirateLevel(data.sectorX, data.sectorY);
    const encounter = createPirateEncounter(pirateLevel, data.sectorX, data.sectorY, pirateRep);

    // Ship attack power (base from ship class + combat_plating upgrade + faction bonus)
    let shipAttack = 10;
    const upgrades = await getPlayerUpgrades(auth.userId);
    if (upgrades.some((u) => u.upgrade_id === 'combat_plating' && u.active)) {
      shipAttack = Math.round(shipAttack * 1.2);
    }
    const bonuses = await this.ctx.getPlayerBonuses(auth.userId);
    shipAttack = Math.round(shipAttack * bonuses.combatMultiplier);

    const battleSeed = Date.now() ^ (data.sectorX * 31 + data.sectorY * 17);
    const validation = validateBattleAction(
      data.action,
      currentAP,
      encounter,
      credits,
      cargo,
      shipAttack,
      battleSeed,
    );

    if (!validation.valid) {
      client.send('battleResult', { success: false, error: validation.error });
      return;
    }

    const result = validation.result!;

    // Apply AP cost (flee)
    if (validation.newAP) {
      await saveAPState(auth.userId, validation.newAP);
      client.send('apUpdate', validation.newAP);
    }

    // Apply outcomes
    if (result.outcome === 'victory' && result.lootCredits) {
      await addCredits(auth.userId, result.lootCredits);
      client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
      if (result.lootResources) {
        for (const [res, amount] of Object.entries(result.lootResources)) {
          if (amount && amount > 0) await addToInventory(auth.userId, 'resource', res, amount);
        }
        client.send('cargoUpdate', await getCargoState(auth.userId));
      }
      if (result.lootArtefact && result.lootArtefact > 0) {
        await addToInventory(auth.userId, 'resource', 'artefact', result.lootArtefact);
      }
    }

    if (result.outcome === 'defeat' && result.cargoLost) {
      for (const [res, amount] of Object.entries(result.cargoLost)) {
        if (amount && amount > 0) await removeFromInventory(auth.userId, 'resource', res, amount);
      }
      client.send('cargoUpdate', await getCargoState(auth.userId));
    }

    if (result.outcome === 'negotiated') {
      await deductCredits(auth.userId, encounter.negotiateCost);
      client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    }

    // Reputation changes
    if (result.repChange) {
      await this.ctx.applyReputationChange(auth.userId, 'pirates', result.repChange, client);
    }

    // XP
    if (result.xpGained) {
      await this.ctx.applyXpGain(auth.userId, result.xpGained, client);
    }

    // Log battle
    await insertBattleLog(
      auth.userId,
      pirateLevel,
      data.sectorX,
      data.sectorY,
      data.action,
      result.outcome,
      result.lootResources ?? null,
    );

    client.send('battleResult', { success: true, encounter, result });

    // Log entry
    const outcomeMessages: Record<string, string> = {
      victory: `SIEG! Piraten besiegt. +${result.lootCredits ?? 0} CR`,
      defeat: 'NIEDERLAGE. Cargo verloren.',
      escaped: 'Erfolgreich geflohen!',
      caught: 'Flucht fehlgeschlagen — Kampf erzwungen.',
      negotiated: `Verhandelt. -${encounter.negotiateCost} CR`,
    };
    client.send('logEntry', outcomeMessages[result.outcome] ?? `Kampf: ${result.outcome}`);

    // Check bounty quests
    if (result.outcome === 'victory') {
      await this.ctx.checkQuestProgress(client, auth.userId, 'battle_won', {
        sectorX: data.sectorX,
        sectorY: data.sectorY,
      });
      // ACEP: KAMPF-XP for combat victory (spec: +10)
      addAcepXpForPlayer(auth.userId, 'kampf', 10).catch(() => {});
      this._emitPersonalityComment(client, auth.userId, 'combat_victory').catch(() => {});
    } else if (result.outcome === 'defeat') {
      this._emitPersonalityComment(client, auth.userId, 'combat_defeat').catch(() => {});
      // ACEP/4: Permadeath on combat defeat
      await this._handlePermadeath(client, auth, data.sectorX, data.sectorY);
    }
  }

  async handleCombatV2Action(client: Client, data: CombatV2ActionMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const sessionId = client.sessionId;
    const state = this.ctx.combatV2States.get(sessionId);

    if (!state || state.status !== 'active') {
      client.send('combatV2Result', { success: false, error: 'No active combat' });
      return;
    }

    const validTactics = ['assault', 'balanced', 'defensive'];
    const validSpecials = ['aim', 'evade', 'none'];
    if (!validTactics.includes(data.tactic) || !validSpecials.includes(data.specialAction)) {
      client.send('combatV2Result', { success: false, error: 'Invalid tactic or action' });
      return;
    }

    const ship = this.ctx.getShipForClient(sessionId);
    const bonuses = await this.ctx.getPlayerBonuses(auth.userId);
    const seed = Date.now() ^ (data.sectorX * 31 + data.sectorY * 17 + state.currentRound * 7);

    const result = resolveRoundV2(
      state,
      ship,
      data.tactic as any,
      data.specialAction as any,
      bonuses.combatMultiplier,
      seed,
    );

    this.ctx.combatV2States.set(sessionId, result.state);

    // ACEP: KAMPF-XP per round (spec: +2 for damage dealt, +1 for damage taken)
    if (result.round.playerAttack > 0) {
      addAcepXpForPlayer(auth.userId, 'kampf', 2).catch(() => {});
    }
    if (result.round.enemyAttack > 0) {
      addAcepXpForPlayer(auth.userId, 'kampf', 1).catch(() => {});
    }

    if (result.state.status !== 'active') {
      this.ctx.combatV2States.delete(sessionId);
      const finalResult = combatV2ToResult(result.state, seed);

      // Apply outcomes
      if (result.state.status === 'victory') {
        if (finalResult.lootCredits) {
          await addCredits(auth.userId, finalResult.lootCredits);
        }
        if (finalResult.lootResources) {
          for (const [resource, amount] of Object.entries(finalResult.lootResources)) {
            if (amount > 0) await addToInventory(auth.userId, 'resource', resource, amount);
          }
        }
        if (finalResult.lootArtefact && finalResult.lootArtefact > 0) {
          await addToInventory(auth.userId, 'resource', 'artefact', finalResult.lootArtefact);
        }
      }
      if (finalResult.repChange) {
        await this.ctx.applyReputationChange(auth.userId, 'pirates', finalResult.repChange, client);
      }

      // ACEP: KAMPF-XP + personality comment for combat v2 (spec: +10 victory)
      if (result.state.status === 'victory') {
        addAcepXpForPlayer(auth.userId, 'kampf', 10).catch(() => {});
        this._emitPersonalityComment(client, auth.userId, 'combat_victory').catch(() => {});
      } else if (result.state.status === 'defeat') {
        this._emitPersonalityComment(client, auth.userId, 'combat_defeat').catch(() => {});
        // ACEP/4: Permadeath on combat defeat
        await this._handlePermadeath(client, auth, data.sectorX, data.sectorY);
      }

      await insertBattleLogV2(
        auth.userId,
        state.encounter.pirateLevel,
        data.sectorX,
        data.sectorY,
        'combat_v2',
        result.state.status,
        finalResult.lootResources ?? null,
        result.state.currentRound,
        result.state.rounds,
        result.state.playerHp,
      );

      client.send('combatV2Result', {
        success: true,
        round: result.round,
        state: result.state,
        finalResult,
      });
      return;
    }

    client.send('combatV2Result', {
      success: true,
      round: result.round,
      state: result.state,
    });
  }

  async handleCombatV2Flee(client: Client, data: CombatV2FleeMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const sessionId = client.sessionId;
    const state = this.ctx.combatV2States.get(sessionId);

    if (!state || state.status !== 'active') {
      client.send('combatV2Result', { success: false, error: 'No active combat' });
      return;
    }

    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const newAP = spendAP(currentAP, BATTLE_AP_COST_FLEE);
    if (!newAP) {
      client.send('combatV2Result', { success: false, error: 'Nicht genug AP zum Fliehen (2 AP)' });
      return;
    }

    const ship = this.ctx.getShipForClient(sessionId);
    const seed = Date.now() ^ (data.sectorX * 31 + data.sectorY * 17);
    const fleeResult = attemptFlee(state, ship, seed);

    await saveAPState(auth.userId, newAP);
    client.send('apUpdate', newAP);

    if (fleeResult.escaped) {
      this.ctx.combatV2States.delete(sessionId);
      client.send('combatV2Result', {
        success: true,
        state: fleeResult.state,
        finalResult: { outcome: 'escaped' },
      });
    } else {
      this.ctx.combatV2States.set(sessionId, fleeResult.state);
      client.send('combatV2Result', {
        success: true,
        state: fleeResult.state,
        finalResult: { outcome: 'caught' },
      });
    }
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

  /** Emit a personality comment to the client's event log (fire-and-forget). */
  async handleEjectPod(client: Client, data: { sectorX: number; sectorY: number }): Promise<void> {
    const auth = client.auth as AuthPayload;
    if (rejectGuest(client, 'ejectPod')) return;

    const sessionId = client.sessionId;
    const state = this.ctx.combatV2States.get(sessionId);

    // Eject is only valid during active CombatV2 when HP < 15
    if (!state || state.status !== 'active') {
      client.send('error', { code: 'EJECT_FAIL', message: 'Kein aktiver Kampf' });
      return;
    }
    if (state.playerHp >= 15) {
      client.send('error', {
        code: 'EJECT_FAIL',
        message: 'Rumpf noch zu stabil für Notausstieg (HP ≥ 15%)',
      });
      return;
    }

    // End combat state
    this.ctx.combatV2States.delete(sessionId);

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
      const stats = calculateShipStats(newShip.hullType, newShip.modules);
      // Update room's ship cache
      this.ctx.clientShips.set(client.sessionId, stats);
      this.ctx.clientHullTypes.set(client.sessionId, newShip.hullType);
      const acepXp = await getAcepXpSummary(newShip.id);
      client.send('shipData', {
        id: newShip.id,
        ownerId: auth.userId,
        hullType: newShip.hullType,
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
