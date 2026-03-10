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
  onboardingStep: localStorage.getItem('vs_first_run') ? null : 0,

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
    if (current >= 4) {
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
