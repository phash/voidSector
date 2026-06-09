import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyShip,
  TRAIL_MAX_POINTS,
  TRAIL_TICK_MS,
  TRAIL_MAX_TICKS,
  TRAIL_TTL_MS,
  TRAIL_COLORS,
  radarTrailManager,
} from '../radarTrailManager';
import type { TrailEntry } from '../radarTrailManager';

// ── classifyShip ──────────────────────────────────────────────────────────────

describe('classifyShip', () => {
  it('returns player for isPlayer=true', () => {
    expect(classifyShip({ isPlayer: true })).toBe('player');
  });

  it('returns player even if role is also set', () => {
    expect(classifyShip({ isPlayer: true, role: 'trader' })).toBe('player');
  });

  it('returns trader for role=trader', () => {
    expect(classifyShip({ role: 'trader' })).toBe('trader');
  });

  it('returns combat for role=military', () => {
    expect(classifyShip({ role: 'military' })).toBe('combat');
  });

  it('returns combat for role=outlaw', () => {
    expect(classifyShip({ role: 'outlaw' })).toBe('combat');
  });

  it('returns unidentified for role=drone', () => {
    expect(classifyShip({ role: 'drone' })).toBe('unidentified');
  });

  it('returns unidentified for role=explorer', () => {
    expect(classifyShip({ role: 'explorer' })).toBe('unidentified');
  });

  it('returns unidentified when no role is given', () => {
    expect(classifyShip({})).toBe('unidentified');
  });

  it('returns unidentified for undefined role', () => {
    expect(classifyShip({ role: undefined })).toBe('unidentified');
  });
});

// ── constants ─────────────────────────────────────────────────────────────────

describe('trail constants', () => {
  it('TRAIL_MAX_POINTS = 5', () => expect(TRAIL_MAX_POINTS).toBe(5));
  it('TRAIL_TICK_MS = 2000', () => expect(TRAIL_TICK_MS).toBe(2000));
  it('TRAIL_MAX_TICKS = 5', () => expect(TRAIL_MAX_TICKS).toBe(5));
  it('TRAIL_TTL_MS = 10000', () => expect(TRAIL_TTL_MS).toBe(10_000));

  it('TRAIL_COLORS has correct hex values', () => {
    expect(TRAIL_COLORS.player).toBe('#3399FF');
    expect(TRAIL_COLORS.trader).toBe('#00FF66');
    expect(TRAIL_COLORS.combat).toBe('#FF4444');
    expect(TRAIL_COLORS.unidentified).toBe('#FFFFFF');
  });
});

// ── radarTrailManager.observe ─────────────────────────────────────────────────

describe('radarTrailManager.observe', () => {
  beforeEach(() => {
    radarTrailManager.clear();
  });

  const baseNow = 100_000;

  function makeEntry(key: string, x: number, y: number): TrailEntry {
    return { key, x, y, kind: 'player' };
  }

  it('adds a point on first observe', () => {
    radarTrailManager.observe([makeEntry('a', 1, 2)], baseNow);
    const trails = radarTrailManager.getTrails(baseNow);
    expect(trails).toHaveLength(1);
    expect(trails[0].key).toBe('a');
    expect(trails[0].points).toHaveLength(1);
    expect(trails[0].points[0]).toMatchObject({ x: 1, y: 2 });
  });

  it('does NOT add a duplicate point when (x,y) unchanged', () => {
    radarTrailManager.observe([makeEntry('a', 1, 2)], baseNow);
    radarTrailManager.observe([makeEntry('a', 1, 2)], baseNow + 1000);
    const trails = radarTrailManager.getTrails(baseNow + 1000);
    expect(trails[0].points).toHaveLength(1);
  });

  it('adds a new point when (x,y) changes', () => {
    radarTrailManager.observe([makeEntry('a', 1, 2)], baseNow);
    radarTrailManager.observe([makeEntry('a', 3, 4)], baseNow + 1000);
    const trails = radarTrailManager.getTrails(baseNow + 1000);
    expect(trails[0].points).toHaveLength(2);
    expect(trails[0].points[1]).toMatchObject({ x: 3, y: 4 });
  });

  it('caps trail at TRAIL_MAX_POINTS (5) — oldest dropped after 6 distinct sectors', () => {
    for (let i = 0; i < 6; i++) {
      radarTrailManager.observe([makeEntry('a', i, 0)], baseNow + i * 500);
    }
    const trails = radarTrailManager.getTrails(baseNow + 3000);
    expect(trails[0].points).toHaveLength(5);
    // oldest point (x=0) must be gone; newest (x=5) must be present
    expect(trails[0].points.map((p) => p.x)).not.toContain(0);
    expect(trails[0].points.map((p) => p.x)).toContain(5);
  });

  it('keeps kind associated with the trail', () => {
    radarTrailManager.observe([{ key: 'b', x: 1, y: 1, kind: 'trader' }], baseNow);
    const trails = radarTrailManager.getTrails(baseNow);
    expect(trails[0].kind).toBe('trader');
  });
});

