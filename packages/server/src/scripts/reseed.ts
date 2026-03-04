import { query, runMigrations } from '../db/client.js';
import { createPlayer } from '../db/queries.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

async function reseed() {
  await runMigrations();
  console.log('Migrations complete');

  // 1. Delete all sectors in quadrant (0,0)
  const deleted = await query(
    'DELETE FROM sectors WHERE x >= 0 AND x < 10000 AND y >= 0 AND y < 10000'
  );
  console.log(`Deleted ${deleted.rowCount} sectors in quadrant (0,0)`);

  // 2. Create test accounts
  const passwordHash = await bcrypt.hash('test1234', SALT_ROUNDS);
  const accounts = [
    { username: 'Phash', homeBase: { x: 20, y: 20 } },
    { username: 'Smasher', homeBase: { x: 40, y: 20 } },
    { username: 'Fede', homeBase: { x: 20, y: 40 } },
  ];

  for (const acct of accounts) {
    try {
      const player = await createPlayer(acct.username, passwordHash, acct.homeBase);
      console.log(`Created ${acct.username} (id: ${player.id}) at (${acct.homeBase.x}, ${acct.homeBase.y})`);
    } catch (err: any) {
      if (err.code === '23505') {
        console.log(`${acct.username} already exists — skipping`);
      } else {
        throw err;
      }
    }
  }

  console.log('Reseed complete');
  process.exit(0);
}

reseed().catch(err => {
  console.error('Reseed failed:', err);
  process.exit(1);
});
