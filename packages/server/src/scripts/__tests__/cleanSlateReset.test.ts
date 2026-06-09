import { describe, it, expect } from 'vitest';
import { CLEAN_SLATE_WIPE_TABLES, homeQuadrantSet, nonHomeDeleteSql } from '../cleanSlateReset.js';

describe('cleanSlateReset — wipe table list', () => {
  it('wipes the station + in-flight-expansion tables', () => {
    for (const t of ['civ_stations', 'civ_ships', 'npc_fleet', 'cosmic_npc_fleets', 'expansion_log']) {
      expect(CLEAN_SLATE_WIPE_TABLES).toContain(t);
    }
  });
  it('never wipes accounts, config, or player progress', () => {
    for (const t of ['players', 'game_config', 'faction_config', 'ships', 'player_stations', 'sectors']) {
      expect(CLEAN_SLATE_WIPE_TABLES).not.toContain(t);
    }
  });
});

describe('cleanSlateReset — home quadrants', () => {
  it('always includes the human home 0:0', () => {
    const homes = homeQuadrantSet([{ faction_id: 'humans', home_qx: 0, home_qy: 0 }]);
    expect(homes.has('0:0')).toBe(true);
  });
  it('includes each alien faction home and excludes nothing else', () => {
    const homes = homeQuadrantSet([
      { faction_id: 'humans', home_qx: 0, home_qy: 0 },
      { faction_id: 'kthari', home_qx: 270, home_qy: 280 },
    ]);
    expect(homes.has('0:0')).toBe(true);
    expect(homes.has('270:280')).toBe(true);
    expect(homes.size).toBe(2);
  });
});

describe('cleanSlateReset — non-home delete SQL', () => {
  it('keeps the home quadrants and deletes everything else', () => {
    const { sql, params } = nonHomeDeleteSql(new Set(['0:0', '270:280']));
    expect(sql).toMatch(/DELETE FROM quadrant_control/i);
    expect(sql).toMatch(/NOT IN/i);
    expect(sql).toMatch(/NOT IN \(\(\$1, \$2\), \(\$3, \$4\)\)/);
    expect(params).toEqual([0, 0, 270, 280]);
  });
  it('deletes ALL when there are no homes (defensive)', () => {
    const { sql } = nonHomeDeleteSql(new Set());
    expect(sql).toBe('DELETE FROM quadrant_control');
  });
});
