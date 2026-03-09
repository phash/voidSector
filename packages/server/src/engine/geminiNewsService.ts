// packages/server/src/engine/geminiNewsService.ts
import { spawn } from 'node:child_process';
import type { AlienFactionId } from './alienReputationService.js';

interface FactionPromptData {
  label: string;
  description: string;
}

const FACTION_PROMPT_DATA: Record<AlienFactionId, FactionPromptData> = {
  archivists: { label: 'Die Archivare', description: 'Akademische Alien-Rasse die Menschen als Forschungsobjekt betrachtet.' },
  kthari: { label: "Das K'thari Dominion", description: 'Militärische Alien-Rasse die nur Stärke respektiert.' },
  mycelians: { label: 'Die Mycelianer', description: 'Pilzartige Alien-Rasse die in anderen Zeitdimensionen lebt.' },
  consortium: { label: 'Das Konsortium', description: 'Businessorientierte Alien-Händler die Menschen als Randregions-Kunden sehen.' },
  tourist_guild: { label: 'Die Touristengilde', description: 'Alien-Touristen die Menschen als exotische Attraktion behandeln.' },
  scrappers: { label: 'Die Scrappers', description: 'Pragmatische Schrotthändler die nur Nützlichkeit respektieren.' },
  mirror_minds: { label: 'Die Mirror Minds', description: 'Telepathische Aliens die absolute Ehrlichkeit erwarten.' },
  silent_swarm: { label: 'Der Silent Swarm', description: 'Maschinelle Schwarm-Intelligenz ohne Kommunikationsfähigkeit.' },
  helions: { label: 'Das Helion Kollektiv', description: 'Aliens die in Sternen leben und nur über Energie kommunizieren.' },
  axioms: { label: 'Die Axiome', description: 'Die fortgeschrittenste bekannte Rasse, kommuniziert nur in Mathematik.' },
};

export const FALLBACK_NEWS: Record<string, string> = {
  archivists: 'EILMELDUNG: Erstkontakt mit den Archivaren. Sie nennen Quadrant 0:0 "Randregion EX-7". Kein Kommentar der Regierung.',
  kthari: "EILMELDUNG: K'thari Dominion kontaktiert. Sie wollten kämpfen. Erstaunlicherweise nicht sofort.",
  mycelians: 'EILMELDUNG: Mycelian-Kontakt hergestellt. Kommunikation dauert mehrere Stunden. Wir warten.',
  consortium: 'EILMELDUNG: Konsortium meldet sich. Kreditwürdigkeit unbekannt. Handel trotzdem angeboten.',
  tourist_guild: 'EILMELDUNG: Touristengilde erreicht Menschheit. Wir sind jetzt eine Sehenswürdigkeit.',
  scrappers: 'EILMELDUNG: Scrappers kontaktiert. Sie akzeptieren keine Credits. Nur Schrott.',
  mirror_minds: 'EILMELDUNG: Mirror Minds Kontakt. Sie zeigen uns uns selbst. Sehr unangenehm.',
  silent_swarm: 'EILMELDUNG: Silent Swarm beobachtet uns seit Tagen. Sie haben nie mit uns gesprochen.',
  helions: 'EILMELDUNG: Helion Kollektiv entdeckt. Sie leben in Sternen. Wir verstehen das nicht vollständig.',
  axioms: 'EILMELDUNG: Erstkontakt mit den Axiomen. Kommunikation besteht aus Primzahlen. Bedeutung unklar.',
};

const TIMEOUT_MS = 3000;

export async function generateFirstContactNews(
  factionId: AlienFactionId,
  pilotName: string,
  quadrantX: number,
  quadrantY: number,
): Promise<string> {
  const factionData = FACTION_PROMPT_DATA[factionId];
  if (!factionData) return FALLBACK_NEWS[factionId] ?? 'EILMELDUNG: Erstkontakt mit unbekannter Spezies.';

  const prompt =
    `Du schreibst eine Eilmeldung für einen CRT-Terminal-Nachrichtendienst im Stil eines retro Sci-Fi Spiels. ` +
    `Ton: sachlich, leicht alarmiert, schwarzer Humor. ` +
    `Pilot ${pilotName} hat bei Koordinaten ${quadrantX}:${quadrantY} Erstkontakt mit ${factionData.label} hergestellt. ` +
    `${factionData.description} ` +
    `Schreibe eine Eilmeldung in 2-3 Sätzen, max 200 Zeichen. Nur den Text, keine Anführungszeichen.`;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(FALLBACK_NEWS[factionId] ?? 'ERSTKONTAKT BESTÄTIGT.');
    }, TIMEOUT_MS);

    try {
      const proc = spawn('gemini', ['--model', 'gemini-2.0-flash']);
      let output = '';
      proc.stdout.on('data', (d: Buffer) => {
        output += d.toString();
      });
      proc.on('close', () => {
        clearTimeout(timeout);
        resolve(output.trim().slice(0, 300) || (FALLBACK_NEWS[factionId] ?? 'ERSTKONTAKT BESTÄTIGT.'));
      });
      proc.on('error', () => {
        clearTimeout(timeout);
        resolve(FALLBACK_NEWS[factionId] ?? 'ERSTKONTAKT BESTÄTIGT.');
      });
      proc.stdin.write(prompt);
      proc.stdin.end();
    } catch {
      clearTimeout(timeout);
      resolve(FALLBACK_NEWS[factionId] ?? 'ERSTKONTAKT BESTÄTIGT.');
    }
  });
}
