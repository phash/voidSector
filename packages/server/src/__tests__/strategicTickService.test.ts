import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrategicTickService } from '../engine/strategicTickService.js';

// Mock all DB queries
vi.mock('../db/queries.js', () => ({
  getAllQuadrantControls: vi.fn(),
  upsertQuadrantControl: vi.fn(),
  getAllFactionConfigs: vi.fn(),
  getActiveNpcFleets: vi.fn(),
  createNpcFleet: vi.fn(),
  getArrivedNpcFleets: vi.fn(),
  deleteArrivedNpcFleets: vi.fn(),
  logExpansionEvent: vi.fn(),
  // Phase 2: the tick queries the human frontier before the (dormant) expansion step.
  getHumanFrontierMaxDistance: vi.fn().mockResolvedValue(0),
  getVoidClusters: vi.fn().mockResolvedValue([]),
  upsertVoidCluster: vi.fn().mockResolvedValue(undefined),
  createVoidHive: vi.fn().mockResolvedValue(undefined),
  deleteVoidHive: vi.fn().mockResolvedValue(undefined),
  cleanupLegacyVoidData: vi.fn().mockResolvedValue(undefined),
  getExpiredPlayerQuestsWithItems: vi.fn().mockResolvedValue([]),
  expireBountiesForRefund: vi.fn().mockResolvedValue([]),
  expireExchangeListings: vi.fn().mockResolvedValue([]),
  addCredits: vi.fn().mockResolvedValue(undefined),
  updateQuestStatus: vi.fn().mockResolvedValue(undefined),
}));

// Mock inventoryService for exchange expire-return
vi.mock('../engine/inventoryService.js', () => ({
  removeFromInventory: vi.fn().mockResolvedValue(undefined),
  addToInventory: vi.fn().mockResolvedValue(undefined),
}));

import {
  getAllQuadrantControls,
  getAllFactionConfigs,
  getArrivedNpcFleets,
  deleteArrivedNpcFleets,
  createNpcFleet,
  getVoidClusters,
} from '../db/queries.js';

const mockGetAllQuadrantControls = vi.mocked(getAllQuadrantControls);
const mockGetAllFactionConfigs = vi.mocked(getAllFactionConfigs);
const mockGetArrivedNpcFleets = vi.mocked(getArrivedNpcFleets);
const mockDeleteArrivedNpcFleets = vi.mocked(deleteArrivedNpcFleets);
const mockCreateNpcFleet = vi.mocked(createNpcFleet);

// Mock Redis
const mockRedis = {
  lpush: vi.fn().mockResolvedValue(1),
  ltrim: vi.fn().mockResolvedValue('OK'),
} as any;

describe('StrategicTickService', () => {
  let service: StrategicTickService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StrategicTickService(mockRedis);
  });

  it('constructs without error', () => {
    expect(service).toBeDefined();
  });

  it('pushWarTickerEvent stores event in Redis and trims to 10', async () => {
    await service.pushWarTickerEvent("K'THARI INVASION — Quadrant [4/-2]");
    expect(mockRedis.lpush).toHaveBeenCalledWith('war_ticker', expect.stringContaining("K'THARI"));
    expect(mockRedis.ltrim).toHaveBeenCalledWith('war_ticker', 0, 9);
  });

  it('pushWarTickerEvent stores valid JSON with message and ts', async () => {
    await service.pushWarTickerEvent('TEST EVENT');
    const [, json] = mockRedis.lpush.mock.calls[0];
    const parsed = JSON.parse(json);
    expect(parsed.message).toBe('TEST EVENT');
    expect(typeof parsed.ts).toBe('number');
  });

  it('init loads faction configs from DB', async () => {
    mockGetAllFactionConfigs.mockResolvedValue([]);
    await service.init();
    expect(mockGetAllFactionConfigs).toHaveBeenCalled();
  });

  it('tick processes arrived fleets and cleans them up', async () => {
    mockGetArrivedNpcFleets.mockResolvedValue([]);
    mockDeleteArrivedNpcFleets.mockResolvedValue(undefined);
    mockGetAllQuadrantControls.mockResolvedValue([]);
    mockGetAllFactionConfigs.mockResolvedValue([]);
    await service.init();
    await service.tick(new Map());
    expect(mockGetArrivedNpcFleets).toHaveBeenCalled();
    expect(mockDeleteArrivedNpcFleets).toHaveBeenCalled();
  });

  it('tick calls void lifecycle processing', async () => {
    mockGetArrivedNpcFleets.mockResolvedValue([]);
    mockDeleteArrivedNpcFleets.mockResolvedValue(undefined);
    mockGetAllQuadrantControls.mockResolvedValue([]);
    mockGetAllFactionConfigs.mockResolvedValue([]);
    const mockGetVoidClusters = vi.mocked(getVoidClusters);
    mockGetVoidClusters.mockResolvedValue([]);
    await service.init();
    await service.tick(new Map());
    expect(mockGetVoidClusters).toHaveBeenCalled();
  });
});
