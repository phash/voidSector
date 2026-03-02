import { query } from './client.js';
import type { SectorData, PlayerData, CargoState, ResourceType, ShipClass } from '@void-sector/shared';
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
): Promise<Array<{ x: number; y: number }>> {
  const result = await query<{ sector_x: number; sector_y: number }>(
    'SELECT sector_x, sector_y FROM player_discoveries WHERE player_id = $1',
    [playerId]
  );
  return result.rows.map((row) => ({ x: row.sector_x, y: row.sector_y }));
}

export async function getPlayerCargo(playerId: string): Promise<CargoState> {
  const result = await query<{ resource: string; quantity: number }>(
    'SELECT resource, quantity FROM cargo WHERE player_id = $1',
    [playerId]
  );
  const cargo: CargoState = { ore: 0, gas: 0, crystal: 0 };
  for (const row of result.rows) {
    if (row.resource in cargo) {
      cargo[row.resource as ResourceType] = row.quantity;
    }
  }
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
