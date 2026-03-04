/**
 * Admin Console REST API
 *
 * All routes are protected by the ADMIN_TOKEN environment variable.
 * Set ADMIN_TOKEN=<secret> in your .env file and pass it as a
 * Bearer token:  Authorization: Bearer <secret>
 *
 * Mount with:
 *   app.use('/admin/api', adminRouter);
 */
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  getAllPlayers,
  getPlayerById,
  getPlayerIdByUsername,
  createAdminQuest,
  getAdminQuests,
  getAdminQuestById,
  updateAdminQuestStatus,
  createAdminQuestAssignment,
  createAdminMessage,
  getAdminMessages,
  getAllReplies,
  getAdminMessageReplies,
  logAdminEvent,
  getAdminEvents,
  getServerStats,
} from './db/adminQueries.js';
import { getPlayerPosition } from './rooms/services/RedisAPStore.js';
import { adminBus } from './adminBus.js';
import type { AdminQuestScope, AdminQuestType, AdminQuestStatus, AdminMessageScope } from '@void-sector/shared';

export const adminRouter = express.Router();

// ─── Auth Middleware ───────────────────────────────────────────────────────────

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    // No token configured — admin console disabled
    res.status(503).json({ error: 'Admin console not configured (ADMIN_TOKEN not set)' });
    return;
  }
  const authHeader = req.headers['authorization'] ?? '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (provided !== token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

adminRouter.use(requireAdminAuth);

// ─── Players ───────────────────────────────────────────────────────────────────

