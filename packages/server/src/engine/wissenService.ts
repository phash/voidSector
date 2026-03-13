import type { Client } from 'colyseus';
import { LAB_WISSEN_MULTIPLIER } from '@void-sector/shared';
import { addWissen, getResearchLabTier, getWissen } from '../db/queries.js';

/**
 * Award Wissen for a gameplay action, applying lab multiplier.
 */
export async function awardWissen(playerId: string, baseAmount: number): Promise<void> {
  if (baseAmount <= 0) return;
  const labTier = await getResearchLabTier(playerId);
  const multiplier = LAB_WISSEN_MULTIPLIER[labTier] ?? 1.0;
  const gain = Math.floor(baseAmount * multiplier);
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
