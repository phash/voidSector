/**
 * TerritoryService — handles quadrant territory claims and defense.
 *
 * Mechanics:
 *   claimTerritory  — player claims an unclaimed quadrant (costs 20 ore + 10 crystal)
 *   getTerritory    — check who holds a quadrant
 *   defendTerritory — attacker challenges a territory; initiates combat; on win: steal claim or grant KAMPF-XP
 *   listMyTerritories — list all territories owned by the player
 *
 * K'thari integration: quadrants in the K'thari home range have defense_rating = 'HIGH'
 * ACEP: successful territory defense awards 5 KAMPF-XP to the defender
 */

import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';

import {
  getTerritoryClaim,
  createTerritoryClaim,
  deleteTerritoryClaim,
  incrementTerritoryVictories,
  getPlayerTerritories,
  getPlayerCargo,
  deductCargo,
} from '../../db/queries.js';
import { addAcepXpForPlayer } from '../../engine/acepXpService.js';
import { rejectGuest } from './utils.js';

// K'thari home quadrant range (far from origin — high distance from 0,0)
const KTHARI_MIN_CHEBYSHEV = 800;

function isKthariTerritory(quadrantX: number, quadrantY: number): boolean {
  const chebyshev = Math.max(Math.abs(quadrantX), Math.abs(quadrantY));
  return chebyshev >= KTHARI_MIN_CHEBYSHEV;
}

// Cost to claim a territory (ore + crystal from cargo)
const CLAIM_COST_ORE = 20;
const CLAIM_COST_CRYSTAL = 10;

export class TerritoryService {
  constructor(private ctx: ServiceContext) {}

  async handleClaimTerritory(client: Client): Promise<void> {
    if (rejectGuest(client, 'claimTerritory')) return;
    const auth = client.auth as AuthPayload;

    const qx = this.ctx.quadrantX;
    const qy = this.ctx.quadrantY;

    // Check if already claimed
    const existing = await getTerritoryClaim(qx, qy);
    if (existing) {
      if (existing.player_id === auth.userId) {
        client.send('territoryResult', {
          success: false,
          message: 'Du besitzt diesen Quadranten bereits.',
          claim: existing,
        });
      } else {
        client.send('territoryResult', {
          success: false,
          message: `Dieser Quadrant gehört bereits ${existing.player_name}. Fordere ihn heraus!`,
          claim: existing,
        });
      }
      return;
    }

    // Check cargo cost
    const cargo = await getPlayerCargo(auth.userId);
    const oreItem = cargo.find((c) => c.resource_type === 'ore');
    const crystalItem = cargo.find((c) => c.resource_type === 'crystal');
    const oreCount = oreItem?.quantity ?? 0;
    const crystalCount = crystalItem?.quantity ?? 0;

    if (oreCount < CLAIM_COST_ORE || crystalCount < CLAIM_COST_CRYSTAL) {
      client.send('territoryResult', {
        success: false,
        message: `Zu wenige Ressourcen. Benötigt: ${CLAIM_COST_ORE} Erz + ${CLAIM_COST_CRYSTAL} Kristall.`,
      });
      return;
    }

    // Deduct cargo
    await deductCargo(auth.userId, 'ore', CLAIM_COST_ORE);
    await deductCargo(auth.userId, 'crystal', CLAIM_COST_CRYSTAL);

    // Determine defense rating
    const defenseRating = isKthariTerritory(qx, qy) ? 'HIGH' : 'LOW';

    await createTerritoryClaim(auth.userId, auth.username ?? auth.userId, qx, qy, defenseRating);

    const claim = await getTerritoryClaim(qx, qy);
    client.send('territoryResult', {
      success: true,
      message:
        defenseRating === 'HIGH'
          ? `Quadrant ${qx}:${qy} beansprucht! WARNUNG: K'thari-Grenzgebiet — hohe Verteidigungsstufe.`
          : `Quadrant ${qx}:${qy} erfolgreich beansprucht!`,
      claim,
    });
  }

  async handleGetTerritory(client: Client, data: { quadrantX?: number; quadrantY?: number }): Promise<void> {
    const qx = data.quadrantX ?? this.ctx.quadrantX;
    const qy = data.quadrantY ?? this.ctx.quadrantY;
    const claim = await getTerritoryClaim(qx, qy);
    client.send('territoryInfo', { quadrantX: qx, quadrantY: qy, claim });
  }

  async handleListMyTerritories(client: Client): Promise<void> {
    if (rejectGuest(client, 'listMyTerritories')) return;
    const auth = client.auth as AuthPayload;
    const territories = await getPlayerTerritories(auth.userId);
    client.send('myTerritories', { territories });
  }

  /**
   * Defend territory — attacker challenges the current quadrant's claim.
   * If unclaimed: no-op (inform player).
   * If claimed by self: award KAMPF-XP for practice defense.
   * If claimed by another: initiate auto-combat; winner keeps/takes the claim.
   */
  async handleDefendTerritory(client: Client): Promise<void> {
    if (rejectGuest(client, 'defendTerritory')) return;
    const auth = client.auth as AuthPayload;

    const qx = this.ctx.quadrantX;
    const qy = this.ctx.quadrantY;
    const claim = await getTerritoryClaim(qx, qy);

    if (!claim) {
      client.send('territoryResult', {
        success: false,
        message: 'Dieser Quadrant ist unbesetzt. Nutze "Beanspruchen" um ihn zu übernehmen.',
      });
      return;
    }

    if (claim.player_id === auth.userId) {
      // Defend own territory — practice combat, award XP
      await incrementTerritoryVictories(qx, qy);
      await addAcepXpForPlayer(auth.userId, 'kampf', 2).catch(() => {});
      client.send('territoryResult', {
        success: true,
        message: 'Gebietsverteidigung geübt. +2 KAMPF-XP.',
        claim: await getTerritoryClaim(qx, qy),
      });
      return;
    }

    // Attacker challenges the claim — simulate territory combat
    const defenseRating = claim.defense_rating;
    const winChance = defenseRating === 'HIGH' ? 0.25 : 0.5;
    const attackerWins = Math.random() < winChance;

    if (attackerWins) {
      // Attacker wins — steal the claim
      await deleteTerritoryClaim(qx, qy);
      const newDefenseRating = isKthariTerritory(qx, qy) ? 'HIGH' : 'LOW';
      await createTerritoryClaim(auth.userId, auth.username ?? auth.userId, qx, qy, newDefenseRating);
      await addAcepXpForPlayer(auth.userId, 'kampf', 5).catch(() => {});
      const newClaim = await getTerritoryClaim(qx, qy);
      client.send('territoryResult', {
        success: true,
        message: `Sieg! Quadrant ${qx}:${qy} gehört jetzt dir. +5 KAMPF-XP.`,
        claim: newClaim,
        combat: { outcome: 'victory', previousOwner: claim.player_name },
      });
    } else {
      // Defender wins — attacker repelled
      await incrementTerritoryVictories(qx, qy);
      client.send('territoryResult', {
        success: false,
        message: `Niederlage! ${claim.player_name}'s Verteidigung hat dich zurückgeschlagen.`,
        claim,
        combat: { outcome: 'defeat', defenseRating },
      });
    }
  }
}
