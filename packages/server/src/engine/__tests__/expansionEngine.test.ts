import { describe, it, expect } from 'vitest';
import { isFrontierQuadrant } from '../expansionEngine.js';
import type { QuadrantControlRow } from '../../db/queries.js';

function row(qx: number, qy: number, faction = 'human'): QuadrantControlRow {
  return {
    qx, qy,
    controlling_faction: faction,
    faction_shares: { [faction]: 100 },
    attack_value: 0,
    defense_value: 0,
    friction_score: 0,
    station_tier: 1,
    last_strategic_tick: new Date().toISOString(),
  } as QuadrantControlRow;
}

describe('isFrontierQuadrant', () => {
  it('returns false when all 8 neighbors are controlled (deep interior)', () => {
    const controls = [
      row(0, 0),
      row(-1,-1), row(0,-1), row(1,-1),
      row(-1, 0),             row(1, 0),
      row(-1, 1), row(0, 1), row(1, 1),
    ];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(false);
  });

  it('returns true with exactly 1 empty neighbor', () => {
    const controls = [
      row(0, 0),
      row(-1,-1), row(0,-1), row(1,-1),
      row(-1, 0),             row(1, 0),
      row(-1, 1), row(0, 1),
      // (1,1) fehlt → 1 empty neighbor
    ];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(true);
  });

  it('returns true with 5 empty neighbors', () => {
    const controls = [
      row(0, 0),
      row(-1,-1), row(0,-1), row(1,-1),
    ];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(true);
  });

  it('returns false with 6 empty neighbors (deep wilderness)', () => {
    const controls = [
      row(0, 0),
      row(-1,-1), row(0,-1),
    ];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(false);
  });

  it('returns false with 8 empty neighbors (completely isolated)', () => {
    const controls = [row(0, 0)];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(false);
  });

  it('does not count the quadrant itself as a neighbor', () => {
    const controls = [
      row(0, 0),
      row(-1,-1), row(0,-1), row(1,-1),
      row(-1, 0), row(1, 0),
    ];
    expect(isFrontierQuadrant(0, 0, controls)).toBe(true);
  });
});
