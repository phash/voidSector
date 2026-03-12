import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NavigationService } from '../NavigationService.js';
import { STEP_INTERVAL_MS } from '../../../engine/autopilot.js';

// NavigationService imports from two places:
//   - '../../db/queries.js'      for getSector, addDiscovery, isRouteDiscovered, saveAutopilotRoute, etc.
//   - './RedisAPStore.js'        for getAPState, saveAPState, getMiningState, getFuelState, getPlayerPosition, savePlayerPosition
vi.mock('../../../db/queries.js', () => ({
  addDiscovery: vi.fn(),
  isRouteDiscovered: vi.fn(),
  getSector: vi.fn(),
  saveSector: vi.fn(),
  saveAutopilotRoute: vi.fn(),
  completeAutopilotRoute: vi.fn(),
  pauseAutopilotRoute: vi.fn(),
  cancelAutopilotRoute: vi.fn(),
  getActiveAutopilotRoute: vi.fn(),
  updateAutopilotStep: vi.fn(),
  getAllQuadrantControls: vi.fn().mockResolvedValue([]),
  getPlayerCredits: vi.fn(),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  getPlayerHomeBase: vi.fn(),
  playerHasGateCode: vi.fn(),
  recordNewsEvent: vi.fn(),
  awardBadge: vi.fn(),
  hasAnyoneBadge: vi.fn(),
  getPlayerReputation: vi.fn(),
  updatePlayerStationRep: vi.fn(),
  getPlayerStationRep: vi.fn(),
  addPlayerKnownJumpGate: vi.fn(),
  getPlayerJumpGate: vi.fn(),
  getAllPlayerGates: vi.fn(),
  getAllJumpGateLinks: vi.fn(),
  getJumpGateLinks: vi.fn(),
  getJumpGate: vi.fn(),
  insertJumpGate: vi.fn(),
}));
vi.mock('../RedisAPStore.js', () => ({
  getAPState: vi.fn(),
  saveAPState: vi.fn(),
  getMiningState: vi.fn(),
  getFuelState: vi.fn(),
  getPlayerPosition: vi.fn(),
  savePlayerPosition: vi.fn(),
  getHyperdriveState: vi.fn(),
  setHyperdriveState: vi.fn(),
}));
vi.mock('../../../engine/worldgen.js', () => ({
  generateSector: vi.fn(),
  isFrontierQuadrant: vi.fn(),
  hashCoords: vi.fn().mockReturnValue(0),
  isInBlackHoleCluster: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../engine/quadrantEngine.js', () => ({
  sectorToQuadrant: vi.fn().mockReturnValue({ qx: 0, qy: 0 }),
  isFrontierQuadrant: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../engine/expansionEngine.js', () => ({
  isFrontierQuadrant: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../engine/acepXpService.js', () => ({
  addAcepXpForPlayer: vi.fn(),
}));
vi.mock('../../../engine/ap.js', () => ({
  calculateCurrentAP: vi.fn().mockReturnValue({ current: 100, max: 100 }),
}));
vi.mock('../../../engine/npcgen.js', () => ({ getStationFaction: vi.fn() }));
vi.mock('../../../engine/npcStationEngine.js', () => ({ recordVisit: vi.fn() }));
vi.mock('../../../engine/jumpgates.js', () => ({
  checkJumpGate: vi.fn(),
  checkAncientJumpGate: vi.fn(),
  generateGateTarget: vi.fn(),
}));
vi.mock('../../../engine/jumpgateRouting.js', () => ({ findReachableGates: vi.fn() }));
vi.mock('../../../engine/commands.js', () => ({
  validateJump: vi.fn(),
  getReputationTier: vi.fn(),
}));
vi.mock('../../auth.js', () => ({}));

import {
  addDiscovery,
  isRouteDiscovered,
  saveAutopilotRoute,
  completeAutopilotRoute,
  getSector,
} from '../../../db/queries.js';
import {
  getAPState,
  getMiningState,
  getPlayerPosition,
  savePlayerPosition,
} from '../RedisAPStore.js';
import { sectorToQuadrant } from '../../../engine/quadrantEngine.js';
import { calculateCurrentAP } from '../../../engine/ap.js';

function makeCtx(overrides: Partial<any> = {}): any {
  return {
    state: { players: new Map() },
    quadrantX: 0,
    quadrantY: 0,
    clientShips: new Map(),
    clientHullTypes: new Map(),
    autopilotTimers: new Map(),
    playerSectorData: new Map(),
    checkRate: () => true,
    getShipForClient: () =>
      ({
        apCostJump: 2,
        engineSpeed: 1,
        hullType: 'interceptor',
        stats: { cargoCap: 10 },
      } as any),
    getPlayerBonuses: vi.fn().mockResolvedValue({}),
    _px: () => 0,
    _py: () => 0,
    _pst: () => 'empty',
    send: vi.fn(),
    broadcast: vi.fn(),
    broadcastToFaction: vi.fn(),
    broadcastToSector: vi.fn(),
    checkFirstContact: vi.fn(),
    checkQuestProgress: vi.fn(),
    checkAndEmitDistressCalls: vi.fn(),
    applyReputationChange: vi.fn(),
    applyXpGain: vi.fn(),
    ...overrides,
  };
}

