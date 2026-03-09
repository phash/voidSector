// packages/server/src/engine/alienEncounterGen.ts
import type { AlienFactionId } from './alienReputationService.js';
import type { HumanityRepTier } from './humanityRepTier.js';
import { getHumanityRepTier, getHumanityChanceModifier } from './humanityRepTier.js';
import { getHumanityRep } from '../db/queries.js';

export interface AlienEncounterEvent {
  factionId: AlienFactionId;
  eventType: string;
  eventText: string;
  canRespond: boolean;         // Whether player can react (+rep / -rep choice)
  acceptLabel?: string;
  declineLabel?: string;
  repOnAccept: number;
  repOnDecline: number;
  humanityTier: HumanityRepTier;
}

interface EncounterTableEntry {
  factionId: AlienFactionId;
  minQDist: number;
  chance: number;              // 0.0–1.0 per sector movement
  eventType: string;
  canRespond: boolean;
  acceptLabel?: string;
  declineLabel?: string;
  repOnAccept: number;
  repOnDecline: number;
  dialogByTier: Record<HumanityRepTier, string>;
}

export const ALIEN_ENCOUNTER_TABLE: EncounterTableEntry[] = [
  {
    factionId: 'archivists', minQDist: 100, chance: 0.02,
    eventType: 'scan_probe',
    canRespond: true, acceptLabel: 'Scan erlauben', declineLabel: 'Abschirmen',
    repOnAccept: 8, repOnDecline: -3,
    dialogByTier: {
      FEINDSELIG: 'Archivar-Sonde initiiert Pflicht-Scan. Kooperation wird erwartet.',
      NEUTRAL: 'Archivar-Sonde scannt euer Schiff für akademische Zwecke.',
      FREUNDLICH: 'Bekannte Spezies! Archivare teilen gern neue Katalog-Einträge.',
    },
  },
  {
    factionId: 'kthari', minQDist: 200, chance: 0.05,
    eventType: 'toll_demand',
    canRespond: true, acceptLabel: 'Zahlen', declineLabel: 'Verweigern',
    repOnAccept: 10, repOnDecline: -15,
    dialogByTier: {
      FEINDSELIG: "K'thari-Krieger blockiert den Weg. Maut SOFORT zahlen.",
      NEUTRAL: "K'thari fordert Mautgebühr für die Nutzung des Sektors.",
      FREUNDLICH: "K'thari akzeptiert reduzierte Maut — Menschheit hat Respekt gezeigt.",
    },
  },
  {
    factionId: 'consortium', minQDist: 150, chance: 0.03,
    eventType: 'trade_offer',
    canRespond: true, acceptLabel: 'Angebot annehmen', declineLabel: 'Ablehnen',
    repOnAccept: 5, repOnDecline: -2,
    dialogByTier: {
      FEINDSELIG: 'Konsortium-Agent blockiert Handelswege. Keine Transaktionen ohne Strafgebühr.',
      NEUTRAL: 'Konsortium-Händler nähert sich — Sonderrabatt 15% auf nächsten Handel. Zeitlich begrenzt.',
      FREUNDLICH: 'Konsortium-Partner grüßt euch herzlich! Exklusiver Handelszugang für bewährte Menschheit.',
    },
  },
  {
    factionId: 'tourist_guild', minQDist: 500, chance: 0.08,
    eventType: 'photo_op',
    canRespond: true, acceptLabel: 'Für Fotos posieren', declineLabel: 'Ablehnen',
    repOnAccept: 12, repOnDecline: -5,
    dialogByTier: {
      FEINDSELIG: 'Touristengilde-Liner hält Abstand. "Primitive Spezies — kein Fotomotiv wert."',
      NEUTRAL: 'Touristengilde-Luxusliner nähert sich — "Dürfen wir Fotos machen? SO authentisch menschlich!"',
      FREUNDLICH: 'Touristengilde-VIP-Liner! "Menschheit ist unser beliebtestes Reiseziel — kostenlose Tour?"',
    },
  },
  {
    factionId: 'scrappers', minQDist: 50, chance: 0.04,
    eventType: 'black_market',
    canRespond: true, acceptLabel: 'Anschauen', declineLabel: 'Ignorieren',
    repOnAccept: 7, repOnDecline: 0,
    dialogByTier: {
      FEINDSELIG: 'Scrapper-Bande kreist euer Schiff ein. "Entweder handeln oder wir nehmen uns was wir brauchen."',
      NEUTRAL: 'Scrapper-Schwarzmarkt — "Psst. Haben was Interessantes. Nur Tausch, keine Credits."',
      FREUNDLICH: 'Scrapper-Freunde! "Für euch das Beste aus unserer Sammlung — alter Schwur unter Raumfahrern."',
    },
  },
  {
    factionId: 'mirror_minds', minQDist: 400, chance: 0.01,
    eventType: 'emotion_read',
    canRespond: false,
    repOnAccept: 0, repOnDecline: 0,
    dialogByTier: {
      FEINDSELIG: 'Mirror Mind Kontakt — Sie zeigen euer verzerrtes Spiegelbild. Angst spiegelt Angst.',
      NEUTRAL: 'Mirror Mind Kontakt — Sie zeigen euch euer eigenes Gesicht. Keine Worte. Nur ein Spiegel.',
      FREUNDLICH: 'Mirror Mind Kontakt — Sie zeigen euch ein strahlendes Spiegelbild. Vertrauen spiegelt Vertrauen.',
    },
  },
  {
    factionId: 'silent_swarm', minQDist: 800, chance: 0.02,
    eventType: 'drone_follow',
    canRespond: false,
    repOnAccept: 0, repOnDecline: 0,
    dialogByTier: {
      FEINDSELIG: 'Silent Swarm Drohnen schwärmen euer Schiff an. Keine Kommunikation. Nur Bedrohung.',
      NEUTRAL: 'Silent Swarm Drohne folgt eurem Schiff — Keine Kommunikation. Nur Beobachtung.',
      FREUNDLICH: 'Silent Swarm Eskorte begleitet euer Schiff. Keine Worte — aber Schutz durch Präsenz.',
    },
  },
];

const COOLDOWN_STEPS = 10;

/**
 * Roll for a spontaneous alien encounter.
 * @param stepsSinceLastEncounter — how many moveSector calls since last encounter (tracked by caller)
 */
export async function rollForEncounter(
  _playerId: string,
  _sectorX: number,
  _sectorY: number,
  qx: number,
  qy: number,
  stepsSinceLastEncounter: number,
): Promise<AlienEncounterEvent | null> {
  if (stepsSinceLastEncounter < COOLDOWN_STEPS) return null;

  const qDist = Math.max(Math.abs(qx), Math.abs(qy));
  const eligible = ALIEN_ENCOUNTER_TABLE.filter((e) => qDist >= e.minQDist);
  if (eligible.length === 0) return null;

  for (const entry of eligible) {
    const humanityRepValue = await getHumanityRep(entry.factionId);
    const tier = getHumanityRepTier(humanityRepValue);
    const modifier = getHumanityChanceModifier(tier);
    const effectiveChance = entry.chance * modifier;

    if (Math.random() < effectiveChance) {
      return {
        factionId: entry.factionId,
        eventType: entry.eventType,
        eventText: entry.dialogByTier[tier],
        canRespond: entry.canRespond,
        acceptLabel: entry.acceptLabel,
        declineLabel: entry.declineLabel,
        repOnAccept: entry.repOnAccept,
        repOnDecline: entry.repOnDecline,
        humanityTier: tier,
      };
    }
  }
  return null;
}
