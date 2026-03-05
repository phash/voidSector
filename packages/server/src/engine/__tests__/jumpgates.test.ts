import { describe, it, expect } from 'vitest';
import {
  checkJumpGate,
  generateGateTarget,
  getDirectionFromAngle,
  calculateDirection,
} from '../jumpgates.js';

describe('JumpGate Generation', () => {
  it('should deterministically detect gates', () => {
    const result1 = checkJumpGate(100, 200);
    const result2 = checkJumpGate(100, 200);
    expect(result1).toBe(result2);
  });

  it('should generate targets within range', () => {
    const target = generateGateTarget(50, 50);
    expect(target.targetX).toBeDefined();
    expect(target.targetY).toBeDefined();
    const dist = Math.sqrt((target.targetX - 50) ** 2 + (target.targetY - 50) ** 2);
    expect(dist).toBeGreaterThanOrEqual(49); // slight rounding tolerance
    expect(dist).toBeLessThanOrEqual(10002); // slight rounding tolerance
  });

  it('should respect JUMPGATE_CHANCE probability (~2%)', () => {
    let count = 0;
    for (let i = 0; i < 10000; i++) {
      if (checkJumpGate(i, i * 7)) count++;
    }
    expect(count / 10000).toBeGreaterThan(0.01);
    expect(count / 10000).toBeLessThan(0.04);
  });

  it('should convert angles to compass directions', () => {
    expect(getDirectionFromAngle(0)).toBe('E');
    expect(getDirectionFromAngle(90)).toBe('N');
    expect(getDirectionFromAngle(180)).toBe('W');
    expect(getDirectionFromAngle(270)).toBe('S');
    expect(getDirectionFromAngle(45)).toBe('NE');
  });

  it('should calculate direction between two points', () => {
    expect(calculateDirection(0, 0, 10, 0)).toBe('E');
    expect(calculateDirection(0, 0, 0, 10)).toBe('N');
    expect(calculateDirection(0, 0, -10, 0)).toBe('W');
  });

  it('should generate deterministic gate properties', () => {
    const g1 = generateGateTarget(500, 500);
    const g2 = generateGateTarget(500, 500);
    expect(g1.targetX).toBe(g2.targetX);
    expect(g1.gateType).toBe(g2.gateType);
    expect(g1.requiresCode).toBe(g2.requiresCode);
    expect(g1.accessCode).toBe(g2.accessCode);
  });
});
