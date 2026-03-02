import { runMigrations, pool } from './client.js';

async function main() {
  try {
    await runMigrations();
    console.log('All migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
