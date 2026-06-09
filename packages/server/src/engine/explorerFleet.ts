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

const EXPLORER_FLAVORS = [
  { faction: 'consortium',   names: ['Konsortium-Händler', 'Frachtkundschafter', 'Handelsläufer'] },
  { faction: 'tourist_guild', names: ['Sternenpilger', 'Panorama-Yacht', 'Fernreisender'] },
  { faction: 'archivists',   names: ['Archivar-Forscher', 'Daten-Sammler', 'Tiefenscanner'] },
  { faction: 'kthari',       names: ['Kthari-Späher', 'Grenz-Scout', 'Vorhut-Späher'] },
] as const;

/** Deterministic plan for `count` explorer ships: cycles through 4 alien flavors
 *  (trader/tourist/researcher/scout), launched from civilized space near origin. */
export function buildExplorerSpawnPlan(count: number): ExplorerSpawn[] {
  const plan: ExplorerSpawn[] = [];
  for (let i = 0; i < count; i++) {
    const flavor = EXPLORER_FLAVORS[i % 4];
    const h = (i * 2654435761 + 0x9e3779b9) >>> 0;
    const x = (h % 1001) - 500;
    const y = ((h >>> 11) % 1001) - 500;
    plan.push({
      faction: flavor.faction, ship_type: 'explorer', role: 'explorer',
      x, y, home_x: x, home_y: y,
      name: `${flavor.names[h % flavor.names.length]} ${(h % 900) + 100}`,
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
