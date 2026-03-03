import { query } from './client.js';
import type { SectorData, PlayerData, CargoState, ResourceType, ShipClass, Bookmark } from '@void-sector/shared';
import { SPAWN_CLUSTER_MAX_PLAYERS, SPAWN_CLUSTER_RADIUS } from '@void-sector/shared';

export async function createPlayer(
  username: string,
  passwordHash: string,
  homeBase: { x: number; y: number } = { x: 0, y: 0 }
): Promise<PlayerData> {
  const result = await query<{
    id: string;
    username: string;
    home_base: { x: number; y: number };
    xp: number;
    level: number;
  }>(
    `INSERT INTO players (username, password_hash, home_base)
     VALUES ($1, $2, $3)
     RETURNING id, username, home_base, xp, level`,
    [username, passwordHash, JSON.stringify(homeBase)]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    homeBase: row.home_base,
    xp: row.xp,
    level: row.level,
  };
}

export async function findPlayerByUsername(
  username: string
): Promise<(PlayerData & { passwordHash: string }) | null> {
  const result = await query<{
    id: string;
    username: string;
    password_hash: string;
    home_base: { x: number; y: number };
    xp: number;
    level: number;
  }>(
    'SELECT id, username, password_hash, home_base, xp, level FROM players WHERE username = $1',
    [username]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    homeBase: row.home_base,
    xp: row.xp,
    level: row.level,
  };
}

export async function getPlayerHomeBase(playerId: string): Promise<{ x: number; y: number }> {
  const { rows } = await query<{ home_base: { x: number; y: number } }>(
    'SELECT home_base FROM players WHERE id = $1',
    [playerId]
  );
  return rows[0]?.home_base ?? { x: 0, y: 0 };
}

export async function getActiveShip(playerId: string): Promise<{
  shipClass: ShipClass;
  fuel: number;
  fuelMax: number;
} | null> {
  const { rows } = await query<{
    ship_class: string;
    fuel: number;
    fuel_max: number;
  }>(
    `SELECT ship_class, fuel, fuel_max FROM ships
     WHERE owner_id = $1 AND active = TRUE LIMIT 1`,
    [playerId]
  );
  if (rows.length === 0) return null;
  return {
    shipClass: rows[0].ship_class as ShipClass,
    fuel: rows[0].fuel,
    fuelMax: rows[0].fuel_max,
  };
}

export async function getSector(
  x: number,
  y: number
): Promise<SectorData | null> {
  const result = await query<{
    x: number;
    y: number;
    type: string;
    seed: number;
    discovered_by: string | null;
    discovered_at: string | null;
    metadata: Record<string, unknown>;
  }>(
    'SELECT x, y, type, seed, discovered_by, discovered_at, metadata FROM sectors WHERE x = $1 AND y = $2',
    [x, y]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const meta = row.metadata || {};
  const resources = (meta.resources as SectorData['resources']) || { ore: 0, gas: 0, crystal: 0 };
  return {
    x: row.x,
    y: row.y,
    type: row.type as SectorData['type'],
    seed: row.seed,
    discoveredBy: row.discovered_by,
    discoveredAt: row.discovered_at,
    metadata: row.metadata,
    resources,
  };
}

export async function saveSector(sector: SectorData): Promise<void> {
  await query(
    `INSERT INTO sectors (x, y, type, seed, discovered_by, discovered_at, metadata)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     ON CONFLICT (x, y) DO NOTHING`,
    [
      sector.x,
      sector.y,
      sector.type,
      sector.seed,
      sector.discoveredBy,
      JSON.stringify({ resources: sector.resources || { ore: 0, gas: 0, crystal: 0 } }),
    ]
  );
}

export async function addDiscovery(
  playerId: string,
  sectorX: number,
  sectorY: number
): Promise<void> {
  await query(
    `INSERT INTO player_discoveries (player_id, sector_x, sector_y)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id, sector_x, sector_y) DO NOTHING`,
    [playerId, sectorX, sectorY]
  );
}

export async function getPlayerDiscoveries(
  playerId: string
): Promise<Array<{ x: number; y: number; discoveredAt: number }>> {
  const result = await query<{ sector_x: number; sector_y: number; discovered_at: string }>(
    'SELECT sector_x, sector_y, discovered_at FROM player_discoveries WHERE player_id = $1',
    [playerId]
  );
  return result.rows.map((row) => ({
    x: row.sector_x,
    y: row.sector_y,
    discoveredAt: new Date(row.discovered_at).getTime(),
  }));
}

export async function isRouteDiscovered(
  playerId: string,
  sectorX: number,
  sectorY: number
): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM player_discoveries WHERE player_id = $1 AND sector_x = $2 AND sector_y = $3 LIMIT 1',
    [playerId, sectorX, sectorY]
  );
  return result.rows.length > 0;
}

export async function getPlayerCargo(playerId: string): Promise<CargoState> {
  const result = await query<{ resource: string; quantity: number }>(
    'SELECT resource, quantity FROM cargo WHERE player_id = $1',
    [playerId]
  );
  const cargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0 };
  for (const row of result.rows) {
    if (row.resource in cargo) {
      cargo[row.resource as ResourceType] = row.quantity;
    }
  }
  const slateRow = result.rows.find(r => r.resource === 'slate');
  if (slateRow) cargo.slates = slateRow.quantity;
  return cargo;
}

