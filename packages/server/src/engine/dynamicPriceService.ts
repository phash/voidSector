import type { SectorEnvironment } from '@void-sector/shared';
import { DENSITY_DISTANCE_THRESHOLD } from '@void-sector/shared';

export type TradeResource = 'ore' | 'gas' | 'crystal' | 'exotic';

/**
 * Base NPC station prices (credits per unit).
 */
export const BASE_PRICES: Record<TradeResource, number> = {
  ore: 10,
  gas: 15,
  crystal: 25,
  exotic: 200,
};

/**
 * Returns a dynamic price for a resource at a station, taking into account:
 * - Distance from origin (remote stations have higher prices)
 * - Environment (nebula = +20% premium)
 * - Player reputation with station faction (-50% to +50%)
 */
export function getDynamicPrice(
  resource: TradeResource,
  sectorX: number,
  sectorY: number,
  environment: SectorEnvironment,
  reputationModifier: number = 0, // -1.0 to +1.0 (hostile to honored)
): number {
  const basePrice = BASE_PRICES[resource];

  // Distance factor: prices increase up to 2× at far distances
  const chebyshev = Math.max(Math.abs(sectorX), Math.abs(sectorY));
  const distanceFactor = 1.0 + Math.min(chebyshev / DENSITY_DISTANCE_THRESHOLD, 1.0);

  // Environment factor
  const nebulaPremium = environment === 'nebula' ? 1.2 : 1.0;

  // Reputation modifier: honored players get up to 50% discount, hostile get 50% markup
  const repFactor = 1.0 - reputationModifier * 0.5;

  return Math.round(basePrice * distanceFactor * nebulaPremium * repFactor);
}

/**
 * Returns sell price (what NPC pays player) — always less than buy price.
 * Sell price is 60% of buy price by default.
 */
export function getDynamicSellPrice(
  resource: TradeResource,
  sectorX: number,
  sectorY: number,
  environment: SectorEnvironment,
  reputationModifier: number = 0,
): number {
  const buyPrice = getDynamicPrice(resource, sectorX, sectorY, environment, reputationModifier);
  return Math.round(buyPrice * 0.6);
}

/**
 * Returns a price volatility description based on environment.
 */
export function getPriceVolatilityLabel(environment: SectorEnvironment): string {
  switch (environment) {
    case 'nebula':
      return 'HIGH'; // Nebula: reduced trade networks, high prices
    case 'star':
    case 'black_hole':
      return 'N/A'; // No trading
    case 'planet':
      return 'LOW'; // Planet: stable supply
    case 'asteroid':
      return 'MEDIUM';
    default:
      return 'NORMAL';
  }
}
