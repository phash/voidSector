import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { ShipModule, ResearchState, HullType } from '@void-sector/shared';

import {
  calculateShipStats,
  validateModuleInstall,
  isModuleUnlocked,
  canStartResearch,
  MODULES,
  HULLS,
  HULL_PRICES,
  STATION_SHIPYARD_LEVEL_THRESHOLD,
  MAX_ARTEFACTS_PER_RESEARCH,
  ARTEFACT_WISSEN_BONUS,
  ARTEFACT_TIME_BONUS_PER,
} from '@void-sector/shared';
import { getReputationTier } from '../../engine/commands.js';
import { hasShipyard } from '../../engine/npcgen.js';
import { getOrInitStation, getStationLevel } from '../../engine/npcStationEngine.js';
import { query } from '../../db/client.js';
import { getFuelState, saveFuelState } from './RedisAPStore.js';
import { getAcepXpSummary, getAcepEffects } from '../../engine/acepXpService.js';
import {
  getActiveShip,
  getPlayerHomeBase,
  getPlayerShips,
  createShip,
  switchActiveShip,
  updateShipModules,
  renameShip,
  renameBase,
  getModuleInventory,
  addModuleToInventory,
  removeModuleFromInventory,
  getPlayerLevel,
  getPlayerResearch,
  addUnlockedModule,
  getActiveResearch,
  startActiveResearch,
  deleteActiveResearch,
  getPlayerCredits,
  deductCredits,
  getPlayerCargo,
  deductCargo,
  getPlayerReputations,
  getWissen,
  deductWissen,
  addWissen,
  getTypedArtefacts,
  deductTypedArtefacts,
  getResearchLabTier,
} from '../../db/queries.js';
import { rejectGuest } from './utils.js';

export class ShipService {
  constructor(private ctx: ServiceContext) {}

  async handleGetShips(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const ships = await getPlayerShips(auth.userId);
    const shipsWithStats = await Promise.all(
      ships.map(async (s) => {
        const acepXp = await getAcepXpSummary(s.id);
        return {
          ...s,
          stats: calculateShipStats(s.hullType, s.modules),
          acepXp,
          acepEffects: getAcepEffects(acepXp),
        };
      }),
    );
    client.send('shipList', { ships: shipsWithStats });
  }

