import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('migration 030 — player jumpgates', () => {
  const sql = readFileSync(
    join(__dirname, '../db/migrations/030_player_jumpgates.sql'),
    'utf-8',
  );

  it('adds owner_id column', () => {
    expect(sql).toContain('owner_id');
  });

  it('adds level columns', () => {
    expect(sql).toContain('level_connection');
    expect(sql).toContain('level_distance');
  });

  it('adds toll_credits column', () => {
    expect(sql).toContain('toll_credits');
  });

  it('creates jumpgate_links table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS jumpgate_links');
  });

  it('has CASCADE delete on links', () => {
    expect(sql).toContain('ON DELETE CASCADE');
  });

  it('uses IF NOT EXISTS for idempotency', () => {
    const lines = sql.split('\n').filter((l) => l.includes('CREATE'));
    for (const line of lines) {
      expect(line).toContain('IF NOT EXISTS');
    }
  });
});
