import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import yaml from 'js-yaml';
import {
  getAllPlayers,
  getPlayerById,
  getPlayerFullProfile,
  adminSetPlayerCredits,
  adminSetCargoItem,
  createAdminQuest,
  getAdminQuests,
  getAdminQuestById,
  updateAdminQuestStatus,
  createAdminMessage,
  getAdminMessages,
  getAdminReplies,
  logAdminEvent,
  getAdminEvents,
  getServerStats,
  createAdminStory,
  getAdminStories,
  getAdminStoryById,
} from './db/adminQueries.js';
import type { AdminQuestInput, AdminMessageInput, AdminStoryInput } from './db/adminQueries.js';
import type { AdminPlayerUpdateEvent } from './adminBus.js';
import {
  getPlayerPosition,
  savePlayerPosition,
} from './rooms/services/RedisAPStore.js';
import { adminBus } from './adminBus.js';
import { logger } from './utils/logger.js';

export const adminRouter = Router();

// ── Auth Middleware ─────────────────────────────────────────────────

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    res.status(500).json({ error: 'ADMIN_TOKEN not configured' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== adminToken) {
    res.status(401).json({ error: 'Invalid admin token' });
    return;
  }

  next();
}

adminRouter.use(adminAuth);

// ── Players ─────────────────────────────────────────────────────────

