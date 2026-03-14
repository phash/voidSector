import { describe, it, expect } from 'vitest';
import {
  checkJumpGate,
  generateGateTarget,
  getDirectionFromAngle,
  calculateDirection,
} from '../jumpgates.js';

describe('JumpGate Generation', () => {
  it('checkJumpGate always returns false (natural jumpgates disabled)', () => {
    expect(checkJumpGate(100, 200)).toBe(false);
    expect(checkJumpGate(0, 0)).toBe(false);
    expect(checkJumpGate(9999, 9999)).toBe(false);
  });

  it('should generate targets within range', () => {
    const target = generateGateTarget(50, 50);
    expect(target.targetX).toBeDefined();
    expect(target.targetY).toBeDefined();
    const dist = Math.sqrt((target.targetX - 50) ** 2 + (target.targetY - 50) ** 2);
    expect(dist).toBeGreaterThanOrEqual(49); // slight rounding tolerance
    expect(dist).toBeLessThanOrEqual(10002); // slight rounding tolerance
  });

  it('should return false for all sectors (natural jumpgates disabled)', () => {
    let count = 0;
    for (let i = 0; i < 1000; i++) {
      if (checkJumpGate(i * 3 + 1, i * 7 + 2)) count++;
    }
    expect(count).toBe(0);
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
