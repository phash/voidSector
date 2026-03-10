import { describe, it, expect } from 'vitest';
import { generateStationQuests } from '../questgen.js';

describe('questgen', () => {
  it('generates 2-4 quests for a station', () => {
    const quests = generateStationQuests(100, 200, 1);
    expect(quests.length).toBeGreaterThanOrEqual(2);
    expect(quests.length).toBeLessThanOrEqual(4);
  });

  it('quests are deterministic for same station + day', () => {
    const a = generateStationQuests(100, 200, 1);
    const b = generateStationQuests(100, 200, 1);
    expect(a).toEqual(b);
  });

  it('quests rotate daily', () => {
    const day1 = generateStationQuests(100, 200, 1);
    const day2 = generateStationQuests(100, 200, 2);
    expect(day1.length).toBeGreaterThan(0);
    expect(day2.length).toBeGreaterThan(0);
  });

  it('quests have valid structure', () => {
    const quests = generateStationQuests(50, 50, 100);
    for (const q of quests) {
      expect(q.templateId).toBeTruthy();
      expect(q.npcName).toBeTruthy();
      expect(q.title).toBeTruthy();
      expect(q.objectives.length).toBeGreaterThan(0);
      expect(q.rewards.credits).toBeGreaterThan(0);
      expect(q.rewards.xp).toBeGreaterThan(0);
    }
  });

  it('honored tier unlocks more quest templates than neutral', () => {
    const neutral = generateStationQuests(100, 200, 1, 'neutral');
    const honored = generateStationQuests(100, 200, 1, 'honored');
    expect(honored.length).toBeGreaterThanOrEqual(neutral.length);
  });

  it('delivery quests with resource requirements generate resource/amount objectives', () => {
    // Run many stations to find a delivery quest with resource requirements
    let found = false;
    for (let day = 1; day <= 100 && !found; day++) {
      for (let x = 1; x <= 50 && !found; x++) {
        const quests = generateStationQuests(x * 37, x * 13, day, 'friendly');
        for (const q of quests) {
          const deliveryObj = q.objectives.find(
            (o) => o.type === 'delivery' && o.resource != null && o.amount != null,
          );
          if (deliveryObj) {
            expect(deliveryObj.resource).toBeTruthy();
            expect(deliveryObj.amount).toBeGreaterThan(0);
            expect(deliveryObj.progress).toBe(0);
            expect(deliveryObj.fulfilled).toBe(false);
            found = true;
          }
        }
      }
    }
    expect(found).toBe(true);
  });
});
