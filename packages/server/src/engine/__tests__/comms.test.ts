import { describe, it, expect } from 'vitest';
import { canCommunicate, euclideanDistance } from '../comms.js';

describe('euclideanDistance', () => {
  it('calculates distance between two points', () => {
    expect(euclideanDistance(0, 0, 3, 4)).toBe(5);
  });
  it('returns 0 for same point', () => {
    expect(euclideanDistance(5, 5, 5, 5)).toBe(0);
  });
});

describe('canCommunicate', () => {
  it('returns true within combined comm range', () => {
    expect(canCommunicate(
      { x: 0, y: 0, commRange: 50 },
      { x: 30, y: 40, commRange: 50 },
      []
    )).toBe(true);
  });

  it('returns false out of range and no relays', () => {
    expect(canCommunicate(
      { x: 0, y: 0, commRange: 50 },
      { x: 300, y: 400, commRange: 50 },
      []
    )).toBe(false);
  });

  it('returns true when relay chain connects', () => {
    expect(canCommunicate(
      { x: 0, y: 0, commRange: 50 },
      { x: 1000, y: 0, commRange: 50 },
      [
        { x: 200, y: 0, range: 500 },
        { x: 700, y: 0, range: 500 },
      ]
    )).toBe(true);
  });

  it('returns false with relay gap', () => {
    expect(canCommunicate(
      { x: 0, y: 0, commRange: 50 },
      { x: 5000, y: 0, commRange: 50 },
      [
        { x: 100, y: 0, range: 200 },
        { x: 4900, y: 0, range: 200 },
      ]
    )).toBe(false);
  });

  it('handles empty relay list', () => {
    expect(canCommunicate(
      { x: 0, y: 0, commRange: 100 },
      { x: 50, y: 0, commRange: 100 },
      []
    )).toBe(true);
  });
});
