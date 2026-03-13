import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { ShipModule, ResearchState } from '@void-sector/shared';
import { logger } from '../../utils/logger.js';

import {
  calculateShipStats,
  validateModuleInstall,
  getActiveDrawbacks,
  isModuleUnlocked,
  canStartResearch,
  getAcepLevel,
  MODULES,
  MAX_ARTEFACTS_PER_RESEARCH,
  ARTEFACT_WISSEN_BONUS,
  ARTEFACT_TIME_BONUS_PER,
} from '@void-sector/shared';
import { getReputationTier } from '../../engine/commands.js';
import { getFuelState } from './RedisAPStore.js';
import {
  getAcepXpSummary,
  getAcepEffects,
  boostAcepPath,
  type AcepPath,
} from '../../engine/acepXpService.js';
import {
  addToInventory,
  removeFromInventory,
  getInventoryItem,
  getCargoState,
} from '../../engine/inventoryService.js';
import {
  getActiveShip,
  playerHasBaseAtSector,
  getPlayerShips,
  updateShipModules,
  renameShip,
  renameBase,
  getInventory,
  getPlayerResearch,
  addUnlockedModule,
  getActiveResearch,
  startActiveResearch,
  deleteActiveResearch,
  getPlayerCredits,
  deductCredits,
  getPlayerReputations,
  getWissen,
  deductWissen,
  addWissen,
  getTypedArtefacts,
  deductTypedArtefacts,
} from '../../db/queries.js';

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
          stats: calculateShipStats(s.modules, acepXp),
          acepXp,
          acepEffects: getAcepEffects(acepXp),
          acepTraits: s.acepTraits,
        };
      }),
    );
    client.send('shipList', { ships: shipsWithStats });
  }

  async handleInstallModule(
    client: Client,
    data: { moduleId: string; slotIndex: number },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    const ship = await getActiveShip(auth.userId);
    if (!ship) return;
    // Fetch ACEP XP for slot validation and stat calculation
    const acepXp = await getAcepXpSummary(ship.id);
    const validation = validateModuleInstall(
      ship.modules,
      data.moduleId,
      data.slotIndex,
      acepXp,
    );
    if (!validation.valid) {
      client.send('error', { code: 'INSTALL_FAIL', message: validation.error! });
      return;
    }
    // Remove from inventory
    const qty = await getInventoryItem(auth.userId, 'module', data.moduleId);
    if (qty < 1) {
      client.send('error', { code: 'NO_MODULE', message: 'Module not in inventory' });
      return;
    }
    await removeFromInventory(auth.userId, 'module', data.moduleId, 1);
    // Install — source defaults to 'standard' (inventory-tracked source TBD)
    const newModules: ShipModule[] = [
      ...ship.modules,
      { moduleId: data.moduleId, slotIndex: data.slotIndex, source: 'standard' as const },
    ];
    await updateShipModules(ship.id, newModules);
    // Recalculate stats and collect active drawbacks
    const newStats = calculateShipStats(newModules, acepXp);
    const drawbacks = getActiveDrawbacks(newModules);
    this.ctx.clientShips.set(client.sessionId, newStats);
    client.send('moduleInstalled', { modules: newModules, stats: newStats, drawbacks });
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
    await addToInventory(auth.userId, 'module', mod.moduleId, 1);
    // Recalculate stats with ACEP XP
    const acepXp = await getAcepXpSummary(ship.id);
    const newStats = calculateShipStats(newModules, acepXp);
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
    // Must be at station or own base
    const isStation = this.ctx._pst(client.sessionId) === 'station';
    const hasBase = await playerHasBaseAtSector(
      auth.userId,
      this.ctx._px(client.sessionId),
      this.ctx._py(client.sessionId),
    );
    if (!isStation && !hasBase) {
      client.send('error', {
        code: 'WRONG_LOCATION',
        message: 'Must be at a station or your base',
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
    const cargo = await getCargoState(auth.userId);
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
    // Deduct resources from inventory
    for (const [res, amount] of Object.entries(moduleDef.cost)) {
      if (res === 'credits' || !amount) continue;
      await removeFromInventory(auth.userId, 'resource', res, amount as number);
    }
    // Add to unified inventory
    await addToInventory(auth.userId, 'module', data.moduleId, 1);
    // Send updates
    const remainingCredits = await getPlayerCredits(auth.userId);
    client.send('creditsUpdate', { credits: remainingCredits });
    client.send('buyModuleResult', { success: true, moduleId: data.moduleId });
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
    const items = await getInventory(auth.userId);
    const modules = items
      .filter((i) => i.itemType === 'module')
      .flatMap((i) => Array(i.quantity).fill(i.itemId) as string[]);
    client.send('moduleInventory', { modules });
  }

  // ── Research Handlers ───────────────────────────────────────────────

  async handleGetResearchState(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const research = await getPlayerResearch(auth.userId);
    const active1 = await getActiveResearch(auth.userId, 1);
    const active2 = await getActiveResearch(auth.userId, 2);
    const wissen = await getWissen(auth.userId);
    const typedArtefacts = await getTypedArtefacts(auth.userId);
    const shipForLabTier = await getActiveShip(auth.userId);
    const acepXpForTier = shipForLabTier ? await getAcepXpSummary(shipForLabTier.id) : { ausbau: 0 };
    const labTier = getAcepLevel(acepXpForTier.ausbau);

    client.send('researchState', {
      unlockedModules: research.unlockedModules,
      blueprints: research.blueprints,
      activeResearch: active1,
      activeResearch2: active2,
      wissen,
      wissenRate: 0,
      typedArtefacts,
      labTier,
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
    const shipForLabTier = await getActiveShip(auth.userId);
    const acepXpForTier = shipForLabTier ? await getAcepXpSummary(shipForLabTier.id) : { ausbau: 0 };
    const labTier = getAcepLevel(acepXpForTier.ausbau);
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
    const usedCount: number = Object.values(artefactsUsed).reduce(
      (s: number, v) => s + (v ?? 0),
      0,
    );
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
      const activeEntry = {
        moduleId: data.moduleId,
        startedAt: now,
        completesAt: now + durationMs,
      };
      client.send('researchResult', {
        success: true,
        activeResearch: slot === 1 ? activeEntry : active1,
        activeResearch2: slot === 2 ? activeEntry : active2,
        wissen: newWissen,
      });
    } catch (err) {
      logger.error({ err, moduleId: data.moduleId, slot, userId: auth.userId }, 'Research start failed');
      // Rollback: refund Wissen since research did not start
      await addWissen(auth.userId, wissenCost).catch(() => {
        /* best-effort refund */
      });
      client.send('error', {
        code: 'RESEARCH_FAIL',
        message: 'Research start failed, Wissen refunded',
      });
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

  async handleCraftModule(client: Client, data: { moduleId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const mod = MODULES[data.moduleId];

    if (!mod) {
      client.send('craftResult', { success: false, error: 'Unknown module' });
      return;
    }

    // Check recipe: either researched OR has blueprint in inventory
    const [research, bpQty] = await Promise.all([
      getPlayerResearch(auth.userId),
      getInventoryItem(auth.userId, 'blueprint', data.moduleId),
    ]);

    const hasRecipe = research.unlockedModules.includes(data.moduleId) || bpQty >= 1;
    if (!hasRecipe) {
      client.send('craftResult', { success: false, error: 'No recipe available' });
      return;
    }

    // Check and deduct credits
    const creditCost = mod.cost?.credits ?? 0;
    if (creditCost > 0) {
      const credits = await getPlayerCredits(auth.userId);
      if (credits < creditCost) {
        client.send('craftResult', { success: false, error: 'Not enough credits' });
        return;
      }
      await deductCredits(auth.userId, creditCost);
    }

    // Deduct resource costs from inventory
    try {
      if (mod.cost?.ore) await removeFromInventory(auth.userId, 'resource', 'ore', mod.cost.ore);
      if (mod.cost?.gas) await removeFromInventory(auth.userId, 'resource', 'gas', mod.cost.gas);
      if (mod.cost?.crystal)
        await removeFromInventory(auth.userId, 'resource', 'crystal', mod.cost.crystal);
      if (mod.cost?.artefact)
        await removeFromInventory(auth.userId, 'resource', 'artefact', mod.cost.artefact);
    } catch (err) {
      client.send('craftResult', { success: false, error: 'Insufficient resources' });
      return;
    }

    // Produce module
    await addToInventory(auth.userId, 'module', data.moduleId, 1);

    client.send('craftResult', { success: true, moduleId: data.moduleId });
    client.send('logEntry', `HERGESTELLT: ${mod.name ?? data.moduleId}`);
  }

  async handleActivateBlueprint(client: Client, data: { moduleId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    // Check blueprint in unified inventory (type='blueprint')
    const bpQty = await getInventoryItem(auth.userId, 'blueprint', data.moduleId);
    if (bpQty < 1) {
      client.send('researchResult', { success: false, error: 'Blueprint not found' });
      return;
    }

    // Consume blueprint from inventory and add to unlocked research
    await removeFromInventory(auth.userId, 'blueprint', data.moduleId, 1);
    await addUnlockedModule(auth.userId, data.moduleId);

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

  async handleAcepBoost(
    client: Client,
    data: { path: AcepPath },
  ): Promise<void> {
    const VALID_ACEP_PATHS: AcepPath[] = ['ausbau', 'intel', 'kampf', 'explorer'];
    if (!VALID_ACEP_PATHS.includes(data.path)) {
      this.ctx.send(client, 'actionError', 'Ungültiger Pfad');
      return;
    }

    const auth = client.auth as AuthPayload;
    const ship = await getActiveShip(auth.userId);
    if (!ship) {
      this.ctx.send(client, 'actionError', 'Kein aktives Schiff');
      return;
    }

    const error = await boostAcepPath(ship.id, data.path, auth.userId);
    if (error) {
      this.ctx.send(client, 'actionError', error);
      return;
    }

    // Re-push updated ship state (so client ACEP bars refresh)
    await this.handleGetShips(client);
    // Re-push wissen (so client Wissen balance refreshes)
    await this.handleGetResearchState(client);
  }
}
