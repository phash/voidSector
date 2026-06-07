import {
  NPC_PRICES, NPC_SELL_SPREAD, MARKT_SPREAD_PER_LEVEL,
  stationCargoCapacity, type MineableResourceType,
} from '@void-sector/shared';
import { getConfig } from './gameConfigApply.js';

export interface DeliveryStation {
  markt_level: number;
  cargo_level: number;
  cargo_contents: Record<string, number>;
}

export type MiningDelivery =
  | { mode: 'sell'; credits: number; volume: number; newCargo: Record<string, number> }
  | { mode: 'store'; credits: number; volume: number; newCargo: Record<string, number> };

/**
 * Decide what happens to a station mining ship's haul on delivery.
 * With a Markt: auto-sell for credits (+ trade volume). Without: store in the
 * station's capped cargo, dropping any overflow.
 */
export function resolveMiningDelivery(
  station: DeliveryStation,
  resource: MineableResourceType,
  amount: number,
): MiningDelivery {
  const base = NPC_PRICES[resource];
  if (station.markt_level >= 1) {
    const unit = base * (((getConfig('NPC_SELL_SPREAD') as typeof NPC_SELL_SPREAD) ?? NPC_SELL_SPREAD) + MARKT_SPREAD_PER_LEVEL * station.markt_level);
    return {
      mode: 'sell',
      credits: Math.round(unit * amount),
      volume: Math.round(base * amount),
      newCargo: station.cargo_contents,
    };
  }
  const cap = stationCargoCapacity(station.cargo_level);
  const have = station.cargo_contents[resource] ?? 0;
  const stored = Math.max(0, Math.min(amount, cap - have));
  return {
    mode: 'store',
    credits: 0,
    volume: 0,
    newCargo: { ...station.cargo_contents, [resource]: have + stored },
  };
}
