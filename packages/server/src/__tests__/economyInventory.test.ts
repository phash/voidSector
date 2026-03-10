/**
 * TDD: EconomyService uses unified inventory instead of cargo table.
 * Verifies addToInventory / removeFromInventory / getCargoState / getResourceTotal are used,
 * NOT addToCargo / deductCargo / getPlayerCargo / getCargoTotal from the legacy cargo table.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

// --- Mock inventoryService (must come before any imports that use them) ---
vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn().mockResolvedValue(undefined),
  removeFromInventory: vi.fn().mockResolvedValue(undefined),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
  canAddResource: vi.fn().mockResolvedValue(true),
  getResourceTotal: vi.fn().mockResolvedValue(0),
  transferInventoryItem: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock DB queries ---
vi.mock('../db/queries.js', () => ({
  // Legacy cargo fns — should NOT be called after migration
  addToCargo: vi.fn(),
  deductCargo: vi.fn(),
  getPlayerCargo: vi.fn(),
  getCargoTotal: vi.fn(),
  // Other queries EconomyService needs
  getPlayerCredits: vi.fn().mockResolvedValue(1000),
  addCredits: vi.fn().mockResolvedValue(1200),
  deductCredits: vi.fn().mockResolvedValue(true),
  getStorageInventory: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, artefact: 0 }),
  updateStorageResource: vi.fn().mockResolvedValue(undefined),
  getPlayerStructure: vi.fn().mockResolvedValue(null),
  upgradeStructureTier: vi.fn().mockResolvedValue(2),
  createTradeOrder: vi.fn().mockResolvedValue({ id: 'order-1' }),
  findPlayerByUsername: vi.fn().mockResolvedValue({ homeBase: { x: 0, y: 0 } }),
  getPlayerBaseStructures: vi.fn().mockResolvedValue([]),
  playerHasBaseAtSector: vi.fn().mockResolvedValue(false),
  getPlayerShips: vi.fn().mockResolvedValue([]),
  getPlayerReputation: vi.fn().mockResolvedValue(0),
  getPlayerStationRep: vi.fn().mockResolvedValue(0),
  updatePlayerStationRep: vi.fn().mockResolvedValue(undefined),
  getPlayerResearch: vi.fn().mockResolvedValue(null),
  upsertInventory: vi.fn().mockResolvedValue(undefined),
  deductInventory: vi.fn().mockResolvedValue(undefined),
  getInventory: vi.fn().mockResolvedValue([]),
  getCargoCapForPlayer: vi.fn().mockResolvedValue(50),
  transferInventoryItem: vi.fn().mockResolvedValue(undefined),
  getInventoryItem: vi.fn().mockResolvedValue(null),
}));

vi.mock('../db/npcStationQueries.js', () => ({
  getStationInventoryItem: vi.fn().mockResolvedValue(null),
  upsertInventoryItem: vi.fn().mockResolvedValue(undefined),
  getStationInventory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../engine/npcStationEngine.js', () => ({
  getOrInitStation: vi.fn().mockResolvedValue({ xp: 0 }),
  recordTrade: vi.fn().mockResolvedValue(undefined),
  canBuyFromStation: vi.fn().mockResolvedValue({ ok: true, price: 100 }),
  canSellToStation: vi.fn().mockResolvedValue({ ok: true, price: 80, capacity: 150, effectiveAmount: 1 }),
  calculateCurrentStock: vi.fn().mockReturnValue(50),
  getStationLevel: vi.fn().mockReturnValue({ level: 1, name: 'Outpost' }),
  calculatePrice: vi.fn().mockReturnValue(100),
}));

vi.mock('../engine/npcgen.js', () => ({
  getStationFaction: vi.fn().mockReturnValue('traders'),
}));

vi.mock('../engine/commands.js', () => ({
  validateNpcTrade: vi.fn().mockReturnValue({ valid: true, totalPrice: 100 }),
  validateTransfer: vi.fn().mockReturnValue({ valid: true }),
  getReputationTier: vi.fn().mockReturnValue('neutral'),
}));

vi.mock('../engine/productionEngine.js', () => ({
  getOrCreateFactoryState: vi.fn().mockResolvedValue({}),
  setActiveRecipe: vi.fn().mockResolvedValue({ success: true }),
  collectOutput: vi.fn().mockResolvedValue({ consumed: {}, error: null }),
  getFactoryStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
  transferOutputToCargo: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../engine/kontorEngine.js', () => ({
  placeKontorOrder: vi.fn().mockResolvedValue({ success: true, order: {} }),
  cancelKontorOrder: vi.fn().mockResolvedValue({ success: true }),
  fillKontorOrder: vi.fn().mockResolvedValue({ success: true, earned: 100 }),
  getKontorOrders: vi.fn().mockResolvedValue([]),
}));

vi.mock('../db/client.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getFuelState: vi.fn().mockResolvedValue(50),
  saveFuelState: vi.fn().mockResolvedValue(undefined),
}));

import { EconomyService } from '../rooms/services/EconomyService.js';
import { addToCargo, deductCargo, getPlayerCargo, getCargoTotal } from '../db/queries.js';
import {
  addToInventory,
  removeFromInventory,
  getCargoState,
  getResourceTotal,
} from '../engine/inventoryService.js';
import { canBuyFromStation, canSellToStation } from '../engine/npcStationEngine.js';
import { validateTransfer } from '../engine/commands.js';
import { transferOutputToCargo } from '../engine/productionEngine.js';
import { fillKontorOrder } from '../engine/kontorEngine.js';

function makeClient(
  userId = 'user-123',
  sessionId = 'session-abc',
  overrides: Record<string, unknown> = {},
): Client {
  return {
    sessionId,
    auth: { userId, username: 'TestPilot', role: 'player' },
    send: vi.fn(),
    ...overrides,
  } as unknown as Client;
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    checkRate: vi.fn().mockReturnValue(true),
    _px: vi.fn().mockReturnValue(5),
    _py: vi.fn().mockReturnValue(10),
    _pst: vi.fn().mockReturnValue('station'),
    getShipForClient: vi.fn().mockReturnValue({ cargoCap: 50 }),
    getPlayerBonuses: vi.fn().mockResolvedValue({ tradePriceMultiplier: 1, scanRadiusBonus: 0 }),
    ...overrides,
  } as unknown as import('../rooms/services/ServiceContext.js').ServiceContext;
}

beforeEach(() => vi.clearAllMocks());

// ──────────────────────────────────────────────────────────────────────────────
// handleNpcTrade (station) — sell
// ──────────────────────────────────────────────────────────────────────────────
describe('EconomyService.handleNpcTrade station sell — inventory migration', () => {
  it('uses getCargoState (not getPlayerCargo) to read cargo', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new EconomyService(ctx);

    vi.mocked(getCargoState).mockResolvedValue({
      ore: 10,
      gas: 0,
      crystal: 0,
      slates: 0,
      artefact: 0,
    });
    vi.mocked(getResourceTotal).mockResolvedValue(10);
    vi.mocked(canSellToStation).mockResolvedValue({ ok: true, capacity: 100, price: 80, effectiveAmount: 5 });

    await svc.handleNpcTrade(client, { resource: 'ore', amount: 5, action: 'sell' });

    expect(getCargoState).toHaveBeenCalledWith('user-123');
    expect(getPlayerCargo).not.toHaveBeenCalled();
  });

  it('uses getResourceTotal (not getCargoTotal) for cargo space check', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new EconomyService(ctx);

    vi.mocked(getCargoState).mockResolvedValue({
      ore: 10,
      gas: 0,
      crystal: 0,
      slates: 0,
      artefact: 0,
    });
    vi.mocked(getResourceTotal).mockResolvedValue(10);
    vi.mocked(canSellToStation).mockResolvedValue({ ok: true, capacity: 100, price: 80, effectiveAmount: 5 });

    await svc.handleNpcTrade(client, { resource: 'ore', amount: 5, action: 'sell' });

    expect(getResourceTotal).toHaveBeenCalledWith('user-123');
    expect(getCargoTotal).not.toHaveBeenCalled();
  });

  it('uses removeFromInventory (not deductCargo) when selling', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new EconomyService(ctx);

    vi.mocked(getCargoState).mockResolvedValue({
      ore: 10,
      gas: 0,
      crystal: 0,
      slates: 0,
      artefact: 0,
    });
    vi.mocked(getResourceTotal).mockResolvedValue(10);
    vi.mocked(canSellToStation).mockResolvedValue({ ok: true, capacity: 100, price: 80, effectiveAmount: 5 });

    await svc.handleNpcTrade(client, { resource: 'ore', amount: 5, action: 'sell' });

    expect(removeFromInventory).toHaveBeenCalledWith('user-123', 'resource', 'ore', 5);
    expect(deductCargo).not.toHaveBeenCalled();
  });

  it('sells partial amount when station capacity is lower than requested amount', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new EconomyService(ctx);

    vi.mocked(getCargoState).mockResolvedValueOnce({ ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 });
    vi.mocked(getResourceTotal).mockResolvedValueOnce(5);
    vi.mocked(canSellToStation).mockResolvedValueOnce({ ok: true, capacity: 2, price: 20, effectiveAmount: 2 });

    await svc.handleNpcTrade(client, { resource: 'ore', amount: 5, action: 'sell' });

    // Should remove only 2 units (effectiveAmount), not 5
    expect(removeFromInventory).toHaveBeenCalledWith('user-123', 'resource', 'ore', 2);
    expect(client.send).toHaveBeenCalledWith('npcTradeResult', expect.objectContaining({
      success: true,
      partial: true,
      soldAmount: 2,
    }));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// handleNpcTrade (station) — buy
// ──────────────────────────────────────────────────────────────────────────────
describe('EconomyService.handleNpcTrade station buy — inventory migration', () => {
  it('uses addToInventory (not addToCargo) when buying', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new EconomyService(ctx);

    vi.mocked(getCargoState).mockResolvedValue({
      ore: 0,
      gas: 0,
      crystal: 0,
      slates: 0,
      artefact: 0,
    });
    vi.mocked(getResourceTotal).mockResolvedValue(0);
    vi.mocked(canBuyFromStation).mockResolvedValue({ ok: true, stock: 50, price: 100 });
    const { deductCredits } = await import('../db/queries.js');
    vi.mocked(deductCredits).mockResolvedValue(true);

    await svc.handleNpcTrade(client, { resource: 'ore', amount: 5, action: 'buy' });

    expect(addToInventory).toHaveBeenCalledWith('user-123', 'resource', 'ore', 5);
    expect(addToCargo).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// handleTransfer — toStorage (cargo → storage)
// ──────────────────────────────────────────────────────────────────────────────
describe('EconomyService.handleTransfer toStorage — inventory migration', () => {
  it('uses getCargoState (not getPlayerCargo) to read current cargo', async () => {
    const client = makeClient();
    const ctx = makeCtx({ _pst: vi.fn().mockReturnValue('empty') });
    // Player at home base
    const { findPlayerByUsername } = await import('../db/queries.js');
    vi.mocked(findPlayerByUsername).mockResolvedValue({
      id: 'user-123',
      username: 'test',
      xp: 0,
      level: 1,
      homeBase: { x: 5, y: 10 },
      passwordHash: '',
    });
    const { validateTransfer: vt } = await import('../engine/commands.js');
    vi.mocked(vt).mockReturnValue({ valid: true });

    vi.mocked(getCargoState).mockResolvedValue({
      ore: 20,
      gas: 0,
      crystal: 0,
      slates: 0,
      artefact: 0,
    });
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new EconomyService(ctx);
    await svc.handleTransfer(client, { resource: 'ore', amount: 5, direction: 'toStorage' });

    expect(getCargoState).toHaveBeenCalledWith('user-123');
    expect(getPlayerCargo).not.toHaveBeenCalled();
  });

  it('uses removeFromInventory (not deductCargo) for toStorage direction', async () => {
    const client = makeClient();
    const ctx = makeCtx({ _pst: vi.fn().mockReturnValue('empty') });
    const { findPlayerByUsername } = await import('../db/queries.js');
    vi.mocked(findPlayerByUsername).mockResolvedValue({
      id: 'user-123',
      username: 'test',
      xp: 0,
      level: 1,
      homeBase: { x: 5, y: 10 },
      passwordHash: '',
    });
    const { validateTransfer: vt } = await import('../engine/commands.js');
    vi.mocked(vt).mockReturnValue({ valid: true });

    vi.mocked(getCargoState).mockResolvedValue({
      ore: 20,
      gas: 0,
      crystal: 0,
      slates: 0,
      artefact: 0,
    });
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    const svc = new EconomyService(ctx);
    await svc.handleTransfer(client, { resource: 'ore', amount: 5, direction: 'toStorage' });

    expect(removeFromInventory).toHaveBeenCalledWith('user-123', 'resource', 'ore', 5);
    expect(deductCargo).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// handleTransfer — toCargo (storage → cargo)
// ──────────────────────────────────────────────────────────────────────────────
describe('EconomyService.handleTransfer toCargo — inventory migration', () => {
  it('uses addToInventory (not addToCargo) for toCargo direction', async () => {
    const client = makeClient();
    const ctx = makeCtx({ _pst: vi.fn().mockReturnValue('empty') });
    const { findPlayerByUsername } = await import('../db/queries.js');
    vi.mocked(findPlayerByUsername).mockResolvedValue({
      id: 'user-123',
      username: 'test',
      xp: 0,
      level: 1,
      homeBase: { x: 5, y: 10 },
      passwordHash: '',
    });
    const { validateTransfer: vt } = await import('../engine/commands.js');
    vi.mocked(vt).mockReturnValue({ valid: true });

    vi.mocked(getCargoState).mockResolvedValue({
      ore: 0,
      gas: 0,
      crystal: 0,
      slates: 0,
      artefact: 0,
    });
    vi.mocked(addToInventory).mockResolvedValue(undefined);

    const svc = new EconomyService(ctx);
    await svc.handleTransfer(client, { resource: 'ore', amount: 5, direction: 'fromStorage' });

    expect(addToInventory).toHaveBeenCalledWith('user-123', 'resource', 'ore', 5);
    expect(addToCargo).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// handleFactoryTransfer — adds processed item to cargo via inventory
// ──────────────────────────────────────────────────────────────────────────────
describe('EconomyService.handleFactoryTransfer — inventory migration', () => {
  it('uses addToInventory (not addToCargo) for factory transfer', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const { getPlayerStructure } = await import('../db/queries.js');
    vi.mocked(getPlayerStructure).mockResolvedValue({
      id: 'factory-1',
      tier: 1,
      type: 'factory',
      owner_id: 'user-123',
    } as any);
    vi.mocked(transferOutputToCargo).mockResolvedValue({ success: true });
    vi.mocked(getCargoState).mockResolvedValue({
      ore: 0,
      gas: 0,
      crystal: 0,
      slates: 0,
      artefact: 0,
    });
    vi.mocked(addToInventory).mockResolvedValue(undefined);

    const svc = new EconomyService(ctx);
    await svc.handleFactoryTransfer(client, { itemType: 'slates', amount: 3 });

    expect(addToInventory).toHaveBeenCalledWith('user-123', 'resource', 'slates', 3);
    expect(addToCargo).not.toHaveBeenCalled();
  });

  it('uses getCargoState (not getPlayerCargo) after factory transfer', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const { getPlayerStructure } = await import('../db/queries.js');
    vi.mocked(getPlayerStructure).mockResolvedValue({
      id: 'factory-1',
      tier: 1,
      type: 'factory',
      owner_id: 'user-123',
    } as any);
    vi.mocked(transferOutputToCargo).mockResolvedValue({ success: true });
    const cargoState = { ore: 0, gas: 0, crystal: 0, slates: 3, artefact: 0 };
    vi.mocked(getCargoState).mockResolvedValue(cargoState);
    vi.mocked(addToInventory).mockResolvedValue(undefined);

    const svc = new EconomyService(ctx);
    await svc.handleFactoryTransfer(client, { itemType: 'slates', amount: 3 });

    expect(getCargoState).toHaveBeenCalledWith('user-123');
    expect(getPlayerCargo).not.toHaveBeenCalled();
    expect(client.send).toHaveBeenCalledWith('cargoUpdate', cargoState);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// handleKontorSellTo — sells cargo via kontor (legacy: deductCargo inside kontorEngine)
// EconomyService itself calls getPlayerCargo after fillKontorOrder — must use getCargoState
// ──────────────────────────────────────────────────────────────────────────────
describe('EconomyService.handleKontorSellTo — inventory migration', () => {
  it('uses getCargoState (not getPlayerCargo) after filling kontor order', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    vi.mocked(fillKontorOrder).mockResolvedValue({ success: true, earned: 50 });
    const cargoState = { ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 };
    vi.mocked(getCargoState).mockResolvedValue(cargoState);

    const svc = new EconomyService(ctx);
    await svc.handleKontorSellTo(client, { orderId: 'order-1', amount: 5 });

    expect(getCargoState).toHaveBeenCalledWith('user-123');
    expect(getPlayerCargo).not.toHaveBeenCalled();
    expect(client.send).toHaveBeenCalledWith('cargoUpdate', cargoState);
  });
});
