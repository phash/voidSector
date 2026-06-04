import {
  REFINERY_CREDITS_PER_TICK, SENSOR_SCAN_BONUS_PER_LEVEL,
  REFINERY_GAS_PER_TICK, REFINERY_FUEL_PER_GAS, REFINERY_FUEL_MAX,
  SENSOR_PIRATE_REDUCTION_PER_LEVEL, SENSOR_PIRATE_REDUCTION_MAX,
} from '@void-sector/shared';

/** Passive credits produced per universe tick by a refinery of the given level. */
export function refineryCreditsPerTick(refineryLevel: number): number {
  return REFINERY_CREDITS_PER_TICK * refineryLevel;
}

/** Extra scan-range sectors granted by a station's sensor array. */
export function sensorScanBonus(sensorLevel: number): number {
  return SENSOR_SCAN_BONUS_PER_LEVEL * sensorLevel;
}

/**
 * Convert a station's stored gas into stored fuel (cargo_contents) for one tick.
 * Pure: returns a new cargo object, never mutates the input.
 */
export function refineGasToFuel(
  cargo: Record<string, number>,
  refineryLevel: number,
): Record<string, number> {
  if (refineryLevel <= 0) return { ...cargo };
  const gas = cargo.gas ?? 0;
  const fuel = cargo.fuel ?? 0;
  const fuelRoom = Math.max(0, REFINERY_FUEL_MAX - fuel);
  const gasWanted = Math.min(gas, REFINERY_GAS_PER_TICK * refineryLevel);
  const actualFuel = Math.min(gasWanted * REFINERY_FUEL_PER_GAS, fuelRoom);
  const actualGas = Math.ceil(actualFuel / REFINERY_FUEL_PER_GAS);
  if (actualFuel <= 0) return { ...cargo };
  return { ...cargo, gas: gas - actualGas, fuel: fuel + actualFuel };
}

/** True if the sensor array lets the player avoid (make optional) a pirate_zone fight this entry. */
export function pirateCombatAvoidable(sensorLevel: number, roll: number): boolean {
  if (sensorLevel <= 0) return false;
  const chance = Math.min(SENSOR_PIRATE_REDUCTION_MAX, SENSOR_PIRATE_REDUCTION_PER_LEVEL * sensorLevel);
  return roll < chance;
}

/** Fuel a ship can take from a station: min of remaining tank space and station fuel stock. */
export function stationRefuelAmount(tankSpace: number, stationFuel: number): number {
  return Math.max(0, Math.min(tankSpace, stationFuel));
}
