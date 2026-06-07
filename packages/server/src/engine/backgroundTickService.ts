// backgroundTickService.ts — BB1: the Background Universe Tick.
//
// A slow (~5 min), CHUNKED, global sweep over all civ ships so the world away
// from online players keeps evolving — without the OOM that disabled NPC ticks.
// Per-run work is constant (BACKGROUND_CHUNK_SIZE ships × BACKGROUND_CATCHUP_STEPS
// in-memory AI steps + ≤CHUNK_SIZE writes) regardless of total world size. This is
// the deliberate opposite of widening the fast anchor radius (which re-OOMs).

import type { CivShip } from '@void-sector/shared';
import { BACKGROUND_CHUNK_SIZE, BACKGROUND_CATCHUP_STEPS } from '@void-sector/shared';
import { civQueries, getShipsAfterId } from '../db/civQueries.js';
import { nextShipState } from './civShipService.js';
import { logger } from '../utils/logger.js';

/**
 * Next cursor after processing a page: if fewer than a full page came back we've
 * reached the end of the table → wrap to 0; otherwise continue past the last id.
 */
export function advanceCursor(lastId: number, returnedCount: number, chunkSize: number): number {
  return returnedCount < chunkSize ? 0 : lastId;
}

// Sweep cursor: last civ-ship id processed. Persists across runs within a process.
let cursor = 0;

/** Test hook — reset the module-level sweep cursor. */
export function _resetBackgroundCursor(): void {
  cursor = 0;
}

/**
 * Process one background sweep page. Returns how many ships were advanced.
 * Catch-up: each ship gets up to BACKGROUND_CATCHUP_STEPS AI steps in-memory
 * (so a long-unticked ship makes real progress) then a single persist.
 */
export async function processBackgroundTick(): Promise<number> {
  try {
    const ships = (await getShipsAfterId(cursor, BACKGROUND_CHUNK_SIZE)) as CivShip[];
    if (ships.length === 0) {
      cursor = 0; // wrap — table is shorter than the cursor (e.g. after deletions)
      return 0;
    }

    for (const ship of ships) {
      let s: any = { ...ship };
      for (let i = 0; i < BACKGROUND_CATCHUP_STEPS; i++) {
        const upd = nextShipState(s, null, 0);
        if (!upd || Object.keys(upd).length === 0) break; // settled — no further change
        s = { ...s, ...upd };
      }
      await civQueries.updateShip(ship.id as number, {
        state: s.state,
        x: s.x,
        y: s.y,
        target_x: s.target_x ?? null,
        target_y: s.target_y ?? null,
        spiral_step: s.spiral_step ?? 0,
        resources_carried: s.resources_carried ?? 0,
        mined_resource: s.mined_resource,
        patrol_state: s.patrol_state ?? null,
      });
    }

    cursor = advanceCursor(ships[ships.length - 1].id as number, ships.length, BACKGROUND_CHUNK_SIZE);
    return ships.length;
  } catch (err) {
    logger.error({ err }, 'processBackgroundTick error');
    return 0;
  }
}
