import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepairService, calculateRepairCost, calculateNextBracketHp } from '../RepairService.js';
import { getDamageState } from '@void-sector/shared';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../db/queries.js', () => ({
  getActiveShip: vi.fn(),
  updateShipModules: vi.fn(),
  getPlayerCredits: vi.fn(),
  deductCredits: vi.fn(),
}));

vi.mock('../../../engine/inventoryService.js', () => ({
  getCargoState: vi.fn(),
  removeFromInventory: vi.fn(),
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import {
  getActiveShip,
  updateShipModules,
  getPlayerCredits,
  deductCredits,
} from '../../../db/queries.js';
import { getCargoState, removeFromInventory } from '../../../engine/inventoryService.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeClient(overrides: Partial<any> = {}): any {
  const messages: Array<{ type: string; data: unknown }> = [];
  return {
    auth: { userId: 'player-1', username: 'Test', isGuest: false },
    sessionId: 'session-abc',
    send(type: string, data: unknown) {
      messages.push({ type, data });
    },
    _messages: messages,
    ...overrides,
  };
}

function makeServiceContext(overrides: Partial<any> = {}): any {
  return {
    checkRate: vi.fn(() => true),
    _pst: vi.fn(() => 'station'),
    clientShips: new Map(),
    quadrantX: 0,
    quadrantY: 0,
    ...overrides,
  };
}

/**
 * Standard ship fixture with:
 * - repair_mk3 (tier 3, full HP)
 * - scanner_mk1 at varying HP
 */
function makeShip(modulesOverride?: any[]): any {
  return {
    id: 'ship-1',
    hullType: 'explorer_hull',
    modules: modulesOverride ?? [
      { moduleId: 'repair_mk3', slotIndex: 7, source: 'bought', powerLevel: 'high', currentHp: 55 },
      { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 5 },
    ],
    active: true,
  };
}

// ─── Pure logic tests (no mocking needed) ────────────────────────────────────

describe('calculateRepairCost', () => {
  it('destroyed→heavy costs crystal only (tier × 5)', () => {
    expect(calculateRepairCost('destroyed', 3)).toEqual({ ore: 0, crystal: 15 });
    expect(calculateRepairCost('destroyed', 1)).toEqual({ ore: 0, crystal: 5 });
  });

  it('heavy→light costs ore + crystal (tier × 3 ore, tier × 2 crystal)', () => {
    expect(calculateRepairCost('heavy', 3)).toEqual({ ore: 9, crystal: 6 });
    expect(calculateRepairCost('heavy', 2)).toEqual({ ore: 6, crystal: 4 });
  });

  it('light→intact costs ore only (tier × 5)', () => {
    expect(calculateRepairCost('light', 3)).toEqual({ ore: 15, crystal: 0 });
    expect(calculateRepairCost('light', 5)).toEqual({ ore: 25, crystal: 0 });
  });
});

describe('calculateNextBracketHp', () => {
  it('destroyed → heavy: sets HP to ceil(maxHp × 0.50)', () => {
    expect(calculateNextBracketHp('destroyed', 20)).toBe(10);
    expect(calculateNextBracketHp('destroyed', 55)).toBe(28);
  });

  it('heavy → light: sets HP to ceil(maxHp × 0.75)', () => {
    expect(calculateNextBracketHp('heavy', 20)).toBe(15);
    expect(calculateNextBracketHp('heavy', 55)).toBe(42);
  });

  it('light → intact: sets HP to maxHp', () => {
    expect(calculateNextBracketHp('light', 20)).toBe(20);
    expect(calculateNextBracketHp('light', 55)).toBe(55);
  });

  it('resulting HP produces correct damage state', () => {
    const brackets: Array<['destroyed' | 'heavy' | 'light', string]> = [
      ['destroyed', 'heavy'],
      ['heavy', 'light'],
      ['light', 'intact'],
    ];
    const maxHp = 80;
    for (const [from, expectedTo] of brackets) {
      const newHp = calculateNextBracketHp(from, maxHp);
      const state = getDamageState(newHp, maxHp);
      expect(state).toBe(expectedTo);
    }
  });
});

describe('getDamageState', () => {
  it('returns correct brackets for ratios', () => {
    expect(getDamageState(0, 20)).toBe('destroyed');
    expect(getDamageState(5, 20)).toBe('destroyed');   // 25%
    expect(getDamageState(6, 20)).toBe('heavy');        // 30%
    expect(getDamageState(10, 20)).toBe('heavy');       // 50%
    expect(getDamageState(11, 20)).toBe('light');       // 55%
    expect(getDamageState(15, 20)).toBe('light');       // 75%
    expect(getDamageState(16, 20)).toBe('intact');      // 80%
    expect(getDamageState(20, 20)).toBe('intact');      // 100%
  });
});

// ─── RepairService integration tests ─────────────────────────────────────────

describe('RepairService.handleRepairModule', () => {
  let service: RepairService;
  let ctx: ReturnType<typeof makeServiceContext>;
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    vi.resetAllMocks();
    ctx = makeServiceContext();
    service = new RepairService(ctx);
    client = makeClient();
  });

  it('rejects if no active ship', async () => {
    vi.mocked(getActiveShip).mockResolvedValue(null);
    await service.handleRepairModule(client, { moduleId: 'scanner_mk1' });
    expect(client._messages.some((m: any) => m.type === 'repairModuleResult' && !m.data.success)).toBe(true);
  });

  it('rejects if module not found on ship', async () => {
    vi.mocked(getActiveShip).mockResolvedValue(makeShip());
    await service.handleRepairModule(client, { moduleId: 'drive_mk5' });
    const result = client._messages.find((m: any) => m.type === 'repairModuleResult');
    expect(result?.data.success).toBe(false);
    expect(result?.data.error).toMatch(/nicht installiert/);
  });

  it('rejects if module is already intact', async () => {
    vi.mocked(getActiveShip).mockResolvedValue(
      makeShip([
        { moduleId: 'repair_mk3', slotIndex: 7, source: 'bought', powerLevel: 'high', currentHp: 55 },
        // scanner_mk1 maxHp=20, currentHp=20 → intact
        { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 20 },
      ]),
    );
    await service.handleRepairModule(client, { moduleId: 'scanner_mk1' });
    const result = client._messages.find((m: any) => m.type === 'repairModuleResult');
    expect(result?.data.success).toBe(false);
    expect(result?.data.error).toMatch(/intakt/);
  });

  it('rejects if no repair module installed', async () => {
    vi.mocked(getActiveShip).mockResolvedValue(
      makeShip([
        // No repair module
        { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 5 },
      ]),
    );
    await service.handleRepairModule(client, { moduleId: 'scanner_mk1' });
    const result = client._messages.find((m: any) => m.type === 'repairModuleResult');
    expect(result?.data.success).toBe(false);
    expect(result?.data.error).toMatch(/Reparatur-Modul/);
  });

  it('rejects destroyed→heavy for tier 1 repair module', async () => {
    // scanner_mk1 maxHp=20, destroyed = currentHp ≤ 5
    vi.mocked(getActiveShip).mockResolvedValue(
      makeShip([
        { moduleId: 'repair_mk1', slotIndex: 7, source: 'bought', powerLevel: 'high', currentHp: 20 },
        { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 2 },
      ]),
    );
    await service.handleRepairModule(client, { moduleId: 'scanner_mk1' });
    const result = client._messages.find((m: any) => m.type === 'repairModuleResult');
    expect(result?.data.success).toBe(false);
    expect(result?.data.error).toMatch(/Tier 3/);
  });

  it('rejects heavy→light for tier 2 repair module', async () => {
    // scanner_mk1 maxHp=20, heavy = currentHp 6–10
    vi.mocked(getActiveShip).mockResolvedValue(
      makeShip([
        { moduleId: 'repair_mk2', slotIndex: 7, source: 'bought', powerLevel: 'high', currentHp: 35 },
        { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 8 },
      ]),
    );
    await service.handleRepairModule(client, { moduleId: 'scanner_mk1' });
    const result = client._messages.find((m: any) => m.type === 'repairModuleResult');
    expect(result?.data.success).toBe(false);
    expect(result?.data.error).toMatch(/Tier 3/);
  });

  it('rejects if not enough ore', async () => {
    // scanner_mk1 currentHp=12 (light), repair_mk3 tier 3 → cost: 15 ore, 0 crystal
    vi.mocked(getActiveShip).mockResolvedValue(makeShip([
      { moduleId: 'repair_mk3', slotIndex: 7, source: 'bought', powerLevel: 'high', currentHp: 55 },
      { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 12 },
    ]));
    vi.mocked(getCargoState).mockResolvedValue({ ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 });
    await service.handleRepairModule(client, { moduleId: 'scanner_mk1' });
    const result = client._messages.find((m: any) => m.type === 'repairModuleResult');
    expect(result?.data.success).toBe(false);
    expect(result?.data.error).toMatch(/Erz/);
  });

  it('rejects if not enough crystal', async () => {
    // scanner_mk1 currentHp=2 (destroyed), repair_mk3 tier 3 → cost: 0 ore, 15 crystal
    vi.mocked(getActiveShip).mockResolvedValue(makeShip([
      { moduleId: 'repair_mk3', slotIndex: 7, source: 'bought', powerLevel: 'high', currentHp: 55 },
      { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 2 },
    ]));
    vi.mocked(getCargoState).mockResolvedValue({ ore: 100, gas: 0, crystal: 3, slates: 0, artefact: 0 });
    await service.handleRepairModule(client, { moduleId: 'scanner_mk1' });
    const result = client._messages.find((m: any) => m.type === 'repairModuleResult');
    expect(result?.data.success).toBe(false);
    expect(result?.data.error).toMatch(/Kristall/);
  });

  it('successfully repairs light→intact (tier 3 repair, sufficient ore)', async () => {
    // scanner_mk1 maxHp=20, currentHp=12 → light (60%)
    vi.mocked(getActiveShip).mockResolvedValue(makeShip([
      { moduleId: 'repair_mk3', slotIndex: 7, source: 'bought', powerLevel: 'high', currentHp: 55 },
      { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 12 },
    ]));
    vi.mocked(getCargoState).mockResolvedValue({ ore: 50, gas: 0, crystal: 20, slates: 0, artefact: 0 });
    vi.mocked(updateShipModules).mockResolvedValue(undefined as any);
    vi.mocked(removeFromInventory).mockResolvedValue(undefined as any);

    await service.handleRepairModule(client, { moduleId: 'scanner_mk1' });

    const result = client._messages.find((m: any) => m.type === 'repairModuleResult');
    expect(result?.data.success).toBe(true);
    expect(result?.data.oldState).toBe('light');
    expect(result?.data.newState).toBe('intact');
    expect(result?.data.newHp).toBe(20);
    expect(result?.data.cost).toEqual({ ore: 15, crystal: 0 });

    // Verify ore was deducted, no crystal
    expect(removeFromInventory).toHaveBeenCalledWith('player-1', 'resource', 'ore', 15);
    expect(removeFromInventory).not.toHaveBeenCalledWith('player-1', 'resource', 'crystal', expect.anything());
  });

  it('successfully repairs destroyed→heavy (tier 3, sufficient crystal)', async () => {
    // scanner_mk1 maxHp=20, currentHp=2 → destroyed
    vi.mocked(getActiveShip).mockResolvedValue(makeShip([
      { moduleId: 'repair_mk3', slotIndex: 7, source: 'bought', powerLevel: 'high', currentHp: 55 },
      { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 2 },
    ]));
    vi.mocked(getCargoState).mockResolvedValue({ ore: 0, gas: 0, crystal: 30, slates: 0, artefact: 0 });
    vi.mocked(updateShipModules).mockResolvedValue(undefined as any);
    vi.mocked(removeFromInventory).mockResolvedValue(undefined as any);

    await service.handleRepairModule(client, { moduleId: 'scanner_mk1' });

    const result = client._messages.find((m: any) => m.type === 'repairModuleResult');
    expect(result?.data.success).toBe(true);
    expect(result?.data.oldState).toBe('destroyed');
    expect(result?.data.newState).toBe('heavy');
    expect(result?.data.newHp).toBe(10); // ceil(20 * 0.5)
    expect(result?.data.cost).toEqual({ ore: 0, crystal: 15 }); // tier 3 × 5
  });

  it('ignores repair module that is powered off', async () => {
    vi.mocked(getActiveShip).mockResolvedValue(
      makeShip([
        { moduleId: 'repair_mk3', slotIndex: 7, source: 'bought', powerLevel: 'off', currentHp: 55 },
        { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 5 },
      ]),
    );
    await service.handleRepairModule(client, { moduleId: 'scanner_mk1' });
    const result = client._messages.find((m: any) => m.type === 'repairModuleResult');
    expect(result?.data.success).toBe(false);
    expect(result?.data.error).toMatch(/Reparatur-Modul/);
  });
});

