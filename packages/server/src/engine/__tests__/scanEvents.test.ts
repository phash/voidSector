import { describe, it, expect } from 'vitest';
import { checkScanEvent, getEffectiveEventChance } from '../scanEvents.js';
import { QUADRANT_SIZE } from '@void-sector/shared';

describe('scanEvents', () => {
  it('checkScanEvent is deterministic', () => {
    const a = checkScanEvent(10, 20, 'empty');
    const b = checkScanEvent(10, 20, 'empty');
    expect(a).toEqual(b);
  });

  it('returns valid event types when event occurs (nebula has high chance)', () => {
    const validTypes = [
      'pirate_ambush',
      'distress_signal',
      'anomaly_reading',
      'artifact_find',
      'blueprint_find',
    ];
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
    // (250, 250): modX=250, edgeDist=250 → far from edge (>= 50)
    // (0, 0): modX=0, edgeDist=0 → near edge (< 50)
    const farCoord = 250;
    const nearCoord = 0;

    it('empty sectors far from edges have lowest chance', () => {
      const chance = getEffectiveEventChance('empty', farCoord, farCoord);
      expect(chance).toBe(0.012);
    });

    it('empty sectors near quadrant edge have higher chance', () => {
      const chance = getEffectiveEventChance('empty', nearCoord, nearCoord);
      expect(chance).toBe(0.03);
    });

    it('nebula sectors have high chance', () => {
      const chance = getEffectiveEventChance('nebula', farCoord, farCoord);
      expect(chance).toBe(0.3);
    });

    it('nebula at quadrant edges has very high chance', () => {
      const chance = getEffectiveEventChance('nebula', nearCoord, nearCoord);
      expect(chance).toBe(0.95);
    });
  });

  describe('home base safe zone', () => {
    // Find a sector that deterministically produces a pirate_ambush event
    function findPirateAmbushSector(): { x: number; y: number } {
      for (let i = 0; i < 10000; i++) {
        const result = checkScanEvent(i * 3, i * 11, 'nebula');
        if (result.hasEvent && result.eventType === 'pirate_ambush') {
          return { x: i * 3, y: i * 11 };
        }
      }
      throw new Error('Could not find a pirate_ambush sector in test range');
    }

    it('suppresses pirate_ambush within HOME_BASE_SAFE_RADIUS of home base', () => {
      const sector = findPirateAmbushSector();
      // Place home base at the same coords — distance 0, well within radius 5
      const homeBase = { x: sector.x, y: sector.y };
      const result = checkScanEvent(sector.x, sector.y, 'nebula', homeBase);
      // Should either have no event or a non-pirate event
      if (result.hasEvent) {
        expect(result.eventType).not.toBe('pirate_ambush');
      }
    });

    it('suppresses pirate_ambush at Manhattan distance <= 5 from home base', () => {
      const sector = findPirateAmbushSector();
      // Home base 3 sectors away in each axis (Manhattan distance = 6? No, 3+2=5)
      const homeBase = { x: sector.x - 3, y: sector.y - 2 };
      const result = checkScanEvent(sector.x, sector.y, 'nebula', homeBase);
      if (result.hasEvent) {
        expect(result.eventType).not.toBe('pirate_ambush');
      }
    });

    it('allows pirate_ambush outside HOME_BASE_SAFE_RADIUS', () => {
      const sector = findPirateAmbushSector();
      // Home base 100 sectors away — well outside radius
      const homeBase = { x: sector.x + 100, y: sector.y + 100 };
      const result = checkScanEvent(sector.x, sector.y, 'nebula', homeBase);
      expect(result.hasEvent).toBe(true);
      expect(result.eventType).toBe('pirate_ambush');
    });

    it('allows non-pirate events within safe radius', () => {
      // Find a non-pirate event sector
      for (let i = 0; i < 10000; i++) {
        const result = checkScanEvent(i * 5, i * 17, 'nebula');
        if (result.hasEvent && result.eventType !== 'pirate_ambush') {
          const homeBase = { x: i * 5, y: i * 17 }; // same coords
          const safeResult = checkScanEvent(i * 5, i * 17, 'nebula', homeBase);
          expect(safeResult.hasEvent).toBe(true);
          expect(safeResult.eventType).toBe(result.eventType);
          return;
        }
      }
      throw new Error('Could not find a non-pirate event sector');
    });
  });
});
