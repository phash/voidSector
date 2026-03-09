import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({ query: vi.fn() }));

import { query } from '../db/client.js';

// Import after mocking
let getInventory: typeof import('../db/queries.js').getInventory;
let getInventoryItem: typeof import('../db/queries.js').getInventoryItem;
let upsertInventory: typeof import('../db/queries.js').upsertInventory;
let deductInventory: typeof import('../db/queries.js').deductInventory;

beforeEach(async () => {
  vi.clearAllMocks();
  ({ getInventory, getInventoryItem, upsertInventory, deductInventory } = await import(
    '../db/queries.js'
  ));
});

describe('inventory queries', () => {
  it('getInventory returns typed InventoryItem array', async () => {
    vi.mocked(query).mockResolvedValue({
      rows: [{ item_type: 'resource', item_id: 'ore', quantity: 5 }],
    } as any);
    const items = await getInventory('player1');
    expect(items).toHaveLength(1);
    expect(items[0].itemType).toBe('resource');
    expect(items[0].itemId).toBe('ore');
    expect(items[0].quantity).toBe(5);
  });

  it('getInventoryItem returns quantity or 0 when missing', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    const qty = await getInventoryItem('player1', 'module', 'drive_mk2');
    expect(qty).toBe(0);
  });

  it('upsertInventory uses ON CONFLICT upsert with correct params', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    await upsertInventory('player1', 'resource', 'ore', 3);
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      ['player1', 'resource', 'ore', 3],
    );
  });

  it('deductInventory throws when insufficient quantity', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [] } as any); // no rows = insufficient
    await expect(deductInventory('player1', 'resource', 'ore', 5)).rejects.toThrow('Insufficient');
  });
});
