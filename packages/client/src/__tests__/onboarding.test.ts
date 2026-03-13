import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore } from 'zustand';
import { createHelpSlice } from '../state/helpSlice';

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
});

describe('onboarding', () => {
  beforeEach(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); });

  it('onboardingStep ist 0 wenn vs_first_run nicht gesetzt', () => {
    const store = createStore(createHelpSlice);
    expect(store.getState().onboardingStep).toBe(0);
  });

  it('onboardingStep ist null wenn vs_first_run gesetzt', () => {
    mockStorage['vs_first_run'] = '1';
    const store = createStore(createHelpSlice);
    expect(store.getState().onboardingStep).toBeNull();
  });

  it('advanceOnboarding erhöht Step', () => {
    const store = createStore(createHelpSlice);
    store.getState().advanceOnboarding();
    expect(store.getState().onboardingStep).toBe(1);
  });

  it('advanceOnboarding nach Step 3 schließt Onboarding', () => {
    const store = createStore(createHelpSlice);
    for (let i = 0; i < 4; i++) store.getState().advanceOnboarding();
    expect(store.getState().onboardingStep).toBeNull();
    expect(mockStorage['vs_first_run']).toBe('1');
  });

  it('skipOnboarding setzt Step auf null', () => {
    const store = createStore(createHelpSlice);
    store.getState().skipOnboarding();
    expect(store.getState().onboardingStep).toBeNull();
  });
});
