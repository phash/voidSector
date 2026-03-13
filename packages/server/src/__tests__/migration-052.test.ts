import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATION_SQL = readFileSync(
  join(__dirname, '../db/migrations/052_module_source.sql'),
  'utf-8',
);

describe('migration 052 — module_source', () => {
  // ── File-content checks ──────────────────────────────────────────────────
  it('migration file exists and is non-empty', () => {
    expect(MIGRATION_SQL.length).toBeGreaterThan(0);
  });

  it('targets the ships table', () => {
    expect(MIGRATION_SQL).toContain('UPDATE ships');
  });

  it('uses jsonb_agg with jsonb_array_elements', () => {
    expect(MIGRATION_SQL).toContain('jsonb_agg');
    expect(MIGRATION_SQL).toContain('jsonb_array_elements');
  });

  it('checks for existing source field with ? operator', () => {
    expect(MIGRATION_SQL).toContain("? 'source'");
  });

  it('appends source: standard for modules without source', () => {
    expect(MIGRATION_SQL).toContain('"source": "standard"');
  });

  it('skips ships with empty modules array', () => {
    expect(MIGRATION_SQL).toContain('jsonb_array_length(modules) > 0');
  });

  // ── Live DB: verify the migration SQL logic in a temp table ─────────────
  beforeAll(async () => {
    // Create an isolated temp table (no FK constraints) for testing the UPDATE logic
    await query(`
      CREATE TEMP TABLE IF NOT EXISTS _mig052_test (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        modules JSONB NOT NULL DEFAULT '[]'
      )
    `);
    await query(`
      INSERT INTO _mig052_test (modules) VALUES
        ('[{"moduleId":"laser_mk1","slotIndex":1}]'::jsonb),
        ('[{"moduleId":"shield_mk1","slotIndex":2,"source":"existing"}]'::jsonb),
        ('[]'::jsonb)
    `);
  });

  afterAll(async () => {
    await query(`DROP TABLE IF EXISTS _mig052_test`);
  });

  it('backfills source=standard for modules without source field', async () => {
    // Apply the migration logic against our temp table
    await query(`
      UPDATE _mig052_test
      SET modules = (
        SELECT jsonb_agg(
          CASE
            WHEN module ? 'source' THEN module
            ELSE module || '{"source": "standard"}'::jsonb
          END
        )
        FROM jsonb_array_elements(modules) AS module
      )
      WHERE jsonb_array_length(modules) > 0
    `);

    const res = await query<{ modules: Array<{ moduleId: string; source?: string }> }>(
      `SELECT modules FROM _mig052_test WHERE jsonb_array_length(modules) > 0 ORDER BY modules->0->>'moduleId'`,
    );

    // laser_mk1 had no source → should get 'standard'
    const laserRow = res.rows.find((r) => r.modules[0].moduleId === 'laser_mk1');
    expect(laserRow).toBeDefined();
    expect(laserRow!.modules[0].source).toBe('standard');

    // shield_mk1 already had source='existing' → must be preserved
    const shieldRow = res.rows.find((r) => r.modules[0].moduleId === 'shield_mk1');
    expect(shieldRow).toBeDefined();
    expect(shieldRow!.modules[0].source).toBe('existing');
  });

  it('leaves empty modules arrays untouched', async () => {
    const res = await query<{ modules: unknown[] }>(
      `SELECT modules FROM _mig052_test WHERE jsonb_array_length(modules) = 0`,
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].modules).toEqual([]);
  });
});
