import { describe, it, expect } from 'vitest';
import { generateSpawnPosition } from '../spawn.js';
import { SPAWN_MIN_DISTANCE } from '@void-sector/shared';

describe('generateSpawnPosition', () => {
  it('returns position at least SPAWN_MIN_DISTANCE from origin', () => {
    const pos = generateSpawnPosition();
    const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2);
    expect(dist).toBeGreaterThanOrEqual(SPAWN_MIN_DISTANCE);
  });

  it('returns integer coordinates', () => {
    const pos = generateSpawnPosition();
    expect(Number.isInteger(pos.x)).toBe(true);
    expect(Number.isInteger(pos.y)).toBe(true);
  });

  it('generates different positions on multiple calls', () => {
    const positions = Array.from({ length: 5 }, () => generateSpawnPosition());
    const unique = new Set(positions.map(p => `${p.x}:${p.y}`));
    expect(unique.size).toBeGreaterThan(1);
  });
});
