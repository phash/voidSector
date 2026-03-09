import type { ItemType, CargoState } from '@void-sector/shared';
import {
  upsertInventory,
  deductInventory,
  getInventory,
  getInventoryItem as dbGetInventoryItem,
  transferInventoryItem,
  getCargoCapForPlayer,
  getTypedArtefacts,
} from '../db/queries.js';

export { transferInventoryItem };

/**
 * Returns the quantity of a specific item in the player's unified inventory.
 * Returns 0 if the item does not exist.
 */
export async function getInventoryItem(
  playerId: string,
  itemType: ItemType,
  itemId: string,
): Promise<number> {
  return dbGetInventoryItem(playerId, itemType, itemId);
}

export async function addToInventory(
  playerId: string,
  itemType: ItemType,
  itemId: string,
  quantity: number,
): Promise<void> {
  await upsertInventory(playerId, itemType, itemId, quantity);
}

export async function removeFromInventory(
  playerId: string,
  itemType: ItemType,
  itemId: string,
  quantity: number,
): Promise<void> {
  await deductInventory(playerId, itemType, itemId, quantity);
}

/** Sum of all resource-type quantities (used for cargo cap check). */
export async function getResourceTotal(playerId: string): Promise<number> {
  const items = await getInventory(playerId);
  return items.filter((i) => i.itemType === 'resource').reduce((sum, i) => sum + i.quantity, 0);
}

/** Returns true if adding `amount` resources stays within the player's cargo cap. */
export async function canAddResource(playerId: string, amount: number): Promise<boolean> {
  const [total, cap] = await Promise.all([
    getResourceTotal(playerId),
    getCargoCapForPlayer(playerId),
  ]);
  return total + amount <= cap;
}

/**
 * Returns a CargoState-shaped object from the unified inventory.
 * Keeps backward compatibility with the shape the client expects.
 * Typed artefacts (artefact_drive etc.) are merged from the cargo table.
 */
export async function getCargoState(playerId: string): Promise<CargoState> {
  const [items, typedArtefacts] = await Promise.all([
    getInventory(playerId),
    getTypedArtefacts(playerId),
  ]);
  const cargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 };
  const keyMap: Record<string, keyof CargoState> = { slate: 'slates' };
  for (const item of items.filter((i) => i.itemType === 'resource')) {
    const key = keyMap[item.itemId] ?? item.itemId;
    if (key in cargo) cargo[key as keyof CargoState] = item.quantity;
  }
  // Merge typed artefacts (still stored in legacy cargo table)
  for (const [category, qty] of Object.entries(typedArtefacts)) {
    const key = `artefact_${category}` as keyof CargoState;
    if (qty !== undefined) cargo[key] = qty as never;
  }
  return cargo;
}