export async function addToCargo(
  playerId: string,
  resource: ResourceType,
  amount: number,
): Promise<void> {
  await query(
    `INSERT INTO cargo (player_id, resource, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id, resource)
     DO UPDATE SET quantity = cargo.quantity + $3`,
    [playerId, resource, amount]
  );
}

export async function jettisonCargo(
  playerId: string,
  resource: ResourceType,
): Promise<number> {
  const result = await query<{ quantity: number }>(
    `DELETE FROM cargo WHERE player_id = $1 AND resource = $2 RETURNING quantity`,
    [playerId, resource]
  );
  return result.rows.length > 0 ? result.rows[0].quantity : 0;
}

export async function getCargoTotal(playerId: string): Promise<number> {
  const result = await query<{ total: string }>(
    'SELECT COALESCE(SUM(quantity), 0) as total FROM cargo WHERE player_id = $1',
    [playerId]
  );
  return Number(result.rows[0].total);
}

export async function findNearbyCluster(x: number, y: number): Promise<any | null> {
  const { rows } = await query(
    `SELECT * FROM spawn_clusters
     WHERE player_count < $3
       AND ABS(center_x - $1) <= $4
       AND ABS(center_y - $2) <= $4
     ORDER BY (center_x - $1)^2 + (center_y - $2)^2
     LIMIT 1`,
    [x, y, SPAWN_CLUSTER_MAX_PLAYERS, SPAWN_CLUSTER_RADIUS]
  );
  return rows[0] || null;
}

export async function createCluster(centerX: number, centerY: number): Promise<{ id: string }> {
  const { rows } = await query(
    'INSERT INTO spawn_clusters (center_x, center_y, player_count) VALUES ($1, $2, 1) RETURNING id',
    [centerX, centerY]
  );
  return rows[0];
}

export async function incrementClusterCount(clusterId: string): Promise<void> {
  await query(
    'UPDATE spawn_clusters SET player_count = player_count + 1 WHERE id = $1',
    [clusterId]
  );
}

export async function awardBadge(playerId: string, badgeType: string): Promise<boolean> {
  const { rowCount } = await query(
    'INSERT INTO badges (player_id, badge_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [playerId, badgeType]
  );
  return (rowCount ?? 0) > 0;
}

export async function getPlayerBadges(playerId: string): Promise<Array<{ badge_type: string; awarded_at: string }>> {
  const { rows } = await query(
    'SELECT badge_type, awarded_at FROM badges WHERE player_id = $1',
    [playerId]
  );
  return rows;
}

export async function hasAnyoneBadge(badgeType: string): Promise<boolean> {
  const { rows } = await query(
    'SELECT 1 FROM badges WHERE badge_type = $1 LIMIT 1',
    [badgeType]
  );
  return rows.length > 0;
}

export async function createStructure(
  ownerId: string, type: string, sectorX: number, sectorY: number
): Promise<any> {
  const { rows } = await query(
    `INSERT INTO structures (owner_id, type, sector_x, sector_y)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [ownerId, type, sectorX, sectorY]
  );
  return rows[0];
}

export async function getStructuresInRange(
  centerX: number, centerY: number, range: number
): Promise<any[]> {
  const { rows } = await query(
    `SELECT * FROM structures
     WHERE ABS(sector_x - $1) <= $3 AND ABS(sector_y - $2) <= $3`,
    [centerX, centerY, range]
  );
  return rows;
}

export async function getPlayerBaseStructures(playerId: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT s.* FROM structures s
     JOIN players p ON p.id = $1
     WHERE s.owner_id = $1
       AND s.sector_x = (p.home_base->>'x')::int
       AND s.sector_y = (p.home_base->>'y')::int
     ORDER BY s.created_at ASC`,
    [playerId]
  );
  return rows;
}

export async function deductCargo(
  playerId: string, resource: string, amount: number
): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE cargo SET quantity = quantity - $3
     WHERE player_id = $1 AND resource = $2 AND quantity >= $3`,
    [playerId, resource, amount]
  );
  return (rowCount ?? 0) > 0;
}

export async function saveMessage(
  senderId: string, recipientId: string | null, channel: string, content: string
): Promise<{ id: string; sent_at: string }> {
  const { rows } = await query<{ id: string; sent_at: string }>(
    `INSERT INTO messages (sender_id, recipient_id, channel, content, delivered)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, sent_at`,
    [senderId, recipientId, channel, content, recipientId === null]
  );
  return rows[0];
}

export async function getPendingMessages(playerId: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT m.*, p.username as sender_name
     FROM messages m JOIN players p ON m.sender_id = p.id
     WHERE m.recipient_id = $1 AND m.delivered = FALSE
     ORDER BY m.sent_at ASC`,
    [playerId]
  );
  return rows;
}

export async function markMessagesDelivered(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  await query(
    `UPDATE messages SET delivered = TRUE WHERE id = ANY($1)`,
    [messageIds]
  );
}

