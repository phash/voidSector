import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('migration 099 ship_programs', () => {
  const sql = readFileSync(join(__dirname, '../db/migrations/099_ship_programs.sql'), 'utf-8');
  it('creates the three program tables idempotently', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS ship_programs');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS ship_program_state');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS ship_program_logs');
  });
  it('keys runtime state by player_id and stores vm_state JSONB', () => {
    expect(sql).toMatch(/ship_program_state[\s\S]*player_id\s+VARCHAR\(255\)\s+PRIMARY KEY/);
    expect(sql).toMatch(/vm_state\s+JSONB/);
  });
});
