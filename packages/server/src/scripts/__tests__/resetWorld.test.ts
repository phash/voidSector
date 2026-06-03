import { describe, it, expect } from 'vitest';
import { WORLD_RESET_TABLES, PLAYER_PROGRESS_TABLES } from '../resetWorld.js';

describe('resetWorld table lists', () => {
  it('never deletes the players account table', () => {
    expect(WORLD_RESET_TABLES).not.toContain('players');
    expect(PLAYER_PROGRESS_TABLES).not.toContain('players');
  });

  it('wipes core world + expansion tables', () => {
    for (const t of ['sectors', 'quadrants', 'quadrant_control', 'expansion_log', 'civ_stations', 'civ_ships']) {
      expect(WORLD_RESET_TABLES).toContain(t);
    }
  });

  it('wipes per-player progress (ships reset ACEP) but not accounts', () => {
    for (const t of ['ships', 'cargo', 'inventory', 'player_discoveries']) {
      expect(PLAYER_PROGRESS_TABLES).toContain(t);
    }
  });

  it('orders ships after tables that reference it', () => {
    const idx = (t: string) => PLAYER_PROGRESS_TABLES.indexOf(t);
    expect(idx('ships')).toBeGreaterThan(idx('cargo'));
    expect(idx('ships')).toBeGreaterThan(idx('inventory'));
  });
});
