import { describe, it, expect } from 'vitest';
import { useStore } from '../state/store';
import { mockStoreState } from '../test/mockStore';

describe('visitedTrail', () => {
  it('pushes old position to trail on setPosition', () => {
    mockStoreState({ position: { x: 0, y: 0 }, visitedTrail: [] });
    useStore.getState().setPosition({ x: 1, y: 0 });
    expect(useStore.getState().visitedTrail).toEqual([{ x: 0, y: 0 }]);
  });

  it('limits trail to 9 entries', () => {
    const trail = Array.from({ length: 9 }, (_, i) => ({ x: i, y: 0 }));
    mockStoreState({ position: { x: 10, y: 0 }, visitedTrail: trail });
    useStore.getState().setPosition({ x: 11, y: 0 });
    const result = useStore.getState().visitedTrail;
    expect(result).toHaveLength(9);
    expect(result[0]).toEqual({ x: 10, y: 0 });
  });

  it('does not duplicate consecutive positions', () => {
    mockStoreState({ position: { x: 5, y: 5 }, visitedTrail: [{ x: 4, y: 5 }] });
    useStore.getState().setPosition({ x: 5, y: 5 });
    expect(useStore.getState().visitedTrail).toHaveLength(1);
  });
});
