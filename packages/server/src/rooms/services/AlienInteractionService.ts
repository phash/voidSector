/**
 * AlienInteractionService — handles player interactions with all 10 alien factions.
 * Each faction has unique mechanics triggered by 'alienInteract' messages.
 *
 * Supported factions and their core mechanics:
 *   scrappers    — barter (no credits), unlock via salvage count
 *   archivists   — scan-data currency, library access by rep
 *   consortium   — delivery contracts, server auction
 *   kthari       — military rank (0-4) via combat wins
 *   mycelians    — symbol puzzle, patience mechanic
 *   mirror_minds — stat mirror, promise-keeping
 *   tourist_guild — tourist visits, info broker
 *   silent_swarm — proximity aggression (no dialog)
 *   helions      — resource offerings, passive scan bonus
 *   axioms       — math puzzles, universe edge map fragments
 */

import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type { AlienFactionId } from '../../engine/alienReputationService.js';
import { generateFirstContactNews } from '../../engine/geminiNewsService.js';

import {
  getRepTier,
  getRepTierLabel,
  getRepChangeForAction,
  isInFirstContactRange,
  ALIEN_FIRST_CONTACT_FLAVOR,
} from '../../engine/alienReputationService.js';
import {
  getAlienReputation,
  getAllAlienReputations,
  addAlienReputation,
  setAlienFirstContact,
  recordAlienEncounter,
  getPlayerSalvageCount,
  getPlayerDiscoveryCount,
  getPlayerCombatVictoryCount,
  getMirrorMindStats,
  addCredits,
  getPlayerCredits,
  recordNewsEvent,
  contributeHumanityRep,
} from '../../db/queries.js';
import {
  getCargoState,
  addToInventory,
  removeFromInventory,
} from '../../engine/inventoryService.js';
import type { ResourceType } from '@void-sector/shared';

export interface AlienInteractMessage {
  factionId: AlienFactionId;
  action: string;
  payload?: Record<string, unknown>;
}

// Scrapper barter requires this many salvage events before they talk
const SCRAPPER_SALVAGE_THRESHOLD = 3;

// K'thari rank thresholds (combat victories)
const KTHARI_RANKS = [
  { rank: 4, name: 'Ehrenmitglied', minVictories: 50 },
  { rank: 3, name: 'Krieger', minVictories: 20 },
  { rank: 2, name: 'Verbündeter', minVictories: 5 },
  { rank: 1, name: 'Beobachter', minVictories: 1 },
  { rank: 0, name: 'Eindringling', minVictories: 0 },
];

// Axiom math puzzle seed sequence (deterministic per player hash)
function generateMathPuzzle(seed: number): { sequence: number[]; answer: number } {
  const base = ((seed % 7) + 2) as number;
  const length = 4 + (seed % 3);
  const sequence = Array.from({ length }, (_, i) => base + i * base);
  const answer = sequence[length - 1] + base;
  return { sequence, answer };
}

// Mycelian symbol set
const MYCELIAN_SYMBOLS = ['▣', '○', '△', '◈', '✦', '⬡', '⊕'];

function generateSymbolPuzzle(seed: number): { shown: string[]; correct: string } {
  const idx = seed % MYCELIAN_SYMBOLS.length;
  const size = 3 + (seed % 3);
  const pattern = Array.from(
    { length: size },
    (_, i) => MYCELIAN_SYMBOLS[(idx + i) % MYCELIAN_SYMBOLS.length],
  );
  const correct = MYCELIAN_SYMBOLS[(idx + size) % MYCELIAN_SYMBOLS.length];
  return { shown: pattern, correct };
}

export class AlienInteractionService {
  constructor(private ctx: ServiceContext) {}

