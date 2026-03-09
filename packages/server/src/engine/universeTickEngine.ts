import {
  UNIVERSE_TICK_MS,
  FACTION_EXPANSION_INTERVAL_TICKS,
  COSMIC_FACTION_IDS,
  HUMAN_STARTING_TERRITORY,
  ALIEN_STARTING_REGIONS,
  HUMAN_CIVILIZATION_METER_MAX,
} from '@void-sector/shared';
import type { CosmicFactionId } from '@void-sector/shared';

export interface TickState {
  tickCount: number;
  lastTickAt: number;
  isRunning: boolean;
}

export interface TerritoryState {
  // quadrantKey -> factionId
  dominantFactions: Map<string, CosmicFactionId | null>;
  // factionId -> set of quadrant keys they influence
  factionQuadrants: Map<CosmicFactionId, Set<string>>;
}

/** Compute quadrant key from coordinates */
export function quadrantKey(qx: number, qy: number): string {
  return `${qx}:${qy}`;
}

/**
 * Initialize territory state from the faction starting positions.
 * Returns a map of quadrantKey -> dominant faction.
 */
export function initializeTerritoryState(): TerritoryState {
  const dominantFactions = new Map<string, CosmicFactionId | null>();
  const factionQuadrants = new Map<CosmicFactionId, Set<string>>();

  for (const factionId of COSMIC_FACTION_IDS) {
    factionQuadrants.set(factionId, new Set());
  }

  // Seed human territory
  for (const [qx, qy] of HUMAN_STARTING_TERRITORY) {
    const key = quadrantKey(qx, qy);
    dominantFactions.set(key, 'humans');
    factionQuadrants.get('humans')!.add(key);
  }

  // Seed alien territories
  for (const [factionId, regions] of Object.entries(ALIEN_STARTING_REGIONS) as [CosmicFactionId, { qx: number; qy: number; radius: number }[]][]) {
    if (factionId === 'humans') continue;
    for (const region of regions) {
      for (let dx = -region.radius; dx <= region.radius; dx++) {
        for (let dy = -region.radius; dy <= region.radius; dy++) {
          const key = quadrantKey(region.qx + dx, region.qy + dy);
          if (!dominantFactions.has(key)) {
            dominantFactions.set(key, factionId);
            factionQuadrants.get(factionId)!.add(key);
          }
        }
      }
    }
  }

  return { dominantFactions, factionQuadrants };
}

/**
 * Attempt to expand a faction into adjacent unclaimed quadrants.
 * Expansion chance is proportional to faction's current territory size.
 * Returns the newly claimed quadrant keys.
 */
export function expandFaction(
  factionId: CosmicFactionId,
  territory: TerritoryState,
  rng: () => number,
): string[] {
  const factionQuads = territory.factionQuadrants.get(factionId);
  if (!factionQuads || factionQuads.size === 0) return [];

  const claimed: string[] = [];
  // Try to expand from a random owned quadrant
  const ownedArray = Array.from(factionQuads);
  const pivotKey = ownedArray[Math.floor(rng() * ownedArray.length)];
  const [qx, qy] = pivotKey.split(':').map(Number);

  const neighbors = [
    [qx + 1, qy],
    [qx - 1, qy],
    [qx, qy + 1],
    [qx, qy - 1],
  ];

  for (const [nx, ny] of neighbors) {
    if (nx < 0 || ny < 0 || nx > 9999 || ny > 9999) continue;
    const nKey = quadrantKey(nx, ny);
    if (!territory.dominantFactions.has(nKey) && rng() < 0.3) {
      territory.dominantFactions.set(nKey, factionId);
      factionQuads.add(nKey);
      claimed.push(nKey);
    }
  }

  return claimed;
}

/**
 * Run one universe tick. Returns summary of what changed.
 */
export interface TickResult {
  tickCount: number;
  expansionHappened: boolean;
  newTerritories: string[];
  civMeterDelta: number;
}

export function runUniverseTick(
  state: TickState,
  territory: TerritoryState,
  civContributions: number, // player contributions since last tick
  rng: () => number,
): TickResult {
  state.tickCount++;
  state.lastTickAt = Date.now();

  let expansionHappened = false;
  const newTerritories: string[] = [];

  // Expansion only happens every FACTION_EXPANSION_INTERVAL_TICKS ticks
  if (state.tickCount % FACTION_EXPANSION_INTERVAL_TICKS === 0) {
    // All non-human factions attempt expansion
    for (const factionId of COSMIC_FACTION_IDS) {
      if (factionId === 'humans') continue; // humans expand via player activity
      const claimed = expandFaction(factionId, territory, rng);
      if (claimed.length > 0) {
        expansionHappened = true;
        newTerritories.push(...claimed.map(k => `${factionId}:${k}`));
      }
    }
  }

  // Civ meter: clamp to max
  const civMeterDelta = Math.min(civContributions, HUMAN_CIVILIZATION_METER_MAX);

  return {
    tickCount: state.tickCount,
    expansionHappened,
    newTerritories,
    civMeterDelta,
  };
}

/**
 * Universe Tick Engine — manages the tick loop for the living universe.
 * Call start() to begin, stop() to halt.
 */
export class UniverseTickEngine {
  private state: TickState = {
    tickCount: 0,
    lastTickAt: 0,
    isRunning: false,
  };
  private territory: TerritoryState = initializeTerritoryState();
  private timer: ReturnType<typeof setInterval> | null = null;
  private onTick: ((result: TickResult) => void) | null = null;

  constructor(onTickCallback?: (result: TickResult) => void) {
    this.onTick = onTickCallback ?? null;
  }

  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.timer = setInterval(() => {
      const result = runUniverseTick(this.state, this.territory, 0, Math.random);
      this.onTick?.(result);
    }, UNIVERSE_TICK_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.isRunning = false;
  }

  getState(): Readonly<TickState> {
    return this.state;
  }

  getTerritory(): Readonly<TerritoryState> {
    return this.territory;
  }

  /** Returns the dominant faction for a quadrant, or null if unclaimed */
  getDominantFaction(qx: number, qy: number): CosmicFactionId | null {
    return this.territory.dominantFactions.get(quadrantKey(qx, qy)) ?? null;
  }

  /** Returns total number of quadrants controlled by each faction */
  getFactionStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const factionId of COSMIC_FACTION_IDS) {
      stats[factionId] = this.territory.factionQuadrants.get(factionId)?.size ?? 0;
    }
    return stats;
  }
}
