import { describe, it, expect } from 'vitest';
import { isFrontierQuadrant, shouldWakeAliens, expansionFrontierMax, getExpansionTarget } from '../expansionEngine.js';
import type { QuadrantControlRow } from '../../db/queries.js';

const ctrl = (qx: number, qy: number, f: string) =>
  ({ qx, qy, controlling_faction: f } as unknown as QuadrantControlRow);

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

describe('shouldWakeAliens', () => {
  it('wakes once a human reaches >=2 quadrants and not already awake', () => {
    expect(shouldWakeAliens(false, 2)).toBe(true);
    expect(shouldWakeAliens(false, 5)).toBe(true);
  });
  it('does not wake below the threshold', () => {
    expect(shouldWakeAliens(false, 1)).toBe(false);
  });
  it('does not re-wake when already awake', () => {
    expect(shouldWakeAliens(true, 9)).toBe(false);
  });
});

describe('expansionFrontierMax', () => {
  it('is the human frontier plus the margin', () => {
    expect(expansionFrontierMax(2)).toBe(7);
    expect(expansionFrontierMax(0)).toBe(5);
  });
});

describe('getExpansionTarget frontier bound', () => {
  const controls = [ctrl(3, 1, 'kthari')]; // home at distance 3
  it('rejects a target beyond the bound', () => {
    expect(getExpansionTarget('kthari', controls, 'sphere', 3)).toBeNull();
  });
  it('allows a target within the bound', () => {
    const t = getExpansionTarget('kthari', controls, 'sphere', 5);
    expect(t).not.toBeNull();
    expect(Math.max(Math.abs(t!.qx), Math.abs(t!.qy))).toBeLessThanOrEqual(5);
  });
  it('is unbounded when maxDistance is omitted (back-compat)', () => {
    expect(getExpansionTarget('kthari', controls, 'sphere')).not.toBeNull();
  });
});
