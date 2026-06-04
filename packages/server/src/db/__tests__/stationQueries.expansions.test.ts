import { describe, it, expect } from 'vitest';
import { expansionLevelColumn, type PlayerStationRow } from '../stationQueries.js';

describe('PlayerStationRow expansion fields', () => {
  it('row type carries the new columns', () => {
    const row: PlayerStationRow = {
      id: 'x', owner_id: 'o', sector_x: 1, sector_y: 2, quadrant_x: 0, quadrant_y: 0,
      level: 1, factory_level: 0, cargo_level: 0, cargo_contents: {},
      trade_volume: 0, markt_level: 0, werft_level: 0, refinery_level: 0, sensor_level: 0,
      building_expansion: null, build_complete_at: null, created_at: 'now',
    };
    expect(row.markt_level).toBe(0);
  });
});

describe('expansionLevelColumn', () => {
  it('returns the level column for valid expansion types', () => {
    expect(expansionLevelColumn('markt')).toBe('markt_level');
    expect(expansionLevelColumn('werft')).toBe('werft_level');
  });
  it('throws on a value outside the allowlist (SQL-injection guard)', () => {
    // @ts-expect-error deliberately invalid value to exercise the runtime guard
    expect(() => expansionLevelColumn('sectors; DROP TABLE players;--')).toThrow(/Invalid station expansion type/);
  });
});
