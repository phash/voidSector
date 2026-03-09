import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/kontorQueries.js', () => ({
  createKontorOrder: vi.fn(),
  getKontorOrderById: vi.fn(),
  getKontorOrdersBySector: vi.fn(),
  getPlayerKontorOrders: vi.fn(),
  updateKontorOrderFilled: vi.fn(),
  deactivateKontorOrder: vi.fn(),
}));

vi.mock('../../db/queries.js', () => ({
  getPlayerCredits: vi.fn(),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  deductCargo: vi.fn(),
  transferInventoryItem: vi.fn(),
}));

import {
  createKontorOrder,
  getKontorOrderById,
  getKontorOrdersBySector,
  getPlayerKontorOrders,
  updateKontorOrderFilled,
  deactivateKontorOrder,
} from '../../db/kontorQueries.js';
import type { KontorOrder } from '../../db/kontorQueries.js';
import {
  getPlayerCredits,
  deductCredits,
  addCredits,
  deductCargo,
  transferInventoryItem,
} from '../../db/queries.js';
import {
  placeKontorOrder,
  cancelKontorOrder,
  fillKontorOrder,
  getKontorOrders,
  getPlayerOrders,
} from '../kontorEngine.js';

const mockCreateKontorOrder = vi.mocked(createKontorOrder);
const mockGetKontorOrderById = vi.mocked(getKontorOrderById);
const mockGetKontorOrdersBySector = vi.mocked(getKontorOrdersBySector);
const mockGetPlayerKontorOrders = vi.mocked(getPlayerKontorOrders);
const mockUpdateKontorOrderFilled = vi.mocked(updateKontorOrderFilled);
const mockDeactivateKontorOrder = vi.mocked(deactivateKontorOrder);
const mockGetPlayerCredits = vi.mocked(getPlayerCredits);
const mockDeductCredits = vi.mocked(deductCredits);
const mockAddCredits = vi.mocked(addCredits);
const mockDeductCargo = vi.mocked(deductCargo);
const mockTransferInventoryItem = vi.mocked(transferInventoryItem);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeOrder(overrides: Partial<KontorOrder> = {}): KontorOrder {
  return {
    id: 'order-1',
    ownerId: 'owner-1',
    sectorX: 5,
    sectorY: 10,
    itemType: 'resource',
    itemId: 'ore',
    amountWanted: 100,
    amountFilled: 0,
    pricePerUnit: 10,
    budgetReserved: 1000,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// placeKontorOrder
// ---------------------------------------------------------------------------
describe('placeKontorOrder', () => {
  it('validates params — rejects non-positive amount', async () => {
    const result = await placeKontorOrder('owner-1', 5, 10, 'resource', 'ore', 0, 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid amount');
  });

  it('validates params — rejects negative amount', async () => {
    const result = await placeKontorOrder('owner-1', 5, 10, 'resource', 'ore', -5, 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid amount');
  });

  it('validates params — rejects non-integer amount', async () => {
    const result = await placeKontorOrder('owner-1', 5, 10, 'resource', 'ore', 1.5, 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid amount');
  });

  it('validates params — rejects non-positive price', async () => {
    const result = await placeKontorOrder('owner-1', 5, 10, 'resource', 'ore', 10, 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid price');
  });

  it('validates params — rejects non-integer price', async () => {
    const result = await placeKontorOrder('owner-1', 5, 10, 'resource', 'ore', 10, 2.5);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid price');
  });

  it('rejects when player lacks credits for budget', async () => {
    mockGetPlayerCredits.mockResolvedValueOnce(500);
    const result = await placeKontorOrder('owner-1', 5, 10, 'resource', 'ore', 100, 10); // budget = 1000
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient credits');
  });

  it('handles race condition when deductCredits fails', async () => {
    mockGetPlayerCredits.mockResolvedValueOnce(1000);
    mockDeductCredits.mockResolvedValueOnce(false);
    const result = await placeKontorOrder('owner-1', 5, 10, 'resource', 'ore', 100, 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient credits');
  });

  it('reserves budget and creates order on success', async () => {
    const createdOrder = makeOrder();
    mockGetPlayerCredits.mockResolvedValueOnce(2000);
    mockDeductCredits.mockResolvedValueOnce(true);
    mockCreateKontorOrder.mockResolvedValueOnce(createdOrder);

    const result = await placeKontorOrder('owner-1', 5, 10, 'resource', 'ore', 100, 10);
    expect(result.success).toBe(true);
    expect(result.order).toEqual(createdOrder);

    expect(mockDeductCredits).toHaveBeenCalledWith('owner-1', 1000);
    expect(mockCreateKontorOrder).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      sectorX: 5,
      sectorY: 10,
      itemType: 'resource',
      itemId: 'ore',
      amountWanted: 100,
      pricePerUnit: 10,
      budgetReserved: 1000,
      expiresAt: null,
    });
  });
});

// ---------------------------------------------------------------------------
// cancelKontorOrder
// ---------------------------------------------------------------------------
describe('cancelKontorOrder', () => {
  it('returns error when order not found', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(null);
    const result = await cancelKontorOrder('order-x', 'owner-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Order not found');
  });

  it('returns error when order belongs to another player', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder({ ownerId: 'someone-else' }));
    const result = await cancelKontorOrder('order-1', 'owner-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not your order');
  });

  it('returns error when order already inactive', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder({ active: false }));
    const result = await cancelKontorOrder('order-1', 'owner-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Order already inactive');
  });

  it('refunds remaining budget and deactivates order', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder({ amountFilled: 0 }));
    mockAddCredits.mockResolvedValueOnce(2000);
    mockDeactivateKontorOrder.mockResolvedValueOnce(undefined);

    const result = await cancelKontorOrder('order-1', 'owner-1');
    expect(result.success).toBe(true);
    expect(result.refunded).toBe(1000); // 100 remaining * 10

    expect(mockAddCredits).toHaveBeenCalledWith('owner-1', 1000);
    expect(mockDeactivateKontorOrder).toHaveBeenCalledWith('order-1');
  });

  it('refunds partial budget when order partially filled', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder({ amountFilled: 60 }));
    mockAddCredits.mockResolvedValueOnce(1400);
    mockDeactivateKontorOrder.mockResolvedValueOnce(undefined);

    const result = await cancelKontorOrder('order-1', 'owner-1');
    expect(result.success).toBe(true);
    expect(result.refunded).toBe(400); // 40 remaining * 10

    expect(mockAddCredits).toHaveBeenCalledWith('owner-1', 400);
  });

  it('refunds 0 when fully filled', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder({ amountFilled: 100 }));
    mockDeactivateKontorOrder.mockResolvedValueOnce(undefined);

    const result = await cancelKontorOrder('order-1', 'owner-1');
    expect(result.success).toBe(true);
    expect(result.refunded).toBe(0);

    expect(mockAddCredits).not.toHaveBeenCalled();
    expect(mockDeactivateKontorOrder).toHaveBeenCalledWith('order-1');
  });
});

