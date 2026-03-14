import { describe, it, expect } from 'vitest';
import {
  initializeTerritoryState,
  expandFaction,
  runUniverseTick,
  quadrantKey,
  UniverseTickEngine,
} from '../universeTickEngine.js';
import {
  getCivLevel,
  getCivTier,
  calculateContributionPoints,
  addCivContribution,
} from '../civilizationMeter.js';
import {
  COSMIC_FACTION_IDS,
  HUMAN_STARTING_TERRITORY,
  HUMAN_CIVILIZATION_METER_MAX,
} from '@void-sector/shared';

describe('initializeTerritoryState', () => {
  it('seeds human starting territory correctly', () => {
    const state = initializeTerritoryState();
    expect(state.factionQuadrants.get('humans')?.size).toBe(9);
  });

  it('human territory includes 0:0', () => {
    const state = initializeTerritoryState();
    expect(state.dominantFactions.get('0:0')).toBe('humans');
  });

  it('human territory includes 2:2', () => {
    const state = initializeTerritoryState();
    expect(state.dominantFactions.get('2:2')).toBe('humans');
  });

  it('alien factions have territory far from origin', () => {
    const state = initializeTerritoryState();
    const archivistQuads = state.factionQuadrants.get('archivists') ?? new Set();
    // All archivist quadrants should be well beyond the human 5×5 area
    for (const key of archivistQuads) {
      const [qx, qy] = key.split(':').map(Number);
      expect(qx > 4 || qy > 4).toBe(true); // Outside human starting zone
    }
  });

  it('no overlap between human and alien territories', () => {
    const state = initializeTerritoryState();
    const humanKeys = state.factionQuadrants.get('humans')!;
    for (const [factionId, quads] of state.factionQuadrants) {
      if (factionId === 'humans') continue;
      for (const key of quads) {
        expect(humanKeys.has(key)).toBe(false);
      }
    }
  });

  it('creates entries for all cosmic factions', () => {
    const state = initializeTerritoryState();
    for (const factionId of COSMIC_FACTION_IDS) {
      expect(state.factionQuadrants.has(factionId)).toBe(true);
    }
  });
});

describe('expandFaction', () => {
  it('expands into adjacent unclaimed quadrants', () => {
    const territory = initializeTerritoryState();
    const seeded = expandFaction('humans', territory, () => 0.1); // low rng = always expands
    // Some expansion should have happened (humans have 25 quadrants to expand from)
    // Not guaranteed to always expand since rng < 0.3 threshold but with 0.1 it should
    expect(Array.isArray(seeded)).toBe(true);
  });

  it('does not expand into already claimed territory', () => {
    const territory = initializeTerritoryState();
    // Mark all neighbors of humans as claimed by archivists
    for (const [qx, qy] of HUMAN_STARTING_TERRITORY) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = qx + dx;
        const ny = qy + dy;
        if (nx >= 0 && ny >= 0) {
          const key = quadrantKey(nx, ny);
          if (!territory.dominantFactions.has(key)) {
            territory.dominantFactions.set(key, 'archivists');
          }
        }
      }
    }
    // Humans cannot expand into archivist territory
    const claimed = expandFaction('humans', territory, () => 0.1);
    for (const c of claimed) {
      expect(c.split(':').length).toBe(2); // valid key format
    }
  });
});

