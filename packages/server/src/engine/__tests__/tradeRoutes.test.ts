import { describe, it, expect } from 'vitest';
import { isRouteCycleDue, calculateRouteFuelCost, validateRouteConfig } from '../tradeRoutes.js';

describe('Trade Routes', () => {
  it('should detect cycle due when enough time passed', () => {
    const past = Date.now() - 31 * 60 * 1000;
    expect(isRouteCycleDue(past, 30)).toBe(true);
  });

  it('should not trigger cycle too early', () => {
    const recent = Date.now() - 15 * 60 * 1000;
    expect(isRouteCycleDue(recent, 30)).toBe(false);
  });

  it('should trigger on first run (null lastCycleAt)', () => {
    expect(isRouteCycleDue(null, 30)).toBe(true);
  });

  it('should calculate fuel cost from distance', () => {
    const cost = calculateRouteFuelCost(0, 0, 20, 0);
    expect(cost).toBe(Math.ceil(20 * 0.5)); // 10
  });

  it('should validate cycle range', () => {
    expect(validateRouteConfig({ cycleMinutes: 10 }).valid).toBe(false);
    expect(validateRouteConfig({ cycleMinutes: 15 }).valid).toBe(true);
    expect(validateRouteConfig({ cycleMinutes: 120 }).valid).toBe(true);
    expect(validateRouteConfig({ cycleMinutes: 150 }).valid).toBe(false);
  });

  it('should validate max route count', () => {
    expect(validateRouteConfig({ cycleMinutes: 30, routeCount: 2 }).valid).toBe(true);
    expect(validateRouteConfig({ cycleMinutes: 30, routeCount: 3 }).valid).toBe(false);
  });
});
