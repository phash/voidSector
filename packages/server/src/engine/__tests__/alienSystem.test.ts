import { describe, it, expect } from 'vitest';
import {
  getRepTier,
  getRepTierLabel,
  applyRepChange,
  canAccessAlienQuests,
  getRepChangeForAction,
  isInFirstContactRange,
  getEncounterableFactions,
  ALIEN_FIRST_CONTACT_DISTANCE,
  ALIEN_FIRST_CONTACT_FLAVOR,
} from '../alienReputationService.js';
import {
  ALIEN_QUEST_TEMPLATES,
  getAvailableAlienQuests,
  resolveBranchQuest,
} from '../alienQuestTemplates.js';
import type { AlienFactionId } from '../alienReputationService.js';

describe('alienReputationService', () => {
  describe('getRepTier', () => {
    it('returns enemy below -50', () => expect(getRepTier(-51)).toBe('enemy'));
    it('returns hostile at -50', () => expect(getRepTier(-50)).toBe('hostile'));
    it('returns neutral at 0', () => expect(getRepTier(0)).toBe('neutral'));
    it('returns curious at 15', () => expect(getRepTier(15)).toBe('curious'));
    it('returns friendly at 50', () => expect(getRepTier(50)).toBe('friendly'));
    it('returns honored at 70', () => expect(getRepTier(70)).toBe('honored'));
    it('returns honored above 70', () => expect(getRepTier(100)).toBe('honored'));
  });

  describe('getRepTierLabel', () => {
    it('returns German label for each tier', () => {
      expect(getRepTierLabel('enemy')).toBe('FEIND');
      expect(getRepTierLabel('honored')).toBe('GEEHRT');
      expect(getRepTierLabel('neutral')).toBe('NEUTRAL');
    });
  });

  describe('applyRepChange', () => {
    it('clamps at +100', () => expect(applyRepChange(90, 50)).toBe(100));
    it('clamps at -100', () => expect(applyRepChange(-90, -50)).toBe(-100));
    it('applies positive delta', () => expect(applyRepChange(20, 10)).toBe(30));
    it('applies negative delta', () => expect(applyRepChange(0, -15)).toBe(-15));
  });

  describe('canAccessAlienQuests', () => {
    it('allows access at neutral rep', () => expect(canAccessAlienQuests(0)).toBe(true));
    it('blocks access when enemy (< -50)', () => expect(canAccessAlienQuests(-51)).toBe(false));
    it('allows access at friendly', () => expect(canAccessAlienQuests(50)).toBe(true));
  });

  describe('getRepChangeForAction', () => {
    it('quest_completed gives positive rep', () => {
      expect(getRepChangeForAction('quest_completed', 'archivists')).toBeGreaterThan(0);
    });

    it('quest_failed gives negative rep', () => {
      expect(getRepChangeForAction('quest_failed', 'archivists')).toBeLessThan(0);
    });

    it("K'thari gives extra rep for combat_win", () => {
      const kthari = getRepChangeForAction('combat_win', 'kthari');
      const archivists = getRepChangeForAction('combat_win', 'archivists');
      expect(kthari).toBeGreaterThan(archivists);
    });
  });

  describe('isInFirstContactRange', () => {
    it('scrappers reachable at Q 60:60', () => {
      expect(isInFirstContactRange(60, 60, 'scrappers')).toBe(true);
    });

    it('axioms not reachable at Q 100:100', () => {
      expect(isInFirstContactRange(100, 100, 'axioms')).toBe(false);
    });

    it('archivists reachable at Q 90:90', () => {
      expect(isInFirstContactRange(90, 90, 'archivists')).toBe(true);
    });

    it('kthari not reachable at Q 100:100', () => {
      expect(isInFirstContactRange(100, 100, 'kthari')).toBe(false);
    });
  });

  describe('getEncounterableFactions', () => {
    it('at origin (0,0) no factions available', () => {
      expect(getEncounterableFactions(0, 0)).toHaveLength(0);
    });

    it('at Q 90:90 scrappers and archivists available', () => {
      const factions = getEncounterableFactions(90, 90);
      expect(factions).toContain('scrappers');
      expect(factions).toContain('archivists');
    });

    it('at Q 300:300 multiple factions available', () => {
      const factions = getEncounterableFactions(300, 300);
      expect(factions.length).toBeGreaterThan(3);
    });

    it('axioms only available at Q 2500+', () => {
      const near = getEncounterableFactions(2400, 2400);
      const far = getEncounterableFactions(2500, 2500);
      expect(near).not.toContain('axioms');
      expect(far).toContain('axioms');
    });
  });

  describe('first contact constants', () => {
    it('all 10 alien factions have first contact distances', () => {
      const factionIds: AlienFactionId[] = [
        'archivists',
        'consortium',
        'kthari',
        'mycelians',
        'mirror_minds',
        'tourist_guild',
        'silent_swarm',
        'helions',
        'axioms',
        'scrappers',
      ];
      for (const id of factionIds) {
        expect(ALIEN_FIRST_CONTACT_DISTANCE[id]).toBeGreaterThan(0);
      }
    });

    it('all factions have first contact flavor text', () => {
      for (const [, text] of Object.entries(ALIEN_FIRST_CONTACT_FLAVOR)) {
        expect(text.length).toBeGreaterThan(10);
      }
    });

    it('scrappers are encountered before archivists (closer)', () => {
      expect(ALIEN_FIRST_CONTACT_DISTANCE.scrappers).toBeLessThan(
        ALIEN_FIRST_CONTACT_DISTANCE.archivists,
      );
    });

    it('axioms are the farthest faction', () => {
      const maxDist = Math.max(...Object.values(ALIEN_FIRST_CONTACT_DISTANCE));
      expect(ALIEN_FIRST_CONTACT_DISTANCE.axioms).toBe(maxDist);
    });
  });
});

