import type { StateCreator } from 'zustand';
import { getArticle } from '../data/compendium';

export interface HelpTip {
  id: string;
  title: string;
  body: string;
  articleId?: string;
}

export const HELP_TIPS: HelpTip[] = [
  {
    id: 'first_login',
    title: 'WILLKOMMEN AN BORD',
    body: 'Klicke auf eine Zelle im Radar-Grid um einen Sektor auszuwählen. Doppelklick zentriert die Ansicht. Scroll-Rad ändert den Zoom-Level.',
    articleId: 'grundlagen-start',
  },
  {
    id: 'first_nebula',
    title: 'NEBULA-SEKTOR',
    body: 'Nebula-Sektoren enthalten Gas-Ressourcen. Scanne den Sektor zuerst um Ressourcen zu sehen. Gas kann an Handelsstationen verkauft werden.',
    articleId: 'nebel',
  },
  {
    id: 'first_station',
    title: 'RAUMSTATION',
    body: 'Stationen bieten Handel, Reparaturen und Schiffs-Upgrades. Fahre zum Sektor und öffne das Detail-Panel um verfügbare Aktionen zu sehen.',
    articleId: 'npc-stationen',
  },
  {
    id: 'first_asteroid',
    title: 'ASTEROIDENFELD',
    body: 'Asteroiden enthalten Erz. Scanne zuerst, dann starte das Mining im Detail-Panel. Mining läuft automatisch bis du es stoppst oder die Fracht voll ist.',
    articleId: 'mining',
  },
  {
    id: 'first_mining',
    title: 'MINING-LASER TIPP',
    body: 'Ohne Mining-Laser baust du langsam ab (0.1/s). Ein Laser macht dich 10x schneller!\n\n'
      + '→ Fliege zu einer STATION (◇ auf dem Radar)\n'
      + '→ Öffne BASE-LINK → Tab SHOP\n'
      + '→ Kaufe MINING LASER MK.I (100 CR, 10 Erz)\n'
      + '→ Wechsle zum Tab MODULE\n'
      + '→ Wähle den Laser aus und setze ihn in Slot 6 (MINING) ein\n\n'
      + 'Erz bekommst du durch Mining, Credits durch Verkauf an Stationen.',
    articleId: 'mining',
  },
  {
    id: 'first_acep_tab',
    title: 'ACEP — PILOTENENTWICKLUNG',
    body: 'Hier entwickelst du deinen Piloten weiter. XP sammeln sich automatisch durch Aktionen.\n\n'
      + '4 PFADE zur Spezialisierung:\n'
      + '→ AUSBAU: Extra Modul-Slots + bessere Stationsproduktion\n'
      + '→ INTEL: Bessere Scanner + mehr Scan-Reichweite\n'
      + '→ KAMPF: Stärkere Waffen + Kampfboni\n'
      + '→ EXPLORER: Schnellere Antriebe + Hyperdrive-Upgrades\n\n'
      + 'Investiere XP in einen Pfad um höhere Tier-Module freizuschalten.',
    articleId: 'acep',
  },
  {
    id: 'first_module_tab',
    title: 'MODULE — SCHIFFSAUSBAU',
    body: 'Hier verwaltest du deine Schiffsmodule.\n\n'
      + '8 Spezial-Slots: Generator, Antrieb, Waffe, Panzerung, Schild, Scanner, Mining, Fracht\n'
      + '→ Wähle ein Modul aus deinem Inventar (unten)\n'
      + '→ Klicke auf einen passenden leeren Slot zum Einbauen\n'
      + '→ Ausbauen: Klicke [X] am installierten Modul\n\n'
      + 'Höhere ACEP-Stufen (AUSBAU-Pfad) schalten Extra-Slots frei.',
    articleId: 'schiffe',
  },
  {
    id: 'first_shop_tab',
    title: 'SHOP — MODULE KAUFEN',
    body: 'An Stationen kannst du neue Module kaufen.\n\n'
      + '→ Nur freigeschaltete Module werden angezeigt\n'
      + '→ Freischaltung über Tech-Tree (Forschung) oder Blueprints\n'
      + '→ Bezahlung: Credits + Ressourcen (Erz, Gas, Kristalle)\n'
      + '→ Gekaufte Module landen im Inventar (MODULE-Tab)\n\n'
      + 'Tipp: Mining Laser MK.I ist sofort verfügbar — kein Tech-Tree nötig!',
    articleId: 'npc-stationen',
  },
  {
    id: 'first_pirate',
    title: 'PIRATEN-WARNUNG',
    body: 'Piraten-Ambush erkannt! Du kannst kämpfen, fliehen oder verhandeln. Das Ergebnis hängt von deinem Schiff und deiner Crew ab. Schwache Schiffe sollten fliehen.',
    articleId: 'piraten',
  },
  {
    id: 'first_distress',
    title: 'NOTRUF EMPFANGEN',
    body: 'Ein Notruf wurde entdeckt. Fliege zum Sektor und klicke RETTEN um Überlebende aufzunehmen. Du brauchst freie Safe-Slots in deinem Schiff. Bringt Belohnungen.',
    articleId: 'rettung',
  },
  {
    id: 'low_fuel',
    title: 'TREIBSTOFF NIEDRIG',
    body: 'Treibstoff ist fast leer! Fliege zu einer Raumstation zum Auftanken, oder nutze die Notfall-Treibstoff Option wenn du feststeckst.',
    articleId: 'treibstoff',
  },
  {
    id: 'first_anomaly',
    title: 'ANOMALIE ENTDECKT',
    body: 'Anomalien liefern Erfahrungspunkte und Ruf-Boni. Scanne den Sektor vollständig um alle Geheimnisse zu entdecken.',
    articleId: 'scan',
  },
  {
    id: 'ap-depleted-first',
    title: 'ACTION POINTS',
    body: 'AP powers all movement and actions. They regenerate automatically — watch the bar in the status panel.',
  },
  // Quest onboarding (#492)
  {
    id: 'first_quest_screen',
    title: 'QUESTS — AUFTRÄGE',
    body: 'Hier verwaltest du deine Aufträge.\n\n'
      + '→ AUFTRÄGE: Deine aktiven Quests mit Fortschritt\n'
      + '→ VERFÜGBAR: Neue Quests an der aktuellen Station\n'
      + '→ STORY: Fraktions-Geschichten zum Freischalten\n\n'
      + 'Fliege zu einer Station (◇) um Quests anzunehmen. Max. 3 gleichzeitig aktiv.',
    articleId: 'quests',
  },
  {
    id: 'first_quest_accept',
    title: 'QUEST ANGENOMMEN',
    body: 'Dein erster Auftrag! So gehst du vor:\n\n'
      + '→ Öffne QUESTS → Tab AUFTRÄGE um dein Ziel zu sehen\n'
      + '→ Klicke [TRACKEN] um das Ziel in der Bookmark-Leiste anzuzeigen\n'
      + '→ Navigiere zum Ziel-Sektor und führe die Aufgabe aus\n'
      + '→ Kehre zur Station zurück um die Belohnung abzuholen\n\n'
      + 'Quests verfallen nach 7 Tagen.',
    articleId: 'quests',
  },
  {
    id: 'first_quest_scan',
    title: 'SCAN-QUEST',
    body: 'Fliege zum markierten Sektor und führe einen Lokal-Scan durch.\n\n'
      + '→ Navigiere zum Ziel (Koordinaten im Quest-Detail)\n'
      + '→ Drücke [SCAN] im Detail-Panel\n'
      + '→ Nach Abschluss aller Scans erhältst du ein Data Slate\n'
      + '→ Bringe das Data Slate zur Auftragsstation zurück',
    articleId: 'scan',
  },
  {
    id: 'first_quest_fetch',
    title: 'SAMMEL-QUEST',
    body: 'Sammle die angeforderten Ressourcen und liefere sie ab.\n\n'
      + '→ Mine Erz, Gas oder Kristalle in passenden Sektoren\n'
      + '→ Wenn genug gesammelt: kehre zur Auftragsstation zurück\n'
      + '→ Die Abgabe erfolgt automatisch bei Ankunft',
    articleId: 'quests',
  },
  {
    id: 'first_quest_bounty',
    title: 'KOPFGELD-QUEST',
    body: 'Verfolge ein Ziel durch mehrere Sektoren.\n\n'
      + '→ Folge den Hinweisen im Quest-Tracker (Bookmark-Leiste)\n'
      + '→ Scanne jeden Hinweis-Sektor um die Spur aufzunehmen\n'
      + '→ Am Ende: Kampf gegen das Ziel\n'
      + '→ Bringe den Gefangenen zur Auftragsstation zurück',
    articleId: 'quests',
  },
  {
    id: 'first_quest_delivery',
    title: 'LIEFER-QUEST',
    body: 'Transportiere Waren zwischen Stationen.\n\n'
      + '→ Die Fracht wird automatisch geladen\n'
      + '→ Navigiere zur Ziel-Station\n'
      + '→ Abgabe erfolgt bei Ankunft an der richtigen Station',
    articleId: 'quests',
  },
  {
    id: 'first_quest_complete',
    title: 'QUEST ABGESCHLOSSEN!',
    body: 'Gut gemacht! Belohnungen werden automatisch gutgeschrieben.\n\n'
      + '→ Credits, XP und Ruf steigen sofort\n'
      + '→ Manche Quests geben Blueprints oder seltene Items\n'
      + '→ Höherer Ruf schaltet bessere Quests frei\n'
      + '→ Nimm den nächsten Auftrag an einer Station an!',
    articleId: 'quests',
  },
  {
    id: 'first_npc_trade',
    title: 'HANDELS-NPC ENTDECKT',
    body: 'Ein fliegender Händler! Diese NPCs reisen zwischen Stationen.\n\n'
      + '→ [HANDELN] öffnet den Ressourcen-Handel\n'
      + '→ Preise sind besser je weiter von Stationen entfernt\n'
      + '→ Der NPC hat begrenztes Inventar\n'
      + '→ [KOMMUNIZIEREN] für Quest-Übergaben',
  },
  {
    id: 'first_npc_military',
    title: 'MILITÄR-PATROUILLE',
    body: 'Eine Militär-Patrouille! Diese NPCs sichern die Quadrant-Grenzen.\n\n'
      + '→ [KOMMUNIZIEREN] für Informationen oder Quest-Übergaben\n'
      + '→ Militär-NPCs bieten keinen Handel an',
  },
  {
    id: 'first_npc_outlaw',
    title: 'OUTLAW ENTDECKT!',
    body: 'Ein Outlaw wurde durch deinen Scan aufgedeckt!\n\n'
      + '→ [ANGREIFEN] startet einen Kampf\n'
      + '→ [HANDELN] nur mit NEUTRAL+ Reputation möglich (20% Rabatt)\n'
      + '→ Bei HOSTILE Reputation greifen Outlaws automatisch an\n'
      + '→ Besiegte Outlaws respawnen nach 2 Stunden',
  },
  {
    id: 'first_npc_quest',
    title: 'NPC-QUEST',
    body: 'Dieser Quest führt zu einem NPC im Weltraum.\n\n'
      + '→ NPC-Position wird im Quest-Tracker angezeigt\n'
      + '→ Achtung: NPCs bewegen sich! Die Position aktualisiert sich\n'
      + '→ Im gleichen Sektor: [KOMMUNIZIEREN] zum Abschließen\n'
      + '→ Quest-Items werden automatisch übergeben',
    articleId: 'quests',
  },
  // ── Fehlende HelpSlices (#494) ────────────────────────────────────
  {
    id: 'first_nav_com',
    title: '◈ NAV-COM — NAVIGATION',
    body: 'Dein Navigationscomputer zeigt die Sektorkarte.\n\n'
      + '→ Pfeiltasten oder D-Pad zum Bewegen (1 Sektor pro Klick)\n'
      + '→ LOCAL SCAN: aktuellen Sektor scannen (5 AP)\n'
      + '→ AREA SCAN: große Fläche aufdecken (3 AP)\n'
      + '→ Klicke Sektoren auf der Karte für Details\n'
      + '→ Bookmarks: speichere wichtige Positionen',
  },
  {
    id: 'first_trade_station',
    title: '◈ HANDEL AN STATION',
    body: 'An Stationen kannst du Ressourcen kaufen und verkaufen.\n\n'
      + '→ +/- Buttons: Menge wählen\n'
      + '→ BUY: Kaufen vom NPC (Preis abhängig vom Bestand)\n'
      + '→ SELL: Verkaufen an NPC\n'
      + '→ Preise variieren je nach Angebot und Nachfrage\n'
      + '→ [ANDOCKEN] für Reparatur und Auftanken',
  },
  {
    id: 'first_tech_tree',
    title: '◈ TECH-BAUM — FORSCHUNG',
    body: 'Im Tech-Baum erforschst du neue Module und Upgrades.\n\n'
      + '→ Wissen investieren (10 W pro Forschung)\n'
      + '→ 13 Kategorien: Antrieb, Generator, Waffen, Schild...\n'
      + '→ Höhere Tiers brauchen vorherige Stufen\n'
      + '→ Erforschte Module können in der FABRIK hergestellt werden',
  },
  {
    id: 'first_quad_map',
    title: '◈ QUADRANTEN-KARTE',
    body: 'Die QUAD-MAP zeigt die galaktische Übersicht.\n\n'
      + '→ Jeder Quadrant = 500×500 Sektoren\n'
      + '→ Farben zeigen Fraktionsgebiete\n'
      + '→ Menschliches Territorium: Quadranten um (0,0)\n'
      + '→ Alien-Fraktionen haben eigene Heimatwelten',
  },
  {
    id: 'first_friends',
    title: '◈ FRIENDS — SPIELER-NETZWERK',
    body: 'Verwalte deine Kontakte und Freundschaften.\n\n'
      + '→ Spieler-Karte: Klicke einen Spielernamen im Chat\n'
      + '→ Freundschaftsanfrage senden\n'
      + '→ Direktnachrichten an Freunde (cross-quadrant)\n'
      + '→ Spieler blockieren bei Bedarf',
  },
  {
    id: 'first_fabrik',
    title: '◈ FABRIK — HERSTELLUNG',
    body: 'In der Fabrik stellst du Module aus Blueprints her.\n\n'
      + '→ Blueprint EINLEGEN: aus Cargo in die Fabrik laden\n'
      + '→ HERSTELLEN: startet eine Baustelle (braucht Zeit)\n'
      + '→ Rohstoffe EINZAHLEN: Ore, Gas, Crystal, Credits\n'
      + '→ Fortschritt abhängig von Fabrik-Modul-Level\n'
      + '→ Fertiges Modul erscheint im Cargo → INSTALLIEREN',
  },
  {
    id: 'first_alien_contact',
    title: '◈ ALIEN-KONTAKT',
    body: 'Du bist einer fremden Spezies begegnet!\n\n'
      + '→ Alien-Fraktionen kontrollieren eigene Quadranten\n'
      + '→ Reputation bestimmt Handelspreise und Verhalten\n'
      + '→ Positive Rep: bessere Preise, Quests, Zugang\n'
      + '→ Negative Rep: höhere Preise, Angriffe',
  },
  {
    id: 'first_combat_v3',
    title: '◈ KAMPF — TAKTISCHES GEFECHT',
    body: 'Ein Kampf hat begonnen! Wähle deine Taktik.\n\n'
      + '→ Module ein/ausschalten für Energiemanagement\n'
      + '→ Taktik: ANGRIFF (mehr Schaden) / AUSGEWOGEN / DEFENSIV (mehr Schutz)\n'
      + '→ [AKTION] führt eine Kampfrunde aus\n'
      + '→ [FLIEHEN] versucht den Kampf zu beenden\n'
      + '→ Zerstörte Module können repariert werden',
  },
  {
    id: 'first_bookmark',
    title: '◈ LESEZEICHEN GESETZT',
    body: 'Du hast einen Sektor als Lesezeichen gespeichert.\n\n'
      + '→ Lesezeichen erscheinen in der NAV-COM Seitenleiste\n'
      + '→ Klick auf ein Lesezeichen zentriert die Karte\n'
      + '→ Doppelklick startet den Autopiloten\n'
      + '→ Max 5 Lesezeichen gleichzeitig',
  },
  {
    id: 'first_hyperjump',
    title: '◈ HYPERJUMP',
    body: 'Dein Antrieb kann Hyperjumps ausführen!\n\n'
      + '→ Springe mehrere Sektoren auf einmal\n'
      + '→ Kosten: AP + Fuel (abhängig von Distanz)\n'
      + '→ Maximale Reichweite: abhängig von Antrieb-Level\n'
      + '→ Aufladen nach jedem Jump nötig',
  },
  {
    id: 'first_wreck',
    title: '◈ WRACK ENTDECKT',
    body: 'Ein Schiffswrack wurde gefunden!\n\n'
      + '→ [UNTERSUCHEN] startet die Bergung\n'
      + '→ Schwierigkeit variiert — höher = bessere Beute\n'
      + '→ Mögliche Funde: Module, Blueprints, Data Slates\n'
      + '→ Data Slates enthalten Koordinaten zu weiteren Orten',
  },
  {
    id: 'first_starter_modules',
    title: '◈ WILLKOMMEN, PILOT!',
    body: 'Du hast Starter-Ausrüstung erhalten!\n\n'
      + '→ 1. Öffne ACEP → [MODULE] → Module einbauen\n'
      + '→ 2. Öffne TECH → MINING → T1 erforschen (10 Wissen)\n'
      + '→ 3. Öffne FABRIK → Mining Laser herstellen (10 Ore + 100 CR)\n'
      + '→ 4. Mining Laser einbauen → Asteroidenfeld suchen → Minen!\n'
      + '→ Tipp: AREA SCAN deckt viele Sektoren auf einmal auf',
  },
  {
    id: 'first_gate_network',
    title: '◈ GATE-NETZWERK',
    body: 'Der Netzplan zeigt alle verbundenen Jumpgates.\n\n'
      + '→ Klicke einen Knoten für Route und Kosten\n'
      + '→ Fuel + Maut (CR) pro Hop\n'
      + '→ [SPRINGEN] zum Reisen\n'
      + '→ Gestrichelte Linien = indirekte Verbindungen',
  },
];

