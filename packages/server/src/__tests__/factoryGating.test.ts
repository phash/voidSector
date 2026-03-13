import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

vi.mock('../engine/acepXpService.js', () => ({
  getAcepXpSummary: vi.fn().mockResolvedValue({ ausbau: 0, intel: 0, kampf: 0, explorer: 0 }),
  addAcepXpForPlayer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/npcgen.js', () => ({
  getStationFaction: vi.fn().mockReturnValue(null),
}));

vi.mock('../engine/npcStationEngine.js', () => ({
  getOrInitStation: vi.fn().mockResolvedValue({}),
  recordTrade: vi.fn().mockResolvedValue(undefined),
  canBuyFromStation: vi.fn().mockReturnValue({ canBuy: false, effectiveAmount: 0 }),
  canSellToStation: vi.fn().mockReturnValue({ canSell: false, effectiveAmount: 0 }),
  calculateCurrentStock: vi.fn().mockReturnValue(0),
  getStationLevel: vi.fn().mockReturnValue(1),
  calculatePrice: vi.fn().mockReturnValue(10),
}));

vi.mock('../db/npcStationQueries.js', () => ({
  getStationInventoryItem: vi.fn().mockResolvedValue(null),
  upsertInventoryItem: vi.fn().mockResolvedValue(undefined),
  getStationInventory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../db/queries.js', () => ({
  getActiveShip: vi.fn().mockResolvedValue({ id: 'ship-1', modules: [] }),
  getPlayerStructure: vi.fn().mockResolvedValue({ id: 'factory-1', type: 'factory' }),
  getOrCreateFactoryState: vi.fn().mockResolvedValue(undefined),
  getPlayerResearch: vi.fn().mockResolvedValue({ unlockedModules: [], blueprints: [] }),
  getFactoryStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
  getPlayerCredits: vi.fn().mockResolvedValue(1000),
  deductCredits: vi.fn().mockResolvedValue(undefined),
  getPlayerReputations: vi.fn().mockResolvedValue([]),
  getInventory: vi.fn().mockResolvedValue([]),
  addCredits: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn().mockResolvedValue(undefined),
  removeFromInventory: vi.fn().mockResolvedValue(undefined),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
  getResourceTotal: vi.fn().mockResolvedValue(0),
  canAddResource: vi.fn().mockResolvedValue(true),
}));

vi.mock('../engine/productionEngine.js', () => ({
  setActiveRecipe: vi.fn().mockResolvedValue({ success: false, error: 'No blueprint' }),
  getOrCreateFactoryState: vi.fn().mockResolvedValue(undefined),
  collectOutput: vi.fn().mockResolvedValue(undefined),
  getFactoryStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
  transferOutputToCargo: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/commands.js', () => ({
  validateNpcTrade: vi.fn().mockReturnValue({ valid: false }),
  validateTransfer: vi.fn().mockReturnValue({ valid: false }),
  getReputationTier: vi.fn().mockReturnValue('neutral'),
}));

import { EconomyService } from '../rooms/services/EconomyService.js';
import { getAcepXpSummary } from '../engine/acepXpService.js';

function makeClient(userId = 'u1'): Client {
  return {
    sessionId: 's1',
    auth: { userId, username: 'Pilot', role: 'player' },
    send: vi.fn(),
  } as unknown as Client;
}

function makeCtx() {
  return {
    checkRate: vi.fn().mockReturnValue(true),
    getShipForClient: vi.fn().mockReturnValue({ cargoCap: 50 }),
    checkQuestProgress: vi.fn().mockResolvedValue(undefined),
    applyXpGain: vi.fn().mockResolvedValue(undefined),
    applyReputationChange: vi.fn().mockResolvedValue(undefined),
    sendToPlayer: vi.fn(),
    send: vi.fn(),
    _px: vi.fn().mockReturnValue(0),
    _py: vi.fn().mockReturnValue(0),
  } as any;
}

beforeEach(() => vi.clearAllMocks());

describe('EconomyService.handleFactorySetRecipe — AUSBAU gate', () => {
  it('sends FACTORY_LOCKED when AUSBAU level is 1 (0 XP)', async () => {
    vi.mocked(getAcepXpSummary).mockResolvedValue({ ausbau: 0, intel: 0, kampf: 0, explorer: 0 });
    const svc = new EconomyService(makeCtx());
    const client = makeClient();
    await svc.handleFactorySetRecipe(client, { recipeId: 'ore_plate' });
    const calls = (client.send as ReturnType<typeof vi.fn>).mock.calls;
    const errorCall = calls.find(([msg]: [string]) => msg === 'error');
    expect(errorCall).toBeDefined();
    expect(errorCall![1].code).toBe('FACTORY_LOCKED');
  });

  it('does NOT send FACTORY_LOCKED when AUSBAU level is 2 (8 XP)', async () => {
    vi.mocked(getAcepXpSummary).mockResolvedValue({ ausbau: 8, intel: 0, kampf: 0, explorer: 0 });
    const svc = new EconomyService(makeCtx());
    const client = makeClient();
    await svc.handleFactorySetRecipe(client, { recipeId: 'ore_plate' });
    const calls = (client.send as ReturnType<typeof vi.fn>).mock.calls;
    const factoryLocked = calls.find(
      ([msg, data]: [string, any]) => msg === 'error' && data?.code === 'FACTORY_LOCKED',
    );
    expect(factoryLocked).toBeUndefined();
  });
});
