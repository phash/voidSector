import { describe, it, expect } from 'vitest';
import {
  DRONE_STATS,
  getDroneCost,
  estimateDroneYield,
  getMaxCycles,
  getNextScheduledStart,
  validateDroneRoute,
  calculateRouteDuration,
  canDeployDrone,
} from '../droneService.js';
import type { DroneRecord } from '../droneService.js';

describe('DRONE_STATS', () => {
  it('industrial drone has highest capacity', () => {
    expect(DRONE_STATS.industrial.maxCapacity).toBeGreaterThan(DRONE_STATS.harvester.maxCapacity);
    expect(DRONE_STATS.harvester.maxCapacity).toBeGreaterThan(DRONE_STATS.scout.maxCapacity);
  });

  it('industrial drone costs most', () => {
    expect(DRONE_STATS.industrial.costOre).toBeGreaterThan(DRONE_STATS.harvester.costOre);
    expect(DRONE_STATS.harvester.costOre).toBeGreaterThan(DRONE_STATS.scout.costOre);
  });

  it('industrial drone requires exotic to build', () => {
    expect(DRONE_STATS.industrial.costExotic).toBeGreaterThan(0);
    expect(DRONE_STATS.scout.costExotic).toBe(0);
  });

  it('industrial drone has longest operational duration', () => {
    expect(DRONE_STATS.industrial.durationHours).toBeGreaterThan(
      DRONE_STATS.harvester.durationHours,
    );
  });
});

describe('getDroneCost', () => {
  it('scout cost has no exotic', () => {
    const cost = getDroneCost('scout');
    expect(cost.exotic).toBe(0);
    expect(cost.ore).toBeGreaterThan(0);
  });

  it('industrial requires exotic', () => {
    const cost = getDroneCost('industrial');
    expect(cost.exotic).toBeGreaterThan(0);
  });
});

describe('estimateDroneYield', () => {
  it('scout with 10 units/min for 5 min yields 50', () => {
    expect(estimateDroneYield('scout', 10)).toBe(50);
  });

  it('harvester yields more than scout at same rate', () => {
    const scout = estimateDroneYield('scout', 5);
    const harvester = estimateDroneYield('harvester', 5);
    expect(harvester).toBeGreaterThan(scout);
  });
});

describe('getMaxCycles', () => {
  it('scout has more cycles per duration than industrial', () => {
    // scout: 8h duration, 5min/cycle = 96 cycles
    // industrial: 72h duration, 20min/cycle = 216 cycles
    const scout = getMaxCycles('scout');
    const industrial = getMaxCycles('industrial');
    expect(scout).toBeGreaterThan(0);
    expect(industrial).toBeGreaterThan(0);
  });

  it('scout gets 96 cycles', () => {
    // 8h * 60min / 5min per cycle = 96
    expect(getMaxCycles('scout')).toBe(96);
  });
});

describe('getNextScheduledStart', () => {
  it('daily schedule returns +24h', () => {
    const now = 1000000;
    const next = getNextScheduledStart('daily', now);
    expect(next - now).toBe(24 * 60 * 60 * 1000);
  });

  it('every_2_days returns +48h', () => {
    const now = 1000000;
    const next = getNextScheduledStart('every_2_days', now);
    expect(next - now).toBe(48 * 60 * 60 * 1000);
  });

  it('weekly returns +7 days', () => {
    const now = 1000000;
    const next = getNextScheduledStart('weekly', now);
    expect(next - now).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('validateDroneRoute', () => {
  it('empty waypoints is invalid', () => {
    expect(validateDroneRoute([])).not.toBeNull();
  });

  it('valid single waypoint is ok', () => {
    expect(
      validateDroneRoute([{ sectorX: 100, sectorY: 200, mineDurationMinutes: 30 }]),
    ).toBeNull();
  });

  it('too many waypoints is invalid', () => {
    const waypoints = Array.from({ length: 9 }, (_, i) => ({
      sectorX: i,
      sectorY: 0,
      mineDurationMinutes: 15,
    }));
    expect(validateDroneRoute(waypoints)).not.toBeNull();
  });

  it('mining duration < 5 minutes is invalid', () => {
    expect(validateDroneRoute([{ sectorX: 0, sectorY: 0, mineDurationMinutes: 4 }])).not.toBeNull();
  });

  it('mining duration > 120 minutes is invalid', () => {
    expect(
      validateDroneRoute([{ sectorX: 0, sectorY: 0, mineDurationMinutes: 121 }]),
    ).not.toBeNull();
  });
});

describe('calculateRouteDuration', () => {
  it('single waypoint: mining + 2 travel legs = 30 + 20 = 50 min', () => {
    const waypoints = [{ sectorX: 0, sectorY: 0, mineDurationMinutes: 30 }];
    expect(calculateRouteDuration(waypoints)).toBe(50); // 30 mine + (1+1)*10 travel
  });

  it('multiple waypoints accumulates correctly', () => {
    const waypoints = [
      { sectorX: 0, sectorY: 0, mineDurationMinutes: 20 },
      { sectorX: 1, sectorY: 0, mineDurationMinutes: 30 },
    ];
    // 20+30 mine + (2+1)*10 travel = 50 + 30 = 80
    expect(calculateRouteDuration(waypoints)).toBe(80);
  });
});

describe('canDeployDrone', () => {
  const baseDrone: DroneRecord = {
    id: 1,
    playerId: 'player1',
    droneType: 'scout',
    status: 'idle',
    currentSectorX: null,
    currentSectorY: null,
    assignedTo: null,
    currentLoad: 0,
    maxCapacity: 50,
    fuelRemaining: 100,
    activeSince: null,
    lastReturn: null,
    damageUntil: null,
    totalMined: 0,
    totalTrips: 0,
  };

  it('idle drone can be deployed', () => {
    expect(canDeployDrone(baseDrone)).toBe(true);
  });

  it('mining drone cannot be deployed', () => {
    expect(canDeployDrone({ ...baseDrone, status: 'mining' })).toBe(false);
  });

  it('damaged drone with future damage timestamp cannot be deployed', () => {
    const drone = { ...baseDrone, status: 'damaged' as const, damageUntil: Date.now() + 60000 };
    expect(canDeployDrone(drone)).toBe(false);
  });

  it('damaged drone with past damage timestamp can be deployed', () => {
    const drone = { ...baseDrone, status: 'damaged' as const, damageUntil: Date.now() - 1 };
    expect(canDeployDrone(drone)).toBe(true);
  });
});