export interface HelpSlice {
  activeTip: HelpTip | null;
  seenTips: Set<string>;
  showTip: (tipId: string) => void;
  dismissTip: () => void;
  hasSeenTip: (tipId: string) => boolean;
  compendiumOpen: boolean;
  compendiumArticleId: string | null;
  compendiumSearch: string;
  openCompendium: (articleId?: string) => void;
  closeCompendium: () => void;
  setCompendiumArticle: (id: string) => void;
  setCompendiumSearch: (query: string) => void;
  showArticlePopup: (articleId: string) => void;
  onboardingStep: number | null;
  advanceOnboarding: () => void;
  skipOnboarding: () => void;
}

const STORAGE_KEY = 'vs_seen_tips';

function loadSeenTips(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeenTips(tips: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...tips]));
  } catch {
    /* ignore */
  }
}

export const createHelpSlice: StateCreator<HelpSlice> = (set, get) => ({
  activeTip: null,
  seenTips: loadSeenTips(),
  compendiumOpen: false,
  compendiumArticleId: null,
  compendiumSearch: '',
  onboardingStep: (() => {
    try {
      return localStorage.getItem('vs_first_run') ? null : 0;
    } catch {
      return 0;
    }
  })(),

  showTip: (tipId) => {
    if (get().seenTips.has(tipId)) return;
    const tip = HELP_TIPS.find((t) => t.id === tipId);
    if (!tip) return;
    const newSeen = new Set(get().seenTips);
    newSeen.add(tipId);
    saveSeenTips(newSeen);
    set({ activeTip: tip, seenTips: newSeen });
  },

  dismissTip: () => set({ activeTip: null }),

  hasSeenTip: (tipId) => get().seenTips.has(tipId),

  openCompendium: (articleId) =>
    set({
      compendiumOpen: true,
      compendiumArticleId: articleId ?? null,
      activeTip: null,
    }),

  closeCompendium: () =>
    set({
      compendiumOpen: false,
      compendiumArticleId: null,
      compendiumSearch: '',
    }),

  setCompendiumArticle: (id) => set({ compendiumArticleId: id }),

  setCompendiumSearch: (query) => set({ compendiumSearch: query }),

  showArticlePopup: (articleId) => {
    const article = getArticle(articleId);
    if (!article) return;
    set({
      activeTip: {
        id: `compendium_${articleId}`,
        title: article.title,
        body: article.summary,
        articleId,
      },
    });
  },

  advanceOnboarding: () => {
    const current = get().onboardingStep;
    if (current === null) return;
    if (current >= 3) {
      try { localStorage.setItem('vs_first_run', '1'); } catch {}
      set({ onboardingStep: null });
    } else {
      set({ onboardingStep: current + 1 });
    }
  },

  skipOnboarding: () => {
    try { localStorage.setItem('vs_first_run', '1'); } catch {}
    set({ onboardingStep: null });
  },
});
