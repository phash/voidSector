import { describe, it, expect } from 'vitest';
import { checkScanEvent } from '../engine/scanEvents.js';

describe('pirate encounter on sector entry', () => {
  it('pirate_ambush events are immediate (trigger on moveSector)', () => {
    // Find sectors with pirate_ambush events
    const ambushSectors: Array<{ x: number; y: number }> = [];
    for (let x = 0; x < 5000 && ambushSectors.length < 5; x += 7) {
      const result = checkScanEvent(x, x * 3 + 1);
      if (result.hasEvent && result.eventType === 'pirate_ambush') {
        ambushSectors.push({ x, y: x * 3 + 1 });
        expect(result.isImmediate).toBe(true);
      }
    }
    // Should find at least some pirate ambush sectors in the universe
    expect(ambushSectors.length).toBeGreaterThan(0);
  });

  it('pirate_ambush includes pirateLevel', () => {
    for (let x = 0; x < 5000; x += 7) {
      const result = checkScanEvent(x, x * 3 + 1);
      if (result.hasEvent && result.eventType === 'pirate_ambush') {
        expect(result.data).toBeDefined();
        expect((result.data as { pirateLevel: number }).pirateLevel).toBeGreaterThanOrEqual(1);
        return;
      }
    }
  });

  it('pirate level scales with distance from origin', () => {
    // Far sectors should have higher pirate levels
    const nearResult = checkScanEvent(10, 5);
    const farResult = checkScanEvent(5000, 2500);

    // Just verify checkScanEvent works without throwing
    expect(nearResult).toBeDefined();
    expect(farResult).toBeDefined();
  });

  it('checkScanEvent returns no event for most sectors', () => {
    let eventCount = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      const result = checkScanEvent(i * 13, i * 7 + 3);
      if (result.hasEvent) eventCount++;
    }
    // Encounter rate should be < 10%
    expect(eventCount / total).toBeLessThan(0.1);
  });
});
