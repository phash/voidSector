import {
  getNpcZone,
  NPC_SPAWN_COUNTS,
  NPC_MILITARY_LEVELS,
  NPC_OUTLAW_LEVEL_RANGE,
  NPC_OUTLAW_ROAM_RADIUS,
  QUADRANT_SIZE,
} from '@void-sector/shared';
import { generateNpcName } from './npcNamegen.js';
import * as civQueries from '../db/civQueries.js';

export function calculateSpawnNeeds(
  qx: number,
  qy: number,
  current: { trader: number; military: number; outlaw: number },
): { trader: number; military: number; outlaw: number } {
  const zone = getNpcZone(qx, qy);
  const target = NPC_SPAWN_COUNTS[zone];
  return {
    trader: Math.max(0, target.trader - current.trader),
    military: Math.max(0, target.military - current.military),
    outlaw: Math.max(0, target.outlaw - current.outlaw),
  };
}

export async function ensureQuadrantNpcs(qx: number, qy: number): Promise<void> {
  const [traders, military, outlaws] = await Promise.all([
    civQueries.getAliveNpcsByRole(qx, qy, QUADRANT_SIZE, 'trader'),
    civQueries.getAliveNpcsByRole(qx, qy, QUADRANT_SIZE, 'military'),
    civQueries.getAliveNpcsByRole(qx, qy, QUADRANT_SIZE, 'outlaw'),
  ]);

  const needs = calculateSpawnNeeds(qx, qy, {
    trader: traders.length,
    military: military.length,
    outlaw: outlaws.length,
  });

  const zone = getNpcZone(qx, qy);
  const baseX = qx * QUADRANT_SIZE;
  const baseY = qy * QUADRANT_SIZE;
  const half = Math.floor(QUADRANT_SIZE / 2);

  for (let i = 0; i < needs.trader; i++) {
    const seed = (qx * 1000 + qy) * 100 + i;
    const x = baseX + (Math.abs(seed) % QUADRANT_SIZE);
    const y = baseY + (Math.abs(seed >> 8) % QUADRANT_SIZE);
    await civQueries.spawnNpcShip({
      faction: 'humans',
      ship_type: 'combat',
      role: 'trader',
      x,
      y,
      home_x: x,
      home_y: y,
      level: 1,
      name: generateNpcName('trader', seed),
    });
  }

  const milLevel = NPC_MILITARY_LEVELS[zone];
  for (let i = 0; i < needs.military; i++) {
    const seed = (qx * 1000 + qy) * 200 + i;
    const x = baseX + half;
    const y = baseY + half;
    const borderX = baseX;
    const borderY = baseY + (Math.abs(seed) % QUADRANT_SIZE);
    await civQueries.spawnNpcShip({
      faction: 'humans',
      ship_type: 'combat',
      role: 'military',
      x,
      y,
      home_x: x,
      home_y: y,
      level: milLevel,
      name: generateNpcName('military', seed),
      patrol_state: { leg: 'to_border', borderX, borderY, stepsLeft: 50, direction: 'h' },
    });
  }

  const [minLvl, maxLvl] = NPC_OUTLAW_LEVEL_RANGE[zone];
  for (let i = 0; i < needs.outlaw; i++) {
    const seed = (qx * 1000 + qy) * 300 + i;
    const x = baseX + (Math.abs(seed) % QUADRANT_SIZE);
    const y = baseY + (Math.abs(seed >> 4) % QUADRANT_SIZE);
    const level = minLvl + (Math.abs(seed) % (maxLvl - minLvl + 1));
    await civQueries.spawnNpcShip({
      faction: 'humans',
      ship_type: 'combat',
      role: 'outlaw',
      x,
      y,
      home_x: x,
      home_y: y,
      level,
      name: generateNpcName('outlaw', seed),
      patrol_state: { anchorX: x, anchorY: y, roamRadius: NPC_OUTLAW_ROAM_RADIUS, skipTick: 0 },
    });
  }
}