function makeClient(sessionId = 'sess1', auth = { userId: 'user1' }): any {
  return { sessionId, auth, send: vi.fn() };
}

describe('startAutopilotTimer — overrideTickMs', () => {
  it('accepts overrideTickMs as 7th parameter and registers a timer', () => {
    vi.useFakeTimers();
    const ctx = makeCtx();
    const service = new NavigationService(ctx);
    const client = makeClient();
    const auth = { userId: 'user1' };
    const ship = ctx.getShipForClient();
    const path = [{ x: 1, y: 1 }, { x: 2, y: 1 }];

    vi.mocked(getAPState).mockResolvedValue({ current: 100, max: 100, lastUpdated: Date.now() } as any);
    vi.mocked(savePlayerPosition).mockResolvedValue(undefined);
    vi.mocked(addDiscovery).mockResolvedValue(undefined);
    vi.mocked(completeAutopilotRoute).mockResolvedValue(undefined);
    vi.mocked(getSector).mockResolvedValue({ type: 'empty' } as any);

    // Should not throw with 7 args — timer is registered
    service.startAutopilotTimer(client, auth, path, 0, false, ship, 3000);
    expect(ctx.autopilotTimers.has('sess1')).toBe(true);

    // At STEP_INTERVAL_MS (100ms), the async tick has NOT fired (overrideTickMs is 3000)
    vi.advanceTimersByTime(STEP_INTERVAL_MS);
    expect(client.send).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

describe('handleSlowFlight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sectorToQuadrant).mockImplementation((_x, _y) => ({ qx: 0, qy: 0 }));
    vi.mocked(getMiningState).mockResolvedValue(null);
    vi.mocked(getPlayerPosition).mockResolvedValue({ x: 1, y: 1 });
    vi.mocked(getAPState).mockResolvedValue({
      current: 100,
      max: 100,
      lastUpdated: Date.now(),
    } as any);
    vi.mocked(saveAutopilotRoute).mockResolvedValue(undefined);
    vi.mocked(isRouteDiscovered).mockResolvedValue(true);
  });

  it('rejects with error when target is in a different quadrant', async () => {
    vi.mocked(sectorToQuadrant)
      .mockReturnValueOnce({ qx: 0, qy: 0 }) // current pos
      .mockReturnValueOnce({ qx: 1, qy: 0 }); // target pos — different!

    const ctx = makeCtx();
    const service = new NavigationService(ctx);
    const client = makeClient();

    await service.handleSlowFlight(client, { targetX: 10001, targetY: 1 });

    expect(client.send).toHaveBeenCalledWith('error', {
      code: 'SLOW_FLIGHT_FAIL',
      message: expect.stringContaining('intra-quadrant'),
    });
    expect(ctx.autopilotTimers.has('sess1')).toBe(false);
  });

  it('rejects when autopilot already active', async () => {
    const ctx = makeCtx();
    ctx.autopilotTimers.set('sess1', {} as any);
    const service = new NavigationService(ctx);
    const client = makeClient();

    await service.handleSlowFlight(client, { targetX: 3, targetY: 1 });

    expect(client.send).toHaveBeenCalledWith('error', {
      code: 'SLOW_FLIGHT_FAIL',
      message: expect.any(String),
    });
  });

  it('sends autopilotStart with source slow_flight when valid', async () => {
    vi.useFakeTimers();
    const ctx = makeCtx();
    const service = new NavigationService(ctx);
    const client = makeClient();

    await service.handleSlowFlight(client, { targetX: 3, targetY: 1 });

    expect(client.send).toHaveBeenCalledWith(
      'autopilotStart',
      expect.objectContaining({ source: 'slow_flight', targetX: 3, targetY: 1 }),
    );
    expect(ctx.autopilotTimers.has('sess1')).toBe(true);
    vi.useRealTimers();
  });

  it('stops when AP below apCostJump', async () => {
    vi.useFakeTimers();
    vi.mocked(getAPState).mockResolvedValue({ current: 1, max: 100, lastUpdated: Date.now() } as any);
    const ctx = makeCtx();
    const service = new NavigationService(ctx);
    const client = makeClient();

    // AP is 1, apCostJump is 2 — should still start (checked before first tick)
    // but once timer runs, it will find AP < cost and pause
    await service.handleSlowFlight(client, { targetX: 3, targetY: 1 });
    // autopilotStart is still sent (AP check happens at tick time, not before)
    expect(client.send).toHaveBeenCalledWith('autopilotStart', expect.objectContaining({ source: 'slow_flight' }));
    vi.useRealTimers();
  });
});
