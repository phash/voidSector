import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/queries.js', () => ({
  getCivTotal: vi.fn(),
  addCivPoints: vi.fn(),
}));

import { getCivMeterState, recordCivContribution } from '../civilizationMeter.js';
import { getCivTotal, addCivPoints } from '../../db/queries.js';

describe('civilizationMeter service (SP8)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getCivMeterState derives level + tier from the persisted total', async () => {
    vi.mocked(getCivTotal).mockResolvedValue(0);
    expect(await getCivMeterState()).toEqual({ total: 0, level: 0, tier: 'PIONIERPHASE' });

    // HUMAN_CIVILIZATION_METER_MAX = 10000 → 5000 = 50% = WELTRAUMFAHREND
    vi.mocked(getCivTotal).mockResolvedValue(5000);
    const mid = await getCivMeterState();
    expect(mid.level).toBeCloseTo(0.5);
    expect(mid.tier).toBe('WELTRAUMFAHRENDE ZIVILISATION');
  });

  it('level is clamped to 1.0 above the max', async () => {
    vi.mocked(getCivTotal).mockResolvedValue(99999);
    const s = await getCivMeterState();
    expect(s.level).toBe(1);
    expect(s.tier).toBe('INTERSTELLARE MACHT');
  });

  it('recordCivContribution adds the action value × count and returns new state', async () => {
    vi.mocked(addCivPoints).mockResolvedValue(50);
    const s = await recordCivContribution('station_built'); // worth 50
    expect(vi.mocked(addCivPoints)).toHaveBeenCalledWith(50);
    expect(s.total).toBe(50);
  });

  it('recordCivContribution multiplies by count (bulk territory)', async () => {
    vi.mocked(addCivPoints).mockResolvedValue(7);
    await recordCivContribution('territory_explored', 7); // 1 pt each × 7
    expect(vi.mocked(addCivPoints)).toHaveBeenCalledWith(7);
  });
});