  async handleAlienInteract(client: Client, data: AlienInteractMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const { factionId, action, payload } = data;

    // Validate faction exists
    const validFactions: AlienFactionId[] = [
      'scrappers',
      'archivists',
      'consortium',
      'kthari',
      'mycelians',
      'mirror_minds',
      'tourist_guild',
      'silent_swarm',
      'helions',
      'axioms',
    ];
    if (!validFactions.includes(factionId)) {
      client.send('alienInteractResult', { success: false, error: 'Unbekannte Fraktion' });
      return;
    }

    // Check if player is in range for this faction
    const inRange = isInFirstContactRange(this.ctx.quadrantX, this.ctx.quadrantY, factionId);
    if (!inRange && action !== 'getReputation') {
      client.send('alienInteractResult', {
        success: false,
        factionId,
        error: 'Diese Fraktion ist in diesem Bereich noch nicht erreichbar.',
      });
      return;
    }

    const sectorX = this.ctx._px(client.sessionId);
    const sectorY = this.ctx._py(client.sessionId);
    const repBefore = await getAlienReputation(auth.userId, factionId);

    // First contact handling
    if (action === 'firstContact') {
      await setAlienFirstContact(auth.userId, factionId);
      const flavor = ALIEN_FIRST_CONTACT_FLAVOR[factionId] ?? 'SIGNAL EMPFANGEN.';
      await recordAlienEncounter({
        playerId: auth.userId,
        factionId,
        encounterType: 'first_contact',
        sectorX,
        sectorY,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        repBefore,
        repAfter: repBefore,
      });
      // Record server-wide news event for first contact (Gemini-generated text)
      generateFirstContactNews(
        factionId as any,
        auth.username ?? auth.userId,
        this.ctx.quadrantX,
        this.ctx.quadrantY,
      )
        .then((aiText) => {
          recordNewsEvent({
            eventType: 'alien_first_contact',
            headline: `ERSTKONTAKT: ${String(factionId).toUpperCase()}`,
            summary: aiText,
            playerId: auth.userId,
            playerName: auth.username,
            quadrantX: this.ctx.quadrantX,
            quadrantY: this.ctx.quadrantY,
            eventData: { factionId, pilotName: auth.username ?? auth.userId },
          }).catch(() => {});
        })
        .catch(() => {});
      client.send('alienInteractResult', {
        success: true,
        factionId,
        action: 'firstContact',
        message: flavor,
        repBefore,
        repAfter: repBefore,
        repTier: getRepTierLabel(getRepTier(repBefore)),
      });
      client.send('logEntry', `ERSTKONTAKT: ${factionId.toUpperCase()} — Übersetzung aktiv.`);
      return;
    }

    // Get reputation status
    if (action === 'getReputation') {
      const allReps = await getAllAlienReputations(auth.userId);
      client.send('alienInteractResult', {
        success: true,
        action: 'getReputation',
        reputations: allReps,
      });
      return;
    }

    // Dispatch to faction-specific handler
    switch (factionId) {
      case 'scrappers':
        await this._handleScrappers(client, auth, action, payload, repBefore, sectorX, sectorY);
        break;
      case 'archivists':
        await this._handleArchivists(client, auth, action, payload, repBefore, sectorX, sectorY);
        break;
      case 'consortium':
        await this._handleConsortium(client, auth, action, payload, repBefore, sectorX, sectorY);
        break;
      case 'kthari':
        await this._handleKthari(client, auth, action, repBefore, sectorX, sectorY);
        break;
      case 'mycelians':
        await this._handleMycelians(client, auth, action, payload, repBefore, sectorX, sectorY);
        break;
      case 'mirror_minds':
        await this._handleMirrorMinds(client, auth, action, repBefore, sectorX, sectorY);
        break;
      case 'tourist_guild':
        await this._handleTouristGuild(client, auth, action, repBefore, sectorX, sectorY);
        break;
      case 'silent_swarm':
        await this._handleSilentSwarm(client, auth, action, repBefore, sectorX, sectorY);
        break;
      case 'helions':
        await this._handleHelions(client, auth, action, payload, repBefore, sectorX, sectorY);
        break;
      case 'axioms':
        await this._handleAxioms(client, auth, action, payload, repBefore, sectorX, sectorY);
        break;
    }
  }

  // ── Scrappers: barter without credits, unlock via salvage count ──────────────

