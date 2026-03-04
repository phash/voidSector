import { describe, it, expect } from 'vitest';
import { createStore } from 'zustand';
import { createHelpSlice } from '../state/helpSlice';

describe('HelpSlice', () => {
  it('starts with no active tip', () => {
    const store = createStore(createHelpSlice);
    expect(store.getState().activeTip).toBeNull();
  });

  it('showTip sets activeTip', () => {
    const store = createStore(createHelpSlice);
    store.getState().showTip('first_login');
    expect(store.getState().activeTip?.id).toBe('first_login');
  });

  it('dismissTip clears activeTip', () => {
    const store = createStore(createHelpSlice);
    store.getState().showTip('first_login');
    store.getState().dismissTip();
    expect(store.getState().activeTip).toBeNull();
  });

  it('does not show a tip twice', () => {
    const store = createStore(createHelpSlice);
    store.getState().showTip('first_login');
    store.getState().dismissTip();
    store.getState().showTip('first_login'); // second time
    expect(store.getState().activeTip).toBeNull(); // already seen
  });
});
