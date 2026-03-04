import { query, runMigrations } from '../db/client.js';
import { createPlayer } from '../db/queries.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

async function reseed() {
  await runMigrations();
  console.log('Migrations complete');

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
      console.log(`Cleared ${table}: ${del.rowCount} rows`);
    } catch (err: any) {
      console.log(`Skip ${table}: ${err.message}`);
    }
  }

  console.log('Redis will be flushed separately');

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
    console.log(`Created ${acct.username} (id: ${player.id}) at (${acct.homeBase.x}, ${acct.homeBase.y})`);
  }

  console.log('Reseed complete');
  process.exit(0);
}

reseed().catch(err => {
  console.error('Reseed failed:', err);
  process.exit(1);
});