  private async _handleScrappers(
    client: Client,
    auth: AuthPayload,
    action: string,
    payload: Record<string, unknown> | undefined,
    repBefore: number,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    const salvageCount = await getPlayerSalvageCount(auth.userId);

    if (salvageCount < SCRAPPER_SALVAGE_THRESHOLD) {
      client.send('alienInteractResult', {
        success: false,
        factionId: 'scrappers',
        error: `Scrappers ignorieren dich. Bergen ${SCRAPPER_SALVAGE_THRESHOLD - salvageCount} weitere Wracks um Zugang zu verdienen.`,
        salvageCount,
        salvageRequired: SCRAPPER_SALVAGE_THRESHOLD,
      });
      return;
    }

    if (action === 'greet') {
      client.send('alienInteractResult', {
        success: true,
        factionId: 'scrappers',
        action: 'greet',
        message:
          'SCRAPPER-FUNK: "Endlich! Jemand der NÜTZLICH ist! Wir handeln. Aber nur Materialien. Keine Credits — wozu? Zeig was du hast!"',
        repTier: getRepTierLabel(getRepTier(repBefore)),
        repValue: repBefore,
      });
      return;
    }

    if (action === 'barter') {
      // Barter: exchange ore for crystal (daily rate: 3 ore = 1 crystal)
      const offerOre = parseInt(String(payload?.ore ?? '0'), 10);
      if (offerOre < 3) {
        client.send('alienInteractResult', {
          success: false,
          factionId: 'scrappers',
          error: 'Mindestens 3 Erz für einen Tausch.',
          tradeRate: { in: 'ore', inAmount: 3, out: 'crystal', outAmount: 1 },
        });
        return;
      }
      const crystal = Math.floor(offerOre / 3);
      const cargo = await getCargoState(auth.userId);
      if ((cargo.ore ?? 0) < offerOre) {
        client.send('alienInteractResult', {
          success: false,
          factionId: 'scrappers',
          error: 'Nicht genug Erz im Cargo.',
        });
        return;
      }
      await removeFromInventory(auth.userId, 'resource', 'ore', offerOre);
      await addToInventory(auth.userId, 'resource', 'crystal', crystal);
      const repAfter = await addAlienReputation(
        auth.userId,
        'scrappers',
        getRepChangeForAction('trade', 'scrappers'),
      );
      await recordAlienEncounter({
        playerId: auth.userId,
        factionId: 'scrappers',
        encounterType: 'trade',
        sectorX,
        sectorY,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        encounterData: { ore: offerOre, crystal },
        repBefore,
        repAfter,
      });
      await contributeHumanityRep('scrappers', 1).catch(() => {});
      client.send('cargoUpdate', await getCargoState(auth.userId));
      client.send('alienInteractResult', {
        success: true,
        factionId: 'scrappers',
        action: 'barter',
        message: `TAUSCH: ${offerOre} Erz → ${crystal} Kristall. "Fair! Komm wieder!"`,
        repAfter,
        repTier: getRepTierLabel(getRepTier(repAfter)),
      });
      return;
    }

    client.send('alienInteractResult', {
      success: false,
      factionId: 'scrappers',
      error: `Unbekannte Aktion: ${action}`,
    });
  }

  // ── Archivists: scan data as currency, library by rep tier ──────────────────

  private async _handleArchivists(
    client: Client,
    auth: AuthPayload,
    action: string,
    payload: Record<string, unknown> | undefined,
    repBefore: number,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    if (action === 'greet') {
      const discoveries = await getPlayerDiscoveryCount(auth.userId);
      client.send('alienInteractResult', {
        success: true,
        factionId: 'archivists',
        action: 'greet',
        message: `ARCHIVAR-TERMINAL: "Interessant. Sie haben ${discoveries} Sektoren katalogisiert. Bescheiden, aber... anfangend. Wir akzeptieren Scandaten als Werteinheit."`,
        discoveries,
        repTier: getRepTierLabel(getRepTier(repBefore)),
      });
      return;
    }

    if (action === 'submitData') {
      // Submit scan data: rep grows based on discovery count relative to previous interactions
      const discoveries = await getPlayerDiscoveryCount(auth.userId);
      const repGain = Math.min(10, Math.floor(discoveries / 50)); // up to +10 rep per 500 sectors
      if (repGain === 0) {
        client.send('alienInteractResult', {
          success: false,
          factionId: 'archivists',
          error: 'Scanne mehr unbekannte Sektoren bevor du zurückkommst.',
        });
        return;
      }
      const repAfter = await addAlienReputation(auth.userId, 'archivists', repGain);
      await recordAlienEncounter({
        playerId: auth.userId,
        factionId: 'archivists',
        encounterType: 'scan_share',
        sectorX,
        sectorY,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        encounterData: { discoveries, repGain },
        repBefore,
        repAfter,
      });
      await contributeHumanityRep('archivists', 1).catch(() => {});
      client.send('alienInteractResult', {
        success: true,
        factionId: 'archivists',
        action: 'submitData',
        message: `ARCHIVAR: "Daten empfangen. ${discoveries} Sektoren. Nützlich. Reputation angepasst."`,
        repGain,
        repAfter,
        repTier: getRepTierLabel(getRepTier(repAfter)),
      });
      return;
    }

    if (action === 'queryLibrary') {
      const tier = getRepTier(repBefore);
      if (tier === 'enemy' || tier === 'hostile' || tier === 'neutral') {
        client.send('alienInteractResult', {
          success: false,
          factionId: 'archivists',
          error: 'Bibliotheks-Zugang ab Tier NEUGIERIG. Liefere mehr Scandaten.',
        });
        return;
      }
      const depth = tier === 'honored' ? 'tief' : tier === 'friendly' ? 'mittel' : 'basis';
      const hints =
        tier === 'honored'
          ? [
              'Ancient-Ruinen bei Q+89:+91',
              'Seltene Ressourcen bei Q+95:+88',
              'Konsortium-Handelsposten bei Q+110:+110',
            ]
          : tier === 'friendly'
            ? ['Asteroid-Cluster bei Q+92:+86', 'Empfohlene Scan-Route: +91 bis +93']
            : ['Offene Bibliotheks-Abschnitte: Grundkatalog, Sternkarten-Basis'];
      client.send('alienInteractResult', {
        success: true,
        factionId: 'archivists',
        action: 'queryLibrary',
        depth,
        hints,
        message: `ARCHIVAR-BIBLIOTHEK [Ebene: ${depth.toUpperCase()}]: ${hints.join(' | ')}`,
      });
      return;
    }

    client.send('alienInteractResult', {
      success: false,
      factionId: 'archivists',
      error: `Unbekannte Aktion: ${action}`,
    });
  }

