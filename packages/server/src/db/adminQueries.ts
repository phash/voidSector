import { query } from './client.js';

// ── Player Queries ──────────────────────────────────────────────────

export interface AdminPlayer {
  id: string;
  username: string;
  positionX: number;
  positionY: number;
  xp: number;
  level: number;
  factionId: string | null;
}

export async function getAllPlayers(): Promise<AdminPlayer[]> {
  const result = await query<{
    id: string;
    username: string;
    position_x: number;
    position_y: number;
    xp: number;
    level: number;
    faction_id: string | null;
  }>(
    `SELECT id, username, position_x, position_y, xp, level, faction_id
     FROM players
     ORDER BY username ASC`
  );
  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    positionX: row.position_x,
    positionY: row.position_y,
    xp: row.xp,
    level: row.level,
    factionId: row.faction_id,
  }));
}

export async function getPlayerById(id: string): Promise<AdminPlayer | null> {
  const result = await query<{
    id: string;
    username: string;
    position_x: number;
    position_y: number;
    xp: number;
    level: number;
    faction_id: string | null;
  }>(
    `SELECT id, username, position_x, position_y, xp, level, faction_id
     FROM players
     WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    positionX: row.position_x,
    positionY: row.position_y,
    xp: row.xp,
    level: row.level,
    factionId: row.faction_id,
  };
}

export async function getPlayerByUsername(username: string): Promise<AdminPlayer | null> {
  const result = await query<{
    id: string;
    username: string;
    position_x: number;
    position_y: number;
    xp: number;
    level: number;
    faction_id: string | null;
  }>(
    `SELECT id, username, position_x, position_y, xp, level, faction_id
     FROM players
     WHERE username = $1`,
    [username]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    positionX: row.position_x,
    positionY: row.position_y,
    xp: row.xp,
    level: row.level,
    factionId: row.faction_id,
  };
}

// ── Admin Quest Queries ─────────────────────────────────────────────

export interface AdminQuestInput {
  title: string;
  description: string;
  scope?: string;
  questType?: string;
  npcName?: string;
  npcFaction?: string;
  objectives?: unknown[];
  rewards?: Record<string, unknown>;
  flavor?: Record<string, unknown>;
  sectorX?: number;
  sectorY?: number;
  targetPlayers?: string[];
  maxAcceptances?: number;
  expiresDays?: number;
}

export interface AdminQuest {
  id: string;
  title: string;
  description: string;
  scope: string;
  questType: string;
  npcName: string | null;
  npcFaction: string | null;
  objectives: unknown[];
  rewards: Record<string, unknown>;
  flavor: Record<string, unknown>;
  sectorX: number | null;
  sectorY: number | null;
  targetPlayers: string[];
  maxAcceptances: number;
  expiresDays: number;
  status: string;
  createdAt: string;
}

export interface AdminQuestWithCount extends AdminQuest {
  assignmentCount: number;
}

export async function createAdminQuest(input: AdminQuestInput): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO admin_quests
       (title, description, scope, quest_type, npc_name, npc_faction,
        objectives, rewards, flavor, sector_x, sector_y,
        target_players, max_acceptances, expires_days)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [
      input.title,
      input.description,
      input.scope ?? 'universal',
      input.questType ?? 'fetch',
      input.npcName ?? null,
      input.npcFaction ?? null,
      JSON.stringify(input.objectives ?? []),
      JSON.stringify(input.rewards ?? {}),
      JSON.stringify(input.flavor ?? {}),
      input.sectorX ?? null,
      input.sectorY ?? null,
      input.targetPlayers ?? [],
      input.maxAcceptances ?? 0,
      input.expiresDays ?? 7,
    ]
  );
  return result.rows[0].id;
}

export async function getAdminQuests(statusFilter?: string): Promise<AdminQuest[]> {
  const hasFilter = statusFilter !== undefined && statusFilter !== null;
  const sql = hasFilter
    ? `SELECT * FROM admin_quests WHERE status = $1 ORDER BY created_at DESC`
    : `SELECT * FROM admin_quests ORDER BY created_at DESC`;
  const params = hasFilter ? [statusFilter] : [];
  const result = await query<{
    id: string;
    title: string;
    description: string;
    scope: string;
    quest_type: string;
    npc_name: string | null;
    npc_faction: string | null;
    objectives: unknown[];
    rewards: Record<string, unknown>;
    flavor: Record<string, unknown>;
    sector_x: number | null;
    sector_y: number | null;
    target_players: string[];
    max_acceptances: number;
    expires_days: number;
    status: string;
    created_at: string;
  }>(sql, params);
  return result.rows.map(mapQuestRow);
}

export async function getAdminQuestById(id: string): Promise<AdminQuestWithCount | null> {
  const result = await query<{
    id: string;
    title: string;
    description: string;
    scope: string;
    quest_type: string;
    npc_name: string | null;
    npc_faction: string | null;
    objectives: unknown[];
    rewards: Record<string, unknown>;
    flavor: Record<string, unknown>;
    sector_x: number | null;
    sector_y: number | null;
    target_players: string[];
    max_acceptances: number;
    expires_days: number;
    status: string;
    created_at: string;
    assignment_count: string;
  }>(
    `SELECT q.*,
            (SELECT COUNT(*) FROM admin_quest_assignments WHERE quest_id = q.id) AS assignment_count
     FROM admin_quests q
     WHERE q.id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    ...mapQuestRow(row),
    assignmentCount: parseInt(row.assignment_count, 10),
  };
}

