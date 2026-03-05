import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type {
  BattleActionMessage,
  CombatV2ActionMessage,
  CombatV2FleeMessage,
  ResourceType,
} from '@void-sector/shared';

import { calculateCurrentAP, spendAP } from '../../engine/ap.js';
import {
  validateBattleAction,
  createPirateEncounter,
} from '../../engine/commands.js';
import { getPirateLevel } from '../../engine/npcgen.js';
import {
  initCombatV2,
  resolveRound,
  attemptFlee,
  combatV2ToResult,
} from '../../engine/combatV2.js';
import { rejectGuest } from './utils.js';
import { getAPState, saveAPState } from './RedisAPStore.js';
import {
  getPlayerCredits,
  addCredits,
  deductCredits,
  getPlayerCargo,
  addToCargo,
  deductCargo,
  getPlayerReputation,
  getPlayerUpgrades,
  insertBattleLog,
  insertBattleLogV2,
  getPlayerStructuresInSector,
  installStationDefense,
  getStructureHp,
  updateStructureHp,
} from '../../db/queries.js';
import {
  FEATURE_COMBAT_V2,
  BATTLE_AP_COST_FLEE,
  STATION_DEFENSE_DEFS,
  STATION_REPAIR_CR_PER_HP,
  STATION_REPAIR_ORE_PER_HP,
} from '@void-sector/shared';

export class CombatService {
  constructor(private ctx: ServiceContext) {}

  async handleBattleAction(client: Client, data: BattleActionMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const ship = this.ctx.getShipForClient(client.sessionId);
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const credits = await getPlayerCredits(auth.userId);
    const cargo = await getPlayerCargo(auth.userId);
    const pirateRep = await getPlayerReputation(auth.userId, 'pirates');

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
          if (amount && amount > 0) await addToCargo(auth.userId, res as ResourceType, amount);
        }
        client.send('cargoUpdate', await getPlayerCargo(auth.userId));
      }
      if (result.lootArtefact && result.lootArtefact > 0) {
        await addToCargo(auth.userId, 'artefact' as ResourceType, result.lootArtefact);
      }
    }

    if (result.outcome === 'defeat' && result.cargoLost) {
      for (const [res, amount] of Object.entries(result.cargoLost)) {
        if (amount && amount > 0) await deductCargo(auth.userId, res, amount);
      }
      client.send('cargoUpdate', await getPlayerCargo(auth.userId));
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

    const result = resolveRound(
      state,
      ship,
      data.tactic as any,
      data.specialAction as any,
      bonuses.combatMultiplier,
      seed,
    );

    this.ctx.combatV2States.set(sessionId, result.state);

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
            if (amount > 0) await addToCargo(auth.userId, resource as ResourceType, amount);
          }
        }
        if (finalResult.lootArtefact && finalResult.lootArtefact > 0) {
          await addToCargo(auth.userId, 'artefact' as ResourceType, finalResult.lootArtefact);
        }
      }
      if (finalResult.repChange) {
        await this.ctx.applyReputationChange(auth.userId, 'pirates', finalResult.repChange, client);
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
    const cargo = await getPlayerCargo(auth.userId);
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
      await deductCargo(auth.userId, resource, amount);
    }

    try {
      const result = await installStationDefense(auth.userId, sectorX, sectorY, data.defenseType);
      client.send('installDefenseResult', {
        success: true,
        defenseType: data.defenseType,
        id: result.id,
      });
      const updatedCargo = await getPlayerCargo(auth.userId);
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
    const cargo = await getPlayerCargo(auth.userId);
    if ((cargo.ore ?? 0) < costOre) {
      client.send('repairResult', {
        success: false,
        error: `Kosten: ${costCredits} CR, ${costOre} Erz — nicht genug Erz`,
      });
      return;
    }

    await deductCredits(auth.userId, costCredits);
    await deductCargo(auth.userId, 'ore', costOre);
    await updateStructureHp(auth.userId, data.sectorX, data.sectorY, hp.maxHp);

    client.send('repairResult', { success: true, newHp: hp.maxHp, maxHp: hp.maxHp });
    const updatedCargo = await getPlayerCargo(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
  }
}