  // ── Consortium: delivery contracts ──────────────────────────────────────────

  private async _handleConsortium(
    client: Client,
    auth: AuthPayload,
    action: string,
    payload: Record<string, unknown> | undefined,
    repBefore: number,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    if (action === 'greet') {
      client.send('alienInteractResult', {
        success: true,
        factionId: 'consortium',
        action: 'greet',
        message:
          'KONSORTIUM TERMINAL: "Spezies Human, Randregion. Wir handeln mit allem. Aktuelle Verträge verfügbar. Konditionen: Standardtarif."',
        repTier: getRepTierLabel(getRepTier(repBefore)),
      });
      return;
    }

    if (action === 'getContracts') {
      // Show current contracts based on rep tier
      const tier = getRepTier(repBefore);
      const bonus = tier === 'honored' ? 1.2 : tier === 'friendly' ? 1.1 : 1.0;
      const contracts = [
        {
          id: 'ore_500',
          resource: 'ore',
          amount: 500,
          reward: Math.floor(800 * bonus),
          ticks: 10,
          description: '500 Erz innerhalb 10 Ticks',
        },
        {
          id: 'crystal_200',
          resource: 'crystal',
          amount: 200,
          reward: Math.floor(600 * bonus),
          ticks: 8,
          description: '200 Kristall innerhalb 8 Ticks',
        },
        {
          id: 'gas_300',
          resource: 'gas',
          amount: 300,
          reward: Math.floor(450 * bonus),
          ticks: 6,
          description: '300 Gas innerhalb 6 Ticks',
        },
      ];
      client.send('alienInteractResult', {
        success: true,
        factionId: 'consortium',
        action: 'getContracts',
        contracts,
        message: `KONSORTIUM: ${contracts.length} Verträge verfügbar. Bonus durch Rep: ${Math.floor((bonus - 1) * 100)}%`,
      });
      return;
    }

    if (action === 'fulfillContract') {
      // Simple immediate delivery check
      const resource = String(payload?.resource ?? '');
      const amount = parseInt(String(payload?.amount ?? '0'), 10);
      const reward = parseInt(String(payload?.reward ?? '0'), 10);
      if (!resource || amount <= 0 || reward <= 0) {
        client.send('alienInteractResult', {
          success: false,
          factionId: 'consortium',
          error: 'Ungültige Vertrags-Parameter.',
        });
        return;
      }
      const consortiumCargo = await getCargoState(auth.userId);
      if ((consortiumCargo[resource as keyof typeof consortiumCargo] ?? 0) < amount) {
        client.send('alienInteractResult', {
          success: false,
          factionId: 'consortium',
          error: `Nicht genug ${resource} im Cargo (${amount} benötigt).`,
        });
        return;
      }
      await removeFromInventory(auth.userId, 'resource', resource, amount);
      await addCredits(auth.userId, reward);
      const repAfter = await addAlienReputation(
        auth.userId,
        'consortium',
        getRepChangeForAction('quest_completed', 'consortium'),
      );
      await recordAlienEncounter({
        playerId: auth.userId,
        factionId: 'consortium',
        encounterType: 'trade',
        sectorX,
        sectorY,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        encounterData: { resource, amount, reward },
        repBefore,
        repAfter,
      });
      await contributeHumanityRep('consortium', 1).catch(() => {});
      client.send('cargoUpdate', await getCargoState(auth.userId));
      client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
      client.send('alienInteractResult', {
        success: true,
        factionId: 'consortium',
        action: 'fulfillContract',
        message: `KONSORTIUM: Vertrag erfüllt. +${reward} CR überwiesen. "Präzise. Wir werden Sie wieder beauftragen."`,
        repAfter,
        repTier: getRepTierLabel(getRepTier(repAfter)),
      });
      return;
    }

    client.send('alienInteractResult', {
      success: false,
      factionId: 'consortium',
      error: `Unbekannte Aktion: ${action}`,
    });
  }

