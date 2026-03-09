import { describe, it, expect } from 'vitest';
import { generateSpawnPosition } from '../spawn.js';

describe('generateSpawnPosition', () => {
  it('returns position within radius 5 of origin', () => {
    const pos = generateSpawnPosition();
    expect(pos.x).toBeGreaterThanOrEqual(1);
    expect(pos.x).toBeLessThanOrEqual(5);
    expect(pos.y).toBeGreaterThanOrEqual(1);
    expect(pos.y).toBeLessThanOrEqual(5);
  });

  it('returns integer coordinates', () => {
    const pos = generateSpawnPosition();
    expect(Number.isInteger(pos.x)).toBe(true);
    expect(Number.isInteger(pos.y)).toBe(true);
  });

  it('generates different positions on multiple calls', () => {
    const positions = Array.from({ length: 20 }, () => generateSpawnPosition());
    const unique = new Set(positions.map((p) => `${p.x}:${p.y}`));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('always produces positions within bounds even on repeated calls', () => {
    for (let i = 0; i < 100; i++) {
      const pos = generateSpawnPosition();
      expect(pos.x).toBeGreaterThanOrEqual(1);
      expect(pos.x).toBeLessThanOrEqual(5);
      expect(pos.y).toBeGreaterThanOrEqual(1);
      expect(pos.y).toBeLessThanOrEqual(5);
    }
  });
});
