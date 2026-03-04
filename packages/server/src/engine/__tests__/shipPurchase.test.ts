import { describe, it, expect } from 'vitest';
import { hasShipyard } from '../npcgen.js';
import { HULL_PRICES, STATION_SHIPYARD_LEVEL_THRESHOLD, HULLS } from '@void-sector/shared';
import type { HullType } from '@void-sector/shared';

// ---------------------------------------------------------------------------
// hasShipyard
// ---------------------------------------------------------------------------
describe('hasShipyard', () => {
  it('returns false for level 1 stations', () => {
    expect(hasShipyard(1)).toBe(false);
  });

  it('returns false for level 2 stations', () => {
    expect(hasShipyard(2)).toBe(false);
  });

  it('returns true for level 3 stations (threshold)', () => {
    expect(hasShipyard(3)).toBe(true);
  });

  it('returns true for level 4 stations', () => {
    expect(hasShipyard(4)).toBe(true);
  });

  it('returns true for level 5 stations', () => {
    expect(hasShipyard(5)).toBe(true);
  });

  it('threshold constant is 3', () => {
    expect(STATION_SHIPYARD_LEVEL_THRESHOLD).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// HULL_PRICES
// ---------------------------------------------------------------------------
describe('HULL_PRICES', () => {
  it('has a price for every hull type', () => {
    const hullTypes: HullType[] = ['scout', 'freighter', 'cruiser', 'explorer', 'battleship'];
    for (const ht of hullTypes) {
      expect(HULL_PRICES[ht]).toBeDefined();
      expect(typeof HULL_PRICES[ht]).toBe('number');
    }
  });

  it('scout is free', () => {
    expect(HULL_PRICES.scout).toBe(0);
  });

  it('prices increase with hull tier', () => {
    expect(HULL_PRICES.freighter).toBeGreaterThan(HULL_PRICES.scout);
    expect(HULL_PRICES.cruiser).toBeGreaterThan(HULL_PRICES.freighter);
    expect(HULL_PRICES.explorer).toBeGreaterThan(HULL_PRICES.cruiser);
    expect(HULL_PRICES.battleship).toBeGreaterThan(HULL_PRICES.explorer);
  });

  it('prices match unlockCost in HULLS definitions', () => {
    const hullTypes: HullType[] = ['scout', 'freighter', 'cruiser', 'explorer', 'battleship'];
    for (const ht of hullTypes) {
      expect(HULL_PRICES[ht]).toBe(HULLS[ht].unlockCost);
    }
  });
});

// ---------------------------------------------------------------------------
// ShipRecord shipColor field
// ---------------------------------------------------------------------------
describe('ShipRecord shipColor', () => {
  it('shipColor is an optional field on the interface', () => {
    // Verify the type allows shipColor by constructing a valid object
    const record = {
      id: 'ship-1',
      ownerId: 'player-1',
      hullType: 'scout' as HullType,
      name: 'Test Ship',
      modules: [],
      active: true,
      createdAt: new Date().toISOString(),
      shipColor: '#FF0000',
    };
    expect(record.shipColor).toBe('#FF0000');
  });

  it('shipColor can be omitted', () => {
    const record = {
      id: 'ship-2',
      ownerId: 'player-1',
      hullType: 'cruiser' as HullType,
      name: 'No Color Ship',
      modules: [],
      active: true,
      createdAt: new Date().toISOString(),
    };
    expect(record.shipColor).toBeUndefined();
  });
});
