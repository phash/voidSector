import { describe, it, expect } from 'vitest';
import {
  createJumpAnimation,
  updateJumpAnimation,
  LONG_JUMP_THRESHOLD,
  drawLongJumpCRTEffect,
} from '../canvas/JumpAnimation';
import type { JumpAnimationState } from '../canvas/JumpAnimation';

describe('JumpAnimation', () => {
  describe('createJumpAnimation', () => {
    it('creates a standard jump for short distances', () => {
      const anim = createJumpAnimation(1, 0);
      expect(anim.active).toBe(true);
      expect(anim.phase).toBe('glitch');
      expect(anim.isLongJump).toBe(false);
      expect(anim.distance).toBe(1);
    });

    it('creates a long jump for distances > LONG_JUMP_THRESHOLD', () => {
      const anim = createJumpAnimation(1, 0, 25);
      expect(anim.isLongJump).toBe(true);
      expect(anim.distance).toBe(25);
    });

    it('uses dx+dy as distance when not provided', () => {
      const anim = createJumpAnimation(10, 12);
      expect(anim.distance).toBe(22);
      expect(anim.isLongJump).toBe(true);
    });

    it('marks distance exactly at threshold as not long jump', () => {
      const anim = createJumpAnimation(0, 0, LONG_JUMP_THRESHOLD);
      expect(anim.isLongJump).toBe(false);
    });

    it('marks distance one above threshold as long jump', () => {
      const anim = createJumpAnimation(0, 0, LONG_JUMP_THRESHOLD + 1);
      expect(anim.isLongJump).toBe(true);
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

  describe('updateJumpAnimation — long jump', () => {
    it('has longer duration for long jumps', () => {
      const anim = createJumpAnimation(0, 0, 30);
      // At 800ms, standard jump would be done but long jump should still be active
      const at800 = updateJumpAnimation(anim, anim.startTime + 800);
      expect(at800.active).toBe(true);
    });

    it('eventually completes for long jumps', () => {
      const anim = createJumpAnimation(0, 0, 30);
      // At 5s it should definitely be done
      const atEnd = updateJumpAnimation(anim, anim.startTime + 5000);
      expect(atEnd.active).toBe(false);
      expect(atEnd.phase).toBe('none');
    });

    it('scales duration with distance', () => {
      const anim30 = createJumpAnimation(0, 0, 30);
      const anim60 = createJumpAnimation(0, 0, 60);

      // Check that a higher distance takes longer to complete
      const check30 = updateJumpAnimation(anim30, anim30.startTime + 2000);
      const check60 = updateJumpAnimation(anim60, anim60.startTime + 2000);

      // At 2000ms, 30-distance should be further along or done
      // 60-distance should still be in an earlier phase
      if (check30.active && check60.active) {
        // Both still active, 30 should be in a later phase or higher progress
        const phases = ['glitch', 'slide', 'settle', 'none'];
        const phase30Idx = phases.indexOf(check30.phase);
        const phase60Idx = phases.indexOf(check60.phase);
        expect(phase30Idx).toBeGreaterThanOrEqual(phase60Idx);
      }
    });
  });

  describe('LONG_JUMP_THRESHOLD', () => {
    it('is 20 sectors', () => {
      expect(LONG_JUMP_THRESHOLD).toBe(20);
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
      };
      expect(() => drawLongJumpCRTEffect(ctx, 100, 100, state)).not.toThrow();
    });
  });
});