export async function getRecentMessages(channel: string, limit: number = 50): Promise<any[]> {
  const { rows } = await query(
    `SELECT m.*, p.username as sender_name
     FROM messages m JOIN players p ON m.sender_id = p.id
     WHERE m.channel = $1 AND m.delivered = TRUE
     ORDER BY m.sent_at DESC LIMIT $2`,
    [channel, limit]
  );
  return rows.reverse();
}

export async function getPlayerCredits(playerId: string): Promise<number> {
  const { rows } = await query<{ credits: number }>(
    'SELECT credits FROM players WHERE id = $1',
    [playerId]
  );
  return rows[0]?.credits ?? 0;
}

export async function addCredits(playerId: string, amount: number): Promise<number> {
  const { rows } = await query<{ credits: number }>(
    'UPDATE players SET credits = credits + $2 WHERE id = $1 RETURNING credits',
    [playerId, amount]
  );
  return rows[0].credits;
}

export async function deductCredits(playerId: string, amount: number): Promise<boolean> {
  const { rowCount } = await query(
    'UPDATE players SET credits = credits - $2 WHERE id = $1 AND credits >= $2',
    [playerId, amount]
  );
  return (rowCount ?? 0) > 0;
}

export async function getStorageInventory(playerId: string): Promise<{ ore: number; gas: number; crystal: number }> {
  const { rows } = await query<{ ore: number; gas: number; crystal: number }>(
    'SELECT ore, gas, crystal FROM storage_inventory WHERE player_id = $1',
    [playerId]
  );
  if (rows.length === 0) return { ore: 0, gas: 0, crystal: 0 };
  return { ore: rows[0].ore, gas: rows[0].gas, crystal: rows[0].crystal };
}

export async function updateStorageResource(
  playerId: string, resource: string, delta: number
): Promise<boolean> {
  const safeCols = ['ore', 'gas', 'crystal'];
  if (!safeCols.includes(resource)) return false;
  const { rowCount } = await query(
    `INSERT INTO storage_inventory (player_id, ${resource})
     VALUES ($1, GREATEST(0, $2))
     ON CONFLICT (player_id) DO UPDATE
     SET ${resource} = GREATEST(0, storage_inventory.${resource} + $2)`,
    [playerId, delta]
  );
  return (rowCount ?? 0) > 0;
}

export async function getStructureTier(structureId: string): Promise<number> {
  const { rows } = await query<{ tier: number }>(
    'SELECT tier FROM structures WHERE id = $1',
    [structureId]
  );
  return rows[0]?.tier ?? 1;
}

export async function upgradeStructureTier(structureId: string): Promise<number> {
  const { rows } = await query<{ tier: number }>(
    'UPDATE structures SET tier = tier + 1 WHERE id = $1 RETURNING tier',
    [structureId]
  );
  return rows[0].tier;
}

export async function getPlayerStructure(
  playerId: string, type: string
): Promise<{ id: string; tier: number; sector_x: number; sector_y: number } | null> {
  const { rows } = await query<{ id: string; tier: number; sector_x: number; sector_y: number }>(
    `SELECT s.id, s.tier, s.sector_x, s.sector_y FROM structures s
     JOIN players p ON p.id = $1
     WHERE s.owner_id = $1 AND s.type = $2
       AND s.sector_x = (p.home_base->>'x')::int
       AND s.sector_y = (p.home_base->>'y')::int`,
    [playerId, type]
  );
  return rows[0] ?? null;
}

