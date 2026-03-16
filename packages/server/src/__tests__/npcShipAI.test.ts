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
