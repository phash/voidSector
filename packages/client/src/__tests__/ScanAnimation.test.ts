import { describe, it, expect } from 'vitest';
import {
  createScanAnimation,
  updateScanAnimation,
} from '../canvas/ScanAnimation';

describe('ScanAnimation', () => {
  describe('createScanAnimation', () => {
    it('creates active area scan', () => {
      const anim = createScanAnimation('area');
      expect(anim.active).toBe(true);
      expect(anim.type).toBe('area');
      expect(anim.pulseCount).toBe(0);
      expect(anim.progress).toBe(0);
    });

    it('creates active local scan', () => {
      const anim = createScanAnimation('local');
      expect(anim.active).toBe(true);
      expect(anim.type).toBe('local');
    });

    it('area scan has longer total duration than local scan', () => {
      const area = createScanAnimation('area');
      const local = createScanAnimation('local');
      expect(area.totalDuration).toBeGreaterThan(local.totalDuration);
    });
  });

  describe('updateScanAnimation', () => {
    it('returns inactive state unchanged', () => {
      const anim = createScanAnimation('area');
      const inactive = { ...anim, active: false };
      expect(updateScanAnimation(inactive, anim.startTime + 1000)).toBe(inactive);
    });

    it('progresses within first pulse', () => {
      const anim = createScanAnimation('area');
      const updated = updateScanAnimation(anim, anim.startTime + 400);
      expect(updated.active).toBe(true);
      expect(updated.pulseCount).toBe(0);
      expect(updated.progress).toBeGreaterThan(0);
      expect(updated.progress).toBeLessThanOrEqual(1);
    });

    it('advances to second pulse after first cycle completes', () => {
      const anim = createScanAnimation('area');
      // area pulse = 800ms, settle = 200ms → cycle = 1000ms
      const updated = updateScanAnimation(anim, anim.startTime + 1050);
      expect(updated.pulseCount).toBe(1);
    });

    it('marks inactive after total duration', () => {
      const anim = createScanAnimation('area');
      const updated = updateScanAnimation(anim, anim.startTime + anim.totalDuration + 1);
      expect(updated.active).toBe(false);
    });
  });
});

describe('Scan brightness burst interpolation', () => {
  const BURST_DURATION = 1500;

  /**
   * The brightness burst lerps alpha from 0.5 (at t=0) down to 0 (at t=1).
   * burstAlpha = 0.5 * (1 - t)  where t = elapsed / BURST_DURATION
   */
  function computeBurstAlpha(elapsed: number): number {
    const t = Math.max(0, Math.min(1, elapsed / BURST_DURATION));
    return 0.5 * (1 - t);
  }

  it('burst is at max alpha at elapsed=0', () => {
    expect(computeBurstAlpha(0)).toBeCloseTo(0.5);
  });

  it('burst alpha decreases over time', () => {
    const at0 = computeBurstAlpha(0);
    const at500 = computeBurstAlpha(500);
    const at1000 = computeBurstAlpha(1000);
    expect(at0).toBeGreaterThan(at500);
    expect(at500).toBeGreaterThan(at1000);
  });

  it('burst alpha reaches 0 at BURST_DURATION', () => {
    expect(computeBurstAlpha(BURST_DURATION)).toBeCloseTo(0);
  });

  it('burst alpha is 0 after BURST_DURATION', () => {
    expect(computeBurstAlpha(BURST_DURATION + 500)).toBeCloseTo(0);
  });

  it('burst alpha at half duration is half of max', () => {
    expect(computeBurstAlpha(BURST_DURATION / 2)).toBeCloseTo(0.25);
  });

  it('negative elapsed (before scan) produces max alpha clamped at 0.5', () => {
    // elapsed < 0 is guarded by elapsed >= 0 check in renderer — formula clamps t to 0
    expect(computeBurstAlpha(-100)).toBeCloseTo(0.5);
  });
});