export async function playerHasBaseAtSector(
  playerId: string, sectorX: number, sectorY: number
): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM structures
     WHERE owner_id = $1 AND type = 'base'
       AND sector_x = $2 AND sector_y = $3
     LIMIT 1`,
    [playerId, sectorX, sectorY]
  );
  return rows.length > 0;
}

export async function createTradeOrder(
  playerId: string, resource: string, amount: number, pricePerUnit: number, type: 'buy' | 'sell'
): Promise<{ id: string }> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO trade_orders (player_id, resource, amount, price_per_unit, type)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [playerId, resource, amount, pricePerUnit, type]
  );
  return rows[0];
}

export async function getActiveTradeOrders(): Promise<any[]> {
  const { rows } = await query(
    `SELECT t.*, p.username as player_name FROM trade_orders t
     JOIN players p ON t.player_id = p.id
     WHERE t.fulfilled = FALSE ORDER BY t.created_at DESC`
  );
  return rows;
}

export async function getPlayerTradeOrders(playerId: string): Promise<any[]> {
  const { rows } = await query(
    'SELECT * FROM trade_orders WHERE player_id = $1 AND fulfilled = FALSE ORDER BY created_at DESC',
    [playerId]
  );
  return rows;
}

export async function fulfillTradeOrder(orderId: string): Promise<boolean> {
  const { rowCount } = await query(
    'UPDATE trade_orders SET fulfilled = TRUE WHERE id = $1 AND fulfilled = FALSE',
    [orderId]
  );
  return (rowCount ?? 0) > 0;
}

export async function cancelTradeOrder(orderId: string, playerId: string): Promise<boolean> {
  const { rowCount } = await query(
    'DELETE FROM trade_orders WHERE id = $1 AND player_id = $2 AND fulfilled = FALSE',
    [orderId, playerId]
  );
  return (rowCount ?? 0) > 0;
}

// --- Data Slates ---

export async function createDataSlate(
  creatorId: string,
  slateType: string,
  sectorData: any[],
): Promise<{ id: string }> {
  const result = await query<{ id: string }>(
    `INSERT INTO data_slates (creator_id, owner_id, slate_type, sector_data)
     VALUES ($1, $1, $2, $3::jsonb)
     RETURNING id`,
    [creatorId, slateType, JSON.stringify(sectorData)]
  );
  return result.rows[0];
}

export async function getPlayerSlates(playerId: string): Promise<any[]> {
  const result = await query(
    `SELECT ds.id, ds.creator_id, ds.owner_id, ds.slate_type, ds.sector_data, ds.status, ds.created_at,
            p.username as creator_name
     FROM data_slates ds
     JOIN players p ON p.id = ds.creator_id
     WHERE ds.owner_id = $1 AND ds.status = 'available'
     ORDER BY ds.created_at DESC`,
    [playerId]
  );
  return result.rows;
}

export async function getSlateById(slateId: string): Promise<any | null> {
  const result = await query(
    `SELECT ds.*, p.username as creator_name
     FROM data_slates ds
     JOIN players p ON p.id = ds.creator_id
     WHERE ds.id = $1`,
    [slateId]
  );
  return result.rows[0] || null;
}

export async function deleteSlate(slateId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM data_slates WHERE id = $1',
    [slateId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateSlateStatus(slateId: string, status: string): Promise<boolean> {
  const result = await query(
    'UPDATE data_slates SET status = $2 WHERE id = $1',
    [slateId, status]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateSlateOwner(slateId: string, newOwnerId: string): Promise<boolean> {
  const result = await query(
    "UPDATE data_slates SET owner_id = $2, status = 'available' WHERE id = $1",
    [slateId, newOwnerId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function addSlateToCargo(playerId: string, amount: number = 1): Promise<void> {
  await query(
    `INSERT INTO cargo (player_id, resource, quantity)
     VALUES ($1, 'slate', $2)
     ON CONFLICT (player_id, resource)
     DO UPDATE SET quantity = cargo.quantity + $2`,
    [playerId, amount]
  );
}

export async function removeSlateFromCargo(playerId: string, amount: number = 1): Promise<boolean> {
  const result = await query<{ quantity: number }>(
    `UPDATE cargo SET quantity = quantity - $2
     WHERE player_id = $1 AND resource = 'slate' AND quantity >= $2
     RETURNING quantity`,
    [playerId, amount]
  );
  return result.rows.length > 0;
}

export async function createSlateTradeOrder(
  playerId: string,
  slateId: string,
  price: number,
): Promise<{ id: string }> {
  const result = await query<{ id: string }>(
    `INSERT INTO trade_orders (player_id, resource, amount, price_per_unit, type, slate_id)
     VALUES ($1, 'slate', 1, $2, 'sell', $3)
     RETURNING id`,
    [playerId, price, slateId]
  );
  return result.rows[0];
}

export async function getSlateTradeOrders(): Promise<any[]> {
  const result = await query(
    `SELECT t.id, t.player_id, p.username as player_name, t.price_per_unit,
            t.slate_id, t.created_at,
            ds.slate_type, ds.sector_data, ds.creator_id
     FROM trade_orders t
     JOIN players p ON p.id = t.player_id
     JOIN data_slates ds ON ds.id = t.slate_id
     WHERE t.fulfilled = FALSE AND t.resource = 'slate'
     ORDER BY t.created_at DESC`,
    []
  );
  return result.rows;
}

export async function getTradeOrderById(orderId: string): Promise<any | null> {
  const result = await query(
    'SELECT * FROM trade_orders WHERE id = $1',
    [orderId]
  );
  return result.rows[0] || null;
}

// --- Factions ---

export async function createFaction(
  leaderId: string,
  name: string,
  tag: string,
  joinMode: string,
): Promise<{ id: string; invite_code: string | null }> {
  const inviteCode = joinMode === 'code'
    ? Math.random().toString(36).substring(2, 10).toUpperCase()
    : null;

  const result = await query<{ id: string; invite_code: string | null }>(
    `INSERT INTO factions (name, tag, leader_id, join_mode, invite_code)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, invite_code`,
    [name, tag, leaderId, joinMode, inviteCode]
  );
  const faction = result.rows[0];

  await query(
    `INSERT INTO faction_members (faction_id, player_id, rank)
     VALUES ($1, $2, 'leader')`,
    [faction.id, leaderId]
  );

  return faction;
}

export async function getFactionById(factionId: string): Promise<any | null> {
  const result = await query(
    `SELECT f.*, p.username as leader_name,
            (SELECT COUNT(*) FROM faction_members WHERE faction_id = f.id) as member_count
     FROM factions f
     JOIN players p ON p.id = f.leader_id
     WHERE f.id = $1`,
    [factionId]
  );
  return result.rows[0] || null;
}

export async function getPlayerFaction(playerId: string): Promise<any | null> {
  const result = await query(
    `SELECT f.*, p.username as leader_name, fm.rank as player_rank,
            (SELECT COUNT(*) FROM faction_members WHERE faction_id = f.id) as member_count
     FROM faction_members fm
     JOIN factions f ON f.id = fm.faction_id
     JOIN players p ON p.id = f.leader_id
     WHERE fm.player_id = $1`,
    [playerId]
  );
  return result.rows[0] || null;
}

export async function getFactionMembers(factionId: string): Promise<any[]> {
  const result = await query(
    `SELECT fm.player_id, p.username as player_name, fm.rank, fm.joined_at
     FROM faction_members fm
     JOIN players p ON p.id = fm.player_id
     WHERE fm.faction_id = $1
     ORDER BY
       CASE fm.rank WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,
       fm.joined_at`,
    [factionId]
  );
  return result.rows;
}

export async function addFactionMember(
  factionId: string,
  playerId: string,
  rank: string = 'member',
): Promise<void> {
  await query(
    `INSERT INTO faction_members (faction_id, player_id, rank)
     VALUES ($1, $2, $3)
     ON CONFLICT (faction_id, player_id) DO NOTHING`,
    [factionId, playerId, rank]
  );
}

export async function removeFactionMember(factionId: string, playerId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM faction_members WHERE faction_id = $1 AND player_id = $2',
    [factionId, playerId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateMemberRank(
  factionId: string,
  playerId: string,
  newRank: string,
): Promise<boolean> {
  const result = await query(
    'UPDATE faction_members SET rank = $3 WHERE faction_id = $1 AND player_id = $2',
    [factionId, playerId, newRank]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateFactionJoinMode(
  factionId: string,
  joinMode: string,
): Promise<{ invite_code: string | null }> {
  const inviteCode = joinMode === 'code'
    ? Math.random().toString(36).substring(2, 10).toUpperCase()
    : null;
  await query(
    'UPDATE factions SET join_mode = $2, invite_code = $3 WHERE id = $1',
    [factionId, joinMode, inviteCode]
  );
  return { invite_code: inviteCode };
}

export async function getFactionByCode(code: string): Promise<any | null> {
  const result = await query(
    `SELECT f.*, p.username as leader_name
     FROM factions f
     JOIN players p ON p.id = f.leader_id
     WHERE f.invite_code = $1`,
    [code]
  );
  return result.rows[0] || null;
}

export async function disbandFaction(factionId: string): Promise<void> {
  await query('DELETE FROM factions WHERE id = $1', [factionId]);
}

export async function createFactionInvite(
  factionId: string,
  inviterId: string,
  inviteeId: string,
): Promise<{ id: string }> {
  const result = await query<{ id: string }>(
    `INSERT INTO faction_invites (faction_id, inviter_id, invitee_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [factionId, inviterId, inviteeId]
  );
  return result.rows[0];
}

