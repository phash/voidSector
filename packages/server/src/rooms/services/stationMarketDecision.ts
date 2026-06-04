import {
  NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD, MARKT_SPREAD_PER_LEVEL,
  stationCargoCapacity, type MineableResourceType,
} from '@void-sector/shared';

export interface MarketStation {
  markt_level: number;
  cargo_level: number;
  cargo_contents: Record<string, number>;
}

export interface MarketRequest {
  action: 'buy' | 'sell';
  resource: MineableResourceType;
  amount: number;
}

export type MarketDecision =
  | {
      ok: true;
      creditsToPlayer: number;
      creditsFromPlayer: number;
      volume: number;
      newStationContents: Record<string, number>;
      resourceToPlayer: number;
      resourceFromPlayer: number;
    }
  | { ok: false; code: 'NO_MARKET' | 'STATION_FULL' | 'STATION_EMPTY' | 'INSUFFICIENT' | 'INVALID'; message: string };

/** Trade volume contribution = traded units × base price (independent of spread). */
export function tradeVolumeDelta(resource: MineableResourceType, amount: number): number {
  return Math.round(amount * NPC_PRICES[resource]);
}

export function resolveMarketTrade(
  station: MarketStation,
  req: MarketRequest,
  player: { cargoAmount?: number; credits?: number },
): MarketDecision {
  if (station.markt_level < 1) return { ok: false, code: 'NO_MARKET', message: 'Kein Markt gebaut' };
  if (req.amount <= 0) return { ok: false, code: 'INVALID', message: 'Ungültige Menge' };

  const base = NPC_PRICES[req.resource];
  const levelBonus = MARKT_SPREAD_PER_LEVEL * station.markt_level;
  const sellPrice = base * (NPC_SELL_SPREAD + levelBonus);
  const buyPrice = base * Math.max(1, NPC_BUY_SPREAD - levelBonus);
  const safeSellPrice = Math.min(sellPrice, buyPrice);
  const cap = stationCargoCapacity(station.cargo_level);
  const have = station.cargo_contents[req.resource] ?? 0;
  const contents = { ...station.cargo_contents };

  if (req.action === 'sell') {
    const playerHas = player.cargoAmount ?? 0;
    if (playerHas < req.amount) return { ok: false, code: 'INSUFFICIENT', message: 'Nicht genug im Schiff' };
    if (have + req.amount > cap) return { ok: false, code: 'STATION_FULL', message: 'Stationslager voll' };
    contents[req.resource] = have + req.amount;
    return {
      ok: true,
      creditsToPlayer: Math.round(safeSellPrice * req.amount),
      creditsFromPlayer: 0,
      volume: tradeVolumeDelta(req.resource, req.amount),
      newStationContents: contents,
      resourceToPlayer: 0,
      resourceFromPlayer: req.amount,
    };
  }

  if (have < req.amount) return { ok: false, code: 'STATION_EMPTY', message: 'Station hat zu wenig Bestand' };
  const cost = Math.round(buyPrice * req.amount);
  if ((player.credits ?? 0) < cost) return { ok: false, code: 'INSUFFICIENT', message: 'Nicht genug Credits' };
  contents[req.resource] = have - req.amount;
  return {
    ok: true,
    creditsToPlayer: 0,
    creditsFromPlayer: cost,
    volume: tradeVolumeDelta(req.resource, req.amount),
    newStationContents: contents,
    resourceToPlayer: req.amount,
    resourceFromPlayer: 0,
  };
}
