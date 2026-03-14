// packages/server/src/engine/conquestEngine.ts
import { CONQUEST_RATE, CONQUEST_POOL_DRAIN_PER_TICK } from '@void-sector/shared';
import { sectorToQuadrant } from './quadrantEngine.js';
import { civQueries } from '../db/civQueries.js';
import { getQuadrantControl, upsertQuadrantControl, getAllQuadrantControls } from '../db/queries.js';
import type { QuadrantControlRow } from '../db/queries.js';
import { logger } from '../utils/logger.js';

const NEIGHBOR_MIN_SHARE = 60; // faction must hold >= 60% in at least one adjacent quadrant

// --- Pure functions (exported for testing) ---

export function computeConquestRate(level: number, pool: number): number {
  const config = CONQUEST_RATE[level] ?? CONQUEST_RATE[1];
  return pool > 0 ? config.boosted : config.base;
}

export function computeFrictionModifier(frictionScore: number, otherFactionPresent: boolean): number {
  if (!otherFactionPresent) return 1.0;
  if (frictionScore <= 20) return 0;
  if (frictionScore <= 50) return 0.5;
  if (frictionScore <= 80) return 0.25;
  return 0; // ENEMY -> mode becomes 'battle'
}

export function updateShares(
  currentShares: Record<string, number>,
  faction: string,
  gain: number,
): { shares: Record<string, number>; controllingFaction: string } {
  const shares = { ...currentShares };
  const current = shares[faction] ?? 0;
  const newValue = Math.min(100, current + gain);
  const actualGain = newValue - current;

  // Reduce others proportionally
  const others = Object.keys(shares).filter((f) => f !== faction);
  const othersTotal = others.reduce((sum, f) => sum + (shares[f] ?? 0), 0);
  if (othersTotal > 0 && actualGain > 0) {
    for (const f of others) {
      const reduction = ((shares[f] ?? 0) / othersTotal) * actualGain;
      const newOther = (shares[f] ?? 0) - reduction;
      if (newOther < 0.5) {
        delete shares[f];
      } else {
        shares[f] = newOther;
      }
    }
  }

  shares[faction] = newValue;

  // Determine controlling faction (highest share)
  let controllingFaction = faction;
  let maxShare = newValue;
  for (const [f, s] of Object.entries(shares)) {
    if (s > maxShare) {
      maxShare = s;
      controllingFaction = f;
    }
  }

  return { shares, controllingFaction };
}

/**
 * Check if faction has >= threshold% control in any of the 8 adjacent quadrants.
 * Pure function — takes the full controls list to avoid DB calls per station.
 */
export function hasAdjacentFactionControl(
  qx: number, qy: number, faction: string,
  allControls: QuadrantControlRow[], threshold: number = NEIGHBOR_MIN_SHARE,
): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const ctrl = allControls.find(c => c.qx === qx + dx && c.qy === qy + dy);
      if (ctrl) {
        const share = (ctrl.faction_shares as Record<string, number>)?.[faction] ?? 0;
        if (share >= threshold) return true;
      }
    }
  }
  return false;
}

// --- Engine class ---

export class ConquestEngine {
  async tick(): Promise<void> {
    let stations;
    let allControls: QuadrantControlRow[];
    try {
      [stations, allControls] = await Promise.all([
        civQueries.getConquestStations(),
        getAllQuadrantControls(),
      ]);
    } catch (err) {
      logger.error({ err }, 'ConquestEngine: failed to load stations/controls');
      return;
    }

    for (const station of stations) {
      try {
        await this.processStation(station, allControls);
      } catch (err) {
        logger.error({ err, stationId: station.id }, 'ConquestEngine: error processing station');
      }
    }
  }

  private async processStation(
    station: { id: number; sector_x: number; sector_y: number; faction: string; mode: string; conquest_pool: number; level: number },
    allControls: QuadrantControlRow[],
  ): Promise<void> {
    const { qx, qy } = sectorToQuadrant(station.sector_x, station.sector_y);

    // Expansion requires adjacent quadrant with >= 60% faction control
    if (!hasAdjacentFactionControl(qx, qy, station.faction, allControls)) {
      // No friendly neighbor — can't expand, stay in conquest mode but skip tick
      await civQueries.updateStationMode(station.id, 'conquest');
      return;
    }

    // Get or create quadrant control row
    let qc = await getQuadrantControl(qx, qy);
    if (!qc) {
      await upsertQuadrantControl({
        qx, qy,
        controlling_faction: station.faction,
        faction_shares: { [station.faction]: 0 },
        attack_value: 0,
        defense_value: 0,
        friction_score: 0,
        station_tier: station.level,
      });
      qc = await getQuadrantControl(qx, qy);
      if (!qc) return;
    }

    const shares = qc.faction_shares as Record<string, number>;
    const ownShare = shares[station.faction] ?? 0;
    const otherFactionPresent = Object.keys(shares).some(
      (f) => f !== station.faction && (shares[f] ?? 0) > 0,
    );
    const frictionScore = qc.friction_score ?? 0;

    // Determine new mode
    let newMode: 'conquest' | 'factory' | 'battle';
    if (ownShare >= 100) {
      newMode = 'factory';
    } else if (otherFactionPresent && frictionScore > 80) {
      newMode = 'battle';
    } else {
      newMode = 'conquest';
    }

    await civQueries.updateStationMode(station.id, newMode);
    if (newMode !== 'conquest') return;

    // Apply conquest
    const frictionMod = computeFrictionModifier(frictionScore, otherFactionPresent);
    if (frictionMod === 0) return;

    const rate = computeConquestRate(station.level, station.conquest_pool);
    const effectiveGain = rate * frictionMod;

    const { shares: newShares, controllingFaction } = updateShares(shares, station.faction, effectiveGain);

    await upsertQuadrantControl({
      qx, qy,
      controlling_faction: controllingFaction,
      faction_shares: newShares,
      attack_value: qc.attack_value,
      defense_value: qc.defense_value,
      friction_score: qc.friction_score,
      station_tier: Math.max(qc.station_tier, station.level),
    });

    await civQueries.drainConquestPool(station.id, CONQUEST_POOL_DRAIN_PER_TICK);

    logger.debug(
      { stationId: station.id, faction: station.faction, qx, qy, gain: effectiveGain },
      'ConquestEngine: tick applied',
    );
  }
}
