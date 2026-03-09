import { describe, it, expect } from 'vitest';
import { generateDiplomacyQuest, generateWarSupportQuest } from '../rooms/services/QuestService.js';

describe('generateDiplomacyQuest', () => {
  it('returns a quest object with correct type and faction', () => {
    const quest = generateDiplomacyQuest('kthari', { qx: 4, qy: -2 });
    expect(quest.type).toBe('diplomacy');
    expect(quest.target_faction).toBe('kthari');
    expect(quest.rep_reward).toBeGreaterThan(0);
    expect(quest.border_qx).toBe(4);
    expect(quest.border_qy).toBe(-2);
    expect(typeof quest.description).toBe('string');
    expect(quest.expires_hours).toBeGreaterThan(0);
  });

  it('works with any faction ID', () => {
    const quest = generateDiplomacyQuest('archivists', { qx: 0, qy: 5 });
    expect(quest.target_faction).toBe('archivists');
    expect(quest.type).toBe('diplomacy');
  });
});

describe('generateWarSupportQuest', () => {
  it('logistics quest boosts defense', () => {
    const quest = generateWarSupportQuest('logistics', { qx: 1, qy: 0 });
    expect(quest.type).toBe('war_support');
    expect(quest.subtype).toBe('logistics');
    expect((quest as any).defense_bonus).toBeGreaterThan(0);
    expect(typeof quest.description).toBe('string');
  });

  it('sabotage quest reduces enemy defense', () => {
    const quest = generateWarSupportQuest('sabotage', { qx: 4, qy: -2 });
    expect(quest.type).toBe('war_support');
    expect(quest.subtype).toBe('sabotage');
    expect((quest as any).enemy_defense_reduction).toBeGreaterThan(0);
  });

  it('scanning quest provides attack multiplier', () => {
    const quest = generateWarSupportQuest('scanning', { qx: 0, qy: 0 });
    expect(quest.subtype).toBe('scanning');
    expect((quest as any).attack_multiplier).toBeGreaterThan(1.0);
  });

  it('salvage quest provides tech bonus', () => {
    const quest = generateWarSupportQuest('salvage', { qx: 2, qy: 3 });
    expect(quest.subtype).toBe('salvage');
    expect((quest as any).defense_bonus).toBeGreaterThan(0);
    expect((quest as any).attack_multiplier).toBeGreaterThan(1.0);
  });

  it('all quest types have expires_hours', () => {
    const types = ['logistics', 'sabotage', 'scanning', 'salvage'] as const;
    for (const t of types) {
      const q = generateWarSupportQuest(t, { qx: 0, qy: 0 });
      expect(q.expires_hours).toBeGreaterThan(0);
    }
  });
});
