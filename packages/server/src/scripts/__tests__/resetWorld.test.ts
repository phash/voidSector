import { describe, it, expect } from 'vitest';
import { WORLD_RESET_TABLES, PLAYER_PROGRESS_TABLES } from '../resetWorld.js';

describe('resetWorld table lists', () => {
  it('never deletes the players account table', () => {
    expect(WORLD_RESET_TABLES).not.toContain('players');
    expect(PLAYER_PROGRESS_TABLES).not.toContain('players');
  });

  it('never deletes reference/config tables (would break the game)', () => {
    const all = [...WORLD_RESET_TABLES, ...PLAYER_PROGRESS_TABLES];
    for (const t of ['game_config', 'faction_config', 'cosmic_factions', 'module_definitions', 'research_definitions']) {
      expect(all).not.toContain(t);
    }
  });

  it('wipes core world + expansion tables', () => {
    for (const t of ['sectors', 'quadrants', 'quadrant_control', 'expansion_log', 'civ_stations', 'civ_ships']) {
      expect(WORLD_RESET_TABLES).toContain(t);
    }
  });

  it('clears stale void-cluster and jumpgate world state', () => {
    for (const t of ['void_clusters', 'void_cluster_quadrants', 'void_frontier_sectors', 'void_hives', 'jumpgates', 'jumpgate_links']) {
      expect(WORLD_RESET_TABLES).toContain(t);
    }
  });

  it('clears ship wrecks from the world', () => {
    for (const t of ['wrecks', 'ship_wrecks', 'wreck_slate_metadata']) {
      expect(WORLD_RESET_TABLES).toContain(t);
    }
  });

  it('wipes per-player progress (ships reset ACEP) including legacy research, but not accounts', () => {
    for (const t of ['ships', 'cargo', 'inventory', 'player_discoveries', 'player_research', 'player_research_v2']) {
      expect(PLAYER_PROGRESS_TABLES).toContain(t);
    }
  });

  it('orders ships after tables that reference it', () => {
    const idx = (t: string) => PLAYER_PROGRESS_TABLES.indexOf(t);
    expect(idx('ships')).toBeGreaterThan(idx('cargo'));
    expect(idx('ships')).toBeGreaterThan(idx('inventory'));
  });

  it('deletes quadrant_control before void_clusters (FK void_cluster_id)', () => {
    const idx = (t: string) => WORLD_RESET_TABLES.indexOf(t);
    expect(idx('quadrant_control')).toBeLessThan(idx('void_clusters'));
  });

  it('wipes player-station mining ships before player_stations (FK child-first)', () => {
    const idx = (t: string) => WORLD_RESET_TABLES.indexOf(t);
    expect(WORLD_RESET_TABLES).toContain('station_mining_ships');
    expect(idx('station_mining_ships')).toBeLessThan(idx('player_stations'));
  });
});
