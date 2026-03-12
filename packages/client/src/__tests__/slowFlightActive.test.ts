import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../state/store';

describe('slowFlightActive state', () => {
  beforeEach(() => {
    useStore.setState({ slowFlightActive: false });
  });

  it('is false by default', () => {
    expect(useStore.getState().slowFlightActive).toBe(false);
  });

  it('setSlowFlightActive(true) sets it to true', () => {
    useStore.getState().setSlowFlightActive(true);
    expect(useStore.getState().slowFlightActive).toBe(true);
  });

  it('setSlowFlightActive(false) resets it', () => {
    useStore.getState().setSlowFlightActive(true);
    useStore.getState().setSlowFlightActive(false);
    expect(useStore.getState().slowFlightActive).toBe(false);
  });
});
