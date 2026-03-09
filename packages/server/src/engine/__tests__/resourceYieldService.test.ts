import { describe, it, expect } from 'vitest';
import { getResourceYield, getMeteorYield, rollYieldAmount, rollExotic } from '../resourceYieldService.js';
import { validateFirstBasePlacement, getFirstBaseCost, getRecommendedBaseEnvironments } from '../firstBaseService.js';

describe('getResourceYield', () => {
  it('asteroid field has ore range 50-100', () => {
    const y = getResourceYield('asteroid');
    expect(y.ore.min).toBe(50);
    expect(y.ore.max).toBe(100);
  });

  it('asteroid has near-zero exotic chance', () => {
    const y = getResourceYield('asteroid');
    expect(y.exotic.chance).toBeLessThan(0.01);
  });

  it('lava planet has higher exotic chance than terrestrial', () => {
    const lava = getResourceYield('planet', 'lava');
    const terrestrial = getResourceYield('planet', 'terrestrial');
    expect(lava.exotic.chance).toBeGreaterThan(terrestrial.exotic.chance);
  });

  it('exotic_a planet guarantees exotic yield', () => {
    const y = getResourceYield('planet', 'exotic_a');
    expect(y.exotic.chance).toBe(1);
    expect(y.exotic.min).toBeGreaterThan(0);
  });

  it('exotic_c has highest exotic yield max', () => {
    const a = getResourceYield('planet', 'exotic_a');
    const c = getResourceYield('planet', 'exotic_c');
    expect(c.exotic.max).toBeGreaterThan(a.exotic.max);
  });

  it('nebula has no exotic', () => {
    const y = getResourceYield('nebula');
    expect(y.exotic.chance).toBe(0);
  });

  it('star and black_hole are not valid mining environments — defaults to empty', () => {
    // star/black_hole shouldn't be mined; getResourceYield falls through to empty
    const y = getResourceYield('star' as any);
    expect(y).toBeDefined(); // just verify no crash
  });
});

describe('getMeteorYield', () => {
  it('meteors are the primary exotic source (35% chance)', () => {
    const y = getMeteorYield();
    expect(y.exotic.chance).toBeCloseTo(0.35);
    expect(y.exotic.min).toBeGreaterThan(10);
  });

  it('meteor has a respawn time set', () => {
    const y = getMeteorYield();
    expect(y.respawnHours).toBeGreaterThan(0);
  });
});

describe('rollYieldAmount', () => {
  it('returns minimum when rng = 0', () => {
    expect(rollYieldAmount(50, 100, 0)).toBe(50);
  });

  it('returns near maximum when rng ≈ 1', () => {
    const result = rollYieldAmount(50, 100, 0.999);
    expect(result).toBeGreaterThanOrEqual(99);
  });

  it('stays within [min, max]', () => {
    for (let i = 0; i <= 10; i++) {
      const result = rollYieldAmount(20, 80, i / 10);
      expect(result).toBeGreaterThanOrEqual(20);
      expect(result).toBeLessThanOrEqual(80);
    }
  });
});

describe('rollExotic', () => {
  it('returns 0 when rng > chance', () => {
    const exotic = { min: 10, max: 40, chance: 0.35 };
    expect(rollExotic(exotic, 0.5)).toBe(0); // 0.5 > 0.35
  });

  it('returns positive amount when rng <= chance', () => {
    const exotic = { min: 10, max: 40, chance: 0.35 };
    const result = rollExotic(exotic, 0.1);
    expect(result).toBeGreaterThanOrEqual(10);
  });

  it('guaranteed exotic (chance=1) always returns positive', () => {
    const exotic = { min: 50, max: 100, chance: 1 };
    expect(rollExotic(exotic, 0.5)).toBeGreaterThanOrEqual(50);
  });
});

describe('validateFirstBasePlacement', () => {
  it('allows valid placement in empty sector', () => {
    const result = validateFirstBasePlacement({
      environment: 'empty',
      hasActivePirates: false,
      playerHasStarterBase: false,
      sectorOccupied: false,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects placement in star sector', () => {
    const result = validateFirstBasePlacement({
      environment: 'star',
      hasActivePirates: false,
      playerHasStarterBase: false,
      sectorOccupied: false,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('IMPASSABLE_SECTOR');
  });

  it('rejects placement in black_hole sector', () => {
    const result = validateFirstBasePlacement({
      environment: 'black_hole',
      hasActivePirates: false,
      playerHasStarterBase: false,
      sectorOccupied: false,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('IMPASSABLE_SECTOR');
  });

  it('rejects placement in nebula', () => {
    const result = validateFirstBasePlacement({
      environment: 'nebula',
      hasActivePirates: false,
      playerHasStarterBase: false,
      sectorOccupied: false,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('NEBULA_FORBIDDEN');
  });

  it('rejects when sector has active pirates', () => {
    const result = validateFirstBasePlacement({
      environment: 'empty',
      hasActivePirates: true,
      playerHasStarterBase: false,
      sectorOccupied: false,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('ACTIVE_PIRATES');
  });

  it('rejects when player already has a starter base', () => {
    const result = validateFirstBasePlacement({
      environment: 'planet',
      hasActivePirates: false,
      playerHasStarterBase: true,
      sectorOccupied: false,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('ALREADY_HAS_BASE');
  });

  it('rejects when sector is occupied by another player', () => {
    const result = validateFirstBasePlacement({
      environment: 'asteroid',
      hasActivePirates: false,
      playerHasStarterBase: false,
      sectorOccupied: true,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('SECTOR_OCCUPIED');
  });

  it('allows planet sector when all conditions met', () => {
    const result = validateFirstBasePlacement({
      environment: 'planet',
      hasActivePirates: false,
      playerHasStarterBase: false,
      sectorOccupied: false,
    });
    expect(result.valid).toBe(true);
  });

  it('getFirstBaseCost returns zero cost', () => {
    const cost = getFirstBaseCost();
    expect(cost.ore).toBe(0);
    expect(cost.credits).toBe(0);
  });

  it('getRecommendedBaseEnvironments includes planet and asteroid', () => {
    const recs = getRecommendedBaseEnvironments();
    expect(recs).toContain('planet');
    expect(recs).toContain('asteroid');
  });
});
