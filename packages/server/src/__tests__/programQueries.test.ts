import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/client.js', () => ({ query: vi.fn() }));

async function fresh() {
  vi.clearAllMocks();
  vi.resetModules();
  const { query } = await import('../db/client.js');
  const q = await import('../db/programQueries.js');
  return { query: vi.mocked(query), q };
}

describe('programQueries', () => {
  it('createProgram inserts source/mode and returns the row', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [{ id: 'p1', player_id: 'u1', name: 'Loop', source: 'scan', mode: 'loop', is_active: false }] } as any);
    const row = await q.createProgram('u1', 'Loop', 'scan', 'loop');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ship_programs'), ['u1', 'Loop', 'scan', 'loop']);
    expect(row.id).toBe('p1');
  });

  it('listProgramsForPlayer selects by player ordered', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    await q.listProgramsForPlayer('u1');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM ship_programs WHERE player_id = $1'), ['u1']);
  });

  it('setActiveProgram clears others then activates one', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    await q.setActiveProgram('u1', 'p1');
    const sqls = query.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => s.includes('UPDATE ship_programs SET is_active = FALSE'))).toBe(true);
    expect(sqls.some((s) => s.includes('is_active = TRUE'))).toBe(true);
  });

  it('saveProgramState upserts keyed by player_id', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    await q.saveProgramState('u1', { programId: 'p1', pc: 3, vmState: { loops: [] }, status: 'running', pausedReason: null });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ship_program_state'), expect.arrayContaining(['u1', 'p1', 3]));
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (player_id)');
  });

  it('getActiveProgramState returns null when absent', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    expect(await q.getActiveProgramState('u1')).toBeNull();
  });

  it('appendProgramLog inserts a log row', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    await q.appendProgramLog('u1', 'p1', 'info', 'gestartet');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ship_program_logs'), ['u1', 'p1', 'info', 'gestartet']);
  });

  it('getOfflineActivePrograms joins active programs with running/paused state', async () => {
    const { query, q } = await fresh();
    query.mockResolvedValue({ rows: [] } as any);
    await q.getOfflineActivePrograms();
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('ship_program_state');
    expect(sql).toContain("status IN ('running', 'paused')");
  });
});
