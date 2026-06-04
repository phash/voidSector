import { REFINERY_CREDITS_PER_TICK, SENSOR_SCAN_BONUS_PER_LEVEL } from '@void-sector/shared';

/** Passive credits produced per universe tick by a refinery of the given level. */
export function refineryCreditsPerTick(refineryLevel: number): number {
  return REFINERY_CREDITS_PER_TICK * refineryLevel;
}

/** Extra scan-range sectors granted by a station's sensor array. */
export function sensorScanBonus(sensorLevel: number): number {
  return SENSOR_SCAN_BONUS_PER_LEVEL * sensorLevel;
}
