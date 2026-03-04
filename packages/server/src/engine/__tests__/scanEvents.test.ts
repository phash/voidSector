import { describe, it, expect } from 'vitest';
import { checkScanEvent } from '../scanEvents.js';

describe('scanEvents', () => {
  it('checkScanEvent is deterministic', () => {
    const a = checkScanEvent(10, 20);
    const b = checkScanEvent(10, 20);
    expect(a).toEqual(b);
  });

  it('returns valid event types when event occurs', () => {
    const validTypes = ['pirate_ambush', 'distress_signal', 'anomaly_reading', 'artifact_find'];
    let foundEvent = false;
    for (let i = 0; i < 100; i++) {
      const result = checkScanEvent(i * 7, i * 13);
      if (result.hasEvent) {
        expect(validTypes).toContain(result.eventType);
        expect(result.data).toBeDefined();
        foundEvent = true;
      }
    }
    expect(foundEvent).toBe(true);
  });

  it('pirate_ambush is immediate', () => {
    for (let i = 0; i < 200; i++) {
      const result = checkScanEvent(i * 3, i * 11);
      if (result.hasEvent && result.eventType === 'pirate_ambush') {
        expect(result.isImmediate).toBe(true);
        expect(result.data!.pirateLevel).toBeGreaterThanOrEqual(1);
        return;
      }
    }
  });

  it('non-ambush events are markers (not immediate)', () => {
    for (let i = 0; i < 200; i++) {
      const result = checkScanEvent(i * 5, i * 17);
      if (result.hasEvent && result.eventType !== 'pirate_ambush') {
        expect(result.isImmediate).toBe(false);
        return;
      }
    }
  });

  it('distress_signal events include narrative message', () => {
    for (let i = 0; i < 500; i++) {
      const result = checkScanEvent(i * 3, i * 7);
      if (result.hasEvent && result.eventType === 'distress_signal') {
        expect(typeof (result.data as { message: string }).message).toBe('string');
        expect((result.data as { message: string }).message.length).toBeGreaterThan(10);
        return;
      }
    }
  });

  it('returns hasEvent:false for most sectors (low event chance)', () => {
    // Scan event chance is low — majority of checks should return no event
    let noEventCount = 0;
    for (let i = 0; i < 50; i++) {
      const result = checkScanEvent(i * 37, i * 41 + 13);
      if (!result.hasEvent) noEventCount++;
    }
    expect(noEventCount).toBeGreaterThan(25); // at least 50% of sectors are event-free
  });
});
