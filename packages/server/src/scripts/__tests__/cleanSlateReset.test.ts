import { describe, it, expect } from 'vitest';
import { CLEAN_SLATE_WIPE_TABLES } from '../cleanSlateReset.js';

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
