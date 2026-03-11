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
    xp: number;
    level: number;
    faction_id: string | null;
  }>(
    `SELECT p.id, p.username, p.xp, p.level, fm.faction_id
     FROM players p
     LEFT JOIN faction_members fm ON fm.player_id = p.id
     ORDER BY p.username ASC`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    positionX: 0,
    positionY: 0,
    xp: row.xp,
    level: row.level,
    factionId: row.faction_id,
  }));
}

export async function getPlayerById(id: string): Promise<AdminPlayer | null> {
  const result = await query<{
    id: string;
    username: string;
    xp: number;
    level: number;
    faction_id: string | null;
  }>(
    `SELECT p.id, p.username, p.xp, p.level, fm.faction_id
     FROM players p
     LEFT JOIN faction_members fm ON fm.player_id = p.id
     WHERE p.id = $1`,
    [id],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    positionX: 0,
    positionY: 0,
    xp: row.xp,
    level: row.level,
    factionId: row.faction_id,
  };
}

export interface AdminPlayerFull extends AdminPlayer {
  credits: number;
  cargo: Record<string, number>;
  ships: Array<{
    id: string;
    hullType: string;
    name: string;
    active: boolean;
    modules: string[];
    fuel: number;
  }>;
}

export async function getPlayerFullProfile(id: string): Promise<AdminPlayerFull | null> {
  const playerResult = await query<{
    id: string;
    username: string;
    xp: number;
    level: number;
    faction_id: string | null;
    credits: number;
  }>(
    `SELECT p.id, p.username, p.xp, p.level, p.credits, fm.faction_id
     FROM players p
     LEFT JOIN faction_members fm ON fm.player_id = p.id
     WHERE p.id = $1`,
    [id],
  );
  if (playerResult.rows.length === 0) return null;
  const p = playerResult.rows[0];

  const cargoResult = await query<{ resource: string; quantity: number }>(
    `SELECT resource, quantity FROM cargo WHERE player_id = $1`,
    [id],
  );
  const cargo: Record<string, number> = {};
  for (const row of cargoResult.rows) cargo[row.resource] = row.quantity;

  const shipsResult = await query<{
    id: string;
    hull_type: string;
    name: string;
    active: boolean;
    modules: string[];
    fuel: number;
  }>(
    `SELECT id, hull_type, name, active, modules, fuel FROM ships WHERE owner_id = $1 ORDER BY created_at ASC`,
    [id],
  );
  const ships = shipsResult.rows.map((s) => ({
    id: s.id,
    hullType: s.hull_type,
    name: s.name,
    active: s.active,
    modules: s.modules ?? [],
    fuel: s.fuel,
  }));

  return {
    id: p.id,
    username: p.username,
    positionX: 0,
    positionY: 0,
    xp: p.xp,
    level: p.level,
    factionId: p.faction_id,
    credits: p.credits,
    cargo,
    ships,
  };
}

export async function adminSetPlayerCredits(id: string, amount: number): Promise<boolean> {
  const result = await query(`UPDATE players SET credits = $2 WHERE id = $1`, [id, amount]);
  return (result.rowCount ?? 0) > 0;
}

export async function adminSetCargoItem(
  id: string,
  resource: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) {
    await query(`DELETE FROM cargo WHERE player_id = $1 AND resource = $2`, [id, resource]);
  } else {
    await query(
      `INSERT INTO cargo (player_id, resource, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, resource)
       DO UPDATE SET quantity = $3`,
      [id, resource, amount],
    );
  }
}

export async function getPlayerByUsername(username: string): Promise<AdminPlayer | null> {
  const result = await query<{
    id: string;
    username: string;
    xp: number;
    level: number;
    faction_id: string | null;
  }>(
    `SELECT p.id, p.username, p.xp, p.level, fm.faction_id
     FROM players p
     LEFT JOIN faction_members fm ON fm.player_id = p.id
     WHERE LOWER(p.username) = LOWER($1)`,
    [username],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    positionX: 0,
    positionY: 0,
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
    ],
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
    [id],
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
  status: string,
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
    [id, status],
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
    [questId, playerId],
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
    [playerId],
  );
  return result.rows.map(mapAssignmentRow);
}

