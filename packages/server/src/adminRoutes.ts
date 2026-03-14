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
  getRecentExpansionLog,
  createAdminStory,
  getAdminStories,
  getAdminStoryById,
  getAdminQuadrantMap,
  getActiveFactionHomes,
  getErrorLogs,
  updateErrorLogStatus,
  deleteErrorLog,
} from './db/adminQueries.js';
import type { AdminQuestInput, AdminMessageInput, AdminStoryInput } from './db/adminQueries.js';
import type { AdminPlayerUpdateEvent } from './adminBus.js';
import { getPlayerPosition, savePlayerPosition } from './rooms/services/RedisAPStore.js';
import { adminBus } from './adminBus.js';
import { logger } from './utils/logger.js';
import { getUniverseTickCount } from './engine/universeBootstrap.js';
import {
  getAllConstructionSites,
  getConstructionSiteById,
  deleteConstructionSiteById,
} from './db/constructionQueries.js';
import {
  createStructure,
  upsertInventory,
  getSector,
  createDataSlate,
  updateSlateOwner,
  addSlateToCargo,
} from './db/queries.js';
import { query } from './db/client.js';
import { civQueries } from './db/civQueries.js';
import { constructionBus } from './constructionBus.js';
import { MODULES, QUADRANT_SIZE } from '@void-sector/shared';
import { STORY_CHAPTERS } from './engine/storyQuestChain.js';
import { getStoryProgress, upsertStoryProgress } from './db/queries.js';
import { gameConfig } from './engine/gameConfigService.js';
import { getDefaultValue } from './engine/gameConfigApply.js';
import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

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
    // Accept either { resource, amount } (single) or { items: [...] } (batch)
    type ItemEntry = { itemType?: string; itemId?: string; resource?: string; quantity?: number; amount?: number };
    const items: ItemEntry[] = Array.isArray(req.body.items)
      ? req.body.items
      : [{ resource: req.body.resource, amount: req.body.amount }];

    // Validate all items before hitting the DB
    const cargoUpdate: Record<string, number> = {};
    for (const item of items) {
      const resource = item.itemId ?? item.resource ?? '';
      const amount = item.quantity ?? item.amount ?? 0;
      if (typeof resource !== 'string' || !resource) {
        res.status(400).json({ error: 'Each item must have a resource/itemId string' });
        return;
      }
      if (typeof amount !== 'number' || amount < 0) {
        res.status(400).json({ error: 'Each item must have a non-negative quantity/amount' });
        return;
      }
      cargoUpdate[resource] = Math.round(amount);
    }

    const player = await getPlayerById(req.params.id as string);
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    for (const [resource, amount] of Object.entries(cargoUpdate)) {
      await adminSetCargoItem(req.params.id as string, resource, amount);
    }

    adminBus.playerUpdated({ playerId: req.params.id as string, updates: { cargo: cargoUpdate } });
    await logAdminEvent('set_player_cargo', { playerId: req.params.id, items: cargoUpdate });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Admin set player cargo error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Catalog (for admin UI dropdowns) ────────────────────────────────

