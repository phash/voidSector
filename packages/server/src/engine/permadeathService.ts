/**
 * Permadeath Service — ACEP/4
 * Handles ship destruction, wreck POI creation, and legacy inheritance.
 *
 * Flow:
 * - HP = 0 (combat defeat): destroyShipAndCreateLegacy()
 * - HP < 15 (eject pod): ejectPod() — cargo lost, ship survives
 */

import { query } from '../db/client.js';
import { getAcepXpSummary } from './acepXpService.js';
import { calculateTraits, dominantTrait } from './traitCalculator.js';
import { addToInventory } from './inventoryService.js';

export interface WreckData {
  id: string;
  originalShipId: string;
  playerName: string;
  quadrantX: number;
  quadrantY: number;
  sectorX: number;
  sectorY: number;
  radarIconData: { tier: number; path: string };
  lastLogEntry: string | null;
  salvageableModules: string[];
  createdAt: number;
}

/** Insert a wreck POI into ship_wrecks and return its id. */
async function createShipWreck(params: {
  originalShipId: string;
  playerName: string;
  quadrantX: number;
  quadrantY: number;
  sectorX: number;
  sectorY: number;
  radarIconData: { tier: number; path: string };
  lastLogEntry: string | null;
  salvageableModules: string[];
}): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO ship_wrecks
       (original_ship_id, player_name, quadrant_x, quadrant_y, sector_x, sector_y,
        radar_icon_data, last_log_entry, salvageable_modules)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      params.originalShipId,
      params.playerName,
      params.quadrantX,
      params.quadrantY,
      params.sectorX,
      params.sectorY,
      JSON.stringify(params.radarIconData),
      params.lastLogEntry,
      JSON.stringify(params.salvageableModules),
    ],
  );
  return rows[0].id;
}

/** Query all wrecks present in a specific sector. */
export async function getWrecksInSector(
  qx: number,
  qy: number,
  sx: number,
  sy: number,
): Promise<WreckData[]> {
  const { rows } = await query<any>(
    `SELECT id, original_ship_id, player_name, quadrant_x, quadrant_y,
            sector_x, sector_y, radar_icon_data, last_log_entry,
            salvageable_modules, created_at
     FROM ship_wrecks
     WHERE quadrant_x = $1 AND quadrant_y = $2 AND sector_x = $3 AND sector_y = $4`,
    [qx, qy, sx, sy],
  );
  return rows.map((r: any) => ({
    id: r.id,
    originalShipId: r.original_ship_id,
    playerName: r.player_name,
    quadrantX: r.quadrant_x,
    quadrantY: r.quadrant_y,
    sectorX: r.sector_x,
    sectorY: r.sector_y,
    radarIconData: r.radar_icon_data,
    lastLogEntry: r.last_log_entry,
    salvageableModules: r.salvageable_modules,
    createdAt: r.created_at,
  }));
}

/**
 * Destroy a ship in combat (permadeath) and spawn a new legacy ship.
 * - Creates a wreck POI with 25% salvage chance per module
 * - Deactivates old ship (kept in DB for history)
 * - Creates new scout ship with 30% inherited XP + 1 dominant trait
 */
export async function destroyShipAndCreateLegacy(params: {
  playerId: string;
  shipId: string;
  playerName: string;
  quadrantX: number;
  quadrantY: number;
  sectorX: number;
  sectorY: number;
  modules: string[];
  lastLogEntry?: string;
}): Promise<{ newShipId: string; wreckId: string; legacyXp: { ausbau: number; intel: number; kampf: number; explorer: number } }> {
  // Read ACEP XP for legacy computation
  const acepXp = await getAcepXpSummary(params.shipId);
  const traits = calculateTraits(acepXp);
  const dominant = dominantTrait(traits);

  // Radar icon data for wreck display
  const total = acepXp.total;
  const tier = total >= 80 ? 4 : total >= 50 ? 3 : total >= 20 ? 2 : 1;
  const path = dominant ?? 'neutral';

  // Salvageable modules: 25% chance per module (deterministic per ship+index)
  const salvageableMods = params.modules.filter((_, i) => {
    const hash = params.shipId
      .split('')
      .reduce((acc, ch, ci) => acc ^ (ch.charCodeAt(0) * (ci + 1) * 31), i * 97);
    return (Math.abs(hash) % 100) < 25;
  });

  // Create wreck POI
  const wreckId = await createShipWreck({
    originalShipId: params.shipId,
    playerName: params.playerName,
    quadrantX: params.quadrantX,
    quadrantY: params.quadrantY,
    sectorX: params.sectorX,
    sectorY: params.sectorY,
    radarIconData: { tier, path },
    lastLogEntry: params.lastLogEntry ?? null,
    salvageableModules: salvageableMods,
  });

  // Deactivate old ship
  await query('UPDATE ships SET active = false WHERE id = $1', [params.shipId]);

  // Compute legacy XP (30% of each path, rounded down)
  const legacyXp = {
    ausbau: Math.floor(acepXp.ausbau * 0.3),
    intel: Math.floor(acepXp.intel * 0.3),
    kampf: Math.floor(acepXp.kampf * 0.3),
    explorer: Math.floor(acepXp.explorer * 0.3),
  };
  const legacyTraits = dominant ? [dominant] : [];

  // Get old ship's generation
  const genResult = await query<{ acep_generation: number }>(
    'SELECT acep_generation FROM ships WHERE id = $1',
    [params.shipId],
  );
  const oldGen = genResult.rows[0]?.acep_generation ?? 0;

  // Create new legacy ship (scout, named "Phoenix-<timestamp>")
  const shipName = `Phoenix-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO ships
       (owner_id, hull_type, name, fuel, active,
        acep_ausbau_xp, acep_intel_xp, acep_kampf_xp, acep_explorer_xp,
        acep_traits, acep_generation, acep_legacy_from_ship_id)
     VALUES ($1, 'scout', $2, 50, true, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      params.playerId,
      shipName,
      legacyXp.ausbau,
      legacyXp.intel,
      legacyXp.kampf,
      legacyXp.explorer,
      JSON.stringify(legacyTraits),
      oldGen + 1,
      params.shipId,
    ],
  );

  return { newShipId: rows[0].id, wreckId, legacyXp };
}

/**
 * Eject Pod: player survives by jettisoning all cargo.
 * The ship is not destroyed — only cargo is lost.
 */
export async function ejectPod(playerId: string): Promise<void> {
  await query('DELETE FROM cargo WHERE player_id = $1', [playerId]);
}

/**
 * Salvage a module from a wreck (removes it from the wreck's salvageable list).
 * Returns the module name if found, null otherwise.
 */
export async function salvageWreckModule(
  wreckId: string,
  playerId: string,
): Promise<string | null> {
  const { rows } = await query<{ salvageable_modules: string[] }>(
    'SELECT salvageable_modules FROM ship_wrecks WHERE id = $1',
    [wreckId],
  );
  if (rows.length === 0) return null;

  const modules = rows[0].salvageable_modules;
  if (modules.length === 0) return null;

  const module = modules[0];
  const remaining = modules.slice(1);

  await query('UPDATE ship_wrecks SET salvageable_modules = $1 WHERE id = $2', [
    JSON.stringify(remaining),
    wreckId,
  ]);

  // Add salvaged module to unified inventory
  await addToInventory(playerId, 'module', module, 1);

  return module;
}
