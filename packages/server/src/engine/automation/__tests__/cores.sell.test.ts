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
  // sell-related
  getStationData: vi.fn(),
  canSellToStation: vi.fn(),
  getStationInventoryItem: vi.fn(),
  upsertInventoryItem: vi.fn(),
  calculateCurrentStock: vi.fn(),
  recordTrade: vi.fn(),
  addCredits: vi.fn(),
  updatePlayerStationRep: vi.fn(),
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
  addCredits: m.addCredits,
  updatePlayerStationRep: m.updatePlayerStationRep,
}));
vi.mock('../../worldgen.js', () => ({ generateSector: m.generateSector }));
vi.mock('@void-sector/shared', () => ({ calculateShipStats: m.calculateShipStats }));
vi.mock('../../inventoryService.js', () => ({
  getCargoState: m.getCargoState,
  getResourceTotal: m.getResourceTotal,
  addToInventory: m.addToInventory,
  removeFromInventory: m.removeFromInventory,
}));
vi.mock('../../../db/npcStationQueries.js', () => ({
  getStationData: m.getStationData,
  getStationInventoryItem: m.getStationInventoryItem,
  upsertInventoryItem: m.upsertInventoryItem,
}));
vi.mock('../../../engine/npcStationEngine.js', () => ({
  canSellToStation: m.canSellToStation,
  calculateCurrentStock: m.calculateCurrentStock,
  recordTrade: m.recordTrade,
}));

import { coreSell } from '../cores.js';

beforeEach(() => {
  vi.clearAllMocks();
  m.getPlayerPosition.mockResolvedValue({ x: 0, y: 0 });
  m.getActiveShip.mockResolvedValue({ modules: [] });
  m.calculateShipStats.mockReturnValue({ cargoCap: 20, apCostJump: 1, fuelPerJump: 10 });
  m.getAPState.mockResolvedValue({ current: 100, max: 100, lastTick: 0, regenPerSecond: 1 });
  m.getFuelState.mockResolvedValue(1000);
  // Default: station present at 0:0
  m.getStationData.mockResolvedValue({ stationX: 0, stationY: 0, level: 1, xp: 100 });
  // Cargo: 10 ore, no gas/crystal
  m.getCargoState.mockResolvedValue({ ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0 });
  // canSellToStation returns price 80 for ore, effectiveAmount = 10
  m.canSellToStation.mockResolvedValue({ ok: true, price: 80, capacity: 100, effectiveAmount: 10 });
  m.removeFromInventory.mockResolvedValue(undefined);
  m.addCredits.mockResolvedValue(1080);
  m.updatePlayerStationRep.mockResolvedValue(undefined);
  m.recordTrade.mockResolvedValue(undefined);
  // Station inventory item for stock update
  m.getStationInventoryItem.mockResolvedValue({
    stationX: 0,
    stationY: 0,
    itemType: 'ore',
    stock: 50,
    maxStock: 200,
    restockRate: 10,
    consumptionRate: 5,
    lastUpdated: new Date().toISOString(),
  });
  m.calculateCurrentStock.mockReturnValue(50);
  m.upsertInventoryItem.mockResolvedValue(undefined);
});

describe('coreSell', () => {
  it('sells all cargo resources and returns total credits earned', async () => {
    const r = await coreSell('u1', 'all');

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 80 credits for 10 ore
    expect(r.credits).toBe(80);

    expect(m.removeFromInventory).toHaveBeenCalledWith('u1', 'resource', 'ore', 10);
    expect(m.addCredits).toHaveBeenCalledWith('u1', 80);
  });

  it('returns ok:false when no station is present at the sector', async () => {
    m.getStationData.mockResolvedValue(null);

    const r = await coreSell('u1', 'all');

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/station/i);
  });

  it('returns ok:true credits:0 when cargo is empty', async () => {
    m.getCargoState.mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 });

    const r = await coreSell('u1', 'all');

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.credits).toBe(0);
    expect(m.removeFromInventory).not.toHaveBeenCalled();
    expect(m.addCredits).not.toHaveBeenCalled();
  });

  it('sums credits from selling multiple resource types', async () => {
    // ore=5, gas=3
    m.getCargoState.mockResolvedValue({ ore: 5, gas: 3, crystal: 0, slates: 0, artefact: 0 });
    // ore sell = 40 credits, gas sell = 60 credits
    m.canSellToStation
      .mockResolvedValueOnce({ ok: true, price: 40, capacity: 100, effectiveAmount: 5 }) // ore
      .mockResolvedValueOnce({ ok: true, price: 60, capacity: 100, effectiveAmount: 3 }); // gas

    const r = await coreSell('u1', 'all');

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.credits).toBe(100); // 40 + 60

    expect(m.removeFromInventory).toHaveBeenCalledTimes(2);
    expect(m.removeFromInventory).toHaveBeenCalledWith('u1', 'resource', 'ore', 5);
    expect(m.removeFromInventory).toHaveBeenCalledWith('u1', 'resource', 'gas', 3);
    expect(m.addCredits).toHaveBeenCalledTimes(2);
  });

  it('skips resources station cannot accept (canSellToStation ok:false)', async () => {
    m.getCargoState.mockResolvedValue({ ore: 5, gas: 3, crystal: 0, slates: 0, artefact: 0 });
    // ore rejected, gas accepted
    m.canSellToStation
      .mockResolvedValueOnce({ ok: false, price: 0, capacity: 0, effectiveAmount: 0 }) // ore
      .mockResolvedValueOnce({ ok: true, price: 30, capacity: 100, effectiveAmount: 3 }); // gas

    const r = await coreSell('u1', 'all');

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.credits).toBe(30);
    expect(m.removeFromInventory).toHaveBeenCalledTimes(1);
    expect(m.removeFromInventory).toHaveBeenCalledWith('u1', 'resource', 'gas', 3);
  });
});
