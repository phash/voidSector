import { describe, it, expect } from 'vitest';
import { checkScanEvent, getEffectiveEventChance } from '../scanEvents.js';

describe('scanEvents', () => {
  it('checkScanEvent is deterministic', () => {
    const a = checkScanEvent(10, 20, 'empty');
    const b = checkScanEvent(10, 20, 'empty');
    expect(a).toEqual(b);
  });

  it('returns valid event types when event occurs (nebula has high chance)', () => {
    const validTypes = ['pirate_ambush', 'distress_signal', 'anomaly_reading', 'artifact_find', 'blueprint_find'];
    let foundEvent = false;
    for (let i = 0; i < 100; i++) {
      const result = checkScanEvent(i * 7, i * 13, 'nebula');
      if (result.hasEvent) {
        expect(validTypes).toContain(result.eventType);
        expect(result.data).toBeDefined();
        foundEvent = true;
      }
    }
    expect(foundEvent).toBe(true);
  });

  it('pirate_ambush is immediate', () => {
    for (let i = 0; i < 500; i++) {
      const result = checkScanEvent(i * 3, i * 11, 'nebula');
      if (result.hasEvent && result.eventType === 'pirate_ambush') {
        expect(result.isImmediate).toBe(true);
        expect(result.data!.pirateLevel).toBeGreaterThanOrEqual(1);
        return;
      }
    }
  });

  it('non-ambush events are markers (not immediate)', () => {
    for (let i = 0; i < 500; i++) {
      const result = checkScanEvent(i * 5, i * 17, 'nebula');
      if (result.hasEvent && result.eventType !== 'pirate_ambush') {
        expect(result.isImmediate).toBe(false);
        return;
      }
    }
  });

  it('distress_signal events include narrative message', () => {
    for (let i = 0; i < 1000; i++) {
      const result = checkScanEvent(i * 3, i * 7, 'nebula');
      if (result.hasEvent && result.eventType === 'distress_signal') {
        expect(typeof (result.data as { message: string }).message).toBe('string');
        expect((result.data as { message: string }).message.length).toBeGreaterThan(10);
        return;
      }
    }
  });

  it('empty sectors have very low event rate (~1.2%)', () => {
    let eventCount = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      const result = checkScanEvent(i * 37, i * 41 + 13, 'empty');
      if (result.hasEvent) eventCount++;
    }
    // 1.2% chance → expect roughly 12 events per 1000, allow wide margin
    expect(eventCount).toBeLessThan(50); // well under old 15% rate
    expect(eventCount).toBeGreaterThan(0); // at least some events
  });

  it('nebula sectors have higher event rate (~30%)', () => {
    let eventCount = 0;
    const total = 500;
    for (let i = 0; i < total; i++) {
      const result = checkScanEvent(i * 37, i * 41 + 13, 'nebula');
      if (result.hasEvent) eventCount++;
    }
    // 30% chance → expect ~150 events per 500
    expect(eventCount).toBeGreaterThan(80);
  });

  describe('getEffectiveEventChance', () => {
    it('empty sectors far from edges have lowest chance', () => {
      const chance = getEffectiveEventChance('empty', 5000, 5000);
      expect(chance).toBe(0.012);
    });

    it('empty sectors near quadrant edge have higher chance', () => {
      // x=100 is near edge (within 500 of quadrant boundary at 0)
      const chance = getEffectiveEventChance('empty', 100, 5000);
      expect(chance).toBe(0.03);
    });

    it('nebula sectors have high chance', () => {
      const chance = getEffectiveEventChance('nebula', 5000, 5000);
      expect(chance).toBe(0.30);
    });

    it('nebula at quadrant edges has very high chance', () => {
      const chance = getEffectiveEventChance('nebula', 100, 5000);
      expect(chance).toBe(0.95);
    });
  });
});
