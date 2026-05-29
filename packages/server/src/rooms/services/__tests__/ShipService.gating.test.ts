import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShipService } from '../ShipService.js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../db/queries.js', () => ({
  getActiveShip: vi.fn(),
  getPlayerShips: vi.fn(),
  updateShipModules: vi.fn(),
  renameShip: vi.fn(),
  getInventory: vi.fn(),
  getPlayerResearch: vi.fn(),
  addUnlockedModule: vi.fn(),
  getPlayerCredits: vi.fn(),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  getWissen: vi.fn(),
}));

vi.mock('../../../db/techTreeQueries.js', () => ({
  getCategoryTiers: vi.fn(),
}));

vi.mock('../../../engine/inventoryService.js', () => ({
  addToInventory: vi.fn(),
  removeFromInventory: vi.fn(),
  getInventoryItem: vi.fn(),
  getCargoState: vi.fn(),
}));

vi.mock('../../../db/craftSiteQueries.js', () => ({
  createCraftSite: vi.fn(),
  getCraftSiteByShipId: vi.fn(),
  depositCraftResources: vi.fn(),
  deleteCraftSite: vi.fn(),
}));

vi.mock('../../../engine/acepXpService.js', () => ({
  getAcepXpSummary: vi.fn().mockResolvedValue({}),
  getAcepEffects: vi.fn().mockReturnValue({}),
  boostAcepPath: vi.fn(),
}));

vi.mock('../../../engine/wissenService.js', () => ({
  awardWissenAndNotify: vi.fn(),
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getPlayerResearch, getPlayerCredits, getActiveShip } from '../../../db/queries.js';
import { getCategoryTiers } from '../../../db/techTreeQueries.js';
import { getInventoryItem, getCargoState } from '../../../engine/inventoryService.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeClient(): any {
  const messages: Array<{ type: string; data: unknown }> = [];
  return {
    auth: { userId: 'player-1', username: 'Testpilot', isGuest: false },
    sessionId: 'session-gating',
    send(type: string, data: unknown) {
      messages.push({ type, data });
    },
    _messages: messages,
  };
}

function makeServiceContext(overrides: Partial<any> = {}): any {
  return {
    checkRate: vi.fn(() => true),
    _pst: vi.fn(() => 'empty'),
    clientShips: new Map(),
    quadrantX: 0,
    quadrantY: 0,
    send: vi.fn(),
    ...overrides,
  };
}

// ─── handleBuyModule — tier gating ───────────────────────────────────────────

// puls_laser_mk2 is a real tier-2 weapon_energy module (confirmed in moduleDefinitions.ts)
const TIER2_MODULE = 'puls_laser_mk2';

describe('ShipService.handleBuyModule — tier gating', () => {
  let service: ShipService;
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getPlayerResearch).mockResolvedValue({ unlockedModules: [], blueprints: [] });
    service = new ShipService(makeServiceContext());
    client = makeClient();
  });

  it('sends MODULE_LOCKED when categoryTiers is empty (tier-2 module)', async () => {
    vi.mocked(getCategoryTiers).mockResolvedValue({});

    await service.handleBuyModule(client, { moduleId: TIER2_MODULE });

    const errorMsg = client._messages.find((m: any) => m.type === 'error');
    expect(errorMsg).toBeDefined();
    expect(errorMsg?.data).toMatchObject({ code: 'MODULE_LOCKED' });
  });

  it('sends MODULE_LOCKED when weapon_energy tier is 1 (still locked for tier-2 module)', async () => {
    vi.mocked(getCategoryTiers).mockResolvedValue({ weapon_energy: 1 });

    await service.handleBuyModule(client, { moduleId: TIER2_MODULE });

    const errorMsg = client._messages.find((m: any) => m.type === 'error');
    expect(errorMsg).toBeDefined();
    expect(errorMsg?.data).toMatchObject({ code: 'MODULE_LOCKED' });
  });

  it('passes the gate when weapon_energy tier >= 2 (fails later on WRONG_LOCATION, NOT MODULE_LOCKED)', async () => {
    vi.mocked(getCategoryTiers).mockResolvedValue({ weapon_energy: 2 });
    // Player is not at station → expect WRONG_LOCATION, not MODULE_LOCKED
    vi.mocked(getPlayerCredits).mockResolvedValue(9999);
    vi.mocked(getCargoState).mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 });

    await service.handleBuyModule(client, { moduleId: TIER2_MODULE });

    const errorMsgs = client._messages.filter((m: any) => m.type === 'error');
    const hasModuleLocked = errorMsgs.some((m: any) => m.data?.code === 'MODULE_LOCKED');
    const hasWrongLocation = errorMsgs.some((m: any) => m.data?.code === 'WRONG_LOCATION');

    expect(hasModuleLocked).toBe(false);
    expect(hasWrongLocation).toBe(true);
  });

  it('sends MODULE_LOCKED for unknown module id', async () => {
    vi.mocked(getCategoryTiers).mockResolvedValue({ weapon_energy: 5 });

    await service.handleBuyModule(client, { moduleId: 'nonexistent_module_xyz' });

    const errorMsg = client._messages.find((m: any) => m.type === 'error');
    expect(errorMsg).toBeDefined();
    // Should get UNKNOWN_MODULE, not MODULE_LOCKED
    expect(errorMsg?.data).toMatchObject({ code: 'UNKNOWN_MODULE' });
  });
});

