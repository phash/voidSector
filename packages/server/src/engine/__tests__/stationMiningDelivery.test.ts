import { describe, it, expect } from 'vitest';
import { resolveMiningDelivery } from '../stationMiningDelivery.js';
import { NPC_PRICES } from '@void-sector/shared';

describe('resolveMiningDelivery', () => {
  it('auto-sells when the station has a Markt (markt_level >= 1)', () => {
    const station = { markt_level: 1, cargo_level: 0, cargo_contents: {} };
    const r = resolveMiningDelivery(station, 'ore', 20);
    expect(r.mode).toBe('sell');
    expect(r.credits).toBeGreaterThan(0);
    expect(r.volume).toBe(Math.round(NPC_PRICES.ore * 20)); // base price, spread-independent
  });

  it('stores into station cargo (capped) when there is no Markt', () => {
    const station = { markt_level: 0, cargo_level: 1, cargo_contents: { ore: 0 } }; // cap 500
    const r = resolveMiningDelivery(station, 'ore', 20);
    expect(r.mode).toBe('store');
    expect(r.credits).toBe(0);
    expect(r.volume).toBe(0);
    expect(r.newCargo.ore).toBe(20);
  });

  it('drops overflow when the cargo cap is reached (no Markt)', () => {
    const station = { markt_level: 0, cargo_level: 0, cargo_contents: { ore: 195 } }; // cap 200
    const r = resolveMiningDelivery(station, 'ore', 20);
    expect(r.mode).toBe('store');
    expect(r.newCargo.ore).toBe(200); // only 5 fit, 15 lost
  });

  it('higher Markt level pays more per unit', () => {
    const low = resolveMiningDelivery({ markt_level: 1, cargo_level: 0, cargo_contents: {} }, 'crystal', 10);
    const high = resolveMiningDelivery({ markt_level: 5, cargo_level: 0, cargo_contents: {} }, 'crystal', 10);
    expect(high.mode === 'sell' && low.mode === 'sell').toBe(true);
    if (high.mode === 'sell' && low.mode === 'sell') {
      expect(high.credits).toBeGreaterThan(low.credits);
    }
  });
});