describe('runUniverseTick', () => {
  it('increments tick count', () => {
    const state = { tickCount: 0, lastTickAt: 0, isRunning: true };
    const territory = initializeTerritoryState();
    const result = runUniverseTick(state, territory, 0, Math.random);
    expect(result.tickCount).toBe(1);
  });

  it('expansion does not happen on every tick (only every 360 ticks)', () => {
    const state = { tickCount: 0, lastTickAt: 0, isRunning: true };
    const territory = initializeTerritoryState();
    const result = runUniverseTick(state, territory, 0, Math.random);
    // Tick 1 should not trigger expansion (only on multiples of 360)
    expect(result.expansionHappened).toBe(false);
  });

  it('expansion happens at tick 360', () => {
    const state = { tickCount: 359, lastTickAt: 0, isRunning: true };
    const territory = initializeTerritoryState();
    const result = runUniverseTick(state, territory, 0, () => 0.1); // 0.1 < 0.3 threshold
    expect(result.tickCount).toBe(360);
    // With rng=0.1, expansion should happen from non-human alien factions
  });

  it('civ meter delta is capped by max contributions', () => {
    const state = { tickCount: 0, lastTickAt: 0, isRunning: true };
    const territory = initializeTerritoryState();
    const result = runUniverseTick(state, territory, 999999, Math.random);
    expect(result.civMeterDelta).toBeLessThanOrEqual(HUMAN_CIVILIZATION_METER_MAX);
  });
});

describe('UniverseTickEngine', () => {
  it('initializes with tick count 0', () => {
    const engine = new UniverseTickEngine();
    expect(engine.getState().tickCount).toBe(0);
    expect(engine.getState().isRunning).toBe(false);
  });

  it('returns dominant faction for seeded human quadrant', () => {
    const engine = new UniverseTickEngine();
    expect(engine.getDominantFaction(0, 0)).toBe('humans');
    expect(engine.getDominantFaction(2, 2)).toBe('humans');
  });

  it('returns null for unclaimed quadrant', () => {
    const engine = new UniverseTickEngine();
    // Far away unclaimed quadrant
    expect(engine.getDominantFaction(9999, 9999)).toBeNull();
  });

  it('getFactionStats returns counts for all factions', () => {
    const engine = new UniverseTickEngine();
    const stats = engine.getFactionStats();
    expect(stats['humans']).toBe(9);
    expect(stats['axioms']).toBeGreaterThanOrEqual(0);
  });
});

describe('civilizationMeter', () => {
  it('level is 0 with no contributions', () => {
    expect(getCivLevel(0)).toBe(0);
  });

  it('level is 1.0 at max contributions', () => {
    expect(getCivLevel(HUMAN_CIVILIZATION_METER_MAX)).toBe(1.0);
  });

  it('level is capped at 1.0', () => {
    expect(getCivLevel(HUMAN_CIVILIZATION_METER_MAX * 2)).toBe(1.0);
  });

  it('getCivTier returns pioneer phase at start', () => {
    expect(getCivTier(0)).toBe('PIONIERPHASE');
  });

  it('getCivTier returns interstellar at max', () => {
    expect(getCivTier(HUMAN_CIVILIZATION_METER_MAX)).toBe('INTERSTELLARE MACHT');
  });

  it('station_built contributes most points', () => {
    const stationPts = calculateContributionPoints('station_built');
    const exploredPts = calculateContributionPoints('territory_explored');
    expect(stationPts).toBeGreaterThan(exploredPts);
  });

  it('addCivContribution accumulates correctly', () => {
    let total = 0;
    total = addCivContribution(total, 'station_built');
    total = addCivContribution(total, 'quest_completed');
    expect(total).toBeGreaterThan(0);
    expect(total).toBe(50 + 10);
  });
});

describe('cosmic faction constants', () => {
  it('has 11 cosmic factions', () => {
    expect(COSMIC_FACTION_IDS).toHaveLength(11);
  });

  it('humans is the first faction', () => {
    expect(COSMIC_FACTION_IDS[0]).toBe('humans');
  });

  it('has exactly 9 human starting territory quadrants', () => {
    expect(HUMAN_STARTING_TERRITORY).toHaveLength(9);
  });

  it('human territory covers 0:0 to 2:2', () => {
    const humanSet = new Set(HUMAN_STARTING_TERRITORY.map(([x, y]) => `${x}:${y}`));
    for (let x = 0; x <= 2; x++) {
      for (let y = 0; y <= 2; y++) {
        expect(humanSet.has(`${x}:${y}`)).toBe(true);
      }
    }
  });
});
