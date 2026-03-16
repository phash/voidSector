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