  async handleSwitchShip(client: Client, data: { shipId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    // Must be at home base
    const homeBase = await getPlayerHomeBase(auth.userId);
    if (
      this.ctx._px(client.sessionId) !== homeBase.x ||
      this.ctx._py(client.sessionId) !== homeBase.y
    ) {
      client.send('error', {
        code: 'NOT_AT_BASE',
        message: 'Must be at home base to switch ships',
      });
      return;
    }
    const success = await switchActiveShip(auth.userId, data.shipId);
    if (!success) {
      client.send('error', { code: 'SWITCH_FAIL', message: 'Ship not found' });
      return;
    }
    // Reload new ship stats
    const newShip = await getActiveShip(auth.userId);
    if (newShip) {
      const newStats = calculateShipStats(newShip.hullType, newShip.modules);
      this.ctx.clientShips.set(client.sessionId, newStats);
      this.ctx.clientHullTypes.set(client.sessionId, newShip.hullType);
      const fuelState = await getFuelState(auth.userId);
      client.send('shipData', {
        id: newShip.id,
        ownerId: auth.userId,
        hullType: newShip.hullType,
        name: newShip.name,
        modules: newShip.modules,
        stats: newStats,
        fuel: fuelState ?? newStats.fuelMax,
        active: true,
      });
    }
  }

  async handleInstallModule(
    client: Client,
    data: { moduleId: string; slotIndex: number },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    const ship = await getActiveShip(auth.userId);
    if (!ship) return;
    const validation = validateModuleInstall(
      ship.hullType,
      ship.modules,
      data.moduleId,
      data.slotIndex,
    );
    if (!validation.valid) {
      client.send('error', { code: 'INSTALL_FAIL', message: validation.error! });
      return;
    }
    // Remove from inventory
    const removed = await removeModuleFromInventory(auth.userId, data.moduleId);
    if (!removed) {
      client.send('error', { code: 'NO_MODULE', message: 'Module not in inventory' });
      return;
    }
    // Install
    const newModules: ShipModule[] = [
      ...ship.modules,
      { moduleId: data.moduleId, slotIndex: data.slotIndex },
    ];
    await updateShipModules(ship.id, newModules);
    // Recalculate and send
    const newStats = calculateShipStats(ship.hullType, newModules);
    this.ctx.clientShips.set(client.sessionId, newStats);
    client.send('moduleInstalled', { modules: newModules, stats: newStats });
  }

  async handleRemoveModule(client: Client, data: { slotIndex: number }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const ship = await getActiveShip(auth.userId);
    if (!ship) return;
    const mod = ship.modules.find((m) => m.slotIndex === data.slotIndex);
    if (!mod) {
      client.send('error', { code: 'EMPTY_SLOT', message: 'No module in that slot' });
      return;
    }
    // Remove from ship
    const newModules = ship.modules.filter((m) => m.slotIndex !== data.slotIndex);
    await updateShipModules(ship.id, newModules);
    // Add back to inventory
    await addModuleToInventory(auth.userId, mod.moduleId);
    // Recalculate
    const newStats = calculateShipStats(ship.hullType, newModules);
    this.ctx.clientShips.set(client.sessionId, newStats);
    client.send('moduleRemoved', {
      modules: newModules,
      stats: newStats,
      returnedModule: mod.moduleId,
    });
  }

  async handleBuyModule(client: Client, data: { moduleId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const moduleDef = MODULES[data.moduleId];
    if (!moduleDef) {
      client.send('error', { code: 'UNKNOWN_MODULE', message: 'Unknown module' });
      return;
    }
    // Check if module is unlocked (research/blueprint/tier1)
    const dbResearch = await getPlayerResearch(auth.userId);
    const researchState: ResearchState = { ...dbResearch, activeResearch: null };
    if (!isModuleUnlocked(data.moduleId, researchState)) {
      client.send('error', { code: 'MODULE_LOCKED', message: 'Module not researched' });
      return;
    }
    // Must be at station or home base
    const homeBase = await getPlayerHomeBase(auth.userId);
    const isStation = this.ctx._pst(client.sessionId) === 'station';
    const isHomeBase =
      this.ctx._px(client.sessionId) === homeBase.x &&
      this.ctx._py(client.sessionId) === homeBase.y;
    if (!isStation && !isHomeBase) {
      client.send('error', {
        code: 'WRONG_LOCATION',
        message: 'Must be at a station or home base',
      });
      return;
    }
    // Check credits
    const credits = await getPlayerCredits(auth.userId);
    if (credits < moduleDef.cost.credits) {
      client.send('error', { code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits' });
      return;
    }
    // Check resource costs from cargo
    const cargo = await getPlayerCargo(auth.userId);
    const cargoMap: Record<string, number> = {
      ore: cargo.ore,
      gas: cargo.gas,
      crystal: cargo.crystal,
      artefact: cargo.artefact,
    };
    for (const [res, amount] of Object.entries(moduleDef.cost)) {
      if (res === 'credits') continue;
      const have = cargoMap[res] ?? 0;
      if (have < (amount as number)) {
        client.send('error', { code: 'INSUFFICIENT_RESOURCES', message: `Need ${amount} ${res}` });
        return;
      }
    }
    // Deduct credits
    await deductCredits(auth.userId, moduleDef.cost.credits);
    // Deduct resources from cargo
    for (const [res, amount] of Object.entries(moduleDef.cost)) {
      if (res === 'credits' || !amount) continue;
      await deductCargo(auth.userId, res, amount as number);
    }
    // Add to module inventory
    await addModuleToInventory(auth.userId, data.moduleId);
    // Send updates
    const remainingCredits = await getPlayerCredits(auth.userId);
    client.send('creditsUpdate', { credits: remainingCredits });
    client.send('buyModuleResult', { success: true, moduleId: data.moduleId });
    const inventory = await getModuleInventory(auth.userId);
    client.send('moduleInventory', { modules: inventory });
  }

  async handleBuyHull(
    client: Client,
    data: { hullType: string; name?: string; shipColor?: string },
  ): Promise<void> {
    if (rejectGuest(client, 'Schiffskauf')) return;
    const auth = client.auth as AuthPayload;
    const hullDef = HULLS[data.hullType as HullType];
    if (!hullDef) {
      client.send('error', { code: 'UNKNOWN_HULL', message: 'Unknown hull type' });
      return;
    }
    // Must be at station or home base
    const homeBase = await getPlayerHomeBase(auth.userId);
    const isStation = this.ctx._pst(client.sessionId) === 'station';
    const isHomeBase =
      this.ctx._px(client.sessionId) === homeBase.x &&
      this.ctx._py(client.sessionId) === homeBase.y;
    if (!isStation && !isHomeBase) {
      client.send('error', {
        code: 'WRONG_LOCATION',
        message: 'Must be at a station or home base',
      });
      return;
    }
    // If at an NPC station (not home base), check shipyard availability
    if (isStation && !isHomeBase) {
      const sx = this.ctx._px(client.sessionId);
      const sy = this.ctx._py(client.sessionId);
      const station = await getOrInitStation(sx, sy);
      const stationLevelInfo = getStationLevel(station.xp);
      if (!hasShipyard(stationLevelInfo.level)) {
        client.send('error', {
          code: 'NO_SHIPYARD',
          message: `Station needs level ${STATION_SHIPYARD_LEVEL_THRESHOLD}+ for shipyard`,
        });
        return;
      }
    }
    // Check level
    const playerLevel = await getPlayerLevel(auth.userId);
    if (playerLevel < hullDef.unlockLevel) {
      client.send('error', { code: 'LEVEL_TOO_LOW', message: `Need level ${hullDef.unlockLevel}` });
      return;
    }
    // Check credits (use HULL_PRICES)
    const price = HULL_PRICES[data.hullType as HullType] ?? hullDef.unlockCost;
    const credits = await getPlayerCredits(auth.userId);
    if (credits < price) {
      client.send('error', { code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits' });
      return;
    }
    // Deduct credits
    if (price > 0) {
      await deductCredits(auth.userId, price);
    }
    // Create new ship (becomes active, old one deactivated)
    const newShip = await createShip(
      auth.userId,
      data.hullType as HullType,
      data.name?.slice(0, 20) || hullDef.name,
      hullDef.baseFuel,
    );
    const newStats = calculateShipStats(newShip.hullType, newShip.modules);
    this.ctx.clientShips.set(client.sessionId, newStats);
    this.ctx.clientHullTypes.set(client.sessionId, newShip.hullType);
    // Reset fuel
    await saveFuelState(auth.userId, hullDef.baseFuel);
    // Persist cosmetic ship color
    const shipColor = data.shipColor?.slice(0, 7) || undefined;
    client.send('shipData', {
      id: newShip.id,
      ownerId: auth.userId,
      hullType: newShip.hullType,
      name: newShip.name,
      modules: newShip.modules,
      stats: newStats,
      fuel: hullDef.baseFuel,
      active: true,
      shipColor,
    });
    const remainingCredits = await getPlayerCredits(auth.userId);
    client.send('creditsUpdate', { credits: remainingCredits });
  }

  async handleRenameShip(client: Client, data: { shipId: string; name: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const success = await renameShip(data.shipId, auth.userId, data.name);
    if (success) {
      client.send('shipRenamed', { shipId: data.shipId, name: data.name.slice(0, 20) });
    }
  }

  async handleRenameBase(client: Client, data: { name: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    await renameBase(auth.userId, data.name);
    client.send('baseRenamed', { name: data.name.slice(0, 20) });
  }

  async handleGetModuleInventory(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const inventory = await getModuleInventory(auth.userId);
    client.send('moduleInventory', { modules: inventory });
  }

  // ── Research Handlers ───────────────────────────────────────────────

  async handleGetResearchState(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const research = await getPlayerResearch(auth.userId);
    const active1 = await getActiveResearch(auth.userId, 1);
    const active2 = await getActiveResearch(auth.userId, 2);
    const wissen = await getWissen(auth.userId);
    const typedArtefacts = await getTypedArtefacts(auth.userId);

    client.send('researchState', {
      unlockedModules: research.unlockedModules,
      blueprints: research.blueprints,
      activeResearch: active1,
      activeResearch2: active2,
      wissen,
      wissenRate: 0,
      typedArtefacts,
    });
  }

  async handleStartResearch(
    client: Client,
    data: { moduleId: string; slot?: 1 | 2; artefactsToUse?: Partial<Record<string, number>> },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    const slot = data.slot ?? 1;

    const dbResearch = await getPlayerResearch(auth.userId);
    const active1 = await getActiveResearch(auth.userId, 1);
    const active2 = await getActiveResearch(auth.userId, 2);
    const wissen = await getWissen(auth.userId);
    const labTier = await getResearchLabTier(auth.userId);
    const typedArtefacts = await getTypedArtefacts(auth.userId);

    const reps = await getPlayerReputations(auth.userId);
    const factionTiers: Record<string, string> = {};
    for (const rep of reps) {
      const tier = getReputationTier(rep.reputation);
      factionTiers[rep.faction_id] = tier;
    }

    const researchState: ResearchState = {
      unlockedModules: dbResearch.unlockedModules,
      blueprints: dbResearch.blueprints,
      activeResearch: active1,
      activeResearch2: active2,
      wissen,
      wissenRate: 0,
    };

    const artefactResources = typedArtefacts;

    const validation = canStartResearch(
      data.moduleId,
      researchState,
      artefactResources,
      labTier,
      slot,
      factionTiers,
    );
    if (!validation.valid) {
      client.send('error', { code: 'RESEARCH_FAIL', message: validation.error! });
      return;
    }

    const mod = MODULES[data.moduleId]!;
    const rc = mod.researchCost!;

    // Calculate actual Wissen cost (reduced by artefact bonuses)
    const artefactsUsed = data.artefactsToUse ?? {};
    const usedCount = Object.values(artefactsUsed).reduce((s, v) => s + (v ?? 0), 0);
    const wissenCost = Math.max(
      0,
      rc.wissen - Math.min(usedCount, MAX_ARTEFACTS_PER_RESEARCH) * ARTEFACT_WISSEN_BONUS,
    );

    // Deduct Wissen
    const deducted = await deductWissen(auth.userId, wissenCost);
    if (!deducted) {
      client.send('error', { code: 'RESEARCH_FAIL', message: 'Insufficient Wissen (concurrent)' });
      return;
    }

    try {
      // Build full artefact deduction map (required + optional extras)
      const allArtefactsToDeduct: Partial<Record<string, number>> = {};
      if (rc.artefacts) {
        for (const [type, count] of Object.entries(rc.artefacts)) {
          allArtefactsToDeduct[type] = (allArtefactsToDeduct[type] ?? 0) + (count ?? 0);
        }
      }
      for (const [type, count] of Object.entries(artefactsUsed)) {
        const req = allArtefactsToDeduct[type] ?? 0;
        const extra = Math.max(0, (count ?? 0) - req);
        if (extra > 0) allArtefactsToDeduct[type] = (allArtefactsToDeduct[type] ?? 0) + extra;
      }
      if (Object.keys(allArtefactsToDeduct).length > 0) {
        await deductTypedArtefacts(auth.userId, allArtefactsToDeduct);
      }

      // Duration: base, reduced by matching artefact type × 10% each (max 50%)
      const matchingArtefactType = mod.category as string;
      const matchingUsed = artefactsUsed[matchingArtefactType] ?? 0;
      const timeReduction = Math.min(matchingUsed * ARTEFACT_TIME_BONUS_PER, 0.5);
      const durationMin = mod.researchDurationMin ?? 30;
      const durationMs = Math.round(durationMin * 60_000 * (1 - timeReduction));

      const now = Date.now();
      await startActiveResearch(auth.userId, data.moduleId, now, now + durationMs, slot);

      const newWissen = await getWissen(auth.userId);
      const activeEntry = { moduleId: data.moduleId, startedAt: now, completesAt: now + durationMs };
      client.send('researchResult', {
        success: true,
        activeResearch: slot === 1 ? activeEntry : active1,
        activeResearch2: slot === 2 ? activeEntry : active2,
        wissen: newWissen,
      });
    } catch (err) {
      // Rollback: refund Wissen since research did not start
      await addWissen(auth.userId, wissenCost).catch(() => {/* best-effort refund */});
      client.send('error', { code: 'RESEARCH_FAIL', message: 'Research start failed, Wissen refunded' });
    }
  }

  async handleCancelResearch(client: Client, data?: { slot?: 1 | 2 }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const slot = data?.slot ?? 1;
    const active = await getActiveResearch(auth.userId, slot);
    if (!active) {
      client.send('researchResult', { success: false, error: 'No active research in that slot' });
      return;
    }
    await deleteActiveResearch(auth.userId, slot);
    client.send('researchResult', {
      success: true,
      activeResearch: slot === 1 ? null : await getActiveResearch(auth.userId, 1),
      activeResearch2: slot === 2 ? null : await getActiveResearch(auth.userId, 2),
    });
  }

  async handleClaimResearch(client: Client, data?: { slot?: 1 | 2 }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const slot = data?.slot ?? 1;
    const active = await getActiveResearch(auth.userId, slot);
    if (!active) {
      client.send('researchResult', { success: false, error: 'No active research in that slot' });
      return;
    }
    if (Date.now() < active.completesAt) {
      client.send('researchResult', { success: false, error: 'Research not complete' });
      return;
    }

    await addUnlockedModule(auth.userId, active.moduleId);
    await deleteActiveResearch(auth.userId, slot);

    const research = await getPlayerResearch(auth.userId);
    const active1 = await getActiveResearch(auth.userId, 1);
    const active2 = await getActiveResearch(auth.userId, 2);
    client.send('researchResult', {
      success: true,
      claimed: active.moduleId,
      unlockedModules: research.unlockedModules,
      activeResearch: active1,
      activeResearch2: active2,
    });
    client.send(
      'logEntry',
      `FORSCHUNG ABGESCHLOSSEN: ${MODULES[active.moduleId]?.name ?? active.moduleId}`,
    );
  }

  async handleActivateBlueprint(client: Client, data: { moduleId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const research = await getPlayerResearch(auth.userId);
    if (!research.blueprints.includes(data.moduleId)) {
      client.send('researchResult', { success: false, error: 'Blueprint not found' });
      return;
    }

    // Move from blueprints to unlocked
    await addUnlockedModule(auth.userId, data.moduleId);
    // Remove from blueprints array
    await query(
      `UPDATE player_research SET blueprints = array_remove(blueprints, $2::text) WHERE user_id = $1`,
      [auth.userId, data.moduleId],
    );

    const updated = await getPlayerResearch(auth.userId);
    client.send('researchResult', {
      success: true,
      activated: data.moduleId,
      unlockedModules: updated.unlockedModules,
      blueprints: updated.blueprints,
    });
    client.send(
      'logEntry',
      `BLAUPAUSE AKTIVIERT: ${MODULES[data.moduleId]?.name ?? data.moduleId}`,
    );
  }
}