function mapQuestRow(row: {
  id: string;
  title: string;
  description: string;
  scope: string;
  quest_type: string;
  npc_name: string | null;
  npc_faction: string | null;
  objectives: unknown[];
  rewards: Record<string, unknown>;
  flavor: Record<string, unknown>;
  sector_x: number | null;
  sector_y: number | null;
  target_players: string[];
  max_acceptances: number;
  expires_days: number;
  status: string;
  created_at: string;
}): AdminQuest {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    scope: row.scope,
    questType: row.quest_type,
    npcName: row.npc_name,
    npcFaction: row.npc_faction,
    objectives: row.objectives,
    rewards: row.rewards,
    flavor: row.flavor,
    sectorX: row.sector_x,
    sectorY: row.sector_y,
    targetPlayers: row.target_players,
    maxAcceptances: row.max_acceptances,
    expiresDays: row.expires_days,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function updateAdminQuestStatus(
  id: string,
  status: string
): Promise<AdminQuest | null> {
  const result = await query<{
    id: string;
    title: string;
    description: string;
    scope: string;
    quest_type: string;
    npc_name: string | null;
    npc_faction: string | null;
    objectives: unknown[];
    rewards: Record<string, unknown>;
    flavor: Record<string, unknown>;
    sector_x: number | null;
    sector_y: number | null;
    target_players: string[];
    max_acceptances: number;
    expires_days: number;
    status: string;
    created_at: string;
  }>(
    `UPDATE admin_quests SET status = $2 WHERE id = $1
     RETURNING *`,
    [id, status]
  );
  if (result.rows.length === 0) return null;
  return mapQuestRow(result.rows[0]);
}

// ── Quest Assignment Queries ────────────────────────────────────────

export interface QuestAssignment {
  id: string;
  questId: string;
  playerId: string;
  status: string;
  acceptedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export async function createQuestAssignment(questId: string, playerId: string): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO admin_quest_assignments (quest_id, player_id)
     VALUES ($1, $2)
     RETURNING id`,
    [questId, playerId]
  );
  return result.rows[0].id;
}

export async function getPlayerAdminQuests(playerId: string): Promise<QuestAssignment[]> {
  const result = await query<{
    id: string;
    quest_id: string;
    player_id: string;
    status: string;
    accepted_at: string | null;
    completed_at: string | null;
    created_at: string;
  }>(
    `SELECT id, quest_id, player_id, status, accepted_at, completed_at, created_at
     FROM admin_quest_assignments
     WHERE player_id = $1
     ORDER BY created_at DESC`,
    [playerId]
  );
  return result.rows.map(mapAssignmentRow);
}

export async function updateQuestAssignment(
  assignmentId: string,
  status: string
): Promise<QuestAssignment | null> {
  const extras =
    status === 'accepted'
      ? ', accepted_at = NOW()'
      : status === 'completed' || status === 'failed'
        ? ', completed_at = NOW()'
        : '';
  const result = await query<{
    id: string;
    quest_id: string;
    player_id: string;
    status: string;
    accepted_at: string | null;
    completed_at: string | null;
    created_at: string;
  }>(
    `UPDATE admin_quest_assignments
     SET status = $1${extras}
     WHERE id = $2
     RETURNING id, quest_id, player_id, status, accepted_at, completed_at, created_at`,
    [status, assignmentId]
  );
  if (result.rows.length === 0) return null;
  return mapAssignmentRow(result.rows[0]);
}

function mapAssignmentRow(row: {
  id: string;
  quest_id: string;
  player_id: string;
  status: string;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
}): QuestAssignment {
  return {
    id: row.id,
    questId: row.quest_id,
    playerId: row.player_id,
    status: row.status,
    acceptedAt: row.accepted_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

// ── Admin Message Queries ───────────────────────────────────────────

export interface AdminMessageInput {
  senderName?: string;
  content: string;
  scope?: string;
  targetPlayers?: string[];
  channel?: string;
  allowReply?: boolean;
}

export interface AdminMessage {
  id: string;
  senderName: string;
  content: string;
  scope: string;
  targetPlayers: string[];
  channel: string;
  allowReply: boolean;
  createdAt: string;
}

export async function createAdminMessage(input: AdminMessageInput): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO admin_messages (sender_name, content, scope, target_players, channel, allow_reply)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.senderName ?? 'SYSTEM',
      input.content,
      input.scope ?? 'universal',
      input.targetPlayers ?? [],
      input.channel ?? 'direct',
      input.allowReply ?? false,
    ]
  );
  return result.rows[0].id;
}

export async function getAdminMessages(limit = 50): Promise<AdminMessage[]> {
  const result = await query<{
    id: string;
    sender_name: string;
    content: string;
    scope: string;
    target_players: string[];
    channel: string;
    allow_reply: boolean;
    created_at: string;
  }>(
    `SELECT id, sender_name, content, scope, target_players, channel, allow_reply, created_at
     FROM admin_messages
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    senderName: row.sender_name,
    content: row.content,
    scope: row.scope,
    targetPlayers: row.target_players,
    channel: row.channel,
    allowReply: row.allow_reply,
    createdAt: row.created_at,
  }));
}

