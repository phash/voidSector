import { query } from './client.js';
import type { AdminQuestScope, AdminQuestType, AdminQuestStatus, AdminMessageScope } from '@void-sector/shared';

// ─── Player Queries ────────────────────────────────────────────────────────────

export interface AdminPlayerRow {
  id: string;
  username: string;
  level: number;
  xp: number;
  credits: number;
  isGuest: boolean;
  createdAt: string;
}

export async function getAllPlayers(): Promise<AdminPlayerRow[]> {
  const result = await query<{
    id: string;
    username: string;
    level: number;
    xp: number;
    credits: number;
    is_guest: boolean;
    created_at: string;
  }>(
    `SELECT id, username, level, xp, credits, is_guest, created_at
     FROM players
     WHERE is_guest = FALSE OR is_guest IS NULL
     ORDER BY created_at DESC`
  );
  return result.rows.map(r => ({
    id: r.id,
    username: r.username,
    level: r.level,
    xp: r.xp,
    credits: r.credits,
    isGuest: r.is_guest,
    createdAt: r.created_at,
  }));
}

export async function getPlayerById(playerId: string): Promise<AdminPlayerRow | null> {
  const result = await query<{
    id: string;
    username: string;
    level: number;
    xp: number;
    credits: number;
    is_guest: boolean;
    created_at: string;
  }>(
    `SELECT id, username, level, xp, credits, is_guest, created_at
     FROM players WHERE id = $1`,
    [playerId]
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return { id: r.id, username: r.username, level: r.level, xp: r.xp, credits: r.credits, isGuest: r.is_guest, createdAt: r.created_at };
}

export async function getPlayerIdByUsername(username: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    'SELECT id FROM players WHERE username = $1',
    [username]
  );
  return result.rows[0]?.id ?? null;
}

// ─── Admin Quest Queries ───────────────────────────────────────────────────────

export interface AdminQuestRow {
  id: string;
  title: string;
  description: string;
  scope: AdminQuestScope;
  questType: AdminQuestType;
  objectives: unknown[];
  rewards: unknown;
  npcName: string;
  npcFactionId: string;
  targetSectorX: number | null;
  targetSectorY: number | null;
  targetPlayerIds: string[] | null;
  maxAcceptances: number | null;
  acceptanceCount: number;
  status: AdminQuestStatus;
  createdAt: string;
  expiresAt: string | null;
  yamlSource: string | null;
  introText: string | null;
  completionText: string | null;
}

export async function createAdminQuest(params: {
  title: string;
  description: string;
  scope: AdminQuestScope;
  questType: AdminQuestType;
  objectives: unknown[];
  rewards: unknown;
  npcName: string;
  npcFactionId: string;
  targetSectorX?: number | null;
  targetSectorY?: number | null;
  targetPlayerIds?: string[] | null;
  maxAcceptances?: number | null;
  expiresAt?: string | null;
  yamlSource?: string | null;
  introText?: string | null;
  completionText?: string | null;
}): Promise<AdminQuestRow> {
  const result = await query<{
    id: string;
    title: string;
    description: string;
    scope: string;
    quest_type: string;
    objectives: unknown[];
    rewards: unknown;
    npc_name: string;
    npc_faction_id: string;
    target_sector_x: number | null;
    target_sector_y: number | null;
    target_player_ids: string[] | null;
    max_acceptances: number | null;
    acceptance_count: number;
    status: string;
    created_at: string;
    expires_at: string | null;
    yaml_source: string | null;
    intro_text: string | null;
    completion_text: string | null;
  }>(
    `INSERT INTO admin_quests
      (title, description, scope, quest_type, objectives, rewards, npc_name, npc_faction_id,
       target_sector_x, target_sector_y, target_player_ids, max_acceptances, expires_at,
       yaml_source, intro_text, completion_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      params.title,
      params.description,
      params.scope,
      params.questType,
      JSON.stringify(params.objectives),
      JSON.stringify(params.rewards),
      params.npcName,
      params.npcFactionId,
      params.targetSectorX ?? null,
      params.targetSectorY ?? null,
      params.targetPlayerIds ?? null,
      params.maxAcceptances ?? null,
      params.expiresAt ?? null,
      params.yamlSource ?? null,
      params.introText ?? null,
      params.completionText ?? null,
    ]
  );
  return rowToAdminQuest(result.rows[0]);
}

export async function getAdminQuests(statusFilter?: AdminQuestStatus): Promise<AdminQuestRow[]> {
  const result = statusFilter
    ? await query<any>(
        `SELECT * FROM admin_quests WHERE status = $1 ORDER BY created_at DESC`,
        [statusFilter]
      )
    : await query<any>(
        `SELECT * FROM admin_quests WHERE status != 'deleted' ORDER BY created_at DESC`
      );
  return result.rows.map(rowToAdminQuest);
}

export async function getAdminQuestById(id: string): Promise<AdminQuestRow | null> {
  const result = await query<any>(`SELECT * FROM admin_quests WHERE id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return rowToAdminQuest(result.rows[0]);
}

export async function getAdminQuestsForSector(x: number, y: number): Promise<AdminQuestRow[]> {
  const result = await query<any>(
    `SELECT * FROM admin_quests
     WHERE scope = 'sector' AND target_sector_x = $1 AND target_sector_y = $2
       AND status = 'active'`,
    [x, y]
  );
  return result.rows.map(rowToAdminQuest);
}

export async function updateAdminQuestStatus(id: string, status: AdminQuestStatus): Promise<void> {
  await query(`UPDATE admin_quests SET status = $1 WHERE id = $2`, [status, id]);
}

export async function incrementAdminQuestAcceptance(id: string): Promise<void> {
  await query(
    `UPDATE admin_quests SET acceptance_count = acceptance_count + 1 WHERE id = $1`,
    [id]
  );
}

function rowToAdminQuest(r: any): AdminQuestRow {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    scope: r.scope,
    questType: r.quest_type,
    objectives: r.objectives,
    rewards: r.rewards,
    npcName: r.npc_name,
    npcFactionId: r.npc_faction_id,
    targetSectorX: r.target_sector_x,
    targetSectorY: r.target_sector_y,
    targetPlayerIds: r.target_player_ids,
    maxAcceptances: r.max_acceptances,
    acceptanceCount: r.acceptance_count,
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    yamlSource: r.yaml_source,
    introText: r.intro_text,
    completionText: r.completion_text,
  };
}

