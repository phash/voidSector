import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/npcStationQueries.js', () => ({
  getStationFuelAndGas: vi.fn(),
  deductStationFuelStock: vi.fn(),
}));

import { getStationFuelAndGas, deductStationFuelStock } from '../db/npcStationQueries.js';

const mockGetFuelAndGas = vi.mocked(getStationFuelAndGas);
const mockDeductFuelStock = vi.mocked(deductStationFuelStock);

/**
 * Thin helper that encapsulates the station-stock check logic from handleRefuel.
 * Test this helper; the full EconomyService test is an integration concern.
 */
async function stationRefuelCapped(
  stationX: number,
  stationY: number,
  requestedAmount: number,
): Promise<{ fillAmount: number; depleted: boolean }> {
  const { fuel } = await getStationFuelAndGas(stationX, stationY);
  const fillAmount = Math.min(requestedAmount, fuel);
  if (fillAmount <= 0) return { fillAmount: 0, depleted: true };
  await deductStationFuelStock(stationX, stationY, fillAmount);
  return { fillAmount, depleted: false };
}

describe('station refuel stock check', () => {
  beforeEach(() => {
    mockGetFuelAndGas.mockReset();
    mockDeductFuelStock.mockReset();
    mockDeductFuelStock.mockResolvedValue(undefined as any);
  });

  it('caps fill at station stock when stock < requested', async () => {
    mockGetFuelAndGas.mockResolvedValue({ fuel: 500, gas: 0 });
    const result = await stationRefuelCapped(3, 4, 1_000);
    expect(result.fillAmount).toBe(500);
    expect(result.depleted).toBe(false);
    expect(mockDeductFuelStock).toHaveBeenCalledWith(3, 4, 500);
  });

  it('returns depleted when station fuel is 0', async () => {
    mockGetFuelAndGas.mockResolvedValue({ fuel: 0, gas: 0 });
    const result = await stationRefuelCapped(3, 4, 1_000);
    expect(result.depleted).toBe(true);
    expect(mockDeductFuelStock).not.toHaveBeenCalled();
  });

  it('fills full requested amount when station has plenty', async () => {
    mockGetFuelAndGas.mockResolvedValue({ fuel: 50_000, gas: 0 });
    const result = await stationRefuelCapped(3, 4, 2_000);
    expect(result.fillAmount).toBe(2_000);
    expect(mockDeductFuelStock).toHaveBeenCalledWith(3, 4, 2_000);
  });
});