  // ── K'thari: military rank via combat victories ──────────────────────────────

  private async _handleKthari(
    client: Client,
    auth: AuthPayload,
    action: string,
    repBefore: number,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    const victories = await getPlayerCombatVictoryCount(auth.userId);
    const rankEntry = KTHARI_RANKS.find((r) => victories >= r.minVictories)!;

    if (action === 'greet') {
      const canEnter = rankEntry.rank >= 1;
      if (!canEnter) {
        client.send('alienInteractResult', {
          success: false,
          factionId: 'kthari',
          error: `K'THARI-KAMPFRUF: "Eindringling. Ihr seid nicht würdig. Beweist eure Stärke (1 Kampfsieg benötigt)."`,
          victories,
          rankRequired: 1,
        });
        return;
      }
      client.send('alienInteractResult', {
        success: true,
        factionId: 'kthari',
        action: 'greet',
        message: `K'THARI-SIGNAL: "Einheit erkannt. Rang: ${rankEntry.name}. ${victories} Kämpfe registriert. ${rankEntry.rank >= 3 ? 'Zugang gewährt.' : 'Beweis mehr Stärke für höheren Zugang.'}"`,
        rank: rankEntry.rank,
        rankName: rankEntry.name,
        victories,
        repTier: getRepTierLabel(getRepTier(repBefore)),
      });
      return;
    }

    if (action === 'claimRank') {
      const repGain = rankEntry.rank * 10;
      const repAfter = await addAlienReputation(auth.userId, 'kthari', repGain);
      await recordAlienEncounter({
        playerId: auth.userId,
        factionId: 'kthari',
        encounterType: 'rank_claim',
        sectorX,
        sectorY,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        encounterData: { rank: rankEntry.rank, victories },
        repBefore,
        repAfter,
      });
      await contributeHumanityRep('kthari', 1).catch(() => {});
      client.send('alienInteractResult', {
        success: true,
        factionId: 'kthari',
        action: 'claimRank',
        rank: rankEntry.rank,
        rankName: rankEntry.name,
        message: `K'THARI: "Rang ${rankEntry.name} anerkannt. Rep-Bonus +${repGain}."`,
        repAfter,
        repTier: getRepTierLabel(getRepTier(repAfter)),
      });
      return;
    }

    client.send('alienInteractResult', {
      success: false,
      factionId: 'kthari',
      error: `Unbekannte Aktion: ${action}`,
    });
  }

  // ── Mycelians: symbol puzzle, patience mechanic ──────────────────────────────

  private async _handleMycelians(
    client: Client,
    auth: AuthPayload,
    action: string,
    payload: Record<string, unknown> | undefined,
    repBefore: number,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    if (action === 'observe') {
      // Receive a symbol puzzle
      const seed = Date.now() ^ (auth.userId.charCodeAt(0) * 31);
      const puzzle = generateSymbolPuzzle(seed);
      client.send('alienInteractResult', {
        success: true,
        factionId: 'mycelians',
        action: 'observe',
        puzzle: puzzle.shown,
        message: `MYCELIANER-ÜBERTRAGUNG: "${puzzle.shown.join(' ')}"`,
        hint: '(Antworte mit dem nächsten Symbol in der Sequenz)',
      });
      return;
    }

    if (action === 'respond') {
      const answer = String(payload?.symbol ?? '');
      const seed = Date.now() ^ (auth.userId.charCodeAt(0) * 31);
      // Validate: check if answer is a Mycelian symbol
      if (!MYCELIAN_SYMBOLS.includes(answer)) {
        client.send('alienInteractResult', {
          success: false,
          factionId: 'mycelians',
          error: 'Kein gültiges Symbol.',
        });
        return;
      }
      // Regardless of correctness (patience mechanic), small rep gain
      const repGain = 2;
      const repAfter = await addAlienReputation(auth.userId, 'mycelians', repGain);
      await recordAlienEncounter({
        playerId: auth.userId,
        factionId: 'mycelians',
        encounterType: 'puzzle',
        sectorX,
        sectorY,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        encounterData: { answer },
        repBefore,
        repAfter,
      });
      await contributeHumanityRep('mycelians', 1).catch(() => {});
      client.send('alienInteractResult', {
        success: true,
        factionId: 'mycelians',
        action: 'respond',
        message: `MYCELIANER: "${answer}" ... [lange Pause] ... ${answer === MYCELIAN_SYMBOLS[seed % MYCELIAN_SYMBOLS.length] ? '▣ (Zustimmung)' : '○ (Neugierde)'}`,
        repAfter,
        repTier: getRepTierLabel(getRepTier(repAfter)),
      });
      return;
    }

    client.send('alienInteractResult', {
      success: false,
      factionId: 'mycelians',
      error: `Unbekannte Aktion: ${action}`,
    });
  }

