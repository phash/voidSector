// packages/server/src/__tests__/migration-054.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SQL = readFileSync(
  join(import.meta.dirname, '../db/migrations/054_combat_log.sql'), 'utf-8',
);

describe('migration 054 — combat_log', () => {
  it('drops battle_log_v2', () => expect(SQL).toContain('DROP TABLE IF EXISTS battle_log_v2'));
  it('drops battle_log', () => expect(SQL).toContain('DROP TABLE IF EXISTS battle_log'));
  it('creates combat_log', () => expect(SQL).toContain('CREATE TABLE IF NOT EXISTS combat_log'));
  it('has outcome column', () => expect(SQL).toContain('outcome'));
  it('has modules_damaged column', () => expect(SQL).toContain('modules_damaged'));
  it('has player index', () => expect(SQL).toContain('idx_combat_log_player'));
});
