import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQueryResult } from '../test/mockFactories.js';

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
}));

import { query } from '../db/client.js';
import {
  getAllPlayers,
  getPlayerById,
  getPlayerByUsername,
  createAdminQuest,
  getAdminQuests,
  getAdminQuestById,
  createQuestAssignment,
  getPlayerAdminQuests,
  updateQuestAssignment,
  createAdminMessage,
  getAdminMessages,
  createAdminReply,
  getAdminReplies,
  logAdminEvent,
  getAdminEvents,
  getServerStats,
  createAdminStory,
  getAdminStories,
  getAdminStoryById,
} from '../db/adminQueries.js';

const mockQuery = vi.mocked(query);

describe('adminQueries', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  // ── Player Queries ──────────────────────────────────────────────

  describe('getAllPlayers', () => {
    it('returns all players mapped to camelCase', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          { id: 'p1', username: 'alice', xp: 100, level: 3, faction_id: 'f1' },
          { id: 'p2', username: 'bob', xp: 50, level: 1, faction_id: null },
        ]),
      );

      const players = await getAllPlayers();
      expect(players).toHaveLength(2);
      expect(players[0]).toEqual({
        id: 'p1',
        username: 'alice',
        positionX: 0,
        positionY: 0,
        xp: 100,
        level: 3,
        factionId: 'f1',
      });
      expect(players[1].factionId).toBeNull();
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
    });

    it('returns empty array when no players', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult());
      const players = await getAllPlayers();
      expect(players).toEqual([]);
    });
  });

  describe('getPlayerById', () => {
    it('returns player when found', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([{ id: 'p1', username: 'alice', xp: 0, level: 1, faction_id: null }]),
      );

      const player = await getPlayerById('p1');
      expect(player).not.toBeNull();
      expect(player!.id).toBe('p1');
      expect(player!.username).toBe('alice');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE p.id = $1'), ['p1']);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult());
      const player = await getPlayerById('nonexistent');
      expect(player).toBeNull();
    });
  });

  describe('getPlayerByUsername', () => {
    it('returns player when found by username', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([{ id: 'p2', username: 'bob', xp: 10, level: 2, faction_id: 'f1' }]),
      );

      const player = await getPlayerByUsername('bob');
      expect(player).not.toBeNull();
      expect(player!.username).toBe('bob');
      expect(player!.factionId).toBe('f1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE LOWER(p.username) = LOWER($1)'),
        ['bob'],
      );
    });

    it('returns null when username not found', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult());
      const player = await getPlayerByUsername('nobody');
      expect(player).toBeNull();
    });
  });

  // ── Admin Quest Queries ─────────────────────────────────────────

  describe('createAdminQuest', () => {
    it('inserts quest and returns id', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'quest-1' }]));

      const id = await createAdminQuest({ title: 'Test Quest', description: 'A test' });
      expect(id).toBe('quest-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_quests'),
        expect.arrayContaining(['Test Quest', 'A test']),
      );
    });

    it('passes optional fields with defaults', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'quest-2' }]));

      await createAdminQuest({
        title: 'Fetch Quest',
        description: 'Go fetch',
        scope: 'targeted',
        questType: 'delivery',
        npcName: 'Commander',
        npcFaction: 'Traders',
        objectives: [{ type: 'deliver', item: 'ore' }],
        rewards: { credits: 100 },
        flavor: { intro: 'Hello' },
        sectorX: 5,
        sectorY: -3,
        targetPlayers: ['p1', 'p2'],
        maxAcceptances: 10,
        expiresDays: 14,
      });

      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('Fetch Quest');
      expect(params[1]).toBe('Go fetch');
      expect(params[2]).toBe('targeted');
      expect(params[3]).toBe('delivery');
      expect(params[4]).toBe('Commander');
      expect(params[5]).toBe('Traders');
      expect(params[9]).toBe(5);
      expect(params[10]).toBe(-3);
      expect(params[11]).toEqual(['p1', 'p2']);
      expect(params[12]).toBe(10);
      expect(params[13]).toBe(14);
    });
  });

  describe('getAdminQuests', () => {
    const questRow = {
      id: 'q1',
      title: 'Quest 1',
      description: 'Desc',
      scope: 'universal',
      quest_type: 'fetch',
      npc_name: null,
      npc_faction: null,
      objectives: [],
      rewards: {},
      flavor: {},
      sector_x: null,
      sector_y: null,
      target_players: [],
      max_acceptances: 0,
      expires_days: 7,
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
    };

    it('returns all quests without filter', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([questRow]));

      const quests = await getAdminQuests();
      expect(quests).toHaveLength(1);
      expect(quests[0].id).toBe('q1');
      expect(quests[0].questType).toBe('fetch');
      expect(quests[0].createdAt).toBe('2026-01-01T00:00:00Z');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [],
      );
    });

    it('filters by status when provided', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult());

      await getAdminQuests('expired');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE status = $1'), [
        'expired',
      ]);
    });
  });

  describe('getAdminQuestById', () => {
    it('returns quest with assignment count', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          {
            id: 'q1',
            title: 'Quest 1',
            description: 'Desc',
            scope: 'universal',
            quest_type: 'fetch',
            npc_name: null,
            npc_faction: null,
            objectives: [],
            rewards: {},
            flavor: {},
            sector_x: null,
            sector_y: null,
            target_players: [],
            max_acceptances: 0,
            expires_days: 7,
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            assignment_count: '5',
          },
        ]),
      );

      const quest = await getAdminQuestById('q1');
      expect(quest).not.toBeNull();
      expect(quest!.assignmentCount).toBe(5);
      expect(quest!.title).toBe('Quest 1');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('assignment_count'), ['q1']);
    });

    it('returns null when quest not found', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult());
      const quest = await getAdminQuestById('nonexistent');
      expect(quest).toBeNull();
    });
  });

  // ── Quest Assignment Queries ──────────────────────────────────

  describe('createQuestAssignment', () => {
    it('inserts assignment and returns id', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'assign-1' }]));

      const id = await createQuestAssignment('q1', 'p1');
      expect(id).toBe('assign-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_quest_assignments'),
        ['q1', 'p1'],
      );
    });
  });

  describe('getPlayerAdminQuests', () => {
    it('returns player assignments in descending order', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          {
            id: 'a1',
            quest_id: 'q1',
            player_id: 'p1',
            status: 'offered',
            accepted_at: null,
            completed_at: null,
            created_at: '2026-01-02',
          },
          {
            id: 'a2',
            quest_id: 'q2',
            player_id: 'p1',
            status: 'accepted',
            accepted_at: '2026-01-01',
            completed_at: null,
            created_at: '2026-01-01',
          },
        ]),
      );

      const assignments = await getPlayerAdminQuests('p1');
      expect(assignments).toHaveLength(2);
      expect(assignments[0].questId).toBe('q1');
      expect(assignments[0].status).toBe('offered');
      expect(assignments[1].acceptedAt).toBe('2026-01-01');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE player_id = $1'), [
        'p1',
      ]);
    });

    it('returns empty array for player with no quests', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult());
      const assignments = await getPlayerAdminQuests('p99');
      expect(assignments).toEqual([]);
    });
  });

  describe('updateQuestAssignment', () => {
    it('updates status to accepted with accepted_at timestamp', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          {
            id: 'a1',
            quest_id: 'q1',
            player_id: 'p1',
            status: 'accepted',
            accepted_at: '2026-01-01',
            completed_at: null,
            created_at: '2026-01-01',
          },
        ]),
      );

      const assignment = await updateQuestAssignment('a1', 'accepted');
      expect(assignment).not.toBeNull();
      expect(assignment!.status).toBe('accepted');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('accepted_at = NOW()'), [
        'accepted',
        'a1',
      ]);
    });

    it('updates status to completed with completed_at timestamp', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          {
            id: 'a1',
            quest_id: 'q1',
            player_id: 'p1',
            status: 'completed',
            accepted_at: '2026-01-01',
            completed_at: '2026-01-02',
            created_at: '2026-01-01',
          },
        ]),
      );

      const assignment = await updateQuestAssignment('a1', 'completed');
      expect(assignment).not.toBeNull();
      expect(assignment!.status).toBe('completed');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('completed_at = NOW()'), [
        'completed',
        'a1',
      ]);
    });

    it('updates status to failed with completed_at timestamp', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          {
            id: 'a1',
            quest_id: 'q1',
            player_id: 'p1',
            status: 'failed',
            accepted_at: '2026-01-01',
            completed_at: '2026-01-02',
            created_at: '2026-01-01',
          },
        ]),
      );

      await updateQuestAssignment('a1', 'failed');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('completed_at = NOW()'), [
        'failed',
        'a1',
      ]);
    });

    it('returns null when assignment not found', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult());
      const assignment = await updateQuestAssignment('nonexistent', 'accepted');
      expect(assignment).toBeNull();
    });
  });

  // ── Admin Message Queries ─────────────────────────────────────

  describe('createAdminMessage', () => {
    it('inserts message and returns id', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'msg-1' }]));

      const id = await createAdminMessage({ content: 'Hello world' });
      expect(id).toBe('msg-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_messages'),
        expect.arrayContaining(['Hello world']),
      );
    });

    it('passes all optional fields', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'msg-2' }]));

      await createAdminMessage({
        senderName: 'Admin',
        content: 'Targeted msg',
        scope: 'targeted',
        targetPlayers: ['p1'],
        channel: 'comms',
        allowReply: true,
      });

      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('Admin');
      expect(params[1]).toBe('Targeted msg');
      expect(params[2]).toBe('targeted');
      expect(params[3]).toEqual(['p1']);
      expect(params[4]).toBe('comms');
      expect(params[5]).toBe(true);
    });

    it('uses defaults for optional fields', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'msg-3' }]));

      await createAdminMessage({ content: 'Default test' });

      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('SYSTEM');
      expect(params[2]).toBe('universal');
      expect(params[3]).toEqual([]);
      expect(params[4]).toBe('direct');
      expect(params[5]).toBe(false);
    });
  });

  describe('getAdminMessages', () => {
    it('returns messages with default limit', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          {
            id: 'msg-1',
            sender_name: 'SYSTEM',
            content: 'Hello',
            scope: 'universal',
            target_players: [],
            channel: 'direct',
            allow_reply: false,
            created_at: '2026-01-01T00:00:00Z',
          },
        ]),
      );

      const messages = await getAdminMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].senderName).toBe('SYSTEM');
      expect(messages[0].allowReply).toBe(false);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1'), [50]);
    });

    it('respects custom limit', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult());

      await getAdminMessages(10);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1'), [10]);
    });
  });

  // ── Admin Reply Queries ───────────────────────────────────────

  describe('createAdminReply', () => {
    it('inserts reply and returns id', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'reply-1' }]));

      const id = await createAdminReply('msg-1', 'p1', 'Thanks!');
      expect(id).toBe('reply-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_message_replies'),
        ['msg-1', 'p1', 'Thanks!'],
      );
    });
  });

  describe('getAdminReplies', () => {
    it('returns replies for a message in ascending order', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          {
            id: 'r1',
            message_id: 'msg-1',
            player_id: 'p1',
            content: 'Reply 1',
            created_at: '2026-01-01',
          },
          {
            id: 'r2',
            message_id: 'msg-1',
            player_id: 'p2',
            content: 'Reply 2',
            created_at: '2026-01-02',
          },
        ]),
      );

      const replies = await getAdminReplies('msg-1');
      expect(replies).toHaveLength(2);
      expect(replies[0].messageId).toBe('msg-1');
      expect(replies[0].content).toBe('Reply 1');
      expect(replies[1].playerId).toBe('p2');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE message_id = $1'), [
        'msg-1',
      ]);
    });

    it('returns empty array when no replies', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult());
      const replies = await getAdminReplies('msg-99');
      expect(replies).toEqual([]);
    });
  });

  // ── Admin Event / Audit Log Queries ───────────────────────────

  describe('logAdminEvent', () => {
    it('inserts event and returns id', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 42 }]));

      const id = await logAdminEvent('quest_created', { questId: 'q1' });
      expect(id).toBe(42);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO admin_events'), [
        'quest_created',
        JSON.stringify({ questId: 'q1' }),
      ]);
    });

    it('uses empty object for details when omitted', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 43 }]));

      await logAdminEvent('server_start');
      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('server_start');
      expect(params[1]).toBe('{}');
    });
  });

  describe('getAdminEvents', () => {
    it('returns events with default limit', async () => {
      mockQuery.mockResolvedValueOnce(
        mockQueryResult([
          { id: 1, action: 'quest_created', details: { questId: 'q1' }, created_at: '2026-01-01' },
        ]),
      );

      const events = await getAdminEvents();
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('quest_created');
      expect(events[0].details).toEqual({ questId: 'q1' });
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1'), [100]);
    });

    it('respects custom limit', async () => {
      mockQuery.mockResolvedValueOnce(mockQueryResult());

      await getAdminEvents(25);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1'), [25]);
    });
  });

  // ── Server Stats ──────────────────────────────────────────────

  describe('getServerStats', () => {
    it('returns combined counts from three tables', async () => {
      mockQuery
        .mockResolvedValueOnce(mockQueryResult([{ count: '42' }]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '15' }]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '200' }]));

      const stats = await getServerStats();
      expect(stats).toEqual({
        playerCount: 42,
        structureCount: 15,
        discoveredSectorCount: 200,
      });
      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM players'));
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM structures'));
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM player_discoveries'));
    });

    it('returns zero counts for empty tables', async () => {
      mockQuery
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]));

      const stats = await getServerStats();
      expect(stats.playerCount).toBe(0);
      expect(stats.structureCount).toBe(0);
      expect(stats.discoveredSectorCount).toBe(0);
    });
  });

  // ── Admin Story Queries ──────────────────────────────────────────

  describe('admin story queries', () => {
    describe('createAdminStory', () => {
      it('inserts story and returns id', async () => {
        mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'story-1' }]));

        const id = await createAdminStory({ title: 'Test Story', summary: 'A summary' });
        expect(id).toBe('story-1');
        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO admin_stories'),
          expect.arrayContaining(['Test Story', 'A summary']),
        );
      });

      it('passes optional fields with defaults', async () => {
        mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'story-2' }]));

        await createAdminStory({
          title: 'Full Story',
          summary: 'Full summary',
          scenario: 'Login flow',
          steps: [{ step: 1, action: 'Click login', result: 'Form appears' }],
          findings: [
            {
              type: 'bug',
              severity: 'high',
              title: 'Broken button',
              description: 'Button does not work',
              suggestion: 'Fix the handler',
            },
          ],
          screenshotPaths: ['/img/shot1.png'],
          status: 'published',
        });

        const params = mockQuery.mock.calls[0][1] as unknown[];
        expect(params[0]).toBe('Full Story');
        expect(params[1]).toBe('Full summary');
        expect(params[2]).toBe('Login flow');
        expect(params[3]).toBe(
          JSON.stringify([{ step: 1, action: 'Click login', result: 'Form appears' }]),
        );
        expect(params[4]).toBe(
          JSON.stringify([
            {
              type: 'bug',
              severity: 'high',
              title: 'Broken button',
              description: 'Button does not work',
              suggestion: 'Fix the handler',
            },
          ]),
        );
        expect(params[5]).toEqual(['/img/shot1.png']);
        expect(params[6]).toBe('published');
      });

      it('uses defaults for optional fields', async () => {
        mockQuery.mockResolvedValueOnce(mockQueryResult([{ id: 'story-3' }]));

        await createAdminStory({ title: 'Minimal', summary: 'Just basics' });

        const params = mockQuery.mock.calls[0][1] as unknown[];
        expect(params[2]).toBe(''); // scenario default
        expect(params[3]).toBe('[]'); // steps default
        expect(params[4]).toBe('[]'); // findings default
        expect(params[5]).toEqual([]); // screenshotPaths default
        expect(params[6]).toBe('draft'); // status default
      });
    });

    describe('getAdminStories', () => {
      const storyRow = {
        id: 's1',
        title: 'Story 1',
        summary: 'Summary 1',
        scenario: 'Scenario 1',
        steps: [{ step: 1, action: 'Do thing', result: 'Thing done' }],
        findings: [],
        screenshot_paths: ['/img/s1.png'],
        status: 'draft',
        created_at: '2026-01-01T00:00:00Z',
      };

      it('returns stories with default limit', async () => {
        mockQuery.mockResolvedValueOnce(mockQueryResult([storyRow]));

        const stories = await getAdminStories();
        expect(stories).toHaveLength(1);
        expect(stories[0].id).toBe('s1');
        expect(stories[0].title).toBe('Story 1');
        expect(stories[0].screenshotPaths).toEqual(['/img/s1.png']);
        expect(stories[0].createdAt).toBe('2026-01-01T00:00:00Z');
        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY created_at DESC'),
          [50],
        );
      });

      it('respects custom limit', async () => {
        mockQuery.mockResolvedValueOnce(mockQueryResult());

        await getAdminStories(10);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1'), [10]);
      });

      it('returns empty array when no stories', async () => {
        mockQuery.mockResolvedValueOnce(mockQueryResult());
        const stories = await getAdminStories();
        expect(stories).toEqual([]);
      });
    });

    describe('getAdminStoryById', () => {
      it('returns story when found', async () => {
        mockQuery.mockResolvedValueOnce(
          mockQueryResult([
            {
              id: 's1',
              title: 'Story 1',
              summary: 'Summary 1',
              scenario: 'Scenario 1',
              steps: [],
              findings: [
                {
                  type: 'recommendation',
                  severity: 'low',
                  title: 'Improve UX',
                  description: 'Could be better',
                  suggestion: 'Add tooltip',
                },
              ],
              screenshot_paths: [],
              status: 'published',
              created_at: '2026-01-01T00:00:00Z',
            },
          ]),
        );

        const story = await getAdminStoryById('s1');
        expect(story).not.toBeNull();
        expect(story!.id).toBe('s1');
        expect(story!.findings).toHaveLength(1);
        expect(story!.findings[0].type).toBe('recommendation');
        expect(story!.scenario).toBe('Scenario 1');
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), ['s1']);
      });

      it('returns null when story not found', async () => {
        mockQuery.mockResolvedValueOnce(mockQueryResult());
        const story = await getAdminStoryById('nonexistent');
        expect(story).toBeNull();
      });
    });
  });
});
