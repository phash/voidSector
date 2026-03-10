import { describe, it, expect } from 'vitest';
import { civQueries } from '../db/civQueries.js';

describe('civQueries', () => {
  it('exports all required functions', () => {
    expect(typeof civQueries.getStationsForFaction).toBe('function');
    expect(typeof civQueries.upsertStation).toBe('function');
    expect(typeof civQueries.getAllStations).toBe('function');
    expect(typeof civQueries.createShip).toBe('function');
    expect(typeof civQueries.updateShip).toBe('function');
    expect(typeof civQueries.getAllShips).toBe('function');
    expect(typeof civQueries.deleteShip).toBe('function');
    expect(typeof civQueries.getShipsInQuadrant).toBe('function');
    expect(typeof civQueries.countDronesAtStation).toBe('function');
  });
});
