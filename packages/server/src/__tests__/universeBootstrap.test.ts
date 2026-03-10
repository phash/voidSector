// packages/server/src/__tests__/universeBootstrap.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be declared before imports
const mockStratTick = vi.fn().mockResolvedValue(undefined);
const mockStratInit = vi.fn().mockResolvedValue(undefined);
const MockStrategicTickService = vi.fn().mockImplementation(() => ({
  init: mockStratInit,
  tick: mockStratTick,
}));

let capturedOnTick: ((result: { tickCount: number }) => void) | null = null;
const mockEngineStart = vi.fn();
const MockUniverseTickEngine = vi
  .fn()
  .mockImplementation((cb: (result: { tickCount: number }) => void) => {
    capturedOnTick = cb;
    return { start: mockEngineStart, stop: vi.fn() };
  });

vi.mock('../engine/strategicTickService.js', () => ({
  StrategicTickService: MockStrategicTickService,
}));

vi.mock('../engine/universeTickEngine.js', () => ({
  UniverseTickEngine: MockUniverseTickEngine,
}));

vi.mock('../db/queries.js', () => ({
  getAllHumanityReps: vi.fn().mockResolvedValue({ kthari: -40, archivists: 60 }),
  ensureKernweltStation: vi.fn().mockResolvedValue(undefined),
  ensureZentrumQuadrant: vi.fn().mockResolvedValue(undefined),
  ensureAlienHomeQuadrants: vi.fn().mockResolvedValue(false),
  getAllQuadrantControls: vi.fn().mockResolvedValue([]),
}));

vi.mock('../engine/civStationService.js', () => ({
  ensureCivStations: vi.fn().mockResolvedValue(undefined),
  spawnMissingDrones: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/civShipService.js', () => ({
  processCivTick: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/constructionTickService.js', () => ({
  processConstructionTick: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    lpush: vi.fn(),
    ltrim: vi.fn(),
  })),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getAllHumanityReps, ensureKernweltStation, ensureZentrumQuadrant } from '../db/queries.js';

describe('startUniverseEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnTick = null;
    // Re-setup mocks after clear
    MockStrategicTickService.mockImplementation(() => ({
      init: mockStratInit,
      tick: mockStratTick,
    }));
    MockUniverseTickEngine.mockImplementation((cb: (result: { tickCount: number }) => void) => {
      capturedOnTick = cb;
      return { start: mockEngineStart, stop: vi.fn() };
    });
    vi.mocked(getAllHumanityReps).mockResolvedValue({ kthari: -40, archivists: 60 });
  });

  it('seeds Kernwelt on startup', async () => {
    const { startUniverseEngine } = await import('../engine/universeBootstrap.js');
    await startUniverseEngine();
    expect(vi.mocked(ensureKernweltStation)).toHaveBeenCalledOnce();
    expect(vi.mocked(ensureZentrumQuadrant)).toHaveBeenCalledOnce();
  });

  it('starts UniverseTickEngine on call', async () => {
    const { startUniverseEngine } = await import('../engine/universeBootstrap.js');
    await startUniverseEngine();

    expect(MockUniverseTickEngine).toHaveBeenCalledOnce();
    expect(mockEngineStart).toHaveBeenCalledOnce();
  });

  it('initializes StrategicTickService before starting engine', async () => {
    const order: string[] = [];
    mockStratInit.mockImplementation(async () => {
      order.push('init');
    });
    mockEngineStart.mockImplementation(() => {
      order.push('start');
    });

    const { startUniverseEngine } = await import('../engine/universeBootstrap.js');
    await startUniverseEngine();

    expect(order).toEqual(['init', 'start']);
  });

  it('does NOT call strategic tick on ticks 1-11', async () => {
    const { startUniverseEngine } = await import('../engine/universeBootstrap.js');
    await startUniverseEngine();

    for (let i = 1; i <= 11; i++) {
      capturedOnTick!({ tickCount: i });
    }
    // Allow async ops to settle
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockStratTick).not.toHaveBeenCalled();
  });

  it('calls strategic tick on tick 12 with repStore from DB', async () => {
    const { startUniverseEngine } = await import('../engine/universeBootstrap.js');
    await startUniverseEngine();

    capturedOnTick!({ tickCount: 12 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getAllHumanityReps).toHaveBeenCalledOnce();
    expect(mockStratTick).toHaveBeenCalledOnce();
    const repStoreArg: Map<string, number> = mockStratTick.mock.calls[0][0];
    expect(repStoreArg).toBeInstanceOf(Map);
    expect(repStoreArg.get('kthari')).toBe(-40);
    expect(repStoreArg.get('archivists')).toBe(60);
  });

  it('calls strategic tick on every multiple of 12', async () => {
    const { startUniverseEngine } = await import('../engine/universeBootstrap.js');
    await startUniverseEngine();

    for (const count of [12, 24, 36]) {
      capturedOnTick!({ tickCount: count });
    }
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockStratTick).toHaveBeenCalledTimes(3);
  });

  it('does NOT call strategic tick on tick 13', async () => {
    const { startUniverseEngine } = await import('../engine/universeBootstrap.js');
    await startUniverseEngine();

    capturedOnTick!({ tickCount: 13 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockStratTick).not.toHaveBeenCalled();
  });
});
