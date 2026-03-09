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
  RESEARCH_TICK_MS,
} from '@void-sector/shared';
import { getReputationTier } from '../../engine/commands.js';
import { hasShipyard } from '../../engine/npcgen.js';
import { getOrInitStation, getStationLevel } from '../../engine/npcStationEngine.js';
import { getFuelState, saveFuelState } from './RedisAPStore.js';
import { getAcepXpSummary, getAcepEffects } from '../../engine/acepXpService.js';
import {
  addToInventory,
  removeFromInventory,
  getInventoryItem,
} from '../../engine/inventoryService.js';
import {
  getActiveShip,
  getPlayerHomeBase,
  getPlayerShips,
  createShip,
  switchActiveShip,
  updateShipModules,
  renameShip,
  renameBase,
  getInventory,
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
  getStorageInventory,
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
    const qty = await getInventoryItem(auth.userId, 'module', data.moduleId);
    if (qty < 1) {
      client.send('error', { code: 'NO_MODULE', message: 'Module not in inventory' });
      return;
    }
    await removeFromInventory(auth.userId, 'module', data.moduleId, 1);
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
    await addToInventory(auth.userId, 'module', mod.moduleId, 1);
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
    // Add to unified inventory
    await addToInventory(auth.userId, 'module', data.moduleId, 1);
    // Send updates
    const remainingCredits = await getPlayerCredits(auth.userId);
    client.send('creditsUpdate', { credits: remainingCredits });
    client.send('buyModuleResult', { success: true, moduleId: data.moduleId });
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
    const items = await getInventory(auth.userId);
    // Return module IDs as a flat string[] for backward-compatibility with the client
    const modules = items
      .filter((i) => i.itemType === 'module')
      .flatMap((i) => Array(i.quantity).fill(i.itemId) as string[]);
    client.send('moduleInventory', { modules });
  }

  // ── Research Handlers ───────────────────────────────────────────────

  async handleGetResearchState(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const research = await getPlayerResearch(auth.userId);
    const active = await getActiveResearch(auth.userId);
    client.send('researchState', {
      unlockedModules: research.unlockedModules,
      blueprints: research.blueprints,
      activeResearch: active,
    });
  }

  async handleStartResearch(client: Client, data: { moduleId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const mod = MODULES[data.moduleId];
    if (!mod || !mod.researchCost) {
      client.send('researchResult', { success: false, error: 'Invalid module' });
      return;
    }

    // Must be at home base
    const homeBase = await getPlayerHomeBase(auth.userId);
    if (
      !homeBase ||
      homeBase.x !== this.ctx._px(client.sessionId) ||
      homeBase.y !== this.ctx._py(client.sessionId)
    ) {
      client.send('researchResult', { success: false, error: 'Must be at home base' });
      return;
    }

    // Build research state
    const dbResearch = await getPlayerResearch(auth.userId);
    const active = await getActiveResearch(auth.userId);
    const researchState: ResearchState = {
      unlockedModules: dbResearch.unlockedModules,
      blueprints: dbResearch.blueprints,
      activeResearch: active,
    };

    // Get player resources
    const credits = await getPlayerCredits(auth.userId);
    const cargo = await getPlayerCargo(auth.userId);
    const storage = await getStorageInventory(auth.userId);

    const resources = {
      credits,
      ore: cargo.ore + (storage?.ore ?? 0),
      gas: cargo.gas + (storage?.gas ?? 0),
      crystal: cargo.crystal + (storage?.crystal ?? 0),
      artefact: cargo.artefact + (storage?.artefact ?? 0),
    };

    // Check faction tiers for special modules
    const reps = await getPlayerReputations(auth.userId);
    const factionTiers: Record<string, string> = {};
    for (const rep of reps) {
      const tier = getReputationTier(rep.reputation);
      factionTiers[rep.faction_id] = tier;
    }

    const validation = canStartResearch(data.moduleId, researchState, resources, factionTiers);
    if (!validation.valid) {
      client.send('researchResult', { success: false, error: validation.error });
      return;
    }

    // Deduct costs (from credits first, then cargo for resources)
    const cost = mod.researchCost!;
    await deductCredits(auth.userId, cost.credits);
    if (cost.ore) await deductCargo(auth.userId, 'ore', cost.ore);
    if (cost.gas) await deductCargo(auth.userId, 'gas', cost.gas);
    if (cost.crystal) await deductCargo(auth.userId, 'crystal', cost.crystal);
    if (cost.artefact) await deductCargo(auth.userId, 'artefact', cost.artefact);

    // Start research timer
    const now = Date.now();
    const durationMs = (mod.researchDurationMin ?? 5) * RESEARCH_TICK_MS;
    await startActiveResearch(auth.userId, data.moduleId, now, now + durationMs);

    client.send('researchResult', {
      success: true,
      activeResearch: { moduleId: data.moduleId, startedAt: now, completesAt: now + durationMs },
    });
  }

  async handleCancelResearch(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const active = await getActiveResearch(auth.userId);
    if (!active) {
      client.send('researchResult', { success: false, error: 'No active research' });
      return;
    }
    await deleteActiveResearch(auth.userId);
    client.send('researchResult', { success: true, activeResearch: null });
  }

  async handleClaimResearch(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const active = await getActiveResearch(auth.userId);
    if (!active) {
      client.send('researchResult', { success: false, error: 'No active research' });
      return;
    }
    if (Date.now() < active.completesAt) {
      client.send('researchResult', { success: false, error: 'Research not complete' });
      return;
    }

    await addUnlockedModule(auth.userId, active.moduleId);
    await deleteActiveResearch(auth.userId);

    const research = await getPlayerResearch(auth.userId);
    client.send('researchResult', {
      success: true,
      claimed: active.moduleId,
      unlockedModules: research.unlockedModules,
      activeResearch: null,
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
    if (mod.cost?.ore) await removeFromInventory(auth.userId, 'resource', 'ore', mod.cost.ore);
    if (mod.cost?.gas) await removeFromInventory(auth.userId, 'resource', 'gas', mod.cost.gas);
    if (mod.cost?.crystal)
      await removeFromInventory(auth.userId, 'resource', 'crystal', mod.cost.crystal);
    if (mod.cost?.artefact)
      await removeFromInventory(auth.userId, 'resource', 'artefact', mod.cost.artefact);

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
}