export async function getPlayerFactionInvites(playerId: string): Promise<any[]> {
  const result = await query(
    `SELECT fi.id, fi.faction_id, f.name as faction_name, f.tag as faction_tag,
            p.username as inviter_name, fi.status, fi.created_at
     FROM faction_invites fi
     JOIN factions f ON f.id = fi.faction_id
     JOIN players p ON p.id = fi.inviter_id
     WHERE fi.invitee_id = $1 AND fi.status = 'pending'
     ORDER BY fi.created_at DESC`,
    [playerId]
  );
  return result.rows;
}

export async function respondToInvite(
  inviteId: string,
  playerId: string,
  accept: boolean,
): Promise<any | null> {
  const status = accept ? 'accepted' : 'rejected';
  const result = await query(
    `UPDATE faction_invites SET status = $3
     WHERE id = $1 AND invitee_id = $2 AND status = 'pending'
     RETURNING faction_id`,
    [inviteId, playerId, status]
  );
  return result.rows[0] || null;
}

export async function getPlayerIdByUsername(username: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    'SELECT id FROM players WHERE username = $1',
    [username]
  );
  return result.rows[0]?.id || null;
}

export async function getFactionMembersByPlayerIds(factionId: string): Promise<string[]> {
  const result = await query<{ player_id: string }>(
    'SELECT player_id FROM faction_members WHERE faction_id = $1',
    [factionId]
  );
  return result.rows.map(r => r.player_id);
}

// --- Phase 4: Reputation ---

export async function getPlayerReputations(playerId: string): Promise<{ faction_id: string; reputation: number }[]> {
  const { rows } = await query<{ faction_id: string; reputation: number }>(
    `SELECT faction_id, reputation FROM player_reputation WHERE player_id = $1`,
    [playerId]
  );
  return rows;
}

export async function getPlayerReputation(playerId: string, factionId: string): Promise<number> {
  const { rows } = await query<{ reputation: number }>(
    `SELECT reputation FROM player_reputation WHERE player_id = $1 AND faction_id = $2`,
    [playerId, factionId]
  );
  return rows[0]?.reputation ?? 0;
}

