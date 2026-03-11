import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

// AUSBAU Level 3 = 18 XP (level requires >= 18 for slot 2 which needs labTier >= 3)
vi.mock('../engine/acepXpService.js', () => ({
  getAcepXpSummary: vi.fn().mockResolvedValue({ ausbau: 18, intel: 0, kampf: 0, explorer: 0 }),
  getAcepEffects: vi.fn().mockReturnValue({
    extraModuleSlots: 0, cargoMultiplier: 1, miningBonus: 0,
    scanRadiusBonus: 0, combatDamageBonus: 0,
    ancientDetection: false, helionDecoderEnabled: false,
  }),
  boostAcepPath: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../db/queries.js', () => ({
  getPlayerResearch: vi.fn().mockResolvedValue({ unlockedModules: ['laser_mk1'], blueprints: [] }),
  getActiveResearch: vi.fn().mockResolvedValue(null),
  getWissen: vi.fn().mockResolvedValue(100),
  getResearchLabTier: vi.fn().mockResolvedValue(1), // old fn — must NOT be called
  getTypedArtefacts: vi.fn().mockResolvedValue({}),
  getPlayerReputations: vi.fn().mockResolvedValue([]),
  getActiveShip: vi.fn().mockResolvedValue({ id: 'ship-1', hullType: 'scout', modules: [] }),
  getPlayerShips: vi.fn().mockResolvedValue([]),
  updateShipModules: vi.fn().mockResolvedValue(undefined),
  renameShip: vi.fn().mockResolvedValue(undefined),
  renameBase: vi.fn().mockResolvedValue(undefined),
  getInventory: vi.fn().mockResolvedValue([]),
  getPlayerHomeBase: vi.fn().mockResolvedValue(null),
  startActiveResearch: vi.fn().mockResolvedValue(undefined),
  deleteActiveResearch: vi.fn().mockResolvedValue(undefined),
  getPlayerCredits: vi.fn().mockResolvedValue(9999),
  deductCredits: vi.fn().mockResolvedValue(undefined),
  deductTypedArtefacts: vi.fn().mockResolvedValue(undefined),
  deductWissen: vi.fn().mockResolvedValue(undefined),
  addWissen: vi.fn().mockResolvedValue(undefined),
  addUnlockedModule: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn().mockResolvedValue(undefined),
  removeFromInventory: vi.fn().mockResolvedValue(undefined),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
  getInventoryItem: vi.fn().mockResolvedValue(null),
}));

vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getFuelState: vi.fn().mockResolvedValue(100),
}));

import { ShipService } from '../rooms/services/ShipService.js';
import { getResearchLabTier } from '../db/queries.js';

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
  } as any;
}

beforeEach(() => vi.clearAllMocks());

describe('ShipService.handleStartResearch — AUSBAU level gating', () => {
  it('does NOT call getResearchLabTier', async () => {
    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleStartResearch(client, { moduleId: 'laser_mk1', slot: 1 });
    expect(getResearchLabTier).not.toHaveBeenCalled();
  });

  it('slot 2 with AUSBAU level 3 (18 XP) does not produce AUSBAU tier error', async () => {
    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleStartResearch(client, { moduleId: 'laser_mk1', slot: 2 });
    const calls = (client.send as ReturnType<typeof vi.fn>).mock.calls;
    const tierErrors = calls.filter(
      ([msg, data]: [string, any]) =>
        msg === 'error' && typeof data?.message === 'string' && data.message.includes('AUSBAU Level 3'),
    );
    expect(tierErrors).toHaveLength(0);
  });
});
