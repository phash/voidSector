import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../state/store';

describe('bountyEncounter store action', () => {
  beforeEach(() => {
    useStore.getState().setBountyEncounter(null);
  });

  it('sets bountyEncounter state', () => {
    const encounter = {
      questId: 'q1',
      targetName: "Zyr'ex Korath",
      targetLevel: 3,
      sectorX: 20,
      sectorY: 20,
    };
    useStore.getState().setBountyEncounter(encounter);
    expect(useStore.getState().bountyEncounter).toEqual(encounter);
  });

  it('clears bountyEncounter when set to null', () => {
    useStore.getState().setBountyEncounter({ questId: 'x', targetName: 'x', targetLevel: 1, sectorX: 0, sectorY: 0 });
    useStore.getState().setBountyEncounter(null);
    expect(useStore.getState().bountyEncounter).toBeNull();
  });
});
