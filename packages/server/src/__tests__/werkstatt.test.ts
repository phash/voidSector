/**
 * TDD: werkstatt.test.ts
 * Verifies that ShipService.handleCraftModule correctly crafts modules
 * from blueprints or research unlocks, deducting credits and resources
 * via the unified inventory system.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock DB queries ───────────────────────────────────────────────────────────
vi.mock('../db/queries.js', () => ({
  getPlayerResearch: vi.fn(),
  getPlayerCredits: vi.fn(),
  deductCredits: vi.fn(),
  // ShipService deps (need stubs even if not called in craftModule path)
  getActiveShip: vi.fn(),
  getPlayerHomeBase: vi.fn(),
  getPlayerShips: vi.fn(),
  updateShipModules: vi.fn(),
  renameShip: vi.fn(),
  renameBase: vi.fn(),
  getInventory: vi.fn(),
  getPlayerLevel: vi.fn(),
  addUnlockedModule: vi.fn(),
  getActiveResearch: vi.fn(),
  startActiveResearch: vi.fn(),
  deleteActiveResearch: vi.fn(),
  getPlayerCargo: vi.fn(),
  deductCargo: vi.fn(),
  getPlayerReputations: vi.fn(),
  getStorageInventory: vi.fn(),
  upsertInventory: vi.fn(),
  deductInventory: vi.fn(),
  getInventoryItem: vi.fn(),
  transferInventoryItem: vi.fn(),
  getCargoCapForPlayer: vi.fn(),
  getModuleInventory: vi.fn(),
  addModuleToInventory: vi.fn(),
  removeModuleFromInventory: vi.fn(),
}));

// ── Mock @void-sector/shared ──────────────────────────────────────────────────
vi.mock('@void-sector/shared', () => ({
  MODULES: {
    drive_mk2: {
      id: 'drive_mk2',
      name: 'ION DRIVE MK.II',
      cost: { credits: 300, ore: 20, crystal: 5 },
    },
    scanner_mk2: {
      id: 'scanner_mk2',
      name: 'SCANNER MK.II',
      cost: { credits: 150 },
    },
    cargo_hold: {
      id: 'cargo_hold',
      name: 'CARGO HOLD',
      cost: { credits: 0 },
    },
  },
  HULLS: {},
  calculateShipStats: vi.fn().mockReturnValue({ fuelMax: 100 }),
  validateModuleInstall: vi.fn().mockReturnValue({ valid: true }),
  isModuleUnlocked: vi.fn().mockReturnValue(true),
  canStartResearch: vi.fn(),
  RESEARCH_TICK_MS: 60000,
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
import { addToInventory, removeFromInventory, getInventoryItem } from '../engine/inventoryService.js';
import {
  getPlayerResearch,
  getPlayerCredits,
  deductCredits,
} from '../db/queries.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    auth: { userId: 'player-1' },
    sessionId: 'session-1',
    send: vi.fn(),
    ...overrides,
  } as any;
}

function makeCtx(overrides: Record<string, unknown> = {}) {
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

// ─── craftModule: research unlock ────────────────────────────────────────────

describe('ShipService.handleCraftModule — research unlock path', () => {
  it('adds crafted module to inventory when player has research unlock and sufficient credits', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['drive_mk2'],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(0); // no blueprint
    vi.mocked(getPlayerCredits).mockResolvedValue(500);
    vi.mocked(deductCredits).mockResolvedValue(true);
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    expect(addToInventory).toHaveBeenCalledWith('player-1', 'module', 'drive_mk2', 1);
  });

  it('sends craftResult success when crafting via research unlock', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['drive_mk2'],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(0);
    vi.mocked(getPlayerCredits).mockResolvedValue(500);
    vi.mocked(deductCredits).mockResolvedValue(true);
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    expect(client.send).toHaveBeenCalledWith(
      'craftResult',
      expect.objectContaining({ success: true, moduleId: 'drive_mk2' }),
    );
  });

  it('deducts credits when crafting a module with credit cost', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['drive_mk2'],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(0);
    vi.mocked(getPlayerCredits).mockResolvedValue(500);
    vi.mocked(deductCredits).mockResolvedValue(true);
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    expect(deductCredits).toHaveBeenCalledWith('player-1', 300);
  });

  it('deducts resource costs from inventory when crafting', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['drive_mk2'],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(0);
    vi.mocked(getPlayerCredits).mockResolvedValue(500);
    vi.mocked(deductCredits).mockResolvedValue(true);
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    expect(removeFromInventory).toHaveBeenCalledWith('player-1', 'resource', 'ore', 20);
    expect(removeFromInventory).toHaveBeenCalledWith('player-1', 'resource', 'crystal', 5);
  });
});

// ─── craftModule: blueprint path ─────────────────────────────────────────────

describe('ShipService.handleCraftModule — blueprint inventory path', () => {
  it('adds crafted module to inventory when player has blueprint and no research unlock', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: [],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(1); // has blueprint
    vi.mocked(getPlayerCredits).mockResolvedValue(500);
    vi.mocked(deductCredits).mockResolvedValue(true);
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    expect(addToInventory).toHaveBeenCalledWith('player-1', 'module', 'drive_mk2', 1);
  });

  it('sends craftResult success when crafting via blueprint', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: [],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(1);
    vi.mocked(getPlayerCredits).mockResolvedValue(500);
    vi.mocked(deductCredits).mockResolvedValue(true);
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    expect(client.send).toHaveBeenCalledWith(
      'craftResult',
      expect.objectContaining({ success: true, moduleId: 'drive_mk2' }),
    );
  });

  it('does NOT consume the blueprint from inventory during crafting', async () => {
    // Blueprint-based crafting is read-only (blueprint is a recipe reference, not consumed)
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: [],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(1);
    vi.mocked(getPlayerCredits).mockResolvedValue(500);
    vi.mocked(deductCredits).mockResolvedValue(true);
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    // removeFromInventory should only be called for resource costs, not the blueprint itself
    expect(removeFromInventory).not.toHaveBeenCalledWith('player-1', 'blueprint', 'drive_mk2', 1);
  });
});

// ─── craftModule: no recipe available ───────────────────────────────────────

describe('ShipService.handleCraftModule — no recipe', () => {
  it('sends craftResult failure when player has neither research nor blueprint', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: [],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(0); // no blueprint either

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    expect(client.send).toHaveBeenCalledWith(
      'craftResult',
      expect.objectContaining({ success: false, error: expect.stringContaining('recipe') }),
    );
  });

  it('does NOT add module to inventory when no recipe available', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: [],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(0);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    expect(addToInventory).not.toHaveBeenCalled();
  });

  it('sends craftResult failure for unknown moduleId', async () => {
    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'nonexistent_module' });

    expect(client.send).toHaveBeenCalledWith(
      'craftResult',
      expect.objectContaining({ success: false }),
    );
    expect(addToInventory).not.toHaveBeenCalled();
  });
});

// ─── craftModule: insufficient credits ───────────────────────────────────────

describe('ShipService.handleCraftModule — insufficient credits', () => {
  it('sends craftResult failure when player has insufficient credits', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['drive_mk2'],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(0);
    vi.mocked(getPlayerCredits).mockResolvedValue(50); // only 50, needs 300

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    expect(client.send).toHaveBeenCalledWith(
      'craftResult',
      expect.objectContaining({ success: false, error: expect.stringContaining('credit') }),
    );
  });

  it('does NOT add module to inventory when credits are insufficient', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['drive_mk2'],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(0);
    vi.mocked(getPlayerCredits).mockResolvedValue(50); // insufficient

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    expect(addToInventory).not.toHaveBeenCalled();
  });

  it('does NOT deduct credits when failing due to insufficient credits', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['drive_mk2'],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(0);
    vi.mocked(getPlayerCredits).mockResolvedValue(50);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'drive_mk2' });

    expect(deductCredits).not.toHaveBeenCalled();
  });

  it('succeeds when module has zero credit cost', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['cargo_hold'],
      blueprints: [],
    });
    vi.mocked(getInventoryItem).mockResolvedValue(0);
    // getPlayerCredits should NOT be called for zero-cost modules
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleCraftModule(client, { moduleId: 'cargo_hold' });

    expect(addToInventory).toHaveBeenCalledWith('player-1', 'module', 'cargo_hold', 1);
    expect(deductCredits).not.toHaveBeenCalled();
  });
});
