import { describe, it, expect } from 'vitest';
import { createAPState, calculateCurrentAP, spendAP } from '../ap.js';
import { AP_DEFAULTS, AP_COSTS } from '@void-sector/shared';

describe('AP engine', () => {
  it('creates AP state with defaults', () => {
    const ap = createAPState();
    expect(ap.current).toBe(AP_DEFAULTS.startingAP);
    expect(ap.max).toBe(AP_DEFAULTS.max);
    expect(ap.regenPerSecond).toBe(AP_DEFAULTS.regenPerSecond);
  });

  it('calculateCurrentAP regenerates over time', () => {
    const now = Date.now();
    const ap = {
      current: 50,
      max: 100,
      lastTick: now - 10_000, // 10 seconds ago
      regenPerSecond: 0.5,
    };
    const result = calculateCurrentAP(ap, now);
    // 10 seconds * 0.5 = 5 AP regenerated
    expect(result.current).toBe(55);
    expect(result.lastTick).toBe(now);
  });

  it('calculateCurrentAP caps at max', () => {
    const now = Date.now();
    const ap = {
      current: 98,
      max: 100,
      lastTick: now - 60_000, // 60 seconds ago
      regenPerSecond: 0.5,
    };
    const result = calculateCurrentAP(ap, now);
    expect(result.current).toBe(100); // capped
  });

  it('spendAP deducts correctly', () => {
    const ap = { current: 50, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = spendAP(ap, AP_COSTS.jump);
    expect(result).not.toBeNull();
    expect(result!.current).toBe(50 - AP_COSTS.jump);
  });

  it('spendAP returns null when not enough AP', () => {
    const ap = { current: 0, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = spendAP(ap, AP_COSTS.jump);
    expect(result).toBeNull();
  });

  it('spendAP regenerates first, then spends', () => {
    const now = Date.now();
    const ap = {
      current: 0,
      max: 100,
      lastTick: now - 10_000, // 10s ago -> +5 AP
      regenPerSecond: 0.5,
    };
    const result = spendAP(ap, 3, now);
    expect(result).not.toBeNull();
    expect(result!.current).toBe(2); // 5 - 3 = 2
  });
});
