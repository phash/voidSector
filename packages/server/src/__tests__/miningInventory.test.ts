/**
 * TDD: MiningService uses unified inventory instead of cargo table.
 * These tests verify that addToInventory / removeFromInventory are used,
 * NOT addToCargo / jettisonCargo from the legacy cargo table.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

// --- Mock DB queries (must come before any imports that use them) ---
vi.mock('../db/queries.js', () => ({
  getSector: vi.fn(),
  getPlayerCargo: vi.fn(),
  addToCargo: vi.fn(),
  jettisonCargo: vi.fn(),
  getCargoTotal: vi.fn(),
  upsertInventory: vi.fn(),
  deductInventory: vi.fn(),
  getInventory: vi.fn(),
  getCargoCapForPlayer: vi.fn(),
  transferInventoryItem: vi.fn(),
  getInventoryItem: vi.fn(),
}));

vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getMiningState: vi.fn(),
  saveMiningState: vi.fn(),
}));

vi.mock('../engine/commands.js', () => ({
  validateMine: vi.fn(),
  validateJettison: vi.fn(),
}));

vi.mock('../engine/acepXpService.js', () => ({
  addAcepXpForPlayer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/mining.js', () => ({
  stopMining: vi.fn(),
}));

vi.mock('../engine/inventoryService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/inventoryService.js')>();
  return {
    ...actual,
    addToInventory: vi.fn().mockResolvedValue(undefined),
    removeFromInventory: vi.fn().mockResolvedValue(undefined),
    getResourceTotal: vi.fn().mockResolvedValue(0),
    canAddResource: vi.fn().mockResolvedValue(true),
    getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
    transferInventoryItem: vi.fn().mockResolvedValue(undefined),
  };
});

import { MiningService } from '../rooms/services/MiningService.js';
import {
  addToCargo,
  jettisonCargo,
  getCargoTotal,
  getPlayerCargo,
  upsertInventory,
  deductInventory,
  getInventory,
} from '../db/queries.js';
import { getMiningState, saveMiningState } from '../rooms/services/RedisAPStore.js';
import { validateMine, validateJettison } from '../engine/commands.js';
import { stopMining } from '../engine/mining.js';
import {
  addToInventory,
  removeFromInventory,
  getResourceTotal,
  getCargoState,
} from '../engine/inventoryService.js';

// Helper to build a mock client
function makeClient(userId = 'user-123', sessionId = 'session-abc'): Client {
  return {
    sessionId,
    auth: { userId, username: 'TestPilot', role: 'player' },
    send: vi.fn(),
  } as unknown as Client;
}

// Helper to build a mock ServiceContext
function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    checkRate: vi.fn().mockReturnValue(true),
    _px: vi.fn().mockReturnValue(0),
    _py: vi.fn().mockReturnValue(0),
    getShipForClient: vi.fn().mockReturnValue({ cargoCap: 50 }),
    getPlayerBonuses: vi.fn().mockResolvedValue({ miningRateMultiplier: 1 }),
    ...overrides,
  } as unknown as import('../rooms/services/ServiceContext.js').ServiceContext;
}

beforeEach(() => vi.clearAllMocks());

// ──────────────────────────────────────────────────────────────────────────────
// handleStopMine
// ──────────────────────────────────────────────────────────────────────────────
describe('MiningService.handleStopMine — inventory migration', () => {
  it('uses getResourceTotal (not getCargoTotal) for cargo space calc', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new MiningService(ctx);

    vi.mocked(getMiningState).mockResolvedValue({
      active: true,
      resource: 'ore',
      rate: 1,
      startedAt: Date.now() - 5000,
      sectorX: 0,
      sectorY: 0,
      sectorYield: 10,
    });
    vi.mocked(getResourceTotal).mockResolvedValue(5);
    vi.mocked(stopMining).mockReturnValue({ mined: 5, resource: 'ore', newState: { active: false } });
    vi.mocked(getCargoState).mockResolvedValue({ ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 });
    vi.mocked(saveMiningState).mockResolvedValue(undefined);

    await svc.handleStopMine(client);

    expect(getResourceTotal).toHaveBeenCalledWith('user-123');
    expect(getCargoTotal).not.toHaveBeenCalled();
  });

  it('uses addToInventory (not addToCargo) when resources are mined', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new MiningService(ctx);

    vi.mocked(getMiningState).mockResolvedValue({
      active: true,
      resource: 'ore',
      rate: 1,
      startedAt: Date.now() - 5000,
      sectorX: 0,
      sectorY: 0,
      sectorYield: 10,
    });
    vi.mocked(getResourceTotal).mockResolvedValue(0);
    vi.mocked(stopMining).mockReturnValue({ mined: 3, resource: 'ore', newState: { active: false } });
    vi.mocked(getCargoState).mockResolvedValue({ ore: 3, gas: 0, crystal: 0, slates: 0, artefact: 0 });
    vi.mocked(saveMiningState).mockResolvedValue(undefined);

    await svc.handleStopMine(client);

    expect(addToInventory).toHaveBeenCalledWith('user-123', 'resource', 'ore', 3);
    expect(addToCargo).not.toHaveBeenCalled();
  });

  it('uses getCargoState (not getPlayerCargo) for cargoUpdate message', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new MiningService(ctx);

    const expectedCargo = { ore: 7, gas: 0, crystal: 0, slates: 0, artefact: 0 };

    vi.mocked(getMiningState).mockResolvedValue({
      active: true,
      resource: 'ore',
      rate: 1,
      startedAt: Date.now() - 5000,
      sectorX: 0,
      sectorY: 0,
      sectorYield: 10,
    });
    vi.mocked(getResourceTotal).mockResolvedValue(0);
    vi.mocked(stopMining).mockReturnValue({ mined: 7, resource: 'ore', newState: { active: false } });
    vi.mocked(getCargoState).mockResolvedValue(expectedCargo);
    vi.mocked(saveMiningState).mockResolvedValue(undefined);

    await svc.handleStopMine(client);

    expect(getCargoState).toHaveBeenCalledWith('user-123');
    expect(getPlayerCargo).not.toHaveBeenCalled();
    expect(client.send).toHaveBeenCalledWith('cargoUpdate', expectedCargo);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// handleJettison
// ──────────────────────────────────────────────────────────────────────────────
describe('MiningService.handleJettison — inventory migration', () => {
  it('uses getCargoState (not getPlayerCargo) to read current cargo', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new MiningService(ctx);

    vi.mocked(getCargoState).mockResolvedValue({ ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0 });
    vi.mocked(validateJettison).mockReturnValue({ valid: true });
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    await svc.handleJettison(client, { resource: 'ore' });

    expect(getCargoState).toHaveBeenCalledWith('user-123');
    expect(getPlayerCargo).not.toHaveBeenCalled();
  });

  it('uses removeFromInventory (not jettisonCargo) to remove the resource', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new MiningService(ctx);

    vi.mocked(getCargoState).mockResolvedValue({ ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0 });
    vi.mocked(validateJettison).mockReturnValue({ valid: true });
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    await svc.handleJettison(client, { resource: 'ore' });

    expect(removeFromInventory).toHaveBeenCalledWith('user-123', 'resource', 'ore', 10);
    expect(jettisonCargo).not.toHaveBeenCalled();
  });

  it('sends cargoUpdate after jettison using getCargoState', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new MiningService(ctx);

    const afterCargo = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 };
    vi.mocked(getCargoState)
      .mockResolvedValueOnce({ ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0 }) // first call: read current
      .mockResolvedValueOnce(afterCargo); // second call: after jettison
    vi.mocked(validateJettison).mockReturnValue({ valid: true });
    vi.mocked(removeFromInventory).mockResolvedValue(undefined);

    await svc.handleJettison(client, { resource: 'ore' });

    expect(client.send).toHaveBeenCalledWith('cargoUpdate', afterCargo);
    expect(getPlayerCargo).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// handleMine
// ──────────────────────────────────────────────────────────────────────────────
describe('MiningService.handleMine — inventory migration', () => {
  it('uses getResourceTotal (not getCargoTotal) for cargo total check', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const svc = new MiningService(ctx);

    const { getSector } = await import('../db/queries.js');
    vi.mocked(getSector).mockResolvedValue({
      resources: { ore: 20, gas: 5, crystal: 2 },
    } as any);
    vi.mocked(getMiningState).mockResolvedValue({ active: false, resource: null });
    vi.mocked(getResourceTotal).mockResolvedValue(5);
    vi.mocked(validateMine).mockReturnValue({
      valid: true,
      state: { active: true, resource: 'ore', rate: 1, startedAt: Date.now(), sectorX: 0, sectorY: 0, sectorYield: 20 },
    });
    vi.mocked(saveMiningState).mockResolvedValue(undefined);

    await svc.handleMine(client, { resource: 'ore' });

    expect(getResourceTotal).toHaveBeenCalledWith('user-123');
    expect(getCargoTotal).not.toHaveBeenCalled();
  });
});
