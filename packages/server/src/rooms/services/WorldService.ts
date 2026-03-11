import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type {
  BuildMessage,
  DepositConstructionMessage,
  ConstructionSiteState,
  CreateSlateMessage,
  ActivateSlateMessage,
  NpcBuybackMessage,
  ListSlateMessage,
  UseJumpGateMessage,
  RescueMessage,
  DeliverSurvivorsMessage,
  ConfigureRouteMessage,
  ToggleRouteMessage,
  DeleteRouteMessage,
  SetBookmarkMessage,
  ClearBookmarkMessage,
  MineableResourceType,
  StructureType,
} from '@void-sector/shared';

import { logger } from '../../utils/logger.js';
import { calculateCurrentAP, spendAP } from '../../engine/ap.js';
import {
  validateBuild,
  validateCreateSlate,
  validateNpcBuyback,
  validateLabUpgrade,
} from '../../engine/commands.js';
import {
  checkDistressCall,
  generateDistressCallData,
  calculateRescueReward,
  canRescue,
} from '../../engine/rescue.js';
import {
  isRouteCycleDue,
  calculateRouteFuelCost,
  validateRouteConfig,
} from '../../engine/tradeRoutes.js';
import {
  sectorToQuadrant,
  getOrCreateQuadrant,
  nameQuadrant as nameQuadrantEngine,
  generateQuadrantName,
} from '../../engine/quadrantEngine.js';
import {
  JUMPGATE_FUEL_COST,
  JUMPGATE_BUILD_COST,
  JUMPGATE_UPGRADE_COSTS,
  JUMPGATE_DISTANCE_LIMITS,
  JUMPGATE_CONNECTION_LIMITS,
  STRUCTURE_AP_COSTS,
  STRUCTURE_COSTS,
  RESCUE_AP_COST,
  RESCUE_EXPIRY_MINUTES,
  NPC_PRICES,
  NPC_BUY_SPREAD,
  NPC_SELL_SPREAD,
} from '@void-sector/shared';
import {
  getAPState,
  saveAPState,
  getMiningState,
  getFuelState,
  saveFuelState,
} from './RedisAPStore.js';
import {
  getSector,
  getPlayerDiscoveries,
  addDiscovery,
  createStructure,
  getPlayerBaseStructures,
  getStorageInventory,
  updateStorageResource,
  getPlayerCredits,
  addCredits,
  deductCredits,
  getActiveTradeOrders,
  getPlayerTradeOrders,
  cancelTradeOrder,
  fulfillTradeOrder,
  createDataSlate,
  getPlayerSlates,
  getSlateById,
  deleteSlate,
  updateSlateStatus,
  updateSlateOwner,
  addSlateToCargo,
  removeSlateFromCargo,
  createSlateTradeOrder,
  getTradeOrderById,
  getPlayerStructure,
  getPlayerBookmarks,
  setPlayerBookmark,
  clearPlayerBookmark,
  getJumpGate,
  playerHasGateCode,
  addGateCode,
  getPlayerSurvivors,
  insertRescuedSurvivor,
  deletePlayerSurvivors,
  insertDistressCall,
  insertPlayerDistressCall,
  getPlayerTradeRoutes,
  insertTradeRoute,
  updateTradeRouteActive,
  deleteTradeRoute,
  updateTradeRouteLastCycle,
  getActiveTradeRoutes,
  getPlayerKnownJumpGates,
  getPlayerJumpGate,
  getPlayerJumpGateById,
  insertPlayerJumpGate,
  upgradeJumpGate,
  updateJumpGateToll,
  deleteJumpGate,
  getJumpGateLinks,
  insertJumpGateLink,
  removeJumpGateLink,
  countJumpGateLinks,
  getResearchLabTier,
  upgradeResearchLabTier,
  logExpansionEvent,
} from '../../db/queries.js';
import {
  getCargoState,
  addToInventory,
  removeFromInventory,
} from '../../engine/inventoryService.js';
import {
  getPlayerKnownQuadrants,
  addPlayerKnownQuadrant,
  addPlayerKnownQuadrantsBatch,
  getQuadrant,
  getAllDiscoveredQuadrantCoords,
  playerKnowsQuadrant,
} from '../../db/quadrantQueries.js';
import { isInt, rejectGuest } from './utils.js';
import { addAcepXpForPlayer } from '../../engine/acepXpService.js';
import {
  createConstructionSite,
  getConstructionSite,
  getConstructionSiteById,
  depositResources,
} from '../../db/constructionQueries.js';
import type { ConstructionSite } from '../../db/constructionQueries.js';
import { getWrecksInSector } from '../../engine/permadeathService.js';
import { getUniverseTickCount } from '../../engine/universeBootstrap.js';

function toConstructionSiteState(site: ConstructionSite): ConstructionSiteState {
  return {
    id: site.id,
    type: site.type as StructureType,
    sectorX: site.sector_x,
    sectorY: site.sector_y,
    progress: site.progress,
    neededOre: site.needed_ore,
    neededGas: site.needed_gas,
    neededCrystal: site.needed_crystal,
    depositedOre: site.deposited_ore,
    depositedGas: site.deposited_gas,
    depositedCrystal: site.deposited_crystal,
    paused: site.paused,
  };
}

const VALID_STRUCTURE_TYPES = [
  'comm_relay',
  'mining_station',
  'base',
  'storage',
  'trading_post',
  'defense_turret',
  'station_shield',
  'ion_cannon',
  'factory',
  'research_lab',
  'kontor',
  'jumpgate',
];

export class WorldService {
  constructor(private ctx: ServiceContext) {}

  // ── Simple Data Getters ─────────────────────────────────────────────

  async handleGetAP(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const ap = await getAPState(auth.userId);
    const updated = calculateCurrentAP(ap);
    await saveAPState(auth.userId, updated);
    client.send('apUpdate', updated);
  }

  async handleGetDiscoveries(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const discoveries = await getPlayerDiscoveries(auth.userId);
    client.send('discoveries', discoveries);
  }

  async handleGetCargo(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const cargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', cargo);
  }

  async handleGetMiningStatus(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const mining = await getMiningState(auth.userId);
    client.send('miningUpdate', mining);
  }

  async handleGetBase(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const structures = await getPlayerBaseStructures(auth.userId);
    client.send('baseData', { structures });
  }

  async handleGetCredits(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const credits = await getPlayerCredits(auth.userId);
    client.send('creditsUpdate', { credits });
  }

  async handleGetStorage(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const storage = await getStorageInventory(auth.userId);
    client.send('storageUpdate', storage);
  }

  async handleGetTradeOrders(client: Client): Promise<void> {
    const orders = await getActiveTradeOrders();
    client.send('tradeOrders', { orders });
  }

  async handleGetMyOrders(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const orders = await getPlayerTradeOrders(auth.userId);
    client.send('myOrders', { orders });
  }

