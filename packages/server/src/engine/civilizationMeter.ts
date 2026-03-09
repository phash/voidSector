import { HUMAN_CIVILIZATION_METER_MAX } from '@void-sector/shared';

export interface CivContributionType {
  type: 'station_built' | 'quest_completed' | 'pirate_defeated' | 'territory_explored';
  points: number;
}

export const CIV_CONTRIBUTION_VALUES: Record<CivContributionType['type'], number> = {
  station_built: 50,
  quest_completed: 10,
  pirate_defeated: 5,
  territory_explored: 1,
};

export interface PlayerCivRecord {
  playerId: string;
  totalPoints: number;
  recentContributions: CivContributionType[];
}

/**
 * Calculates the global civilization level (0–100%) from total contributions.
 */
export function getCivLevel(totalContributions: number): number {
  return Math.min(totalContributions / HUMAN_CIVILIZATION_METER_MAX, 1.0);
}

/**
 * Returns a human-readable civilization tier description.
 */
export function getCivTier(totalContributions: number): string {
  const level = getCivLevel(totalContributions);
  if (level >= 0.9) return 'INTERSTELLARE MACHT';
  if (level >= 0.7) return 'GALAKTISCHE ZIVILISATION';
  if (level >= 0.5) return 'WELTRAUMFAHRENDE ZIVILISATION';
  if (level >= 0.3) return 'FRÜHE EXPANSION';
  if (level >= 0.1) return 'ERSTKONTAKT-PHASE';
  return 'PIONIERPHASE';
}

/**
 * Calculates contribution points for a player action.
 */
export function calculateContributionPoints(actionType: CivContributionType['type']): number {
  return CIV_CONTRIBUTION_VALUES[actionType] ?? 0;
}

/**
 * Adds a player contribution to the civilization meter.
 * Returns the new total contribution amount.
 */
export function addCivContribution(
  currentTotal: number,
  actionType: CivContributionType['type'],
): number {
  return currentTotal + calculateContributionPoints(actionType);
}
