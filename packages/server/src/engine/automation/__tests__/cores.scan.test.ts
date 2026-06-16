import { describe, it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({
  getPlayerPosition: vi.fn(), getAPState: vi.fn(), saveAPState: vi.fn(),
  getActiveShip: vi.fn(), getSector: vi.fn(), saveSector: vi.fn(), generateSector: vi.fn(), calculateShipStats: vi.fn(),
}));
vi.mock('../../../rooms/services/RedisAPStore.js', () => ({
  getPlayerPosition: m.getPlayerPosition, savePlayerPosition: vi.fn(),
  getAPState: m.getAPState, saveAPState: m.saveAPState, getFuelState: vi.fn(), saveFuelState: vi.fn(),
}));
vi.mock('../../ap.js', () => ({ calculateCurrentAP: (ap: any) => ap }));
vi.mock('../../../db/queries.js', () => ({ getActiveShip: m.getActiveShip, getSector: m.getSector, saveSector: m.saveSector, addDiscovery: vi.fn(), updateSectorResources: vi.fn() }));
vi.mock('../../worldgen.js', () => ({ generateSector: m.generateSector }));
vi.mock('@void-sector/shared', () => ({ calculateShipStats: m.calculateShipStats }));
vi.mock('../../inventoryService.js', () => ({ getCargoState: vi.fn(), getResourceTotal: vi.fn(), addToInventory: vi.fn(), removeFromInventory: vi.fn() }));
import { coreScan } from '../cores.js';
beforeEach(() => {
  vi.clearAllMocks();
  m.getPlayerPosition.mockResolvedValue({ x: 1, y: 1 });
  m.getActiveShip.mockResolvedValue({ modules: [] });
  m.calculateShipStats.mockReturnValue({ scannerLevel: 1 });
  m.getAPState.mockResolvedValue({ current: 100, max: 100, lastTick: 0, regenPerSecond: 1 });
  m.getSector.mockResolvedValue({ x: 1, y: 1, type: 'asteroid', resources: { ore: 50, gas: 0, crystal: 0 } });
});
describe('coreScan', () => {
  it('spends AP and returns the current sector resources', async () => {
    const r = await coreScan('u1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resources.ore).toBe(50);
    expect(m.saveAPState).toHaveBeenCalled();
  });
  it('pauses when AP insufficient', async () => {
    m.getAPState.mockResolvedValue({ current: 0, max: 100, lastTick: 0, regenPerSecond: 1 });
    const r = await coreScan('u1');
    expect(r.ok).toBe(false);
  });
});
