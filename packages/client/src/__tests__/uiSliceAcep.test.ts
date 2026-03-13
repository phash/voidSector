import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../state/store';

beforeEach(() => {
  useStore.setState({
    acepActiveTab: 'acep',
    acepHoveredModuleId: null,
  } as any);
});

describe('uiSlice ACEP state', () => {
  it('default acepActiveTab is acep', () => {
    expect(useStore.getState().acepActiveTab).toBe('acep');
  });

  it('setAcepActiveTab updates the tab', () => {
    useStore.getState().setAcepActiveTab('module');
    expect(useStore.getState().acepActiveTab).toBe('module');
  });

  it('setAcepHoveredModuleId sets a module id', () => {
    useStore.getState().setAcepHoveredModuleId('drive_mk1');
    expect(useStore.getState().acepHoveredModuleId).toBe('drive_mk1');
  });

  it('setAcepHoveredModuleId clears with null', () => {
    useStore.getState().setAcepHoveredModuleId('drive_mk1');
    useStore.getState().setAcepHoveredModuleId(null);
    expect(useStore.getState().acepHoveredModuleId).toBeNull();
  });
});
