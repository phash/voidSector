import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  getOfflineActivePrograms: vi.fn(),
  getProgram: vi.fn(),
  saveProgramState: vi.fn(),
  appendProgramLog: vi.fn(),
  getActiveShip: vi.fn(),
  compileProgram: vi.fn(),
  getShipComputerLevel: vi.fn(),
  getConfig: vi.fn(),
  sismember: vi.fn(),
  stepProgram: vi.fn(),
}));

vi.mock('../../../db/programQueries.js', () => ({
  getOfflineActivePrograms: m.getOfflineActivePrograms,
  getProgram: m.getProgram,
  saveProgramState: m.saveProgramState,
  appendProgramLog: m.appendProgramLog,
}));
vi.mock('../../../db/queries.js', () => ({
  getActiveShip: m.getActiveShip,
}));
vi.mock('@void-sector/shared', () => ({
  compileProgram: m.compileProgram,
  getShipComputerLevel: m.getShipComputerLevel,
  AUTOMATION_PROGRAM_LIMITS: { 1: 10, 2: 25, 3: 50, 4: 75, 5: 120 },
  AUTOMATION_OFFLINE_WINDOW_HOURS_MK4: 4,
  AUTOMATION_OFFLINE_WINDOW_HOURS_MK5: 12,
  AUTOMATION_MAX_CONCURRENT_OFFLINE: 50,
  AUTOMATION_TICK_WORK_BUDGET: 200,
  AUTOMATION_SCHEDULER_INTERVAL_MS: 1000,
}));
vi.mock('../../gameConfigApply.js', () => ({ getConfig: m.getConfig }));
vi.mock('../../../rooms/services/RedisAPStore.js', () => ({
  redis: { sismember: m.sismember },
}));
vi.mock('../vm.js', () => ({
  stepProgram: m.stepProgram,
  initialVmState: () => ({ loops: [], fly: null }),
}));
vi.mock('../cores.js', () => ({
  coreMoveOneSector: vi.fn(),
  coreScan: vi.fn(),
  coreMine: vi.fn(),
  coreSell: vi.fn(),
}));
vi.mock('../conditions.js', () => ({ evaluateCondition: vi.fn() }));
vi.mock('../../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { OfflineScheduler } from '../offlineScheduler.js';

/** Build a runtime-state row as returned by getOfflineActivePrograms(). */
function stateRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    player_id: 'p1',
    program_id: 'prog1',
    pc: 0,
    vm_state: { loops: [], fly: null, offlineSince: Date.now() },
    status: 'running',
    paused_reason: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // getConfig returns undefined → scheduler falls back to shared constants.
  m.getConfig.mockReturnValue(undefined);
  // Nobody online by default.
  m.sismember.mockResolvedValue(0);
  // Default: MK.IV computer (>= 4), compiles fine.
  m.getActiveShip.mockResolvedValue({ modules: [] });
  m.getShipComputerLevel.mockReturnValue(4);
  m.getProgram.mockResolvedValue({ id: 'prog1', source: 'scan', mode: 'loop' });
  m.compileProgram.mockReturnValue({ ok: true, instructions: [{ op: 'SCAN' }], statementCount: 1 });
  // One step → idle so we don't loop the whole budget.
  m.stepProgram.mockResolvedValue({ pc: 1, vm: { loops: [], fly: null }, status: 'idle', finished: true });
  m.saveProgramState.mockResolvedValue(undefined);
  m.appendProgramLog.mockResolvedValue(undefined);
});

describe('OfflineScheduler.tickOffline', () => {
  it('skips a player who is in the online_players set', async () => {
    m.getOfflineActivePrograms.mockResolvedValue([stateRow({ player_id: 'online1' })]);
    m.sismember.mockResolvedValue(1); // online

    const s = new OfflineScheduler();
    await s.tickOffline();

    expect(m.stepProgram).not.toHaveBeenCalled();
    expect(m.getActiveShip).not.toHaveBeenCalled();
  });

  it('processes an offline player whose computer level >= 4', async () => {
    m.getOfflineActivePrograms.mockResolvedValue([stateRow()]);

    const s = new OfflineScheduler();
    await s.tickOffline();

    expect(m.stepProgram).toHaveBeenCalled();
    expect(m.saveProgramState).toHaveBeenCalled();
  });

  it('pauses (does not step) a player with computer level < 4 with the MK.IV reason', async () => {
    m.getOfflineActivePrograms.mockResolvedValue([stateRow()]);
    m.getShipComputerLevel.mockReturnValue(3);

    const s = new OfflineScheduler();
    await s.tickOffline();

    expect(m.stepProgram).not.toHaveBeenCalled();
    expect(m.saveProgramState).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        status: 'paused',
        pausedReason: expect.stringContaining('MK.IV'),
      }),
    );
  });

  it('caps how many programs are processed by AUTOMATION_MAX_CONCURRENT_OFFLINE', async () => {
    // Config cap = 2; return 5 distinct players.
    m.getConfig.mockImplementation((key: string) =>
      key === 'AUTOMATION_MAX_CONCURRENT_OFFLINE' ? 2 : undefined,
    );
    const rows = ['a', 'b', 'c', 'd', 'e'].map((id) =>
      stateRow({ player_id: id }),
    );
    m.getOfflineActivePrograms.mockResolvedValue(rows);

    const s = new OfflineScheduler();
    await s.tickOffline();

    // Only 2 programs should have been stepped (one step each → idle).
    expect(m.stepProgram).toHaveBeenCalledTimes(2);
  });

  it('continues processing other programs when one throws', async () => {
    m.getOfflineActivePrograms.mockResolvedValue([
      stateRow({ player_id: 'boom' }),
      stateRow({ player_id: 'ok' }),
    ]);
    // First processed player throws inside getActiveShip; second succeeds.
    m.getActiveShip.mockImplementation(async (pid: string) => {
      if (pid === 'boom') throw new Error('db down');
      return { modules: [] };
    });

    const s = new OfflineScheduler();
    await s.tickOffline();

    // The healthy player still got stepped despite the other throwing.
    expect(m.stepProgram).toHaveBeenCalled();
    // The good player's state was saved.
    expect(m.saveProgramState).toHaveBeenCalledWith('ok', expect.anything());
  });

  it('pauses when the offline window has been exceeded and does not step', async () => {
    const longAgo = Date.now() - 100 * 3600 * 1000; // 100h ago, beyond MK.IV 4h window
    m.getOfflineActivePrograms.mockResolvedValue([
      stateRow({ vm_state: { loops: [], fly: null, offlineSince: longAgo } }),
    ]);

    const s = new OfflineScheduler();
    await s.tickOffline();

    expect(m.stepProgram).not.toHaveBeenCalled();
    expect(m.saveProgramState).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        status: 'paused',
        pausedReason: expect.stringContaining('Reichweite'),
      }),
    );
  });
});