/** GET /admin/api/players — All registered players + their last known position */
adminRouter.get('/players', async (_req, res) => {
  try {
    const players = await getAllPlayers();
    // Enrich with Redis positions in parallel
    const enriched = await Promise.all(
      players.map(async p => {
        const pos = await getPlayerPosition(p.id);
        return { ...p, position: pos ?? null };
      })
    );
    res.json({ players: enriched });
  } catch (err) {
    console.error('[admin] GET /players error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /admin/api/players/:id — Single player */
adminRouter.get('/players/:id', async (req, res) => {
  try {
    const player = await getPlayerById(req.params.id);
    if (!player) { res.status(404).json({ error: 'Player not found' }); return; }
    const pos = await getPlayerPosition(player.id);
    res.json({ player: { ...player, position: pos ?? null } });
  } catch (err) {
    console.error('[admin] GET /players/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Admin Quests ──────────────────────────────────────────────────────────────

/** GET /admin/api/quests — List all admin quests */
adminRouter.get('/quests', async (req, res) => {
  try {
    const status = req.query.status as AdminQuestStatus | undefined;
    const quests = await getAdminQuests(status);
    res.json({ quests });
  } catch (err) {
    console.error('[admin] GET /quests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /admin/api/quests/:id — Single quest */
adminRouter.get('/quests/:id', async (req, res) => {
  try {
    const quest = await getAdminQuestById(req.params.id);
    if (!quest) { res.status(404).json({ error: 'Quest not found' }); return; }
    res.json({ quest });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/api/quests — Create a new admin quest.
 *
 * Body (JSON):
 * {
 *   title, description, scope, questType, objectives, rewards,
 *   npcName?, npcFactionId?, targetSectorX?, targetSectorY?,
 *   targetPlayerIds?, maxAcceptances?, expiresAt?, introText?,
 *   completionText?, yamlSource?
 * }
 *
 * After creation the quest is immediately activated:
 * - universal: broadcast to all connected rooms via adminBus
 * - individual: sent to specific players via adminBus
 * - sector: stored in DB, delivered when a player scans that sector
 */
adminRouter.post('/quests', async (req, res) => {
  try {
    const {
      title, description, scope, questType, objectives, rewards,
      npcName = 'ADMIN', npcFactionId = 'independent',
      targetSectorX, targetSectorY, targetPlayerIds,
      maxAcceptances, expiresAt, introText, completionText, yamlSource,
    } = req.body;

    if (!title || !description || !scope || !questType || !objectives || !rewards) {
      res.status(400).json({ error: 'Missing required fields: title, description, scope, questType, objectives, rewards' });
      return;
    }

    if (!['universal', 'individual', 'sector'].includes(scope)) {
      res.status(400).json({ error: 'scope must be universal | individual | sector' });
      return;
    }
    if (!['fetch', 'delivery', 'scan', 'bounty', 'custom'].includes(questType)) {
      res.status(400).json({ error: 'questType must be fetch | delivery | scan | bounty | custom' });
      return;
    }
    if (scope === 'sector' && (targetSectorX == null || targetSectorY == null)) {
      res.status(400).json({ error: 'sector scope requires targetSectorX and targetSectorY' });
      return;
    }
    if (scope === 'individual' && (!Array.isArray(targetPlayerIds) || targetPlayerIds.length === 0)) {
      res.status(400).json({ error: 'individual scope requires targetPlayerIds array' });
      return;
    }

    const quest = await createAdminQuest({
      title, description,
      scope: scope as AdminQuestScope,
      questType: questType as AdminQuestType,
      objectives,
      rewards,
      npcName,
      npcFactionId,
      targetSectorX: targetSectorX ?? null,
      targetSectorY: targetSectorY ?? null,
      targetPlayerIds: targetPlayerIds ?? null,
      maxAcceptances: maxAcceptances ?? null,
      expiresAt: expiresAt ?? null,
      yamlSource: yamlSource ?? null,
      introText: introText ?? null,
      completionText: completionText ?? null,
    });

    // Create per-player assignments for individual scope
    if (scope === 'individual' && Array.isArray(targetPlayerIds)) {
      for (const pid of targetPlayerIds) {
        await createAdminQuestAssignment(quest.id, pid, objectives);
      }
    }

    await logAdminEvent({
      eventType: 'quest_created',
      label: `Quest created: "${title}" [${scope}]`,
      payload: { questId: quest.id, scope, questType },
      targetSectorX: targetSectorX ?? null,
      targetSectorY: targetSectorY ?? null,
    });

    // Broadcast via adminBus to connected rooms
    if (scope !== 'sector') {
      adminBus.offerQuest({
        adminQuestId: quest.id,
        scope: scope as 'universal' | 'individual',
        title,
        description,
        objectives,
        rewards,
        npcName,
        npcFactionId,
        introText,
        targetPlayerIds: scope === 'individual' ? targetPlayerIds : undefined,
      });
    }

    res.status(201).json({ quest });
  } catch (err) {
    console.error('[admin] POST /quests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/api/quests/import — Import quest from YAML (parsed in browser).
 *
 * Body: same as POST /quests but also includes `yamlSource` (raw YAML string).
 * The browser parses YAML → JSON and sends both.
 */
adminRouter.post('/quests/import', async (req, res) => {
  // Re-use the same handler as POST /quests — body already parsed by browser
  req.url = '/quests';
  adminRouter.handle(req, res, () => {});
});

/** PUT /admin/api/quests/:id/status — Pause / expire / restore a quest */
adminRouter.put('/quests/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'paused', 'expired', 'deleted'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    await updateAdminQuestStatus(req.params.id, status as AdminQuestStatus);
    await logAdminEvent({
      eventType: 'quest_status_changed',
      label: `Quest ${req.params.id} set to ${status}`,
      payload: { questId: req.params.id, status },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Admin COMM Messages ───────────────────────────────────────────────────────

/**
 * POST /admin/api/comms — Send a COMM message.
 *
 * Body:
 * {
 *   adminName: string,        // e.g. "Commander Rex"
 *   scope: "universal" | "quadrant" | "individual",
 *   content: string,
 *   targetSectorX?: number,   // quadrant scope
 *   targetSectorY?: number,
 *   targetPlayerIds?: string[], // individual scope (player IDs or usernames)
 *   allowReply?: boolean       // default false
 * }
 */
adminRouter.post('/comms', async (req, res) => {
  try {
    const {
      adminName = 'ADMIN',
      scope,
      content,
      targetSectorX,
      targetSectorY,
      targetPlayerIds,
      allowReply = false,
    } = req.body;

    if (!scope || !content) {
      res.status(400).json({ error: 'scope and content are required' });
      return;
    }
    if (!['universal', 'quadrant', 'individual'].includes(scope)) {
      res.status(400).json({ error: 'scope must be universal | quadrant | individual' });
      return;
    }

    // Resolve usernames to IDs if needed
    let resolvedPlayerIds: string[] | null = null;
    if (scope === 'individual') {
      if (!Array.isArray(targetPlayerIds) || targetPlayerIds.length === 0) {
        res.status(400).json({ error: 'individual scope requires targetPlayerIds' });
        return;
      }
      resolvedPlayerIds = [];
      for (const idOrName of targetPlayerIds) {
        // Check if it looks like a UUID
        if (/^[0-9a-f-]{36}$/i.test(idOrName)) {
          resolvedPlayerIds.push(idOrName);
        } else {
          const id = await getPlayerIdByUsername(idOrName);
          if (id) resolvedPlayerIds.push(id);
        }
      }
    }

    const msg = await createAdminMessage({
      adminName,
      scope: scope as AdminMessageScope,
      content,
      targetSectorX: targetSectorX ?? null,
      targetSectorY: targetSectorY ?? null,
      targetPlayerIds: resolvedPlayerIds,
      allowReply,
    });

    await logAdminEvent({
      eventType: 'comm_sent',
      label: `COMM [${scope}] from Admin:${adminName}`,
      payload: { messageId: msg.id, scope, allowReply },
      targetSectorX: targetSectorX ?? null,
      targetSectorY: targetSectorY ?? null,
    });

    // Relay to live rooms via adminBus
    adminBus.broadcastComm({
      id: msg.id,
      adminName,
      scope: scope as AdminMessageScope,
      content,
      targetSectorX,
      targetSectorY,
      targetPlayerIds: resolvedPlayerIds ?? undefined,
      allowReply,
      sentAt: Date.now(),
    });

    res.status(201).json({ message: msg });
  } catch (err) {
    console.error('[admin] POST /comms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /admin/api/comms — Last 50 sent messages */
adminRouter.get('/comms', async (_req, res) => {
  try {
    const messages = await getAdminMessages(50);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /admin/api/comms/inbox — All player replies to admin messages */
adminRouter.get('/comms/inbox', async (_req, res) => {
  try {
    const replies = await getAllReplies(100);
    res.json({ replies });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /admin/api/comms/:id/replies — Replies to a specific message */
adminRouter.get('/comms/:id/replies', async (req, res) => {
  try {
    const replies = await getAdminMessageReplies(req.params.id);
    res.json({ replies });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Admin Events ──────────────────────────────────────────────────────────────

/**
 * POST /admin/api/events — Trigger a game event.
 *
 * Body:
 * {
 *   eventType: string,         // e.g. "resource_surge", "pirate_wave", "announcement"
 *   label?: string,
 *   payload?: object,
 *   targetSectorX?: number,
 *   targetSectorY?: number
 * }
 */
adminRouter.post('/events', async (req, res) => {
  try {
    const { eventType, label, payload = {}, targetSectorX, targetSectorY } = req.body;
    if (!eventType) {
      res.status(400).json({ error: 'eventType is required' });
      return;
    }

    await logAdminEvent({ eventType, label, payload, targetSectorX, targetSectorY });

    adminBus.triggerEvent({
      eventType,
      label,
      payload,
      targetSectorX,
      targetSectorY,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[admin] POST /events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /admin/api/events — Event log */
adminRouter.get('/events', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const events = await getAdminEvents(limit);
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Stats ─────────────────────────────────────────────────────────────────────

/** GET /admin/api/stats */
adminRouter.get('/stats', async (_req, res) => {
  try {
    const stats = await getServerStats();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /admin/api/ping — Check auth without side effects */
adminRouter.get('/ping', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});
