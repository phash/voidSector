import { spawnNpcShip } from '../db/civQueries.js';
import { civQueries } from '../db/civQueries.js';
import { logger } from '../utils/logger.js';

export const EXPLORER_TARGET = 40;

export interface ExplorerSpawn {
  faction: string;
  ship_type: string;
  role: string;
  x: number;
  y: number;
  home_x: number;
  home_y: number;
  name: string;
}

const TRADER_NAMES = ['Konsortium-Späher', 'Handelsläufer', 'Frachtkundschafter', 'Routenfinder'];
const TOURIST_NAMES = ['Sternenpilger', 'Fernreisender', 'Panorama-Yacht', 'Horizont-Tourist'];

/** Deterministic plan for `count` explorer ships: a 50/50 trader/tourist mix,
 *  launched from civilized space near origin (they roam outward from there). */
export function buildExplorerSpawnPlan(count: number): ExplorerSpawn[] {
  const plan: ExplorerSpawn[] = [];
  for (let i = 0; i < count; i++) {
    const isTrader = i % 2 === 0;
    const faction = isTrader ? 'consortium' : 'tourist_guild';
    const names = isTrader ? TRADER_NAMES : TOURIST_NAMES;
    const h = (i * 2654435761 + 0x9e3779b9) >>> 0;
    const x = (h % 1001) - 500;
    const y = ((h >>> 11) % 1001) - 500;
    plan.push({
      faction, ship_type: 'explorer', role: 'explorer',
      x, y, home_x: x, home_y: y,
      name: `${names[h % names.length]} ${(h % 900) + 100}`,
    });
  }
  return plan;
}

/** Idempotently top up the explorer fleet to EXPLORER_TARGET. Safe to call every
 *  strategic tick once the aliens are awake. */
export async function ensureExplorerFleet(): Promise<void> {
  const alive = await civQueries.countAliveExplorers();
  if (alive >= EXPLORER_TARGET) return;
  const plan = buildExplorerSpawnPlan(EXPLORER_TARGET - alive);
  for (const s of plan) {
    await spawnNpcShip({
      faction: s.faction, ship_type: s.ship_type, role: s.role,
      x: s.x, y: s.y, home_x: s.home_x, home_y: s.home_y,
      level: 1, name: s.name, patrol_state: {},
    });
  }
  logger.info({ spawned: plan.length, target: EXPLORER_TARGET }, 'Explorer fleet topped up');
}
