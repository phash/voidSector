import { describe, it, expect } from 'vitest';
import { validateListing, EXCHANGE_MAX_PRICE } from '../ExchangeService.js';

describe('validateListing', () => {
  it('accepts a resource listing', () => {
    expect(validateListing('resource', 'ore', 10, 500)).toMatchObject({ ok: true });
  });
  it('accepts a blueprint listing', () => {
    expect(validateListing('blueprint', 'blueprint_turret', 1, 5000)).toMatchObject({ ok: true });
  });
  it('rejects a disallowed item type', () => {
    expect(validateListing('prisoner', 'x', 1, 100).ok).toBe(false);
  });
  it('rejects a non-basic resource id', () => {
    expect(validateListing('resource', 'slate', 1, 100).ok).toBe(false);
  });
  it('rejects bad quantity / price', () => {
    expect(validateListing('resource', 'ore', 0, 100).ok).toBe(false);
    expect(validateListing('resource', 'ore', 1.5, 100).ok).toBe(false);
    expect(validateListing('resource', 'ore', 1, 0).ok).toBe(false);
    expect(validateListing('resource', 'ore', 1, EXCHANGE_MAX_PRICE + 1).ok).toBe(false);
  });
  it('rejects an empty blueprint id', () => {
    expect(validateListing('blueprint', '', 1, 100).ok).toBe(false);
  });
});
