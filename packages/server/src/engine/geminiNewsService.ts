// packages/server/src/engine/geminiNewsService.ts
import type { AlienFactionId } from './alienReputationService.js';

interface FactionPromptData {
  label: string;
  description: string;
}

const FACTION_PROMPT_DATA: Record<AlienFactionId, FactionPromptData> = {
  archivists: {
    label: 'Die Archivare',
    description: 'Akademische Alien-Rasse die Menschen als Forschungsobjekt betrachtet.',
  },
  kthari: {
    label: "Das K'thari Dominion",
    description: 'Militärische Alien-Rasse die nur Stärke respektiert.',
  },
  mycelians: {
    label: 'Die Mycelianer',
    description: 'Pilzartige Alien-Rasse die in anderen Zeitdimensionen lebt.',
  },
  consortium: {
    label: 'Das Konsortium',
    description: 'Businessorientierte Alien-Händler die Menschen als Randregions-Kunden sehen.',
  },
  tourist_guild: {
    label: 'Die Touristengilde',
    description: 'Alien-Touristen die Menschen als exotische Attraktion behandeln.',
  },
  scrappers: {
    label: 'Die Scrappers',
    description: 'Pragmatische Schrotthändler die nur Nützlichkeit respektieren.',
  },
  mirror_minds: {
    label: 'Die Mirror Minds',
    description: 'Telepathische Aliens die absolute Ehrlichkeit erwarten.',
  },
  silent_swarm: {
    label: 'Der Silent Swarm',
    description: 'Maschinelle Schwarm-Intelligenz ohne Kommunikationsfähigkeit.',
  },
  helions: {
    label: 'Das Helion Kollektiv',
    description: 'Aliens die in Sternen leben und nur über Energie kommunizieren.',
  },
  axioms: {
    label: 'Die Axiome',
    description: 'Die fortgeschrittenste bekannte Rasse, kommuniziert nur in Mathematik.',
  },
};

export const FALLBACK_NEWS: Record<string, string> = {
  archivists:
    'EILMELDUNG: Erstkontakt mit den Archivaren. Sie nennen Quadrant 0:0 "Randregion EX-7". Kein Kommentar der Regierung.',
  kthari:
    "EILMELDUNG: K'thari Dominion kontaktiert. Sie wollten kämpfen. Erstaunlicherweise nicht sofort.",
  mycelians:
    'EILMELDUNG: Mycelian-Kontakt hergestellt. Kommunikation dauert mehrere Stunden. Wir warten.',
  consortium:
    'EILMELDUNG: Konsortium meldet sich. Kreditwürdigkeit unbekannt. Handel trotzdem angeboten.',
  tourist_guild:
    'EILMELDUNG: Touristengilde erreicht Menschheit. Wir sind jetzt eine Sehenswürdigkeit.',
  scrappers: 'EILMELDUNG: Scrappers kontaktiert. Sie akzeptieren keine Credits. Nur Schrott.',
  mirror_minds: 'EILMELDUNG: Mirror Minds Kontakt. Sie zeigen uns uns selbst. Sehr unangenehm.',
  silent_swarm:
    'EILMELDUNG: Silent Swarm beobachtet uns seit Tagen. Sie haben nie mit uns gesprochen.',
  helions:
    'EILMELDUNG: Helion Kollektiv entdeckt. Sie leben in Sternen. Wir verstehen das nicht vollständig.',
  axioms:
    'EILMELDUNG: Erstkontakt mit den Axiomen. Kommunikation besteht aus Primzahlen. Bedeutung unklar.',
};

export async function generateFirstContactNews(
  factionId: AlienFactionId,
  _pilotName: string,
  _quadrantX: number,
  _quadrantY: number,
): Promise<string> {
  const factionData = FACTION_PROMPT_DATA[factionId];
  if (!factionData)
    return FALLBACK_NEWS[factionId] ?? 'EILMELDUNG: Erstkontakt mit unbekannter Spezies.';

  return FALLBACK_NEWS[factionId] ?? 'ERSTKONTAKT BESTÄTIGT.';
}