export async function updateQuestAssignment(
  assignmentId: string,
  status: string,
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
    [status, assignmentId],
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
    ],
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
    [limit],
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
  content: string,
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO admin_message_replies (message_id, player_id, content)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [messageId, playerId, content],
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
    [messageId],
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
  details: Record<string, unknown> = {},
): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO admin_events (action, details)
     VALUES ($1, $2)
     RETURNING id`,
    [action, JSON.stringify(details)],
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
    [limit],
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
  tickCount: number;
  humanStationCount: number;
}

export async function getServerStats(tickCount = 0): Promise<ServerStats> {
  const safeCount = async (sql: string): Promise<number> => {
    try {
      const res = await query<{ count: string }>(sql);
      return parseInt(res.rows[0].count, 10);
    } catch {
      return 0;
    }
  };
  const [playerCount, structureCount, discoveredSectorCount, npcStationCount, playerStructureCount] =
    await Promise.all([
      safeCount('SELECT COUNT(*) AS count FROM players'),
      safeCount('SELECT COUNT(*) AS count FROM structures'),
      safeCount('SELECT COUNT(*) AS count FROM player_discoveries'),
      safeCount('SELECT COUNT(*) AS count FROM npc_station_data'),
      safeCount(`SELECT COUNT(*) AS count FROM structures WHERE type IN ('base', 'station')`),
    ]);
  return {
    playerCount,
    structureCount,
    discoveredSectorCount,
    tickCount,
    humanStationCount: npcStationCount + playerStructureCount,
  };
}

// ── Expansion Log ────────────────────────────────────────────────────

export interface ExpansionLogEntry {
  id: number;
  ts: string;
  faction: string;
  qx: number;
  qy: number;
  event: string;
}

export async function getRecentExpansionLog(limit = 50): Promise<ExpansionLogEntry[]> {
  try {
    const result = await query<{
      id: number;
      ts: string;
      faction: string;
      qx: number;
      qy: number;
      event: string;
    }>(
      `SELECT id, ts, faction, qx, qy, event
       FROM expansion_log
       ORDER BY ts DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      ts: row.ts,
      faction: row.faction,
      qx: row.qx,
      qy: row.qy,
      event: row.event,
    }));
  } catch {
    return [];
  }
}

// ── Admin Story Queries ─────────────────────────────────────────────

export interface AdminStoryStep {
  step: number;
  action: string;
  result: string;
  screenshot?: string;
}

export interface AdminStoryFinding {
  type: 'bug' | 'flaw' | 'recommendation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestion: string;
}

export interface AdminStoryInput {
  title: string;
  summary: string;
  scenario?: string;
  steps?: AdminStoryStep[];
  findings?: AdminStoryFinding[];
  screenshotPaths?: string[];
  status?: string;
}

export interface AdminStory {
  id: string;
  title: string;
  summary: string;
  scenario: string;
  steps: AdminStoryStep[];
  findings: AdminStoryFinding[];
  screenshotPaths: string[];
  status: string;
  createdAt: string;
}

export async function createAdminStory(input: AdminStoryInput): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO admin_stories
       (title, summary, scenario, steps, findings, screenshot_paths, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.title,
      input.summary,
      input.scenario ?? '',
      JSON.stringify(input.steps ?? []),
      JSON.stringify(input.findings ?? []),
      input.screenshotPaths ?? [],
      input.status ?? 'draft',
    ],
  );
  return result.rows[0].id;
}

