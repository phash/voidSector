/**
 * TDD: werkstatt.test.ts
 * Verifies that ShipService.handleCraftModule creates a craft site (Baustelle)
 * instead of instant crafting. Resources are deposited later via depositCraftResources.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock DB queries ───────────────────────────────────────────────────────────
vi.mock('../db/queries.js', () => ({
  getPlayerResearch: vi.fn(),
  getPlayerCredits: vi.fn(),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  getActiveShip: vi.fn(),
  getPlayerShips: vi.fn(),
  updateShipModules: vi.fn(),
  renameShip: vi.fn(),
  getInventory: vi.fn(),
  addUnlockedModule: vi.fn(),
  getWissen: vi.fn().mockResolvedValue(0),
  addWissen: vi.fn(),
}));

// ── Mock @void-sector/shared ──────────────────────────────────────────────────
vi.mock('@void-sector/shared', () => {
  const mods: Record<string, any> = {
    ion_drive_mk2: {
      id: 'ion_drive_mk2',
      name: 'Ion Drive Mk2',
      category: 'drive',
      tier: 2,
      costCredits: 750,
      costOre: 25,
      costGas: 40,
      costCrystal: 80,
      costArtefact: '0',
      hitpoints: 20,
      stats: {},
    },
    cargo_bay_mk1: {
      id: 'cargo_bay_mk1',
      name: 'Cargo Bay Mk1',
      category: 'cargo',
      tier: 1,
      costCredits: 0,
      costOre: 0,
      costGas: 0,
      costCrystal: 0,
      costArtefact: '0',
      hitpoints: 1,
      stats: {},
    },
    factory_mk1: {
      id: 'factory_mk1',
      name: 'Micro-Fabrikator',
      category: 'factory',
      tier: 1,
      costCredits: 0,
      costOre: 0,
      costGas: 0,
      costCrystal: 0,
      costArtefact: '0',
      hitpoints: 20,
      stats: { craftSpeed: 1 },
    },
  };
  return {
    MODULES: mods,
    MODULE_MAP: new Map(Object.entries(mods)),
    MODULE_DEFINITIONS: Object.values(mods),
    MODULE_HP_BY_TIER: { 1: 20, 2: 20, 3: 20, 4: 40, 5: 60 },
    BLUEPRINT_COPY_BASE_COST: 100,
    calculateShipStats: vi.fn().mockReturnValue({ fuelMax: 100 }),
    validateModuleInstall: vi.fn().mockReturnValue({ valid: true }),
    getActiveDrawbacks: vi.fn().mockReturnValue([]),
    isModuleUnlocked: vi.fn().mockImplementation(
      (_id: string, _categoryTiers: unknown, blueprints: string[]) =>
        blueprints.length > 0,
    ),
    RESEARCH_TICK_MS: 60000,
  };
});

// ── Mock techTreeQueries ─────────────────────────────────────────────────────
vi.mock('../db/techTreeQueries.js', () => ({
  getCategoryTiers: vi.fn().mockResolvedValue({}),
}));

// ── Mock craftSiteQueries ────────────────────────────────────────────────────
vi.mock('../db/craftSiteQueries.js', () => ({
  createCraftSite: vi.fn().mockResolvedValue({
    id: 'craft-1',
    player_id: 'player-1',
    ship_id: 'ship-1',
    module_id: 'ion_drive_mk2',
    progress: 0,
    duration: 145,
    needed_ore: 25,
    needed_gas: 40,
    needed_crystal: 80,
    needed_credits: 750,
    deposited_ore: 0,
    deposited_gas: 0,
    deposited_crystal: 0,
    deposited_credits: 0,
    paused: true,
  }),
  getCraftSiteByShipId: vi.fn().mockResolvedValue(null),
  depositCraftResources: vi.fn(),
  deleteCraftSite: vi.fn(),
}));

// ── Mock engine deps ──────────────────────────────────────────────────────────
vi.mock('../engine/commands.js', () => ({ getReputationTier: vi.fn() }));
vi.mock('../engine/acepXpService.js', () => ({
  getAcepXpSummary: vi.fn().mockResolvedValue({}),
  getAcepEffects: vi.fn().mockReturnValue({}),
}));
vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getFuelState: vi.fn().mockResolvedValue(50),
  saveFuelState: vi.fn(),
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

import { ShipService } from '../rooms/services/ShipService.js';
import { getInventoryItem } from '../engine/inventoryService.js';
import { getPlayerResearch, getActiveShip } from '../db/queries.js';
import { createCraftSite, getCraftSiteByShipId } from '../db/craftSiteQueries.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultShip = {
  id: 'ship-1',
  ownerId: 'player-1',
  name: 'AEGIS',
  modules: [
    { moduleId: 'factory_mk1', slotIndex: 8, source: 'standard' },
  ],
  active: true,
};

function makeClient() {
  return {
    auth: { userId: 'player-1' },
    sessionId: 'session-1',
    send: vi.fn(),
  } as any;
}

function makeCtx() {
  return {
    _px: vi.fn().mockReturnValue(0),
    _py: vi.fn().mockReturnValue(0),
    _pst: vi.fn().mockReturnValue('station'),
    clientShips: new Map(),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveShip).mockResolvedValue(defaultShip as any);
  vi.mocked(getCraftSiteByShipId).mockResolvedValue(null);
});

// ─── craftModule: creates craft site ─────────────────────────────────────────

describe('ShipService.handleCraftModule — craft site creation', () => {
  it('creates a craft site when player has research unlock', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['ion_drive_mk2'],
      blueprints: [],
    });

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'ion_drive_mk2' });

    expect(createCraftSite).toHaveBeenCalledWith(
      'player-1', 'ship-1', 'ion_drive_mk2',
      expect.any(Number),
      { ore: 25, gas: 40, crystal: 80, credits: 750 },
    );
  });

  it('sends craftSiteUpdate and craftResult success', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['ion_drive_mk2'],
      blueprints: [],
    });

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'ion_drive_mk2' });

    expect(client.send).toHaveBeenCalledWith('craftSiteUpdate', expect.objectContaining({ module_id: 'ion_drive_mk2' }));
    expect(client.send).toHaveBeenCalledWith('craftResult', expect.objectContaining({ success: true }));
  });

  it('creates craft site via blueprint path', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: [],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(1); // has blueprint

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'ion_drive_mk2' });

    expect(createCraftSite).toHaveBeenCalled();
  });

  it('rejects when craft already active on ship', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['ion_drive_mk2'],
      blueprints: [],
    });
    vi.mocked(getCraftSiteByShipId).mockResolvedValue({ id: 'existing' } as any);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'ion_drive_mk2' });

    expect(createCraftSite).not.toHaveBeenCalled();
    expect(client.send).toHaveBeenCalledWith('craftResult', expect.objectContaining({ success: false }));
  });

  it('calculates duration based on material / craftSpeed', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['ion_drive_mk2'],
      blueprints: [],
    });

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'ion_drive_mk2' });

    // ion_drive_mk2: ore=25 + gas=40 + crystal=80 = 145; craftSpeed=1 → duration=145
    expect(createCraftSite).toHaveBeenCalledWith(
      'player-1', 'ship-1', 'ion_drive_mk2',
      145,
      expect.any(Object),
    );
  });
});

// ─── craftModule: no recipe ──────────────────────────────────────────────────

describe('ShipService.handleCraftModule — no recipe', () => {
  it('sends craftResult failure when no recipe available', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: [],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(0);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'ion_drive_mk2' });

    expect(client.send).toHaveBeenCalledWith(
      'craftResult',
      expect.objectContaining({ success: false }),
    );
    expect(createCraftSite).not.toHaveBeenCalled();
  });

  it('sends craftResult failure for unknown moduleId', async () => {
    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'nonexistent_module' });

    expect(client.send).toHaveBeenCalledWith(
      'craftResult',
      expect.objectContaining({ success: false }),
    );
    expect(createCraftSite).not.toHaveBeenCalled();
  });
});
