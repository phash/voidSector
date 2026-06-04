import { MAX_STATION_LEVEL, type StationExpansionType } from '@void-sector/shared';

/** Minimal station shape needed for build validation. */
export interface StationLevels {
  level: number;
  factory_level: number;
  cargo_level: number;
  markt_level: number;
  werft_level: number;
  refinery_level: number;
  sensor_level: number;
  building_expansion: string | null;
}

export type BuildValidation =
  | { ok: true; targetLevel: number }
  | { ok: false; code: 'BUSY' | 'TIER_LOCKED' | 'MAX_LEVEL'; message: string };

export function currentExpansionLevel(station: StationLevels, type: StationExpansionType): number {
  return station[`${type}_level` as keyof StationLevels] as number;
}

/** Validate that an expansion can be built one level higher right now. */
export function validateExpansionBuild(
  station: StationLevels,
  type: StationExpansionType,
): BuildValidation {
  if (station.building_expansion) {
    return { ok: false, code: 'BUSY', message: 'Station baut bereits eine Erweiterung' };
  }
  const current = currentExpansionLevel(station, type);
  const targetLevel = current + 1;
  if (current >= MAX_STATION_LEVEL) {
    return { ok: false, code: 'MAX_LEVEL', message: 'Erweiterung ist auf Maximalstufe' };
  }
  if (targetLevel > station.level) {
    return {
      ok: false,
      code: 'TIER_LOCKED',
      message: `Stations-Stufe (${station.level}) zu niedrig — mehr Handel nötig`,
    };
  }
  return { ok: true, targetLevel };
}
