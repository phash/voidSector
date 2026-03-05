import type { KontorOrder } from '../db/kontorQueries.js';
import {
  createKontorOrder,
  getKontorOrderById,
  getKontorOrdersBySector,
  getPlayerKontorOrders,
  updateKontorOrderFilled,
  deactivateKontorOrder,
} from '../db/kontorQueries.js';
import { getPlayerCredits, deductCredits, addCredits, deductCargo } from '../db/queries.js';

export async function placeKontorOrder(
  ownerId: string,
  sectorX: number,
  sectorY: number,
  itemType: string,
  amount: number,
  pricePerUnit: number,
): Promise<{ success: boolean; order?: KontorOrder; error?: string }> {
  if (amount <= 0 || !Number.isInteger(amount)) {
    return { success: false, error: 'Invalid amount' };
  }
  if (pricePerUnit <= 0 || !Number.isInteger(pricePerUnit)) {
    return { success: false, error: 'Invalid price' };
  }

  const budget = amount * pricePerUnit;
  const credits = await getPlayerCredits(ownerId);
  if (credits < budget) {
    return { success: false, error: 'Insufficient credits' };
  }

  const deducted = await deductCredits(ownerId, budget);
  if (!deducted) {
    return { success: false, error: 'Insufficient credits' };
  }

  const order = await createKontorOrder({
    ownerId,
    sectorX,
    sectorY,
    itemType,
    amountWanted: amount,
    pricePerUnit,
    budgetReserved: budget,
    expiresAt: null,
  });

  return { success: true, order };
}

export async function cancelKontorOrder(
  orderId: string,
  ownerId: string,
): Promise<{ success: boolean; refunded: number; error?: string }> {
  const order = await getKontorOrderById(orderId);
  if (!order) {
    return { success: false, refunded: 0, error: 'Order not found' };
  }
  if (order.ownerId !== ownerId) {
    return { success: false, refunded: 0, error: 'Not your order' };
  }
  if (!order.active) {
    return { success: false, refunded: 0, error: 'Order already inactive' };
  }

  const remaining = order.amountWanted - order.amountFilled;
  const refund = remaining * order.pricePerUnit;

  if (refund > 0) {
    await addCredits(ownerId, refund);
  }
  await deactivateKontorOrder(orderId);

  return { success: true, refunded: refund };
}

export async function fillKontorOrder(
  orderId: string,
  sellerId: string,
  amount: number,
): Promise<{ success: boolean; earned: number; error?: string }> {
  if (amount <= 0 || !Number.isInteger(amount)) {
    return { success: false, earned: 0, error: 'Invalid amount' };
  }

  const order = await getKontorOrderById(orderId);
  if (!order) {
    return { success: false, earned: 0, error: 'Order not found' };
  }
  if (!order.active) {
    return { success: false, earned: 0, error: 'Order is not active' };
  }
  if (order.ownerId === sellerId) {
    return { success: false, earned: 0, error: 'Cannot fill own order' };
  }

  const remaining = order.amountWanted - order.amountFilled;
  if (remaining <= 0) {
    return { success: false, earned: 0, error: 'Order already fully filled' };
  }

  const fillAmount = Math.min(amount, remaining);

  const cargoDeducted = await deductCargo(sellerId, order.itemType, fillAmount);
  if (!cargoDeducted) {
    return { success: false, earned: 0, error: 'Insufficient cargo' };
  }

  const earned = fillAmount * order.pricePerUnit;
  await addCredits(sellerId, earned);
  await updateKontorOrderFilled(orderId, fillAmount);

  if (fillAmount >= remaining) {
    await deactivateKontorOrder(orderId);
  }

  return { success: true, earned };
}

export async function getKontorOrders(sectorX: number, sectorY: number): Promise<KontorOrder[]> {
  return getKontorOrdersBySector(sectorX, sectorY);
}

export async function getPlayerOrders(ownerId: string): Promise<KontorOrder[]> {
  return getPlayerKontorOrders(ownerId);
}