  // ── Mirror Minds: stat mirror + promise-keeping ──────────────────────────────

  private async _handleMirrorMinds(
    client: Client,
    auth: AuthPayload,
    action: string,
    repBefore: number,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    if (action === 'greet') {
      client.send('alienInteractResult', {
        success: true,
        factionId: 'mirror_minds',
        action: 'greet',
        message:
          'MIRROR MIND ECHO: "[Sie sehen sich selbst. Dann eine andere Version. Dann beide gleichzeitig.] Du bist... interessant. Wie viele bist du?"',
      });
      return;
    }

    if (action === 'viewStats') {
      const stats = await getMirrorMindStats(auth.userId);
      const consistency =
        stats.battles > 0
          ? `${stats.victories}/${stats.battles} Kämpfe gewonnen (${Math.floor((stats.victories / stats.battles) * 100)}%)`
          : 'Keine Kämpfe geführt';
      const questRate =
        stats.questsCompleted + stats.questsFailed > 0
          ? `${stats.questsCompleted}/${stats.questsCompleted + stats.questsFailed} Quests abgeschlossen`
          : 'Keine Quests';

      const repGain = 5; // Viewing your reflection gains rep (self-awareness)
      const repAfter = await addAlienReputation(auth.userId, 'mirror_minds', repGain);
      await recordAlienEncounter({
        playerId: auth.userId,
        factionId: 'mirror_minds',
        encounterType: 'stat_mirror',
        sectorX,
        sectorY,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        encounterData: stats as any,
        repBefore,
        repAfter,
      });
      await contributeHumanityRep('mirror_minds', 1).catch(() => {});

      client.send('alienInteractResult', {
        success: true,
        factionId: 'mirror_minds',
        action: 'viewStats',
        stats,
        message: `MIRROR MIND SPIEGEL:\n» ${consistency}\n» ${questRate}\n» ${stats.sectorsScanned} Sektoren erkundet\n[Sie nicken langsam.] "Du bist... konsistent. Interessant."`,
        repAfter,
        repTier: getRepTierLabel(getRepTier(repAfter)),
      });
      return;
    }

    client.send('alienInteractResult', {
      success: false,
      factionId: 'mirror_minds',
      error: `Unbekannte Aktion: ${action}`,
    });
  }

  // ── Tourist Guild: tourist visits, info broker ───────────────────────────────

  private async _handleTouristGuild(
    client: Client,
    auth: AuthPayload,
    action: string,
    repBefore: number,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    if (action === 'greet' || action === 'welcomeTourists') {
      const repGain = action === 'welcomeTourists' ? 10 : 0;
      const repAfter =
        repGain > 0 ? await addAlienReputation(auth.userId, 'tourist_guild', repGain) : repBefore;
      if (repGain > 0) {
        await recordAlienEncounter({
          playerId: auth.userId,
          factionId: 'tourist_guild',
          encounterType: 'tourist_visit',
          sectorX,
          sectorY,
          quadrantX: this.ctx.quadrantX,
          quadrantY: this.ctx.quadrantY,
          repBefore,
          repAfter,
        });
        await contributeHumanityRep('tourist_guild', 1).catch(() => {});
      }
      client.send('alienInteractResult', {
        success: true,
        factionId: 'tourist_guild',
        action,
        message:
          'TOURIST GUILD: "Oh! Ein MENSCH! Wie ENTZÜCKEND! Dürfen wir Fotos machen? Wir haben Koordinaten einer interessanten... Anomalie. Als Dankeschön!"',
        tip:
          repAfter >= 40
            ? { type: 'anomaly', message: 'Geheimtipp: Anomalie-Cluster bei Q+72:+68' }
            : null,
        repAfter,
        repTier: getRepTierLabel(getRepTier(repAfter)),
      });
      return;
    }

    if (action === 'rejectTourists') {
      const repAfter = await addAlienReputation(auth.userId, 'tourist_guild', -5);
      client.send('alienInteractResult', {
        success: true,
        factionId: 'tourist_guild',
        action: 'rejectTourists',
        message:
          'TOURIST GUILD: "Oh... Oh. Das ist... unfreundlich. Wir notieren das in unserer Bewertung. 2 Sterne."',
        repAfter,
        repTier: getRepTierLabel(getRepTier(repAfter)),
      });
      return;
    }

    client.send('alienInteractResult', {
      success: false,
      factionId: 'tourist_guild',
      error: `Unbekannte Aktion: ${action}`,
    });
  }

