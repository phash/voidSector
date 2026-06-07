// marketOrderService.ts — Global player-to-player market (trade_orders) with escrow.
//
// Escrow model (no schema change): the goods/credits are removed from the owner
// when the order is placed; the order's existence represents what is held.
//   - sell order: the resources are escrowed out of the seller's inventory.
//   - buy  order: amount×price credits are escrowed out of the buyer's account.
// Fulfilling transfers atomically; cancelling refunds the escrow.

import {
  createTradeOrder,
  getTradeOrderById,
  fulfillTradeOrder,
  cancelTradeOrder,
  deductCredits,
  addCredits,
} from '../db/queries.js';
import { getInventoryItem, addToInventory, removeFromInventory } from './inventoryService.js';

const VALID_RESOURCES = ['ore', 'gas', 'crystal', 'artefact'];

export type MarketResult =
  | { success: true; order?: { id: string } }
  | { success: false; error: string };

function validatePlacement(resource: string, amount: number, pricePerUnit: number): string | null {
  if (!VALID_RESOURCES.includes(resource)) return 'Ungültige Ressource';
  if (!Number.isInteger(amount) || amount <= 0) return 'Ungültige Menge';
  if (!Number.isInteger(pricePerUnit) || pricePerUnit <= 0) return 'Ungültiger Preis';
  return null;
}

/** Place a market order, escrowing the goods (sell) or credits (buy). */
export async function placeMarketOrder(
  playerId: string,
  resource: string,
  amount: number,
  pricePerUnit: number,
  type: 'buy' | 'sell',
): Promise<MarketResult> {
  const err = validatePlacement(resource, amount, pricePerUnit);
  if (err) return { success: false, error: err };

  if (type === 'sell') {
    const have = await getInventoryItem(playerId, 'resource', resource);
    if (have < amount) return { success: false, error: 'Nicht genug Ressourcen' };
    await removeFromInventory(playerId, 'resource', resource, amount);
  } else {
    const ok = await deductCredits(playerId, amount * pricePerUnit);
    if (!ok) return { success: false, error: 'Nicht genug Credits' };
  }

  const order = await createTradeOrder(playerId, resource, amount, pricePerUnit, type);
  return { success: true, order };
}

/** Fulfill someone else's order, transferring goods/credits atomically. */
export async function fulfillMarketOrder(
  fulfillerId: string,
  orderId: string,
): Promise<MarketResult> {
  const o = await getTradeOrderById(orderId);
  if (!o || o.fulfilled) return { success: false, error: 'Order nicht verfügbar' };
  if (o.player_id === fulfillerId) return { success: false, error: 'Eigene Order' };

  const total = o.amount * o.price_per_unit;

  // Claim-before-transfer: fulfillTradeOrder is an atomic UPDATE … SET fulfilled=
  // TRUE WHERE id=$1 AND fulfilled=FALSE returning rowCount. Exactly one
  // concurrent request can claim a given order, so the goods/credits can never
  // be transferred twice (closes the double-fulfilment dupe).
  if (o.type === 'sell') {
    // Owner is selling escrowed goods; the fulfiller buys them. Take payment
    // first (atomic), then claim; refund if another request won the claim.
    const paid = await deductCredits(fulfillerId, total);
    if (!paid) return { success: false, error: 'Nicht genug Credits' };
    const claimed = await fulfillTradeOrder(orderId);
    if (!claimed) {
      await addCredits(fulfillerId, total);
      return { success: false, error: 'Order nicht verfügbar' };
    }
    await addCredits(o.player_id, total);
    await addToInventory(fulfillerId, 'resource', o.resource, o.amount);
  } else {
    // Owner is buying (credits escrowed); the fulfiller sells the goods.
    const have = await getInventoryItem(fulfillerId, 'resource', o.resource);
    if (have < o.amount) return { success: false, error: 'Nicht genug Ressourcen' };
    const claimed = await fulfillTradeOrder(orderId);
    if (!claimed) return { success: false, error: 'Order nicht verfügbar' };
    await removeFromInventory(fulfillerId, 'resource', o.resource, o.amount);
    await addToInventory(o.player_id, 'resource', o.resource, o.amount);
    await addCredits(fulfillerId, total);
  }

  return { success: true };
}

/** Cancel your own order and refund the escrow. */
export async function cancelMarketOrder(playerId: string, orderId: string): Promise<MarketResult> {
  const o = await getTradeOrderById(orderId);
  if (!o || o.fulfilled || o.player_id !== playerId) {
    return { success: false, error: 'Order nicht gefunden' };
  }
  // Claim-before-refund: cancelTradeOrder is an atomic DELETE … WHERE id=$1 AND
  // player_id=$2 returning rowCount. Only the request that actually deletes the
  // row refunds, so concurrent cancels cannot double-refund the escrow.
  const cancelled = await cancelTradeOrder(orderId, playerId);
  if (!cancelled) {
    return { success: false, error: 'Order nicht gefunden' };
  }
  if (o.type === 'sell') {
    await addToInventory(playerId, 'resource', o.resource, o.amount);
  } else {
    await addCredits(playerId, o.amount * o.price_per_unit);
  }
  return { success: true };
}
