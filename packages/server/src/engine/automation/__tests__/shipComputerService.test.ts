import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock fns ───────────────────────────────────────────────────────
const m = vi.hoisted(() => ({
  // programQueries
  createProgram: vi.fn(),
  listProgramsForPlayer: vi.fn(),
  getProgram: vi.fn(),
  deleteProgram: vi.fn(),
  setActiveProgram: vi.fn(),
  saveProgramState: vi.fn(),
  getActiveProgramState: vi.fn(),
  clearProgramState: vi.fn(),
  appendProgramLog: vi.fn(),
  // queries
  getActiveShip: vi.fn(),
  getPlayerCredits: vi.fn(),
  // inventory
  getCargoState: vi.fn(),
  // redis
  getPlayerPosition: vi.fn(),
  // shared
  compileProgram: vi.fn(),
  getShipComputerLevel: vi.fn(),
  // config
  getConfig: vi.fn(),
}));

vi.mock('../../../db/programQueries.js', () => ({
  createProgram: m.createProgram,
  listProgramsForPlayer: m.listProgramsForPlayer,
  getProgram: m.getProgram,
  deleteProgram: m.deleteProgram,
  setActiveProgram: m.setActiveProgram,
  saveProgramState: m.saveProgramState,
  getActiveProgramState: m.getActiveProgramState,
  clearProgramState: m.clearProgramState,
  appendProgramLog: m.appendProgramLog,
}));

vi.mock('../../../db/queries.js', () => ({
  getActiveShip: m.getActiveShip,
  getPlayerCredits: m.getPlayerCredits,
}));

vi.mock('../../inventoryService.js', () => ({
  getCargoState: m.getCargoState,
}));

vi.mock('../../../rooms/services/RedisAPStore.js', () => ({
  getPlayerPosition: m.getPlayerPosition,
  getAPState: vi.fn(),
}));

vi.mock('@void-sector/shared', () => ({
  compileProgram: m.compileProgram,
  getShipComputerLevel: m.getShipComputerLevel,
  AUTOMATION_PROGRAM_LIMITS: { 1: 10, 2: 25, 3: 50, 4: 75, 5: 120 },
  AUTOMATION_SCHEDULER_INTERVAL_MS: 1000,
}));

vi.mock('../../gameConfigApply.js', () => ({ getConfig: m.getConfig }));

// cores + conditions are referenced only inside the executor's VmCtx; stub them.
vi.mock('../cores.js', () => ({
  coreMoveOneSector: vi.fn(),
  coreScan: vi.fn(),
  coreMine: vi.fn(),
  coreSell: vi.fn(),
}));
vi.mock('../conditions.js', () => ({ evaluateCondition: vi.fn() }));

import { ShipComputerService } from '../../../rooms/services/ShipComputerService.js';

// ─── Test doubles ───────────────────────────────────────────────────────────
function makeClient(userId = 'u1', sessionId = 's1') {
  return {
    sessionId,
    auth: { userId },
    send: vi.fn(),
  } as any;
}

function makeCtx() {
  // Minimal ServiceContext surface the service actually touches.
  return {} as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getConfig.mockReturnValue(undefined); // force shared-default fallbacks
  m.listProgramsForPlayer.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ShipComputerService.handleSaveProgram', () => {
  it('rejects when no ship computer is installed (level 0)', async () => {
    m.getActiveShip.mockResolvedValue({ modules: [] });
    m.getShipComputerLevel.mockReturnValue(0);

    const svc = new ShipComputerService(makeCtx());
    const client = makeClient();
    await svc.handleSaveProgram(client, { name: 'p', source: 'scan', mode: 'loop' });

    expect(client.send).toHaveBeenCalledWith('programError', {
      errors: [{ line: 0, message: 'Kein Bordcomputer installiert' }],
    });
    expect(m.createProgram).not.toHaveBeenCalled();
  });

  it('saves when level >= 1 and compile succeeds', async () => {
    m.getActiveShip.mockResolvedValue({ modules: [{ moduleId: 'computer_mk3' }] });
    m.getShipComputerLevel.mockReturnValue(3);
    m.compileProgram.mockReturnValue({ ok: true, instructions: [], statementCount: 1 });
    const row = { id: 'pr1', player_id: 'u1', name: 'p', source: 'scan', mode: 'loop', is_active: false };
    m.createProgram.mockResolvedValue(row);

    const svc = new ShipComputerService(makeCtx());
    const client = makeClient();
    await svc.handleSaveProgram(client, { name: 'p', source: 'scan', mode: 'loop' });

    expect(m.createProgram).toHaveBeenCalledWith('u1', 'p', 'scan', 'loop');
    expect(client.send).toHaveBeenCalledWith('programSaved', row);
  });

  it('reports compile errors without creating a program', async () => {
    m.getActiveShip.mockResolvedValue({ modules: [{ moduleId: 'computer_mk3' }] });
    m.getShipComputerLevel.mockReturnValue(3);
    const errors = [{ line: 2, message: 'Syntaxfehler' }];
    m.compileProgram.mockReturnValue({ ok: false, errors });

    const svc = new ShipComputerService(makeCtx());
    const client = makeClient();
    await svc.handleSaveProgram(client, { name: 'p', source: 'xxx', mode: 'loop' });

    expect(client.send).toHaveBeenCalledWith('programError', { errors });
    expect(m.createProgram).not.toHaveBeenCalled();
  });
});

describe('ShipComputerService.handleStartProgram', () => {
  it('activates the program, persists running state, and notifies the client', async () => {
    vi.useFakeTimers();
    m.getProgram.mockResolvedValue({
      id: 'pr1',
      player_id: 'u1',
      name: 'p',
      source: 'scan',
      mode: 'loop',
      is_active: false,
    });
    m.getActiveShip.mockResolvedValue({ modules: [{ moduleId: 'computer_mk3' }] });
    m.getShipComputerLevel.mockReturnValue(3);
    m.compileProgram.mockReturnValue({ ok: true, instructions: [{ op: 'SCAN', line: 1 }], statementCount: 1 });
    // Executor will read state once it ticks — keep it idle so it stops immediately.
    m.getActiveProgramState.mockResolvedValue(null);

    const svc = new ShipComputerService(makeCtx());
    const client = makeClient();
    await svc.handleStartProgram(client, { id: 'pr1' });

    expect(m.setActiveProgram).toHaveBeenCalledWith('u1', 'pr1');
    expect(m.saveProgramState).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ programId: 'pr1', pc: 0, status: 'running' }),
    );
    expect(client.send).toHaveBeenCalledWith('programState', { status: 'running', pc: 0 });

    // Clean up any started timer so it doesn't leak across tests.
    svc.stopExecutor(client.sessionId);
  });
});
