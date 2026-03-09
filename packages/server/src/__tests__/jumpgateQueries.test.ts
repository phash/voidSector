import { describe, it, expect } from 'vitest';
import {
  JUMPGATE_DISTANCE_LIMITS,
  JUMPGATE_CONNECTION_LIMITS,
  JUMPGATE_MAX_CHAIN_HOPS,
  JUMPGATE_CHANCE,
  ANCIENT_JUMPGATE_SPAWN_RATE,
  ANCIENT_JUMPGATE_MIN_RANGE,
} from '@void-sector/shared';
import { checkJumpGate, checkAncientJumpGate, generateGateTarget } from '../engine/jumpgates.js';

describe('jumpgate constants', () => {
  it('distance limits scale per level', () => {
    expect(JUMPGATE_DISTANCE_LIMITS[1]).toBe(250);
    expect(JUMPGATE_DISTANCE_LIMITS[2]).toBe(500);
    expect(JUMPGATE_DISTANCE_LIMITS[3]).toBe(2500);
  });

  it('connection limits scale per level', () => {
    expect(JUMPGATE_CONNECTION_LIMITS[1]).toBe(1);
    expect(JUMPGATE_CONNECTION_LIMITS[2]).toBe(2);
    expect(JUMPGATE_CONNECTION_LIMITS[3]).toBe(3);
  });

  it('max chain hops is 10', () => {
    expect(JUMPGATE_MAX_CHAIN_HOPS).toBe(10);
  });
});

describe('ancient jumpgate spawn rate', () => {
  it('ancient gates are much rarer than normal gates', () => {
    expect(ANCIENT_JUMPGATE_SPAWN_RATE).toBeLessThan(JUMPGATE_CHANCE * 0.1);
  });

  it('ancient gate min range exceeds normal max range', () => {
    // Ancient gates bridge multiple quadrants
    expect(ANCIENT_JUMPGATE_MIN_RANGE).toBeGreaterThan(10000);
  });

  it('checkAncientJumpGate returns false for most sectors', () => {
    let ancientCount = 0;
    for (let x = 0; x < 1000; x++) {
      if (checkAncientJumpGate(x, x)) ancientCount++;
    }
    // With 0.0001 rate, expect at most 2 in 1000 (allowing variance)
    expect(ancientCount).toBeLessThanOrEqual(2);
  });

  it('generateGateTarget returns ancient gateType for ancient gates', () => {
    // Find a sector that has an ancient gate
    let ancientSector: { x: number; y: number } | null = null;
    for (let x = 0; x < 100000 && !ancientSector; x += 100) {
      if (checkAncientJumpGate(x, x)) ancientSector = { x, y: x };
    }
    if (ancientSector) {
      const gate = generateGateTarget(ancientSector.x, ancientSector.y, true);
      expect(gate.gateType).toBe('ancient');
      const dist = Math.sqrt(
        (gate.targetX - ancientSector.x) ** 2 + (gate.targetY - ancientSector.y) ** 2,
      );
      expect(dist).toBeGreaterThanOrEqual(ANCIENT_JUMPGATE_MIN_RANGE);
    }
  });

  it('normal checkJumpGate is unaffected by ancient gate changes', () => {
    let normalCount = 0;
    for (let x = 0; x < 1000; x++) {
      if (checkJumpGate(x, 42)) normalCount++;
    }
    // JUMPGATE_CHANCE = 0.005, expect far fewer than 100 in 1000
    expect(normalCount).toBeGreaterThan(0);
    expect(normalCount).toBeLessThan(100);
  });
});
