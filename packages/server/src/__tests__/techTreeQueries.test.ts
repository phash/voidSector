import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../db/client.js', () => ({ query: vi.fn() }));

import { getOrCreateTechTree, saveTechTree, resetTechTree } from '../db/techTreeQueries.js';
import { query } from '../db/client.js';

const mockQuery = vi.mocked(query);

afterEach(() => {
  vi.clearAllMocks();
});

describe('getOrCreateTechTree', () => {
  it('returns existing row', async () => {
    const row = {
      player_id: 'p1',
      researched_nodes: { kampf: 1 },
      total_researched: 1,
      last_reset_at: null,
    };
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
    const result = await getOrCreateTechTree('p1');
    expect(result.researched_nodes).toEqual({ kampf: 1 });
    expect(result.total_researched).toBe(1);
    expect(result.last_reset_at).toBeNull();
  });

  it('uses INSERT ON CONFLICT for upsert', async () => {
    const row = {
      player_id: 'p1',
      researched_nodes: {},
      total_researched: 0,
      last_reset_at: null,
    };
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
    await getOrCreateTechTree('p1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT'),
      ['p1'],
    );
  });
});

describe('saveTechTree', () => {
  it('updates researched_nodes and total', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await saveTechTree('p1', { kampf: 2 }, 5);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE player_tech_tree'),
      expect.arrayContaining(['p1']),
    );
  });

  it('passes JSON-stringified nodes', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    const nodes = { kampf: 2, intel: 3 };
    await saveTechTree('p1', nodes, 5);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ['p1', JSON.stringify(nodes), 5],
    );
  });
});

describe('resetTechTree', () => {
  it('clears nodes and sets last_reset_at', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await resetTechTree('p1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE player_tech_tree'),
      expect.arrayContaining(['p1']),
    );
  });

  it('resets total_researched to 0', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await resetTechTree('p1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('total_researched = 0'),
      ['p1'],
    );
  });
});
