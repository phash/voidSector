import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('migration 044 — inventory table schema', () => {
  it('inventory table columns are defined in migration SQL', () => {
    const sql = readFileSync(
      join(__dirname, '../db/migrations/044_unified_inventory.sql'),
      'utf8',
    );
    // Required columns
    expect(sql).toContain('player_id');
    expect(sql).toContain('item_type');
    expect(sql).toContain('item_id');
    expect(sql).toContain('quantity');
    // Table and constraint structure
    expect(sql).toContain("CHECK (item_type IN ('resource', 'module', 'blueprint'))");
    expect(sql).toContain('UNIQUE (player_id, item_type, item_id)');
    // Indexes
    expect(sql).toContain('idx_inventory_player');
    expect(sql).toContain('idx_inventory_player_type');
    // Kontor extension
    expect(sql).toContain('kontor_orders');
    expect(sql).toContain("DEFAULT 'resource'");
  });
});
