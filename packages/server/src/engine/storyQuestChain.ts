// packages/server/src/engine/storyQuestChain.ts
import type { AlienFactionId } from './alienReputationService.js';

export interface StoryChapter {
  id: number;
  minQDist: number;    // Chebyshev quadrant distance from 0:0
  title: string;
  flavorText: string;
  branches?: StoryBranch[];
}

export interface StoryBranch {
  id: string;          // 'A' | 'B' | 'C'
  label: string;
  repEffects: Partial<Record<AlienFactionId, number>>;
  outcomeText: string;
}

export interface StoryProgress {
  currentChapter: number;
  completedChapters: number[];
  branchChoices: Record<string, string>;   // { "2": "A", "4": "B" }
}

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 0,
    minQDist: 6,
    title: 'DAS AUFBRUCH-SIGNAL',
    flavorText:
      'Das Zentralkomitee für Universumserkundung bestätigt: Ihr befindet euch im Zentrum. ' +
      'Ein schwaches Signal aus unbekannter Richtung — vermutlich Interferenz. Bitte ignorieren.',
  },
  {
    id: 1,
    minQDist: 40,
    title: 'DIE AUSSENPOSTEN-ANOMALIE',
    flavorText:
      'Das Signal ist... nicht menschlich. Das Ministerium für Zentrumsbestätigung wurde informiert. ' +
      'Bitte senden Sie keine Antwort. Bitte senden Sie eine Antwort.',
  },
  {
    id: 2,
    minQDist: 100,
    title: 'ERSTKONTAKT — DIE ARCHIVARE',
    flavorText:
      '"Ah. Ein Vertreter der äußeren Spezies. Ihre Koordinate 0:0 — Sie glauben das ist das Zentrum? ' +
      '...Faszinierend. Notiert." — Archivar-Sonde, Sektor unbekannt',
    branches: [
      {
        id: 'A',
        label: 'Sternkarten-Daten teilen',
        repEffects: { archivists: 30 },
        outcomeText: 'Die Archivare nehmen Ihre Daten. Sie notieren: "Randregion EX-7 kooperiert. Unerwartet."',
      },
      {
        id: 'B',
        label: 'Daten verweigern',
        repEffects: { archivists: -5 },
        outcomeText: 'Die Archivare notieren: "Defensive Reaktion. Typisch für Randspezies."',
      },
    ],
  },
  {
    id: 3,
    minQDist: 150,
    title: 'DER ERSTE ZWEIFEL',
    flavorText:
      'Expeditions-Log 2381-03-14: "Die Archivare sagen, wir kommen aus einem Randsektor. ' +
      'Das ist natürlich Unsinn. Wir sind das Zentrum. Wir fahren morgen weiter. Zum Beweis." ' +
      '[Weitere Einträge: nicht vorhanden]',
  },
  {
    id: 4,
    minQDist: 200,
    title: "DER K'THARI-TEST",
    flavorText:
      '"Unbekannte Einheit. Eure Herkunftsregion 0:0 ist uns als unbedeutende Randzone bekannt. ' +
      "Beweist eure Stärke.\" — K'thari General Vrak'ath",
    branches: [
      {
        id: 'A',
        label: 'Kampfprobe annehmen',
        repEffects: { kthari: 50 },
        outcomeText: '"Ihr habt bestanden. Für eine Randspezies. Unterhaltsam." — Vrak\'ath',
      },
      {
        id: 'B',
        label: 'Zurückweichen',
        repEffects: { kthari: -20 },
        outcomeText: '"Wie erwartet." — K\'thari Aufzeichnung, Kategorie: Randspezies',
      },
    ],
  },
  {
    id: 5,
    minQDist: 300,
    title: 'DIE LEBENDE WELT',
    flavorText:
      '"Das Netz... erinnert sich... an euch... kleines Randwesen. Ihr Planet... atmet nicht mehr... seit ihr kamt." ' +
      '— Mycelianer-Übertragung [Symbol-Sequenz #4471]',
    branches: [
      {
        id: 'A',
        label: 'Mycelian-Ökosystem schützen',
        repEffects: { mycelians: 40, kthari: -20 },
        outcomeText: '"Das Netz... erinnert... Güte." Mycelianer reagieren. Das dauert Tage.',
      },
      {
        id: 'B',
        label: 'Ressourcen ernten',
        repEffects: { mycelians: -50 },
        outcomeText: 'Reiche Ernte. Das Netz schweigt.',
      },
      {
        id: 'C',
        label: 'Ignorieren',
        repEffects: {},
        outcomeText: 'Ihr fliegt weiter. Das Netz schweigt.',
      },
    ],
  },
  {
    id: 6,
    minQDist: 500,
    title: 'TOURISTEN-INVASION',
    flavorText:
      '"Oh! Ein echter menschlicher Pilot! Aus dem berühmten 0:0-Cluster! Dürfen wir Fotos machen? ' +
      'Unsere 340 Gäste haben LANGE auf so einen Moment gewartet." — Galactic Wonder Luxusliner',
    branches: [
      {
        id: 'A',
        label: 'Mitspielen (Credits + Würdeverlust)',
        repEffects: { tourist_guild: 30 },
        outcomeText:
          'Touristengilde Bewertung: ★★★★☆ — "Die Natives waren authentisch verwirrt. Sehr empfehlenswert."',
      },
      {
        id: 'B',
        label: 'Ablehnen',
        repEffects: { tourist_guild: -10 },
        outcomeText:
          'Touristengilde Bewertung: ★★☆☆☆ — "Wenig kooperativ. Trotzdem exotisch."',
      },
    ],
  },
  {
    id: 7,
    minQDist: 1000,
    title: 'DAS UNMÖGLICHE ARTEFAKT',
    flavorText:
      '[AXIOM-PROTOKOLL 0000.7741.BETA] [EINHEIT REGISTRIERT] [EINHEIT: INTERESSANT — BEWERTUNG: AUSSTEHEND] ' +
      '[SCANNER ÜBERHITZT] [VERBINDUNG GETRENNT]',
  },
  {
    id: 8,
    minQDist: 3000,
    title: 'DER RAND',
    flavorText:
      "Nach allem was ihr gesehen habt — den Archivaren die euch bemitleidet haben, den K'thari die euch getestet haben, " +
      'den Touristen die euch fotografiert haben — seid ihr immer noch überzeugt, das Zentrum zu sein?',
    branches: [
      { id: 'A', label: 'JA', repEffects: {}, outcomeText: 'Das Universum schweigt.' },
      {
        id: 'B',
        label: 'NEIN',
        repEffects: { archivists: 10, mycelians: 5 },
        outcomeText: 'Irgendwo in einem Archiv: "Einheit EX-7-047 zeigt Einsicht. Notiert."',
      },
      {
        id: 'C',
        label: 'ICH BIN MIR NICHT SICHER',
        repEffects: { archivists: 5 },
        outcomeText: '"Die ehrlichste Antwort die wir von dieser Spezies erhalten haben." — Archivar',
      },
    ],
  },
];

/** Chebyshev distance of quadrant coords from origin */
export function quadrantDistance(qx: number, qy: number): number {
  return Math.max(Math.abs(qx), Math.abs(qy));
}

export function canUnlockChapter(chapterId: number, currentQDist: number, progress: StoryProgress): boolean {
  const chapter = STORY_CHAPTERS[chapterId];
  if (!chapter) return false;
  if (currentQDist < chapter.minQDist) return false;
  if (chapterId === 0) return !progress.completedChapters.includes(0);
  // Previous chapter must be completed
  return progress.completedChapters.includes(chapterId - 1) && !progress.completedChapters.includes(chapterId);
}

/** Returns the highest chapter id whose minQDist <= qDist, or null if none. */
export function getChapterForDistance(qDist: number): number | null {
  let result: number | null = null;
  for (const ch of STORY_CHAPTERS) {
    if (qDist >= ch.minQDist) result = ch.id;
  }
  return result;
}

export function applyBranchEffects(chapterId: number, branchId: string): Partial<Record<AlienFactionId, number>> {
  const chapter = STORY_CHAPTERS[chapterId];
  if (!chapter?.branches) return {};
  const branch = chapter.branches.find((b) => b.id === branchId);
  return branch?.repEffects ?? {};
}
