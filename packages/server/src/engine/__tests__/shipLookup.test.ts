import { describe, it, expect } from 'vitest';
import { SHIP_CLASSES } from '@void-sector/shared';
import type { ShipClass } from '@void-sector/shared';

describe('ship class lookup', () => {
  it('SHIP_CLASSES contains all defined ship classes', () => {
    const classes: ShipClass[] = ['aegis_scout_mk1', 'void_seeker_mk2'];
    for (const cls of classes) {
      expect(SHIP_CLASSES[cls]).toBeDefined();
      expect(SHIP_CLASSES[cls].jumpRange).toBeGreaterThan(0);
      expect(SHIP_CLASSES[cls].cargoCap).toBeGreaterThan(0);
      expect(SHIP_CLASSES[cls].scannerLevel).toBeGreaterThanOrEqual(1);
    }
  });

  it('resolveShipStats returns correct stats for a ship class key', () => {
    const stats = SHIP_CLASSES['aegis_scout_mk1'];
    expect(stats.jumpRange).toBe(4);
    expect(stats.cargoCap).toBe(5);
    expect(stats.scannerLevel).toBe(1);
  });
});
