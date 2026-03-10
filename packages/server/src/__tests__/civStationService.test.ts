import { describe, test, expect } from 'vitest';
import { getQuadrantCenter, shouldSpawnDrone } from '../engine/civStationService.js';

describe('getQuadrantCenter', () => {
  test('returns center of quadrant (0,0) with QUADRANT_SIZE=500', () => {
    expect(getQuadrantCenter(0, 0, 500)).toEqual({ x: 250, y: 250 });
  });

  test('returns center of quadrant (1,0)', () => {
    expect(getQuadrantCenter(1, 0, 500)).toEqual({ x: 750, y: 250 });
  });

  test('returns center of quadrant (2,3)', () => {
    expect(getQuadrantCenter(2, 3, 500)).toEqual({ x: 1250, y: 1750 });
  });
});

describe('shouldSpawnDrone', () => {
  test('returns true when count < max', () => {
    expect(shouldSpawnDrone(0, 3)).toBe(true);
    expect(shouldSpawnDrone(2, 3)).toBe(true);
  });

  test('returns false when count >= max', () => {
    expect(shouldSpawnDrone(3, 3)).toBe(false);
    expect(shouldSpawnDrone(4, 3)).toBe(false);
  });
});
