import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from 'zustand';
import { createHelpSlice, HELP_TIPS } from '../state/helpSlice';

beforeEach(() => {
  try {
    localStorage.removeItem('vs_seen_tips');
  } catch {
    /* noop */
  }
});

// Mock compendium data
vi.mock('../data/compendium', () => ({
  getArticle: (id: string) => {
    const articles: Record<string, { id: string; title: string; summary: string }> = {
      'grundlagen-start': {
        id: 'grundlagen-start',
        title: 'ERSTE SCHRITTE',
        summary: 'Willkommen bei voidSector! Lerne die Grundlagen.',
      },
      mining: {
        id: 'mining',
        title: 'MINING',
        summary: 'Erz, Gas und Kristalle abbauen.',
      },
    };
    return articles[id] ?? undefined;
  },
}));

describe('HelpSlice', () => {
  it('starts with no active tip', () => {
    const store = createStore(createHelpSlice);
    expect(store.getState().activeTip).toBeNull();
  });

  it('showTip sets activeTip', () => {
    const store = createStore(createHelpSlice);
    store.getState().showTip('first_login');
    expect(store.getState().activeTip?.id).toBe('first_login');
  });

  it('dismissTip clears activeTip', () => {
    const store = createStore(createHelpSlice);
    store.getState().showTip('first_login');
    store.getState().dismissTip();
    expect(store.getState().activeTip).toBeNull();
  });

  it('does not show a tip twice', () => {
    const store = createStore(createHelpSlice);
    store.getState().showTip('first_login');
    store.getState().dismissTip();
    store.getState().showTip('first_login'); // second time
    expect(store.getState().activeTip).toBeNull(); // already seen
  });

  it('HELP_TIPS with articleId have string references', () => {
    for (const tip of HELP_TIPS) {
      if (tip.articleId !== undefined) {
        expect(typeof tip.articleId).toBe('string');
      }
    }
  });

  it('HELP_TIPS all have id, title, and body', () => {
    for (const tip of HELP_TIPS) {
      expect(typeof tip.id).toBe('string');
      expect(typeof tip.title).toBe('string');
      expect(typeof tip.body).toBe('string');
    }
  });

  describe('Compendium state', () => {
    it('starts with compendium closed', () => {
      const store = createStore(createHelpSlice);
      expect(store.getState().compendiumOpen).toBe(false);
      expect(store.getState().compendiumArticleId).toBeNull();
      expect(store.getState().compendiumSearch).toBe('');
    });

    it('openCompendium opens the overlay', () => {
      const store = createStore(createHelpSlice);
      store.getState().openCompendium();
      expect(store.getState().compendiumOpen).toBe(true);
      expect(store.getState().compendiumArticleId).toBeNull();
    });

    it('openCompendium with articleId jumps to article', () => {
      const store = createStore(createHelpSlice);
      store.getState().openCompendium('mining');
      expect(store.getState().compendiumOpen).toBe(true);
      expect(store.getState().compendiumArticleId).toBe('mining');
    });

    it('openCompendium dismisses active tip', () => {
      const store = createStore(createHelpSlice);
      store.getState().showTip('first_login');
      expect(store.getState().activeTip).not.toBeNull();
      store.getState().openCompendium();
      expect(store.getState().activeTip).toBeNull();
    });

    it('closeCompendium resets compendium state', () => {
      const store = createStore(createHelpSlice);
      store.getState().openCompendium('mining');
      store.getState().setCompendiumSearch('erz');
      store.getState().closeCompendium();
      expect(store.getState().compendiumOpen).toBe(false);
      expect(store.getState().compendiumArticleId).toBeNull();
      expect(store.getState().compendiumSearch).toBe('');
    });

    it('setCompendiumArticle navigates to an article', () => {
      const store = createStore(createHelpSlice);
      store.getState().openCompendium();
      store.getState().setCompendiumArticle('grundlagen-start');
      expect(store.getState().compendiumArticleId).toBe('grundlagen-start');
    });

    it('setCompendiumSearch updates search query', () => {
      const store = createStore(createHelpSlice);
      store.getState().setCompendiumSearch('navigation');
      expect(store.getState().compendiumSearch).toBe('navigation');
    });

    it('setCompendiumSearch can clear search', () => {
      const store = createStore(createHelpSlice);
      store.getState().setCompendiumSearch('test');
      store.getState().setCompendiumSearch('');
      expect(store.getState().compendiumSearch).toBe('');
    });
  });

  describe('showArticlePopup', () => {
    it('shows article summary as a tip popup', () => {
      const store = createStore(createHelpSlice);
      store.getState().showArticlePopup('grundlagen-start');
      const tip = store.getState().activeTip;
      expect(tip).not.toBeNull();
      expect(tip!.id).toBe('compendium_grundlagen-start');
      expect(tip!.title).toBe('ERSTE SCHRITTE');
      expect(tip!.body).toBe('Willkommen bei voidSector! Lerne die Grundlagen.');
      expect(tip!.articleId).toBe('grundlagen-start');
    });

    it('does nothing for unknown article', () => {
      const store = createStore(createHelpSlice);
      store.getState().showArticlePopup('nonexistent-article');
      expect(store.getState().activeTip).toBeNull();
    });

    it('popup tip includes articleId for compendium link', () => {
      const store = createStore(createHelpSlice);
      store.getState().showArticlePopup('mining');
      const tip = store.getState().activeTip;
      expect(tip!.articleId).toBe('mining');
    });

    it('popup can be dismissed and then open compendium with article', () => {
      const store = createStore(createHelpSlice);
      store.getState().showArticlePopup('mining');
      const articleId = store.getState().activeTip!.articleId!;
      store.getState().openCompendium(articleId);
      expect(store.getState().activeTip).toBeNull();
      expect(store.getState().compendiumOpen).toBe(true);
      expect(store.getState().compendiumArticleId).toBe('mining');
    });
  });
});
