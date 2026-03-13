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
    // Both DELETE (exact) and UPDATE (surplus) return no rows → insufficient
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    await expect(deductInventory('player1', 'resource', 'ore', 5)).rejects.toThrow('Insufficient');
  });

  it('deductInventory deletes row when quantity equals amount', async () => {
    const { query, deductInventory } = await freshImports();
    // DELETE exact-match succeeds
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ id: 'some-id' }] } as any);
    await deductInventory('player1', 'resource', 'ore', 3);
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM inventory'), [
      'player1',
      'resource',
      'ore',
      3,
    ]);
    // Only one query call (no UPDATE needed)
    expect(vi.mocked(query)).toHaveBeenCalledTimes(1);
  });

  it('deductInventory decrements when quantity exceeds amount', async () => {
    const { query, deductInventory } = await freshImports();
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [] } as any) // DELETE exact-match: no match
      .mockResolvedValueOnce({ rows: [{ quantity: 3 }] } as any); // UPDATE surplus: success
    await deductInventory('player1', 'resource', 'ore', 2);
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('UPDATE inventory'), [
      'player1',
      'resource',
      'ore',
      2,
    ]);
  });

  it('transferInventoryItem deducts from source and upserts to target', async () => {
    const { query, transferInventoryItem } = await freshImports();
    // deductInventory: DELETE exact-match misses, UPDATE surplus succeeds
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [] } as any) // DELETE exact-match: no match
      .mockResolvedValueOnce({ rows: [{ quantity: 3 }] } as any) // UPDATE surplus: success
      .mockResolvedValueOnce({ rows: [] } as any); // upsert INSERT
    await transferInventoryItem('player1', 'player2', 'module', 'drive_mk2', 2);
    // Second call should be the deduct UPDATE
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

  it('getCargoCapForPlayer queries modules and computes cargoCap via calculateShipStats', async () => {
    const { query, getCargoCapForPlayer } = await freshImports();
    // no modules -> base cargoCap of 10
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ modules: [] }],
    } as any);
    const cap = await getCargoCapForPlayer('player1');
    // Verify the query selects modules
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('modules'), ['player1']);
    // base cargoCap = 10, no module bonuses
    expect(cap).toBe(10);
  });

  it('getCargoCapForPlayer returns 20 as default when no ship found', async () => {
    const { query, getCargoCapForPlayer } = await freshImports();
    vi.mocked(query).mockResolvedValueOnce({ rows: [] } as any);
    const cap = await getCargoCapForPlayer('player1');
    expect(cap).toBe(20);
  });
});
