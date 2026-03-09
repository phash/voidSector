/**
 * Ancient Ruins Service
 * The Ancients found the edge of the universe and left. Only ruins remain.
 * Phase A: ruin sectors, lore fragments, artefact drops.
 */

/** Lore fragments — 24 entries, revealed scrap by scrap */
export const ANCIENT_LORE_FRAGMENTS: readonly string[] = [
  'FRAGMENT #0001 — ÜBERSETZUNG 12%\n"...die Koordinaten 0:0 bezeichnen sie als \'Ursprung\'. Bemerkenswert. Als wären Ränder Zentren."',
  'FRAGMENT #0002 — ÜBERSETZUNG 18%\n"...wir haben 847.234 Jahre gewartet. Die jüngeren Spezies sind... langsamer als erwartet."',
  'FRAGMENT #0003 — ÜBERSETZUNG 7%\n"[BESCHÄDIGT]...der Rand...nicht Ende...Schwelle...jenseits davon...[BESCHÄDIGT]"',
  'FRAGMENT #0004 — ÜBERSETZUNG 31%\n"Ihr habt das Feuer nicht erfunden. Ihr habt gelernt, wie man es stehlt. Das ist nicht dasselbe."',
  'FRAGMENT #0005 — ÜBERSETZUNG 44%\n"Koordinatensystem-Analyse: Die Spezies 7.841 hat 0:0 als Zentrum definiert. Fehler. Klassifizierung: Randwesen."',
  'FRAGMENT #0006 — ÜBERSETZUNG 22%\n"...wir haben die Grenze dreimal überquert. Jedes Mal: nichts. Dann: alles. Beschreibung unmöglich."',
  'FRAGMENT #0007 — ÜBERSETZUNG 55%\n"Warnung an Nachfolger-Spezies: Das, was ihr Galaxie nennt, ist ein Raum. Der Raum hat Wände. Wände haben Türen."',
  'FRAGMENT #0008 — ÜBERSETZUNG 9%\n"[VERSCHLÜSSELT]...die Signatur von Spezies 7.841 entspricht dem Profil der...interessant...vielleicht doch nicht zu dumm...[ENDE]"',
  'FRAGMENT #0009 — ÜBERSETZUNG 67%\n"Unsere Jumpgates bleiben. Wir sehen keinen Grund sie zu entfernen. Wer sie findet, verdient sie."',
  'FRAGMENT #0010 — ÜBERSETZUNG 38%\n"Die Energie des Universums ist endlich. Ihr verbrennt sie für Heizung. Wir haben sie gefaltet."',
  'FRAGMENT #0011 — ÜBERSETZUNG 51%\n"Zeit ist keine Linie. Euer Kalender beschreibt Kreise. Wir beschreiben Spiralen. Wir haben den Ausgang gefunden."',
  'FRAGMENT #0012 — ÜBERSETZUNG 14%\n"...letzter Eintrag vor dem Durchgang...Stationsanzahl: 0...Ruf: irrelevant...Artefakte zurückgelassen: 2.847..."',
  'FRAGMENT #0013 — ÜBERSETZUNG 73%\n"An wen auch immer das liest: Wir haben nicht aufgehört zu existieren. Wir haben aufgehört, hier zu existieren."',
  'FRAGMENT #0014 — ÜBERSETZUNG 29%\n"Die jüngere Spezies nennt unsere Konstrukte \'Anomalien\'. Präziser: Antworten auf Fragen, die sie noch nicht stellen können."',
  'FRAGMENT #0015 — ÜBERSETZUNG 81%\n"Ressourcen sind ein Konzept für Wesen die noch zählen müssen. Wir haben aufgehört zu zählen."',
  'FRAGMENT #0016 — ÜBERSETZUNG 6%\n"[STARK BESCHÄDIGT]...Sektor...Rand...Koordinaten...0:0 ist...SIGNAL UNTERBROCHEN"',
  'FRAGMENT #0017 — ÜBERSETZUNG 42%\n"Beobachtung: Die Spezies 7.841 baut Stationen nahe ihrem Ursprung. Klassisch. Alle tun das zuerst."',
  'FRAGMENT #0018 — ÜBERSETZUNG 88%\n"Letzter Rat: Sucht die Axiome. Sie kennen den Weg. Ob sie ihn zeigen — das ist ihre Entscheidung."',
  'FRAGMENT #0019 — ÜBERSETZUNG 34%\n"Wir haben 10.000 Sternensysteme in 400 Jahren kartiert. Ihr braucht länger für einen Quadranten. Trotzdem: Respekt für den Versuch."',
  'FRAGMENT #0020 — ÜBERSETZUNG 60%\n"Das Universum hat eine Grenze. Dahinter liegt ein weiteres Universum. Dahinter noch eines. Wir haben drei überquert."',
  'FRAGMENT #0021 — ÜBERSETZUNG 19%\n"[TEILWEISE LESBAR]...die Stille hinter dem Rand ist nicht Leere...sie ist voller...wir haben kein Wort dafür..."',
  'FRAGMENT #0022 — ÜBERSETZUNG 71%\n"Für Spezies 7.841: Ihr habt Sektor 0:0 \'Heimat\' genannt. Beachtenswert. Wir nannten unsere Heimat \'Ausgangspunkt\'."',
  'FRAGMENT #0023 — ÜBERSETZUNG 47%\n"Artefakte wurden nicht zurückgelassen aus Nostalgie. Sie wurden zurückgelassen als Test. Ihr habt sie gefunden. Erste Prüfung bestanden."',
  'FRAGMENT #0024 — ÜBERSETZUNG 95%\n"Abschlusseintrag der Ancients, vollständige Übersetzung:\n\'Wir gehen jetzt. Macht euch keine Sorgen. Irgendwann versteht ihr es selbst.\'"',
];