export async function getAdminStories(limit = 50): Promise<AdminStory[]> {
  const result = await query<{
    id: string;
    title: string;
    summary: string;
    scenario: string;
    steps: AdminStoryStep[];
    findings: AdminStoryFinding[];
    screenshot_paths: string[];
    status: string;
    created_at: string;
  }>(
    `SELECT id, title, summary, scenario, steps, findings, screenshot_paths, status, created_at
     FROM admin_stories
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(mapStoryRow);
}

export async function getAdminStoryById(id: string): Promise<AdminStory | null> {
  const result = await query<{
    id: string;
    title: string;
    summary: string;
    scenario: string;
    steps: AdminStoryStep[];
    findings: AdminStoryFinding[];
    screenshot_paths: string[];
    status: string;
    created_at: string;
  }>(
    `SELECT id, title, summary, scenario, steps, findings, screenshot_paths, status, created_at
     FROM admin_stories
     WHERE id = $1`,
    [id],
  );
  if (result.rows.length === 0) return null;
  return mapStoryRow(result.rows[0]);
}

function mapStoryRow(row: {
  id: string;
  title: string;
  summary: string;
  scenario: string;
  steps: AdminStoryStep[];
  findings: AdminStoryFinding[];
  screenshot_paths: string[];
  status: string;
  created_at: string;
}): AdminStory {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    scenario: row.scenario,
    steps: row.steps,
    findings: row.findings,
    screenshotPaths: row.screenshot_paths,
    status: row.status,
    createdAt: row.created_at,
  };
}

// ── Faction Homes Query ──────────────────────────────────────────────

export async function getActiveFactionHomes(): Promise<
  Array<{ factionId: string; homeQx: number; homeQy: number }>
> {
  const { rows } = await query<{ faction_id: string; home_qx: number; home_qy: number }>(
    `SELECT faction_id, home_qx, home_qy FROM faction_config WHERE active = true ORDER BY faction_id`,
  );
  return rows.map((r) => ({
    factionId: r.faction_id,
    homeQx: r.home_qx,
    homeQy: r.home_qy,
  }));
}

// ── Admin Quadrant Map Query ─────────────────────────────────────────

export interface AdminQuadrantMapEntry {
  qx: number;
  qy: number;
  faction: string | null;
  name: string | null;
  friction: number;
  border_state: string | null;
  fleet_count: number;
}

export async function getAdminQuadrantMap(): Promise<AdminQuadrantMapEntry[]> {
  const { rows } = await query<{
    qx: number;
    qy: number;
    faction: string | null;
    name: string | null;
    friction: string;
    border_state: string | null;
    fleet_count: number;
  }>(`
    WITH known AS (
      SELECT qx, qy FROM quadrants
      UNION
      SELECT qx, qy FROM quadrant_control
    )
    SELECT
      k.qx, k.qy,
      qc.controlling_faction AS faction,
      q.name,
      COALESCE(qc.friction_score, 0) AS friction,
      NULL::text AS border_state,
      COUNT(nf.id)::int AS fleet_count
    FROM known k
    LEFT JOIN quadrant_control qc ON qc.qx = k.qx AND qc.qy = k.qy
    LEFT JOIN quadrants q ON q.qx = k.qx AND q.qy = k.qy
    LEFT JOIN npc_fleet nf ON nf.to_qx = k.qx AND nf.to_qy = k.qy
    GROUP BY k.qx, k.qy, qc.controlling_faction, q.name, qc.friction_score
    ORDER BY k.qx, k.qy
  `);
  return rows.map((r) => ({
    qx: r.qx,
    qy: r.qy,
    faction: r.faction,
    name: r.name,
    friction: typeof r.friction === 'string' ? parseFloat(r.friction) : r.friction,
    border_state: r.border_state,
    fleet_count: r.fleet_count,
  }));
}

// ── Error Log Queries ────────────────────────────────────────────────

export interface ErrorLog {
  id: number;
  fingerprint: string;
  message: string;
  location: string | null;
  stack: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
  status: 'new' | 'ignored' | 'resolved';
  github_issue_url: string | null;
}

export async function upsertErrorLog(
  fingerprint: string,
  message: string,
  location: string | null,
  stack: string | null,
): Promise<void> {
  await query(
    `INSERT INTO error_logs (fingerprint, message, location, stack)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (fingerprint)
     DO UPDATE SET count = error_logs.count + 1, last_seen = NOW()`,
    [fingerprint, message, location, stack],
  );
}

export async function getErrorLogs(status?: string): Promise<ErrorLog[]> {
  const filterByStatus = status && status !== 'all';
  const res = await query<ErrorLog>(
    filterByStatus
      ? `SELECT * FROM error_logs WHERE status = $1 ORDER BY last_seen DESC LIMIT 200`
      : `SELECT * FROM error_logs ORDER BY last_seen DESC LIMIT 200`,
    filterByStatus ? [status] : [],
  );
  return res.rows;
}

export async function updateErrorLogStatus(
  id: number,
  status: 'new' | 'ignored' | 'resolved',
): Promise<boolean> {
  const res = await query(
    `UPDATE error_logs SET status = $1 WHERE id = $2 RETURNING id`,
    [status, id],
  );
  return res.rows.length > 0;
}

export async function deleteErrorLog(id: number): Promise<boolean> {
  const res = await query(
    `DELETE FROM error_logs WHERE id = $1 RETURNING id`,
    [id],
  );
  return res.rows.length > 0;
}
