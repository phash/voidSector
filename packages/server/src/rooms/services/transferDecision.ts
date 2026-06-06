/** Pure decision for ship-inventory ↔ personal storage ("bank") transfers. */

export type TransferDirection = 'toStorage' | 'fromStorage';

const VALID_RESOURCES = ['ore', 'gas', 'crystal', 'artefact'];

export type TransferDecision =
  | { ok: true }
  | { ok: false; code: 'INVALID' | 'INSUFFICIENT' | 'CARGO_FULL'; message: string };

/**
 * Decide whether a transfer is allowed.
 * - toStorage: ship must hold >= amount of the resource (storage is uncapped).
 * - fromStorage: storage must hold >= amount AND the ship must have cargo space.
 */
export function resolveTransfer(
  direction: TransferDirection,
  resource: string,
  amount: number,
  shipAmount: number,
  storageAmount: number,
  shipHasSpaceForAmount: boolean,
): TransferDecision {
  if (!VALID_RESOURCES.includes(resource)) {
    return { ok: false, code: 'INVALID', message: 'Ungültige Ressource' };
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, code: 'INVALID', message: 'Ungültige Menge' };
  }
  if (direction === 'toStorage') {
    if (shipAmount < amount) return { ok: false, code: 'INSUFFICIENT', message: 'Nicht genug im Schiff' };
    return { ok: true };
  }
  if (storageAmount < amount) return { ok: false, code: 'INSUFFICIENT', message: 'Nicht genug im Lager' };
  if (!shipHasSpaceForAmount) return { ok: false, code: 'CARGO_FULL', message: 'Nicht genug Frachtraum' };
  return { ok: true };
}