  async handleCancelOrder(client: Client, data: { orderId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const cancelled = await cancelTradeOrder(data.orderId, auth.userId);
    client.send('cancelOrderResult', { success: cancelled });
  }

  async handleGetMySlates(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const slates = await getPlayerSlates(auth.userId);
    client.send('mySlates', { slates: slates.map(this.mapSlateRow) });
  }

  // ── Bookmarks ───────────────────────────────────────────────────────

  async handleGetBookmarks(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const bookmarks = await getPlayerBookmarks(auth.userId);
    client.send('bookmarksUpdate', { bookmarks });
  }

  async handleSetBookmark(client: Client, data: SetBookmarkMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    if (data.slot < 1 || data.slot > 5) {
      client.send('error', { code: 'INVALID_SLOT', message: 'Bookmark slot must be 1-5' });
      return;
    }
    await setPlayerBookmark(auth.userId, data.slot, data.sectorX, data.sectorY, data.label);
    const bookmarks = await getPlayerBookmarks(auth.userId);
    client.send('bookmarksUpdate', { bookmarks });
  }

  async handleClearBookmark(client: Client, data: ClearBookmarkMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    await clearPlayerBookmark(auth.userId, data.slot);
    const bookmarks = await getPlayerBookmarks(auth.userId);
    client.send('bookmarksUpdate', { bookmarks });
  }

  // ── Build ───────────────────────────────────────────────────────────

  async handleBuild(client: Client, data: BuildMessage): Promise<void> {
    if (rejectGuest(client, 'Bauen')) return;
    if (!this.ctx.checkRate(client.sessionId, 'build', 2000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    if (!data.type || !VALID_STRUCTURE_TYPES.includes(data.type)) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Invalid structure type' });
      return;
    }
    const auth = client.auth as AuthPayload;

    // Jumpgate goes into the jumpgates table, not structures — handle separately
    if (data.type === 'jumpgate') {
      await this.handleBuildJumpgate(client, auth);
      return;
    }

    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());

    // mining_station uses the construction site path — no upfront resource cost
    if (data.type === 'mining_station') {
      const apCost = STRUCTURE_AP_COSTS['mining_station'];
      const newAP = spendAP(currentAP, apCost, Date.now());
      if (!newAP) {
        client.send('error', { code: 'BUILD_FAIL', message: `Insufficient AP: need ${apCost}` });
        return;
      }

      const sx = this.ctx._px(client.sessionId);
      const sy = this.ctx._py(client.sessionId);

      const existing = await getConstructionSite(sx, sy);
      if (existing) {
        client.send('buildResult', {
          success: false,
          error: 'Construction site already exists in this sector',
        });
        return;
      }

      const costs = STRUCTURE_COSTS['mining_station'];
      let siteId: string;
      try {
        siteId = await createConstructionSite(
          auth.userId,
          'mining_station',
          sx,
          sy,
          costs.ore,
          costs.gas,
          costs.crystal,
        );
        await saveAPState(auth.userId, newAP!);
      } catch (err: any) {
        if (err.code === '23505') {
          client.send('buildResult', {
            success: false,
            error: 'Construction site already exists in this sector',
          });
          return;
        }
        client.send('buildResult', { success: false, error: 'Build failed — try again' });
        return;
      }

      const site = await getConstructionSiteById(siteId);
      const constructionSite = toConstructionSiteState(site!);
      client.send('buildResult', { success: true, constructionSite });
      client.send('apUpdate', newAP!);
      this.ctx.broadcast('constructionSiteCreated', { site: constructionSite });
      addAcepXpForPlayer(auth.userId, 'ausbau', 10).catch(() => {});
      return;
    }

    const cargo = await getCargoState(auth.userId);

    const result = validateBuild(currentAP, cargo, data.type);
    if (!result.valid) {
      client.send('error', { code: 'BUILD_FAIL', message: result.error! });
      return;
    }

    await saveAPState(auth.userId, result.newAP!);

    for (const [resource, amount] of Object.entries(result.costs)) {
      if (amount > 0) {
        try {
          await removeFromInventory(auth.userId, 'resource', resource, amount);
        } catch {
          client.send('buildResult', {
            success: false,
            error: `Insufficient ${resource} (concurrent modification)`,
          });
          return;
        }
      }
    }

    let structure;
    try {
      structure = await createStructure(
        auth.userId,
        data.type,
        this.ctx._px(client.sessionId),
        this.ctx._py(client.sessionId),
      );
    } catch (err: any) {
      if (err.code === '23505') {
        client.send('buildResult', {
          success: false,
          error: 'Structure already exists in this sector',
        });
        return;
      }
      client.send('buildResult', { success: false, error: 'Build failed — try again' });
      return;
    }

    client.send('buildResult', { success: true, structure });
    client.send('apUpdate', result.newAP!);
    const updatedCargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    this.ctx.broadcast('structureBuilt', {
      structure,
      sectorX: this.ctx._px(client.sessionId),
      sectorY: this.ctx._py(client.sessionId),
    });
    // ACEP: AUSBAU-XP for building a structure (spec: station +20, base +15 — using +10 flat here)
    addAcepXpForPlayer(auth.userId, 'ausbau', 10).catch(() => {});
  }

  // ── Construction Site Deposit ───────────────────────────────────────

  async handleDepositConstruction(client: Client, data: DepositConstructionMessage): Promise<void> {
    if (rejectGuest(client, 'Ressourcen liefern')) return;
    if (!this.ctx.checkRate(client.sessionId, 'depositConstruction', 1000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }
    const auth = client.auth as AuthPayload;

    const site = await getConstructionSiteById(data.siteId);
    if (!site) {
      client.send('error', { code: 'INVALID_INPUT', message: 'Construction site not found' });
      return;
    }

    const cargo = await getCargoState(auth.userId);

    // Cap what player can actually deposit (can't deposit more than they have)
    const ore     = Math.max(0, Math.min(data.ore     ?? 0, cargo.ore));
    const gas     = Math.max(0, Math.min(data.gas     ?? 0, cargo.gas));
    const crystal = Math.max(0, Math.min(data.crystal ?? 0, cargo.crystal));

    // Cap at what's still needed
    const capOre     = Math.min(ore,     Math.max(0, site.needed_ore     - site.deposited_ore));
    const capGas     = Math.min(gas,     Math.max(0, site.needed_gas     - site.deposited_gas));
    const capCrystal = Math.min(crystal, Math.max(0, site.needed_crystal - site.deposited_crystal));

    if (capOre + capGas + capCrystal === 0) {
      client.send('depositResult', { success: false, error: 'No resources needed or available' });
      return;
    }

    // Multi-player delivery: any player can deposit to any site (by design).
    // No sector-proximity check required per issue #231 spec.
    if (capOre     > 0) await removeFromInventory(auth.userId, 'resource', 'ore',     capOre);
    if (capGas     > 0) await removeFromInventory(auth.userId, 'resource', 'gas',     capGas);
    if (capCrystal > 0) await removeFromInventory(auth.userId, 'resource', 'crystal', capCrystal);

    await depositResources(data.siteId, capOre, capGas, capCrystal);

    const updatedSite = await getConstructionSiteById(data.siteId);
    const siteState = toConstructionSiteState(updatedSite!);
    client.send('constructionSiteUpdate', siteState);

    const updatedCargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', updatedCargo);
    client.send('depositResult', { success: true });
  }

  // ── Research Lab Upgrade ────────────────────────────────────────────

  async handleUpgradeResearchLab(client: Client): Promise<void> {
    if (rejectGuest(client, 'Labor-Upgrade')) return;
    if (!this.ctx.checkRate(client.sessionId, 'upgradeResearchLab', 3000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Too fast' });
      return;
    }

    const auth = client.auth as AuthPayload;
    const sx = this.ctx._px(client.sessionId);
    const sy = this.ctx._py(client.sessionId);

    const [labTier, ap, cargo, credits] = await Promise.all([
      getResearchLabTier(auth.userId),
      getAPState(auth.userId),
      getCargoState(auth.userId),
      getPlayerCredits(auth.userId),
    ]);

    const currentAP = calculateCurrentAP(ap, Date.now());
    const result = validateLabUpgrade(labTier, currentAP.current, credits, cargo);

    if (!result.valid) {
      client.send('error', { code: 'LAB_UPGRADE_FAIL', message: result.error! });
      return;
    }

    // Deduct costs
    await deductCredits(auth.userId, result.costs!.credits);
    await removeFromInventory(auth.userId, 'resource', 'ore', result.costs!.ore);
    await removeFromInventory(auth.userId, 'resource', 'crystal', result.costs!.crystal);
    const newAP = { ...currentAP, current: currentAP.current - 20 };
    await saveAPState(auth.userId, newAP);

    // Upgrade the lab at player's current position
    const newTier = await upgradeResearchLabTier(auth.userId, sx, sy);
    if (!newTier) {
      client.send('error', {
        code: 'LAB_UPGRADE_FAIL',
        message: 'No research lab at your location',
      });
      return;
    }

    client.send('labUpgradeResult', { success: true, newTier });
    client.send('apUpdate', newAP);
    const updatedCargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', updatedCargo);
  }

  // ── Jumpgate Build ─────────────────────────────────────────────────

  private async handleBuildJumpgate(client: Client, auth: AuthPayload): Promise<void> {
    const sx = this.ctx._px(client.sessionId);
    const sy = this.ctx._py(client.sessionId);

    // Check no existing player gate at this sector
    const existingGate = await getPlayerJumpGate(sx, sy);
    if (existingGate) {
      client.send('buildResult', { success: false, error: 'Jumpgate already exists here' });
      return;
    }

    // Check for world gate
    const worldGate = await getJumpGate(sx, sy);
    if (worldGate) {
      client.send('buildResult', { success: false, error: 'World gate already exists here' });
      return;
    }

    // Check credits
    const credits = await getPlayerCredits(auth.userId);
    if (credits < JUMPGATE_BUILD_COST.credits) {
      client.send('buildResult', {
        success: false,
        error: `Need ${JUMPGATE_BUILD_COST.credits} credits`,
      });
      return;
    }

    // Check artefacts
    const cargoState = await getCargoState(auth.userId);
    if ((cargoState.artefact ?? 0) < JUMPGATE_BUILD_COST.artefact) {
      client.send('buildResult', {
        success: false,
        error: `Need ${JUMPGATE_BUILD_COST.artefact} artefacts`,
      });
      return;
    }

    // Check crystal (from STRUCTURE_COSTS)
    if ((cargoState.crystal ?? 0) < JUMPGATE_BUILD_COST.crystal) {
      client.send('buildResult', {
        success: false,
        error: `Need ${JUMPGATE_BUILD_COST.crystal} crystal`,
      });
      return;
    }

    // Deduct AP
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const newAP = spendAP(currentAP, STRUCTURE_AP_COSTS.jumpgate);
    if (!newAP) {
      client.send('buildResult', { success: false, error: 'Not enough AP' });
      return;
    }
    await saveAPState(auth.userId, newAP);

    // Deduct all resources
    await deductCredits(auth.userId, JUMPGATE_BUILD_COST.credits);
    await removeFromInventory(auth.userId, 'resource', 'artefact', JUMPGATE_BUILD_COST.artefact);
    await removeFromInventory(auth.userId, 'resource', 'crystal', JUMPGATE_BUILD_COST.crystal);

    // Insert into jumpgates table
    const gateId = `pgate_${sx}_${sy}`;
    await insertPlayerJumpGate({ id: gateId, sectorX: sx, sectorY: sy, ownerId: auth.userId });

    client.send('buildResult', {
      success: true,
      structure: { id: gateId, type: 'jumpgate', sectorX: sx, sectorY: sy },
    });
    client.send('apUpdate', newAP);
    client.send('cargoUpdate', await getCargoState(auth.userId));
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    client.send('logEntry', `Jumpgate errichtet bei (${sx}, ${sy})`);
  }

  // ── Jumpgate Upgrade / Dismantle / Toll ───────────────────────────

  async handleUpgradeJumpgate(
    client: Client,
    data: { gateId: string; upgradeType: string },
  ): Promise<void> {
    if (rejectGuest(client, 'Upgraden')) return;
    const auth = client.auth as AuthPayload;

    const gate = await getPlayerJumpGateById(data.gateId);
    if (!gate || gate.ownerId !== auth.userId) {
      client.send('error', { code: 'UPGRADE_FAIL', message: 'Not your gate' });
      return;
    }

    const costs = JUMPGATE_UPGRADE_COSTS[data.upgradeType];
    if (!costs) {
      client.send('error', { code: 'UPGRADE_FAIL', message: 'Invalid upgrade type' });
      return;
    }

    // Determine which field and new level
    let field: 'level_connection' | 'level_distance';
    let currentLevel: number;
    if (data.upgradeType.startsWith('connection_')) {
      field = 'level_connection';
      currentLevel = gate.levelConnection;
    } else {
      field = 'level_distance';
      currentLevel = gate.levelDistance;
    }

    const targetLevel = parseInt(data.upgradeType.split('_')[1], 10);
    if (currentLevel >= targetLevel) {
      client.send('error', { code: 'UPGRADE_FAIL', message: 'Already at this level or higher' });
      return;
    }
    if (targetLevel !== currentLevel + 1) {
      client.send('error', { code: 'UPGRADE_FAIL', message: 'Must upgrade sequentially' });
      return;
    }

    // Check resources
    const credits = await getPlayerCredits(auth.userId);
    if (credits < (costs.credits ?? 0)) {
      client.send('error', { code: 'UPGRADE_FAIL', message: 'Not enough credits' });
      return;
    }
    const cargo = await getCargoState(auth.userId);
    for (const [resource, amount] of Object.entries(costs)) {
      if (resource === 'credits' || !amount) continue;
      if ((cargo[resource as keyof typeof cargo] ?? 0) < amount) {
        client.send('error', { code: 'UPGRADE_FAIL', message: `Not enough ${resource}` });
        return;
      }
    }

    // Deduct
    await deductCredits(auth.userId, costs.credits ?? 0);
    for (const [resource, amount] of Object.entries(costs)) {
      if (resource === 'credits' || !amount) continue;
      await removeFromInventory(auth.userId, 'resource', resource, amount);
    }

    await upgradeJumpGate(data.gateId, field, targetLevel);

    client.send('jumpgateUpdated', {
      success: true,
      gateId: data.gateId,
      field,
      newLevel: targetLevel,
    });
    client.send('cargoUpdate', await getCargoState(auth.userId));
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    client.send(
      'logEntry',
      `Jumpgate ${field === 'level_connection' ? 'Verbindung' : 'Distanz'} auf Level ${targetLevel} aufgerüstet`,
    );
  }

  async handleDismantleJumpgate(client: Client, data: { gateId: string }): Promise<void> {
    if (rejectGuest(client, 'Abbauen')) return;
    const auth = client.auth as AuthPayload;

    const gate = await getPlayerJumpGateById(data.gateId);
    if (!gate || gate.ownerId !== auth.userId) {
      client.send('error', { code: 'DISMANTLE_FAIL', message: 'Not your gate' });
      return;
    }

    // Calculate 50% refund of total invested resources
    let totalCredits = JUMPGATE_BUILD_COST.credits;
    let totalOre = 0;
    let totalCrystal = JUMPGATE_BUILD_COST.crystal;
    let totalArtefact = JUMPGATE_BUILD_COST.artefact;

    for (let lvl = 2; lvl <= gate.levelConnection; lvl++) {
      const upgCosts = JUMPGATE_UPGRADE_COSTS[`connection_${lvl}`];
      if (upgCosts) {
        totalCredits += upgCosts.credits ?? 0;
        totalOre += upgCosts.ore ?? 0;
        totalArtefact += upgCosts.artefact ?? 0;
      }
    }
    for (let lvl = 2; lvl <= gate.levelDistance; lvl++) {
      const upgCosts = JUMPGATE_UPGRADE_COSTS[`distance_${lvl}`];
      if (upgCosts) {
        totalCredits += upgCosts.credits ?? 0;
        totalCrystal += upgCosts.crystal ?? 0;
        totalArtefact += upgCosts.artefact ?? 0;
      }
    }

    const refund = {
      credits: Math.floor(totalCredits / 2),
      ore: Math.floor(totalOre / 2),
      crystal: Math.floor(totalCrystal / 2),
      artefact: Math.floor(totalArtefact / 2),
    };

    // Delete gate (links cascade)
    await deleteJumpGate(data.gateId);

    // Return resources
    await addCredits(auth.userId, refund.credits);
    if (refund.ore > 0) await addToInventory(auth.userId, 'resource', 'ore', refund.ore);
    if (refund.crystal > 0)
      await addToInventory(auth.userId, 'resource', 'crystal', refund.crystal);
    if (refund.artefact > 0)
      await addToInventory(auth.userId, 'resource', 'artefact', refund.artefact);

    client.send('jumpgateDismantled', { success: true, refund });
    client.send('cargoUpdate', await getCargoState(auth.userId));
    client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
    client.send('logEntry', `Jumpgate abgebaut. Rückerstattung: ${refund.credits} CR`);
  }

  async handleSetJumpgateToll(
    client: Client,
    data: { gateId: string; toll: number },
  ): Promise<void> {
    if (rejectGuest(client, 'Maut setzen')) return;
    const auth = client.auth as AuthPayload;

    if (typeof data.toll !== 'number' || data.toll < 0 || !Number.isInteger(data.toll)) {
      client.send('error', { code: 'TOLL_FAIL', message: 'Invalid toll amount' });
      return;
    }

    const gate = await getPlayerJumpGateById(data.gateId);
    if (!gate || gate.ownerId !== auth.userId) {
      client.send('error', { code: 'TOLL_FAIL', message: 'Not your gate' });
      return;
    }

    await updateJumpGateToll(data.gateId, data.toll);
    client.send('jumpgateUpdated', { success: true, gateId: data.gateId, tollCredits: data.toll });
    client.send('logEntry', `Maut auf ${data.toll} CR gesetzt`);
  }

  // ── Slate Handlers ──────────────────────────────────────────────────

  private mapSlateRow(row: any) {
    return {
      id: row.id,
      creatorId: row.creator_id,
      creatorName: row.creator_name,
      ownerId: row.owner_id,
      slateType: row.slate_type,
      sectorData: row.sector_data,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  async handleCreateSlate(client: Client, data: CreateSlateMessage): Promise<void> {
    if (rejectGuest(client, 'Data Slates erstellen')) return;
    const auth = client.auth as AuthPayload;
    if (!['sector', 'area', 'jumpgate'].includes(data.slateType)) {
      client.send('createSlateResult', { success: false, error: 'Invalid slate type' });
      return;
    }

    const ship = this.ctx.getShipForClient(client.sessionId);
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    const cargo = await getCargoState(auth.userId);
    const validation = validateCreateSlate(
      {
        ap: currentAP.current,
        scannerLevel: ship.scannerLevel,
        slateCount: cargo.slates,
        memory: ship.memory,
      },
      data.slateType,
    );
    if (!validation.valid) {
      client.send('createSlateResult', { success: false, error: validation.error });
      return;
    }

    // Gather sector data
    let sectorData: any[];
    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);

    if (data.slateType === 'jumpgate') {
      const gate = await getPlayerJumpGate(sectorX, sectorY);
      if (!gate || gate.ownerId !== auth.userId) {
        client.send('createSlateResult', {
          success: false,
          error: 'You must be at your own jumpgate',
        });
        return;
      }
      sectorData = [
        {
          gateId: gate.id,
          sectorX,
          sectorY,
          ownerName: auth.username,
        },
      ];
    } else if (data.slateType === 'sector') {
      const sector = await getSector(sectorX, sectorY);
      const resources = sector?.resources ?? { ore: 0, gas: 0, crystal: 0 };
      sectorData = [
        {
          x: sectorX,
          y: sectorY,
          type: sector?.type ?? 'empty',
          ore: resources.ore ?? 0,
          gas: resources.gas ?? 0,
          crystal: resources.crystal ?? 0,
        },
      ];
    } else {
      const radius = validation.radius!;
      const discoveries = await getPlayerDiscoveries(auth.userId);
      sectorData = [];
      for (const disc of discoveries) {
        if (Math.abs(disc.x - sectorX) <= radius && Math.abs(disc.y - sectorY) <= radius) {
          const sector = await getSector(disc.x, disc.y);
          if (sector) {
            const resources = sector.resources ?? { ore: 0, gas: 0, crystal: 0 };
            sectorData.push({
              x: disc.x,
              y: disc.y,
              type: sector.type ?? 'empty',
              ore: resources.ore ?? 0,
              gas: resources.gas ?? 0,
              crystal: resources.crystal ?? 0,
            });
          }
        }
      }
    }

    if (sectorData.length === 0) {
      client.send('createSlateResult', { success: false, error: 'No sector data to record' });
      return;
    }

    // Deduct AP
    currentAP.current -= validation.apCost!;
    await saveAPState(auth.userId, currentAP);

    // Create slate + add to cargo
    const slate = await createDataSlate(auth.userId, data.slateType, sectorData);
    await addSlateToCargo(auth.userId);
    const updatedCargo = await getCargoState(auth.userId);

    client.send('createSlateResult', {
      success: true,
      slate: { id: slate.id, slateType: data.slateType, sectorData, status: 'available' },
      cargo: updatedCargo,
      ap: currentAP.current,
    });
    client.send('apUpdate', currentAP);
  }

  async handleCreateSlateFromScan(client: Client): Promise<void> {
    if (rejectGuest(client, 'Scan-Slates erstellen')) return;
    const auth = client.auth as AuthPayload;

    // Memory check
    const ship = this.ctx.getShipForClient(client.sessionId);
    const cargo = await getCargoState(auth.userId);
    if (cargo.slates >= ship.memory) {
      client.send('slateFromScanResult', { success: false, error: 'MEMORY_FULL' });
      return;
    }

    // Build sector data from server state (no trust on client data)
    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);
    const sector = await getSector(sectorX, sectorY);
    const resources = sector?.resources ?? { ore: 0, gas: 0, crystal: 0 };

    // Derive structures
    const structures: string[] = [];
    if (sector?.type === 'station') structures.push('npc_station');
    if (sector?.contents?.includes('ruin')) structures.push('ruin');
    const jumpgate = await getPlayerJumpGate(sectorX, sectorY);
    if (jumpgate) structures.push('jumpgate');

    // Get wrecks
    const wrecks = await getWrecksInSector(this.ctx.quadrantX, this.ctx.quadrantY, sectorX, sectorY);

    const sectorData = [{
      x: sectorX,
      y: sectorY,
      quadrantX: this.ctx.quadrantX,
      quadrantY: this.ctx.quadrantY,
      type: sector?.type ?? 'empty',
      ore: resources.ore ?? 0,
      gas: resources.gas ?? 0,
      crystal: resources.crystal ?? 0,
      structures,
      wrecks: wrecks.map((w) => ({ playerName: w.playerName, tier: w.radarIconData?.tier ?? 1 })),
      scannedAtTick: getUniverseTickCount(),
    }];

    // Create slate + add to cargo
    await createDataSlate(auth.userId, 'scan', sectorData);
    await addSlateToCargo(auth.userId);
    const updatedCargo = await getCargoState(auth.userId);

    client.send('slateFromScanResult', { success: true });
    client.send('cargoUpdate', updatedCargo);
  }

  async handleActivateSlate(client: Client, data: ActivateSlateMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const slate = await getSlateById(data.slateId);

    if (!slate || slate.owner_id !== auth.userId) {
      client.send('activateSlateResult', { success: false, error: 'Slate not found' });
      return;
    }
    if (slate.status !== 'available') {
      client.send('activateSlateResult', { success: false, error: 'Slate is listed on market' });
      return;
    }

    // Add sectors to discoveries
    const sectors = slate.sector_data as any[];
    for (const s of sectors) {
      await addDiscovery(auth.userId, s.x, s.y);
    }

    // Remove from cargo + delete slate
    await removeSlateFromCargo(auth.userId);
    await deleteSlate(data.slateId);

    client.send('activateSlateResult', { success: true, sectorsAdded: sectors.length });
    const cargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', cargo);
  }

  async handleLinkJumpgate(client: Client, data: { slateId: string }): Promise<void> {
    if (rejectGuest(client, 'Verknüpfen')) return;
    const auth = client.auth as AuthPayload;

    // Get player's gate at current sector
    const sx = this.ctx._px(client.sessionId);
    const sy = this.ctx._py(client.sessionId);
    const myGate = await getPlayerJumpGate(sx, sy);
    if (!myGate || myGate.ownerId !== auth.userId) {
      client.send('error', { code: 'LINK_FAIL', message: 'You must be at your own jumpgate' });
      return;
    }

    // Get slate from cargo
    const slate = await getSlateById(data.slateId);
    if (!slate || slate.owner_id !== auth.userId || slate.slate_type !== 'jumpgate') {
      client.send('error', { code: 'LINK_FAIL', message: 'Jumpgate slate not found in cargo' });
      return;
    }
    if (slate.status !== 'available') {
      client.send('error', { code: 'LINK_FAIL', message: 'Slate is listed on market' });
      return;
    }

    // Extract target gate info from the slate's metadata
    const slateMeta = (slate.sector_data as any[])[0];
    const targetGateId = slateMeta.gateId;

    // Look up the target gate by ID
    const targetGate = await getPlayerJumpGateById(targetGateId);
    if (!targetGate || !targetGate.ownerId) {
      client.send('error', { code: 'LINK_FAIL', message: 'Target gate no longer exists' });
      return;
    }

    // Prevent self-linking
    if (myGate.id === targetGateId) {
      client.send('error', { code: 'LINK_FAIL', message: 'Cannot link a gate to itself' });
      return;
    }

    // Check distance (Manhattan distance)
    const dist =
      Math.abs(myGate.sectorX - targetGate.sectorX) + Math.abs(myGate.sectorY - targetGate.sectorY);
    const maxDist =
      JUMPGATE_DISTANCE_LIMITS[myGate.levelDistance] +
      JUMPGATE_DISTANCE_LIMITS[targetGate.levelDistance];
    if (dist > maxDist) {
      client.send('error', {
        code: 'LINK_FAIL',
        message: `Distance ${dist} exceeds max range ${maxDist}`,
      });
      return;
    }

    // Check connection slots on both gates
    const myLinks = await countJumpGateLinks(myGate.id);
    if (myLinks >= JUMPGATE_CONNECTION_LIMITS[myGate.levelConnection]) {
      client.send('error', { code: 'LINK_FAIL', message: 'No free connection slots on your gate' });
      return;
    }
    const targetLinks = await countJumpGateLinks(targetGateId);
    if (targetLinks >= JUMPGATE_CONNECTION_LIMITS[targetGate.levelConnection]) {
      client.send('error', {
        code: 'LINK_FAIL',
        message: 'Target gate has no free connection slots',
      });
      return;
    }

    // Create bidirectional link, consume the slate
    await insertJumpGateLink(myGate.id, targetGateId);
    await removeSlateFromCargo(auth.userId);
    await deleteSlate(data.slateId);

    client.send('jumpgateLinkResult', { success: true });
    client.send('cargoUpdate', await getCargoState(auth.userId));
    client.send('logEntry', `Gate bei (${targetGate.sectorX}, ${targetGate.sectorY}) verknüpft`);
  }

  async handleUnlinkJumpgate(
    client: Client,
    data: { gateId: string; linkedGateId: string },
  ): Promise<void> {
    if (rejectGuest(client, 'Trennen')) return;
    const auth = client.auth as AuthPayload;

    // Verify ownership of the gate being unlinked from
    const gate = await getPlayerJumpGateById(data.gateId);
    if (!gate || gate.ownerId !== auth.userId) {
      client.send('error', { code: 'UNLINK_FAIL', message: 'Not your gate' });
      return;
    }

    // Look up the linked gate to get its info for the returned slate
    const linkedGate = await getPlayerJumpGateById(data.linkedGateId);
    if (!linkedGate) {
      client.send('error', { code: 'UNLINK_FAIL', message: 'Linked gate not found' });
      return;
    }

    await removeJumpGateLink(data.gateId, data.linkedGateId);

    // Return a jumpgate data slate to the player
    const slateData = [
      {
        gateId: linkedGate.id,
        sectorX: linkedGate.sectorX,
        sectorY: linkedGate.sectorY,
        ownerName: linkedGate.ownerName ?? 'Unknown',
      },
    ];
    await createDataSlate(auth.userId, 'jumpgate', slateData);
    await addSlateToCargo(auth.userId);

    client.send('jumpgateUnlinkResult', { success: true });
    client.send('cargoUpdate', await getCargoState(auth.userId));
    client.send('logEntry', 'Verbindung getrennt. Gate-Slate zurückerhalten.');
  }

  async handleNpcBuyback(client: Client, data: NpcBuybackMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    const slate = await getSlateById(data.slateId);

    if (!slate || slate.owner_id !== auth.userId || slate.status !== 'available') {
      client.send('npcBuybackResult', { success: false, error: 'Slate not found or unavailable' });
      return;
    }

    const sectorCount = (slate.sector_data as any[]).length;
    const validation = validateNpcBuyback(!!tradingPost, sectorCount);
    if (!validation.valid) {
      client.send('npcBuybackResult', { success: false, error: validation.error });
      return;
    }

    await addCredits(auth.userId, validation.payout!);
    await removeSlateFromCargo(auth.userId);
    await deleteSlate(data.slateId);

    const credits = await getPlayerCredits(auth.userId);
    client.send('npcBuybackResult', { success: true, credits, creditsEarned: validation.payout });
    const cargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', cargo);
  }

  async handleListSlate(client: Client, data: ListSlateMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    if (!tradingPost || tradingPost.tier < 2) {
      client.send('error', { code: 'NO_MARKET', message: 'Need Trading Post Tier 2' });
      return;
    }

    const slate = await getSlateById(data.slateId);
    if (!slate || slate.owner_id !== auth.userId || slate.status !== 'available') {
      client.send('error', { code: 'INVALID_SLATE', message: 'Slate not found or already listed' });
      return;
    }

    await updateSlateStatus(data.slateId, 'listed');
    await removeSlateFromCargo(auth.userId);
    await createSlateTradeOrder(auth.userId, data.slateId, data.price);

    client.send('orderPlaced', { success: true });
    const cargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', cargo);
  }

  async handleAcceptSlateOrder(client: Client, data: { orderId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const order = await getTradeOrderById(data.orderId);
    if (!order || order.fulfilled || order.resource !== 'slate') {
      client.send('error', { code: 'INVALID_ORDER', message: 'Order not found' });
      return;
    }

    const buyerCredits = await getPlayerCredits(auth.userId);
    if (buyerCredits < order.price_per_unit) {
      client.send('error', { code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits' });
      return;
    }

    const cargo = await getCargoState(auth.userId);
    const ship = this.ctx.getShipForClient(client.sessionId);
    if (cargo.slates >= ship.memory) {
      client.send('error', { code: 'MEMORY_FULL', message: 'Memory full — no space for slate' });
      return;
    }

    await deductCredits(auth.userId, order.price_per_unit);
    await addCredits(order.player_id, order.price_per_unit);
    await updateSlateOwner(order.slate_id, auth.userId);
    await addSlateToCargo(auth.userId);
    await fulfillTradeOrder(data.orderId);

    client.send('slateOrderAccepted', { success: true });
    const updatedCredits = await getPlayerCredits(auth.userId);
    client.send('creditsUpdate', { credits: updatedCredits });
    const updatedCargo = await getCargoState(auth.userId);
    client.send('cargoUpdate', updatedCargo);
  }

  // ── Jump Gate Handlers ──────────────────────────────────────────────

  async handleUseJumpGate(client: Client, data: UseJumpGateMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const { gateId, accessCode } = data;

    const gate = await getJumpGate(this.ctx._px(client.sessionId), this.ctx._py(client.sessionId));
    if (!gate || gate.id !== gateId) {
      client.send('useJumpGateResult', { success: false, error: 'No gate at this location' });
      return;
    }

    // Check code
    if (gate.requiresCode) {
      const hasCode = await playerHasGateCode(auth.userId, gateId);
      if (!hasCode) {
        if (!accessCode || accessCode !== gate.accessCode) {
          client.send('useJumpGateResult', { success: false, error: 'Invalid access code' });
          return;
        }
        await addGateCode(auth.userId, gateId);
      }
    }

    // Check minigame requirement
    if (gate.requiresMinigame) {
      client.send('useJumpGateResult', { success: true, requiresMinigame: true });
      return;
    }

    // Deduct fuel
    const currentFuel = await getFuelState(auth.userId);
    if (currentFuel === null || currentFuel < JUMPGATE_FUEL_COST) {
      client.send('useJumpGateResult', { success: false, error: 'Not enough fuel' });
      return;
    }
    await saveFuelState(auth.userId, currentFuel - JUMPGATE_FUEL_COST);

    client.send('useJumpGateResult', {
      success: true,
      targetX: gate.targetX,
      targetY: gate.targetY,
      fuel: {
        current: currentFuel - JUMPGATE_FUEL_COST,
        max: this.ctx.getShipForClient(client.sessionId).fuelMax,
      },
    });
  }

  async handleFrequencyMatch(
    client: Client,
    data: { gateId: string; matched: boolean },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;

    if (!data.matched) {
      client.send('useJumpGateResult', { success: false, error: 'Frequency match failed' });
      return;
    }

    const gate = await getJumpGate(this.ctx._px(client.sessionId), this.ctx._py(client.sessionId));
    if (!gate || gate.id !== data.gateId) {
      client.send('useJumpGateResult', { success: false, error: 'Gate not found' });
      return;
    }

    const currentFuel = await getFuelState(auth.userId);
    if (currentFuel === null || currentFuel < JUMPGATE_FUEL_COST) {
      client.send('useJumpGateResult', { success: false, error: 'Not enough fuel' });
      return;
    }
    await saveFuelState(auth.userId, currentFuel - JUMPGATE_FUEL_COST);

    client.send('useJumpGateResult', {
      success: true,
      targetX: gate.targetX,
      targetY: gate.targetY,
      fuel: {
        current: currentFuel - JUMPGATE_FUEL_COST,
        max: this.ctx.getShipForClient(client.sessionId).fuelMax,
      },
    });
  }

  // ── Rescue Handlers ─────────────────────────────────────────────────

  async handleRescue(client: Client, data: RescueMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const ship = this.ctx.getShipForClient(client.sessionId);

    // Must be at the sector
    if (
      data.sectorX !== this.ctx._px(client.sessionId) ||
      data.sectorY !== this.ctx._py(client.sessionId)
    ) {
      client.send('rescueResult', { success: false, error: 'Not at rescue location' });
      return;
    }

    // Check safe slots
    const survivors = await getPlayerSurvivors(auth.userId);
    const safeSlots = (ship as any).safeSlots ?? 1;
    if (!canRescue(safeSlots, survivors.length)) {
      client.send('rescueResult', { success: false, error: 'No free safe slots' });
      return;
    }

    // Check AP
    const ap = await getAPState(auth.userId);
    const currentAP = calculateCurrentAP(ap, Date.now());
    if (currentAP.current < RESCUE_AP_COST) {
      client.send('rescueResult', { success: false, error: 'Not enough AP' });
      return;
    }
    const newAP = { ...currentAP, current: currentAP.current - RESCUE_AP_COST };
    await saveAPState(auth.userId, newAP);

    // Add survivor
    const id = `rescue_${auth.userId}_${Date.now()}`;
    await insertRescuedSurvivor(id, auth.userId, data.sectorX, data.sectorY, 1, 'scan_event');

    client.send('rescueResult', {
      success: true,
      survivorsRescued: 1,
      safeSlotsFree: safeSlots - survivors.length - 1,
    });
    client.send('apUpdate', { current: newAP.current, max: newAP.max });
  }

  async handleDeliverSurvivors(client: Client, data: DeliverSurvivorsMessage): Promise<void> {
    const auth = client.auth as AuthPayload;

    // Must be at a station
    if (this.ctx._pst(client.sessionId) !== 'station') {
      client.send('deliverSurvivorsResult', { success: false, error: 'Must be at a station' });
      return;
    }

    const survivors = await getPlayerSurvivors(auth.userId);
    if (survivors.length === 0) {
      client.send('deliverSurvivorsResult', { success: false, error: 'No survivors to deliver' });
      return;
    }

    // Calculate rewards
    let totalCredits = 0,
      totalRep = 0,
      totalXp = 0;
    for (const s of survivors) {
      const reward = calculateRescueReward(
        s.sourceType as 'scan_event' | 'npc_quest' | 'comm_distress',
      );
      totalCredits += reward.credits * s.survivorCount;
      totalRep += reward.rep * s.survivorCount;
      totalXp += reward.xp * s.survivorCount;
    }

    await deletePlayerSurvivors(auth.userId);
    await addCredits(auth.userId, totalCredits);
    await this.ctx.applyXpGain(auth.userId, totalXp, client);

    client.send('deliverSurvivorsResult', {
      success: true,
      credits: totalCredits,
      rep: totalRep,
      xp: totalXp,
    });
  }

  // ── Distress Call Detection ─────────────────────────────────────────

  async checkAndEmitDistressCalls(
    client: Client,
    userId: string,
    playerX: number,
    playerY: number,
  ): Promise<void> {
    const ship = this.ctx.getShipForClient(client.sessionId);
    const commRange = ship.commRange;

    // Check nearby sectors for distress calls
    const searchRadius = Math.ceil(commRange / 10);
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const sx = playerX + dx;
        const sy = playerY + dy;
        if (dx === 0 && dy === 0) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > commRange) continue;

        if (checkDistressCall(sx, sy)) {
          const distressId = `distress_${sx}_${sy}`;
          const expiresAt = new Date(Date.now() + RESCUE_EXPIRY_MINUTES * 60 * 1000);

          try {
            await insertDistressCall(distressId, sx, sy, 1, expiresAt);
          } catch {
            /* already exists */
          }

          const callData = generateDistressCallData(playerX, playerY, sx, sy);
          await insertPlayerDistressCall(
            userId,
            distressId,
            callData.direction,
            callData.estimatedDistance,
          );

          client.send('distressCallReceived', {
            id: distressId,
            direction: callData.direction,
            estimatedDistance: callData.estimatedDistance,
            receivedAt: Date.now(),
            expiresAt: expiresAt.getTime(),
            targetX: sx,
            targetY: sy,
          });
        }
      }
    }
  }

  // ── Trade Route Handlers ────────────────────────────────────────────

  async handleConfigureRoute(client: Client, data: ConfigureRouteMessage): Promise<void> {
    const auth = client.auth as AuthPayload;

    // Validate trading post
    const tradingPost = await getPlayerStructure(auth.userId, 'trading_post');
    if (!tradingPost) {
      client.send('configureRouteResult', { success: false, error: 'Trading post not found' });
      return;
    }

    // Validate config
    const routes = await getPlayerTradeRoutes(auth.userId);
    const validation = validateRouteConfig({
      cycleMinutes: data.cycleMinutes,
      routeCount: routes.length,
    });
    if (!validation.valid) {
      client.send('configureRouteResult', { success: false, error: validation.error });
      return;
    }

    const id = `route_${auth.userId}_${Date.now()}`;
    await insertTradeRoute({
      id,
      ownerId: auth.userId,
      tradingPostId: tradingPost.id,
      targetX: data.targetX,
      targetY: data.targetY,
      sellResource: data.sellResource,
      sellAmount: data.sellAmount,
      buyResource: data.buyResource,
      buyAmount: data.buyAmount,
      cycleMinutes: data.cycleMinutes,
    });

    const route = {
      id,
      ownerId: auth.userId,
      tradingPostId: tradingPost.id,
      targetX: data.targetX,
      targetY: data.targetY,
      sellResource: data.sellResource,
      sellAmount: data.sellAmount,
      buyResource: data.buyResource,
      buyAmount: data.buyAmount,
      cycleMinutes: data.cycleMinutes,
      active: true,
      lastCycleAt: null,
    };

    client.send('configureRouteResult', { success: true, route });
  }

  async handleToggleRoute(client: Client, data: ToggleRouteMessage): Promise<void> {
    await updateTradeRouteActive(data.routeId, data.active);
    client.send('toggleRouteResult', { success: true });
  }

  async handleDeleteRoute(client: Client, data: DeleteRouteMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const deleted = await deleteTradeRoute(data.routeId, auth.userId);
    client.send('deleteRouteResult', {
      success: deleted,
      error: deleted ? undefined : 'Route not found',
    });
  }

  async processTradeRoutes(): Promise<void> {
    const routes = await getActiveTradeRoutes();

    // Group routes by owner to avoid repeated queries
    const routesByOwner = new Map<string, typeof routes>();
    for (const route of routes) {
      const ownerRoutes = routesByOwner.get(route.ownerId) ?? [];
      ownerRoutes.push(route);
      routesByOwner.set(route.ownerId, ownerRoutes);
    }

    for (const [ownerId, ownerRoutes] of routesByOwner) {
      try {
        // Load owner data once
        const tradingPost = await getPlayerStructure(ownerId, 'trading_post');
        if (!tradingPost) {
          for (const r of ownerRoutes) await updateTradeRouteActive(r.id, false);
          continue;
        }

        let currentFuel = await getFuelState(ownerId);

        for (const route of ownerRoutes) {
          const lastCycle = route.lastCycleAt ? new Date(route.lastCycleAt).getTime() : null;
          if (!isRouteCycleDue(lastCycle, route.cycleMinutes)) continue;

          try {
            // Calculate fuel cost
            const fuelCost = calculateRouteFuelCost(
              tradingPost.sector_x,
              tradingPost.sector_y,
              route.targetX,
              route.targetY,
            );
            if (!currentFuel || currentFuel < fuelCost) {
              await updateTradeRouteActive(route.id, false);
              continue;
            }

            // Execute sell
            if (route.sellResource && route.sellAmount > 0) {
              const storage = await getStorageInventory(ownerId);
              if (storage) {
                const available = storage[route.sellResource as keyof typeof storage] || 0;
                const sellQty = Math.min(route.sellAmount, available);
                if (sellQty > 0) {
                  const price =
                    NPC_PRICES[route.sellResource as MineableResourceType] * NPC_SELL_SPREAD;
                  await addCredits(ownerId, Math.floor(sellQty * price));
                  await updateStorageResource(ownerId, route.sellResource, -sellQty);
                }
              }
            }

            // Execute buy
            if (route.buyResource && route.buyAmount > 0) {
              const credits = await getPlayerCredits(ownerId);
              const price = NPC_PRICES[route.buyResource as MineableResourceType] * NPC_BUY_SPREAD;
              const affordable = Math.floor(credits / price);
              const buyQty = Math.min(route.buyAmount, affordable);
              if (buyQty > 0) {
                await deductCredits(ownerId, Math.floor(buyQty * price));
                await updateStorageResource(ownerId, route.buyResource, buyQty);
              }
            }

            // Deduct fuel
            currentFuel = currentFuel - fuelCost;
            await saveFuelState(ownerId, currentFuel);

            // Update last cycle
            await updateTradeRouteLastCycle(route.id);
          } catch (err) {
            logger.error({ err, routeId: route.id }, 'Trade route processing error');
          }
        }
      } catch (err) {
        logger.error({ err, ownerId }, 'Trade routes error for owner');
      }
    }
  }

  // ── Quadrant Handlers ───────────────────────────────────────────────

  async handleNameQuadrant(
    client: Client,
    data: { qx: number; qy: number; name: string },
  ): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'nameQuadrant', 1000)) return;
    if (rejectGuest(client, 'nameQuadrant')) return;
    const auth = client.auth as AuthPayload;

    if (!isInt(data?.qx) || !isInt(data?.qy) || typeof data?.name !== 'string') {
      client.send('nameQuadrantResult', { success: false, error: 'Invalid input' });
      return;
    }

    const result = await nameQuadrantEngine(data.qx, data.qy, data.name.trim(), auth.userId);
    client.send('nameQuadrantResult', result);

    if (result.success) {
      // Broadcast the new name to all connected players
      this.ctx.broadcast('announcement', {
        message: `Quadrant (${data.qx},${data.qy}) named "${data.name.trim()}" by ${auth.username}`,
        type: 'quadrant_named',
      });
    }
  }

