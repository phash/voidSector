import { describe, it, expect } from 'vitest';
import { createStore } from 'zustand';
import { createUISlice } from '../state/uiSlice';

describe('UISlice sidebar collapse', () => {
  it('defaults to both sidebars expanded', () => {
    const store = createStore(createUISlice);
    expect(store.getState().leftCollapsed).toBe(false);
    expect(store.getState().rightCollapsed).toBe(false);
  });

  it('toggles left sidebar independently', () => {
    const store = createStore(createUISlice);
    store.getState().setLeftCollapsed(true);
    expect(store.getState().leftCollapsed).toBe(true);
    expect(store.getState().rightCollapsed).toBe(false);
  });
});
