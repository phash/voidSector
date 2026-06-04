import { describe, it, expect } from 'vitest';
import { toCivShip, type StationMiningShipRow } from '../stationMiningQueries.js';

const row: StationMiningShipRow = {
  id: 7, station_id: 'st', owner_id: 'ow', state: 'exploring',
  x: 10, y: 20, home_x: 5, home_y: 5, target_x: null, target_y: null,
  spiral_step: 3, resources_carried: 0, mined_resource: null, created_at: 'now',
};

describe('toCivShip', () => {
  it('maps a station mining ship row to a CivShip drone', () => {
    const cs = toCivShip(row);
    expect(cs.id).toBe(7);
    expect(cs.faction).toBe('humans');
    expect(cs.ship_type).toBe('mining_drone');
    expect(cs.role).toBe('drone');
    expect(cs.state).toBe('exploring');
    expect(cs.x).toBe(10);
    expect(cs.home_x).toBe(5);
    expect(cs.target_x).toBeUndefined(); // null → undefined
    expect(cs.spiral_step).toBe(3);
  });
});
