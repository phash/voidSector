// gameConfigService.ts — Manages game config values in DB + Redis Pub/Sub + in-memory cache.
//
// On init:
//   1. Snapshot defaults (before any overrides)
//   2. Seed missing values into DB
//   3. Load all DB values into cache
//   4. Apply all values to in-memory constants
//   5. Subscribe to Redis for cross-instance updates
//
// Usage:
//   import { gameConfig } from './gameConfigService.js';
//   await gameConfig.init();
//   const val = gameConfig.get('AP_DEFAULTS.max');
//   await gameConfig.set('AP_DEFAULTS.max', 200);

import Redis from 'ioredis';
import { query } from '../db/client.js';
import { CONFIG_SEED } from './gameConfigSeed.js';
import { snapshotDefaults, applyConfigValue, applyAllConfig } from './gameConfigApply.js';
import { logger } from '../utils/logger.js';

const CHANNEL = 'game_config_update';

class GameConfigService {
  private cache = new Map<string, any>();
  private redis: Redis | null = null;
  private subscriber: Redis | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    // 1. Snapshot defaults BEFORE any overrides
    snapshotDefaults();

    // 2. Seed missing values into DB
    await this.seedDefaults();

    // 3. Load all values from DB into cache
    const res = await query<{ key: string; value: any; category: string; description: string }>(
      'SELECT key, value, category, description FROM game_config',
    );
    for (const row of res.rows) {
      this.cache.set(row.key, row.value);
    }

    // 4. Apply all DB values to in-memory constants
    applyAllConfig(this.cache);

    // 5. Subscribe to Redis updates
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(url);
    this.subscriber = new Redis(url);

    await this.subscriber.subscribe(CHANNEL);
    this.subscriber.on('message', (_ch: string, msg: string) => {
      try {
        const { key, value } = JSON.parse(msg);
        if (value === null) {
          this.cache.delete(key);
        } else {
          this.cache.set(key, value);
        }
        applyConfigValue(key, value);
        logger.info({ key }, 'Game config updated via Redis');
      } catch (err) {
        logger.error({ err }, 'Failed to process config update');
      }
    });

    this.initialized = true;
    logger.info({ count: this.cache.size }, 'GameConfigService initialized');
  }

  private async seedDefaults(): Promise<void> {
    for (const entry of CONFIG_SEED) {
      const defaultValue = entry.getDefault();
      await query(
        `INSERT INTO game_config (key, value, category, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO NOTHING`,
        [entry.key, JSON.stringify(defaultValue), entry.category, entry.description],
      );
    }
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  getAll(category?: string): Array<{ key: string; value: any; category: string; description: string | null }> {
    const results: Array<{ key: string; value: any; category: string; description: string | null }> = [];
    for (const entry of CONFIG_SEED) {
      if (category && entry.category !== category) continue;
      results.push({
        key: entry.key,
        value: this.cache.get(entry.key) ?? entry.getDefault(),
        category: entry.category,
        description: entry.description,
      });
    }
    return results;
  }

  async set(key: string, value: any, category?: string, description?: string): Promise<any> {
    const previous = this.cache.get(key);

    // Upsert to DB
    await query(
      `INSERT INTO game_config (key, value, category, description, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value), category ?? 'unknown', description ?? null],
    );

    // Update local cache
    this.cache.set(key, value);
    applyConfigValue(key, value);

    // Publish to Redis for other server instances
    if (this.redis) {
      await this.redis.publish(CHANNEL, JSON.stringify({ key, value }));
    }

    return previous;
  }

  async delete(key: string): Promise<void> {
    await query('DELETE FROM game_config WHERE key = $1', [key]);
    this.cache.delete(key);

    // Find default from seed and restore it
    const seed = CONFIG_SEED.find((s) => s.key === key);
    if (seed) {
      const defaultVal = seed.getDefault();
      applyConfigValue(key, defaultVal);
    }

    // Publish to Redis for other server instances
    if (this.redis) {
      await this.redis.publish(CHANNEL, JSON.stringify({ key, value: null }));
    }
  }

  getCategories(): string[] {
    const cats = new Set<string>();
    for (const entry of CONFIG_SEED) cats.add(entry.category);
    return [...cats].sort();
  }
}

export const gameConfig = new GameConfigService();