// ---------------------------------------------------------------------------
// fillKontorOrder
// ---------------------------------------------------------------------------
describe('fillKontorOrder', () => {
  it('rejects invalid amount', async () => {
    const result = await fillKontorOrder('order-1', 'seller-1', 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid amount');
  });

  it('rejects negative amount', async () => {
    const result = await fillKontorOrder('order-1', 'seller-1', -5);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid amount');
  });

  it('rejects non-integer amount', async () => {
    const result = await fillKontorOrder('order-1', 'seller-1', 3.7);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid amount');
  });

  it('returns error when order not found', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(null);
    const result = await fillKontorOrder('order-x', 'seller-1', 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Order not found');
  });

  it('returns error when order not active', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder({ active: false }));
    const result = await fillKontorOrder('order-1', 'seller-1', 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Order is not active');
  });

  it('cannot fill own order', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder({ ownerId: 'seller-1' }));
    const result = await fillKontorOrder('order-1', 'seller-1', 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Cannot fill own order');
  });

  it('returns error when order already fully filled', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder({ amountFilled: 100 }));
    const result = await fillKontorOrder('order-1', 'seller-1', 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Order already fully filled');
  });

  it('returns error when seller has insufficient inventory', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder());
    mockTransferInventoryItem.mockRejectedValueOnce(new Error('Insufficient inventory'));

    const result = await fillKontorOrder('order-1', 'seller-1', 10);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient inventory');
  });

  it('transfers credits to seller and updates fill count', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder());
    mockTransferInventoryItem.mockResolvedValueOnce(undefined);
    mockAddCredits.mockResolvedValueOnce(100);
    mockUpdateKontorOrderFilled.mockResolvedValueOnce(undefined);

    const result = await fillKontorOrder('order-1', 'seller-1', 10);
    expect(result.success).toBe(true);
    expect(result.earned).toBe(100); // 10 * 10

    expect(mockTransferInventoryItem).toHaveBeenCalledWith(
      'seller-1',
      'owner-1',
      'resource',
      'ore',
      10,
    );
    expect(mockDeductCargo).not.toHaveBeenCalled();
    expect(mockAddCredits).toHaveBeenCalledWith('seller-1', 100);
    expect(mockUpdateKontorOrderFilled).toHaveBeenCalledWith('order-1', 10);
    expect(mockDeactivateKontorOrder).not.toHaveBeenCalled();
  });

  it('clamps to remaining amount when seller offers more', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder({ amountFilled: 90 })); // 10 remaining
    mockTransferInventoryItem.mockResolvedValueOnce(undefined);
    mockAddCredits.mockResolvedValueOnce(100);
    mockUpdateKontorOrderFilled.mockResolvedValueOnce(undefined);
    mockDeactivateKontorOrder.mockResolvedValueOnce(undefined);

    const result = await fillKontorOrder('order-1', 'seller-1', 50); // wants 50 but only 10 remaining
    expect(result.success).toBe(true);
    expect(result.earned).toBe(100); // 10 * 10

    expect(mockTransferInventoryItem).toHaveBeenCalledWith(
      'seller-1',
      'owner-1',
      'resource',
      'ore',
      10,
    );
    expect(mockDeductCargo).not.toHaveBeenCalled();
    expect(mockUpdateKontorOrderFilled).toHaveBeenCalledWith('order-1', 10);
    expect(mockDeactivateKontorOrder).toHaveBeenCalledWith('order-1');
  });

  it('deactivates order when fully filled', async () => {
    mockGetKontorOrderById.mockResolvedValueOnce(makeOrder()); // 100 remaining
    mockTransferInventoryItem.mockResolvedValueOnce(undefined);
    mockAddCredits.mockResolvedValueOnce(1000);
    mockUpdateKontorOrderFilled.mockResolvedValueOnce(undefined);
    mockDeactivateKontorOrder.mockResolvedValueOnce(undefined);

    const result = await fillKontorOrder('order-1', 'seller-1', 100);
    expect(result.success).toBe(true);
    expect(result.earned).toBe(1000);

    expect(mockDeactivateKontorOrder).toHaveBeenCalledWith('order-1');
  });
});

