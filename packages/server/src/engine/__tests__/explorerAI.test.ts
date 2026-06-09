import { describe, it, expect } from 'vitest';
import { nextExplorerState, pickExplorerTarget } from '../npcShipAI.js';

const ship = (over: Record<string, unknown> = {}) =>
  ({ id: 7, x: 0, y: 0, state: 'idle', spiral_step: 0, patrol_state: {}, ...over } as any);

describe('pickExplorerTarget', () => {
  it('returns a far target in the deep-galaxy ring [1000,12000] sectors', () => {
    for (let leg = 0; leg < 20; leg++) {
      const t = pickExplorerTarget(11, leg);
      const d = Math.max(Math.abs(t.x), Math.abs(t.y));
      expect(d).toBeGreaterThanOrEqual(1000);
      expect(d).toBeLessThanOrEqual(12000);
    }
  });
  it('is deterministic for the same (id, leg)', () => {
    expect(pickExplorerTarget(11, 3)).toEqual(pickExplorerTarget(11, 3));
  });
  it('varies by leg (different targets over time)', () => {
    expect(pickExplorerTarget(11, 3)).not.toEqual(pickExplorerTarget(11, 4));
  });
});

describe('nextExplorerState', () => {
  it('hops directly to a far target and advances the leg counter', () => {
    const s = ship({ id: 11, spiral_step: 2 });
    const upd = nextExplorerState(s);
    expect(upd.x).toBeDefined();
    expect(upd.y).toBeDefined();
    expect(Math.max(Math.abs(upd.x!), Math.abs(upd.y!))).toBeGreaterThanOrEqual(1000);
    expect(upd.spiral_step).toBe(3);
    expect(upd.state).toBe('exploring');
    expect(upd.x).toEqual(pickExplorerTarget(11, 2).x);
  });
  it('keeps moving every call (never settles to {})', () => {
    const upd = nextExplorerState(ship({ id: 11 }));
    expect(Object.keys(upd).length).toBeGreaterThan(0);
  });
});
