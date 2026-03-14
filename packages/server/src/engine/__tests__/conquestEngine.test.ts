import { describe, it, expect } from 'vitest';
import {
  computeConquestRate,
  computeFrictionModifier,
  updateShares,
  hasAdjacentFactionControl,
} from '../conquestEngine.js';

describe('computeConquestRate', () => {
  it('level 1, no pool → 1.0', () => {
    expect(computeConquestRate(1, 0)).toBe(1.0);
  });
  it('level 1, pool > 0 → 1.5', () => {
    expect(computeConquestRate(1, 100)).toBe(1.5);
  });
  it('level 2, no pool → 1.1', () => {
    expect(computeConquestRate(2, 0)).toBe(1.1);
  });
  it('level 3, pool > 0 → 3.0', () => {
    expect(computeConquestRate(3, 100)).toBe(3.0);
  });
  it('unknown level falls back to level 1', () => {
    expect(computeConquestRate(99, 0)).toBe(1.0);
  });
});

describe('computeFrictionModifier', () => {
  it('no other faction → 1.0 (no modifier)', () => {
    expect(computeFrictionModifier(0, false)).toBe(1.0);
  });
  it('other faction, friction 0-20 (ALLY) → 0', () => {
    expect(computeFrictionModifier(10, true)).toBe(0);
  });
  it('other faction, friction 21-50 (NEUTRAL) → 0.5', () => {
    expect(computeFrictionModifier(35, true)).toBe(0.5);
  });
  it('other faction, friction 51-80 (HOSTILE) → 0.25', () => {
    expect(computeFrictionModifier(65, true)).toBe(0.25);
  });
  it('other faction, friction 81+ (ENEMY) → 0', () => {
    expect(computeFrictionModifier(90, true)).toBe(0);
  });
});

describe('updateShares', () => {
  it('neutral quadrant: fills own faction directly', () => {
    const result = updateShares({}, 'humans', 5);
    expect(result.shares['humans']).toBe(5);
  });
  it('caps at 100', () => {
    const result = updateShares({ humans: 98 }, 'humans', 5);
    expect(result.shares['humans']).toBe(100);
  });
  it('contested: reduces other faction proportionally', () => {
    const result = updateShares({ humans: 50, kthari: 50 }, 'humans', 10);
    expect(result.shares['humans']).toBeCloseTo(60);
    expect(result.shares['kthari']).toBeCloseTo(40);
  });
  it('removes faction at 0', () => {
    const result = updateShares({ humans: 95, kthari: 5 }, 'humans', 10);
    expect(result.shares['kthari']).toBeUndefined();
    expect(result.shares['humans']).toBe(100);
  });
  it('returns controlling faction (highest share)', () => {
    const result = updateShares({ humans: 40, kthari: 60 }, 'humans', 30);
    expect(result.controllingFaction).toBe('humans');
  });
  it('sum of shares always ≤ 100', () => {
    const result = updateShares({ humans: 60, kthari: 40 }, 'humans', 15);
    const total = Object.values(result.shares).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100.01);
  });
  it('three-faction: reduces others proportionally', () => {
    const result = updateShares({ humans: 33, kthari: 33, mycelians: 34 }, 'humans', 6);
    const total = Object.values(result.shares).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100.1);
    expect(result.shares['humans']).toBeCloseTo(39);
  });
  it('does not push own share above 100 when starting at 95', () => {
    const result = updateShares({ humans: 95 }, 'humans', 20);
    expect(result.shares['humans']).toBe(100);
  });
  it('handles missing own faction key gracefully', () => {
    const result = updateShares({ kthari: 80 }, 'humans', 10);
    expect(result.shares['humans']).toBe(10);
    expect(result.shares['kthari']).toBeCloseTo(70);
  });
});

describe('hasAdjacentFactionControl', () => {
  const makeCtrl = (qx: number, qy: number, shares: Record<string, number>) => ({
    qx, qy,
    controlling_faction: Object.keys(shares)[0] ?? 'humans',
    faction_shares: shares,
    attack_value: 0, defense_value: 0, friction_score: 0, station_tier: 1,
  }) as any;

  it('returns true when neighbor has >= 60%', () => {
    const controls = [makeCtrl(1, 0, { humans: 80 })];
    expect(hasAdjacentFactionControl(0, 0, 'humans', controls)).toBe(true);
  });

  it('returns false when no neighbor has >= 60%', () => {
    const controls = [makeCtrl(1, 0, { humans: 40 })];
    expect(hasAdjacentFactionControl(0, 0, 'humans', controls)).toBe(false);
  });

  it('returns false when no controls exist', () => {
    expect(hasAdjacentFactionControl(0, 0, 'humans', [])).toBe(false);
  });

  it('ignores the quadrant itself', () => {
    const controls = [makeCtrl(0, 0, { humans: 100 })];
    expect(hasAdjacentFactionControl(0, 0, 'humans', controls)).toBe(false);
  });

  it('checks diagonal neighbors', () => {
    const controls = [makeCtrl(1, 1, { humans: 70 })];
    expect(hasAdjacentFactionControl(0, 0, 'humans', controls)).toBe(true);
  });

  it('returns true at exactly 60%', () => {
    const controls = [makeCtrl(-1, 0, { humans: 60 })];
    expect(hasAdjacentFactionControl(0, 0, 'humans', controls)).toBe(true);
  });

  it('returns false at 59%', () => {
    const controls = [makeCtrl(-1, 0, { humans: 59 })];
    expect(hasAdjacentFactionControl(0, 0, 'humans', controls)).toBe(false);
  });
});
