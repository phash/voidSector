import { query } from './client.js';
import type {
  SectorData,
  PlayerData,
  CargoState,
  ResourceType,
  ShipClass,
  Bookmark,
  HullType,
  ShipModule,
  ShipRecord,
  JumpGateMapEntry,
} from '@void-sector/shared';
import {
  SPAWN_CLUSTER_MAX_PLAYERS,
  SPAWN_CLUSTER_RADIUS,
  RESOURCE_REGEN_PER_MINUTE,
  CRYSTAL_REGEN_PER_MINUTE,
  RESOURCE_REGEN_DELAY_MINUTES,
} from '@void-sector/shared';

export async function createPlayer(
  username: string,
  passwordHash: string,
  homeBase: { x: number; y: number } = { x: 0, y: 0 },
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
    [username, passwordHash, JSON.stringify(homeBase)],
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

export async function createGuestPlayer(
  username: string,
  homeBase: { x: number; y: number } = { x: 0, y: 0 },
): Promise<PlayerData> {
  const result = await query<{
    id: string;
    username: string;
    home_base: { x: number; y: number };
    xp: number;
    level: number;
  }>(
    `INSERT INTO players (username, password_hash, home_base, is_guest, guest_created_at)
     VALUES ($1, '', $2, TRUE, NOW())
     RETURNING id, username, home_base, xp, level`,
    [username, JSON.stringify(homeBase)],
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

export async function deleteExpiredGuestPlayers(): Promise<number> {
  const result = await query(
    `DELETE FROM players WHERE is_guest = TRUE AND guest_created_at < NOW() - INTERVAL '24 hours'`,
  );
  return result.rowCount ?? 0;
}

export async function findPlayerByUsername(
  username: string,
): Promise<(PlayerData & { passwordHash: string }) | null> {
  const result = await query<{
    id: string;
    username: string;
    password_hash: string;
    home_base: { x: number; y: number };
    xp: number;
    level: number;
  }>(
    'SELECT id, username, password_hash, home_base, xp, level FROM players WHERE LOWER(username) = LOWER($1)',
    [username],
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
    [playerId],
  );
  return rows[0]?.home_base ?? { x: 0, y: 0 };
}

export async function getActiveShip(playerId: string): Promise<ShipRecord | null> {
  const { rows } = await query<{
    id: string;
    owner_id: string;
    hull_type: string;
    name: string;
    modules: ShipModule[];
    fuel: number;
    active: boolean;
    created_at: string;
  }>(
    `SELECT id, owner_id, hull_type, name, modules, fuel, active, created_at
     FROM ships WHERE owner_id = $1 AND active = TRUE LIMIT 1`,
    [playerId],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    ownerId: row.owner_id,
    hullType: row.hull_type as HullType,
    name: row.name,
    modules: row.modules,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function getPlayerShips(playerId: string): Promise<ShipRecord[]> {
  const { rows } = await query<any>(
    `SELECT id, owner_id, hull_type, name, modules, fuel, active, created_at
     FROM ships WHERE owner_id = $1 ORDER BY created_at ASC`,
    [playerId],
  );
  return rows.map((row: any) => ({
    id: row.id,
    ownerId: row.owner_id,
    hullType: row.hull_type as HullType,
    name: row.name,
    modules: row.modules,
    active: row.active,
    createdAt: row.created_at,
  }));
}

export async function createShip(
  playerId: string,
  hullType: HullType,
  name: string,
  initialFuel: number,
): Promise<ShipRecord> {
  // Deactivate current active ship
  await query('UPDATE ships SET active = false WHERE owner_id = $1 AND active = true', [playerId]);
  const { rows } = await query<any>(
    `INSERT INTO ships (owner_id, hull_type, name, fuel, active)
     VALUES ($1, $2, $3, $4, true) RETURNING *`,
    [playerId, hullType, name, initialFuel],
  );
  const row = rows[0];
  return {
    id: row.id,
    ownerId: row.owner_id,
    hullType: row.hull_type as HullType,
    name: row.name,
    modules: row.modules,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function switchActiveShip(playerId: string, shipId: string): Promise<boolean> {
  await query('UPDATE ships SET active = false WHERE owner_id = $1 AND active = true', [playerId]);
  const { rowCount } = await query(
    'UPDATE ships SET active = true WHERE id = $1 AND owner_id = $2',
    [shipId, playerId],
  );
  return (rowCount ?? 0) > 0;
}

export async function updateShipModules(shipId: string, modules: ShipModule[]): Promise<void> {
  await query('UPDATE ships SET modules = $1 WHERE id = $2', [JSON.stringify(modules), shipId]);
}

export async function renameShip(shipId: string, playerId: string, name: string): Promise<boolean> {
  const { rowCount } = await query('UPDATE ships SET name = $1 WHERE id = $2 AND owner_id = $3', [
    name.slice(0, 20),
    shipId,
    playerId,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function renameBase(playerId: string, name: string): Promise<void> {
  await query('UPDATE players SET base_name = $1 WHERE id = $2', [name.slice(0, 20), playerId]);
}

export async function getModuleInventory(playerId: string): Promise<string[]> {
  const { rows } = await query<{ module_inventory: string[] }>(
    'SELECT module_inventory FROM players WHERE id = $1',
    [playerId],
  );
  return rows[0]?.module_inventory ?? [];
}

export async function addModuleToInventory(playerId: string, moduleId: string): Promise<void> {
  await query(`UPDATE players SET module_inventory = module_inventory || $1::jsonb WHERE id = $2`, [
    JSON.stringify(moduleId),
    playerId,
  ]);
}

export async function removeModuleFromInventory(
  playerId: string,
  moduleId: string,
): Promise<boolean> {
  // Remove first occurrence of moduleId from the JSONB array
  const { rows } = await query<{ module_inventory: string[] }>(
    'SELECT module_inventory FROM players WHERE id = $1',
    [playerId],
  );
  const inv = rows[0]?.module_inventory ?? [];
  const idx = inv.indexOf(moduleId);
  if (idx === -1) return false;
  inv.splice(idx, 1);
  await query('UPDATE players SET module_inventory = $1 WHERE id = $2', [
    JSON.stringify(inv),
    playerId,
  ]);
  return true;
}

export async function getPlayerBaseName(playerId: string): Promise<string> {
  const { rows } = await query<{ base_name: string }>(
    'SELECT base_name FROM players WHERE id = $1',
    [playerId],
  );
  return rows[0]?.base_name ?? '';
}

export async function getPlayerLevel(playerId: string): Promise<number> {
  const { rows } = await query<{ level: number }>('SELECT level FROM players WHERE id = $1', [
    playerId,
  ]);
  return rows[0]?.level ?? 1;
}

export async function getSector(x: number, y: number): Promise<SectorData | null> {
  const result = await query<{
    x: number;
    y: number;
    type: string;
    seed: number;
    discovered_by: string | null;
    discovered_at: string | null;
    metadata: Record<string, unknown>;
    environment: string;
    contents: string[];
    last_mined: string | null;
    max_ore: number;
    max_gas: number;
    max_crystal: number;
  }>(
    'SELECT x, y, type, seed, discovered_by, discovered_at, metadata, environment, contents, last_mined, max_ore, max_gas, max_crystal FROM sectors WHERE x = $1 AND y = $2',
    [x, y],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const meta = row.metadata || {};
  let resources = (meta.resources as SectorData['resources']) || { ore: 0, gas: 0, crystal: 0 };

  // Apply resource regeneration if sector was mined (with 5-minute delay)
  if (row.last_mined && (row.max_ore > 0 || row.max_gas > 0 || row.max_crystal > 0)) {
    const elapsedMinutes = (Date.now() - Number(row.last_mined)) / 60000;
    const regenMinutes = Math.max(0, elapsedMinutes - RESOURCE_REGEN_DELAY_MINUTES);
    if (regenMinutes > 0) {
      resources = {
        ore: Math.min(
          row.max_ore,
          resources.ore + Math.floor(regenMinutes * RESOURCE_REGEN_PER_MINUTE),
        ),
        gas: Math.min(
          row.max_gas,
          resources.gas + Math.floor(regenMinutes * RESOURCE_REGEN_PER_MINUTE),
        ),
        crystal: Math.min(
          row.max_crystal,
          resources.crystal + Math.floor(regenMinutes * CRYSTAL_REGEN_PER_MINUTE),
        ),
      };
    }
  }

  return {
    x: row.x,
    y: row.y,
    type: row.type as SectorData['type'],
    seed: row.seed,
    discoveredBy: row.discovered_by,
    discoveredAt: row.discovered_at,
    metadata: row.metadata,
    resources,
    environment: (row.environment ?? 'empty') as SectorData['environment'],
    contents: (row.contents ?? []) as SectorData['contents'],
  };
}

export async function saveSector(sector: SectorData): Promise<void> {
  const res = sector.resources || { ore: 0, gas: 0, crystal: 0 };
  await query(
    `INSERT INTO sectors (x, y, type, seed, discovered_by, discovered_at, metadata, environment, contents, max_ore, max_gas, max_crystal)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11)
     ON CONFLICT (x, y) DO NOTHING`,
    [
      sector.x,
      sector.y,
      sector.type,
      sector.seed,
      sector.discoveredBy,
      JSON.stringify({ resources: res }),
      sector.environment ?? 'empty',
      sector.contents ?? [],
      res.ore,
      res.gas,
      res.crystal,
    ],
  );
}

export async function updateSectorResources(
  x: number,
  y: number,
  resources: { ore: number; gas: number; crystal: number },
): Promise<void> {
  await query(
    `UPDATE sectors SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{resources}', $3::jsonb), last_mined = $4
     WHERE x = $1 AND y = $2`,
    [x, y, JSON.stringify(resources), Date.now()],
  );
}

export async function addDiscovery(
  playerId: string,
  sectorX: number,
  sectorY: number,
): Promise<void> {
  await query(
    `INSERT INTO player_discoveries (player_id, sector_x, sector_y)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id, sector_x, sector_y) DO NOTHING`,
    [playerId, sectorX, sectorY],
  );
}

export async function getPlayerDiscoveries(
  playerId: string,
): Promise<Array<{ x: number; y: number; discoveredAt: number; type?: string; seed?: number }>> {
  const result = await query<{
    sector_x: number;
    sector_y: number;
    discovered_at: string;
    type: string | null;
    seed: number | null;
  }>(
    `SELECT pd.sector_x, pd.sector_y, pd.discovered_at, s.type, s.seed
     FROM player_discoveries pd
     LEFT JOIN sectors s ON s.x = pd.sector_x AND s.y = pd.sector_y
     WHERE pd.player_id = $1`,
    [playerId],
  );
  return result.rows.map((row) => ({
    x: row.sector_x,
    y: row.sector_y,
    discoveredAt: new Date(row.discovered_at).getTime(),
    ...(row.type ? { type: row.type } : {}),
    ...(row.seed !== null ? { seed: row.seed } : {}),
  }));
}

export async function isRouteDiscovered(
  playerId: string,
  sectorX: number,
  sectorY: number,
): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM player_discoveries WHERE player_id = $1 AND sector_x = $2 AND sector_y = $3 LIMIT 1',
    [playerId, sectorX, sectorY],
  );
  return result.rows.length > 0;
}

export async function getPlayerCargo(playerId: string): Promise<CargoState> {
  const result = await query<{ resource: string; quantity: number }>(
    'SELECT resource, quantity FROM cargo WHERE player_id = $1',
    [playerId],
  );
  const cargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 };
  for (const row of result.rows) {
    if (row.resource in cargo) {
      cargo[row.resource as ResourceType] = row.quantity;
    }
  }
  const slateRow = result.rows.find((r) => r.resource === 'slate');
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
    [playerId, resource, amount],
  );
}

export async function jettisonCargo(playerId: string, resource: ResourceType): Promise<number> {
  const result = await query<{ quantity: number }>(
    `DELETE FROM cargo WHERE player_id = $1 AND resource = $2 RETURNING quantity`,
    [playerId, resource],
  );
  return result.rows.length > 0 ? result.rows[0].quantity : 0;
}

export async function getCargoTotal(playerId: string): Promise<number> {
  const result = await query<{ total: string }>(
    'SELECT COALESCE(SUM(quantity), 0) as total FROM cargo WHERE player_id = $1',
    [playerId],
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
    [x, y, SPAWN_CLUSTER_MAX_PLAYERS, SPAWN_CLUSTER_RADIUS],
  );
  return rows[0] || null;
}

export async function createCluster(centerX: number, centerY: number): Promise<{ id: string }> {
  const { rows } = await query(
    'INSERT INTO spawn_clusters (center_x, center_y, player_count) VALUES ($1, $2, 1) RETURNING id',
    [centerX, centerY],
  );
  return rows[0] as { id: string };
}

export async function incrementClusterCount(clusterId: string): Promise<void> {
  await query('UPDATE spawn_clusters SET player_count = player_count + 1 WHERE id = $1', [
    clusterId,
  ]);
}

export async function awardBadge(playerId: string, badgeType: string): Promise<boolean> {
  const { rowCount } = await query(
    'INSERT INTO badges (player_id, badge_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [playerId, badgeType],
  );
  return (rowCount ?? 0) > 0;
}

export async function getPlayerBadges(
  playerId: string,
): Promise<Array<{ badge_type: string; awarded_at: string }>> {
  const { rows } = await query('SELECT badge_type, awarded_at FROM badges WHERE player_id = $1', [
    playerId,
  ]);
  return rows as Array<{ badge_type: string; awarded_at: string }>;
}

export async function hasAnyoneBadge(badgeType: string): Promise<boolean> {
  const { rows } = await query('SELECT 1 FROM badges WHERE badge_type = $1 LIMIT 1', [badgeType]);
  return rows.length > 0;
}

export async function createStructure(
  ownerId: string,
  type: string,
  sectorX: number,
  sectorY: number,
): Promise<any> {
  const { rows } = await query(
    `INSERT INTO structures (owner_id, type, sector_x, sector_y)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [ownerId, type, sectorX, sectorY],
  );
  return rows[0];
}

export async function getStructuresInRange(
  centerX: number,
  centerY: number,
  range: number,
): Promise<any[]> {
  const { rows } = await query(
    `SELECT * FROM structures
     WHERE ABS(sector_x - $1) <= $3 AND ABS(sector_y - $2) <= $3`,
    [centerX, centerY, range],
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
    [playerId],
  );
  return rows;
}

export async function deductCargo(
  playerId: string,
  resource: string,
  amount: number,
): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE cargo SET quantity = quantity - $3
     WHERE player_id = $1 AND resource = $2 AND quantity >= $3`,
    [playerId, resource, amount],
  );
  return (rowCount ?? 0) > 0;
}

export async function saveMessage(
  senderId: string,
  recipientId: string | null,
  channel: string,
  content: string,
): Promise<{ id: string; sent_at: string }> {
  const { rows } = await query<{ id: string; sent_at: string }>(
    `INSERT INTO messages (sender_id, recipient_id, channel, content, delivered)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, sent_at`,
    [senderId, recipientId, channel, content, recipientId === null],
  );
  return rows[0];
}

export async function getPendingMessages(playerId: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT m.*, p.username as sender_name
     FROM messages m JOIN players p ON m.sender_id = p.id
     WHERE m.recipient_id = $1 AND m.delivered = FALSE
     ORDER BY m.sent_at ASC`,
    [playerId],
  );
  return rows;
}

export async function markMessagesDelivered(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  await query(`UPDATE messages SET delivered = TRUE WHERE id = ANY($1)`, [messageIds]);
}

export async function getRecentMessages(channel: string, limit: number = 50): Promise<any[]> {
  const { rows } = await query(
    `SELECT m.*, p.username as sender_name
     FROM messages m JOIN players p ON m.sender_id = p.id
     WHERE m.channel = $1 AND m.delivered = TRUE
     ORDER BY m.sent_at DESC LIMIT $2`,
    [channel, limit],
  );
  return rows.reverse();
}

export async function getPlayerCredits(playerId: string): Promise<number> {
  const { rows } = await query<{ credits: number }>('SELECT credits FROM players WHERE id = $1', [
    playerId,
  ]);
  return rows[0]?.credits ?? 0;
}

export async function addCredits(playerId: string, amount: number): Promise<number> {
  const { rows } = await query<{ credits: number }>(
    'UPDATE players SET credits = credits + $2 WHERE id = $1 RETURNING credits',
    [playerId, amount],
  );
  return rows[0].credits;
}

export async function deductCredits(playerId: string, amount: number): Promise<boolean> {
  const { rowCount } = await query(
    'UPDATE players SET credits = credits - $2 WHERE id = $1 AND credits >= $2',
    [playerId, amount],
  );
  return (rowCount ?? 0) > 0;
}

export async function getAlienCredits(playerId: string): Promise<number> {
  const { rows } = await query<{ alien_credits: number }>(
    'SELECT alien_credits FROM players WHERE id = $1',
    [playerId],
  );
  return rows[0]?.alien_credits ?? 0;
}

export async function addAlienCredits(playerId: string, amount: number): Promise<number> {
  const { rows } = await query<{ alien_credits: number }>(
    'UPDATE players SET alien_credits = alien_credits + $2 WHERE id = $1 RETURNING alien_credits',
    [playerId, amount],
  );
  return rows[0]?.alien_credits ?? 0;
}

export async function deductAlienCredits(playerId: string, amount: number): Promise<boolean> {
  const { rows } = await query<{ alien_credits: number }>(
    'UPDATE players SET alien_credits = alien_credits - $2 WHERE id = $1 AND alien_credits >= $2 RETURNING alien_credits',
    [playerId, amount],
  );
  return rows.length > 0;
}

export async function getStorageInventory(
  playerId: string,
): Promise<{ ore: number; gas: number; crystal: number; artefact: number }> {
  const { rows } = await query<{ ore: number; gas: number; crystal: number; artefact: number }>(
    'SELECT ore, gas, crystal, artefact FROM storage_inventory WHERE player_id = $1',
    [playerId],
  );
  if (rows.length === 0) return { ore: 0, gas: 0, crystal: 0, artefact: 0 };
  return {
    ore: rows[0].ore,
    gas: rows[0].gas,
    crystal: rows[0].crystal,
    artefact: rows[0].artefact,
  };
}

export async function updateStorageResource(
  playerId: string,
  resource: string,
  delta: number,
): Promise<boolean> {
  const safeCols = ['ore', 'gas', 'crystal', 'artefact'];
  if (!safeCols.includes(resource)) return false;
  const { rowCount } = await query(
    `INSERT INTO storage_inventory (player_id, ${resource})
     VALUES ($1, GREATEST(0, $2))
     ON CONFLICT (player_id) DO UPDATE
     SET ${resource} = GREATEST(0, storage_inventory.${resource} + $2)`,
    [playerId, delta],
  );
  return (rowCount ?? 0) > 0;
}

export async function getStructureTier(structureId: string): Promise<number> {
  const { rows } = await query<{ tier: number }>('SELECT tier FROM structures WHERE id = $1', [
    structureId,
  ]);
  return rows[0]?.tier ?? 1;
}

export async function upgradeStructureTier(structureId: string): Promise<number> {
  const { rows } = await query<{ tier: number }>(
    'UPDATE structures SET tier = tier + 1 WHERE id = $1 RETURNING tier',
    [structureId],
  );
  return rows[0].tier;
}

export async function getPlayerStructure(
  playerId: string,
  type: string,
): Promise<{ id: string; tier: number; sector_x: number; sector_y: number } | null> {
  const { rows } = await query<{ id: string; tier: number; sector_x: number; sector_y: number }>(
    `SELECT s.id, s.tier, s.sector_x, s.sector_y FROM structures s
     JOIN players p ON p.id = $1
     WHERE s.owner_id = $1 AND s.type = $2
       AND s.sector_x = (p.home_base->>'x')::int
       AND s.sector_y = (p.home_base->>'y')::int`,
    [playerId, type],
  );
  return rows[0] ?? null;
}

export async function playerHasBaseAtSector(
  playerId: string,
  sectorX: number,
  sectorY: number,
): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM structures
     WHERE owner_id = $1 AND type = 'base'
       AND sector_x = $2 AND sector_y = $3
     LIMIT 1`,
    [playerId, sectorX, sectorY],
  );
  return rows.length > 0;
}

export async function createTradeOrder(
  playerId: string,
  resource: string,
  amount: number,
  pricePerUnit: number,
  type: 'buy' | 'sell',
): Promise<{ id: string }> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO trade_orders (player_id, resource, amount, price_per_unit, type)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [playerId, resource, amount, pricePerUnit, type],
  );
  return rows[0];
}

export async function getActiveTradeOrders(): Promise<any[]> {
  const { rows } = await query(
    `SELECT t.*, p.username as player_name FROM trade_orders t
     JOIN players p ON t.player_id = p.id
     WHERE t.fulfilled = FALSE ORDER BY t.created_at DESC`,
  );
  return rows;
}

export async function getPlayerTradeOrders(playerId: string): Promise<any[]> {
  const { rows } = await query(
    'SELECT * FROM trade_orders WHERE player_id = $1 AND fulfilled = FALSE ORDER BY created_at DESC',
    [playerId],
  );
  return rows;
}

export async function fulfillTradeOrder(orderId: string): Promise<boolean> {
  const { rowCount } = await query(
    'UPDATE trade_orders SET fulfilled = TRUE WHERE id = $1 AND fulfilled = FALSE',
    [orderId],
  );
  return (rowCount ?? 0) > 0;
}

export async function cancelTradeOrder(orderId: string, playerId: string): Promise<boolean> {
  const { rowCount } = await query(
    'DELETE FROM trade_orders WHERE id = $1 AND player_id = $2 AND fulfilled = FALSE',
    [orderId, playerId],
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
    [creatorId, slateType, JSON.stringify(sectorData)],
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
    [playerId],
  );
  return result.rows;
}

export async function getSlateById(slateId: string): Promise<any | null> {
  const result = await query(
    `SELECT ds.*, p.username as creator_name
     FROM data_slates ds
     JOIN players p ON p.id = ds.creator_id
     WHERE ds.id = $1`,
    [slateId],
  );
  return result.rows[0] || null;
}

export async function deleteSlate(slateId: string): Promise<boolean> {
  const result = await query('DELETE FROM data_slates WHERE id = $1', [slateId]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateSlateStatus(slateId: string, status: string): Promise<boolean> {
  const result = await query('UPDATE data_slates SET status = $2 WHERE id = $1', [slateId, status]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateSlateOwner(slateId: string, newOwnerId: string): Promise<boolean> {
  const result = await query(
    "UPDATE data_slates SET owner_id = $2, status = 'available' WHERE id = $1",
    [slateId, newOwnerId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function addSlateToCargo(playerId: string, amount: number = 1): Promise<void> {
  await query(
    `INSERT INTO cargo (player_id, resource, quantity)
     VALUES ($1, 'slate', $2)
     ON CONFLICT (player_id, resource)
     DO UPDATE SET quantity = cargo.quantity + $2`,
    [playerId, amount],
  );
}

export async function removeSlateFromCargo(playerId: string, amount: number = 1): Promise<boolean> {
  const result = await query<{ quantity: number }>(
    `UPDATE cargo SET quantity = quantity - $2
     WHERE player_id = $1 AND resource = 'slate' AND quantity >= $2
     RETURNING quantity`,
    [playerId, amount],
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
    [playerId, price, slateId],
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
    [],
  );
  return result.rows;
}

export async function getTradeOrderById(orderId: string): Promise<any | null> {
  const result = await query('SELECT * FROM trade_orders WHERE id = $1', [orderId]);
  return result.rows[0] || null;
}

// --- Factions ---

export async function createFaction(
  leaderId: string,
  name: string,
  tag: string,
  joinMode: string,
): Promise<{ id: string; invite_code: string | null }> {
  const inviteCode =
    joinMode === 'code' ? Math.random().toString(36).substring(2, 10).toUpperCase() : null;

  const result = await query<{ id: string; invite_code: string | null }>(
    `INSERT INTO factions (name, tag, leader_id, join_mode, invite_code)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, invite_code`,
    [name, tag, leaderId, joinMode, inviteCode],
  );
  const faction = result.rows[0];

  await query(
    `INSERT INTO faction_members (faction_id, player_id, rank)
     VALUES ($1, $2, 'leader')`,
    [faction.id, leaderId],
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
    [factionId],
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
    [playerId],
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
    [factionId],
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
    [factionId, playerId, rank],
  );
}

export async function removeFactionMember(factionId: string, playerId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM faction_members WHERE faction_id = $1 AND player_id = $2',
    [factionId, playerId],
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
    [factionId, playerId, newRank],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateFactionJoinMode(
  factionId: string,
  joinMode: string,
): Promise<{ invite_code: string | null }> {
  const inviteCode =
    joinMode === 'code' ? Math.random().toString(36).substring(2, 10).toUpperCase() : null;
  await query('UPDATE factions SET join_mode = $2, invite_code = $3 WHERE id = $1', [
    factionId,
    joinMode,
    inviteCode,
  ]);
  return { invite_code: inviteCode };
}

export async function getFactionByCode(code: string): Promise<any | null> {
  const result = await query(
    `SELECT f.*, p.username as leader_name
     FROM factions f
     JOIN players p ON p.id = f.leader_id
     WHERE f.invite_code = $1`,
    [code],
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
    [factionId, inviterId, inviteeId],
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
    [playerId],
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
    [inviteId, playerId, status],
  );
  return result.rows[0] || null;
}

export async function getPlayerIdByUsername(username: string): Promise<string | null> {
  const result = await query<{ id: string }>('SELECT id FROM players WHERE username = $1', [
    username,
  ]);
  return result.rows[0]?.id || null;
}

export async function getFactionMembersByPlayerIds(factionId: string): Promise<string[]> {
  const result = await query<{ player_id: string }>(
    'SELECT player_id FROM faction_members WHERE faction_id = $1',
    [factionId],
  );
  return result.rows.map((r) => r.player_id);
}

// --- Phase 4: Reputation ---

export async function getPlayerReputations(
  playerId: string,
): Promise<{ faction_id: string; reputation: number }[]> {
  const { rows } = await query<{ faction_id: string; reputation: number }>(
    `SELECT faction_id, reputation FROM player_reputation WHERE player_id = $1`,
    [playerId],
  );
  return rows;
}

export async function getPlayerReputation(playerId: string, factionId: string): Promise<number> {
  const { rows } = await query<{ reputation: number }>(
    `SELECT reputation FROM player_reputation WHERE player_id = $1 AND faction_id = $2`,
    [playerId, factionId],
  );
  return rows[0]?.reputation ?? 0;
}

export async function setPlayerReputation(
  playerId: string,
  factionId: string,
  delta: number,
): Promise<number> {
  const { rows } = await query<{ reputation: number }>(
    `INSERT INTO player_reputation (player_id, faction_id, reputation, updated_at)
     VALUES ($1, $2, GREATEST(-100, LEAST(100, $3)), NOW())
     ON CONFLICT (player_id, faction_id)
     DO UPDATE SET reputation = GREATEST(-100, LEAST(100, player_reputation.reputation + $3)),
                   updated_at = NOW()
     RETURNING reputation`,
    [playerId, factionId, delta],
  );
  return rows[0].reputation;
}

// --- Phase 4: Upgrades ---

export async function getPlayerUpgrades(
  playerId: string,
): Promise<{ upgrade_id: string; active: boolean; unlocked_at: string }[]> {
  const { rows } = await query<{ upgrade_id: string; active: boolean; unlocked_at: string }>(
    `SELECT upgrade_id, active, unlocked_at FROM player_upgrades WHERE player_id = $1`,
    [playerId],
  );
  return rows;
}

export async function upsertPlayerUpgrade(
  playerId: string,
  upgradeId: string,
  active: boolean,
): Promise<void> {
  await query(
    `INSERT INTO player_upgrades (player_id, upgrade_id, active, unlocked_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (player_id, upgrade_id)
     DO UPDATE SET active = $3`,
    [playerId, upgradeId, active],
  );
}

// --- Phase 4: Quests ---

export async function getActiveQuests(playerId: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT id, template_id, title, station_x, station_y, objectives, rewards, status, accepted_at, expires_at
     FROM player_quests
     WHERE player_id = $1 AND status = 'active'
     ORDER BY accepted_at DESC`,
    [playerId],
  );
  return rows;
}

export async function getActiveQuestCount(playerId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM player_quests WHERE player_id = $1 AND status = 'active'`,
    [playerId],
  );
  return parseInt(rows[0].count, 10);
}

export async function insertQuest(
  playerId: string,
  templateId: string,
  title: string,
  stationX: number,
  stationY: number,
  objectives: any,
  rewards: any,
  expiresAt: Date,
): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO player_quests (player_id, template_id, title, station_x, station_y, objectives, rewards, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      playerId,
      templateId,
      title,
      stationX,
      stationY,
      JSON.stringify(objectives),
      JSON.stringify(rewards),
      expiresAt.toISOString(),
    ],
  );
  return rows[0].id;
}

export async function updateQuestStatus(questId: string, status: string): Promise<boolean> {
  const result = await query(`UPDATE player_quests SET status = $2 WHERE id = $1`, [
    questId,
    status,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function updateQuestObjectives(questId: string, objectives: any): Promise<boolean> {
  const result = await query(`UPDATE player_quests SET objectives = $2 WHERE id = $1`, [
    questId,
    JSON.stringify(objectives),
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function getQuestById(questId: string, playerId: string): Promise<any | null> {
  const { rows } = await query(
    `SELECT id, template_id, station_x, station_y, objectives, rewards, status, accepted_at, expires_at
     FROM player_quests
     WHERE id = $1 AND player_id = $2`,
    [questId, playerId],
  );
  return rows[0] ?? null;
}

// --- Phase 4: Scan Events ---

export async function insertScanEvent(
  playerId: string,
  sectorX: number,
  sectorY: number,
  eventType: string,
  data: Record<string, unknown>,
): Promise<string | null> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO scan_events (player_id, sector_x, sector_y, event_type, data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (player_id, sector_x, sector_y, event_type) DO NOTHING
     RETURNING id`,
    [playerId, sectorX, sectorY, eventType, JSON.stringify(data)],
  );
  return rows[0]?.id ?? null;
}

export async function getPlayerScanEvents(
  playerId: string,
  status: string = 'discovered',
): Promise<any[]> {
  const { rows } = await query(
    `SELECT id, sector_x, sector_y, event_type, status, data, created_at
     FROM scan_events
     WHERE player_id = $1 AND status = $2
     ORDER BY created_at DESC`,
    [playerId, status],
  );
  return rows;
}

export async function completeScanEvent(eventId: string, playerId: string): Promise<boolean> {
  const result = await query(
    `UPDATE scan_events SET status = 'completed' WHERE id = $1 AND player_id = $2 AND status = 'discovered'`,
    [eventId, playerId],
  );
  return (result.rowCount ?? 0) > 0;
}

// --- Phase 4: Battle Log ---

export async function insertBattleLog(
  playerId: string,
  pirateLevel: number,
  sectorX: number,
  sectorY: number,
  action: string,
  outcome: string,
  loot: Record<string, unknown> | null,
): Promise<void> {
  await query(
    `INSERT INTO battle_log (player_id, pirate_level, sector_x, sector_y, action, outcome, loot)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [playerId, pirateLevel, sectorX, sectorY, action, outcome, loot ? JSON.stringify(loot) : null],
  );
}

// --- Phase 4: XP / Level ---

export async function addPlayerXp(
  playerId: string,
  xp: number,
): Promise<{ xp: number; level: number }> {
  const { rows } = await query<{ xp: number; level: number }>(
    `UPDATE players SET xp = xp + $2 WHERE id = $1 RETURNING xp, level`,
    [playerId, xp],
  );
  return rows[0];
}

export async function setPlayerLevel(playerId: string, level: number): Promise<void> {
  await query(`UPDATE players SET level = $2 WHERE id = $1`, [playerId, level]);
}

// --- Phase 5: Faction Upgrades ---

export async function getFactionUpgrades(
  factionId: string,
): Promise<Array<{ tier: number; choice: string; chosenAt: string }>> {
  const { rows } = await query<{ tier: number; choice: string; chosenAt: string }>(
    `SELECT tier, choice, chosen_at as "chosenAt" FROM faction_upgrades WHERE faction_id = $1 ORDER BY tier`,
    [factionId],
  );
  return rows;
}

export async function setFactionUpgrade(
  factionId: string,
  tier: number,
  choice: string,
  chosenBy: string,
): Promise<void> {
  await query(
    `INSERT INTO faction_upgrades (faction_id, tier, choice, chosen_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (faction_id, tier) DO NOTHING`,
    [factionId, tier, choice, chosenBy],
  );
}

// --- Phase 5: JumpGates ---

export async function getJumpGate(sectorX: number, sectorY: number): Promise<any | null> {
  const { rows } = await query(
    `SELECT id, sector_x as "sectorX", sector_y as "sectorY", target_x as "targetX", target_y as "targetY",
     gate_type as "gateType", requires_code as "requiresCode", requires_minigame as "requiresMinigame", access_code as "accessCode"
     FROM jumpgates WHERE sector_x = $1 AND sector_y = $2`,
    [sectorX, sectorY],
  );
  return rows[0] ?? null;
}

export async function insertJumpGate(gate: {
  id: string;
  sectorX: number;
  sectorY: number;
  targetX: number;
  targetY: number;
  gateType: string;
  requiresCode: boolean;
  requiresMinigame: boolean;
  accessCode: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO jumpgates (id, sector_x, sector_y, target_x, target_y, gate_type, requires_code, requires_minigame, access_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (sector_x, sector_y) DO NOTHING`,
    [
      gate.id,
      gate.sectorX,
      gate.sectorY,
      gate.targetX,
      gate.targetY,
      gate.gateType,
      gate.requiresCode,
      gate.requiresMinigame,
      gate.accessCode,
    ],
  );
}

export async function playerHasGateCode(playerId: string, gateId: string): Promise<boolean> {
  const { rows } = await query(`SELECT 1 FROM gate_codes WHERE player_id = $1 AND gate_id = $2`, [
    playerId,
    gateId,
  ]);
  return rows.length > 0;
}

export async function addGateCode(playerId: string, gateId: string): Promise<void> {
  await query(
    `INSERT INTO gate_codes (player_id, gate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [playerId, gateId],
  );
}

// --- Player-Known JumpGates ---

export async function getPlayerKnownJumpGates(playerId: string): Promise<JumpGateMapEntry[]> {
  const { rows } = await query<{
    gate_id: string;
    from_x: number;
    from_y: number;
    to_x: number;
    to_y: number;
    gate_type: string;
  }>(
    `SELECT gate_id, from_x, from_y, to_x, to_y, gate_type
     FROM player_known_jumpgates WHERE player_id = $1`,
    [playerId],
  );
  return rows.map((r) => ({
    gateId: r.gate_id,
    fromX: r.from_x,
    fromY: r.from_y,
    toX: r.to_x,
    toY: r.to_y,
    gateType: r.gate_type,
  }));
}

export async function addPlayerKnownJumpGate(
  playerId: string,
  gateId: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  gateType: string,
): Promise<void> {
  await query(
    `INSERT INTO player_known_jumpgates (player_id, gate_id, from_x, from_y, to_x, to_y, gate_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (player_id, gate_id) DO NOTHING`,
    [playerId, gateId, fromX, fromY, toX, toY, gateType],
  );
}

// --- Player JumpGates ---

export async function insertPlayerJumpGate(gate: {
  id: string;
  sectorX: number;
  sectorY: number;
  ownerId: string;
  tollCredits?: number;
}): Promise<void> {
  await query(
    `INSERT INTO jumpgates (id, sector_x, sector_y, target_x, target_y, gate_type, owner_id, toll_credits, built_at)
     VALUES ($1, $2, $3, $2, $3, 'bidirectional', $4, $5, NOW())
     ON CONFLICT (sector_x, sector_y) DO NOTHING`,
    [gate.id, gate.sectorX, gate.sectorY, gate.ownerId, gate.tollCredits ?? 0],
  );
}

export async function getPlayerJumpGate(sectorX: number, sectorY: number): Promise<any | null> {
  const { rows } = await query(
    `SELECT g.id, g.sector_x as "sectorX", g.sector_y as "sectorY",
            g.owner_id as "ownerId", g.level_connection as "levelConnection",
            g.level_distance as "levelDistance", g.toll_credits as "tollCredits",
            p.username as "ownerName"
     FROM jumpgates g
     LEFT JOIN players p ON p.id::text = g.owner_id::text
     WHERE g.sector_x = $1 AND g.sector_y = $2 AND g.owner_id IS NOT NULL`,
    [sectorX, sectorY],
  );
  return rows[0] ?? null;
}

export async function getPlayerJumpGateById(gateId: string): Promise<any | null> {
  const { rows } = await query(
    `SELECT g.id, g.sector_x as "sectorX", g.sector_y as "sectorY",
            g.owner_id as "ownerId", g.level_connection as "levelConnection",
            g.level_distance as "levelDistance", g.toll_credits as "tollCredits",
            p.username as "ownerName"
     FROM jumpgates g
     LEFT JOIN players p ON p.id::text = g.owner_id::text
     WHERE g.id = $1 AND g.owner_id IS NOT NULL`,
    [gateId],
  );
  return rows[0] ?? null;
}

export async function getJumpGateLinks(gateId: string): Promise<Array<{
  gateId: string; sectorX: number; sectorY: number; ownerName?: string;
}>> {
  const { rows } = await query(
    `SELECT g.id as "gateId", g.sector_x as "sectorX", g.sector_y as "sectorY",
            p.username as "ownerName"
     FROM jumpgate_links jl
     JOIN jumpgates g ON g.id = jl.linked_gate_id
     LEFT JOIN players p ON p.id::text = g.owner_id::text
     WHERE jl.gate_id = $1`,
    [gateId],
  );
  return rows;
}

export async function insertJumpGateLink(gateId: string, linkedGateId: string): Promise<void> {
  await query(
    `INSERT INTO jumpgate_links (gate_id, linked_gate_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [gateId, linkedGateId],
  );
  // Bidirectional
  await query(
    `INSERT INTO jumpgate_links (gate_id, linked_gate_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [linkedGateId, gateId],
  );
}

export async function removeJumpGateLink(gateId: string, linkedGateId: string): Promise<void> {
  await query(
    `DELETE FROM jumpgate_links WHERE
     (gate_id = $1 AND linked_gate_id = $2) OR (gate_id = $2 AND linked_gate_id = $1)`,
    [gateId, linkedGateId],
  );
}

export async function countJumpGateLinks(gateId: string): Promise<number> {
  const { rows } = await query(
    `SELECT COUNT(*)::int as count FROM jumpgate_links WHERE gate_id = $1`,
    [gateId],
  );
  return rows[0]?.count ?? 0;
}

export async function upgradeJumpGate(
  gateId: string,
  field: 'level_connection' | 'level_distance',
  newLevel: number,
): Promise<void> {
  await query(`UPDATE jumpgates SET ${field} = $2 WHERE id = $1`, [gateId, newLevel]);
}

export async function updateJumpGateToll(gateId: string, toll: number): Promise<void> {
  await query(`UPDATE jumpgates SET toll_credits = $1 WHERE id = $2`, [toll, gateId]);
}

export async function deleteJumpGate(gateId: string): Promise<void> {
  // Links cascade-delete due to ON DELETE CASCADE
  await query(`DELETE FROM jumpgates WHERE id = $1`, [gateId]);
}

export async function getAllPlayerGateLinks(): Promise<Array<{
  gateId: string; fromX: number; fromY: number; toX: number; toY: number;
}>> {
  const { rows } = await query(
    `SELECT jl.gate_id as "gateId",
            g1.sector_x as "fromX", g1.sector_y as "fromY",
            g2.sector_x as "toX", g2.sector_y as "toY"
     FROM jumpgate_links jl
     JOIN jumpgates g1 ON g1.id = jl.gate_id
     JOIN jumpgates g2 ON g2.id = jl.linked_gate_id
     WHERE g1.owner_id IS NOT NULL`,
    [],
  );
  return rows;
}

export async function getPlayerGateTollConfig(gateId: string): Promise<{ ownerId: string; tollCredits: number } | null> {
  const { rows } = await query(
    `SELECT owner_id as "ownerId", toll_credits as "tollCredits" FROM jumpgates WHERE id = $1`,
    [gateId],
  );
  return rows[0] ?? null;
}

export async function getAllPlayerGates(): Promise<Array<{
  id: string; sectorX: number; sectorY: number; tollCredits: number; ownerId: string;
}>> {
  const { rows } = await query(
    `SELECT id, sector_x as "sectorX", sector_y as "sectorY",
            toll_credits as "tollCredits", owner_id as "ownerId"
     FROM jumpgates
     WHERE owner_id IS NOT NULL`,
    [],
  );
  return rows;
}

export async function getAllJumpGateLinks(): Promise<Array<{
  gateId: string; linkedGateId: string;
}>> {
  const { rows } = await query(
    `SELECT gate_id as "gateId", linked_gate_id as "linkedGateId"
     FROM jumpgate_links`,
    [],
  );
  return rows;
}

// --- Phase 5: Rescued Survivors ---

export async function getPlayerSurvivors(
  playerId: string,
): Promise<
  Array<{ id: string; originX: number; originY: number; survivorCount: number; sourceType: string }>
> {
  const { rows } = await query<{
    id: string;
    originX: number;
    originY: number;
    survivorCount: number;
    sourceType: string;
  }>(
    `SELECT id, origin_x as "originX", origin_y as "originY", survivor_count as "survivorCount", source_type as "sourceType"
     FROM rescued_survivors WHERE player_id = $1`,
    [playerId],
  );
  return rows;
}

export async function insertRescuedSurvivor(
  id: string,
  playerId: string,
  originX: number,
  originY: number,
  count: number,
  sourceType: string,
): Promise<void> {
  await query(
    `INSERT INTO rescued_survivors (id, player_id, origin_x, origin_y, survivor_count, source_type) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, playerId, originX, originY, count, sourceType],
  );
}

export async function deletePlayerSurvivors(playerId: string): Promise<number> {
  const result = await query(`DELETE FROM rescued_survivors WHERE player_id = $1`, [playerId]);
  return result.rowCount ?? 0;
}

// --- Phase 5: Distress Calls ---

export async function insertDistressCall(
  id: string,
  targetX: number,
  targetY: number,
  survivorCount: number,
  expiresAt: Date,
): Promise<void> {
  await query(
    `INSERT INTO distress_calls (id, target_x, target_y, survivor_count, expires_at) VALUES ($1, $2, $3, $4, $5)`,
    [id, targetX, targetY, survivorCount, expiresAt],
  );
}

export async function insertPlayerDistressCall(
  playerId: string,
  distressId: string,
  direction: string,
  estimatedDistance: number,
): Promise<void> {
  await query(
    `INSERT INTO player_distress_calls (player_id, distress_id, direction, estimated_distance) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [playerId, distressId, direction, estimatedDistance],
  );
}

export async function getPlayerDistressCalls(playerId: string): Promise<
  Array<{
    distressId: string;
    direction: string;
    estimatedDistance: number;
    receivedAt: string;
    targetX: number;
    targetY: number;
    expiresAt: string;
    completed: boolean;
  }>
> {
  const { rows } = await query<{
    distressId: string;
    direction: string;
    estimatedDistance: number;
    receivedAt: string;
    targetX: number;
    targetY: number;
    expiresAt: string;
    completed: boolean;
  }>(
    `SELECT pdc.distress_id as "distressId", pdc.direction, pdc.estimated_distance as "estimatedDistance",
     pdc.received_at as "receivedAt", pdc.completed,
     dc.target_x as "targetX", dc.target_y as "targetY", dc.expires_at as "expiresAt"
     FROM player_distress_calls pdc
     JOIN distress_calls dc ON dc.id = pdc.distress_id
     WHERE pdc.player_id = $1 AND pdc.completed = FALSE AND dc.expires_at > NOW()`,
    [playerId],
  );
  return rows;
}

export async function completeDistressCall(playerId: string, distressId: string): Promise<void> {
  await query(
    `UPDATE player_distress_calls SET completed = TRUE WHERE player_id = $1 AND distress_id = $2`,
    [playerId, distressId],
  );
}

// --- Phase 5: Trade Routes ---

export async function getPlayerTradeRoutes(playerId: string): Promise<
  Array<{
    id: string;
    ownerId: string;
    tradingPostId: string;
    targetX: number;
    targetY: number;
    sellResource: string | null;
    sellAmount: number;
    buyResource: string | null;
    buyAmount: number;
    cycleMinutes: number;
    active: boolean;
    lastCycleAt: string | null;
  }>
> {
  const { rows } = await query<{
    id: string;
    ownerId: string;
    tradingPostId: string;
    targetX: number;
    targetY: number;
    sellResource: string | null;
    sellAmount: number;
    buyResource: string | null;
    buyAmount: number;
    cycleMinutes: number;
    active: boolean;
    lastCycleAt: string | null;
  }>(
    `SELECT id, owner_id as "ownerId", trading_post_id as "tradingPostId",
     target_x as "targetX", target_y as "targetY",
     sell_resource as "sellResource", sell_amount as "sellAmount",
     buy_resource as "buyResource", buy_amount as "buyAmount",
     cycle_minutes as "cycleMinutes", active, last_cycle_at as "lastCycleAt"
     FROM trade_routes WHERE owner_id = $1 ORDER BY created_at`,
    [playerId],
  );
  return rows;
}

export async function insertTradeRoute(route: {
  id: string;
  ownerId: string;
  tradingPostId: string;
  targetX: number;
  targetY: number;
  sellResource: string | null;
  sellAmount: number;
  buyResource: string | null;
  buyAmount: number;
  cycleMinutes: number;
}): Promise<void> {
  await query(
    `INSERT INTO trade_routes (id, owner_id, trading_post_id, target_x, target_y,
     sell_resource, sell_amount, buy_resource, buy_amount, cycle_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      route.id,
      route.ownerId,
      route.tradingPostId,
      route.targetX,
      route.targetY,
      route.sellResource,
      route.sellAmount,
      route.buyResource,
      route.buyAmount,
      route.cycleMinutes,
    ],
  );
}

export async function updateTradeRouteActive(routeId: string, active: boolean): Promise<void> {
  await query(`UPDATE trade_routes SET active = $2 WHERE id = $1`, [routeId, active]);
}

export async function updateTradeRouteLastCycle(routeId: string): Promise<void> {
  await query(`UPDATE trade_routes SET last_cycle_at = NOW() WHERE id = $1`, [routeId]);
}

export async function deleteTradeRoute(routeId: string, ownerId: string): Promise<boolean> {
  const result = await query(`DELETE FROM trade_routes WHERE id = $1 AND owner_id = $2`, [
    routeId,
    ownerId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function getActiveTradeRoutes(): Promise<
  Array<{
    id: string;
    ownerId: string;
    tradingPostId: string;
    targetX: number;
    targetY: number;
    sellResource: string | null;
    sellAmount: number;
    buyResource: string | null;
    buyAmount: number;
    cycleMinutes: number;
    active: boolean;
    lastCycleAt: string | null;
  }>
> {
  const { rows } = await query<{
    id: string;
    ownerId: string;
    tradingPostId: string;
    targetX: number;
    targetY: number;
    sellResource: string | null;
    sellAmount: number;
    buyResource: string | null;
    buyAmount: number;
    cycleMinutes: number;
    active: boolean;
    lastCycleAt: string | null;
  }>(
    `SELECT id, owner_id as "ownerId", trading_post_id as "tradingPostId",
     target_x as "targetX", target_y as "targetY",
     sell_resource as "sellResource", sell_amount as "sellAmount",
     buy_resource as "buyResource", buy_amount as "buyAmount",
     cycle_minutes as "cycleMinutes", active, last_cycle_at as "lastCycleAt"
     FROM trade_routes WHERE active = TRUE`,
  );
  return rows;
}

// --- Bookmarks ---

export async function getPlayerBookmarks(playerId: string): Promise<Bookmark[]> {
  const result = await query<{ slot: number; sector_x: number; sector_y: number; label: string }>(
    'SELECT slot, sector_x, sector_y, label FROM player_bookmarks WHERE player_id = $1 ORDER BY slot',
    [playerId],
  );
  return result.rows.map((r) => ({
    slot: r.slot,
    sectorX: r.sector_x,
    sectorY: r.sector_y,
    label: r.label,
  }));
}

export async function setPlayerBookmark(
  playerId: string,
  slot: number,
  sectorX: number,
  sectorY: number,
  label: string,
): Promise<void> {
  await query(
    `INSERT INTO player_bookmarks (player_id, slot, sector_x, sector_y, label)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (player_id, slot) DO UPDATE SET sector_x = $3, sector_y = $4, label = $5`,
    [playerId, slot, sectorX, sectorY, label],
  );
}

export async function clearPlayerBookmark(playerId: string, slot: number): Promise<void> {
  await query('DELETE FROM player_bookmarks WHERE player_id = $1 AND slot = $2', [playerId, slot]);
}

export async function getSectorsInRange(
  cx: number,
  cy: number,
  radius: number,
): Promise<SectorData[]> {
  const result = await query<any>(
    `SELECT x, y, type, seed, discovered_by, discovered_at, metadata, environment, contents, last_mined, max_ore, max_gas, max_crystal
     FROM sectors
     WHERE x BETWEEN $1 AND $2 AND y BETWEEN $3 AND $4`,
    [cx - radius, cx + radius, cy - radius, cy + radius],
  );
  return result.rows.map((r: any) => {
    const meta = r.metadata || {};
    let resources = (meta.resources as SectorData['resources']) || { ore: 0, gas: 0, crystal: 0 };

    // Apply resource regeneration if sector was mined (with 5-minute delay)
    if (r.last_mined && (r.max_ore > 0 || r.max_gas > 0 || r.max_crystal > 0)) {
      const elapsedMinutes = (Date.now() - Number(r.last_mined)) / 60000;
      const regenMinutes = Math.max(0, elapsedMinutes - RESOURCE_REGEN_DELAY_MINUTES);
      if (regenMinutes > 0) {
        resources = {
          ore: Math.min(
            r.max_ore,
            resources.ore + Math.floor(regenMinutes * RESOURCE_REGEN_PER_MINUTE),
          ),
          gas: Math.min(
            r.max_gas,
            resources.gas + Math.floor(regenMinutes * RESOURCE_REGEN_PER_MINUTE),
          ),
          crystal: Math.min(
            r.max_crystal,
            resources.crystal + Math.floor(regenMinutes * CRYSTAL_REGEN_PER_MINUTE),
          ),
        };
      }
    }

    return {
      x: r.x,
      y: r.y,
      type: r.type,
      seed: r.seed,
      discoveredBy: r.discovered_by,
      discoveredAt: r.discovered_at,
      metadata: r.metadata ?? {},
      resources,
      environment: (r.environment ?? 'empty') as SectorData['environment'],
      contents: (r.contents ?? []) as SectorData['contents'],
    };
  });
}

export async function addDiscoveriesBatch(
  playerId: string,
  coords: { x: number; y: number }[],
): Promise<void> {
  if (coords.length === 0) return;
  const xs = coords.map((c) => c.x);
  const ys = coords.map((c) => c.y);
  await query(
    `INSERT INTO player_discoveries (player_id, sector_x, sector_y)
     SELECT $1, unnest($2::int[]), unnest($3::int[])
     ON CONFLICT DO NOTHING`,
    [playerId, xs, ys],
  );
}

// Combat v2: Station defense queries

export async function getStationDefenses(
  userId: string,
  sectorX: number,
  sectorY: number,
): Promise<Array<{ id: number; defenseType: string; installedAt: number }>> {
  const result = await query(
    'SELECT id, defense_type AS "defenseType", installed_at AS "installedAt" FROM station_defenses WHERE user_id = $1 AND sector_x = $2 AND sector_y = $3',
    [userId, sectorX, sectorY],
  );
  return result.rows as Array<{ id: number; defenseType: string; installedAt: number }>;
}

export async function installStationDefense(
  userId: string,
  sectorX: number,
  sectorY: number,
  defenseType: string,
): Promise<{ id: number }> {
  const result = await query(
    `INSERT INTO station_defenses (user_id, sector_x, sector_y, defense_type)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, sectorX, sectorY, defenseType],
  );
  return result.rows[0] as { id: number };
}

export async function removeStationDefense(
  userId: string,
  sectorX: number,
  sectorY: number,
  defenseType: string,
): Promise<boolean> {
  const result = await query(
    'DELETE FROM station_defenses WHERE user_id = $1 AND sector_x = $2 AND sector_y = $3 AND defense_type = $4',
    [userId, sectorX, sectorY, defenseType],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getStructureHp(
  userId: string,
  sectorX: number,
  sectorY: number,
): Promise<{ currentHp: number; maxHp: number } | null> {
  const result = await query(
    `SELECT current_hp AS "currentHp", max_hp AS "maxHp" FROM structures
     WHERE owner_id = $1 AND sector_x = $2 AND sector_y = $3 AND type = 'base'`,
    [userId, sectorX, sectorY],
  );
  return (result.rows[0] as { currentHp: number; maxHp: number } | undefined) ?? null;
}

export async function updateStructureHp(
  userId: string,
  sectorX: number,
  sectorY: number,
  newHp: number,
): Promise<void> {
  await query(
    `UPDATE structures SET current_hp = $4, damaged_at = CASE WHEN $4 < max_hp THEN (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT ELSE damaged_at END
     WHERE owner_id = $1 AND sector_x = $2 AND sector_y = $3 AND type = 'base'`,
    [userId, sectorX, sectorY, newHp],
  );
}

export async function insertStationBattleLog(
  userId: string,
  sectorX: number,
  sectorY: number,
  attackerLevel: number,
  outcome: string,
  hpLost: number,
): Promise<void> {
  await query(
    `INSERT INTO station_battle_log (user_id, sector_x, sector_y, attacker_level, outcome, hp_lost)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, sectorX, sectorY, attackerLevel, outcome, hpLost],
  );
}

export async function insertBattleLogV2(
  playerId: string,
  pirateLevel: number,
  sectorX: number,
  sectorY: number,
  action: string,
  outcome: string,
  loot: Record<string, unknown> | null,
  roundsPlayed: number,
  roundDetails: unknown[],
  playerHpEnd: number,
): Promise<void> {
  await query(
    `INSERT INTO battle_log (player_id, pirate_level, sector_x, sector_y, action, outcome, loot, rounds_played, round_details, player_hp_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      playerId,
      pirateLevel,
      sectorX,
      sectorY,
      action,
      outcome,
      loot ? JSON.stringify(loot) : null,
      roundsPlayed,
      JSON.stringify(roundDetails),
      playerHpEnd,
    ],
  );
}

export async function getPlayerStructuresInSector(
  userId: string,
  sectorX: number,
  sectorY: number,
): Promise<Array<{ id: string; type: string }>> {
  const result = await query(
    'SELECT id, type FROM structures WHERE owner_id = $1 AND sector_x = $2 AND sector_y = $3',
    [userId, sectorX, sectorY],
  );
  return result.rows as Array<{ id: string; type: string }>;
}

// --- Tech-Baum: Research ---

export async function getPlayerResearch(
  userId: string,
): Promise<{ unlockedModules: string[]; blueprints: string[] }> {
  const { rows } = await query(
    'SELECT unlocked_modules, blueprints FROM player_research WHERE user_id = $1',
    [userId],
  );
  if (rows.length === 0) {
    return { unlockedModules: [], blueprints: [] };
  }
  return {
    unlockedModules: rows[0].unlocked_modules ?? [],
    blueprints: rows[0].blueprints ?? [],
  };
}

export async function addUnlockedModule(userId: string, moduleId: string): Promise<void> {
  await query(
    `INSERT INTO player_research (user_id, unlocked_modules)
     VALUES ($1, ARRAY[$2::text])
     ON CONFLICT (user_id) DO UPDATE
     SET unlocked_modules = array_append(player_research.unlocked_modules, $2::text)`,
    [userId, moduleId],
  );
}

export async function addBlueprint(userId: string, moduleId: string): Promise<void> {
  await query(
    `INSERT INTO player_research (user_id, blueprints)
     VALUES ($1, ARRAY[$2::text])
     ON CONFLICT (user_id) DO UPDATE
     SET blueprints = array_append(player_research.blueprints, $2::text)`,
    [userId, moduleId],
  );
}

export async function getActiveResearch(userId: string): Promise<{
  moduleId: string;
  startedAt: number;
  completesAt: number;
} | null> {
  const { rows } = await query(
    'SELECT module_id, started_at, completes_at FROM active_research WHERE user_id = $1',
    [userId],
  );
  if (rows.length === 0) return null;
  return {
    moduleId: rows[0].module_id,
    startedAt: Number(rows[0].started_at),
    completesAt: Number(rows[0].completes_at),
  };
}

export async function startActiveResearch(
  userId: string,
  moduleId: string,
  startedAt: number,
  completesAt: number,
): Promise<void> {
  await query(
    `INSERT INTO active_research (user_id, module_id, started_at, completes_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
     SET module_id = $2, started_at = $3, completes_at = $4`,
    [userId, moduleId, startedAt, completesAt],
  );
}

export async function deleteActiveResearch(userId: string): Promise<void> {
  await query('DELETE FROM active_research WHERE user_id = $1', [userId]);
}

// --- Autopilot Routes ---

export interface AutopilotRouteRow {
  userId: string;
  targetX: number;
  targetY: number;
  useHyperjump: boolean;
  path: Array<{ x: number; y: number }>;
  currentStep: number;
  totalSteps: number;
  startedAt: number;
  lastStepAt: number;
  status: string;
}

export async function saveAutopilotRoute(
  userId: string,
  targetX: number,
  targetY: number,
  useHyperjump: boolean,
  path: Array<{ x: number; y: number }>,
  now: number,
): Promise<void> {
  await query(
    `INSERT INTO autopilot_routes (user_id, target_x, target_y, use_hyperjump, path, current_step, total_steps, started_at, last_step_at, status)
     VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $7, 'active')
     ON CONFLICT (user_id) DO UPDATE
     SET target_x = $2, target_y = $3, use_hyperjump = $4, path = $5,
         current_step = 0, total_steps = $6, started_at = $7, last_step_at = $7, status = 'active'`,
    [userId, targetX, targetY, useHyperjump, JSON.stringify(path), path.length, now],
  );
}

export async function getAutopilotRoute(userId: string): Promise<AutopilotRouteRow | null> {
  const { rows } = await query<{
    user_id: string;
    target_x: number;
    target_y: number;
    use_hyperjump: boolean;
    path: Array<{ x: number; y: number }>;
    current_step: number;
    total_steps: number;
    started_at: string;
    last_step_at: string;
    status: string;
  }>(
    `SELECT user_id, target_x, target_y, use_hyperjump, path, current_step, total_steps, started_at, last_step_at, status
     FROM autopilot_routes WHERE user_id = $1`,
    [userId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    userId: r.user_id,
    targetX: r.target_x,
    targetY: r.target_y,
    useHyperjump: r.use_hyperjump,
    path: r.path,
    currentStep: r.current_step,
    totalSteps: r.total_steps,
    startedAt: Number(r.started_at),
    lastStepAt: Number(r.last_step_at),
    status: r.status,
  };
}

export async function getActiveAutopilotRoute(userId: string): Promise<AutopilotRouteRow | null> {
  const { rows } = await query<{
    user_id: string;
    target_x: number;
    target_y: number;
    use_hyperjump: boolean;
    path: Array<{ x: number; y: number }>;
    current_step: number;
    total_steps: number;
    started_at: string;
    last_step_at: string;
    status: string;
  }>(
    `SELECT user_id, target_x, target_y, use_hyperjump, path, current_step, total_steps, started_at, last_step_at, status
     FROM autopilot_routes WHERE user_id = $1 AND status = 'active'`,
    [userId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    userId: r.user_id,
    targetX: r.target_x,
    targetY: r.target_y,
    useHyperjump: r.use_hyperjump,
    path: r.path,
    currentStep: r.current_step,
    totalSteps: r.total_steps,
    startedAt: Number(r.started_at),
    lastStepAt: Number(r.last_step_at),
    status: r.status,
  };
}

export async function updateAutopilotStep(
  userId: string,
  currentStep: number,
  now: number,
): Promise<void> {
  await query(
    `UPDATE autopilot_routes SET current_step = $2, last_step_at = $3 WHERE user_id = $1 AND status = 'active'`,
    [userId, currentStep, now],
  );
}

export async function pauseAutopilotRoute(userId: string): Promise<boolean> {
  const result = await query(
    `UPDATE autopilot_routes SET status = 'paused' WHERE user_id = $1 AND status = 'active'`,
    [userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function resumeAutopilotRoute(userId: string, now: number): Promise<boolean> {
  const result = await query(
    `UPDATE autopilot_routes SET status = 'active', last_step_at = $2 WHERE user_id = $1 AND status = 'paused'`,
    [userId, now],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function cancelAutopilotRoute(userId: string): Promise<boolean> {
  const result = await query(
    `UPDATE autopilot_routes SET status = 'cancelled' WHERE user_id = $1 AND status IN ('active', 'paused')`,
    [userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function completeAutopilotRoute(userId: string): Promise<void> {
  await query(
    `UPDATE autopilot_routes SET status = 'completed' WHERE user_id = $1 AND status = 'active'`,
    [userId],
  );
}

// --- Per-Station Reputation ---

export async function getPlayerStationRep(
  playerId: string,
  stationX: number,
  stationY: number,
): Promise<number> {
  const { rows } = await query<{ reputation: number }>(
    `SELECT reputation FROM player_station_reputation WHERE player_id = $1 AND station_x = $2 AND station_y = $3`,
    [playerId, stationX, stationY],
  );
  return rows[0]?.reputation ?? 0;
}

export async function updatePlayerStationRep(
  playerId: string,
  stationX: number,
  stationY: number,
  delta: number,
): Promise<number> {
  const { rows } = await query<{ reputation: number }>(
    `INSERT INTO player_station_reputation (player_id, station_x, station_y, reputation)
     VALUES ($1, $2, $3, GREATEST(-100, LEAST(100, $4)))
     ON CONFLICT (player_id, station_x, station_y)
     DO UPDATE SET reputation = GREATEST(-100, LEAST(100, player_station_reputation.reputation + $4))
     RETURNING reputation`,
    [playerId, stationX, stationY, delta],
  );
  return rows[0].reputation;
}

// ── Ancient Ruins ────────────────────────────────────────────────────

export async function hasScannedRuin(
  playerId: string,
  sectorX: number,
  sectorY: number,
): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM ancient_lore_fragments
       WHERE player_id = $1 AND sector_x = $2 AND sector_y = $3
     ) AS exists`,
    [playerId, sectorX, sectorY],
  );
  return rows[0].exists;
}

export async function insertAncientRuinScan(
  playerId: string,
  sectorX: number,
  sectorY: number,
  fragmentIndex: number,
  ruinLevel: number,
  artefactFound: boolean,
): Promise<void> {
  await query(
    `INSERT INTO ancient_lore_fragments
       (player_id, sector_x, sector_y, fragment_index, ruin_level, artefact_found, discovered_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (player_id, sector_x, sector_y) DO NOTHING`,
    [playerId, sectorX, sectorY, fragmentIndex, ruinLevel, artefactFound, Date.now()],
  );
}

export async function getPlayerLoreFragments(
  playerId: string,
): Promise<Array<{ sector_x: number; sector_y: number; fragment_index: number; ruin_level: number; artefact_found: boolean; discovered_at: number }>> {
  const { rows } = await query(
    `SELECT sector_x, sector_y, fragment_index, ruin_level, artefact_found, discovered_at
     FROM ancient_lore_fragments
     WHERE player_id = $1
     ORDER BY discovered_at DESC`,
    [playerId],
  );
  return rows;
}

// ── Alien Reputation (issues #190-#199) ──────────────────────────────────────

/** Get a player's reputation with one alien faction. Returns 0 if no entry. */
export async function getAlienReputation(
  playerId: string,
  factionId: string,
): Promise<number> {
  const { rows } = await query<{ reputation: number }>(
    'SELECT reputation FROM alien_reputation WHERE player_id = $1 AND alien_faction_id = $2',
    [playerId, factionId],
  );
  return rows[0]?.reputation ?? 0;
}

/** Get reputation values for all alien factions for a player. */
export async function getAllAlienReputations(
  playerId: string,
): Promise<Record<string, number>> {
  const { rows } = await query<{ alien_faction_id: string; reputation: number }>(
    'SELECT alien_faction_id, reputation FROM alien_reputation WHERE player_id = $1',
    [playerId],
  );
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.alien_faction_id] = row.reputation;
  }
  return result;
}

/**
 * Add (or subtract) reputation with an alien faction.
 * Clamped to [-100, +100]. Creates row if not exists.
 */
export async function addAlienReputation(
  playerId: string,
  factionId: string,
  delta: number,
): Promise<number> {
  const { rows } = await query<{ reputation: number }>(
    `INSERT INTO alien_reputation (player_id, alien_faction_id, reputation, encounter_count, last_interaction)
     VALUES ($1, $2, GREATEST(-100, LEAST(100, $3)), 1, $4)
     ON CONFLICT (player_id, alien_faction_id)
     DO UPDATE SET
       reputation = GREATEST(-100, LEAST(100, alien_reputation.reputation + $3)),
       encounter_count = alien_reputation.encounter_count + 1,
       last_interaction = $4
     RETURNING reputation`,
    [playerId, factionId, delta, Date.now()],
  );
  return rows[0]?.reputation ?? 0;
}

/** Set first_contact_at timestamp (called on first contact only). */
export async function setAlienFirstContact(
  playerId: string,
  factionId: string,
): Promise<void> {
  await query(
    `INSERT INTO alien_reputation (player_id, alien_faction_id, reputation, encounter_count, first_contact_at, last_interaction)
     VALUES ($1, $2, 0, 1, $3, $3)
     ON CONFLICT (player_id, alien_faction_id)
     DO UPDATE SET
       first_contact_at = COALESCE(alien_reputation.first_contact_at, $3),
       last_interaction = $3`,
    [playerId, factionId, Date.now()],
  );
}

/** Record an alien encounter event. */
export async function recordAlienEncounter(params: {
  playerId: string;
  factionId: string;
  encounterType: string;
  sectorX: number;
  sectorY: number;
  quadrantX: number;
  quadrantY: number;
  encounterData?: Record<string, unknown>;
  repBefore: number;
  repAfter: number;
}): Promise<void> {
  await query(
    `INSERT INTO alien_encounters
       (player_id, alien_faction_id, encounter_type, sector_x, sector_y, quadrant_x, quadrant_y,
        encounter_data, reputation_before, reputation_after, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      params.playerId,
      params.factionId,
      params.encounterType,
      params.sectorX,
      params.sectorY,
      params.quadrantX,
      params.quadrantY,
      JSON.stringify(params.encounterData ?? {}),
      params.repBefore,
      params.repAfter,
      Date.now(),
    ],
  );
}

/** Get number of times a player has salvaged wrecks (for Scrapper access check). */
export async function getPlayerSalvageCount(playerId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM alien_encounters
     WHERE player_id = $1 AND encounter_type = 'salvage'`,
    [playerId],
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

/** Get number of discoveries the player has made (for Archivist scan currency). */
export async function getPlayerDiscoveryCount(playerId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM discoveries WHERE player_id = $1`,
    [playerId],
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

/** Get number of combat victories the player has logged (for K'thari rank). */
export async function getPlayerCombatVictoryCount(playerId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM battle_log
     WHERE player_id = $1 AND outcome = 'victory'`,
    [playerId],
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

/** Get player stats for Mirror Minds stat-mirror interaction. */
export async function getMirrorMindStats(playerId: string): Promise<{
  battles: number;
  victories: number;
  questsCompleted: number;
  questsFailed: number;
  sectorsScanned: number;
}> {
  const [battleRows, questRows, discRows] = await Promise.all([
    query<{ total: string; victories: string }>(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE outcome = 'victory') as victories
       FROM battle_log WHERE player_id = $1`,
      [playerId],
    ),
    query<{ completed: string; failed: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM quests WHERE player_id = $1`,
      [playerId],
    ),
    query<{ count: string }>(
      'SELECT COUNT(*) as count FROM discoveries WHERE player_id = $1',
      [playerId],
    ),
  ]);
  return {
    battles: parseInt(battleRows.rows[0]?.total ?? '0', 10),
    victories: parseInt(battleRows.rows[0]?.victories ?? '0', 10),
    questsCompleted: parseInt(questRows.rows[0]?.completed ?? '0', 10),
    questsFailed: parseInt(questRows.rows[0]?.failed ?? '0', 10),
    sectorsScanned: parseInt(discRows.rows[0]?.count ?? '0', 10),
  };
}

// ── Territory Claims ──────────────────────────────────────────────────────────

export interface TerritoryClaimRow {
  id: number;
  player_id: string;
  player_name: string;
  quadrant_x: number;
  quadrant_y: number;
  claimed_at: string;
  defense_rating: string;
  victories: number;
}

export async function getTerritoryClaim(
  quadrantX: number,
  quadrantY: number,
): Promise<TerritoryClaimRow | null> {
  const res = await query<TerritoryClaimRow>(
    'SELECT * FROM territory_claims WHERE quadrant_x = $1 AND quadrant_y = $2',
    [quadrantX, quadrantY],
  );
  return res.rows[0] ?? null;
}

export async function createTerritoryClaim(
  playerId: string,
  playerName: string,
  quadrantX: number,
  quadrantY: number,
  defenseRating: string,
): Promise<void> {
  await query(
    `INSERT INTO territory_claims (player_id, player_name, quadrant_x, quadrant_y, defense_rating)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (quadrant_x, quadrant_y) DO NOTHING`,
    [playerId, playerName, quadrantX, quadrantY, defenseRating],
  );
}

export async function deleteTerritoryClaim(
  quadrantX: number,
  quadrantY: number,
): Promise<void> {
  await query('DELETE FROM territory_claims WHERE quadrant_x = $1 AND quadrant_y = $2', [
    quadrantX,
    quadrantY,
  ]);
}

export async function incrementTerritoryVictories(
  quadrantX: number,
  quadrantY: number,
): Promise<void> {
  await query(
    'UPDATE territory_claims SET victories = victories + 1 WHERE quadrant_x = $1 AND quadrant_y = $2',
    [quadrantX, quadrantY],
  );
}

export async function getPlayerTerritories(playerId: string): Promise<TerritoryClaimRow[]> {
  const res = await query<TerritoryClaimRow>(
    'SELECT * FROM territory_claims WHERE player_id = $1 ORDER BY claimed_at DESC',
    [playerId],
  );
  return res.rows;
}

// ── News Events ───────────────────────────────────────────────────────────────

export interface NewsEventRow {
  id: number;
  event_type: string;
  headline: string;
  summary: string | null;
  event_data: Record<string, unknown> | null;
  player_id: string | null;
  player_name: string | null;
  quadrant_x: number | null;
  quadrant_y: number | null;
  created_at: string;
}

export async function recordNewsEvent(params: {
  eventType: string;
  headline: string;
  summary?: string;
  eventData?: Record<string, unknown>;
  playerId?: string;
  playerName?: string;
  quadrantX?: number;
  quadrantY?: number;
}): Promise<void> {
  await query(
    `INSERT INTO news_events (event_type, headline, summary, event_data, player_id, player_name, quadrant_x, quadrant_y)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.eventType,
      params.headline,
      params.summary ?? null,
      params.eventData ? JSON.stringify(params.eventData) : null,
      params.playerId ?? null,
      params.playerName ?? null,
      params.quadrantX ?? null,
      params.quadrantY ?? null,
    ],
  );
}

export async function getRecentNews(limit = 20): Promise<NewsEventRow[]> {
  const res = await query<NewsEventRow>(
    'SELECT * FROM news_events ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return res.rows;
}

export async function getQuadrantDiscoveriesSince(
  sinceMinutes: number,
): Promise<{ quadrant_x: number; quadrant_y: number; player_name: string; count: string }[]> {
  const res = await query<{
    quadrant_x: number;
    quadrant_y: number;
    player_name: string;
    count: string;
  }>(
    `SELECT ne.quadrant_x, ne.quadrant_y, ne.player_name, COUNT(*) as count
     FROM news_events ne
     WHERE ne.event_type = 'quadrant_discovery'
       AND ne.created_at >= NOW() - INTERVAL '1 minute' * $1
     GROUP BY ne.quadrant_x, ne.quadrant_y, ne.player_name
     ORDER BY MIN(ne.created_at) DESC
     LIMIT 50`,
    [sinceMinutes],
  );
  return res.rows;
}

export async function getAllTerritoryClaims(): Promise<TerritoryClaimRow[]> {
  const res = await query<TerritoryClaimRow>(
    'SELECT * FROM territory_claims ORDER BY claimed_at DESC',
  );
  return res.rows;
}

// ── Story Quest Progress ──────────────────────────────────────────────────────

export interface StoryQuestProgressRow {
  player_id: string;
  current_chapter: number;
  completed_chapters: number[];
  branch_choices: Record<string, string>;
  last_progress: number;
}

export async function getStoryProgress(playerId: string): Promise<StoryQuestProgressRow> {
  await query(
    `INSERT INTO story_quest_progress (player_id)
     VALUES ($1)
     ON CONFLICT (player_id) DO NOTHING`,
    [playerId],
  );
  const res = await query<StoryQuestProgressRow>(
    `SELECT * FROM story_quest_progress WHERE player_id = $1`,
    [playerId],
  );
  return res.rows[0] ?? { player_id: playerId, current_chapter: 0, completed_chapters: [], branch_choices: {}, last_progress: Date.now() };
}

export async function upsertStoryProgress(
  playerId: string,
  chapter: number,
  completedChapters: number[],
  branchChoices: Record<string, string>,
): Promise<void> {
  await query(
    `INSERT INTO story_quest_progress (player_id, current_chapter, completed_chapters, branch_choices, last_progress)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (player_id) DO UPDATE
     SET current_chapter = $2, completed_chapters = $3, branch_choices = $4, last_progress = $5`,
    [playerId, chapter, JSON.stringify(completedChapters), JSON.stringify(branchChoices), Date.now()],
  );
}

// ── Humanity Reputation ───────────────────────────────────────────────────────

export async function contributeHumanityRep(alienFactionId: string, delta: number): Promise<void> {
  await query(
    `INSERT INTO humanity_reputation (alien_faction_id, rep_value, interaction_count, last_updated)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (alien_faction_id) DO UPDATE
     SET rep_value = humanity_reputation.rep_value + $2,
         interaction_count = humanity_reputation.interaction_count + 1,
         last_updated = $3`,
    [alienFactionId, delta, Date.now()],
  );
}

export async function getHumanityRep(alienFactionId: string): Promise<number> {
  const res = await query<{ rep_value: number }>(
    'SELECT rep_value FROM humanity_reputation WHERE alien_faction_id = $1',
    [alienFactionId],
  );
  return res.rows[0]?.rep_value ?? 0;
}

// ── Community Alien Quests ────────────────────────────────────────────────────

export interface CommunityAlienQuestRow {
  id: number;
  alien_faction_id: string;
  quest_type: string;
  title: string;
  description: string | null;
  target_count: number;
  current_count: number;
  reward_type: string | null;
  started_at: number;
  expires_at: number | null;
  completed_at: number | null;
  status: string;
}

export async function getActiveCommunityAlienQuest(): Promise<CommunityAlienQuestRow | null> {
  const res = await query<CommunityAlienQuestRow>(
    `SELECT * FROM community_alien_quests WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`,
  );
  return res.rows[0] ?? null;
}

export async function insertCommunityAlienQuest(
  factionId: string,
  questType: string,
  title: string,
  description: string,
  targetCount: number,
  rewardType: string,
  expiresAt: number,
): Promise<CommunityAlienQuestRow> {
  const res = await query<CommunityAlienQuestRow>(
    `INSERT INTO community_alien_quests (alien_faction_id, quest_type, title, description, target_count, reward_type, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [factionId, questType, title, description, targetCount, rewardType, expiresAt],
  );
  return res.rows[0];
}

export async function addCommunityQuestContribution(
  questId: number,
  playerId: string,
  amount: number,
): Promise<void> {
  await query(
    `INSERT INTO community_quest_contributions (quest_id, player_id, contribution)
     VALUES ($1, $2, $3)
     ON CONFLICT (quest_id, player_id) DO UPDATE
     SET contribution = community_quest_contributions.contribution + $3,
         contributed_at = $4`,
    [questId, playerId, amount, Date.now()],
  );
  await query(
    `UPDATE community_alien_quests SET current_count = current_count + $1 WHERE id = $2`,
    [amount, questId],
  );
}

export async function expireOldCommunityQuests(): Promise<void> {
  await query(
    `UPDATE community_alien_quests SET status = 'expired'
     WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < $1`,
    [Date.now()],
  );
}

export async function completeCommunityQuest(questId: number): Promise<void> {
  await query(
    `UPDATE community_alien_quests SET status = 'completed', completed_at = $1 WHERE id = $2`,
    [Date.now(), questId],
  );
}
