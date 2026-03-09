import type { ItemType, CargoState } from '@void-sector/shared';
import {
  upsertInventory,
  deductInventory,
  getInventory,
  transferInventoryItem,
  getCargoCapForPlayer,
} from '../db/queries.js';

export { transferInventoryItem };

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
  return items
    .filter(i => i.itemType === 'resource')
    .reduce((sum, i) => sum + i.quantity, 0);
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
 * Keeps backward compatibility with the shape the client expects:
 * { ore, gas, crystal, slates, artefact }
 */
export async function getCargoState(playerId: string): Promise<CargoState> {
  const items = await getInventory(playerId);
  const cargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 };
  for (const item of items.filter(i => i.itemType === 'resource')) {
    if (item.itemId in cargo) {
      cargo[item.itemId as keyof CargoState] = item.quantity;
    }
  }
  return cargo;
}
