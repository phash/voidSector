import { query, runMigrations } from '../db/client.js';
import { createPlayer } from '../db/queries.js';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger.js';

const SALT_ROUNDS = 10;

async function reseed() {
  await runMigrations();
  logger.info('Migrations complete');

  // 1. Full wipe: all sectors, all players, all quadrants, all discoveries
  const tables = [
    'player_known_jumpgates',
    'player_known_quadrants',
    'player_station_reputation',
    'autopilot_routes',
    'player_auto_refuel',
    'player_bookmarks',
    'player_discoveries',
    'messages',
    'faction_members',
    'faction_upgrades',
    'factions',
    'ships',
    'cargo',
    'sectors',
    'quadrants',
    'players',
  ];
  for (const table of tables) {
    try {
      const del = await query(`DELETE FROM ${table}`);
      logger.info({ table, rowCount: del.rowCount }, 'Cleared table');
    } catch (err: any) {
      logger.info({ table, error: err.message }, 'Skipped table');
    }
  }

  logger.info('Redis will be flushed separately');

  // 3. Create test accounts — all spawn in quadrant (3000,3000), sector ~(1234,1234)
  //    absolute = quadrant * QUADRANT_SIZE + sector = 3000 * 10000 + 1234 = 30001234
  const passwordHash = await bcrypt.hash('test1234', SALT_ROUNDS);
  const accounts = [
    { username: 'Phash', homeBase: { x: 30001234, y: 30001234 } },
    { username: 'Smasher', homeBase: { x: 30001254, y: 30001234 } },
    { username: 'Fede', homeBase: { x: 30001234, y: 30001254 } },
  ];

  for (const acct of accounts) {
    const player = await createPlayer(acct.username, passwordHash, acct.homeBase);
    logger.info({ username: acct.username, id: player.id, x: acct.homeBase.x, y: acct.homeBase.y }, 'Created player');
  }

  logger.info('Reseed complete');
  process.exit(0);
}

reseed().catch(err => {
  logger.error({ err }, 'Reseed failed');
  process.exit(1);
});
