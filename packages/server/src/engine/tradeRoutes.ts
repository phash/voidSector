import {
  TRADE_ROUTE_MIN_CYCLE,
  TRADE_ROUTE_MAX_CYCLE,
  TRADE_ROUTE_FUEL_PER_DISTANCE,
  MAX_TRADE_ROUTES,
} from '@void-sector/shared';
import { getConfig } from './gameConfigApply.js';

export function isRouteCycleDue(lastCycleAt: number | null, cycleMinutes: number): boolean {
  if (!lastCycleAt) return true;
  const elapsed = Date.now() - lastCycleAt;
  return elapsed >= cycleMinutes * 60 * 1000;
}

export function calculateRouteFuelCost(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  const dist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
  return Math.ceil(
    dist *
      ((getConfig('TRADE_ROUTE_FUEL_PER_DISTANCE') as typeof TRADE_ROUTE_FUEL_PER_DISTANCE) ??
        TRADE_ROUTE_FUEL_PER_DISTANCE),
  );
}

export function validateRouteConfig(config: { cycleMinutes: number; routeCount?: number }): {
  valid: boolean;
  error?: string;
} {
  if (
    config.cycleMinutes <
    ((getConfig('TRADE_ROUTE_MIN_CYCLE') as typeof TRADE_ROUTE_MIN_CYCLE) ?? TRADE_ROUTE_MIN_CYCLE)
  ) {
    return { valid: false, error: `Minimum cycle is ${TRADE_ROUTE_MIN_CYCLE} minutes` };
  }
  if (
    config.cycleMinutes >
    ((getConfig('TRADE_ROUTE_MAX_CYCLE') as typeof TRADE_ROUTE_MAX_CYCLE) ?? TRADE_ROUTE_MAX_CYCLE)
  ) {
    return { valid: false, error: `Maximum cycle is ${TRADE_ROUTE_MAX_CYCLE} minutes` };
  }
  if (
    config.routeCount !== undefined &&
    config.routeCount >=
      ((getConfig('MAX_TRADE_ROUTES') as typeof MAX_TRADE_ROUTES) ?? MAX_TRADE_ROUTES)
  ) {
    return { valid: false, error: `Maximum ${MAX_TRADE_ROUTES} routes allowed` };
  }
  return { valid: true };
}
