import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import yaml from 'js-yaml';
import {
  getAllPlayers,
  getPlayerById,
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
} from './db/adminQueries.js';
import type { AdminQuestInput, AdminMessageInput } from './db/adminQueries.js';

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
    console.error('Admin list players error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/players/:id', async (req: Request, res: Response) => {
  try {
    const player = await getPlayerById(req.params.id);
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    await logAdminEvent('get_player', { playerId: req.params.id });
    res.json({ player });
  } catch (err) {
    console.error('Admin get player error:', err);
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
    res.status(201).json({ id: questId });
  } catch (err) {
    console.error('Admin create quest error:', err);
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
    console.error('Admin list quests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/quests/:id', async (req: Request, res: Response) => {
  try {
    const quest = await getAdminQuestById(req.params.id);
    if (!quest) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    await logAdminEvent('get_quest', { questId: req.params.id });
    res.json({ quest });
  } catch (err) {
    console.error('Admin get quest error:', err);
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
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const quest = await updateAdminQuestStatus(req.params.id, status);
    if (!quest) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }

    await logAdminEvent('update_quest_status', { questId: req.params.id, status });
    res.json({ quest });
  } catch (err) {
    console.error('Admin update quest error:', err);
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
    res.status(201).json({ id: messageId });
  } catch (err) {
    console.error('Admin create message error:', err);
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
    console.error('Admin list messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/messages/:id/replies', async (req: Request, res: Response) => {
  try {
    const replies = await getAdminReplies(req.params.id);
    await logAdminEvent('list_replies', { messageId: req.params.id, count: replies.length });
    res.json({ replies });
  } catch (err) {
    console.error('Admin list replies error:', err);
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
    console.error('Admin list events error:', err);
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
    console.error('Admin get stats error:', err);
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
