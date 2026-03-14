import { describe, it, expect } from 'vitest';
import { validateBuild, validateLabUpgrade } from '../commands.js';
import type { CargoState } from '@void-sector/shared';
import { createAPState } from '../ap.js';

const fullCargo = {
  ore: 999,
  gas: 999,
  crystal: 999,
  artefact: 0,
  slates: 0,
  artefact_drive: 0,
  artefact_cargo: 0,
  artefact_scanner: 0,
  artefact_armor: 0,
  artefact_weapon: 0,
  artefact_shield: 0,
  artefact_defense: 0,
  artefact_special: 0,
  artefact_mining: 0,
};

describe('validateLabUpgrade', () => {
  it('fails if no existing lab (tier 0)', () => {
    const r = validateLabUpgrade(0, 9999, fullCargo);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/no.*lab/i);
  });

  it('fails if already at max tier (5)', () => {
    const r = validateLabUpgrade(5, 9999, fullCargo);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/max/i);
  });

  it('fails if insufficient credits', () => {
    const r = validateLabUpgrade(1, 0, fullCargo);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/credits/i);
  });

  it('fails if insufficient ore', () => {
    const r = validateLabUpgrade(1, 9999, { ...fullCargo, ore: 0 });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/ore/i);
  });

  it('succeeds for valid upgrade from tier 1 to 2', () => {
    const r = validateLabUpgrade(1, 9999, fullCargo);
    expect(r.valid).toBe(true);
    expect(r.targetTier).toBe(2);
    expect(r.costs).toBeDefined();
  });
});

describe('validateBuild', () => {
  it('succeeds with sufficient cargo and AP for comm_relay', () => {
    const cargo: CargoState = { ore: 10, gas: 5, crystal: 5, slates: 0, artefact: 0 };
    const ap = createAPState(Date.now());
    const result = validateBuild(ap, cargo, 'comm_relay');
    expect(result.valid).toBe(true);
  });

  it('fails with insufficient ore for comm_relay', () => {
    const cargo: CargoState = { ore: 2, gas: 0, crystal: 5, slates: 0, artefact: 0 };
    const ap = createAPState(Date.now());
    const result = validateBuild(ap, cargo, 'comm_relay');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('ore');
  });

  it('fails with insufficient AP', () => {
    const cargo: CargoState = { ore: 10, gas: 5, crystal: 5, slates: 0, artefact: 0 };
    const ap = { ...createAPState(Date.now()), current: 2 };
    const result = validateBuild(ap, cargo, 'comm_relay');
    expect(result.valid).toBe(false);
  });

  it('validates mining_station costs', () => {
    const cargo: CargoState = { ore: 30, gas: 15, crystal: 10, slates: 0, artefact: 0 };
    const ap = createAPState(Date.now());
    expect(validateBuild(ap, cargo, 'mining_station').valid).toBe(true);
  });

  it('validates base costs', () => {
    const cargo: CargoState = { ore: 50, gas: 30, crystal: 25, slates: 0, artefact: 0 };
    const ap = createAPState(Date.now());
    expect(validateBuild(ap, cargo, 'base').valid).toBe(true);
  });

  it('fails base with insufficient gas', () => {
    const cargo: CargoState = { ore: 50, gas: 10, crystal: 25, slates: 0, artefact: 0 };
    const ap = createAPState(Date.now());
    const result = validateBuild(ap, cargo, 'base');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('gas');
  });
});
