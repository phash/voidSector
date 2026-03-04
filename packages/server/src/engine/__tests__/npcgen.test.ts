import { describe, it, expect } from 'vitest';
import { getStationFaction, generateStationNpcs, getPirateLevel } from '../npcgen.js';

describe('npcgen', () => {
  it('getStationFaction returns deterministic faction for same coords', () => {
    const f1 = getStationFaction(100, 200);
    const f2 = getStationFaction(100, 200);
    expect(f1).toBe(f2);
  });

  it('getStationFaction returns valid faction id', () => {
    const valid = ['traders', 'scientists', 'pirates', 'ancients', 'independent'];
    for (let i = 0; i < 50; i++) {
      expect(valid).toContain(getStationFaction(i * 17, i * 31));
    }
  });

  it('generateStationNpcs returns 1-3 NPCs with names', () => {
    const npcs = generateStationNpcs(500, 300);
    expect(npcs.length).toBeGreaterThanOrEqual(1);
    expect(npcs.length).toBeLessThanOrEqual(3);
    for (const npc of npcs) {
      expect(npc.name).toBeTruthy();
      expect(npc.factionId).toBeTruthy();
      expect(npc.id).toMatch(/^npc_/);
    }
  });

  it('generateStationNpcs is deterministic', () => {
    const a = generateStationNpcs(42, 99);
    const b = generateStationNpcs(42, 99);
    expect(a).toEqual(b);
  });

  it('getPirateLevel scales with distance', () => {
    expect(getPirateLevel(0, 0)).toBe(1);
    expect(getPirateLevel(100, 0)).toBe(3);
    expect(getPirateLevel(500, 0)).toBe(10);
  });
});
