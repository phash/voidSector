/**
 * Tests for TerritoryService logic — deterministic, no DB needed.
 */
import { describe, it, expect } from 'vitest';

// ── Mirror of K'thari territory detection ──

const KTHARI_MIN_CHEBYSHEV = 800;

function isKthariTerritory(quadrantX: number, quadrantY: number): boolean {
  const chebyshev = Math.max(Math.abs(quadrantX), Math.abs(quadrantY));
  return chebyshev >= KTHARI_MIN_CHEBYSHEV;
}

// ── Mirror of defense rating assignment ──

function getDefenseRating(quadrantX: number, quadrantY: number): 'HIGH' | 'LOW' {
  return isKthariTerritory(quadrantX, quadrantY) ? 'HIGH' : 'LOW';
}

// ── Mirror of win-chance calculation ──

function getAttackerWinChance(defenseRating: string): number {
  return defenseRating === 'HIGH' ? 0.25 : 0.5;
}

describe('territory — K\'thari detection', () => {
  it('returns false for origin quadrant (0,0)', () => {
    expect(isKthariTerritory(0, 0)).toBe(false);
  });

  it('returns false for near-origin quadrants', () => {
    expect(isKthariTerritory(100, 200)).toBe(false);
    expect(isKthariTerritory(799, 0)).toBe(false);
    expect(isKthariTerritory(0, 799)).toBe(false);
  });

  it('returns true at exactly the threshold', () => {
    expect(isKthariTerritory(800, 0)).toBe(true);
    expect(isKthariTerritory(0, 800)).toBe(true);
    expect(isKthariTerritory(800, 800)).toBe(true);
  });

  it('returns true well beyond the threshold', () => {
    expect(isKthariTerritory(5000, 1000)).toBe(true);
    expect(isKthariTerritory(9999, 9999)).toBe(true);
  });

  it('uses Chebyshev distance (max of both axes)', () => {
    // One axis is high, one is low — Chebyshev = high axis
    expect(isKthariTerritory(800, 1)).toBe(true);
    expect(isKthariTerritory(1, 800)).toBe(true);
    expect(isKthariTerritory(799, 799)).toBe(false);
  });
});

describe('territory — defense rating', () => {
  it('assigns LOW rating to non-K\'thari quadrants', () => {
    expect(getDefenseRating(0, 0)).toBe('LOW');
    expect(getDefenseRating(100, 500)).toBe('LOW');
  });

  it('assigns HIGH rating to K\'thari quadrants', () => {
    expect(getDefenseRating(800, 0)).toBe('HIGH');
    expect(getDefenseRating(9000, 9000)).toBe('HIGH');
  });
});

describe('territory — attacker win chance', () => {
  it('LOW defense gives 50% chance', () => {
    expect(getAttackerWinChance('LOW')).toBe(0.5);
  });

  it('HIGH defense gives 25% chance', () => {
    expect(getAttackerWinChance('HIGH')).toBe(0.25);
  });

  it('HIGH defense is harder than LOW defense', () => {
    expect(getAttackerWinChance('HIGH')).toBeLessThan(getAttackerWinChance('LOW'));
  });
});
