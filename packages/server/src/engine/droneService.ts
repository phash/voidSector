/**
 * DroneService — idle resource automation system.
 * Manages drone lifecycle: deployment, mining, returning, repair.
 */

export type DroneType = 'scout' | 'harvester' | 'industrial';
export type DroneStatus = 'idle' | 'mining' | 'returning' | 'damaged';
export type MissionType = 'ship_mining' | 'base_patrol' | 'route_mission';
export type ScheduleType = 'daily' | 'every_2_days' | 'weekly';

export interface DroneStats {
  maxCapacity: number; // cargo units
  miningDurationMinutes: number; // minutes per mining cycle
  range: number; // sector radius
  durationHours: number; // operational hours before returning
  costOre: number;
  costCrystal: number;
  costExotic: number;
}

export const DRONE_STATS: Record<DroneType, DroneStats> = {
  scout: {
    maxCapacity: 50,
    miningDurationMinutes: 5,
    range: 1,
    durationHours: 8,
    costOre: 100,
    costCrystal: 0,
    costExotic: 0,
  },
  harvester: {
    maxCapacity: 200,
    miningDurationMinutes: 10,
    range: 3,
    durationHours: 24,
    costOre: 300,
    costCrystal: 50,
    costExotic: 0,
  },
  industrial: {
    maxCapacity: 500,
    miningDurationMinutes: 20,
    range: 5,
    durationHours: 72,
    costOre: 1000,
    costCrystal: 200,
    costExotic: 50,
  },
};

export interface DroneRecord {
  id: number;
  playerId: string;
  droneType: DroneType;
  status: DroneStatus;
  currentSectorX: number | null;
  currentSectorY: number | null;
  assignedTo: string | null;
  currentLoad: number;
  maxCapacity: number;
  fuelRemaining: number;
  activeSince: number | null;
  lastReturn: number | null;
  damageUntil: number | null;
  totalMined: number;
  totalTrips: number;
}

export interface DroneRouteWaypoint {
  sectorX: number;
  sectorY: number;
  mineDurationMinutes: number;
}

export interface DroneRoute {
  id: number;
  baseId: number;
  playerId: string;
  routeName: string;
  waypoints: DroneRouteWaypoint[];
  totalDurationMinutes: number;
  status: 'active' | 'paused';
  scheduleType: ScheduleType;
  nextStart: number | null;
}

/**
 * Returns cost to purchase a drone of the given type.
 */
export function getDroneCost(type: DroneType): { ore: number; crystal: number; exotic: number } {
  const stats = DRONE_STATS[type];
  return {
    ore: stats.costOre,
    crystal: stats.costCrystal,
    exotic: stats.costExotic,
  };
}

/**
 * Calculates the estimated resource yield for a drone mining cycle.
 */
export function estimateDroneYield(
  droneType: DroneType,
  resourceRate: number, // units per minute from sector
): number {
  const stats = DRONE_STATS[droneType];
  return Math.floor(resourceRate * stats.miningDurationMinutes);
}

/**
 * Calculates how many cycles a drone can complete before needing to return.
 */
export function getMaxCycles(droneType: DroneType): number {
  const stats = DRONE_STATS[droneType];
  return Math.floor((stats.durationHours * 60) / stats.miningDurationMinutes);
}

/**
 * Returns the next scheduled start time for a route based on schedule type.
 */
export function getNextScheduledStart(
  scheduleType: ScheduleType,
  fromTime: number = Date.now(),
): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  switch (scheduleType) {
    case 'daily':
      return fromTime + msPerDay;
    case 'every_2_days':
      return fromTime + 2 * msPerDay;
    case 'weekly':
      return fromTime + 7 * msPerDay;
    default:
      return fromTime + msPerDay;
  }
}

/**
 * Validates a drone route's waypoints.
 * Returns null if valid, error string if invalid.
 */
export function validateDroneRoute(waypoints: DroneRouteWaypoint[]): string | null {
  if (waypoints.length < 1) return 'Route braucht mindestens einen Wegpunkt';
  if (waypoints.length > 8) return 'Route darf maximal 8 Wegpunkte haben';
  for (const wp of waypoints) {
    if (wp.mineDurationMinutes < 5) return 'Mining-Dauer muss mindestens 5 Minuten betragen';
    if (wp.mineDurationMinutes > 120) return 'Mining-Dauer darf maximal 2 Stunden betragen';
  }
  return null;
}

/**
 * Calculates total route duration in minutes.
 */
export function calculateRouteDuration(waypoints: DroneRouteWaypoint[]): number {
  // Sum of mining durations + 10 min travel between each waypoint
  const miningTime = waypoints.reduce((acc, wp) => acc + wp.mineDurationMinutes, 0);
  const travelTime = (waypoints.length + 1) * 10; // +1 for return trip
  return miningTime + travelTime;
}

/**
 * Returns true if a drone can be deployed (not damaged, not already on mission).
 */
export function canDeployDrone(drone: DroneRecord): boolean {
  if (drone.status === 'damaged') {
    // Drone can deploy once damage timer has expired
    return !drone.damageUntil || Date.now() >= drone.damageUntil;
  }
  return drone.status === 'idle';
}
