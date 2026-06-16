import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  getPlayerPosition: vi.fn(), savePlayerPosition: vi.fn(),
  getAPState: vi.fn(), saveAPState: vi.fn(), getFuelState: vi.fn(), saveFuelState: vi.fn(),
  getActiveShip: vi.fn(), getSector: vi.fn(), saveSector: vi.fn(), addDiscovery: vi.fn(),
  updateSectorResources: vi.fn(), generateSector: vi.fn(), calculateShipStats: vi.fn(),
  getCargoState: vi.fn(), getResourceTotal: vi.fn(), addToInventory: vi.fn(), removeFromInventory: vi.fn(),
}));
vi.mock('../../../rooms/services/RedisAPStore.js', () => ({
  getPlayerPosition: m.getPlayerPosition, savePlayerPosition: m.savePlayerPosition,
  getAPState: m.getAPState, saveAPState: m.saveAPState,
  getFuelState: m.getFuelState, saveFuelState: m.saveFuelState,
}));
vi.mock('../../ap.js', () => ({ calculateCurrentAP: (ap: any) => ap }));
vi.mock('../../../db/queries.js', () => ({
  getActiveShip: m.getActiveShip, getSector: m.getSector, saveSector: m.saveSector,
  addDiscovery: m.addDiscovery, updateSectorResources: m.updateSectorResources,
}));
vi.mock('../../worldgen.js', () => ({ generateSector: m.generateSector }));
vi.mock('@void-sector/shared', () => ({ calculateShipStats: m.calculateShipStats }));
vi.mock('../../inventoryService.js', () => ({
  getCargoState: m.getCargoState, getResourceTotal: m.getResourceTotal,
  addToInventory: m.addToInventory, removeFromInventory: m.removeFromInventory,
}));

import { coreMoveOneSector } from '../cores.js';

beforeEach(() => {
  vi.clearAllMocks();
  m.getActiveShip.mockResolvedValue({ modules: [] });
  m.calculateShipStats.mockReturnValue({ apCostJump: 1, fuelPerJump: 10, cargoCap: 20, scannerLevel: 1 });
  m.getAPState.mockResolvedValue({ current: 100, max: 100, lastTick: 0, regenPerSecond: 1 });
  m.getFuelState.mockResolvedValue(1000);
  m.getSector.mockResolvedValue({ x: 1, y: 0, type: 'empty', resources: { ore: 0, gas: 0, crystal: 0 } });
});

describe('coreMoveOneSector', () => {
  it('steps one sector toward the target and spends AP+fuel', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 0, y: 0 });
    const r = await coreMoveOneSector('u1', 3, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.x).toBe(1); expect(r.y).toBe(0); expect(r.arrived).toBe(false);
    expect(m.savePlayerPosition).toHaveBeenCalledWith('u1', 1, 0);
    expect(m.saveAPState).toHaveBeenCalled();
    expect(m.saveFuelState).toHaveBeenCalledWith('u1', 990);
  });
  it('reports arrived when the step reaches the target', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 2, y: 0 });
    const r = await coreMoveOneSector('u1', 3, 0);
    expect(r.ok && r.arrived).toBe(true);
  });
  it('pauses (ok:false) when AP is insufficient', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 0, y: 0 });
    m.getAPState.mockResolvedValue({ current: 0, max: 100, lastTick: 0, regenPerSecond: 1 });
    const r = await coreMoveOneSector('u1', 3, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/AP/i);
  });
  it('pauses when fuel is insufficient', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 0, y: 0 });
    m.getFuelState.mockResolvedValue(5);
    const r = await coreMoveOneSector('u1', 3, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/treibstoff/i);
  });
  it('is a no-op arrival when already at the target', async () => {
    m.getPlayerPosition.mockResolvedValue({ x: 3, y: 0 });
    const r = await coreMoveOneSector('u1', 3, 0);
    expect(r.ok && r.arrived).toBe(true);
    expect(m.savePlayerPosition).not.toHaveBeenCalled();
  });
});