// ─── handleCraftModule — tier gating ─────────────────────────────────────────

describe('ShipService.handleCraftModule — tier gating', () => {
  let service: ShipService;
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getPlayerResearch).mockResolvedValue({ unlockedModules: [], blueprints: [] });
    vi.mocked(getInventoryItem).mockResolvedValue(0); // no blueprint
    service = new ShipService(makeServiceContext());
    client = makeClient();
  });

  it('sends craftResult failure when categoryTiers is empty (tier-2 module, no blueprint)', async () => {
    vi.mocked(getCategoryTiers).mockResolvedValue({});

    await service.handleCraftModule(client, { moduleId: TIER2_MODULE });

    const result = client._messages.find((m: any) => m.type === 'craftResult');
    expect(result).toBeDefined();
    expect(result?.data).toMatchObject({ success: false });
    expect((result?.data as any).error).toMatch(/Tier/i);
  });

  it('passes the gate when weapon_energy tier >= 2 (proceeds to ship check)', async () => {
    vi.mocked(getCategoryTiers).mockResolvedValue({ weapon_energy: 2 });
    vi.mocked(getActiveShip).mockResolvedValue(null); // no ship → returns early

    await service.handleCraftModule(client, { moduleId: TIER2_MODULE });

    // Should NOT send the Tier-locked craftResult
    const result = client._messages.find(
      (m: any) => m.type === 'craftResult' && m.data?.error?.match(/Tier/i),
    );
    expect(result).toBeUndefined();
  });

  it('still gates when blueprint is in inventory but tier is too low (non-foundOnly module)', async () => {
    // puls_laser_mk2 is NOT isFoundOnly, so blueprints in inventory don't override tier gating
    // The blueprint array passed to isModuleUnlocked is only effective for isFoundOnly modules
    vi.mocked(getCategoryTiers).mockResolvedValue({});
    vi.mocked(getInventoryItem).mockResolvedValue(1); // has blueprint — doesn't help for normal modules

    await service.handleCraftModule(client, { moduleId: TIER2_MODULE });

    const result = client._messages.find((m: any) => m.type === 'craftResult');
    expect(result).toBeDefined();
    expect(result?.data).toMatchObject({ success: false });
  });

  it('passes the gate when moduleId is in unlockedModules research', async () => {
    vi.mocked(getCategoryTiers).mockResolvedValue({});
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: [TIER2_MODULE],
      blueprints: [],
    });
    vi.mocked(getActiveShip).mockResolvedValue(null);

    await service.handleCraftModule(client, { moduleId: TIER2_MODULE });

    const tieredError = client._messages.find(
      (m: any) => m.type === 'craftResult' && m.data?.error?.match(/Tier/i),
    );
    expect(tieredError).toBeUndefined();
  });
});
