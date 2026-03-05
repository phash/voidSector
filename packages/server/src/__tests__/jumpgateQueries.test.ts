import { describe, it, expect } from 'vitest';
import {
  JUMPGATE_DISTANCE_LIMITS,
  JUMPGATE_CONNECTION_LIMITS,
  JUMPGATE_MAX_CHAIN_HOPS,
} from '@void-sector/shared';

describe('jumpgate constants', () => {
  it('distance limits scale per level', () => {
    expect(JUMPGATE_DISTANCE_LIMITS[1]).toBe(250);
    expect(JUMPGATE_DISTANCE_LIMITS[2]).toBe(500);
    expect(JUMPGATE_DISTANCE_LIMITS[3]).toBe(2500);
  });

  it('connection limits scale per level', () => {
    expect(JUMPGATE_CONNECTION_LIMITS[1]).toBe(1);
    expect(JUMPGATE_CONNECTION_LIMITS[2]).toBe(2);
    expect(JUMPGATE_CONNECTION_LIMITS[3]).toBe(3);
  });

  it('max chain hops is 10', () => {
    expect(JUMPGATE_MAX_CHAIN_HOPS).toBe(10);
  });
});
