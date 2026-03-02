import { AP_DEFAULTS } from '@void-sector/shared';
import type { APState } from '@void-sector/shared';

export function createAPState(now: number = Date.now()): APState {
  return {
    current: AP_DEFAULTS.startingAP,
    max: AP_DEFAULTS.max,
    lastTick: now,
    regenPerSecond: AP_DEFAULTS.regenPerSecond,
  };
}

export function calculateCurrentAP(ap: APState, now: number = Date.now()): APState {
  const elapsed = (now - ap.lastTick) / 1000;
  if (elapsed <= 0) return { ...ap, lastTick: now };

  const regenerated = elapsed * ap.regenPerSecond;
  const newCurrent = Math.min(ap.max, ap.current + regenerated);

  return {
    ...ap,
    current: Math.floor(newCurrent),
    lastTick: now,
  };
}

/**
 * Regenerates AP first (lazy evaluation), then attempts to spend.
 * Returns new AP state if successful, null if insufficient AP.
 */
export function spendAP(
  ap: APState,
  cost: number,
  now: number = Date.now()
): APState | null {
  const updated = calculateCurrentAP(ap, now);
  if (updated.current < cost) return null;
  return { ...updated, current: updated.current - cost };
}
