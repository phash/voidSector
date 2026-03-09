/**
 * TDD: ScanService uses unified inventory instead of cargo table.
 * Verifies addToInventory / getCargoState are used for artefact drops,
 * NOT addToCargo / getPlayerCargo from the legacy cargo table.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

// --- Mock inventoryService ---
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
  getPlayerCargo: vi.fn(),
  // Other queries ScanService needs
  getSector: vi.fn().mockResolvedValue({
    resources: { ore: 5, gas: 2, crystal: 1 },
    contents: [],
    type: 'empty',
    environment: 'empty',
  }),
  saveSector: vi.fn().mockResolvedValue(undefined),
  addDiscoveriesBatch: vi.fn().mockResolvedValue(undefined),
  addDiscovery: vi.fn().mockResolvedValue(undefined),
  getSectorsInRange: vi.fn().mockResolvedValue([]),
  insertScanEvent: vi.fn().mockResolvedValue('event-1'),
  getPlayerScanEvents: vi.fn().mockResolvedValue([]),
  completeScanEvent: vi.fn().mockResolvedValue(true),
  getPlayerCredits: vi.fn().mockResolvedValue(1000),
  addCredits: vi.fn().mockResolvedValue(1100),
  getPlayerReputation: vi.fn().mockResolvedValue(0),
  addBlueprint: vi.fn().mockResolvedValue(undefined),
  getPlayerFaction: vi.fn().mockResolvedValue(null),
  getFactionMembersByPlayerIds: vi.fn().mockResolvedValue([]),
  hasScannedRuin: vi.fn().mockResolvedValue(false),
  insertAncientRuinScan: vi.fn().mockResolvedValue(undefined),
  getActiveShip: vi.fn().mockResolvedValue(null),
  recordAlienEncounter: vi.fn().mockResolvedValue(undefined),
  upsertInventory: vi.fn().mockResolvedValue(undefined),
  deductInventory: vi.fn().mockResolvedValue(undefined),
  getInventory: vi.fn().mockResolvedValue([]),
  getCargoCapForPlayer: vi.fn().mockResolvedValue(50),
  transferInventoryItem: vi.fn().mockResolvedValue(undefined),
  getInventoryItem: vi.fn().mockResolvedValue(null),
}));

vi.mock('../engine/ap.js', () => ({
  calculateCurrentAP: vi.fn().mockReturnValue(100),
}));

vi.mock('../engine/commands.js', () => ({
  validateLocalScan: vi
    .fn()
    .mockReturnValue({ valid: true, newAP: { current: 90 }, hiddenSignatures: 0 }),
  validateAreaScan: vi.fn().mockReturnValue({ valid: true, newAP: { current: 80 }, radius: 3 }),
  createPirateEncounter: vi.fn().mockReturnValue({}),
  getReputationTier: vi.fn().mockReturnValue('neutral'),
}));

vi.mock('../engine/scanEvents.js', () => ({
  checkScanEvent: vi.fn().mockReturnValue({ hasEvent: false }),
}));

vi.mock('../engine/worldgen.js', () => ({
  generateSector: vi.fn().mockReturnValue({
    x: 0,
    y: 0,
    type: 'empty',
    environment: 'empty',
    resources: {},
    contents: [],
    metadata: {},
  }),
}));

vi.mock('../engine/combatV2.js', () => ({
  initCombatV2: vi.fn().mockReturnValue({}),
}));

vi.mock('../engine/ancientRuinsService.js', () => ({
  resolveAncientRuinScan: vi.fn().mockReturnValue({
    fragmentIndex: 0,
    fragmentText: 'Fragment text',
    ruinLevel: 1,
    artefactFound: true,
  }),
}));

vi.mock('../engine/permadeathService.js', () => ({
  getWrecksInSector: vi.fn().mockResolvedValue([]),
  salvageWreckModule: vi.fn().mockResolvedValue(null),
}));

vi.mock('../engine/acepXpService.js', () => ({
  addAcepXpForPlayer: vi.fn().mockResolvedValue(undefined),
  getAcepXpSummary: vi.fn().mockResolvedValue({}),
}));

vi.mock('../engine/traitCalculator.js', () => ({
  calculateTraits: vi.fn().mockReturnValue([]),
}));

vi.mock('../engine/personalityMessages.js', () => ({
  getPersonalityComment: vi.fn().mockReturnValue(null),
}));

vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getAPState: vi.fn().mockResolvedValue({ current: 100, max: 100, lastTick: Date.now() }),
  saveAPState: vi.fn().mockResolvedValue(undefined),
}));

import { ScanService } from '../rooms/services/ScanService.js';
import { addToCargo, getPlayerCargo } from '../db/queries.js';
import { addToInventory, getCargoState } from '../engine/inventoryService.js';
import { resolveAncientRuinScan } from '../engine/ancientRuinsService.js';
import { hasScannedRuin } from '../db/queries.js';

function makeClient(userId = 'user-123', sessionId = 'session-abc'): Client {
  return {
    sessionId,
    auth: { userId, username: 'TestPilot', role: 'player' },
    send: vi.fn(),
  } as unknown as Client;
}

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    checkRate: vi.fn().mockReturnValue(true),
    _px: vi.fn().mockReturnValue(5),
    _py: vi.fn().mockReturnValue(10),
    _pst: vi.fn().mockReturnValue('empty'),
    quadrantX: 0,
    quadrantY: 0,
    getShipForClient: vi.fn().mockReturnValue({ cargoCap: 50, scannerLevel: 1 }),
    getPlayerBonuses: vi.fn().mockResolvedValue({ scanRadiusBonus: 0 }),
    checkQuestProgress: vi.fn().mockResolvedValue(undefined),
    applyXpGain: vi.fn().mockResolvedValue(undefined),
    applyReputationChange: vi.fn().mockResolvedValue(undefined),
    combatV2States: { set: vi.fn() },
    sendToPlayer: vi.fn(),
    send: vi.fn(),
    ...overrides,
  } as unknown as import('../rooms/services/ServiceContext.js').ServiceContext;
}

beforeEach(() => vi.clearAllMocks());

// ──────────────────────────────────────────────────────────────────────────────
// handleLocalScan — ancient ruin artefact drop
// ──────────────────────────────────────────────────────────────────────────────
describe('ScanService.handleLocalScan ruin artefact — inventory migration', () => {
  it('uses addToInventory (not addToCargo) for ancient ruin artefact drop', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const { getSector } = await import('../db/queries.js');
    vi.mocked(getSector).mockResolvedValue({
      x: 5,
      y: 10,
      resources: { ore: 5, gas: 0, crystal: 0 },
      contents: ['ruin'],
      type: 'empty',
      environment: 'empty',
      metadata: {},
    } as any);
    vi.mocked(hasScannedRuin).mockResolvedValue(false);
    vi.mocked(resolveAncientRuinScan).mockReturnValue({
      fragmentIndex: 0,
      fragmentText: 'Ancient text',
      ruinLevel: 2,
      artefactFound: true,
    });
    vi.mocked(getCargoState).mockResolvedValue({
      ore: 0,
      gas: 0,
      crystal: 0,
      slates: 0,
      artefact: 1,
    });

    const svc = new ScanService(ctx);
    await svc.handleLocalScan(client);

    expect(addToInventory).toHaveBeenCalledWith('user-123', 'resource', 'artefact', 1);
    expect(addToCargo).not.toHaveBeenCalled();
  });

  it('uses getCargoState (not getPlayerCargo) for cargoUpdate after ruin scan', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const { getSector } = await import('../db/queries.js');
    vi.mocked(getSector).mockResolvedValue({
      x: 5,
      y: 10,
      resources: { ore: 5, gas: 0, crystal: 0 },
      contents: ['ruin'],
      type: 'empty',
      environment: 'empty',
      metadata: {},
    } as any);
    vi.mocked(hasScannedRuin).mockResolvedValue(false);
    vi.mocked(resolveAncientRuinScan).mockReturnValue({
      fragmentIndex: 0,
      fragmentText: 'Ancient text',
      ruinLevel: 2,
      artefactFound: true,
    });
    const cargoState = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 1 };
    vi.mocked(getCargoState).mockResolvedValue(cargoState);

    const svc = new ScanService(ctx);
    await svc.handleLocalScan(client);

    expect(getCargoState).toHaveBeenCalledWith('user-123');
    expect(getPlayerCargo).not.toHaveBeenCalled();
    expect(client.send).toHaveBeenCalledWith('cargoUpdate', cargoState);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// handleCompleteScanEvent — artefact reward
// ──────────────────────────────────────────────────────────────────────────────
describe('ScanService.handleCompleteScanEvent artefact reward — inventory migration', () => {
  it('uses addToInventory (not addToCargo) for artefact reward', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const { getPlayerScanEvents, completeScanEvent } = await import('../db/queries.js');
    vi.mocked(getPlayerScanEvents).mockResolvedValue([
      {
        id: 'evt-1',
        event_type: 'artifact_find',
        sector_x: 5,
        sector_y: 10,
        status: 'discovered',
        data: { rewardArtefact: 1 },
        created_at: new Date().toISOString(),
      },
    ] as any);
    vi.mocked(completeScanEvent).mockResolvedValue(true);
    const cargoState = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 1 };
    vi.mocked(getCargoState).mockResolvedValue(cargoState);

    const svc = new ScanService(ctx);
    await svc.handleCompleteScanEvent(client, { eventId: 'evt-1' });

    expect(addToInventory).toHaveBeenCalledWith('user-123', 'resource', 'artefact', 1);
    expect(addToCargo).not.toHaveBeenCalled();
  });

  it('uses getCargoState (not getPlayerCargo) for cargoUpdate after scan event', async () => {
    const client = makeClient();
    const ctx = makeCtx();
    const { getPlayerScanEvents, completeScanEvent } = await import('../db/queries.js');
    vi.mocked(getPlayerScanEvents).mockResolvedValue([
      {
        id: 'evt-1',
        event_type: 'artifact_find',
        sector_x: 5,
        sector_y: 10,
        status: 'discovered',
        data: { rewardArtefact: 1 },
        created_at: new Date().toISOString(),
      },
    ] as any);
    vi.mocked(completeScanEvent).mockResolvedValue(true);
    const cargoState = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 1 };
    vi.mocked(getCargoState).mockResolvedValue(cargoState);

    const svc = new ScanService(ctx);
    await svc.handleCompleteScanEvent(client, { eventId: 'evt-1' });

    expect(getCargoState).toHaveBeenCalledWith('user-123');
    expect(getPlayerCargo).not.toHaveBeenCalled();
    expect(client.send).toHaveBeenCalledWith('cargoUpdate', cargoState);
  });
});