adminRouter.post('/players/:id/cargo', async (req: Request, res: Response) => {
  try {
    const player = await getPlayerById(req.params.id as string);
    if (!player) { res.status(404).json({ error: 'Player not found' }); return; }
    const resources = req.body as Record<string, number>;
    const allowed = ['ore', 'gas', 'crystal', 'slate', 'artefact', 'fuel'];
    for (const [resource, amount] of Object.entries(resources)) {
      if (!allowed.includes(resource)) continue;
      if (typeof amount !== 'number' || amount <= 0) continue;
      await query(
        `INSERT INTO cargo (player_id, resource, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (player_id, resource) DO UPDATE SET quantity = cargo.quantity + $3`,
        [req.params.id, resource, amount],
      );
    }
    // Notify live session so client updates without reconnect
    const cargoUpdate: Record<string, number> = {};
    for (const [resource, amount] of Object.entries(resources)) {
      if (!['ore', 'gas', 'crystal', 'slate', 'artefact', 'fuel'].includes(resource)) continue;
      if (typeof amount === 'number' && amount > 0) cargoUpdate[resource] = amount;
    }
    adminBus.playerUpdated({ playerId: req.params.id as string, updates: { cargo: cargoUpdate } });
    await logAdminEvent('give_player_cargo', { playerId: req.params.id, resources });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Admin give cargo error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.get('/catalog', (_req: Request, res: Response) => {
  const resources = ['ore', 'gas', 'crystal', 'artefact', 'fuel_cell',
    'artefact_drive', 'artefact_cargo', 'artefact_scanner', 'artefact_armor',
    'artefact_weapon', 'artefact_shield', 'artefact_defense', 'artefact_special',
    'artefact_mining', 'artefact_generator', 'artefact_repair'];
  const moduleIds = Object.keys(MODULES).sort();
  res.json({ resources, modules: moduleIds, blueprints: moduleIds });
});

// ── Inventory (modules & blueprints) ────────────────────────────────

adminRouter.patch('/players/:id/inventory', async (req: Request, res: Response) => {
  try {
    const { itemType, itemId, quantity } = req.body;
    if (!['module', 'blueprint'].includes(itemType)) {
      res.status(400).json({ error: 'itemType must be module or blueprint' });
      return;
    }
    if (typeof itemId !== 'string' || !itemId) {
      res.status(400).json({ error: 'itemId must be a non-empty string' });
      return;
    }
    if (typeof quantity !== 'number' || quantity < 1) {
      res.status(400).json({ error: 'quantity must be a positive number' });
      return;
    }
    const player = await getPlayerById(req.params.id as string);
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    await upsertInventory(req.params.id as string, itemType, itemId, Math.round(quantity));
    await logAdminEvent('add_player_inventory', { playerId: req.params.id, itemType, itemId, quantity });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Admin add inventory error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Data Slates ──────────────────────────────────────────────────────

adminRouter.post('/players/:id/slates', async (req: Request, res: Response) => {
  try {
    const { quadrantX, quadrantY, sectorX, sectorY } = req.body;
    for (const [name, val] of Object.entries({ quadrantX, quadrantY, sectorX, sectorY })) {
      if (typeof val !== 'number' || !Number.isInteger(val)) {
        res.status(400).json({ error: `${name} must be an integer` });
        return;
      }
    }
    const player = await getPlayerById(req.params.id as string);
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    // Convert quadrant + inner sector coords to absolute
    const absX = quadrantX * QUADRANT_SIZE + sectorX;
    const absY = quadrantY * QUADRANT_SIZE + sectorY;
    const sector = await getSector(absX, absY);
    if (!sector) {
      res.status(404).json({ error: `Sector (${absX}, ${absY}) not found in DB — visit it first to generate it` });
      return;
    }
    const { id: slateId } = await createDataSlate(req.params.id as string, 'sector', [sector]);
    await updateSlateOwner(slateId, req.params.id as string);
    await addSlateToCargo(req.params.id as string, 1);
    await logAdminEvent('give_player_slate', { playerId: req.params.id, quadrantX, quadrantY, sectorX, sectorY, absX, absY, slateId });
    res.json({ ok: true, slateId, absX, absY });
  } catch (err) {
    logger.error({ err }, 'Admin give slate error');
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
    const tickCount = getUniverseTickCount();
    const stats = await getServerStats(tickCount);
    await logAdminEvent('get_stats');
    res.json({ stats });
  } catch (err) {
    logger.error({ err }, 'Admin get stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Universe Activity ────────────────────────────────────────────────

adminRouter.get('/universe-activity', async (_req: Request, res: Response) => {
  try {
    const log = await getRecentExpansionLog(50);
    res.json({ log });
  } catch (err) {
    logger.error({ err }, 'Admin universe-activity error');
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

// ── Quadrant Map ─────────────────────────────────────────────────────

adminRouter.get('/quadrant-map', async (_req: Request, res: Response) => {
  try {
    const data = await getAdminQuadrantMap();
    res.json(data);
  } catch (err) {
    logger.error({ err }, 'Admin quadrant-map error');
    res.status(500).json({ error: 'Internal error' });
  }
});

adminRouter.get('/faction-homes', async (_req: Request, res: Response) => {
  try {
    const homes = await getActiveFactionHomes();
    res.json({ homes });
  } catch (err) {
    logger.error({ err }, 'Admin faction-homes error');
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── Construction Sites ──────────────────────────────────────────────

adminRouter.get('/construction-sites', async (_req: Request, res: Response) => {
  try {
    const sites = await getAllConstructionSites();
    await logAdminEvent('list_construction_sites', { count: sites.length });
    res.json({ sites });
  } catch (err) {
    logger.error({ err }, 'Admin construction-sites GET error');
    res.status(500).json({ error: 'Internal error' });
  }
});

adminRouter.post('/construction-sites/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const site = await getConstructionSiteById(id);
    if (!site) {
      res.status(404).json({ error: 'Construction site not found' });
      return;
    }
    try {
      await createStructure(site.owner_id, site.type, site.sector_x, site.sector_y);
      await deleteConstructionSiteById(site.id);
    } catch (err: any) {
      if (err.code !== '23505') throw err;
      // Duplicate structure — delete site anyway and treat as success
      await deleteConstructionSiteById(site.id);
    }
    await logAdminEvent('complete_construction', { siteId: site.id, type: site.type, sectorX: site.sector_x, sectorY: site.sector_y });
    constructionBus.emit('completed', {
      siteId: site.id,
      sectorX: site.sector_x,
      sectorY: site.sector_y,
    });
    logger.info({ id, type: site.type }, 'Admin completed construction site');
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Admin construction-sites POST complete error');
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── Structures Overview ─────────────────────────────────────────────

adminRouter.get('/structures/overview', async (req: Request, res: Response) => {
  try {
    const filter = (req.query.filter as string) ?? 'all'; // 'all' | 'npc' | 'player'

    let stations: any[] = [];
    let playerStations: any[] = [];

    if (filter === 'all' || filter === 'npc') {
      stations = await civQueries.getAllStations();
    }

    if (filter === 'all' || filter === 'player') {
      const { rows } = await query<{
        id: string; owner_id: string; sector_x: number; sector_y: number;
        quadrant_x: number; quadrant_y: number; level: number;
        factory_level: number; cargo_level: number;
        created_at: string; owner_name: string | null;
      }>(
        `SELECT ps.*, p.username AS owner_name
         FROM player_stations ps
         LEFT JOIN players p ON p.id = ps.owner_id
         ORDER BY ps.created_at DESC`,
      );
      playerStations = rows.map(r => ({
        ...r,
        source: 'player',
        faction: 'humans',
      }));
    }

    // Mark NPC stations with source
    const npcStations = stations.map(s => ({ ...s, source: 'npc' }));

    const { rows: jumpgates } = await query<{
      id: string; sector_x: number; sector_y: number;
      target_x: number; target_y: number; gate_type: string;
      owner_id: string | null; toll_credits: number;
      level_connection: number; level_distance: number;
      built_at: string | null; owner_name: string | null;
    }>(
      `SELECT g.id, g.sector_x, g.sector_y, g.target_x, g.target_y,
              g.gate_type, g.owner_id::text, g.toll_credits,
              g.level_connection, g.level_distance, g.built_at,
              p.username AS owner_name
       FROM jumpgates g
       LEFT JOIN players p ON p.id = g.owner_id
       ORDER BY g.sector_x, g.sector_y`,
    );

    res.json({ stations: [...npcStations, ...playerStations], jumpgates });
  } catch (err) {
    logger.error({ err }, 'Admin structures overview GET error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/structures/station', async (req: Request, res: Response) => {
  try {
    const { sectorX, sectorY, hasShipyard, hasWarehouse, hasKontor } = req.body as {
      sectorX: number; sectorY: number;
      hasShipyard?: boolean; hasWarehouse?: boolean; hasKontor?: boolean;
    };
    if (typeof sectorX !== 'number' || typeof sectorY !== 'number') {
      res.status(400).json({ error: 'sectorX and sectorY required' });
      return;
    }
    await query(
      `INSERT INTO civ_stations (sector_x, sector_y, faction, has_shipyard, has_warehouse, has_kontor, mode)
       VALUES ($1, $2, 'humans', $3, $4, $5, 'conquest')
       ON CONFLICT (sector_x, sector_y) DO UPDATE SET faction = 'humans', mode = 'conquest'`,
      [sectorX, sectorY, hasShipyard ?? true, hasWarehouse ?? true, hasKontor ?? false],
    );
    await query(
      `INSERT INTO sectors (x, y, type, seed) VALUES ($1, $2, 'station', 0)
       ON CONFLICT (x, y) DO UPDATE SET type = 'station'`,
      [sectorX, sectorY],
    );
    const qx = Math.floor(sectorX / QUADRANT_SIZE);
    const qy = Math.floor(sectorY / QUADRANT_SIZE);
    await query(
      `INSERT INTO quadrant_control (qx, qy, controlling_faction, faction_shares)
       VALUES ($1, $2, 'humans', '{"humans": 0}')
       ON CONFLICT (qx, qy) DO NOTHING`,
      [qx, qy],
    );
    await logAdminEvent('create_human_station', { sectorX, sectorY });
    logger.info({ sectorX, sectorY }, 'Admin created human station');
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Admin create station error');
    res.status(500).json({ error: 'Internal error' });
  }
});

adminRouter.post('/structures/jumpgate', async (req: Request, res: Response) => {
  try {
    const { sectorX, sectorY, targetX, targetY, gateType } = req.body as {
      sectorX: number; sectorY: number;
      targetX?: number; targetY?: number; gateType?: string;
    };
    if (typeof sectorX !== 'number' || typeof sectorY !== 'number') {
      res.status(400).json({ error: 'sectorX and sectorY required' });
      return;
    }
    const id = `system_${sectorX}_${sectorY}`;
    const tx = targetX ?? sectorX;
    const ty = targetY ?? sectorY;
    const gt = gateType === 'wormhole' ? 'wormhole' : 'bidirectional';
    await query(
      `INSERT INTO jumpgates (id, sector_x, sector_y, target_x, target_y, gate_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (sector_x, sector_y) DO NOTHING`,
      [id, sectorX, sectorY, tx, ty, gt],
    );
    await query(
      `INSERT INTO sectors (x, y, type, seed) VALUES ($1, $2, 'jumpgate', 0)
       ON CONFLICT (x, y) DO UPDATE SET type = 'jumpgate'`,
      [sectorX, sectorY],
    );
    await logAdminEvent('create_jumpgate', { sectorX, sectorY, targetX: tx, targetY: ty, gateType: gt });
    logger.info({ sectorX, sectorY }, 'Admin created jumpgate');
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Admin create jumpgate error');
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── Error Logs ──────────────────────────────────────────────────────

adminRouter.get('/errors', async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'new';
    const errors = await getErrorLogs(status);
    await logAdminEvent('list_errors', { status, count: errors.length });
    res.json({ errors });
  } catch (err) {
    logger.error({ err }, 'Admin list errors');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/errors/:id/ignore', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
    const ok = await updateErrorLogStatus(id, 'ignored');
    await logAdminEvent('ignore_error', { id });
    res.json({ success: ok });
  } catch (err) {
    logger.error({ err }, 'Admin ignore error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/errors/:id/resolve', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
    const ok = await updateErrorLogStatus(id, 'resolved');
    await logAdminEvent('resolve_error', { id });
    res.json({ success: ok });
  } catch (err) {
    logger.error({ err }, 'Admin resolve error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.delete('/errors/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
    const ok = await deleteErrorLog(id);
    await logAdminEvent('delete_error', { id });
    res.json({ success: ok });
  } catch (err) {
    logger.error({ err }, 'Admin delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Story Event Trigger ─────────────────────────────────────────────

adminRouter.post('/story/trigger', async (req: Request, res: Response) => {
  try {
    const { playerId, chapter } = req.body;
    if (!playerId || chapter === undefined) {
      res.status(400).json({ error: 'playerId and chapter required' });
      return;
    }
    const chapterNum = Number(chapter);
    const chapterDef = STORY_CHAPTERS[chapterNum];
    if (!chapterDef) {
      res.status(400).json({ error: `Chapter ${chapterNum} not found. Valid: 0-${STORY_CHAPTERS.length - 1}` });
      return;
    }

    const row = await getStoryProgress(playerId);
    const completedChapters = [...row.completed_chapters];

    // Ensure all previous chapters are marked completed
    for (let i = 0; i < chapterNum; i++) {
      if (!completedChapters.includes(i)) completedChapters.push(i);
    }

    // Set current_chapter to this chapter so it triggers on next sector enter
    await upsertStoryProgress(playerId, chapterNum, completedChapters, row.branch_choices);

    await logAdminEvent('story_trigger', { playerId, chapter: chapterNum, title: chapterDef.title });
    res.json({
      ok: true,
      chapter: chapterNum,
      title: chapterDef.title,
      message: `Chapter ${chapterNum} queued for player. Will trigger on next sector enter.`,
    });
  } catch (err) {
    logger.error({ err }, 'Admin story trigger error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Game Config ──────────────────────────────────────────────────

// GET /admin/api/config — all values, optional ?category= filter
adminRouter.get('/config', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const entries = gameConfig.getAll(category || undefined);
    const categories = gameConfig.getCategories();
    res.json({ entries, categories });
  } catch (err) {
    logger.error({ err }, 'Admin get config error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/api/config/by-key?key=AP_DEFAULTS.max — single value + default
adminRouter.get('/config/by-key', async (req: Request, res: Response) => {
  try {
    const key = req.query.key as string;
    if (!key) { res.status(400).json({ error: 'key query param required' }); return; }
    const value = gameConfig.get(key);
    const defaultValue = getDefaultValue(key);
    res.json({ key, value: value ?? defaultValue, defaultValue, isCustom: value !== undefined });
  } catch (err) {
    logger.error({ err }, 'Admin get config key error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /admin/api/config/by-key — update value
adminRouter.put('/config/by-key', async (req: Request, res: Response) => {
  try {
    const { key, value, category, description } = req.body;
    if (!key || value === undefined) { res.status(400).json({ error: 'key and value required' }); return; }
    const previous = await gameConfig.set(key, value, category, description);
    await logAdminEvent('config_update', { key, value, previous });
    res.json({ ok: true, key, value, previous });
  } catch (err) {
    logger.error({ err }, 'Admin set config error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /admin/api/config/by-key?key=AP_DEFAULTS.max — reset to default
adminRouter.delete('/config/by-key', async (req: Request, res: Response) => {
  try {
    const key = req.query.key as string;
    if (!key) { res.status(400).json({ error: 'key query param required' }); return; }
    await gameConfig.delete(key);
    const defaultValue = getDefaultValue(key);
    await logAdminEvent('config_reset', { key, defaultValue });
    res.json({ ok: true, key, resetTo: defaultValue });
  } catch (err) {
    logger.error({ err }, 'Admin delete config error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/api/config/export-issue — create GH issue with all current values
adminRouter.post('/config/export-issue', async (req: Request, res: Response) => {
  try {
    const entries = gameConfig.getAll();
    const categories = gameConfig.getCategories();

    let body = `# Game Config Snapshot ${new Date().toISOString().split('T')[0]}\n\n`;
    body += `> Auto-generated from admin console. ${entries.length} values.\n\n`;

    for (const cat of categories) {
      const catEntries = entries.filter((e) => e.category === cat);
      if (catEntries.length === 0) continue;
      body += `## ${cat.toUpperCase()}\n\n`;
      body += '| Key | Value |\n|-----|-------|\n';
      for (const e of catEntries) {
        const val = typeof e.value === 'object' ? JSON.stringify(e.value) : String(e.value);
        const truncated = val.length > 80 ? val.substring(0, 77) + '...' : val;
        body += `| ${e.key} | \`${truncated}\` |\n`;
      }
      body += '\n';
    }

    // Write body to temp file for gh CLI
    const tmpPath = join(tmpdir(), `config_export_${Date.now()}.md`);
    await writeFile(tmpPath, body);

    const result = await new Promise<{ stdout: string; stderr: string; status: number }>((resolve) => {
      execFile('gh', [
        'issue', 'create',
        '--title', `chore: update default game config values [${new Date().toISOString().split('T')[0]}]`,
        '--body-file', tmpPath,
      ], (error, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          status: error ? 1 : 0,
        });
      });
    });

    await unlink(tmpPath).catch(() => {});

    if (result.status !== 0) {
      res.status(500).json({ error: 'Failed to create GH issue', stderr: result.stderr });
      return;
    }

    const issueUrl = result.stdout.trim();
    await logAdminEvent('config_export_issue', { issueUrl });
    res.json({ ok: true, issueUrl });
  } catch (err) {
    logger.error({ err }, 'Admin export config issue error');
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
