import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateFuelProduction, runStationFuelProductionTick } from '../stationFuelEngine.js';

vi.mock('../../db/npcStationQueries.js', () => ({
  getAllStationsForFuelProduction: vi.fn(),
  getStationFuelAndGas: vi.fn(),
  updateStationFuelStock: vi.fn(),
  consumeStationGas: vi.fn(),
}));

import {
  getAllStationsForFuelProduction,
  getStationFuelAndGas,
  updateStationFuelStock,
  consumeStationGas,
} from '../../db/npcStationQueries.js';

describe('calculateFuelProduction', () => {
  it('produces baseline fuel when no gas', () => {
    const { fuelToAdd, gasToConsume } = calculateFuelProduction({
      gasStock: 0,
      fuelStock: 0,
      maxFuelStock: 50_000,
      stationLevel: 1,
    });
    expect(fuelToAdd).toBe(10);
    expect(gasToConsume).toBe(0);
  });

  it('produces gas-enhanced fuel when gas available', () => {
    const { fuelToAdd, gasToConsume } = calculateFuelProduction({
      gasStock: 5,
      fuelStock: 0,
      maxFuelStock: 50_000,
      stationLevel: 1,
    });
    expect(fuelToAdd).toBe(100);
    expect(gasToConsume).toBe(1);
  });

  it('level 2 produces 120 fuel per gas', () => {
    const { fuelToAdd, gasToConsume } = calculateFuelProduction({
      gasStock: 5,
      fuelStock: 0,
      maxFuelStock: 50_000,
      stationLevel: 2,
    });
    expect(fuelToAdd).toBe(120);
    expect(gasToConsume).toBe(1);
  });

  it('caps production at remaining tank space', () => {
    const { fuelToAdd } = calculateFuelProduction({
      gasStock: 0,
      fuelStock: 49_998,
      maxFuelStock: 50_000,
      stationLevel: 1,
    });
    expect(fuelToAdd).toBe(2); // only 2 space left
  });

  it('produces nothing when tank is full', () => {
    const { fuelToAdd, gasToConsume } = calculateFuelProduction({
      gasStock: 10,
      fuelStock: 50_000,
      maxFuelStock: 50_000,
      stationLevel: 1,
    });
    expect(fuelToAdd).toBe(0);
    expect(gasToConsume).toBe(0);
  });

  it('caps gas-enhanced production at remaining tank space', () => {
    const { fuelToAdd, gasToConsume } = calculateFuelProduction({
      gasStock: 5,
      fuelStock: 49_995,
      maxFuelStock: 50_000,
      stationLevel: 1, // gas rate = 100, space = 5
    });
    expect(fuelToAdd).toBe(5); // capped at remaining space
    expect(gasToConsume).toBe(1); // gas still consumed when gas path is chosen
  });
});

describe('runStationFuelProductionTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls updateStationFuelStock when fuel was added', async () => {
    vi.mocked(getAllStationsForFuelProduction).mockResolvedValue([{ x: 1, y: 2, level: 1 }]);
    vi.mocked(getStationFuelAndGas).mockResolvedValue({ fuel: 0, gas: 0 });
    vi.mocked(updateStationFuelStock).mockResolvedValue(undefined);
    vi.mocked(consumeStationGas).mockResolvedValue(undefined);

    await runStationFuelProductionTick();

    // baseline: 10 fuel/tick → updateStationFuelStock called with 10
    expect(updateStationFuelStock).toHaveBeenCalledWith(1, 2, 10, 50_000);
    expect(consumeStationGas).not.toHaveBeenCalled();
  });

  it('skips updateStationFuelStock when tank is full', async () => {
    vi.mocked(getAllStationsForFuelProduction).mockResolvedValue([{ x: 1, y: 2, level: 1 }]);
    vi.mocked(getStationFuelAndGas).mockResolvedValue({ fuel: 50_000, gas: 0 });
    vi.mocked(updateStationFuelStock).mockResolvedValue(undefined);

    await runStationFuelProductionTick();

    expect(updateStationFuelStock).not.toHaveBeenCalled();
  });
});
