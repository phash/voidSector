import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../db/client.js', () => ({ query: vi.fn() }));

/**
 * Helper: resets the module registry and returns fresh instances of query
 * and the inventory query functions. Each test calls this so it gets a clean,
 * up-to-date module without stale caches.
 */
async function freshImports() {
  vi.resetModules();
  const { query } = await import('../db/client.js');
  const {
    getInventory,
    getInventoryItem,
    upsertInventory,
    deductInventory,
    transferInventoryItem,
    getCargoCapForPlayer,
  } = await import('../db/queries.js');
  return {
    query,
    getInventory,
    getInventoryItem,
    upsertInventory,
    deductInventory,
    transferInventoryItem,
    getCargoCapForPlayer,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('inventory queries', () => {
  it('getInventory returns typed InventoryItem array', async () => {
    const { query, getInventory } = await freshImports();
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
    const { query, getInventoryItem } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    const qty = await getInventoryItem('player1', 'module', 'drive_mk2');
    expect(qty).toBe(0);
  });

  it('upsertInventory uses ON CONFLICT upsert with correct params', async () => {
    const { query, upsertInventory } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    await upsertInventory('player1', 'resource', 'ore', 3);
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), [
      'player1',
      'resource',
      'ore',
      3,
    ]);
  });

  it('deductInventory throws when insufficient quantity', async () => {
    const { query, deductInventory } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any); // no rows = insufficient
    await expect(deductInventory('player1', 'resource', 'ore', 5)).rejects.toThrow('Insufficient');
  });

  it('transferInventoryItem deducts from source and upserts to target', async () => {
    const { query, transferInventoryItem } = await freshImports();
    // deductInventory needs to succeed (returns a row with quantity > 0 to avoid a delete call)
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ quantity: 3 }] } as any) // deduct UPDATE succeeds
      .mockResolvedValueOnce({ rows: [] } as any); // upsert (no delete since qty > 0)
    await transferInventoryItem('player1', 'player2', 'module', 'drive_mk2', 2);
    // First call should be the deduct UPDATE
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('UPDATE inventory'), [
      'player1',
      'module',
      'drive_mk2',
      2,
    ]);
    // Last call should be the upsert INSERT
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), [
      'player2',
      'module',
      'drive_mk2',
      2,
    ]);
  });

  it('getCargoCapForPlayer queries hull_type+modules and computes cargoCap via calculateShipStats', async () => {
    const { query, getCargoCapForPlayer } = await freshImports();
    // scout with no modules has baseCargo of 3 (from SHIP_CLASSES constant)
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ hull_type: 'scout', modules: [] }],
    } as any);
    const cap = await getCargoCapForPlayer('player1');
    // Verify the query selects hull_type and modules (not the dropped cargo_cap column)
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('hull_type'), [
      'player1',
    ]);
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('modules'), ['player1']);
    // scout baseCargo = 3, no module bonuses
    expect(cap).toBe(3);
  });

  it('getCargoCapForPlayer returns 20 as default when no ship found', async () => {
    const { query, getCargoCapForPlayer } = await freshImports();
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any);
    const cap = await getCargoCapForPlayer('player1');
    expect(cap).toBe(20);
  });
});
