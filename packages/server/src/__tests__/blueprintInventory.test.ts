/**
 * TDD: blueprintInventory.test.ts
 * Verifies that blueprint drops and activation flow through the unified
 * inventory table (addToInventory / getInventoryItem / removeFromInventory)
 * instead of the legacy player_research.blueprints[] array.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock DB queries ──────────────────────────────────────────────────────────
vi.mock('../db/queries.js', () => ({
  // ScanService deps
  getSector: vi.fn(),
  saveSector: vi.fn(),
  addDiscoveriesBatch: vi.fn(),
  getSectorsInRange: vi.fn(),
  addDiscovery: vi.fn(),
  insertScanEvent: vi.fn(),
  getPlayerScanEvents: vi.fn(),
  completeScanEvent: vi.fn(),
  getPlayerCredits: vi.fn(),
  addCredits: vi.fn(),
  getPlayerReputation: vi.fn(),
  addBlueprint: vi.fn(), // legacy — should NOT be called after migration
  getPlayerFaction: vi.fn(),
  getFactionMembersByPlayerIds: vi.fn(),
  hasScannedRuin: vi.fn(),
  insertAncientRuinScan: vi.fn(),
  getActiveShip: vi.fn(),
  recordAlienEncounter: vi.fn(),
  // ShipService deps
  getPlayerHomeBase: vi.fn(),
  getPlayerShips: vi.fn(),
  updateShipModules: vi.fn(),
  renameShip: vi.fn(),
  renameBase: vi.fn(),
  getInventory: vi.fn(),
  getPlayerLevel: vi.fn(),
  getPlayerResearch: vi.fn(),
  addUnlockedModule: vi.fn(),
  getActiveResearch: vi.fn(),
  startActiveResearch: vi.fn(),
  deleteActiveResearch: vi.fn(),
  deductCredits: vi.fn(),
  getPlayerCargo: vi.fn(),
  deductCargo: vi.fn(),
  getPlayerReputations: vi.fn(),
  getStorageInventory: vi.fn(),
  // unified inventory
  upsertInventory: vi.fn(),
  deductInventory: vi.fn(),
  getInventoryItem: vi.fn(),
  transferInventoryItem: vi.fn(),
  getCargoCapForPlayer: vi.fn(),
  // legacy module inventory — should NOT be called
  getModuleInventory: vi.fn(),
  addModuleToInventory: vi.fn(),
  removeModuleFromInventory: vi.fn(),
}));

// ── Mock shared ──────────────────────────────────────────────────────────────
vi.mock('@void-sector/shared', () => ({
  MODULES: {
    scanner_mk3: { id: 'scanner_mk3', name: 'Scanner MK3', researchCost: { credits: 200 } },
    drive_mk2: { id: 'drive_mk2', name: 'Drive MK2', researchCost: { credits: 100 } },
  },
  HULLS: {},
  calculateShipStats: vi.fn().mockReturnValue({ fuelMax: 100 }),
  validateModuleInstall: vi.fn().mockReturnValue({ valid: true }),
  isModuleUnlocked: vi.fn().mockReturnValue(true),
  canStartResearch: vi.fn(),
  RESEARCH_TICK_MS: 60000,
  UNIVERSE_TICK_MS: 5000,
  WORLD_SEED: 42,
  AP_COSTS_LOCAL_SCAN: 1,
}));

// ── Mock engine deps for ScanService ─────────────────────────────────────────
vi.mock('../engine/ap.js', () => ({ calculateCurrentAP: vi.fn().mockReturnValue(10) }));
vi.mock('../engine/acepXpService.js', () => ({
  addAcepXpForPlayer: vi.fn().mockResolvedValue(undefined),
  getAcepXpSummary: vi.fn().mockResolvedValue({}),
  getAcepEffects: vi.fn().mockReturnValue({}),
}));
vi.mock('../engine/traitCalculator.js', () => ({ calculateTraits: vi.fn().mockReturnValue([]) }));
vi.mock('../engine/personalityMessages.js', () => ({
  getPersonalityComment: vi.fn().mockReturnValue(null),
}));
vi.mock('../engine/commands.js', () => ({
  validateLocalScan: vi.fn().mockReturnValue({ valid: true }),
  validateAreaScan: vi.fn().mockReturnValue({ valid: true }),
  getReputationTier: vi.fn(),
  createPirateEncounter: vi.fn(),
}));
vi.mock('../engine/scanEvents.js', () => ({
  checkScanEvent: vi.fn().mockReturnValue(null),
}));
vi.mock('../engine/worldgen.js', () => ({ generateSector: vi.fn() }));
vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getAPState: vi.fn().mockResolvedValue(null),
  saveAPState: vi.fn(),
  getFuelState: vi.fn().mockResolvedValue(50),
  saveFuelState: vi.fn(),
}));
vi.mock('../engine/ancientRuinsService.js', () => ({
  resolveAncientRuinScan: vi.fn(),
}));
vi.mock('../engine/permadeathService.js', () => ({
  getWrecksInSector: vi.fn().mockResolvedValue([]),
  salvageWreckModule: vi.fn(),
}));
vi.mock('../rooms/services/utils.js', () => ({ rejectGuest: vi.fn().mockReturnValue(false) }));

// ── Mock inventoryService ─────────────────────────────────────────────────────
vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn().mockResolvedValue(undefined),
  removeFromInventory: vi.fn().mockResolvedValue(undefined),
  getInventoryItem: vi.fn().mockResolvedValue(0),
  transferInventoryItem: vi.fn(),
  getResourceTotal: vi.fn().mockResolvedValue(0),
  canAddResource: vi.fn().mockResolvedValue(true),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, artefact: 0 }),
}));

import { ScanService } from '../rooms/services/ScanService.js';
import { ShipService } from '../rooms/services/ShipService.js';
import {
  addToInventory,
  removeFromInventory,
  getInventoryItem,
} from '../engine/inventoryService.js';
import { addBlueprint, addUnlockedModule, getPlayerResearch } from '../db/queries.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    auth: { userId: 'player-1' },
    sessionId: 'session-1',
    send: vi.fn(),
    ...overrides,
  } as any;
}

function makeScanCtx(overrides: Record<string, unknown> = {}) {
  return {
    checkRate: vi.fn().mockReturnValue(true),
    _px: vi.fn().mockReturnValue(0),
    _py: vi.fn().mockReturnValue(0),
    _pst: vi.fn().mockReturnValue('ruin'),
    applyReputationChange: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

function makeShipCtx(overrides: Record<string, unknown> = {}) {
  return {
    _px: vi.fn().mockReturnValue(0),
    _py: vi.fn().mockReturnValue(0),
    _pst: vi.fn().mockReturnValue('station'),
    clientShips: new Map(),
    clientHullTypes: new Map(),
    ...overrides,
  } as any;
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => vi.clearAllMocks());

// ─── ScanService: blueprint_find event ───────────────────────────────────────

describe('ScanService: blueprint_find event handling', () => {
  it('calls addToInventory with blueprint item type when blueprint found', async () => {
    const { completeScanEvent, getPlayerScanEvents } = await import('../db/queries.js');
    vi.mocked(getPlayerScanEvents).mockResolvedValue([
      {
        id: 'event-1',
        event_type: 'blueprint_find',
        data: { moduleId: 'scanner_mk3' },
        sector_x: 0,
        sector_y: 0,
        status: 'discovered',
      } as any,
    ]);
    vi.mocked(completeScanEvent).mockResolvedValue(true as any);

    const svc = new ScanService(makeScanCtx());
    const client = makeClient();
    await svc.handleCompleteScanEvent(client, { eventId: 'event-1' });

    expect(addToInventory).toHaveBeenCalledWith('player-1', 'blueprint', 'scanner_mk3', 1);
  });

  it('does NOT call legacy addBlueprint after migration', async () => {
    const { getPlayerScanEvents, completeScanEvent } = await import('../db/queries.js');
    vi.mocked(getPlayerScanEvents).mockResolvedValue([
      {
        id: 'event-1',
        event_type: 'blueprint_find',
        data: { moduleId: 'scanner_mk3' },
        sector_x: 0,
        sector_y: 0,
        status: 'discovered',
      } as any,
    ]);
    vi.mocked(completeScanEvent).mockResolvedValue(true as any);

    const svc = new ScanService(makeScanCtx());
    const client = makeClient();
    await svc.handleCompleteScanEvent(client, { eventId: 'event-1' });

    expect(addBlueprint).not.toHaveBeenCalled();
  });

  it('blocks duplicate blueprint drop (qty >= 1 → skip addToInventory)', async () => {
    const { getPlayerScanEvents, completeScanEvent } = await import('../db/queries.js');
    vi.mocked(getInventoryItem).mockResolvedValue(1); // already have it
    vi.mocked(getPlayerScanEvents).mockResolvedValue([
      {
        id: 'event-2',
        event_type: 'blueprint_find',
        data: { moduleId: 'scanner_mk3' },
        sector_x: 0,
        sector_y: 0,
        status: 'discovered',
      } as any,
    ]);
    vi.mocked(completeScanEvent).mockResolvedValue(true as any);

    const svc = new ScanService(makeScanCtx());
    const client = makeClient();
    await svc.handleCompleteScanEvent(client, { eventId: 'event-2' });

    expect(addToInventory).not.toHaveBeenCalledWith('player-1', 'blueprint', 'scanner_mk3', 1);
  });
});

// ─── ShipService.handleActivateBlueprint ─────────────────────────────────────

describe('ShipService.handleActivateBlueprint', () => {
  it('reads blueprint from inventory (getInventoryItem) not from player_research', async () => {
    vi.mocked(getInventoryItem).mockResolvedValue(1);
    vi.mocked(addUnlockedModule).mockResolvedValue(undefined);
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: [],
      blueprints: [],
    });

    const svc = new ShipService(makeShipCtx());
    const client = makeClient();
    await svc.handleActivateBlueprint(client, { moduleId: 'scanner_mk3' });

    expect(getInventoryItem).toHaveBeenCalledWith('player-1', 'blueprint', 'scanner_mk3');
  });

  it('calls removeFromInventory to consume blueprint on activation', async () => {
    vi.mocked(getInventoryItem).mockResolvedValue(1);
    vi.mocked(addUnlockedModule).mockResolvedValue(undefined);
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['scanner_mk3'],
      blueprints: [],
    });

    const svc = new ShipService(makeShipCtx());
    const client = makeClient();
    await svc.handleActivateBlueprint(client, { moduleId: 'scanner_mk3' });

    expect(removeFromInventory).toHaveBeenCalledWith('player-1', 'blueprint', 'scanner_mk3', 1);
  });

  it('calls addUnlockedModule after blueprint activation', async () => {
    vi.mocked(getInventoryItem).mockResolvedValue(1);
    vi.mocked(addUnlockedModule).mockResolvedValue(undefined);
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['scanner_mk3'],
      blueprints: [],
    });

    const svc = new ShipService(makeShipCtx());
    const client = makeClient();
    await svc.handleActivateBlueprint(client, { moduleId: 'scanner_mk3' });

    expect(addUnlockedModule).toHaveBeenCalledWith('player-1', 'scanner_mk3');
  });

  it('sends error and does NOT consume blueprint when not in inventory', async () => {
    vi.mocked(getInventoryItem).mockResolvedValue(0); // not found

    const svc = new ShipService(makeShipCtx());
    const client = makeClient();
    await svc.handleActivateBlueprint(client, { moduleId: 'scanner_mk3' });

    expect(client.send).toHaveBeenCalledWith(
      'researchResult',
      expect.objectContaining({ success: false }),
    );
    expect(removeFromInventory).not.toHaveBeenCalled();
    expect(addUnlockedModule).not.toHaveBeenCalled();
  });
});