// ─── Assignment Queries ────────────────────────────────────────────────────────

export async function createAdminQuestAssignment(
  adminQuestId: string,
  playerId: string,
  objectives: unknown[]
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO admin_quest_assignments (admin_quest_id, player_id, objectives)
     VALUES ($1, $2, $3)
     ON CONFLICT (admin_quest_id, player_id) DO NOTHING
     RETURNING id`,
    [adminQuestId, playerId, JSON.stringify(objectives)]
  );
  return result.rows[0]?.id ?? '';
}

export async function getPlayerAdminAssignments(playerId: string): Promise<any[]> {
  const result = await query<any>(
    `SELECT aqa.*, aq.title, aq.description, aq.rewards, aq.npc_name, aq.npc_faction_id,
            aq.intro_text, aq.completion_text, aq.scope
     FROM admin_quest_assignments aqa
     JOIN admin_quests aq ON aq.id = aqa.admin_quest_id
     WHERE aqa.player_id = $1 AND aqa.status IN ('pending','accepted')`,
    [playerId]
  );
  return result.rows;
}

export async function acceptAdminQuestAssignment(
  adminQuestId: string,
  playerId: string
): Promise<void> {
  await query(
    `UPDATE admin_quest_assignments
     SET status = 'accepted', accepted_at = NOW()
     WHERE admin_quest_id = $1 AND player_id = $2 AND status = 'pending'`,
    [adminQuestId, playerId]
  );
  await incrementAdminQuestAcceptance(adminQuestId);
}

export async function declineAdminQuestAssignment(
  adminQuestId: string,
  playerId: string
): Promise<void> {
  await query(
    `UPDATE admin_quest_assignments
     SET status = 'declined'
     WHERE admin_quest_id = $1 AND player_id = $2 AND status = 'pending'`,
    [adminQuestId, playerId]
  );
}

export async function completeAdminQuestAssignment(
  adminQuestId: string,
  playerId: string
): Promise<void> {
  await query(
    `UPDATE admin_quest_assignments
     SET status = 'completed', completed_at = NOW()
     WHERE admin_quest_id = $1 AND player_id = $2 AND status = 'accepted'`,
    [adminQuestId, playerId]
  );
}

export async function updateAdminQuestAssignmentObjectives(
  adminQuestId: string,
  playerId: string,
  objectives: unknown[]
): Promise<void> {
  await query(
    `UPDATE admin_quest_assignments SET objectives = $1
     WHERE admin_quest_id = $2 AND player_id = $3`,
    [JSON.stringify(objectives), adminQuestId, playerId]
  );
}

// ─── Admin Message Queries ─────────────────────────────────────────────────────

export interface AdminMessageRow {
  id: string;
  adminName: string;
  scope: AdminMessageScope;
  content: string;
  targetSectorX: number | null;
  targetSectorY: number | null;
  targetPlayerIds: string[] | null;
  allowReply: boolean;
  sentAt: string;
}

export async function createAdminMessage(params: {
  adminName: string;
  scope: AdminMessageScope;
  content: string;
  targetSectorX?: number | null;
  targetSectorY?: number | null;
  targetPlayerIds?: string[] | null;
  allowReply: boolean;
}): Promise<AdminMessageRow> {
  const result = await query<any>(
    `INSERT INTO admin_messages
      (admin_name, scope, content, target_sector_x, target_sector_y, target_player_ids, allow_reply)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      params.adminName,
      params.scope,
      params.content,
      params.targetSectorX ?? null,
      params.targetSectorY ?? null,
      params.targetPlayerIds ?? null,
      params.allowReply,
    ]
  );
  return rowToAdminMessage(result.rows[0]);
}

