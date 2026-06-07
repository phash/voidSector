import { stepToward } from './civShipService.js';
import { NPC_TRADE_WAIT_TICKS, NPC_MILITARY_PATROL_STEPS } from '@void-sector/shared';

/** Sectors a trader ranges out from home on a run. */
const TRADER_RUN_RADIUS = 30;

/**
 * Deterministic next waypoint for a trader's run: at home it heads OUT to a
 * seeded waypoint (stable per ship), away from home it heads back. This turns
 * the never-moving idle trader into a visible ferry. (Station-aware routing is a
 * later economy step — this just makes traders move.)
 */
function pickTraderTarget(ship: any): { x: number; y: number } {
  const homeX = ship.home_x ?? ship.x;
  const homeY = ship.home_y ?? ship.y;
  if (ship.x === homeX && ship.y === homeY) {
    const h = Math.imul((ship.id ?? 1) | 0, 2654435761) >>> 0;
    const span = TRADER_RUN_RADIUS * 2 + 1;
    const dx = (h % span) - TRADER_RUN_RADIUS;
    const dy = (Math.floor(h / span) % span) - TRADER_RUN_RADIUS;
    // Never a zero offset (would target home and never move).
    return { x: homeX + (dx === 0 ? TRADER_RUN_RADIUS : dx), y: homeY + (dy === 0 ? -TRADER_RUN_RADIUS : dy) };
  }
  return { x: homeX, y: homeY };
}

export function nextTraderState(ship: any): any {
  const ps = ship.patrol_state ?? {};

  if (ship.state === 'idle') {
    if (ps.waitTicks > 0) {
      return { patrol_state: { ...ps, waitTicks: ps.waitTicks - 1 } };
    }
    if (ps.targetX != null && ps.targetY != null) {
      return { state: 'traveling' };
    }
    // No target → begin the next leg of a trade run so traders actually move (QW1).
    const t = pickTraderTarget(ship);
    return { state: 'traveling', patrol_state: { ...ps, targetX: t.x, targetY: t.y } };
  }

  if (ship.state === 'traveling') {
    if (ship.x === ps.targetX && ship.y === ps.targetY) {
      return {
        state: 'idle',
        patrol_state: { ...ps, waitTicks: NPC_TRADE_WAIT_TICKS, targetX: null, targetY: null },
        inventory: generateTraderInventory(ship.x),
      };
    }
    const { x: nx, y: ny } = stepToward(ship.x, ship.y, ps.targetX, ps.targetY);
    return { x: nx, y: ny };
  }

  return {};
}

export function nextMilitaryState(ship: any): any {
  const ps = ship.patrol_state ?? {};

  if (ship.state === 'idle') {
    if (!ps.borderX && !ps.borderY) return {};
    return { state: 'traveling', patrol_state: { ...ps, leg: 'to_border' } };
  }

  if (ship.state === 'traveling') {
    const leg = ps.leg ?? 'to_border';

    if (leg === 'to_border') {
      if (ship.x === ps.borderX && ship.y === ps.borderY) {
        return { patrol_state: { ...ps, leg: 'patrol', stepsLeft: NPC_MILITARY_PATROL_STEPS } };
      }
      const { x: nx, y: ny } = stepToward(ship.x, ship.y, ps.borderX, ps.borderY);
      return { x: nx, y: ny };
    }

    if (leg === 'patrol') {
      if (ps.stepsLeft <= 0) {
        return { patrol_state: { ...ps, leg: 'return' } };
      }
      const dx = ps.direction === 'h' ? 1 : 0;
      const dy = ps.direction === 'v' ? 1 : 0;
      return {
        x: ship.x + dx,
        y: ship.y + dy,
        patrol_state: { ...ps, stepsLeft: ps.stepsLeft - 1 },
      };
    }

    if (leg === 'return') {
      if (ship.x === ship.home_x && ship.y === ship.home_y) {
        return { state: 'idle', patrol_state: { ...ps, leg: 'to_border' } };
      }
      const { x: nx, y: ny } = stepToward(ship.x, ship.y, ship.home_x, ship.home_y);
      return { x: nx, y: ny };
    }
  }

  return {};
}

export function nextOutlawState(ship: any): any {
  const ps = ship.patrol_state ?? {};
  const skip = ps.skipTick ?? 0;

  if (skip === 1) {
    return { patrol_state: { ...ps, skipTick: 0 } };
  }

  const newPs = { ...ps, skipTick: 1 };

  if (ps.targetX != null && ps.targetY != null) {
    if (ship.x === ps.targetX && ship.y === ps.targetY) {
      return { patrol_state: { ...newPs, targetX: null, targetY: null } };
    }
    const { x: nx, y: ny } = stepToward(ship.x, ship.y, ps.targetX, ps.targetY);
    return { x: nx, y: ny, patrol_state: newPs };
  }

  const radius = ps.roamRadius ?? 8;
  const anchorX = ps.anchorX ?? ship.home_x;
  const anchorY = ps.anchorY ?? ship.home_y;
  const seed = Date.now() ^ (ship.id * 31);
  const dx = (seed % (radius * 2 + 1)) - radius;
  const dy = ((seed >> 8) % (radius * 2 + 1)) - radius;
  return {
    patrol_state: { ...newPs, targetX: anchorX + dx, targetY: anchorY + dy },
  };
}

function generateTraderInventory(seed: number): Record<string, number> {
  const h = (((seed >> 16) ^ seed) * 0x45d9f3b) >>> 0;
  return {
    ore: 20 + (h % 31),
    gas: 10 + ((h >> 5) % 21),
    crystal: 5 + ((h >> 10) % 11),
  };
}
