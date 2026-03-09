// packages/server/src/engine/alienEncounterGen.ts
import type { AlienFactionId } from './alienReputationService.js';

export interface AlienEncounterEvent {
  factionId: AlienFactionId;
  eventType: string;
  eventText: string;
  canRespond: boolean;         // Whether player can react (+rep / -rep choice)
  acceptLabel?: string;
  declineLabel?: string;
  repOnAccept: number;
  repOnDecline: number;
}

interface EncounterTableEntry {
  factionId: AlienFactionId;
  minQDist: number;
  chance: number;              // 0.0–1.0 per sector movement
  eventType: string;
  eventText: string;
  canRespond: boolean;
  acceptLabel?: string;
  declineLabel?: string;
  repOnAccept: number;
  repOnDecline: number;
}

export const ALIEN_ENCOUNTER_TABLE: EncounterTableEntry[] = [
  {
    factionId: 'archivists', minQDist: 100, chance: 0.02,
    eventType: 'scan_probe',
    eventText: 'ARCHIVAR-SONDE SCANNT EUER SCHIFF — "Daten akzeptabel. Randspezies verhalten sich berechenbar."',
    canRespond: true, acceptLabel: 'Scan erlauben', declineLabel: 'Abschirmen',
    repOnAccept: 8, repOnDecline: -3,
  },
  {
    factionId: 'kthari', minQDist: 200, chance: 0.05,
    eventType: 'toll_demand',
    eventText: "K'THARI PATROUILLE — \"Mautgebühr für Durchquerung unseres Grenzgebiets: 50 Credits oder Rückzug.\"",
    canRespond: true, acceptLabel: 'Zahlen', declineLabel: 'Verweigern',
    repOnAccept: 10, repOnDecline: -15,
  },
  {
    factionId: 'consortium', minQDist: 150, chance: 0.03,
    eventType: 'trade_offer',
    eventText: 'KONSORTIUM-HÄNDLER NÄHERT SICH — "Sonderrabatt 15% auf nächsten Handel. Zeitlich begrenzt."',
    canRespond: true, acceptLabel: 'Angebot annehmen', declineLabel: 'Ablehnen',
    repOnAccept: 5, repOnDecline: -2,
  },
  {
    factionId: 'tourist_guild', minQDist: 500, chance: 0.08,
    eventType: 'photo_op',
    eventText: 'TOURISTENGILDE LUXUSLINER — "Dürfen wir Fotos machen? Sie sind SO authentisch menschlich!"',
    canRespond: true, acceptLabel: 'Für Fotos posieren', declineLabel: 'Ablehnen',
    repOnAccept: 12, repOnDecline: -5,
  },
  {
    factionId: 'scrappers', minQDist: 50, chance: 0.04,
    eventType: 'black_market',
    eventText: 'SCRAPPER-SCHWARZMARKT — "Psst. Haben was Interessantes. Nur Tausch, keine Credits."',
    canRespond: true, acceptLabel: 'Anschauen', declineLabel: 'Ignorieren',
    repOnAccept: 7, repOnDecline: 0,
  },
  {
    factionId: 'mirror_minds', minQDist: 400, chance: 0.01,
    eventType: 'emotion_read',
    eventText: 'MIRROR MIND KONTAKT — Sie zeigen euch euer eigenes Gesicht. Keine Worte. Nur ein Spiegel.',
    canRespond: false,
    repOnAccept: 0, repOnDecline: 0,
  },
  {
    factionId: 'silent_swarm', minQDist: 800, chance: 0.02,
    eventType: 'drone_follow',
    eventText: 'SILENT SWARM DROHNE FOLGT EUREM SCHIFF — Keine Kommunikation. Nur Beobachtung.',
    canRespond: false,
    repOnAccept: 0, repOnDecline: 0,
  },
];

const COOLDOWN_STEPS = 10;

/**
 * Roll for a spontaneous alien encounter.
 * @param stepsSinceLastEncounter — how many moveSector calls since last encounter (tracked by caller)
 */
export function rollForEncounter(
  _playerId: string,
  _sectorX: number,
  _sectorY: number,
  qx: number,
  qy: number,
  stepsSinceLastEncounter: number,
): AlienEncounterEvent | null {
  if (stepsSinceLastEncounter < COOLDOWN_STEPS) return null;

  const qDist = Math.max(Math.abs(qx), Math.abs(qy));
  const eligible = ALIEN_ENCOUNTER_TABLE.filter((e) => qDist >= e.minQDist);
  if (eligible.length === 0) return null;

  for (const entry of eligible) {
    if (Math.random() < entry.chance) {
      return {
        factionId: entry.factionId,
        eventType: entry.eventType,
        eventText: entry.eventText,
        canRespond: entry.canRespond,
        acceptLabel: entry.acceptLabel,
        declineLabel: entry.declineLabel,
        repOnAccept: entry.repOnAccept,
        repOnDecline: entry.repOnDecline,
      };
    }
  }
  return null;
}
