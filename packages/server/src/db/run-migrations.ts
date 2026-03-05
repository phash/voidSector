import { runMigrations, pool } from './client.js';
import { logger } from '../utils/logger.js';

async function main() {
  try {
    await runMigrations();
    logger.info('All migrations complete');
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