describe('RepairService.handleStationRepair', () => {
  let service: RepairService;
  let ctx: ReturnType<typeof makeServiceContext>;
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    vi.resetAllMocks();
    ctx = makeServiceContext({ _pst: vi.fn(() => 'station') });
    service = new RepairService(ctx);
    client = makeClient();
  });

  it('rejects if not at a station', async () => {
    ctx._pst = vi.fn(() => 'empty');
    await service.handleStationRepair(client, {} as any);
    const result = client._messages.find((m: any) => m.type === 'stationRepairResult');
    expect(result?.data.success).toBe(false);
    expect(result?.data.error).toMatch(/Station/);
  });

  it('rejects if no active ship', async () => {
    vi.mocked(getActiveShip).mockResolvedValue(null);
    await service.handleStationRepair(client, {} as any);
    const result = client._messages.find((m: any) => m.type === 'stationRepairResult');
    expect(result?.data.success).toBe(false);
  });

  it('rejects if all modules are already intact', async () => {
    vi.mocked(getActiveShip).mockResolvedValue(
      makeShip([
        { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 20 },
      ]),
    );
    await service.handleStationRepair(client, {} as any);
    const result = client._messages.find((m: any) => m.type === 'stationRepairResult');
    expect(result?.data.success).toBe(false);
    expect(result?.data.error).toMatch(/intakt/);
  });

  it('rejects if not enough credits', async () => {
    // scanner_mk1 maxHp=20, currentHp=0 → cost = 20 × 2 = 40 CR
    vi.mocked(getActiveShip).mockResolvedValue(
      makeShip([
        { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 0 },
      ]),
    );
    vi.mocked(getPlayerCredits).mockResolvedValue(10);
    await service.handleStationRepair(client, {} as any);
    const result = client._messages.find((m: any) => m.type === 'stationRepairResult');
    expect(result?.data.success).toBe(false);
    expect(result?.data.error).toMatch(/Credits/);
  });

  it('repairs all modules to full HP and deducts credits', async () => {
    // scanner_mk1: maxHp=20, currentHp=5 → repair cost = 15 × 2 = 30 CR
    vi.mocked(getActiveShip).mockResolvedValue(
      makeShip([
        { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 5 },
      ]),
    );
    vi.mocked(getPlayerCredits)
      .mockResolvedValueOnce(200)  // initial check
      .mockResolvedValueOnce(170); // after deduct (for creditsUpdate)
    vi.mocked(deductCredits).mockResolvedValue(undefined as any);
    vi.mocked(updateShipModules).mockResolvedValue(undefined as any);

    await service.handleStationRepair(client, {} as any);

    const result = client._messages.find((m: any) => m.type === 'stationRepairResult');
    expect(result?.data.success).toBe(true);
    expect(result?.data.modulesRepaired).toBe(1);
    expect(result?.data.cost).toBe(30);

    expect(deductCredits).toHaveBeenCalledWith('player-1', 30);
    expect(updateShipModules).toHaveBeenCalledWith(
      'ship-1',
      expect.arrayContaining([
        expect.objectContaining({ moduleId: 'scanner_mk1', currentHp: 20 }),
      ]),
    );
  });

  it('station repair cost is sum of all damaged modules × 2', async () => {
    // scanner_mk1: maxHp=20, currentHp=5 → 15 missing HP → 30 CR
    // drive_mk1: maxHp=20, currentHp=10 → 10 missing HP → 20 CR
    // total: 50 CR
    vi.mocked(getActiveShip).mockResolvedValue(
      makeShip([
        { moduleId: 'scanner_mk1', slotIndex: 2, source: 'bought', powerLevel: 'high', currentHp: 5 },
        { moduleId: 'drive_mk1', slotIndex: 0, source: 'bought', powerLevel: 'high', currentHp: 10 },
      ]),
    );
    vi.mocked(getPlayerCredits)
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(450);
    vi.mocked(deductCredits).mockResolvedValue(undefined as any);
    vi.mocked(updateShipModules).mockResolvedValue(undefined as any);

    await service.handleStationRepair(client, {} as any);

    const result = client._messages.find((m: any) => m.type === 'stationRepairResult');
    expect(result?.data.success).toBe(true);
    expect(result?.data.cost).toBe(50);
    expect(deductCredits).toHaveBeenCalledWith('player-1', 50);
  });
});
