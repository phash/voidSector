import { describe, it, expect } from 'vitest';
import { validateBuild } from '../commands.js';
import type { CargoState } from '@void-sector/shared';
import { createAPState } from '../ap.js';

describe('validateBuild', () => {
  it('succeeds with sufficient cargo and AP for comm_relay', () => {
    const cargo: CargoState = { ore: 10, gas: 5, crystal: 5 };
    const ap = createAPState(Date.now());
    const result = validateBuild(ap, cargo, 'comm_relay');
    expect(result.valid).toBe(true);
  });

  it('fails with insufficient ore for comm_relay', () => {
    const cargo: CargoState = { ore: 2, gas: 0, crystal: 5 };
    const ap = createAPState(Date.now());
    const result = validateBuild(ap, cargo, 'comm_relay');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('ore');
  });

  it('fails with insufficient AP', () => {
    const cargo: CargoState = { ore: 10, gas: 5, crystal: 5 };
    const ap = { ...createAPState(Date.now()), current: 2 };
    const result = validateBuild(ap, cargo, 'comm_relay');
    expect(result.valid).toBe(false);
  });

  it('validates mining_station costs', () => {
    const cargo: CargoState = { ore: 30, gas: 15, crystal: 10 };
    const ap = createAPState(Date.now());
    expect(validateBuild(ap, cargo, 'mining_station').valid).toBe(true);
  });

  it('validates base costs', () => {
    const cargo: CargoState = { ore: 50, gas: 30, crystal: 25 };
    const ap = createAPState(Date.now());
    expect(validateBuild(ap, cargo, 'base').valid).toBe(true);
  });

  it('fails base with insufficient gas', () => {
    const cargo: CargoState = { ore: 50, gas: 10, crystal: 25 };
    const ap = createAPState(Date.now());
    const result = validateBuild(ap, cargo, 'base');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('gas');
  });
});
