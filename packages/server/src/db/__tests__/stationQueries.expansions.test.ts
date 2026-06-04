import { describe, it, expect } from 'vitest';
import { emptyExpansionLevels, type PlayerStationRow } from '../stationQueries.js';

describe('PlayerStationRow expansion fields', () => {
  it('emptyExpansionLevels returns all six expansion levels at 0', () => {
    expect(emptyExpansionLevels()).toEqual({
      factory: 0, cargo: 0, markt: 0, werft: 0, refinery: 0, sensor: 0,
    });
  });

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