export async function setPlayerReputation(playerId: string, factionId: string, delta: number): Promise<number> {
  const { rows } = await query<{ reputation: number }>(
    `INSERT INTO player_reputation (player_id, faction_id, reputation, updated_at)
     VALUES ($1, $2, GREATEST(-100, LEAST(100, $3)), NOW())
     ON CONFLICT (player_id, faction_id)
     DO UPDATE SET reputation = GREATEST(-100, LEAST(100, player_reputation.reputation + $3)),
                   updated_at = NOW()
     RETURNING reputation`,
    [playerId, factionId, delta]
  );
  return rows[0].reputation;
}

// --- Phase 4: Upgrades ---

export async function getPlayerUpgrades(playerId: string): Promise<{ upgrade_id: string; active: boolean; unlocked_at: string }[]> {
  const { rows } = await query<{ upgrade_id: string; active: boolean; unlocked_at: string }>(
    `SELECT upgrade_id, active, unlocked_at FROM player_upgrades WHERE player_id = $1`,
    [playerId]
  );
  return rows;
}

export async function upsertPlayerUpgrade(playerId: string, upgradeId: string, active: boolean): Promise<void> {
  await query(
    `INSERT INTO player_upgrades (player_id, upgrade_id, active, unlocked_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (player_id, upgrade_id)
     DO UPDATE SET active = $3`,
    [playerId, upgradeId, active]
  );
}

// --- Phase 4: Quests ---

export async function getActiveQuests(playerId: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT id, template_id, station_x, station_y, objectives, rewards, status, accepted_at, expires_at
     FROM player_quests
     WHERE player_id = $1 AND status = 'active'
     ORDER BY accepted_at DESC`,
    [playerId]
  );
  return rows;
}

export async function getActiveQuestCount(playerId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM player_quests WHERE player_id = $1 AND status = 'active'`,
    [playerId]
  );
  return parseInt(rows[0].count, 10);
}

export async function insertQuest(
  playerId: string, templateId: string, stationX: number, stationY: number,
  objectives: any, rewards: any, expiresAt: Date,
): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO player_quests (player_id, template_id, station_x, station_y, objectives, rewards, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [playerId, templateId, stationX, stationY, JSON.stringify(objectives), JSON.stringify(rewards), expiresAt.toISOString()]
  );
  return rows[0].id;
}

