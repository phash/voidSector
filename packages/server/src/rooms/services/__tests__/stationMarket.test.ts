import { describe, it, expect } from 'vitest';
import { resolveMarketTrade, tradeVolumeDelta } from '../stationMarketDecision.js';

const station = { markt_level: 1, cargo_level: 1, cargo_contents: { ore: 0 } };

describe('resolveMarketTrade', () => {
  it('sell: moves resource from player to station, pays player, reports volume', () => {
    const r = resolveMarketTrade(station, { action: 'sell', resource: 'ore', amount: 10 }, { cargoAmount: 50, credits: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.creditsToPlayer).toBeGreaterThan(0);
      expect(r.creditsFromPlayer).toBe(0);
      expect(r.volume).toBe(tradeVolumeDelta('ore', 10));
      expect(r.resourceFromPlayer).toBe(10);
    }
  });

  it('sell: rejects when station cargo would exceed capacity', () => {
    const full = { markt_level: 1, cargo_level: 0, cargo_contents: { ore: 200 } }; // cap 200
    const r = resolveMarketTrade(full, { action: 'sell', resource: 'ore', amount: 10 }, { cargoAmount: 50, credits: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('STATION_FULL');
  });

  it('buy: moves resource from station to player, charges player', () => {
    const stocked = { markt_level: 2, cargo_level: 2, cargo_contents: { crystal: 100 } };
    const r = resolveMarketTrade(stocked, { action: 'buy', resource: 'crystal', amount: 5 }, { cargoAmount: 0, credits: 100000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.creditsFromPlayer).toBeGreaterThan(0);
      expect(r.resourceToPlayer).toBe(5);
    }
  });

  it('requires a built market (markt_level >= 1)', () => {
    const noMarket = { markt_level: 0, cargo_level: 1, cargo_contents: {} };
    const r = resolveMarketTrade(noMarket, { action: 'sell', resource: 'ore', amount: 10 }, { cargoAmount: 50, credits: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NO_MARKET');
  });

  it('buy: reduces station stock and charges the expected amount', () => {
    const stocked = { markt_level: 2, cargo_level: 2, cargo_contents: { crystal: 100 } };
    const r = resolveMarketTrade(stocked, { action: 'buy', resource: 'crystal', amount: 5 }, { cargoAmount: 0, credits: 100000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newStationContents.crystal).toBe(95);
      expect(r.creditsFromPlayer).toBeGreaterThan(0);
    }
  });

  it('buy: rejects when the player cannot afford it', () => {
    const stocked = { markt_level: 1, cargo_level: 2, cargo_contents: { crystal: 100 } };
    const r = resolveMarketTrade(stocked, { action: 'buy', resource: 'crystal', amount: 5 }, { cargoAmount: 0, credits: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INSUFFICIENT');
  });

  it('never lets sell price exceed buy price (no arbitrage at any level)', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
      const st = { markt_level: lvl, cargo_level: 5, cargo_contents: { ore: 0 } };
      const sell = resolveMarketTrade(st, { action: 'sell', resource: 'ore', amount: 100 }, { cargoAmount: 1000, credits: 0 });
      const buy = resolveMarketTrade({ ...st, cargo_contents: { ore: 1000 } }, { action: 'buy', resource: 'ore', amount: 100 }, { cargoAmount: 0, credits: 1_000_000 });
      expect(sell.ok && buy.ok).toBe(true);
      if (sell.ok && buy.ok) expect(sell.creditsToPlayer).toBeLessThanOrEqual(buy.creditsFromPlayer);
    }
  });
});
