import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/queries.js', () => ({
  createTradeOrder: vi.fn().mockResolvedValue({ id: 'order1' }),
  getTradeOrderById: vi.fn(),
  fulfillTradeOrder: vi.fn().mockResolvedValue(true),
  cancelTradeOrder: vi.fn().mockResolvedValue(true),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
}));

vi.mock('../inventoryService.js', () => ({
  getInventoryItem: vi.fn(),
  addToInventory: vi.fn(),
  removeFromInventory: vi.fn(),
}));

import { placeMarketOrder, fulfillMarketOrder, cancelMarketOrder } from '../marketOrderService.js';
import {
  getTradeOrderById,
  deductCredits,
  addCredits,
  fulfillTradeOrder,
  cancelTradeOrder,
  createTradeOrder,
} from '../../db/queries.js';
import { getInventoryItem, addToInventory, removeFromInventory } from '../inventoryService.js';

describe('marketOrderService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── placement ────────────────────────────────────────────────────────────
  it('rejects invalid resource / amount / price', async () => {
    expect((await placeMarketOrder('p', 'plutonium', 5, 10, 'sell')).success).toBe(false);
    expect((await placeMarketOrder('p', 'ore', 0, 10, 'sell')).success).toBe(false);
    expect((await placeMarketOrder('p', 'ore', 5, 0, 'sell')).success).toBe(false);
    expect((await placeMarketOrder('p', 'ore', 1.5, 10, 'sell')).success).toBe(false);
  });

  it('sell order escrows the goods out of inventory', async () => {
    vi.mocked(getInventoryItem).mockResolvedValue(10);
    const r = await placeMarketOrder('p', 'ore', 4, 5, 'sell');
    expect(r.success).toBe(true);
    expect(vi.mocked(removeFromInventory)).toHaveBeenCalledWith('p', 'resource', 'ore', 4);
    expect(vi.mocked(createTradeOrder)).toHaveBeenCalled();
  });

  it('sell order rejected (no escrow) when seller lacks the goods', async () => {
    vi.mocked(getInventoryItem).mockResolvedValue(2);
    const r = await placeMarketOrder('p', 'ore', 4, 5, 'sell');
    expect(r.success).toBe(false);
    expect(vi.mocked(removeFromInventory)).not.toHaveBeenCalled();
    expect(vi.mocked(createTradeOrder)).not.toHaveBeenCalled();
  });

  it('buy order escrows credits', async () => {
    vi.mocked(deductCredits).mockResolvedValue(true);
    const r = await placeMarketOrder('p', 'gas', 3, 10, 'buy');
    expect(r.success).toBe(true);
    expect(vi.mocked(deductCredits)).toHaveBeenCalledWith('p', 30);
  });

  it('buy order rejected when buyer lacks credits', async () => {
    vi.mocked(deductCredits).mockResolvedValue(false);
    const r = await placeMarketOrder('p', 'gas', 3, 10, 'buy');
    expect(r.success).toBe(false);
    expect(vi.mocked(createTradeOrder)).not.toHaveBeenCalled();
  });

  // ── fulfilment ───────────────────────────────────────────────────────────
  it('fulfilling a sell order: buyer pays, seller credited, buyer gets goods', async () => {
    vi.mocked(getTradeOrderById).mockResolvedValue({
      id: 'o', player_id: 'seller', resource: 'ore', amount: 4, price_per_unit: 5, type: 'sell', fulfilled: false,
    });
    vi.mocked(deductCredits).mockResolvedValue(true);
    const r = await fulfillMarketOrder('buyer', 'o');
    expect(r.success).toBe(true);
    expect(vi.mocked(deductCredits)).toHaveBeenCalledWith('buyer', 20);
    expect(vi.mocked(addCredits)).toHaveBeenCalledWith('seller', 20);
    expect(vi.mocked(addToInventory)).toHaveBeenCalledWith('buyer', 'resource', 'ore', 4);
    expect(vi.mocked(fulfillTradeOrder)).toHaveBeenCalledWith('o');
  });

  it('fulfilling a buy order: seller gives goods, gets escrowed credits', async () => {
    vi.mocked(getTradeOrderById).mockResolvedValue({
      id: 'o', player_id: 'buyer', resource: 'crystal', amount: 2, price_per_unit: 8, type: 'buy', fulfilled: false,
    });
    vi.mocked(getInventoryItem).mockResolvedValue(5);
    const r = await fulfillMarketOrder('seller', 'o');
    expect(r.success).toBe(true);
    expect(vi.mocked(removeFromInventory)).toHaveBeenCalledWith('seller', 'resource', 'crystal', 2);
    expect(vi.mocked(addToInventory)).toHaveBeenCalledWith('buyer', 'resource', 'crystal', 2);
    expect(vi.mocked(addCredits)).toHaveBeenCalledWith('seller', 16);
  });

  it('cannot fulfill own order or an already-fulfilled order', async () => {
    vi.mocked(getTradeOrderById).mockResolvedValue({ id: 'o', player_id: 'me', type: 'sell', fulfilled: false });
    expect((await fulfillMarketOrder('me', 'o')).success).toBe(false);
    vi.mocked(getTradeOrderById).mockResolvedValue({ id: 'o', player_id: 'x', fulfilled: true });
    expect((await fulfillMarketOrder('me', 'o')).success).toBe(false);
  });

  it('fulfilling a buy order with insufficient goods does not transfer', async () => {
    vi.mocked(getTradeOrderById).mockResolvedValue({
      id: 'o', player_id: 'buyer', resource: 'ore', amount: 5, price_per_unit: 5, type: 'buy', fulfilled: false,
    });
    vi.mocked(getInventoryItem).mockResolvedValue(1);
    const r = await fulfillMarketOrder('seller', 'o');
    expect(r.success).toBe(false);
    expect(vi.mocked(removeFromInventory)).not.toHaveBeenCalled();
    expect(vi.mocked(addCredits)).not.toHaveBeenCalled();
  });

  // ── cancel / refund ───────────────────────────────────────────────────────
  it('cancelling a sell order refunds the goods', async () => {
    vi.mocked(getTradeOrderById).mockResolvedValue({
      id: 'o', player_id: 'me', resource: 'ore', amount: 4, price_per_unit: 5, type: 'sell', fulfilled: false,
    });
    const r = await cancelMarketOrder('me', 'o');
    expect(r.success).toBe(true);
    expect(vi.mocked(addToInventory)).toHaveBeenCalledWith('me', 'resource', 'ore', 4);
    expect(vi.mocked(cancelTradeOrder)).toHaveBeenCalledWith('o', 'me');
  });

  it('cancelling a buy order refunds the credits', async () => {
    vi.mocked(getTradeOrderById).mockResolvedValue({
      id: 'o', player_id: 'me', resource: 'gas', amount: 3, price_per_unit: 10, type: 'buy', fulfilled: false,
    });
    const r = await cancelMarketOrder('me', 'o');
    expect(r.success).toBe(true);
    expect(vi.mocked(addCredits)).toHaveBeenCalledWith('me', 30);
  });

  it('cannot cancel another player order', async () => {
    vi.mocked(getTradeOrderById).mockResolvedValue({ id: 'o', player_id: 'other', fulfilled: false });
    expect((await cancelMarketOrder('me', 'o')).success).toBe(false);
  });
});
