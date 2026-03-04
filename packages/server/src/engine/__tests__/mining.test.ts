import { describe, it, expect } from 'vitest';
import {
  createMiningState,
  calculateMinedAmount,
  startMining,
  stopMining,
} from '../mining.js';

describe('mining engine', () => {
  it('createMiningState returns inactive state', () => {
    const state = createMiningState();
    expect(state.active).toBe(false);
    expect(state.resource).toBeNull();
  });

  it('startMining activates mining', () => {
    const now = Date.now();
    const state = startMining('ore', 3, 5, 20, now);
    expect(state.active).toBe(true);
    expect(state.resource).toBe('ore');
    expect(state.sectorX).toBe(3);
    expect(state.sectorY).toBe(5);
    expect(state.startedAt).toBe(now);
    expect(state.rate).toBeGreaterThan(0);
    expect(state.sectorYield).toBe(20);
  });

  it('calculateMinedAmount returns correct amount based on elapsed time', () => {
    const now = Date.now();
    const state = startMining('ore', 0, 0, 20, now - 10_000);
    const mined = calculateMinedAmount(state, 50, now);
    expect(mined).toBe(1); // 10s * 0.1 = 1
  });

  it('calculateMinedAmount caps at sectorYield', () => {
    const now = Date.now();
    const state = startMining('ore', 0, 0, 2, now - 1_000_000);
    const mined = calculateMinedAmount(state, 50, now);
    expect(mined).toBe(2);
  });

  it('calculateMinedAmount caps at cargo space', () => {
    const now = Date.now();
    const state = startMining('ore', 0, 0, 100, now - 1_000_000);
    const mined = calculateMinedAmount(state, 3, now);
    expect(mined).toBe(3);
  });

  it('calculateMinedAmount returns 0 when not active', () => {
    const state = createMiningState();
    expect(calculateMinedAmount(state, 50)).toBe(0);
  });

  it('stopMining returns mined amount and resets state', () => {
    const now = Date.now();
    const state = startMining('ore', 0, 0, 20, now - 10_000);
    const result = stopMining(state, 50, now);
    expect(result.mined).toBe(1);
    expect(result.resource).toBe('ore');
    expect(result.newState.active).toBe(false);
  });
});
