import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

vi.mock('../engine/inventoryService.js', () => ({
  getResourceTotal: vi.fn().mockResolvedValue(0),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
  addToInventory: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../db/queries.js', () => ({
  getSector: vi.fn().mockResolvedValue({ resources: { ore: 50, gas: 0, crystal: 0 }, contents: [], type: 'asteroid_field', environment: 'normal' }),
}));
vi.mock('../engine/commands.js', () => ({
  validateMine: vi.fn().mockReturnValue({
    valid: true,
    state: { active: true, resource: 'ore', sectorX: 1, sectorY: 1, startedAt: Date.now(), rate: 1, sectorYield: 50 },
  }),
}));
vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getMiningState: vi.fn().mockResolvedValue({ active: false }),
  saveMiningState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../engine/acepXpService.js', () => ({
  addAcepXpForPlayer: vi.fn().mockResolvedValue(undefined),
}));

import { MiningService } from '../rooms/services/MiningService.js';

function makeClient(userId = 'u1'): Client {
  return {
    sessionId: 's1',
    auth: { userId, username: 'TestPilot', role: 'player' },
    send: vi.fn(),
  } as unknown as Client;
}

describe('MiningService mining rate includes miningBonus', () => {
  it('rate includes ship miningBonus (e.g. 0.5 from mining_mk3)', async () => {
    const ctx = {
      checkRate: vi.fn().mockReturnValue(true),
      _px: vi.fn().mockReturnValue(1),
      _py: vi.fn().mockReturnValue(1),
      _pst: vi.fn().mockReturnValue('asteroid_field'),
      getShipForClient: vi.fn().mockReturnValue({ cargoCap: 50, miningBonus: 0.5 }),
      getPlayerBonuses: vi.fn().mockResolvedValue({ miningRateMultiplier: 1 }),
    } as any;

    const svc = new MiningService(ctx);
    const client = makeClient();
    const { saveMiningState } = await import('../rooms/services/RedisAPStore.js');

    await svc.handleMine(client, { resource: 'ore' });

    // rate should be 1 * (1 + 0.5) * 1 = 1.5
    const savedState = vi.mocked(saveMiningState).mock.calls[0]?.[1];
    expect(savedState?.rate).toBeCloseTo(1.5);
  });

  it('rate is 1 when miningBonus is 0 (no module)', async () => {
    const ctx = {
      checkRate: vi.fn().mockReturnValue(true),
      _px: vi.fn().mockReturnValue(1),
      _py: vi.fn().mockReturnValue(1),
      _pst: vi.fn().mockReturnValue('asteroid_field'),
      getShipForClient: vi.fn().mockReturnValue({ cargoCap: 50, miningBonus: 0 }),
      getPlayerBonuses: vi.fn().mockResolvedValue({ miningRateMultiplier: 1 }),
    } as any;

    const svc = new MiningService(ctx);
    const client = makeClient();
    const { saveMiningState } = await import('../rooms/services/RedisAPStore.js');

    await svc.handleMine(client, { resource: 'ore' });

    const savedState = vi.mocked(saveMiningState).mock.calls[0]?.[1];
    expect(savedState?.rate).toBeCloseTo(1.0);
  });
});
