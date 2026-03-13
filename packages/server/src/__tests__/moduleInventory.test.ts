/**
 * TDD: moduleInventory.test.ts
 * Verifies that ShipService buy/install/remove handlers and permadeathService salvage
 * all flow through the unified inventory table (addToInventory / removeFromInventory).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock DB queries used by ShipService ──────────────────────────────────────
vi.mock('../db/queries.js', () => ({
  getActiveShip: vi.fn(),
  playerHasBaseAtSector: vi.fn(),
  getPlayerShips: vi.fn(),
  updateShipModules: vi.fn(),
  renameShip: vi.fn(),
  renameBase: vi.fn(),
  getPlayerLevel: vi.fn(),
  getPlayerResearch: vi.fn(),
  addUnlockedModule: vi.fn(),
  getActiveResearch: vi.fn(),
  startActiveResearch: vi.fn(),
  deleteActiveResearch: vi.fn(),
  getPlayerCredits: vi.fn(),
  deductCredits: vi.fn(),
  getPlayerReputations: vi.fn(),
  getStorageInventory: vi.fn(),
  // unified inventory functions
  upsertInventory: vi.fn(),
  deductInventory: vi.fn(),
  getInventory: vi.fn(),
  getInventoryItem: vi.fn(),
  transferInventoryItem: vi.fn(),
  getCargoCapForPlayer: vi.fn(),
}));

// ── Mock shared module (avoid real MODULES / validators requiring complex deps) ─
vi.mock('@void-sector/shared', () => ({
  MODULES: {
    drive_mk2: {
      id: 'drive_mk2',
      name: 'Drive MK2',
      category: 'drive',
      tier: 2,
      cost: { credits: 500, ore: 5 },
    },
  },
  HULLS: {},
  calculateShipStats: vi.fn().mockReturnValue({ fuelMax: 100 }),
  validateModuleInstall: vi.fn().mockReturnValue({ valid: true }),
  isModuleUnlocked: vi.fn().mockReturnValue(true),
  RESEARCH_TICK_MS: 60000,
  getActiveDrawbacks: vi.fn().mockReturnValue([]),
}));

// ── Mock techTreeQueries ─────────────────────────────────────────────────────
vi.mock('../db/techTreeQueries.js', () => ({
  getOrCreateTechTree: vi.fn().mockResolvedValue({
    player_id: 'player-1',
    researched_nodes: {},
    total_researched: 0,
    last_reset_at: null,
  }),
}));

// ── Mock other engine deps used by ShipService ───────────────────────────────
vi.mock('../engine/commands.js', () => ({ getReputationTier: vi.fn() }));
vi.mock('../engine/acepXpService.js', () => ({
  getAcepXpSummary: vi.fn().mockResolvedValue({}),
  getAcepEffects: vi.fn().mockReturnValue({}),
}));
vi.mock('./RedisAPStore.js', async () => ({
  getFuelState: vi.fn().mockResolvedValue(50),
  saveFuelState: vi.fn(),
}));
vi.mock('./utils.js', () => ({ rejectGuest: vi.fn().mockReturnValue(false) }));

// ── Mock inventoryService ─────────────────────────────────────────────────────
vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn().mockResolvedValue(undefined),
  removeFromInventory: vi.fn().mockResolvedValue(undefined),
  getInventoryItem: vi.fn().mockResolvedValue(1),
  transferInventoryItem: vi.fn(),
  getResourceTotal: vi.fn(),
  canAddResource: vi.fn(),
  getCargoState: vi.fn().mockResolvedValue({ ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
}));

import { ShipService } from '../rooms/services/ShipService.js';
import {
  addToInventory,
  removeFromInventory,
  getInventoryItem,
} from '../engine/inventoryService.js';
import {
  getActiveShip,
  getPlayerCredits,
  deductCredits,
  getPlayerResearch,
  updateShipModules,
} from '../db/queries.js';
import { validateModuleInstall, isModuleUnlocked } from '@void-sector/shared';

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

const SHIP = {
  id: 'ship-1',
  hullType: 'scout',
  modules: [],
  name: 'TestShip',
};

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => vi.clearAllMocks());

// ─── handleBuyModule ─────────────────────────────────────────────────────────

describe('ShipService.handleBuyModule', () => {
  it('calls addToInventory with module item type after purchase', async () => {
    vi.mocked(getPlayerCredits).mockResolvedValue(1000);
    vi.mocked(deductCredits).mockResolvedValue(true);
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['drive_mk2'],
      blueprints: [],
    });

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleBuyModule(client, { moduleId: 'drive_mk2' });

    expect(addToInventory).toHaveBeenCalledWith('player-1', 'module', 'drive_mk2', 1);
  });
});

// ─── handleInstallModule ──────────────────────────────────────────────────────

describe('ShipService.handleInstallModule', () => {
  it('calls removeFromInventory before installing module', async () => {
    vi.mocked(getActiveShip).mockResolvedValue(SHIP as any);
    vi.mocked(validateModuleInstall).mockReturnValue({ valid: true });
    vi.mocked(getInventoryItem).mockResolvedValue(1);
    vi.mocked(updateShipModules).mockResolvedValue(undefined);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleInstallModule(client, { moduleId: 'drive_mk2', slotIndex: 0 });

    expect(removeFromInventory).toHaveBeenCalledWith('player-1', 'module', 'drive_mk2', 1);
  });

  it('sends error and does NOT install when module not in inventory', async () => {
    vi.mocked(getActiveShip).mockResolvedValue(SHIP as any);
    vi.mocked(validateModuleInstall).mockReturnValue({ valid: true });
    vi.mocked(getInventoryItem).mockResolvedValue(0); // not in inventory
    vi.mocked(updateShipModules).mockResolvedValue(undefined);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleInstallModule(client, { moduleId: 'drive_mk2', slotIndex: 0 });

    expect(client.send).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ code: 'NO_MODULE' }),
    );
    expect(updateShipModules).not.toHaveBeenCalled();
  });

});

// ─── handleRemoveModule ───────────────────────────────────────────────────────

describe('ShipService.handleRemoveModule', () => {
  it('calls addToInventory when module is removed from ship', async () => {
    const shipWithMod = { ...SHIP, modules: [{ moduleId: 'drive_mk2', slotIndex: 1 }] };
    vi.mocked(getActiveShip).mockResolvedValue(shipWithMod as any);
    vi.mocked(updateShipModules).mockResolvedValue(undefined);

    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleRemoveModule(client, { slotIndex: 1 });

    expect(addToInventory).toHaveBeenCalledWith('player-1', 'module', 'drive_mk2', 1);
  });

});

// ─── permadeathService.salvageWreckModule ─────────────────────────────────────

describe('permadeathService.salvageWreckModule', () => {
  it('calls addToInventory with salvaged module instead of JSONB update', async () => {
    // Mock db/db.js used by permadeathService
    vi.mock('../db/client.js', () => ({
      query: vi.fn(),
    }));

    const { query } = await import('../db/client.js');
    vi.mocked(query)
      .mockResolvedValueOnce({
        rows: [{ salvageable_modules: ['drive_mk2', 'cargo_hold'] }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as any) // SELECT
      .mockResolvedValueOnce({
        rows: [],
        command: 'UPDATE',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as any); // UPDATE wreck

    const { salvageWreckModule } = await import('../engine/permadeathService.js');
    const result = await salvageWreckModule('wreck-1', 'player-1');

    expect(result).toBe('drive_mk2');
    expect(addToInventory).toHaveBeenCalledWith('player-1', 'module', 'drive_mk2', 1);
  });
});
