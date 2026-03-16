import type { Client } from 'colyseus';
import { addWissen, getWissen } from '../db/queries.js';

/**
 * Award Wissen for a gameplay action. Multiplier is always 1.0 (lab system removed).
 */
export async function awardWissen(playerId: string, baseAmount: number): Promise<void> {
  if (baseAmount <= 0) return;
  const gain = Math.floor(baseAmount);
  if (gain > 0) {
    await addWissen(playerId, gain);
  }
}

/**
 * Award Wissen and immediately push `wissenUpdate` to the client so the
 * ACEP path-buttons enable without requiring a room rejoin.
 */
export function awardWissenAndNotify(
  client: Client,
  playerId: string,
  baseAmount: number,
): void {
  awardWissen(playerId, baseAmount)
    .then(() => getWissen(playerId))
    .then((wissen) => client.send('wissenUpdate', { wissen }))
    .catch(() => {});
}
