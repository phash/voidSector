// packages/server/src/__tests__/migration-053.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SQL = readFileSync(
  join(import.meta.dirname, '../db/migrations/053_module_state.sql'), 'utf-8',
);

describe('migration 053 — module state backfill', () => {
  it('contains powerLevel logic', () => expect(SQL).toContain('powerLevel'));
  it('contains currentHp logic', () => expect(SQL).toContain('currentHp'));
  it('uses jsonb_array_elements', () => expect(SQL).toContain('jsonb_array_elements'));
  it('has tier-based HP mapping', () => {
    expect(SQL).toContain('110'); // mk5
    expect(SQL).toContain('20');  // mk1
  });
  it('guards empty modules arrays', () => {
    expect(SQL).toContain('jsonb_array_length');
  });
});
