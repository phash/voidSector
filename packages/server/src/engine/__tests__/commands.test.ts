import { describe, it, expect } from 'vitest';
import { validateJump, validateScan, validateMine, validateJettison, validateLocalScan, validateAreaScan } from '../commands.js';
import { createMiningState } from '../mining.js';
import { createAPState } from '../ap.js';
import { AP_COSTS } from '@void-sector/shared';

describe('validateJump', () => {
  const fullAP = { current: 100, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };

  it('valid jump within range', () => {
    const result = validateJump(fullAP, 0, 0, 1, 0, 4, AP_COSTS.jump);
    expect(result.valid).toBe(true);
    expect(result.newAP).toBeDefined();
    expect(result.newAP!.current).toBe(100 - AP_COSTS.jump);
  });

  it('rejects jump to same position', () => {
    const result = validateJump(fullAP, 5, 5, 5, 5, 4, AP_COSTS.jump);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('range');
  });

  it('rejects jump beyond range', () => {
    const result = validateJump(fullAP, 0, 0, 10, 0, 4, AP_COSTS.jump);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('range');
  });

  it('rejects jump with insufficient AP', () => {
    const lowAP = { ...fullAP, current: 0 };
    const result = validateJump(lowAP, 0, 0, 1, 0, 4, AP_COSTS.jump);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('AP');
  });

  it('rejects jump while mining is active', () => {
    const result = validateJump(fullAP, 0, 0, 1, 0, 4, AP_COSTS.jump, true);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('mining');
  });

  it('allows jump when not mining', () => {
    const result = validateJump(fullAP, 0, 0, 1, 0, 4, AP_COSTS.jump, false);
    expect(result.valid).toBe(true);
  });
});

describe('validateScan', () => {
  it('valid scan with enough AP', () => {
    const ap = { current: 10, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = validateScan(ap, AP_COSTS.scan);
    expect(result.valid).toBe(true);
    expect(result.newAP!.current).toBe(10 - AP_COSTS.scan);
  });

  it('rejects scan with insufficient AP', () => {
    const ap = { current: 1, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = validateScan(ap, AP_COSTS.scan);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('AP');
  });
});

describe('validateMine', () => {
  const resources = { ore: 20, gas: 5, crystal: 0 };
  const inactive = createMiningState();

  it('valid mine start', () => {
    const result = validateMine('ore', resources, inactive, 0, 50, 3, -2);
    expect(result.valid).toBe(true);
    expect(result.state).toBeDefined();
    expect(result.state!.active).toBe(true);
    expect(result.state!.resource).toBe('ore');
  });

  it('rejects mining when already active', () => {
    const active = { ...inactive, active: true, resource: 'gas' as const };
    const result = validateMine('ore', resources, active, 0, 50, 3, -2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Already mining');
  });

  it('rejects mining unavailable resource', () => {
    const result = validateMine('crystal', resources, inactive, 0, 50, 3, -2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('crystal');
  });

  it('rejects mining when cargo full', () => {
    const result = validateMine('ore', resources, inactive, 50, 50, 3, -2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('full');
  });

  it('rejects invalid resource type', () => {
    const result = validateMine('unobtanium' as any, resources, inactive, 0, 50, 3, -2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid');
  });
});

describe('validateJettison', () => {
  it('valid jettison', () => {
    const result = validateJettison('ore', 10);
    expect(result.valid).toBe(true);
  });

  it('rejects jettison of empty resource', () => {
    const result = validateJettison('ore', 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No ore');
  });

  it('rejects invalid resource type', () => {
    const result = validateJettison('unobtanium' as any, 10);
    expect(result.valid).toBe(false);
  });
});

describe('validateLocalScan', () => {
  it('succeeds with sufficient AP', () => {
    const now = Date.now();
    const ap = createAPState(now);
    const result = validateLocalScan(ap, 1, 1);
    expect(result.valid).toBe(true);
    expect(result.newAP).toBeDefined();
  });

  it('fails with insufficient AP', () => {
    const now = Date.now();
    const ap = { ...createAPState(now), current: 0 };
    const result = validateLocalScan(ap, 1, 1);
    expect(result.valid).toBe(false);
  });

  it('reports hidden signatures for low scanner level', () => {
    const now = Date.now();
    const ap = createAPState(now);
    const result1 = validateLocalScan(ap, 1, 1);
    expect(result1.hiddenSignatures).toBe(true);
    const result3 = validateLocalScan(ap, 1, 3);
    expect(result3.hiddenSignatures).toBe(false);
  });
});

describe('validateAreaScan', () => {
  it('returns correct radius for scanner level 1', () => {
    const now = Date.now();
    const ap = createAPState(now);
    const result = validateAreaScan(ap, 1);
    expect(result.valid).toBe(true);
    expect(result.radius).toBe(2);
    expect(result.cost).toBe(3);
  });

  it('returns correct radius for scanner level 3', () => {
    const now = Date.now();
    const ap = createAPState(now);
    const result = validateAreaScan(ap, 3);
    expect(result.valid).toBe(true);
    expect(result.radius).toBe(5);
    expect(result.cost).toBe(8);
  });

  it('fails with insufficient AP', () => {
    const now = Date.now();
    const ap = { ...createAPState(now), current: 2 };
    const result = validateAreaScan(ap, 1);
    expect(result.valid).toBe(false);
  });
});
