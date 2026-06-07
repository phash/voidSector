import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis
const mockRedis = {
  setex: vi.fn().mockResolvedValue('OK'),
  get: vi.fn(),
  del: vi.fn().mockResolvedValue(1),
};

vi.mock('../db/queries.js', () => ({
  transferInventoryItem: vi.fn(),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  getPlayerCredits: vi.fn().mockResolvedValue(1000),
  getInventoryItem: vi.fn().mockResolvedValue(5),
}));

import { DirectTradeService } from '../engine/directTradeService.js';

describe('DirectTradeService', () => {
  let service: DirectTradeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DirectTradeService(mockRedis as any);
  });

  it('initiateTrade stores session in Redis with 60s TTL', async () => {
    const tradeId = await service.initiateTrade('playerA', 'Alice', 'playerB', 'Bob');
    expect(mockRedis.setex).toHaveBeenCalledWith(
      expect.stringContaining('trade:'),
      60,
      expect.stringContaining('"fromPlayerId":"playerA"'),
    );
    expect(mockRedis.setex).toHaveBeenCalledWith(
      expect.anything(),
      60,
      expect.stringContaining('"toPlayerName":"Bob"'),
    );
    expect(tradeId).toBeTruthy();
  });

  it('getSession returns null when key not found', async () => {
    mockRedis.get.mockResolvedValue(null);
    const session = await service.getSession('nonexistent');
    expect(session).toBeNull();
  });

  it('confirm returns false when only one player confirmed', async () => {
    const session = {
      fromPlayerId: 'playerA',
      toPlayerId: 'playerB',
      fromItems: [],
      fromCredits: 0,
      toItems: [],
      toCredits: 0,
      confirmedBy: [],
      expiresAt: Date.now() + 60000,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(session));
    const done = await service.confirm('tradeId', 'playerA');
    expect(done).toBe(false);
  });

  it('confirm returns true when both players confirmed', async () => {
    const session = {
      fromPlayerId: 'playerA',
      toPlayerId: 'playerB',
      fromItems: [],
      fromCredits: 0,
      toItems: [],
      toCredits: 0,
      confirmedBy: ['playerA'],
      expiresAt: Date.now() + 60000,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(session));
    const done = await service.confirm('tradeId', 'playerB');
    expect(done).toBe(true);
  });

  it('executeTrade calls transferInventoryItem for each offered item', async () => {
    const { transferInventoryItem } = await import('../db/queries.js');
    const session = {
      fromPlayerId: 'playerA',
      toPlayerId: 'playerB',
      fromItems: [{ itemType: 'resource', itemId: 'ore', quantity: 3 }],
      fromCredits: 100,
      toItems: [{ itemType: 'module', itemId: 'drive_mk2', quantity: 1 }],
      toCredits: 0,
      confirmedBy: ['playerA', 'playerB'],
      expiresAt: Date.now() + 60000,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(session));
    await service.executeTrade('tradeId');
    expect(vi.mocked(transferInventoryItem)).toHaveBeenCalledWith(
      'playerA',
      'playerB',
      'resource',
      'ore',
      3,
    );
    expect(vi.mocked(transferInventoryItem)).toHaveBeenCalledWith(
      'playerB',
      'playerA',
      'module',
      'drive_mk2',
      1,
    );
  });

  it('updateOffer drops non-positive/non-integer quantities and clamps credits', async () => {
    const session = {
      fromPlayerId: 'playerA',
      fromPlayerName: 'Alice',
      toPlayerId: 'playerB',
      toPlayerName: 'Bob',
      fromItems: [],
      fromCredits: 0,
      toItems: [],
      toCredits: 0,
      confirmedBy: [],
      expiresAt: Date.now() + 60000,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(session));
    await service.updateOffer(
      'tradeId',
      'playerA',
      [
        { itemType: 'resource', itemId: 'ore', quantity: 3 },
        { itemType: 'resource', itemId: 'gas', quantity: -2 },
        { itemType: 'resource', itemId: 'crystal', quantity: 1.5 },
      ] as any,
      -50,
    );
    const written = JSON.parse(mockRedis.setex.mock.calls.at(-1)![2]);
    expect(written.fromItems).toEqual([{ itemType: 'resource', itemId: 'ore', quantity: 3 }]);
    expect(written.fromCredits).toBe(0);
  });

  it('executeTrade throws (no dupe) when a side cannot cover its offer', async () => {
    const { getInventoryItem, transferInventoryItem } = await import('../db/queries.js');
    vi.mocked(getInventoryItem).mockResolvedValueOnce(1); // has only 1, offered 3
    const session = {
      fromPlayerId: 'playerA',
      fromPlayerName: 'Alice',
      toPlayerId: 'playerB',
      toPlayerName: 'Bob',
      fromItems: [{ itemType: 'resource', itemId: 'ore', quantity: 3 }],
      fromCredits: 0,
      toItems: [],
      toCredits: 0,
      confirmedBy: ['playerA', 'playerB'],
      expiresAt: Date.now() + 60000,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(session));
    await expect(service.executeTrade('tradeId')).rejects.toThrow('INSUFFICIENT_ITEMS');
    expect(vi.mocked(transferInventoryItem)).not.toHaveBeenCalled();
  });
});
