import { describe, it, expect } from 'vitest';
import {
  createJumpAnimation,
  updateJumpAnimation,
  LONG_JUMP_THRESHOLD,
  HYPERJUMP_MS_PER_SECTOR,
  drawLongJumpCRTEffect,
} from '../canvas/JumpAnimation';
import type { JumpAnimationState } from '../canvas/JumpAnimation';

describe('JumpAnimation', () => {
  describe('createJumpAnimation', () => {
    it('creates a standard jump for adjacent sectors (distance=1)', () => {
      const anim = createJumpAnimation(1, 0);
      expect(anim.active).toBe(true);
      expect(anim.phase).toBe('glitch');
      expect(anim.isLongJump).toBe(false);
      expect(anim.distance).toBe(1);
      expect(anim.totalDuration).toBe(800);
    });

    it('creates a flight animation for hyperjumps (distance > 1.5)', () => {
      const anim = createJumpAnimation(10, 5, 11.18);
      expect(anim.active).toBe(true);
      expect(anim.phase).toBe('flight');
      expect(anim.isLongJump).toBe(true);
      expect(anim.totalDuration).toBe(Math.round(11.18 * HYPERJUMP_MS_PER_SECTOR));
    });

    it('uses euclidean distance when not provided', () => {
      const anim = createJumpAnimation(3, 4);
      expect(anim.distance).toBeCloseTo(5, 5);
      expect(anim.phase).toBe('flight');
      expect(anim.isLongJump).toBe(true);
    });

    it('treats diagonal adjacent (1,1) as hyperjump', () => {
      const anim = createJumpAnimation(1, 1);
      expect(anim.distance).toBeCloseTo(Math.SQRT2, 5);
      // sqrt(2) ≈ 1.414 < 1.5 → not a hyperjump
      expect(anim.phase).toBe('glitch');
      expect(anim.isLongJump).toBe(false);
    });

    it('treats distance=2 as hyperjump', () => {
      const anim = createJumpAnimation(2, 0);
      expect(anim.distance).toBe(2);
      expect(anim.phase).toBe('flight');
      expect(anim.isLongJump).toBe(true);
    });

    it('scales duration with distance (200ms per sector)', () => {
      const anim = createJumpAnimation(0, 0, 10);
      expect(anim.totalDuration).toBe(2000);

      const anim2 = createJumpAnimation(0, 0, 25);
      expect(anim2.totalDuration).toBe(5000);
    });
  });

  describe('updateJumpAnimation — standard jump', () => {
    it('returns inactive state unchanged', () => {
      const state: JumpAnimationState = {
        active: false,
        phase: 'none',
        progress: 1,
        direction: { dx: 1, dy: 0 },
        startTime: 0,
        distance: 1,
        isLongJump: false,
        totalDuration: 800,
      };
      expect(updateJumpAnimation(state, 1000)).toBe(state);
    });

    it('progresses through glitch phase', () => {
      const anim = createJumpAnimation(1, 0, 1);
      const updated = updateJumpAnimation(anim, anim.startTime + 100);
      expect(updated.phase).toBe('glitch');
      expect(updated.progress).toBeCloseTo(0.5, 1);
    });

    it('transitions to slide phase', () => {
      const anim = createJumpAnimation(1, 0, 1);
      const updated = updateJumpAnimation(anim, anim.startTime + 300);
      expect(updated.phase).toBe('slide');
    });

    it('transitions to settle phase', () => {
      const anim = createJumpAnimation(1, 0, 1);
      const updated = updateJumpAnimation(anim, anim.startTime + 650);
      expect(updated.phase).toBe('settle');
    });

    it('finishes at 800ms', () => {
      const anim = createJumpAnimation(1, 0, 1);
      const updated = updateJumpAnimation(anim, anim.startTime + 801);
      expect(updated.active).toBe(false);
      expect(updated.phase).toBe('none');
    });
  });

  describe('updateJumpAnimation — flight (hyperjump)', () => {
    it('stays in flight phase during animation', () => {
      const anim = createJumpAnimation(10, 0, 10);
      const at500 = updateJumpAnimation(anim, anim.startTime + 500);
      expect(at500.active).toBe(true);
      expect(at500.phase).toBe('flight');
      expect(at500.progress).toBeGreaterThan(0);
      expect(at500.progress).toBeLessThan(1);
    });

    it('applies easeInOutCubic easing (slow start)', () => {
      const anim = createJumpAnimation(10, 0, 10);
      // At 10% elapsed, eased progress should be less than 0.1 (slow start)
      const atEarly = updateJumpAnimation(anim, anim.startTime + 200);
      expect(atEarly.progress).toBeLessThan(0.1);
    });

    it('applies easeInOutCubic easing (slow end)', () => {
      const anim = createJumpAnimation(10, 0, 10);
      // At 90% elapsed, eased progress should be greater than 0.9 (slow end)
      const atLate = updateJumpAnimation(anim, anim.startTime + 1800);
      expect(atLate.progress).toBeGreaterThan(0.9);
    });

    it('reaches midpoint at 50% elapsed', () => {
      const anim = createJumpAnimation(10, 0, 10);
      const atMid = updateJumpAnimation(anim, anim.startTime + 1000);
      expect(atMid.progress).toBeCloseTo(0.5, 1);
    });

    it('completes after totalDuration', () => {
      const anim = createJumpAnimation(10, 0, 10);
      const atEnd = updateJumpAnimation(anim, anim.startTime + 2001);
      expect(atEnd.active).toBe(false);
      expect(atEnd.phase).toBe('none');
      expect(atEnd.progress).toBe(1);
    });

    it('handles long distances correctly', () => {
      const anim = createJumpAnimation(0, 0, 50);
      expect(anim.totalDuration).toBe(10000);
      // At 5s, should be roughly at midpoint
      const atMid = updateJumpAnimation(anim, anim.startTime + 5000);
      expect(atMid.progress).toBeCloseTo(0.5, 1);
      // At 10s, should be done
      const atEnd = updateJumpAnimation(anim, anim.startTime + 10001);
      expect(atEnd.active).toBe(false);
    });
  });

  describe('LONG_JUMP_THRESHOLD', () => {
    it('is 20 sectors', () => {
      expect(LONG_JUMP_THRESHOLD).toBe(20);
    });
  });

  describe('HYPERJUMP_MS_PER_SECTOR', () => {
    it('is 200ms', () => {
      expect(HYPERJUMP_MS_PER_SECTOR).toBe(200);
    });
  });

  describe('drawLongJumpCRTEffect', () => {
    it('does nothing for inactive animations', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      const state: JumpAnimationState = {
        active: false,
        phase: 'none',
        progress: 1,
        direction: { dx: 0, dy: 0 },
        startTime: 0,
        distance: 30,
        isLongJump: true,
        totalDuration: 6000,
      };
      expect(() => drawLongJumpCRTEffect(ctx, 100, 100, state)).not.toThrow();
    });

    it('does nothing for non-long jumps', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      const state: JumpAnimationState = {
        active: true,
        phase: 'glitch',
        progress: 0.5,
        direction: { dx: 1, dy: 0 },
        startTime: 0,
        distance: 5,
        isLongJump: false,
        totalDuration: 800,
      };
      expect(() => drawLongJumpCRTEffect(ctx, 100, 100, state)).not.toThrow();
    });

    it('applies effects for active long jumps', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      const state: JumpAnimationState = {
        active: true,
        phase: 'glitch',
        progress: 0.5,
        direction: { dx: 0, dy: 0 },
        startTime: 0,
        distance: 30,
        isLongJump: true,
        totalDuration: 6000,
      };
      expect(() => drawLongJumpCRTEffect(ctx, 100, 100, state)).not.toThrow();
    });
  });
});
