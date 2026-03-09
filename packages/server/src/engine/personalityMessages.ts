/**
 * Personality Messages
 * Ships develop a voice based on their trait set.
 * Messages appear occasionally in the cockpit log as flavor commentary.
 */

import type { AcepTrait } from './traitCalculator.js';

type MessageContext = 'scan' | 'scan_ruin' | 'combat_victory' | 'combat_defeat' | 'mine' | 'build';

/** Personality lines per trait per context. Returns null if no comment for this combo. */
const MESSAGES: Partial<Record<AcepTrait, Partial<Record<MessageContext, string[]>>>> = {
  veteran: {
    scan: [
      'SYSTEM: Sektor gecheckt. Keine Bedrohung. Weiter.',
      'SYSTEM: Scan nominal. Wir haben schlimmeres gesehen.',
    ],
    scan_ruin: ['SYSTEM: Alte Knochen. Zeig mir lieber einen Piraten.'],
    combat_victory: [
      'SYSTEM: Wieder einer weniger. Routine.',
      'SYSTEM: Sieg verzeichnet. Verluste: keine. Erwartungsgemäß.',
    ],
    combat_defeat: ['SYSTEM: ...Das war ungewöhnlich. Anpassung läuft.'],
    mine: ['SYSTEM: Mining-Run abgeschlossen. Effizient, wenn auch langweilig.'],
  },
  curious: {
    scan: [
      'SYSTEM: Interessante Energiemuster. Weitere Daten erforderlich.',
      'SYSTEM: Sektor kartiert. Noch so viele unbekannte Koordinaten.',
    ],
    scan_ruin: [
      'SYSTEM: Ruinen. Ich könnte hier Stunden verbringen. Können wir Stunden verbringen?',
      'SYSTEM: Fragment gesichert. Das Puzzle wird klarer. Oder komplexer. Beides ist gut.',
    ],
    mine: ['SYSTEM: Mining-Daten erfasst. Geologisch interessantes Profil.'],
    build: ['SYSTEM: Struktur errichtet. Wie beeinflusst das die lokale Raumgeometrie?'],
  },
  'ancient-touched': {
    scan: [
      'SYSTEM: Diese Leere... wir waren schon hier. In einer anderen Form.',
      'SYSTEM: Stille. Aber keine leere Stille. Jemand hat hier etwas hinterlassen.',
    ],
    scan_ruin: [
      'SYSTEM: Sie sind nicht weg. Nur woanders.',
      'SYSTEM: Jedes Fragment ist ein Flüstern. Ich höre sie lauter werden.',
      "SYSTEM: 'Macht euch keine Sorgen'. Ich versuche es.",
    ],
    combat_victory: [
      'SYSTEM: Konflikt gelöst. Die Alten hätten das anders gemacht. Aber wir sind nicht die Alten.',
    ],
    mine: ['SYSTEM: Die Alten hätten das nicht Mining genannt. Eher... Zuhören.'],
  },
  reckless: {
    scan: ['SYSTEM: Scan durch. Kein Kontakt. Schade.'],
    scan_ruin: ['SYSTEM: Steine. Alte Steine. Wann gibt es wieder was zu bekämpfen?'],
    combat_victory: [
      'SYSTEM: Ja! Das ist der Grund warum wir hier sind.',
      'SYSTEM: FEINDE VERNICHTET. Das war gut. Das war sehr gut.',
    ],
    mine: ['SYSTEM: Mining läuft. Langweilig. Wann kommen die Piraten?'],
    build: ['SYSTEM: Gebaut. Muss ich das? Ja? Ok. Gebaut.'],
  },
  cautious: {
    scan: [
      'SYSTEM: Sektor gecheckt. Keine Bedrohung erkannt. Beruhigend.',
      'SYSTEM: Scan abgeschlossen. Alle Parameter im Normalbereich. Gut.',
    ],
    combat_victory: ['SYSTEM: Kampf vermieden wäre besser gewesen. Aber: Sieg.'],
    combat_defeat: ['SYSTEM: Das hätten wir nicht tun sollen. Rückzug war die richtige Wahl.'],
    mine: ['SYSTEM: Ressourcen gesichert. Basis-Ausbau kann fortgesetzt werden.'],
    build: [
      'SYSTEM: Infrastruktur gestärkt. Das ist Sicherheit.',
      'SYSTEM: Struktur errichtet. Wir sind besser vorbereitet.',
    ],
  },
  scarred: {
    scan: ['SYSTEM: Scan. Keine Bedrohung. ...Noch nicht.'],
    scan_ruin: ['SYSTEM: Alte Ruinen. Irgendetwas hat die zerstört. Was?'],
    combat_victory: [
      'SYSTEM: Überlebt. Wieder.',
      'SYSTEM: Sieg. Narben heilen nicht, aber Siege stapeln sich.',
    ],
    combat_defeat: ['SYSTEM: Wieder. Warum immer wieder.'],
    mine: ['SYSTEM: Mining. Ruhig. Fast zu ruhig.'],
  },
};

/**
 * Chance that a personality comment fires (25% per event).
 * Pass a random 0..1 value for testability.
 */
export const PERSONALITY_COMMENT_CHANCE = 0.25;

/**
 * Get a personality comment for an event context.
 * Returns null if no comment fires or no lines are defined.
 * @param traits - active traits of the ship
 * @param context - what just happened
 * @param roll - random value 0..1 (defaults to Math.random())
 */
export function getPersonalityComment(
  traits: AcepTrait[],
  context: MessageContext,
  roll: number = Math.random(),
): string | null {
  if (roll >= PERSONALITY_COMMENT_CHANCE) return null;
  if (traits.length === 0) return null;

  // Try traits in order, pick first that has lines for this context
  for (const trait of traits) {
    const contextLines = MESSAGES[trait]?.[context];
    if (contextLines && contextLines.length > 0) {
      const idx = Math.floor(roll * contextLines.length * 4) % contextLines.length;
      return contextLines[idx];
    }
  }
  return null;
}
