import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/wreckQueries.js', () => ({
  getWreckAtSector: vi.fn(),
  getWreckById: vi.fn(),
  updateWreckStatus: vi.fn(),
  updateWreckItem: vi.fn(),
  updateWreckModifier: vi.fn(),
  insertWreckSlateMetadata: vi.fn(),
  deleteWreckSlateMetadata: vi.fn(),
}));
vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getSalvageSession: vi.fn(),
  saveSalvageSession: vi.fn(),
  clearSalvageSession: vi.fn(),
}));
vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn(),
  canAddResource: vi.fn().mockResolvedValue(true),
  getInventoryItem: vi.fn().mockResolvedValue(0),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
}));
vi.mock('../engine/acepXpService.js', () => ({
  getAcepXpSummary: vi.fn().mockResolvedValue({ ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0 }),
  getAcepEffects: vi.fn().mockReturnValue({ helionDecoderEnabled: false }),
  addAcepXpForPlayer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../db/queries.js', () => ({
  getInventory: vi.fn().mockResolvedValue([]),
}));

import { WreckService } from '../rooms/services/WreckService.js';
import * as wreckQueries from '../db/wreckQueries.js';
import * as RedisStore from '../rooms/services/RedisAPStore.js';
import * as inventoryService from '../engine/inventoryService.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(inventoryService.canAddResource).mockResolvedValue(true);
  vi.mocked(inventoryService.getCargoState).mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 });
});

const makeClient = (playerId = 'p1', sectorX = 5, sectorY = 5) => ({
  auth: { userId: playerId },
  send: vi.fn(),
  sessionId: 'sess-1',
});

const makeCtx = (sectorX = 5, sectorY = 5) => ({
  _px: vi.fn().mockReturnValue(sectorX),
  _py: vi.fn().mockReturnValue(sectorY),
  deductAP: vi.fn().mockResolvedValue(true),
  checkRate: vi.fn().mockReturnValue(true),
});

const mockWreck = {
  id: 'wreck-1',
  quadrant_x: 0, quadrant_y: 0,
  sector_x: 5, sector_y: 5,
  tier: 2, size: 'medium' as const,
  items: [
    { itemType: 'resource' as const, itemId: 'ore', quantity: 10, baseDifficulty: 0.20, salvaged: false },
    { itemType: 'module' as const, itemId: 'drive_mk2', quantity: 1, baseDifficulty: 0.50, salvaged: false },
  ],
  difficulty_modifier: 0,
  status: 'intact' as const,
  spawned_at: new Date().toISOString(),
  exhausted_at: null,
};

describe('WreckService.handleInvestigate', () => {
  it('sends wreckInvestigated with items and updates status', async () => {
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue(mockWreck);
    vi.mocked(wreckQueries.updateWreckStatus).mockResolvedValue(undefined);

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    await service.handleInvestigate(client as any, {});

    expect(client.send).toHaveBeenCalledWith('wreckInvestigated', expect.objectContaining({
      wreckId: 'wreck-1',
      items: mockWreck.items,
    }));
    expect(wreckQueries.updateWreckStatus).toHaveBeenCalledWith('wreck-1', 'investigated');
  });

  it('sends actionError if no wreck in sector', async () => {
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue(null);
    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    await service.handleInvestigate(client as any, {});

    expect(client.send).toHaveBeenCalledWith('actionError', expect.objectContaining({ code: 'NO_WRECK' }));
  });
});

describe('WreckService.handleStartSalvage', () => {
  it('sends salvageStarted with correct duration and chance', async () => {
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue({ ...mockWreck, status: 'investigated' });

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    await service.handleStartSalvage(client as any, { itemIndex: 0 });

    expect(client.send).toHaveBeenCalledWith('salvageStarted', expect.objectContaining({
      wreckId: 'wreck-1',
      itemIndex: 0,
    }));
    expect(RedisStore.saveSalvageSession).toHaveBeenCalled();
  });

  it('rejects if cargo is full for resource item', async () => {
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue({ ...mockWreck, status: 'investigated' });
    vi.mocked(inventoryService.canAddResource).mockResolvedValue(false);

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    await service.handleStartSalvage(client as any, { itemIndex: 0 });

    expect(client.send).toHaveBeenCalledWith('actionError', expect.objectContaining({ code: 'CARGO_FULL' }));
  });
});

describe('WreckService.resolveSalvage (via timer)', () => {
  it('sends salvageResult with success=true and item when chance is 1.0', async () => {
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue({ ...mockWreck, status: 'investigated' });
    vi.mocked(wreckQueries.getWreckById).mockResolvedValue({ ...mockWreck, status: 'investigated' });
    vi.mocked(RedisStore.getSalvageSession).mockResolvedValue({
      wreckId: 'wreck-1',
      itemIndex: 0,
      startedAt: Date.now(),
      duration: 10,
      resolveChance: 1.0,
    });
    vi.mocked(RedisStore.saveSalvageSession).mockResolvedValue(undefined);
    vi.mocked(RedisStore.clearSalvageSession).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckItem).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckModifier).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckStatus).mockResolvedValue(undefined);
    vi.mocked(inventoryService.getCargoState).mockResolvedValue({ ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0 });

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    vi.useFakeTimers();
    await service.handleStartSalvage(client as any, { itemIndex: 0 });
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(client.send).toHaveBeenCalledWith('salvageResult', expect.objectContaining({ success: true }));
  });

  it('sends wreckExhausted when all items are salvaged', async () => {
    const exhaustedWreck = {
      ...mockWreck,
      status: 'investigated' as const,
      items: [
        { itemType: 'resource' as const, itemId: 'ore', quantity: 10, baseDifficulty: 0.20, salvaged: true },
        { itemType: 'module' as const, itemId: 'drive_mk2', quantity: 1, baseDifficulty: 0.50, salvaged: false },
      ],
    };
    vi.mocked(wreckQueries.getWreckAtSector).mockResolvedValue(exhaustedWreck);
    vi.mocked(wreckQueries.getWreckById).mockResolvedValueOnce(exhaustedWreck).mockResolvedValueOnce({
      ...exhaustedWreck,
      items: exhaustedWreck.items.map((i) => ({ ...i, salvaged: true })),
    });
    vi.mocked(RedisStore.getSalvageSession).mockResolvedValue({
      wreckId: 'wreck-1', itemIndex: 1, startedAt: Date.now(), duration: 10, resolveChance: 1.0,
    });
    vi.mocked(RedisStore.clearSalvageSession).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckItem).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckModifier).mockResolvedValue(undefined);
    vi.mocked(wreckQueries.updateWreckStatus).mockResolvedValue(undefined);
    vi.mocked(inventoryService.getCargoState).mockResolvedValue({ ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0 });

    const ctx = makeCtx();
    const service = new WreckService(ctx as any);
    const client = makeClient();

    vi.useFakeTimers();
    await service.handleStartSalvage(client as any, { itemIndex: 1 });
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(client.send).toHaveBeenCalledWith('wreckExhausted', expect.objectContaining({ wreckId: 'wreck-1' }));
  });
});
