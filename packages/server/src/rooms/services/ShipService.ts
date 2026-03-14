import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { ShipModule } from '@void-sector/shared';

import {
  calculateShipStats,
  validateModuleInstall,
  getActiveDrawbacks,
  isModuleUnlocked,
  MODULES,
  MODULE_HP_BY_TIER,
  BLUEPRINT_COPY_BASE_COST,
} from '@void-sector/shared';
import { awardWissenAndNotify } from '../../engine/wissenService.js';
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
  getPlayerCredits,
  deductCredits,
  getWissen,
} from '../../db/queries.js';
import { getOrCreateTechTree } from '../../db/techTreeQueries.js';

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
    // Install — initialize currentHp to maxHp so the MODULE tab shows a full HP bar
    const modDef = MODULES[data.moduleId];
    const maxHp = modDef?.maxHp ?? MODULE_HP_BY_TIER[modDef?.tier ?? 1] ?? 20;
    const newModules: ShipModule[] = [
      ...ship.modules,
      { moduleId: data.moduleId, slotIndex: data.slotIndex, source: 'standard' as const, currentHp: maxHp },
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
    // Check if module is unlocked (freely available, blueprint, or tech-tree tier)
    const [techTree, dbResearch] = await Promise.all([
      getOrCreateTechTree(auth.userId),
      getPlayerResearch(auth.userId),
    ]);
    if (!isModuleUnlocked(data.moduleId, moduleDef, techTree.researched_nodes, dbResearch.blueprints)) {
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

  async handleCraftModule(client: Client, data: { moduleId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const mod = MODULES[data.moduleId];

    if (!mod) {
      client.send('craftResult', { success: false, error: 'Unknown module' });
      return;
    }

    // Check recipe: either researched OR has blueprint + required tech tree tier
    const [research, bpQty, techTree] = await Promise.all([
      getPlayerResearch(auth.userId),
      getInventoryItem(auth.userId, 'blueprint', data.moduleId),
      getOrCreateTechTree(auth.userId),
    ]);

    const blueprints = bpQty >= 1 ? [data.moduleId] : [];
    const hasRecipe = research.unlockedModules.includes(data.moduleId) ||
      isModuleUnlocked(data.moduleId, mod, techTree.researched_nodes, blueprints);
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
    // Refresh client inventory, cargo, and credits
    client.send('inventoryUpdated', {});
    client.send('cargoUpdate', await getCargoState(auth.userId));
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    awardWissenAndNotify(client, auth.userId, 3);  // +3 per craft
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
    // Refresh client inventory so FabrikPanel updates
    client.send('inventoryUpdated', {});
    client.send(
      'logEntry',
      `BLAUPAUSE AKTIVIERT: ${MODULES[data.moduleId]?.name ?? data.moduleId}`,
    );
  }

  async handleCreateBlueprintCopy(client: Client, data: { moduleId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const mod = MODULES[data.moduleId];
    if (!mod) {
      client.send('blueprintCopyResult', { success: false, error: 'Unknown module' });
      return;
    }

    const research = await getPlayerResearch(auth.userId);
    if (!research.unlockedModules.includes(data.moduleId)) {
      client.send('blueprintCopyResult', { success: false, error: 'Modul nicht erforscht' });
      return;
    }

    const cost = BLUEPRINT_COPY_BASE_COST * mod.tier;
    const credits = await getPlayerCredits(auth.userId);
    if (credits < cost) {
      client.send('blueprintCopyResult', { success: false, error: `Nicht genug Credits (${cost} CR)` });
      return;
    }

    await deductCredits(auth.userId, cost);
    await addToInventory(auth.userId, 'blueprint', data.moduleId, 1);

    client.send('blueprintCopyResult', { success: true, moduleId: data.moduleId, cost });
    client.send('inventoryUpdated', {});
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    client.send('logEntry', `BLUEPRINT KOPIE: ${mod.name ?? data.moduleId} (-${cost} CR)`);
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
    this.ctx.send(client, 'wissenUpdate', { wissen: await getWissen(auth.userId) });
  }
}