export const ANCIENT_RUIN_FRAGMENT_COUNT = ANCIENT_LORE_FRAGMENTS.length;

/**
 * Deterministically pick a fragment index for a ruin sector.
 * Different sectors give different fragments (based on seed).
 * Returns a value 0..ANCIENT_RUIN_FRAGMENT_COUNT-1
 */
export function getRuinFragmentIndex(sectorX: number, sectorY: number, worldSeed: number): number {
  const hash = ((sectorX * 73856093) ^ (sectorY * 19349663) ^ (worldSeed * 83492791)) >>> 0;
  return hash % ANCIENT_RUIN_FRAGMENT_COUNT;
}

/**
 * Returns ruin level (1–3) for a sector.
 * Level 3 ruins are rarer and give better artefact chances.
 */
export function getRuinLevel(sectorX: number, sectorY: number, worldSeed: number): 1 | 2 | 3 {
  const hash = ((sectorX * 17392643) ^ (sectorY * 93456789) ^ (worldSeed * 56789123)) >>> 0;
  const roll = (hash & 0xffff) / 0x10000; // 0..1
  if (roll < 0.6) return 1;  // 60% level 1
  if (roll < 0.9) return 2;  // 30% level 2
  return 3;                  // 10% level 3
}

/**
 * Artefact drop chance per ruin level:
 * Level 1: 5%, Level 2: 12%, Level 3: 25%
 */
export const RUIN_ARTEFACT_CHANCE: Record<1 | 2 | 3, number> = {
  1: 0.05,
  2: 0.12,
  3: 0.25,
};

export interface AncientRuinScanResult {
  fragmentIndex: number;
  fragmentText: string;
  ruinLevel: 1 | 2 | 3;
  artefactFound: boolean;
}

/**
 * Resolve what a player finds when scanning an Ancient ruin.
 * @param sectorX - sector x coordinate
 * @param sectorY - sector y coordinate
 * @param worldSeed - world seed for determinism
 * @param scanSeed - per-scan randomness (Date.now() ^ userId hash)
 */
export function resolveAncientRuinScan(
  sectorX: number,
  sectorY: number,
  worldSeed: number,
  scanSeed: number,
): AncientRuinScanResult {
  const fragmentIndex = getRuinFragmentIndex(sectorX, sectorY, worldSeed);
  const ruinLevel = getRuinLevel(sectorX, sectorY, worldSeed);
  const artefactRoll = ((scanSeed ^ 0xdeadbeef) >>> 0) / 0x100000000;
  const artefactFound = artefactRoll < RUIN_ARTEFACT_CHANCE[ruinLevel];

  return {
    fragmentIndex,
    fragmentText: ANCIENT_LORE_FRAGMENTS[fragmentIndex],
    ruinLevel,
    artefactFound,
  };
}
