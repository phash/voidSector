import { AP_DEFAULTS, calculateApRegen } from '@void-sector/shared';
import type { APState, ShipModule } from '@void-sector/shared';

export function createAPState(now: number = Date.now(), modules?: ShipModule[]): APState {
  return {
    current: AP_DEFAULTS.startingAP,
    max: AP_DEFAULTS.max,
    lastTick: now,
    regenPerSecond: modules !== undefined ? calculateApRegen(modules) : AP_DEFAULTS.regenPerSecond,
  };
}

export function calculateCurrentAP(ap: APState, now: number = Date.now()): APState {
  // Guard against corrupted state (NaN from stale Redis data)
  const safeCurrent = isNaN(ap.current) ? AP_DEFAULTS.startingAP : ap.current;
  const safeRegen = isNaN(ap.regenPerSecond) ? AP_DEFAULTS.regenPerSecond : ap.regenPerSecond;
  const safeLastTick = isNaN(ap.lastTick) ? now : ap.lastTick;
  const safeMax = isNaN(ap.max) ? AP_DEFAULTS.max : ap.max;

  const elapsed = (now - safeLastTick) / 1000;
  if (elapsed <= 0) return { ...ap, current: safeCurrent, regenPerSecond: safeRegen, max: safeMax, lastTick: now };

  const regenerated = elapsed * safeRegen;
  const newCurrent = Math.min(safeMax, safeCurrent + regenerated);

  return {
    ...ap,
    current: Math.floor(newCurrent),
    max: safeMax,
    regenPerSecond: safeRegen,
    lastTick: now,
  };
}

/**
 * Regenerates AP first (lazy evaluation), then attempts to spend.
 * Returns new AP state if successful, null if insufficient AP.
 */
export function spendAP(ap: APState, cost: number, now: number = Date.now()): APState | null {
  const updated = calculateCurrentAP(ap, now);
  if (updated.current < cost) return null;
  return { ...updated, current: Math.floor(updated.current - cost) };
}