// ---------------------------------------------------------------------------
// Full lifecycle: place → partial fill → cancel (partial refund)
// ---------------------------------------------------------------------------
describe('full lifecycle', () => {
  it('place → partial fill → cancel yields correct partial refund', async () => {
    // Step 1: Place order for 100 ore at 10 credits each (budget: 1000)
    const order = makeOrder();
    mockGetPlayerCredits.mockResolvedValueOnce(2000);
    mockDeductCredits.mockResolvedValueOnce(true);
    mockCreateKontorOrder.mockResolvedValueOnce(order);

    const placeResult = await placeKontorOrder('owner-1', 5, 10, 'resource', 'ore', 100, 10);
    expect(placeResult.success).toBe(true);

    // Step 2: Seller fills 30 units
    const partiallyFilled = makeOrder({ amountFilled: 0 }); // engine reads fresh from DB
    mockGetKontorOrderById.mockResolvedValueOnce(partiallyFilled);
    mockTransferInventoryItem.mockResolvedValueOnce(undefined);
    mockAddCredits.mockResolvedValueOnce(300);
    mockUpdateKontorOrderFilled.mockResolvedValueOnce(undefined);

    const fillResult = await fillKontorOrder('order-1', 'seller-1', 30);
    expect(fillResult.success).toBe(true);
    expect(fillResult.earned).toBe(300);

    // Step 3: Owner cancels — should refund for 70 remaining units
    const afterFill = makeOrder({ amountFilled: 30 });
    mockGetKontorOrderById.mockResolvedValueOnce(afterFill);
    mockAddCredits.mockResolvedValueOnce(1700);
    mockDeactivateKontorOrder.mockResolvedValueOnce(undefined);

    const cancelResult = await cancelKontorOrder('order-1', 'owner-1');
    expect(cancelResult.success).toBe(true);
    expect(cancelResult.refunded).toBe(700); // 70 * 10
  });
});

// ---------------------------------------------------------------------------
// getKontorOrders / getPlayerOrders (pass-through)
// ---------------------------------------------------------------------------
describe('getKontorOrders', () => {
  it('delegates to getKontorOrdersBySector', async () => {
    const orders = [makeOrder()];
    mockGetKontorOrdersBySector.mockResolvedValueOnce(orders);

    const result = await getKontorOrders(5, 10);
    expect(result).toEqual(orders);
    expect(mockGetKontorOrdersBySector).toHaveBeenCalledWith(5, 10);
  });
});

describe('getPlayerOrders', () => {
  it('delegates to getPlayerKontorOrders', async () => {
    const orders = [makeOrder()];
    mockGetPlayerKontorOrders.mockResolvedValueOnce(orders);

    const result = await getPlayerOrders('owner-1');
    expect(result).toEqual(orders);
    expect(mockGetPlayerKontorOrders).toHaveBeenCalledWith('owner-1');
  });
});
