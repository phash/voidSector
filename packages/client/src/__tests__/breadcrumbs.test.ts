import { describe, it, expect } from 'vitest';
import { createStore } from 'zustand';
import { createUISlice } from '../state/uiSlice';

describe('breadcrumbStack', () => {
  it('pushBreadcrumb fügt Eintrag hinzu', () => {
    const store = createStore(createUISlice);
    store.getState().pushBreadcrumb({ label: 'QUESTS', program: 'QUESTS' });
    expect(store.getState().breadcrumbStack).toHaveLength(1);
  });

  it('pushBreadcrumb begrenzt auf 3 Einträge', () => {
    const store = createStore(createUISlice);
    for (let i = 0; i < 5; i++) store.getState().pushBreadcrumb({ label: `L${i}`, program: 'QUESTS' });
    expect(store.getState().breadcrumbStack).toHaveLength(3);
  });

  it('setActiveProgram leert breadcrumbStack', () => {
    const store = createStore(createUISlice);
    store.getState().pushBreadcrumb({ label: 'X', program: 'QUESTS' });
    store.getState().setActiveProgram('MINING');
    expect(store.getState().breadcrumbStack).toHaveLength(0);
  });

  it('clearBreadcrumbs leert Stack', () => {
    const store = createStore(createUISlice);
    store.getState().pushBreadcrumb({ label: 'X', program: 'QUESTS' });
    store.getState().clearBreadcrumbs();
    expect(store.getState().breadcrumbStack).toHaveLength(0);
  });
});