adminRouter.get('/players', async (_req: Request, res: Response) => {
  try {
    const players = await getAllPlayers();
    await logAdminEvent('list_players', { count: players.length });
    res.json({ players });
  } catch (err) {
    logger.error({ err }, 'Admin list players error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/players/:id', async (req: Request, res: Response) => {
  try {
    const player = await getPlayerFullProfile(req.params.id as string);
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    const pos = await getPlayerPosition(req.params.id as string);
    if (pos) {
      player.positionX = pos.x;
      player.positionY = pos.y;
    }
    await logAdminEvent('get_player', { playerId: req.params.id });
    res.json({ player });
  } catch (err) {
    logger.error({ err }, 'Admin get player error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/players/:id/position', async (req: Request, res: Response) => {
  try {
    const { x, y } = req.body;
    if (typeof x !== 'number' || typeof y !== 'number') {
      res.status(400).json({ error: 'x and y must be numbers' });
      return;
    }
    const player = await getPlayerById(req.params.id as string);
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    await savePlayerPosition(req.params.id as string, Math.round(x), Math.round(y));
    const updates: AdminPlayerUpdateEvent['updates'] = {
      positionX: Math.round(x),
      positionY: Math.round(y),
    };
    adminBus.playerUpdated({ playerId: req.params.id as string, updates });
    await logAdminEvent('set_player_position', { playerId: req.params.id, x, y });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Admin set player position error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/players/:id/credits', async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (typeof amount !== 'number' || amount < 0) {
      res.status(400).json({ error: 'amount must be a non-negative number' });
      return;
    }
    const ok = await adminSetPlayerCredits(req.params.id as string, Math.round(amount));
    if (!ok) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    const updates: AdminPlayerUpdateEvent['updates'] = { credits: Math.round(amount) };
    adminBus.playerUpdated({ playerId: req.params.id as string, updates });
    await logAdminEvent('set_player_credits', { playerId: req.params.id, amount });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Admin set player credits error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/players/:id/cargo', async (req: Request, res: Response) => {
  try {
    const { resource, amount } = req.body;
    if (typeof resource !== 'string' || !resource) {
      res.status(400).json({ error: 'resource must be a non-empty string' });
      return;
    }
    if (typeof amount !== 'number' || amount < 0) {
      res.status(400).json({ error: 'amount must be a non-negative number' });
      return;
    }
    const player = await getPlayerById(req.params.id as string);
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    await adminSetCargoItem(req.params.id as string, resource, Math.round(amount));
    const cargoUpdate: Record<string, number> = { [resource]: Math.round(amount) };
    adminBus.playerUpdated({ playerId: req.params.id as string, updates: { cargo: cargoUpdate } });
    await logAdminEvent('set_player_cargo', { playerId: req.params.id, resource, amount });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Admin set player cargo error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Quests ───────────────────────────────────────────────────────────

adminRouter.post('/quests', async (req: Request, res: Response) => {
  try {
    let questInput: AdminQuestInput;

    const contentType = req.headers['content-type'] ?? '';
    if (contentType.includes('application/x-yaml') || contentType.includes('text/yaml')) {
      // Parse YAML body (raw text)
      const rawBody = await getRawBody(req);
      const parsed = yaml.load(rawBody);
      if (!parsed || typeof parsed !== 'object') {
        res.status(400).json({ error: 'Invalid YAML body' });
        return;
      }
      questInput = parsed as AdminQuestInput;
    } else {
      questInput = req.body as AdminQuestInput;
    }

    if (!questInput.title || !questInput.description) {
      res.status(400).json({ error: 'title and description are required' });
      return;
    }

    const questId = await createAdminQuest(questInput);
    await logAdminEvent('create_quest', { questId, title: questInput.title });

    // Emit to SectorRoom instances via event bus
    adminBus.questCreated({
      questId,
      title: questInput.title,
      description: questInput.description,
      scope: (questInput.scope ?? 'universal') as 'universal' | 'individual' | 'sector',
      targetPlayers: questInput.targetPlayers ?? [],
      sectorX: questInput.sectorX,
      sectorY: questInput.sectorY,
    });

    res.status(201).json({ id: questId });
  } catch (err) {
    logger.error({ err }, 'Admin create quest error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/quests', async (req: Request, res: Response) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const quests = await getAdminQuests(statusFilter);
    await logAdminEvent('list_quests', { count: quests.length, statusFilter });
    res.json({ quests });
  } catch (err) {
    logger.error({ err }, 'Admin list quests error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/quests/:id', async (req: Request, res: Response) => {
  try {
    const quest = await getAdminQuestById(req.params.id as string);
    if (!quest) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    await logAdminEvent('get_quest', { questId: req.params.id });
    res.json({ quest });
  } catch (err) {
    logger.error({ err }, 'Admin get quest error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.patch('/quests/:id', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status || typeof status !== 'string') {
      res.status(400).json({ error: 'status is required' });
      return;
    }

    const validStatuses = ['active', 'paused', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res
        .status(400)
        .json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const quest = await updateAdminQuestStatus(req.params.id as string, status);
    if (!quest) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }

    await logAdminEvent('update_quest_status', { questId: req.params.id, status });
    res.json({ quest });
  } catch (err) {
    logger.error({ err }, 'Admin update quest error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Messages ────────────────────────────────────────────────────────

adminRouter.post('/messages', async (req: Request, res: Response) => {
  try {
    const messageInput = req.body as AdminMessageInput;
    if (!messageInput.content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const messageId = await createAdminMessage(messageInput);
    await logAdminEvent('create_message', { messageId, content: messageInput.content });

    // Emit to SectorRoom instances via event bus
    adminBus.broadcast({
      senderName: messageInput.senderName ?? 'SYSTEM',
      content: messageInput.content,
      scope: (messageInput.scope ?? 'universal') as 'universal' | 'individual',
      targetPlayers: messageInput.targetPlayers ?? [],
      channel: messageInput.channel ?? 'direct',
      allowReply: messageInput.allowReply ?? false,
      messageId,
    });

    res.status(201).json({ id: messageId });
  } catch (err) {
    logger.error({ err }, 'Admin create message error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/messages', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const messages = await getAdminMessages(limit);
    await logAdminEvent('list_messages', { count: messages.length });
    res.json({ messages });
  } catch (err) {
    logger.error({ err }, 'Admin list messages error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/messages/:id/replies', async (req: Request, res: Response) => {
  try {
    const replies = await getAdminReplies(req.params.id as string);
    await logAdminEvent('list_replies', { messageId: req.params.id, count: replies.length });
    res.json({ replies });
  } catch (err) {
    logger.error({ err }, 'Admin list replies error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Events ──────────────────────────────────────────────────────────

adminRouter.get('/events', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const events = await getAdminEvents(limit);
    res.json({ events });
  } catch (err) {
    logger.error({ err }, 'Admin list events error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Stats ───────────────────────────────────────────────────────────

adminRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getServerStats();
    await logAdminEvent('get_stats');
    res.json({ stats });
  } catch (err) {
    logger.error({ err }, 'Admin get stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Stories ─────────────────────────────────────────────────────────

adminRouter.post('/stories', async (req: Request, res: Response) => {
  try {
    const storyInput = req.body as AdminStoryInput;
    if (!storyInput.title || !storyInput.summary) {
      res.status(400).json({ error: 'title and summary are required' });
      return;
    }

    const validStatuses = ['draft', 'published', 'archived'];
    if (storyInput.status && !validStatuses.includes(storyInput.status)) {
      res
        .status(400)
        .json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const storyId = await createAdminStory(storyInput);
    await logAdminEvent('create_story', { storyId, title: storyInput.title });
    res.status(201).json({ id: storyId });
  } catch (err) {
    logger.error({ err }, 'Admin create story error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/stories', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const stories = await getAdminStories(limit);
    await logAdminEvent('list_stories', { count: stories.length });
    res.json({ stories });
  } catch (err) {
    logger.error({ err }, 'Admin list stories error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/stories/:id', async (req: Request, res: Response) => {
  try {
    const story = await getAdminStoryById(req.params.id as string);
    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }
    await logAdminEvent('get_story', { storyId: req.params.id });
    res.json({ story });
  } catch (err) {
    logger.error({ err }, 'Admin get story error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Helpers ─────────────────────────────────────────────────────────

function getRawBody(req: Request): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString();
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
