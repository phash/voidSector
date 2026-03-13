import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../db/client.js', () => ({ query: vi.fn() }));

async function freshImports() {
  vi.resetModules();
  const { query } = await import('../db/client.js');
  const {
    getWreckAtSector,
    getWreckById,
    getActiveWreckCount,
    insertWreck,
    updateWreckStatus,
    updateWreckItem,
    updateWreckModifier,
    pickRandomWreckableSector,
    insertWreckSlateMetadata,
    getWreckSlateMetadata,
  } = await import('../db/wreckQueries.js');
  return { query, getWreckAtSector, getWreckById, getActiveWreckCount, insertWreck, updateWreckStatus, updateWreckItem, updateWreckModifier, pickRandomWreckableSector, insertWreckSlateMetadata, getWreckSlateMetadata };
}

afterEach(() => vi.clearAllMocks());

describe('wreckQueries', () => {
  it('getWreckAtSector returns null when not found', async () => {
    const { query, getWreckAtSector } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    const result = await getWreckAtSector(5, 10);
    expect(result).toBeNull();
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('wrecks'), [5, 10]);
  });

  it('getActiveWreckCount filters by intact/investigated', async () => {
    const { query, getActiveWreckCount } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [{ count: '1' }] } as any);
    const count = await getActiveWreckCount(0, 0);
    expect(count).toBe(1);
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining("status IN ('intact','investigated')"),
      [0, 0],
    );
  });

  it('insertWreck inserts and returns row', async () => {
    const { query, insertWreck } = await freshImports();
    const mockWreck = { id: 'uuid-1', quadrant_x: 0, quadrant_y: 0, sector_x: 5, sector_y: 5, tier: 1, size: 'small', items: [], difficulty_modifier: 0, status: 'intact', spawned_at: new Date().toISOString(), exhausted_at: null };
    vi.mocked(query).mockResolvedValue({ rows: [mockWreck] } as any);
    const result = await insertWreck({ quadrantX: 0, quadrantY: 0, sectorX: 5, sectorY: 5, tier: 1, size: 'small' as const, items: [] });
    expect(result.id).toBe('uuid-1');
  });

  it('updateWreckStatus calls UPDATE with correct status', async () => {
    const { query, updateWreckStatus } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    await updateWreckStatus('uuid-1', 'investigated');
    expect(vi.mocked(query)).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE wrecks'),
      ['investigated', 'uuid-1'],
    );
  });

  it('getWreckById returns wreck row by id', async () => {
    const { query, getWreckById } = await freshImports();
    const mockWreck = { id: 'uuid-1', sector_x: 5, sector_y: 5, tier: 2, size: 'medium', items: [], difficulty_modifier: 0, status: 'investigated', quadrant_x: 0, quadrant_y: 0 };
    vi.mocked(query).mockResolvedValue({ rows: [mockWreck] } as any);
    const result = await getWreckById('uuid-1');
    expect(result?.id).toBe('uuid-1');
    expect(vi.mocked(query)).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), ['uuid-1']);
  });

  it('getWreckById returns null when not found', async () => {
    const { query, getWreckById } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    const result = await getWreckById('nonexistent');
    expect(result).toBeNull();
  });

  it('getWreckSlateMetadata returns null when not found', async () => {
    const { query, getWreckSlateMetadata } = await freshImports();
    vi.mocked(query).mockResolvedValue({ rows: [] } as any);
    const result = await getWreckSlateMetadata('slate-uuid');
    expect(result).toBeNull();
  });
});
