import { describe, it, expect } from 'vitest';
import {
  RESOURCE_REGEN_DELAY_TICKS,
  RESOURCE_REGEN_INTERVAL_TICKS,
} from '@void-sector/shared';

// Test the regen formula in isolation (same logic as in getSector)
function applyRegen(
  current: number,
  max: number,
  lastMinedTick: number | null,
  currentTick: number,
): number {
  if (lastMinedTick === null || max <= 0) return current;
  const ticksSinceMined = currentTick - lastMinedTick;
  if (ticksSinceMined <= RESOURCE_REGEN_DELAY_TICKS) return current;
  const regen = Math.floor(
    (ticksSinceMined - RESOURCE_REGEN_DELAY_TICKS) / RESOURCE_REGEN_INTERVAL_TICKS,
  );
  return Math.min(max, current + regen);
}

describe('tick-based resource regeneration', () => {
  it('no regen during delay period (50 ticks)', () => {
    expect(applyRegen(5, 20, 1000, 1049)).toBe(5);
    expect(applyRegen(5, 20, 1000, 1050)).toBe(5);
  });

  it('regens 1 unit per 12 ticks after delay', () => {
    expect(applyRegen(5, 20, 1000, 1062)).toBe(6);
    expect(applyRegen(5, 20, 1000, 1074)).toBe(7);
  });

  it('caps at max', () => {
    expect(applyRegen(18, 20, 1000, 2000)).toBe(20);
  });

  it('no regen when lastMinedTick is null', () => {
    expect(applyRegen(5, 20, null, 2000)).toBe(5);
  });

  it('per-resource independent regen', () => {
    const oreCurrent = applyRegen(3, 10, 1000, 1200);
    const gasCurrent = applyRegen(0, 5, 1100, 1200);
    expect(oreCurrent).toBe(10);
    expect(gasCurrent).toBe(4);
  });
});
