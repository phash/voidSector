import {
  QUADRANT_SIZE,
  CIV_MINING_TICKS_TO_FULL,
  CIV_SPIRAL_MAX_STEPS,
} from '@void-sector/shared';
import type { CivShip } from '@void-sector/shared';
import { civQueries } from '../db/civQueries.js';
import { civShipBus } from '../civShipBus.js';
import { generateSector } from './worldgen.js';
import { query } from '../db/client.js';
import { logger } from '../utils/logger.js';

export function ulamSpiralStep(n: number): { dx: number; dy: number } {
  if (n === 0) return { dx: 0, dy: 0 };
  let x = 0, y = 0;
  let step = 1, stepCount = 0, dir = 0;
  const dirs = [
    { dx: 1, dy: 0 }, { dx: 0, dy: -1 },
    { dx: -1, dy: 0 }, { dx: 0, dy: 1 },
  ];
  for (let i = 1; i <= n; i++) {
    const d = dirs[dir % 4];
    x += d.dx;
    y += d.dy;
    stepCount++;
    if (stepCount === step) {
      stepCount = 0;
      dir++;
      if (dir % 2 === 0) step++;
    }
  }
  return { dx: x, dy: y };
}

export function stepToward(
  x: number, y: number, tx: number, ty: number,
): { x: number; y: number } {
  if (x === tx && y === ty) return { x, y };
  return { x: x + Math.sign(tx - x), y: y + Math.sign(ty - y) };
}

function getMineableResource(x: number, y: number): string | null {
  const sector = generateSector(x, y, null);
  const t = sector.type;
  if (t === 'asteroid_field' || t === 'pirate') return 'ore';
  if (t === 'nebula') return 'gas';
  if (t === 'anomaly') return 'crystal';
  return null;
}

function hasMineableResources(x: number, y: number): boolean {
  return getMineableResource(x, y) !== null;
}

export function nextShipState(
  ship: CivShip,
  _unused: null,
  _tickCount: number,
  maxResources: number = CIV_MINING_TICKS_TO_FULL,
): Partial<CivShip> {
  switch (ship.state) {
    case 'idle':
      return { state: 'exploring', spiral_step: 0 };

    case 'exploring': {
      const step = (ship.spiral_step ?? 0) + 1;
      if (step > CIV_SPIRAL_MAX_STEPS) {
        return { state: 'idle', spiral_step: 0 };
      }
      const { dx, dy } = ulamSpiralStep(step);
      const newX = ship.home_x + dx;
      const newY = ship.home_y + dy;
      if (hasMineableResources(newX, newY)) {
        return {
          state: 'traveling',
          // x/y intentionally NOT updated — ship starts traveling from current position
          target_x: newX,
          target_y: newY,
          spiral_step: step,
        };
      }
      return { state: 'exploring', x: newX, y: newY, spiral_step: step };
    }

    case 'traveling': {
      const tx = ship.target_x ?? ship.home_x;
      const ty = ship.target_y ?? ship.home_y;
      const { x: nx, y: ny } = stepToward(ship.x, ship.y, tx, ty);
      if (nx === tx && ny === ty) {
        if (tx === ship.home_x && ty === ship.home_y) {
          return { state: 'idle', x: nx, y: ny, resources_carried: 0, target_x: undefined, target_y: undefined };
        }
        return { state: 'mining', x: nx, y: ny, mined_resource: getMineableResource(nx, ny) ?? 'ore' };
      }
      return { x: nx, y: ny };
    }

    case 'mining': {
      const carried = (ship.resources_carried ?? 0) + 1;
      if (carried >= maxResources) {
        return {
          state: 'returning',
          resources_carried: carried,
          target_x: ship.home_x,
          target_y: ship.home_y,
        };
      }
      return { resources_carried: carried };
    }

    case 'returning': {
      const tx = ship.target_x ?? ship.home_x;
      const ty = ship.target_y ?? ship.home_y;
      const { x: nx, y: ny } = stepToward(ship.x, ship.y, tx, ty);
      if (nx === tx && ny === ty) {
        return { state: 'idle', x: nx, y: ny, resources_carried: 0, target_x: undefined, target_y: undefined };
      }
      return { x: nx, y: ny };
    }

    default:
      return {};
  }
}

function sectorToQuadrant(x: number, y: number): { qx: number; qy: number } {
  return {
    qx: Math.floor(x / QUADRANT_SIZE),
    qy: Math.floor(y / QUADRANT_SIZE),
  };
}

export async function processCivTick(): Promise<void> {
  try {
    const ships = await civQueries.getAllShips();
    if (ships.length === 0) return;

    const quadrantShips = new Map<string, CivShip[]>();

    for (const ship of ships) {
      const updates = nextShipState(ship, null, 0);
      if (Object.keys(updates).length === 0) continue;

      const updated: CivShip = { ...ship, ...updates };
      await civQueries.updateShip(ship.id, {
        state: updated.state,
        x: updated.x,
        y: updated.y,
        target_x: updated.target_x ?? null,
        target_y: updated.target_y ?? null,
        spiral_step: updated.spiral_step ?? 0,
        resources_carried: updated.resources_carried ?? 0,
        mined_resource: updated.mined_resource,
      });

      // Deliver mined resources when drone returns home
      if (ship.state === 'returning' && updated.state === 'idle' && (ship.resources_carried ?? 0) > 0) {
        const delivered = ship.resources_carried!;
        const resource = ship.mined_resource ?? 'ore';
        await query(
          `INSERT INTO npc_station_inventory (station_x, station_y, item_type, stock, max_stock, restock_rate, consumption_rate, last_updated)
           VALUES ($1, $2, $4, $3, 500, 0, 0, NOW())
           ON CONFLICT (station_x, station_y, item_type)
           DO UPDATE SET stock = LEAST(npc_station_inventory.max_stock, npc_station_inventory.stock + $3), last_updated = NOW()`,
          [ship.home_x, ship.home_y, delivered, resource],
        ).catch(() => {});
        logger.info({ droneId: ship.id, homeX: ship.home_x, homeY: ship.home_y, delivered, resource }, 'Drone delivered resources');
      }

      const { qx, qy } = sectorToQuadrant(updated.x, updated.y);
      const key = `${qx}:${qy}`;
      if (!quadrantShips.has(key)) quadrantShips.set(key, []);
      quadrantShips.get(key)!.push(updated);
    }

    for (const [key, qShips] of quadrantShips) {
      const [qx, qy] = key.split(':').map(Number);
      civShipBus.broadcastTick({ qx, qy, ships: qShips });
    }
  } catch (err) {
    logger.error({ err }, 'processCivTick error');
  }
}
