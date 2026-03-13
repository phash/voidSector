import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(__dirname, '..', 'db', 'migrations', '029_admin_stories.sql');

describe('migration 029_admin_stories', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');

  it('migration file exists and is non-empty', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('creates admin_stories table with IF NOT EXISTS (idempotent)', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS admin_stories');
  });

  it('defines all required columns', () => {
    const expectedColumns = [
      'id UUID PRIMARY KEY',
      'title TEXT NOT NULL',
      'summary TEXT NOT NULL',
      'scenario TEXT NOT NULL',
      'steps JSONB NOT NULL',
      'findings JSONB NOT NULL',
      'screenshot_paths TEXT[]',
      'status TEXT NOT NULL',
      'created_at TIMESTAMPTZ NOT NULL',
    ];
    for (const col of expectedColumns) {
      expect(sql).toContain(col);
    }
  });

  it('sets correct default values', () => {
    expect(sql).toContain("DEFAULT gen_random_uuid()");
    expect(sql).toContain("DEFAULT ''");
    expect(sql).toContain("DEFAULT '[]'::jsonb");
    expect(sql).toContain("DEFAULT '{}'");
    expect(sql).toContain("DEFAULT 'draft'");
    expect(sql).toContain('DEFAULT NOW()');
  });

  it('creates indexes with IF NOT EXISTS (idempotent)', () => {
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_admin_stories_created');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_admin_stories_status');
  });

  it('indexes created_at DESC for chronological listing', () => {
    expect(sql).toContain('(created_at DESC)');
  });

  it('indexes status for filtering', () => {
    expect(sql).toMatch(/idx_admin_stories_status\s+ON\s+admin_stories\s+\(status\)/);
  });

  it('is fully idempotent (all statements use IF NOT EXISTS)', () => {
    const createStatements = sql.match(/CREATE\s+(TABLE|INDEX)/gi) || [];
    const ifNotExistsStatements = sql.match(/CREATE\s+(TABLE|INDEX)\s+IF NOT EXISTS/gi) || [];
    expect(createStatements.length).toBe(ifNotExistsStatements.length);
    expect(createStatements.length).toBe(3); // 1 table + 2 indexes
  });
});