export async function getAdminMessages(limit = 50): Promise<AdminMessageRow[]> {
  const result = await query<any>(
    `SELECT * FROM admin_messages ORDER BY sent_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows.map(rowToAdminMessage);
}

function rowToAdminMessage(r: any): AdminMessageRow {
  return {
    id: r.id,
    adminName: r.admin_name,
    scope: r.scope,
    content: r.content,
    targetSectorX: r.target_sector_x,
    targetSectorY: r.target_sector_y,
    targetPlayerIds: r.target_player_ids,
    allowReply: r.allow_reply,
    sentAt: r.sent_at,
  };
}

export async function createAdminMessageReply(
  adminMessageId: string,
  playerId: string,
  content: string
): Promise<void> {
  await query(
    `INSERT INTO admin_message_replies (admin_message_id, player_id, content)
     VALUES ($1, $2, $3)`,
    [adminMessageId, playerId, content]
  );
}

export async function getAdminMessageReplies(adminMessageId: string): Promise<any[]> {
  const result = await query<any>(
    `SELECT amr.*, p.username
     FROM admin_message_replies amr
     JOIN players p ON p.id = amr.player_id
     WHERE amr.admin_message_id = $1
     ORDER BY amr.sent_at ASC`,
    [adminMessageId]
  );
  return result.rows;
}

export async function getAllReplies(limit = 100): Promise<any[]> {
  const result = await query<any>(
    `SELECT amr.*, p.username, am.content AS original_message, am.admin_name
     FROM admin_message_replies amr
     JOIN players p ON p.id = amr.player_id
     JOIN admin_messages am ON am.id = amr.admin_message_id
     ORDER BY amr.sent_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// ─── Admin Event Queries ───────────────────────────────────────────────────────

export async function logAdminEvent(params: {
  eventType: string;
  label?: string;
  payload?: unknown;
  targetSectorX?: number | null;
  targetSectorY?: number | null;
}): Promise<void> {
  await query(
    `INSERT INTO admin_events (event_type, label, payload, target_sector_x, target_sector_y)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      params.eventType,
      params.label ?? null,
      JSON.stringify(params.payload ?? {}),
      params.targetSectorX ?? null,
      params.targetSectorY ?? null,
    ]
  );
}

export async function getAdminEvents(limit = 50): Promise<any[]> {
  const result = await query<any>(
    `SELECT * FROM admin_events ORDER BY triggered_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

// ─── Stats Queries ─────────────────────────────────────────────────────────────

export async function getServerStats(): Promise<{
  totalPlayers: number;
  totalGuests: number;
  totalQuests: number;
  activeAdminQuests: number;
  totalMessages: number;
}> {
  const [players, quests, messages] = await Promise.all([
    query<{ total: string; guests: string }>(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE is_guest = TRUE) as guests
       FROM players`
    ),
    query<{ total: string; active: string }>(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'active') as active
       FROM admin_quests`
    ),
    query<{ total: string }>(`SELECT COUNT(*) as total FROM admin_messages`),
  ]);
  return {
    totalPlayers: Number(players.rows[0].total),
    totalGuests: Number(players.rows[0].guests),
    totalQuests: Number(quests.rows[0].total),
    activeAdminQuests: Number(quests.rows[0].active),
    totalMessages: Number(messages.rows[0].total),
  };
}
