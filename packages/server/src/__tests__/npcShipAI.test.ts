import { describe, it, expect } from 'vitest';
import { nextTraderState, nextMilitaryState, nextOutlawState } from '../engine/npcShipAI.js';

describe('nextTraderState', () => {
  it('idle with target transitions to traveling', () => {
    const ship = { state: 'idle', x: 10, y: 10, patrol_state: { targetX: 50, targetY: 50, waitTicks: 0 } };
    const update = nextTraderState(ship);
    expect(update.state).toBe('traveling');
  });

  it('traveling moves toward target', () => {
    const ship = { state: 'traveling', x: 10, y: 10, patrol_state: { targetX: 12, targetY: 10 } };
    const update = nextTraderState(ship);
    expect(update.x).toBe(11);
  });

  it('arriving at target → idle with waitTicks', () => {
    const ship = { state: 'traveling', x: 50, y: 50, patrol_state: { targetX: 50, targetY: 50 } };
    const update = nextTraderState(ship);
    expect(update.state).toBe('idle');
    expect(update.patrol_state?.waitTicks).toBe(5);
  });

  it('idle with waitTicks decrements', () => {
    const ship = { state: 'idle', x: 50, y: 50, patrol_state: { waitTicks: 3 } };
    const update = nextTraderState(ship);
    expect(update.patrol_state?.waitTicks).toBe(2);
  });

  it('idle at home with no target heads OUT to a seeded waypoint (QW1: no longer frozen)', () => {
    const ship = { id: 7, state: 'idle', x: 100, y: 100, home_x: 100, home_y: 100, patrol_state: {} };
    const update = nextTraderState(ship);
    expect(update.state).toBe('traveling');
    expect(update.patrol_state.targetX != null && update.patrol_state.targetY != null).toBe(true);
    const moved = update.patrol_state.targetX !== 100 || update.patrol_state.targetY !== 100;
    expect(moved).toBe(true);
  });

  it('idle away from home with no target heads back home', () => {
    const ship = { id: 7, state: 'idle', x: 130, y: 80, home_x: 100, home_y: 100, patrol_state: {} };
    const update = nextTraderState(ship);
    expect(update.state).toBe('traveling');
    expect(update.patrol_state.targetX).toBe(100);
    expect(update.patrol_state.targetY).toBe(100);
  });

  it('seeded waypoint is deterministic per ship id', () => {
    const mk = () => ({ id: 42, state: 'idle', x: 0, y: 0, home_x: 0, home_y: 0, patrol_state: {} });
    const a = nextTraderState(mk());
    const b = nextTraderState(mk());
    expect(a.patrol_state.targetX).toBe(b.patrol_state.targetX);
    expect(a.patrol_state.targetY).toBe(b.patrol_state.targetY);
  });
});

describe('nextMilitaryState', () => {
  it('idle with border → traveling', () => {
    const ship = { state: 'idle', x: 100, y: 100, home_x: 100, home_y: 100,
      patrol_state: { leg: 'to_border', borderX: 0, borderY: 100, stepsLeft: 50, direction: 'h' } };
    const update = nextMilitaryState(ship);
    expect(update.state).toBe('traveling');
  });

  it('patrol decrements steps', () => {
    const ship = { state: 'traveling', x: 0, y: 100,
      patrol_state: { leg: 'patrol', borderX: 0, borderY: 100, stepsLeft: 50, direction: 'h' } };
    const update = nextMilitaryState(ship);
    expect(update.patrol_state?.stepsLeft).toBe(49);
    expect(update.x).toBe(1);
  });

  it('patrol with 0 steps → return', () => {
    const ship = { state: 'traveling', x: 50, y: 100,
      patrol_state: { leg: 'patrol', stepsLeft: 0, direction: 'h' } };
    const update = nextMilitaryState(ship);
    expect(update.patrol_state?.leg).toBe('return');
  });
});

describe('nextOutlawState', () => {
  it('skips on skipTick=1', () => {
    const ship = { state: 'idle', x: 5, y: 5, id: 1,
      patrol_state: { anchorX: 5, anchorY: 5, roamRadius: 8, skipTick: 1 } };
    const update = nextOutlawState(ship);
    expect(update.patrol_state?.skipTick).toBe(0);
    expect(update.x).toBeUndefined();
  });

  it('moves on skipTick=0 with target', () => {
    const ship = { state: 'idle', x: 5, y: 5, id: 1,
      patrol_state: { anchorX: 5, anchorY: 5, roamRadius: 8, skipTick: 0, targetX: 6, targetY: 5 } };
    const update = nextOutlawState(ship);
    expect(update.patrol_state?.skipTick).toBe(1);
    expect(update.x).toBe(6);
  });
});
