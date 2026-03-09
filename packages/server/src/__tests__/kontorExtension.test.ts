/**
 * TDD: Kontor supports all item types via item_type field.
 *
 * Tests:
 * 1. createKontorOrder passes item_type in the SQL INSERT
 * 2. getKontorOrdersBySector returns itemType field in mapped result
 * 3. fillKontorOrder uses transferInventoryItem (NOT deductCargo) for item deduction
 * 4. Backward compat: resource orders still work (item_type='resource')
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock DB client ──────────────────────────────────────────────────────────
const mockQuery = vi.fn();
vi.mock('../db/client.js', () => ({
  query: mockQuery,
}));

// ─── Mock queries.js (deductCargo, addCredits, etc.) ─────────────────────────
const mockDeductCargo = vi.fn();
const mockAddCredits = vi.fn();
const mockGetPlayerCredits = vi.fn();
const mockDeductCredits = vi.fn();
const mockTransferInventoryItem = vi.fn();

vi.mock('../db/queries.js', () => ({
  deductCargo: mockDeductCargo,
  addCredits: mockAddCredits,
  getPlayerCredits: mockGetPlayerCredits,
  deductCredits: mockDeductCredits,
  transferInventoryItem: mockTransferInventoryItem,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── kontorQueries tests ──────────────────────────────────────────────────────

describe('kontorQueries — createKontorOrder includes item_type in SQL', () => {
  it('INSERT SQL contains item_type column and passes the value', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'order-uuid',
          owner_id: 'player-1',
          sector_x: 3,
          sector_y: 7,
          item_type: 'module',
          item_id: 'drive_mk2',
          amount_wanted: 2,
          amount_filled: 0,
          price_per_unit: 500,
          budget_reserved: 1000,
          active: true,
          created_at: '2026-01-01',
          expires_at: null,
        },
      ],
    });

    const { createKontorOrder } = await import('../db/kontorQueries.js');
    const order = await createKontorOrder({
      ownerId: 'player-1',
      sectorX: 3,
      sectorY: 7,
      itemType: 'module',
      itemId: 'drive_mk2',
      amountWanted: 2,
      pricePerUnit: 500,
      budgetReserved: 1000,
      expiresAt: null,
    });

    // Verify SQL contains item_type
    const sqlArg: string = mockQuery.mock.calls[0][0];
    expect(sqlArg).toContain('item_type');

    // Verify item_type and item_id columns are in SQL
    expect(sqlArg).toContain('item_id');

    // Verify the values 'module' and 'drive_mk2' are in params
    const params = mockQuery.mock.calls[0][1];
    expect(params).toContain('module');
    expect(params).toContain('drive_mk2');

    // Verify mapped result has itemType and itemId
    expect(order.itemType).toBe('module');
    expect(order.itemId).toBe('drive_mk2');
  });

  it('backward compat: resource item_type works and is returned', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'order-uuid-2',
          owner_id: 'player-2',
          sector_x: 1,
          sector_y: 1,
          item_type: 'resource',
          item_id: 'ore',
          amount_wanted: 10,
          amount_filled: 0,
          price_per_unit: 50,
          budget_reserved: 500,
          active: true,
          created_at: '2026-01-01',
          expires_at: null,
        },
      ],
    });

    const { createKontorOrder } = await import('../db/kontorQueries.js');
    const order = await createKontorOrder({
      ownerId: 'player-2',
      sectorX: 1,
      sectorY: 1,
      itemType: 'resource',
      itemId: 'ore',
      amountWanted: 10,
      pricePerUnit: 50,
      budgetReserved: 500,
      expiresAt: null,
    });

    expect(order.itemType).toBe('resource');
    expect(order.itemId).toBe('ore');
  });
});

describe('kontorQueries — getKontorOrdersBySector returns itemType field', () => {
  it('maps item_type column to itemType in returned KontorOrder objects', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'ord-1',
          owner_id: 'p1',
          sector_x: 5,
          sector_y: 5,
          item_type: 'blueprint',
          item_id: 'blueprint_turret',
          amount_wanted: 1,
          amount_filled: 0,
          price_per_unit: 200,
          budget_reserved: 200,
          active: true,
          created_at: '2026-01-01',
          expires_at: null,
        },
      ],
    });

    const { getKontorOrdersBySector } = await import('../db/kontorQueries.js');
    const orders = await getKontorOrdersBySector(5, 5);

    expect(orders).toHaveLength(1);
    expect(orders[0].itemType).toBe('blueprint');
    expect(orders[0].itemId).toBe('blueprint_turret');
  });
});

// ─── kontorEngine — fillKontorOrder uses transferInventoryItem ────────────────

describe('kontorEngine — fillKontorOrder uses transferInventoryItem not deductCargo', () => {
  it('calls transferInventoryItem when filling a module order', async () => {
    // getKontorOrderById returns a module order
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'ord-module',
            owner_id: 'buyer-1',
            sector_x: 0,
            sector_y: 0,
            item_type: 'module',
            item_id: 'drive_mk2',
            amount_wanted: 1,
            amount_filled: 0,
            price_per_unit: 300,
            budget_reserved: 300,
            active: true,
            created_at: '2026-01-01',
            expires_at: null,
          },
        ],
      })
      // updateKontorOrderFilled
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      // deactivateKontorOrder
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    mockTransferInventoryItem.mockResolvedValue(undefined);
    mockAddCredits.mockResolvedValue(true);

    const { fillKontorOrder } = await import('../engine/kontorEngine.js');
    const result = await fillKontorOrder('ord-module', 'seller-1', 1);

    expect(result.success).toBe(true);
    expect(result.earned).toBe(300);

    // transferInventoryItem must be called with exact itemId
    expect(mockTransferInventoryItem).toHaveBeenCalledWith(
      'seller-1',
      'buyer-1',
      'module',
      'drive_mk2',
      1,
    );

    // deductCargo must NOT be called
    expect(mockDeductCargo).not.toHaveBeenCalled();
  });

  it('calls transferInventoryItem for resource orders (backward compat)', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'ord-res',
            owner_id: 'buyer-2',
            sector_x: 0,
            sector_y: 0,
            item_type: 'resource',
            item_id: 'ore',
            amount_wanted: 5,
            amount_filled: 0,
            price_per_unit: 40,
            budget_reserved: 200,
            active: true,
            created_at: '2026-01-01',
            expires_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    mockTransferInventoryItem.mockResolvedValue(undefined);
    mockAddCredits.mockResolvedValue(true);

    const { fillKontorOrder } = await import('../engine/kontorEngine.js');
    const result = await fillKontorOrder('ord-res', 'seller-2', 5);

    expect(result.success).toBe(true);
    expect(mockTransferInventoryItem).toHaveBeenCalledWith(
      'seller-2',
      'buyer-2',
      'resource',
      'ore',
      5,
    );
    expect(mockDeductCargo).not.toHaveBeenCalled();
  });

  it('returns error when transferInventoryItem throws (insufficient inventory)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'ord-fail',
          owner_id: 'buyer-3',
          sector_x: 0,
          sector_y: 0,
          item_type: 'module',
          item_id: 'shield_mk1',
          amount_wanted: 1,
          amount_filled: 0,
          price_per_unit: 100,
          budget_reserved: 100,
          active: true,
          created_at: '2026-01-01',
          expires_at: null,
        },
      ],
    });

    mockTransferInventoryItem.mockRejectedValue(new Error('Insufficient inventory'));

    const { fillKontorOrder } = await import('../engine/kontorEngine.js');
    const result = await fillKontorOrder('ord-fail', 'seller-3', 1);

    expect(result.success).toBe(false);
    expect(mockDeductCargo).not.toHaveBeenCalled();
  });
});
