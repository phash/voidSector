import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/db.js', () => ({ query: vi.fn() }));

import { query } from '../db/db.js';

describe('migration 044 — inventory table schema', () => {
  it('inventory table columns are defined in migration SQL', () => {
    // Read the migration file and verify the required columns are declared
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, '../db/migrations/044_unified_inventory.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('player_id');
    expect(sql).toContain('item_type');
    expect(sql).toContain('item_id');
    expect(sql).toContain('quantity');
    expect(sql).toContain('inventory');
    expect(sql).toContain('kontor_orders');
    expect(sql).toContain('item_type');
  });
});
