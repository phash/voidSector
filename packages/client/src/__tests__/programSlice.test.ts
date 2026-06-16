import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../state/store';

describe('programSlice', () => {
  beforeEach(() => {
    useStore.setState({ shipPrograms: [], activeShipProgramId: null, shipProgramRun: null, shipProgramLog: [] });
  });
  it('stores the program list and active id', () => {
    useStore.getState().setShipPrograms([{ id: 'p1', name: 'Loop', source: 'scan', mode: 'loop', is_active: true }] as any);
    expect(useStore.getState().shipPrograms).toHaveLength(1);
    expect(useStore.getState().activeShipProgramId).toBe('p1');
    useStore.getState().setActiveShipProgramId('p2');
    expect(useStore.getState().activeShipProgramId).toBe('p2');
  });
  it('tracks run state and appends a capped log', () => {
    useStore.getState().setShipProgramRun({ status: 'running', pc: 0 });
    expect(useStore.getState().shipProgramRun?.status).toBe('running');
    for (let i = 0; i < 250; i++) useStore.getState().appendShipProgramLog('x');
    expect(useStore.getState().shipProgramLog.length).toBeLessThanOrEqual(200);
  });
});
