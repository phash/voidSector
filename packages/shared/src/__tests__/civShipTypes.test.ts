import { test, expect } from 'vitest';
import { CIV_DRONE_RADIUS } from '../constants';
import type { CivShip, CivStation } from '../types';

test('CIV_DRONE_RADIUS is a positive number', () => {
  expect(CIV_DRONE_RADIUS).toBeGreaterThan(0);
});

test('CivShip type has required fields', () => {
  const ship: CivShip = {
    id: 1,
    faction: 'archivists',
    ship_type: 'mining_drone',
    state: 'idle',
    x: 100,
    y: 200,
    home_x: 100,
    home_y: 200,
  };
  expect(ship.id).toBe(1);
});
