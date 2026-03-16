import { describe, it, expect } from 'vitest';
import { validateBuild } from '../commands.js';
import type { CargoState } from '@void-sector/shared';
import { createAPState } from '../ap.js';

describe('validateBuild', () => {
  // jumpgate costs: { ore: 0, gas: 0, crystal: 20 }, AP: 10
  it('succeeds with sufficient cargo and AP for jumpgate', () => {
    const cargo: CargoState = { ore: 0, gas: 0, crystal: 20, slates: 0, artefact: 0 };
    const ap = createAPState(Date.now());
    const result = validateBuild(ap, cargo, 'jumpgate');
    expect(result.valid).toBe(true);
  });

  it('fails with insufficient crystal for jumpgate', () => {
    const cargo: CargoState = { ore: 0, gas: 0, crystal: 10, slates: 0, artefact: 0 };
    const ap = createAPState(Date.now());
    const result = validateBuild(ap, cargo, 'jumpgate');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('crystal');
  });

  it('fails with insufficient AP', () => {
    const cargo: CargoState = { ore: 0, gas: 0, crystal: 20, slates: 0, artefact: 0 };
    const ap = { ...createAPState(Date.now()), current: 2 };
    const result = validateBuild(ap, cargo, 'jumpgate');
    expect(result.valid).toBe(false);
  });
});