export async function updateQuestStatus(questId: string, status: string): Promise<boolean> {
  const result = await query(
    `UPDATE player_quests SET status = $2 WHERE id = $1`,
    [questId, status]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateQuestObjectives(questId: string, objectives: any): Promise<boolean> {
  const result = await query(
    `UPDATE player_quests SET objectives = $2 WHERE id = $1`,
    [questId, JSON.stringify(objectives)]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getQuestById(questId: string, playerId: string): Promise<any | null> {
  const { rows } = await query(
    `SELECT id, template_id, station_x, station_y, objectives, rewards, status, accepted_at, expires_at
     FROM player_quests
     WHERE id = $1 AND player_id = $2`,
    [questId, playerId]
  );
  return rows[0] ?? null;
}

// --- Phase 4: Scan Events ---

export async function insertScanEvent(
  playerId: string, sectorX: number, sectorY: number,
  eventType: string, data: Record<string, unknown>
): Promise<string | null> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO scan_events (player_id, sector_x, sector_y, event_type, data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (player_id, sector_x, sector_y, event_type) DO NOTHING
     RETURNING id`,
    [playerId, sectorX, sectorY, eventType, JSON.stringify(data)]
  );
  return rows[0]?.id ?? null;
}

export async function getPlayerScanEvents(playerId: string, status: string = 'discovered'): Promise<any[]> {
  const { rows } = await query(
    `SELECT id, sector_x, sector_y, event_type, status, data, created_at
     FROM scan_events
     WHERE player_id = $1 AND status = $2
     ORDER BY created_at DESC`,
    [playerId, status]
  );
  return rows;
}

export async function completeScanEvent(eventId: string, playerId: string): Promise<boolean> {
  const result = await query(
    `UPDATE scan_events SET status = 'completed' WHERE id = $1 AND player_id = $2 AND status = 'discovered'`,
    [eventId, playerId]
  );
  return (result.rowCount ?? 0) > 0;
}

// --- Phase 4: Battle Log ---

export async function insertBattleLog(
  playerId: string, pirateLevel: number, sectorX: number, sectorY: number,
  action: string, outcome: string, loot: Record<string, unknown> | null
): Promise<void> {
  await query(
    `INSERT INTO battle_log (player_id, pirate_level, sector_x, sector_y, action, outcome, loot)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [playerId, pirateLevel, sectorX, sectorY, action, outcome, loot ? JSON.stringify(loot) : null]
  );
}

// --- Phase 4: XP / Level ---

export async function addPlayerXp(playerId: string, xp: number): Promise<{ xp: number; level: number }> {
  const { rows } = await query<{ xp: number; level: number }>(
    `UPDATE players SET xp = xp + $2 WHERE id = $1 RETURNING xp, level`,
    [playerId, xp]
  );
  return rows[0];
}

export async function setPlayerLevel(playerId: string, level: number): Promise<void> {
  await query(`UPDATE players SET level = $2 WHERE id = $1`, [playerId, level]);
}

// --- Phase 5: Faction Upgrades ---

export async function getFactionUpgrades(factionId: string): Promise<Array<{ tier: number; choice: string; chosenAt: string }>> {
  const { rows } = await query<{ tier: number; choice: string; chosenAt: string }>(
    `SELECT tier, choice, chosen_at as "chosenAt" FROM faction_upgrades WHERE faction_id = $1 ORDER BY tier`,
    [factionId]
  );
  return rows;
}

export async function setFactionUpgrade(factionId: string, tier: number, choice: string, chosenBy: string): Promise<void> {
  await query(
    `INSERT INTO faction_upgrades (faction_id, tier, choice, chosen_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (faction_id, tier) DO NOTHING`,
    [factionId, tier, choice, chosenBy]
  );
}

// --- Phase 5: JumpGates ---

export async function getJumpGate(sectorX: number, sectorY: number): Promise<any | null> {
  const { rows } = await query(
    `SELECT id, sector_x as "sectorX", sector_y as "sectorY", target_x as "targetX", target_y as "targetY",
     gate_type as "gateType", requires_code as "requiresCode", requires_minigame as "requiresMinigame", access_code as "accessCode"
     FROM jumpgates WHERE sector_x = $1 AND sector_y = $2`,
    [sectorX, sectorY]
  );
  return rows[0] ?? null;
}

export async function insertJumpGate(gate: {
  id: string; sectorX: number; sectorY: number; targetX: number; targetY: number;
  gateType: string; requiresCode: boolean; requiresMinigame: boolean; accessCode: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO jumpgates (id, sector_x, sector_y, target_x, target_y, gate_type, requires_code, requires_minigame, access_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (sector_x, sector_y) DO NOTHING`,
    [gate.id, gate.sectorX, gate.sectorY, gate.targetX, gate.targetY, gate.gateType, gate.requiresCode, gate.requiresMinigame, gate.accessCode]
  );
}

export async function playerHasGateCode(playerId: string, gateId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM gate_codes WHERE player_id = $1 AND gate_id = $2`,
    [playerId, gateId]
  );
  return rows.length > 0;
}

export async function addGateCode(playerId: string, gateId: string): Promise<void> {
  await query(
    `INSERT INTO gate_codes (player_id, gate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [playerId, gateId]
  );
}

// --- Phase 5: Rescued Survivors ---

export async function getPlayerSurvivors(playerId: string): Promise<Array<{ id: string; originX: number; originY: number; survivorCount: number; sourceType: string }>> {
  const { rows } = await query<{ id: string; originX: number; originY: number; survivorCount: number; sourceType: string }>(
    `SELECT id, origin_x as "originX", origin_y as "originY", survivor_count as "survivorCount", source_type as "sourceType"
     FROM rescued_survivors WHERE player_id = $1`,
    [playerId]
  );
  return rows;
}

export async function insertRescuedSurvivor(id: string, playerId: string, originX: number, originY: number, count: number, sourceType: string): Promise<void> {
  await query(
    `INSERT INTO rescued_survivors (id, player_id, origin_x, origin_y, survivor_count, source_type) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, playerId, originX, originY, count, sourceType]
  );
}

export async function deletePlayerSurvivors(playerId: string): Promise<number> {
  const result = await query(`DELETE FROM rescued_survivors WHERE player_id = $1`, [playerId]);
  return result.rowCount ?? 0;
}

// --- Phase 5: Distress Calls ---

export async function insertDistressCall(id: string, targetX: number, targetY: number, survivorCount: number, expiresAt: Date): Promise<void> {
  await query(
    `INSERT INTO distress_calls (id, target_x, target_y, survivor_count, expires_at) VALUES ($1, $2, $3, $4, $5)`,
    [id, targetX, targetY, survivorCount, expiresAt]
  );
}

export async function insertPlayerDistressCall(playerId: string, distressId: string, direction: string, estimatedDistance: number): Promise<void> {
  await query(
    `INSERT INTO player_distress_calls (player_id, distress_id, direction, estimated_distance) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [playerId, distressId, direction, estimatedDistance]
  );
}

export async function getPlayerDistressCalls(playerId: string): Promise<Array<{
  distressId: string; direction: string; estimatedDistance: number; receivedAt: string;
  targetX: number; targetY: number; expiresAt: string; completed: boolean;
}>> {
  const { rows } = await query<{
    distressId: string; direction: string; estimatedDistance: number; receivedAt: string;
    targetX: number; targetY: number; expiresAt: string; completed: boolean;
  }>(
    `SELECT pdc.distress_id as "distressId", pdc.direction, pdc.estimated_distance as "estimatedDistance",
     pdc.received_at as "receivedAt", pdc.completed,
     dc.target_x as "targetX", dc.target_y as "targetY", dc.expires_at as "expiresAt"
     FROM player_distress_calls pdc
     JOIN distress_calls dc ON dc.id = pdc.distress_id
     WHERE pdc.player_id = $1 AND pdc.completed = FALSE AND dc.expires_at > NOW()`,
    [playerId]
  );
  return rows;
}

export async function completeDistressCall(playerId: string, distressId: string): Promise<void> {
  await query(
    `UPDATE player_distress_calls SET completed = TRUE WHERE player_id = $1 AND distress_id = $2`,
    [playerId, distressId]
  );
}

// --- Phase 5: Trade Routes ---

export async function getPlayerTradeRoutes(playerId: string): Promise<Array<{
  id: string; ownerId: string; tradingPostId: string; targetX: number; targetY: number;
  sellResource: string | null; sellAmount: number; buyResource: string | null; buyAmount: number;
  cycleMinutes: number; active: boolean; lastCycleAt: string | null;
}>> {
  const { rows } = await query<{
    id: string; ownerId: string; tradingPostId: string; targetX: number; targetY: number;
    sellResource: string | null; sellAmount: number; buyResource: string | null; buyAmount: number;
    cycleMinutes: number; active: boolean; lastCycleAt: string | null;
  }>(
    `SELECT id, owner_id as "ownerId", trading_post_id as "tradingPostId",
     target_x as "targetX", target_y as "targetY",
     sell_resource as "sellResource", sell_amount as "sellAmount",
     buy_resource as "buyResource", buy_amount as "buyAmount",
     cycle_minutes as "cycleMinutes", active, last_cycle_at as "lastCycleAt"
     FROM trade_routes WHERE owner_id = $1 ORDER BY created_at`,
    [playerId]
  );
  return rows;
}

export async function insertTradeRoute(route: {
  id: string; ownerId: string; tradingPostId: string;
  targetX: number; targetY: number;
  sellResource: string | null; sellAmount: number;
  buyResource: string | null; buyAmount: number;
  cycleMinutes: number;
}): Promise<void> {
  await query(
    `INSERT INTO trade_routes (id, owner_id, trading_post_id, target_x, target_y,
     sell_resource, sell_amount, buy_resource, buy_amount, cycle_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [route.id, route.ownerId, route.tradingPostId, route.targetX, route.targetY,
     route.sellResource, route.sellAmount, route.buyResource, route.buyAmount, route.cycleMinutes]
  );
}

export async function updateTradeRouteActive(routeId: string, active: boolean): Promise<void> {
  await query(`UPDATE trade_routes SET active = $2 WHERE id = $1`, [routeId, active]);
}

export async function updateTradeRouteLastCycle(routeId: string): Promise<void> {
  await query(`UPDATE trade_routes SET last_cycle_at = NOW() WHERE id = $1`, [routeId]);
}

export async function deleteTradeRoute(routeId: string, ownerId: string): Promise<boolean> {
  const result = await query(`DELETE FROM trade_routes WHERE id = $1 AND owner_id = $2`, [routeId, ownerId]);
  return (result.rowCount ?? 0) > 0;
}

export async function getActiveTradeRoutes(): Promise<Array<{
  id: string; ownerId: string; tradingPostId: string; targetX: number; targetY: number;
  sellResource: string | null; sellAmount: number; buyResource: string | null; buyAmount: number;
  cycleMinutes: number; active: boolean; lastCycleAt: string | null;
}>> {
  const { rows } = await query<{
    id: string; ownerId: string; tradingPostId: string; targetX: number; targetY: number;
    sellResource: string | null; sellAmount: number; buyResource: string | null; buyAmount: number;
    cycleMinutes: number; active: boolean; lastCycleAt: string | null;
  }>(
    `SELECT id, owner_id as "ownerId", trading_post_id as "tradingPostId",
     target_x as "targetX", target_y as "targetY",
     sell_resource as "sellResource", sell_amount as "sellAmount",
     buy_resource as "buyResource", buy_amount as "buyAmount",
     cycle_minutes as "cycleMinutes", active, last_cycle_at as "lastCycleAt"
     FROM trade_routes WHERE active = TRUE`
  );
  return rows;
}

// --- Bookmarks ---

export async function getPlayerBookmarks(playerId: string): Promise<Bookmark[]> {
  const result = await query<{ slot: number; sector_x: number; sector_y: number; label: string }>(
    'SELECT slot, sector_x, sector_y, label FROM player_bookmarks WHERE player_id = $1 ORDER BY slot',
    [playerId]
  );
  return result.rows.map(r => ({ slot: r.slot, sectorX: r.sector_x, sectorY: r.sector_y, label: r.label }));
}

export async function setPlayerBookmark(playerId: string, slot: number, sectorX: number, sectorY: number, label: string): Promise<void> {
  await query(
    `INSERT INTO player_bookmarks (player_id, slot, sector_x, sector_y, label)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (player_id, slot) DO UPDATE SET sector_x = $3, sector_y = $4, label = $5`,
    [playerId, slot, sectorX, sectorY, label]
  );
}

export async function clearPlayerBookmark(playerId: string, slot: number): Promise<void> {
  await query('DELETE FROM player_bookmarks WHERE player_id = $1 AND slot = $2', [playerId, slot]);
}