// ── Admin Reply Queries ─────────────────────────────────────────────

export interface AdminReply {
  id: string;
  messageId: string;
  playerId: string;
  content: string;
  createdAt: string;
}

export async function createAdminReply(
  messageId: string,
  playerId: string,
  content: string
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO admin_message_replies (message_id, player_id, content)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [messageId, playerId, content]
  );
  return result.rows[0].id;
}

export async function getAdminReplies(messageId: string): Promise<AdminReply[]> {
  const result = await query<{
    id: string;
    message_id: string;
    player_id: string;
    content: string;
    created_at: string;
  }>(
    `SELECT id, message_id, player_id, content, created_at
     FROM admin_message_replies
     WHERE message_id = $1
     ORDER BY created_at ASC`,
    [messageId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    messageId: row.message_id,
    playerId: row.player_id,
    content: row.content,
    createdAt: row.created_at,
  }));
}

// ── Admin Event / Audit Log Queries ─────────────────────────────────

export interface AdminEvent {
  id: number;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export async function logAdminEvent(
  action: string,
  details: Record<string, unknown> = {}
): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO admin_events (action, details)
     VALUES ($1, $2)
     RETURNING id`,
    [action, JSON.stringify(details)]
  );
  return result.rows[0].id;
}

export async function getAdminEvents(limit = 100): Promise<AdminEvent[]> {
  const result = await query<{
    id: number;
    action: string;
    details: Record<string, unknown>;
    created_at: string;
  }>(
    `SELECT id, action, details, created_at
     FROM admin_events
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    details: row.details,
    createdAt: row.created_at,
  }));
}

// ── Server Stats ────────────────────────────────────────────────────

export interface ServerStats {
  playerCount: number;
  structureCount: number;
  discoveredSectorCount: number;
}

export async function getServerStats(): Promise<ServerStats> {
  const [players, structures, sectors] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*) AS count FROM players'),
    query<{ count: string }>('SELECT COUNT(*) AS count FROM structures'),
    query<{ count: string }>('SELECT COUNT(*) AS count FROM discovered_sectors'),
  ]);
  return {
    playerCount: parseInt(players.rows[0].count, 10),
    structureCount: parseInt(structures.rows[0].count, 10),
    discoveredSectorCount: parseInt(sectors.rows[0].count, 10),
  };
}