// ── pruning ───────────────────────────────────────────────────────────────────

describe('radarTrailManager pruning', () => {
  beforeEach(() => {
    radarTrailManager.clear();
  });

  const baseNow = 200_000;

  it('prunes a point that has exceeded TTL at next observe', () => {
    radarTrailManager.observe([{ key: 'x', x: 0, y: 0, kind: 'combat' }], baseNow);
    // advance past TTL; pass a different position so a NEW point is added, triggering prune
    const futureNow = baseNow + TRAIL_TTL_MS + 1;
    radarTrailManager.observe([{ key: 'x', x: 5, y: 5, kind: 'combat' }], futureNow);
    const trails = radarTrailManager.getTrails(futureNow);
    // Old point at (0,0) should be pruned; only (5,5) remains
    expect(trails[0].points).toHaveLength(1);
    expect(trails[0].points[0]).toMatchObject({ x: 5, y: 5 });
  });

  it('drops a trail entirely when all its points have expired', () => {
    radarTrailManager.observe([{ key: 'gone', x: 1, y: 1, kind: 'unidentified' }], baseNow);
    // The ship disappears — no more observations for 'gone'.
    // At baseNow + TTL + 1, observe something else to trigger pruning
    const futureNow = baseNow + TRAIL_TTL_MS + 1;
    radarTrailManager.observe([{ key: 'other', x: 2, y: 2, kind: 'player' }], futureNow);
    const trails = radarTrailManager.getTrails(futureNow);
    expect(trails.find((t) => t.key === 'gone')).toBeUndefined();
  });

  it('getTrails skips points with alpha <= 0', () => {
    radarTrailManager.observe([{ key: 'fade', x: 0, y: 0, kind: 'player' }], baseNow);
    // At TTL moment exactly, alpha = 1 - 10000/10000 = 0 → skip
    const trails = radarTrailManager.getTrails(baseNow + TRAIL_TTL_MS);
    const fadedTrail = trails.find((t) => t.key === 'fade');
    // Either the trail is gone or its points array is empty
    if (fadedTrail) {
      expect(fadedTrail.points).toHaveLength(0);
    }
  });
});

// ── getTrails alpha ───────────────────────────────────────────────────────────

describe('radarTrailManager.getTrails alpha', () => {
  beforeEach(() => {
    radarTrailManager.clear();
  });

  const baseNow = 300_000;

  it('fresh point has alpha ≈ 1', () => {
    radarTrailManager.observe([{ key: 'fresh', x: 0, y: 0, kind: 'player' }], baseNow);
    const trails = radarTrailManager.getTrails(baseNow);
    expect(trails[0].points[0].alpha).toBeCloseTo(1, 5);
  });

  it('half-TTL point has alpha ≈ 0.5', () => {
    radarTrailManager.observe([{ key: 'half', x: 0, y: 0, kind: 'player' }], baseNow);
    const trails = radarTrailManager.getTrails(baseNow + TRAIL_TTL_MS / 2);
    expect(trails[0].points[0].alpha).toBeCloseTo(0.5, 2);
  });

  it('past-TTL point is skipped (alpha would be <=0)', () => {
    radarTrailManager.observe([{ key: 'old', x: 0, y: 0, kind: 'player' }], baseNow);
    const trails = radarTrailManager.getTrails(baseNow + TRAIL_TTL_MS + 500);
    const oldTrail = trails.find((t) => t.key === 'old');
    // Either gone or empty points
    if (oldTrail) {
      expect(oldTrail.points).toHaveLength(0);
    }
  });

  it('points are ordered oldest-first (newest at end)', () => {
    radarTrailManager.observe([{ key: 'ord', x: 0, y: 0, kind: 'player' }], baseNow);
    radarTrailManager.observe([{ key: 'ord', x: 1, y: 0, kind: 'player' }], baseNow + 500);
    radarTrailManager.observe([{ key: 'ord', x: 2, y: 0, kind: 'player' }], baseNow + 1000);
    const trails = radarTrailManager.getTrails(baseNow + 1000);
    const pts = trails[0].points;
    // Oldest point (x=0) is first → highest alpha gap, newest (x=2) is last → alpha≈1
    expect(pts[0].x).toBe(0);
    expect(pts[2].x).toBe(2);
    expect(pts[pts.length - 1].alpha).toBeGreaterThan(pts[0].alpha);
  });
});
