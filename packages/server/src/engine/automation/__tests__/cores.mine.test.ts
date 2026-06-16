import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  getPlayerPosition: vi.fn(),
  getAPState: vi.fn(),
  saveAPState: vi.fn(),
  getFuelState: vi.fn(),
  saveFuelState: vi.fn(),
  savePlayerPosition: vi.fn(),
  getActiveShip: vi.fn(),
  getSector: vi.fn(),
  saveSector: vi.fn(),
  addDiscovery: vi.fn(),
  updateSectorResources: vi.fn(),
  generateSector: vi.fn(),
  calculateShipStats: vi.fn(),
  getCargoCapForPlayer: vi.fn(),
  getResourceTotal: vi.fn(),
  addToInventory: vi.fn(),
  removeFromInventory: vi.fn(),
  getCargoState: vi.fn(),
}));

vi.mock('../../../rooms/services/RedisAPStore.js', () => ({
  getPlayerPosition: m.getPlayerPosition,
  savePlayerPosition: m.savePlayerPosition,
  getAPState: m.getAPState,
  saveAPState: m.saveAPState,
  getFuelState: m.getFuelState,
  saveFuelState: m.saveFuelState,
}));
vi.mock('../../ap.js', () => ({ calculateCurrentAP: (ap: any) => ap }));
vi.mock('../../../db/queries.js', () => ({
  getActiveShip: m.getActiveShip,
  getSector: m.getSector,
  saveSector: m.saveSector,
  addDiscovery: m.addDiscovery,
  updateSectorResources: m.updateSectorResources,
  getCargoCapForPlayer: m.getCargoCapForPlayer,
}));
vi.mock('../../worldgen.js', () => ({ generateSector: m.generateSector }));
vi.mock('@void-sector/shared', () => ({ calculateShipStats: m.calculateShipStats }));
vi.mock('../../inventoryService.js', () => ({
  getCargoState: m.getCargoState,
  getResourceTotal: m.getResourceTotal,
  addToInventory: m.addToInventory,
  removeFromInventory: m.removeFromInventory,
}));
vi.mock('../../../engine/npcStationEngine.js', () => ({
  getOrInitStation: vi.fn(),
  canSellToStation: vi.fn(),
  recordTrade: vi.fn(),
  calculateCurrentStock: vi.fn(),
  getStationInventoryItem: vi.fn(),
  upsertInventoryItem: vi.fn(),
}));
vi.mock('../../../db/npcStationQueries.js', () => ({
  getStationData: vi.fn(),
  getStationInventoryItem: vi.fn(),
  upsertInventoryItem: vi.fn(),
}));
vi.mock('../../../db/queries.js', () => ({
  getActiveShip: m.getActiveShip,
  getSector: m.getSector,
  saveSector: m.saveSector,
  addDiscovery: m.addDiscovery,
  updateSectorResources: m.updateSectorResources,
  getCargoCapForPlayer: m.getCargoCapForPlayer,
  addCredits: vi.fn(),
}));

import { coreMine } from '../cores.js';

beforeEach(() => {
  vi.clearAllMocks();
  m.getPlayerPosition.mockResolvedValue({ x: 3, y: 5 });
  m.getActiveShip.mockResolvedValue({ modules: [] });
  m.calculateShipStats.mockReturnValue({ cargoCap: 20, apCostJump: 1, fuelPerJump: 10, scannerLevel: 1 });
  m.getAPState.mockResolvedValue({ current: 100, max: 100, lastTick: 0, regenPerSecond: 1 });
  m.getFuelState.mockResolvedValue(1000);
  m.getResourceTotal.mockResolvedValue(5); // 5 already in cargo, space = 15
  m.getCargoCapForPlayer.mockResolvedValue(20);
  m.getSector.mockResolvedValue({
    x: 3,
    y: 5,
    type: 'asteroid_field',
    resources: { ore: 50, gas: 0, crystal: 0 },
  });
  m.addToInventory.mockResolvedValue(undefined);
  m.updateSectorResources.mockResolvedValue(undefined);
});

describe('coreMine', () => {
  it('mines up to available space (until_full) and updates inventory + sector', async () => {
    // cargoCap=20, current=5, space=15, sector has ore=50 → should mine 15 ore
    const r = await coreMine('u1', 'until_full', 0);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mined).toBe(15);

    expect(m.addToInventory).toHaveBeenCalledWith('u1', 'resource', 'ore', 15);
    // updateSectorResources called with updated resources (ore 50-15=35) and mined resource name
    expect(m.updateSectorResources).toHaveBeenCalledWith(
      3,
      5,
      { ore: 35, gas: 0, crystal: 0 },
      'ore',
    );
  });

  it('returns ok:false when cargo is already full', async () => {
    m.getResourceTotal.mockResolvedValue(20); // total === cap, space = 0
    const r = await coreMine('u1', 'until_full', 0);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/voll/i);
  });

  it('returns ok:true mined:0 when sector has no resources', async () => {
    m.getSector.mockResolvedValue({
      x: 3,
      y: 5,
      type: 'empty',
      resources: { ore: 0, gas: 0, crystal: 0 },
    });
    const r = await coreMine('u1', 'until_full', 0);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mined).toBe(0);
    expect(m.addToInventory).not.toHaveBeenCalled();
    expect(m.updateSectorResources).not.toHaveBeenCalled();
  });

  it('mines exactly amount units when mode is "amount" and resources are available', async () => {
    // space=15, sector ore=50, amount=10 → should mine only 10
    const r = await coreMine('u1', 'amount', 10);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mined).toBe(10);
    expect(m.addToInventory).toHaveBeenCalledWith('u1', 'resource', 'ore', 10);
  });

  it('caps amount-mode by cargo space when amount exceeds available space', async () => {
    // space=15, sector ore=50, amount=20 → should mine only 15 (space limit)
    const r = await coreMine('u1', 'amount', 20);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mined).toBe(15);
  });

  it('caps mining by sector resource availability', async () => {
    // space=15, sector ore=5 (less than space) → should mine only 5
    m.getSector.mockResolvedValue({
      x: 3,
      y: 5,
      type: 'asteroid_field',
      resources: { ore: 5, gas: 0, crystal: 0 },
    });
    const r = await coreMine('u1', 'until_full', 0);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mined).toBe(5);
  });
});