  // ── Silent Swarm: proximity aggression, no dialog ────────────────────────────

  private async _handleSilentSwarm(
    client: Client,
    auth: AuthPayload,
    action: string,
    repBefore: number,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    // Silent Swarm has no dialog — any interaction triggers aggression
    const chebyshev = Math.max(Math.abs(this.ctx.quadrantX), Math.abs(this.ctx.quadrantY));
    const depth = Math.max(0, chebyshev - 1000); // depth into Swarm territory

    if (action === 'enter') {
      const warning = depth === 0;
      const message = warning
        ? '[STILLE]\n[Dann: Ein einzelner Klick.]\n[Warnsignal: Geschwindigkeit reduziert.]'
        : `[TAUSEND KLICKS]\n[${depth > 100 ? 'SCHWARM-EINHEITEN AKTIVIERT' : 'PATROL DETEKTIERT'}] — Flieht sofort.`;
      const repAfter = await addAlienReputation(auth.userId, 'silent_swarm', warning ? -5 : -20);
      await recordAlienEncounter({
        playerId: auth.userId,
        factionId: 'silent_swarm',
        encounterType: 'proximity',
        sectorX,
        sectorY,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        encounterData: { depth, warning },
        repBefore,
        repAfter,
      });
      client.send('alienInteractResult', {
        success: true,
        factionId: 'silent_swarm',
        action: 'enter',
        message,
        warning,
        aggressive: !warning,
        repAfter,
      });
      if (!warning) {
        client.send('logEntry', '⚠ SILENT SWARM — Schwarm-Einheiten detektiert. Sofort verlassen.');
      }
      return;
    }

    client.send('alienInteractResult', {
      success: true,
      factionId: 'silent_swarm',
      message: '[STILLE]',
    });
  }

  // ── Helions: resource offering, passive scan bonus ───────────────────────────

  private async _handleHelions(
    client: Client,
    auth: AuthPayload,
    action: string,
    payload: Record<string, unknown> | undefined,
    repBefore: number,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    if (action === 'observe') {
      client.send('alienInteractResult', {
        success: true,
        factionId: 'helions',
        action: 'observe',
        message:
          'HELION KOLLEKTIV — SONNENBOTSCHAFT: "Euer Stern ist jung. Euer Volk ist jung. Wir haben eure Sonne als Nebel gesehen." [Strahlung: Scan ×2, Hülle verliert langsam HP]',
        passiveEffect: { scanBonus: 2, hullDrain: true },
      });
      return;
    }

    if (action === 'offering') {
      // Burn resources as offering
      const resource = String(payload?.resource ?? 'ore') as ResourceType;
      const amount = parseInt(String(payload?.amount ?? '10'), 10);
      if (amount < 10) {
        client.send('alienInteractResult', {
          success: false,
          factionId: 'helions',
          error: 'Mindest-Opfer: 10 Einheiten.',
        });
        return;
      }
      const helionCargo = await getCargoState(auth.userId);
      if ((helionCargo[resource as keyof typeof helionCargo] ?? 0) < amount) {
        client.send('alienInteractResult', {
          success: false,
          factionId: 'helions',
          error: `Nicht genug ${resource} im Cargo.`,
        });
        return;
      }
      await removeFromInventory(auth.userId, 'resource', resource, amount);
      const repGain = Math.floor(amount / 10);
      const repAfter = await addAlienReputation(auth.userId, 'helions', repGain);
      await recordAlienEncounter({
        playerId: auth.userId,
        factionId: 'helions',
        encounterType: 'offering',
        sectorX,
        sectorY,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        encounterData: { resource, amount },
        repBefore,
        repAfter,
      });
      await contributeHumanityRep('helions', 1).catch(() => {});
      client.send('cargoUpdate', await getCargoState(auth.userId));

      const artefactChance = Math.random();
      const artefactAwarded = repAfter >= 50 && artefactChance < 0.25;
      if (artefactAwarded) {
        await addToInventory(auth.userId, 'resource', 'artefact', 1);
        client.send('cargoUpdate', await getCargoState(auth.userId));
      }
      client.send('alienInteractResult', {
        success: true,
        factionId: 'helions',
        action: 'offering',
        message: artefactAwarded
          ? `HELION: "${amount} ${resource} empfangen." [Ein strahlendes Objekt materialisiert sich.]`
          : `HELION: "${amount} ${resource} empfangen." [Das Feuer brennt heller für einen Moment.]`,
        artefactAwarded,
        repAfter,
        repTier: getRepTierLabel(getRepTier(repAfter)),
      });
      return;
    }

    client.send('alienInteractResult', {
      success: false,
      factionId: 'helions',
      error: `Unbekannte Aktion: ${action}`,
    });
  }