describe('alienQuestTemplates', () => {
  it('has quest templates for multiple factions', () => {
    const factionIds = new Set(ALIEN_QUEST_TEMPLATES.map((t) => t.factionId));
    expect(factionIds.size).toBeGreaterThan(3);
  });

  it('all templates have positive rep reward', () => {
    for (const t of ALIEN_QUEST_TEMPLATES) {
      if (t.type !== 'alien_branch') {
        expect(t.rewardRepBase).toBeGreaterThan(0);
      }
    }
  });

  it('branch quest has 3 branches', () => {
    const branchQuest = ALIEN_QUEST_TEMPLATES.find((t) => t.type === 'alien_branch');
    expect(branchQuest?.branches).toHaveLength(3);
  });

  it('community quest has communityTarget', () => {
    const communityQuest = ALIEN_QUEST_TEMPLATES.find((t) => t.type === 'alien_community');
    expect(communityQuest?.communityTarget).toBeGreaterThan(0);
  });

  describe('getAvailableAlienQuests', () => {
    it('no quests at origin', () => {
      const quests = getAvailableAlienQuests(0, 0, {} as Record<AlienFactionId, number>);
      expect(quests).toHaveLength(0);
    });

    it('archivist quests available at Q 90:90 with neutral rep', () => {
      const rep = { archivists: 0 } as Record<AlienFactionId, number>;
      const quests = getAvailableAlienQuests(90, 90, rep);
      const archivistQuests = quests.filter((q) => q.factionId === 'archivists');
      expect(archivistQuests.length).toBeGreaterThan(0);
    });

    it('quests requiring positive rep not available at -50', () => {
      const rep = { archivists: -50 } as Record<AlienFactionId, number>;
      const quests = getAvailableAlienQuests(90, 90, rep);
      const dataProbe = quests.find((q) => q.id === 'archivists_data_probe');
      // data probe requires rep > 10, should not be available
      expect(dataProbe).toBeUndefined();
    });
  });

  describe('resolveBranchQuest', () => {
    it('returns correct branch by id', () => {
      const template = ALIEN_QUEST_TEMPLATES.find((t) => t.type === 'alien_branch')!;
      const branch = resolveBranchQuest(template, 'protect');
      expect(branch?.repChange).toBeGreaterThan(0);
    });

    it('harvest branch gives negative rep', () => {
      const template = ALIEN_QUEST_TEMPLATES.find((t) => t.type === 'alien_branch')!;
      const branch = resolveBranchQuest(template, 'harvest');
      expect(branch?.repChange).toBeLessThan(0);
    });

    it('returns null for non-branch quest', () => {
      const nonBranch = ALIEN_QUEST_TEMPLATES.find((t) => t.type === 'alien_scan')!;
      expect(resolveBranchQuest(nonBranch, 'protect')).toBeNull();
    });
  });
});
