import { describe, it, expect } from 'vitest';
import { generateDistressMessage } from '../distressStories.js';

describe('generateDistressMessage', () => {
  it('returns a non-empty string', () => {
    expect(generateDistressMessage(10, 20, 12345).length).toBeGreaterThan(10);
  });
  it('is deterministic', () => {
    expect(generateDistressMessage(5, 5, 999)).toBe(generateDistressMessage(5, 5, 999));
  });
  it('includes sector coordinates', () => {
    const msg = generateDistressMessage(42, -7, 1111);
    expect(msg).toMatch(/42/);
    expect(msg).toMatch(/-7/);
  });
  it('varies with different seeds', () => {
    const a = generateDistressMessage(0, 0, 1);
    const b = generateDistressMessage(0, 0, 10000);
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });
});