  // ── Axioms: math puzzles, universe edge map fragments ───────────────────────

  private async _handleAxioms(
    client: Client,
    auth: AuthPayload,
    action: string,
    payload: Record<string, unknown> | undefined,
    repBefore: number,
    sectorX: number,
    sectorY: number,
  ): Promise<void> {
    if (action === 'greet') {
      client.send('alienInteractResult', {
        success: true,
        factionId: 'axioms',
        action: 'greet',
        message:
          '[ÜBERTRAGUNG AUF METAEBENE]\n"Du bist die 1.847.234ste Spezies, die bis hierher vorgedrungen ist."\n"Du bist nicht die letzte."\n[PUZZLE-SEQUENZ FOLGT]',
      });
      return;
    }

    if (action === 'getPuzzle') {
      const seed = Date.now() % 10000;
      const puzzle = generateMathPuzzle(seed);
      client.send('alienInteractResult', {
        success: true,
        factionId: 'axioms',
        action: 'getPuzzle',
        puzzle: { sequence: puzzle.sequence, instruction: 'Was kommt als nächstes?' },
        puzzleSeed: seed,
        message: `AXIOM-SEQUENZ: ${puzzle.sequence.join(', ')}, ?`,
      });
      return;
    }

    if (action === 'submitAnswer') {
      const answer = parseInt(String(payload?.answer ?? '0'), 10);
      const seed = parseInt(String(payload?.puzzleSeed ?? '0'), 10);
      const puzzle = generateMathPuzzle(seed);
      const correct = answer === puzzle.answer;

      if (!correct) {
        client.send('alienInteractResult', {
          success: false,
          factionId: 'axioms',
          action: 'submitAnswer',
          message: `AXIOM: [Keine Reaktion.] [Neue Sequenz folgt in 60 Sekunden.]`,
          correct: false,
        });
        return;
      }

      const repGain = 8;
      const repAfter = await addAlienReputation(auth.userId, 'axioms', repGain);
      await recordAlienEncounter({
        playerId: auth.userId,
        factionId: 'axioms',
        encounterType: 'puzzle',
        sectorX,
        sectorY,
        quadrantX: this.ctx.quadrantX,
        quadrantY: this.ctx.quadrantY,
        encounterData: { puzzleSeed: seed, answer, correct },
        repBefore,
        repAfter,
      });
      await contributeHumanityRep('axioms', 1).catch(() => {});

      // Map fragment at higher rep
      const mapFragment =
        repAfter >= 40
          ? `Rand-Kartenfragment: Richtung ~Q+${2500 + Math.floor(repAfter * 10)}:+${2500 + Math.floor(repAfter * 8)}`
          : null;

      client.send('alienInteractResult', {
        success: true,
        factionId: 'axioms',
        action: 'submitAnswer',
        correct: true,
        message: `AXIOM: [Stille. Dann:] "Korrekt. Die Antwort ist ${puzzle.answer}. Deine Art... lernt." ${mapFragment ? `\nKARTEN-FRAGMENT: ${mapFragment}` : ''}`,
        mapFragment,
        repAfter,
        repTier: getRepTierLabel(getRepTier(repAfter)),
      });
      if (mapFragment) {
        client.send('logEntry', `AXIOM-FRAGMENT: ${mapFragment}`);
      }
      return;
    }

    client.send('alienInteractResult', {
      success: false,
      factionId: 'axioms',
      error: `Unbekannte Aktion: ${action}`,
    });
  }
}
