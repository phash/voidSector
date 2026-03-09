import type { SectorEnvironment } from '@void-sector/shared';

export type NpcFactionId = 'traders' | 'scientists' | 'pirates' | 'ancients';

/**
 * NPC faction preference weights per environment type.
 * Higher weight = more likely to spawn/be present in that environment.
 */
export const NPC_FACTION_ENVIRONMENT_WEIGHTS: Record<NpcFactionId, Partial<Record<SectorEnvironment, number>>> = {
  traders: {
    empty: 0.40,
    planet: 0.30,
    asteroid: 0.20,
    nebula: 0.10,
    star: 0,
    black_hole: 0,
  },
  scientists: {
    planet: 0.35,
    nebula: 0.30,
    asteroid: 0.20,
    empty: 0.15,
    star: 0,
    black_hole: 0,
  },
  pirates: {
    black_hole: 0.40,
    star: 0.30,
    empty: 0.20,
    asteroid: 0.10,
    nebula: 0,
    planet: 0,
  },
  ancients: {
    nebula: 0.50,
    planet: 0.25,
    black_hole: 0.15,
    asteroid: 0.10,
    empty: 0,
    star: 0,
  },
};

/**
 * Returns the preference weight for a faction in a given environment.
 * Returns 0 for environments the faction doesn't frequent.
 */
export function getFactionEnvironmentWeight(
  faction: NpcFactionId,
  environment: SectorEnvironment,
): number {
  return NPC_FACTION_ENVIRONMENT_WEIGHTS[faction][environment] ?? 0;
}

/**
 * Returns the most preferred environment for a given NPC faction.
 */
export function getPreferredEnvironment(faction: NpcFactionId): SectorEnvironment {
  const weights = NPC_FACTION_ENVIRONMENT_WEIGHTS[faction];
  let best: SectorEnvironment = 'empty';
  let bestWeight = 0;
  for (const [env, weight] of Object.entries(weights) as [SectorEnvironment, number][]) {
    if ((weight ?? 0) > bestWeight) {
      bestWeight = weight ?? 0;
      best = env;
    }
  }
  return best;
}

/**
 * Determines which NPC factions might be present in a sector based on environment.
 * Returns factions whose weight in that environment is > 0.
 */
export function getEligibleFactions(environment: SectorEnvironment): NpcFactionId[] {
  const eligible: NpcFactionId[] = [];
  for (const [faction, weights] of Object.entries(NPC_FACTION_ENVIRONMENT_WEIGHTS) as [NpcFactionId, Partial<Record<SectorEnvironment, number>>][]) {
    if ((weights[environment] ?? 0) > 0) {
      eligible.push(faction);
    }
  }
  return eligible;
}

/**
 * Returns a spawn probability modifier for a faction based on its environment preference.
 * Used to modulate quest generation and NPC station presence.
 * Values above 1.0 = more likely, below 1.0 = less likely.
 */
export function getFactionSpawnModifier(
  faction: NpcFactionId,
  environment: SectorEnvironment,
): number {
  const weight = getFactionEnvironmentWeight(faction, environment);
  // Normalize: max weight of any faction in any env is 0.5 (ancients in nebula)
  // Modifier range: 0.0 to 2.0
  return weight * 4.0;
}
