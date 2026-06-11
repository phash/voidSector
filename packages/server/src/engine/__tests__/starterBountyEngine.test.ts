import { describe, expect, it } from 'vitest';
import { STARTER_BOUNTIES, getStarterBountyDef } from '@void-sector/shared';
import { validateStarterClaim } from '../starterBountyEngine.js';

const oreDef = getStarterBountyDef('starter_ore')!;
const cargo = { ore: 10, gas: 0, crystal: 0, slates: 0, artefact: 0 };

describe('validateStarterClaim', () => {
  it('accepts claim at origin with enough resources', () => {
    expect(validateStarterClaim(oreDef, cargo, 0, 0)).toEqual({ ok: true });
  });

  it('rejects claim away from origin', () => {
    expect(validateStarterClaim(oreDef, cargo, 3, 0)).toEqual({
      ok: false,
      code: 'NOT_AT_ORIGIN',
    });
  });

  it('rejects claim with insufficient resources', () => {
    const empty = { ...cargo, ore: 4 };
    expect(validateStarterClaim(oreDef, empty, 0, 0)).toEqual({
      ok: false,
      code: 'INSUFFICIENT_RESOURCES',
    });
  });

  it('accepts exactly matching resource amount', () => {
    const exact = { ...cargo, ore: oreDef.amount };
    expect(validateStarterClaim(oreDef, exact, 0, 0)).toEqual({ ok: true });
  });
});

describe('STARTER_BOUNTIES definitions', () => {
  it('have unique keys and positive amounts/rewards', () => {
    const keys = new Set(STARTER_BOUNTIES.map((b) => b.key));
    expect(keys.size).toBe(STARTER_BOUNTIES.length);
    for (const b of STARTER_BOUNTIES) {
      expect(b.amount).toBeGreaterThan(0);
      expect(b.rewardCredits).toBeGreaterThan(0);
      expect(b.rewardWissen).toBeGreaterThan(0);
    }
  });

  it('getStarterBountyDef returns null for unknown key', () => {
    expect(getStarterBountyDef('starter_unknown')).toBeNull();
  });
});
