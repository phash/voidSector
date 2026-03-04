import { describe, it, expect } from 'vitest';
import { createStore } from 'zustand';
import { createUISlice } from '../state/uiSlice';

describe('UISlice monitor power', () => {
  it('defaults monitors to powered on', () => {
    const store = createStore(createUISlice);
    expect(store.getState().monitorPower['DETAIL'] ?? true).toBe(true);
  });

  it('toggles monitor power independently', () => {
    const store = createStore(createUISlice);
    store.getState().setMonitorPower('DETAIL', false);
    expect(store.getState().monitorPower['DETAIL']).toBe(false);
  });
});

describe('UISlice activeProgram', () => {
  it('defaults to NAV-COM', () => {
    const store = createStore(createUISlice);
    expect(store.getState().activeProgram).toBe('NAV-COM');
  });

  it('switches active program', () => {
    const store = createStore(createUISlice);
    store.getState().setActiveProgram('MINING');
    expect(store.getState().activeProgram).toBe('MINING');
  });

  it('can switch between multiple programs', () => {
    const store = createStore(createUISlice);
    store.getState().setActiveProgram('CARGO');
    store.getState().setActiveProgram('TECH');
    expect(store.getState().activeProgram).toBe('TECH');
  });
});
