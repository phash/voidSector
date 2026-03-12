import {
  STATION_FUEL_BASELINE_PER_TICK,
  STATION_FUEL_GAS_RATE_PER_TICK,
  STATION_FUEL_PER_GAS,
  STATION_FUEL_MAX_STOCK,
  STATION_FUEL_LEVEL_EFFICIENCY,
} from '@void-sector/shared';
import {
  getAllStationsForFuelProduction,
  getStationFuelAndGas,
  updateStationFuelStock,
  consumeStationGas,
} from '../db/npcStationQueries.js';

export interface FuelProductionInput {
  gasStock: number;
  fuelStock: number;
  maxFuelStock: number;
  stationLevel: number;
}

export interface FuelProductionResult {
  fuelToAdd: number;
  gasToConsume: number;
}

/** Pure calculation — no DB calls. */
export function calculateFuelProduction(input: FuelProductionInput): FuelProductionResult {
  const { gasStock, fuelStock, maxFuelStock, stationLevel } = input;
  const space = maxFuelStock - fuelStock;
  if (space <= 0) return { fuelToAdd: 0, gasToConsume: 0 };

  const efficiency = STATION_FUEL_LEVEL_EFFICIENCY[stationLevel] ?? 1.0;
  const hasGas = gasStock >= STATION_FUEL_PER_GAS;

  const rawFuel = hasGas
    ? Math.round(STATION_FUEL_GAS_RATE_PER_TICK * efficiency)
    : STATION_FUEL_BASELINE_PER_TICK;

  return {
    fuelToAdd: Math.min(rawFuel, space),
    gasToConsume: hasGas ? STATION_FUEL_PER_GAS : 0,
  };
}

/** Runs one production tick across all known stations. */
export async function runStationFuelProductionTick(): Promise<void> {
  const stations = await getAllStationsForFuelProduction();
  await Promise.all(
    stations.map(async (station) => {
      const { fuel, gas } = await getStationFuelAndGas(station.x, station.y);
      const { fuelToAdd, gasToConsume } = calculateFuelProduction({
        gasStock: gas,
        fuelStock: fuel,
        maxFuelStock: STATION_FUEL_MAX_STOCK,
        stationLevel: station.level,
      });
      if (fuelToAdd > 0) {
        await updateStationFuelStock(station.x, station.y, fuel + fuelToAdd, STATION_FUEL_MAX_STOCK);
      }
      if (gasToConsume > 0) {
        await consumeStationGas(station.x, station.y, gasToConsume);
      }
    }),
  );
}