  async handleGetKnownQuadrants(client: Client): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'getKnownQuadrants', 500)) return;
    if (rejectGuest(client, 'getKnownQuadrants')) return;
    const auth = client.auth as AuthPayload;
    const known = await getPlayerKnownQuadrants(auth.userId);
    client.send('knownQuadrants', { quadrants: known });
  }

  async handleGetKnownJumpGates(client: Client): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'getKnownJumpGates', 500)) return;
    if (rejectGuest(client, 'getKnownJumpGates')) return;
    const auth = client.auth as AuthPayload;
    const gates = await getPlayerKnownJumpGates(auth.userId);
    client.send('knownJumpGates', { gates });
  }

  async handleSyncQuadrants(client: Client): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'syncQuadrants', 2000)) return;
    if (rejectGuest(client, 'syncQuadrants')) return;
    const auth = client.auth as AuthPayload;

    // Only allowed at stations
    const isStation = this.ctx._pst(client.sessionId) === 'station';
    if (!isStation) {
      client.send('syncQuadrantsResult', {
        success: false,
        error: 'Must be at a station to sync quadrant data',
      });
      return;
    }

    // Get all publicly known quadrant coords and batch-insert into player's known list
    const allCoords = await getAllDiscoveredQuadrantCoords();
    await addPlayerKnownQuadrantsBatch(auth.userId, allCoords);

    const known = await getPlayerKnownQuadrants(auth.userId);
    client.send('syncQuadrantsResult', {
      success: true,
      quadrants: known,
      synced: allCoords.length,
    });
  }

  // ── First Contact ───────────────────────────────────────────────────

  async checkFirstContact(
    client: Client,
    auth: AuthPayload,
    targetX: number,
    targetY: number,
  ): Promise<void> {
    try {
      const { qx, qy } = sectorToQuadrant(targetX, targetY);
      const currentQ = sectorToQuadrant(
        this.ctx._px(client.sessionId),
        this.ctx._py(client.sessionId),
      );

      // Only check if entering a different quadrant
      if (qx === currentQ.qx && qy === currentQ.qy) return;

      // Check if quadrant exists already
      const existing = await getQuadrant(qx, qy);
      if (!existing) {
        // First contact! Create quadrant with player as discoverer
        const quadrant = await getOrCreateQuadrant(qx, qy, auth.userId);
        const autoName = generateQuadrantName(quadrant.seed);

        client.send('firstContact', {
          quadrant,
          canName: true,
          autoName,
        });

        // Broadcast to all connected players
        this.ctx.broadcast('announcement', {
          message: `[${quadrant.name}] charted by ${auth.username}`,
          type: 'quadrant_discovery',
        });
        // ACEP: INTEL-XP for first quadrant discovery (spec: +20)
        addAcepXpForPlayer(auth.userId, 'intel', 20).catch(() => {});
        // ACEP: EXPLORER-XP bonus for first quadrant discovery (spec: +50)
        addAcepXpForPlayer(auth.userId, 'explorer', 50).catch(() => {});
        // Log world-first quadrant discovery
        logExpansionEvent('human', qx, qy, 'discovered').catch(() => {});
      } else {
        // Quadrant exists but player may not know it yet
        const alreadyKnown = await playerKnowsQuadrant(auth.userId, qx, qy);
        await addPlayerKnownQuadrant(auth.userId, qx, qy);
        if (!alreadyKnown) {
          logExpansionEvent('human', qx, qy, 'discovered').catch(() => {});
        }
      }
    } catch (err) {
      logger.error({ err }, 'checkFirstContact error');
    }
  }
}
