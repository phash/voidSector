import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompendiumOverlay } from '../components/CompendiumOverlay';
import { mockStoreState } from '../test/mockStore';
import { useStore } from '../state/store';
import {
  COMPENDIUM_CATEGORIES,
  COMPENDIUM_ARTICLES,
  getArticle,
  getArticlesByCategory,
} from '../data/compendium';

function setupStore(overrides: Record<string, unknown> = {}) {
  mockStoreState({
    compendiumOpen: false,
    compendiumArticleId: null,
    compendiumSearch: '',
    openCompendium: vi.fn(),
    closeCompendium: () => useStore.setState({ compendiumOpen: false }),
    setCompendiumArticle: (id: string) =>
      useStore.setState({ compendiumArticleId: id }),
    setCompendiumSearch: (query: string) =>
      useStore.setState({ compendiumSearch: query }),
    showArticlePopup: vi.fn(),
    ...overrides,
  } as any);
}

describe('CompendiumOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it('does not render when compendiumOpen is false', () => {
    render(<CompendiumOverlay />);
    expect(screen.queryByTestId('compendium-overlay')).toBeNull();
  });

  it('renders overlay when compendiumOpen is true', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    expect(screen.getByTestId('compendium-overlay')).toBeDefined();
  });

  it('displays KOMPENDIUM title', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    const matches = screen.getAllByText(/KOMPENDIUM/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders sidebar with search input', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    expect(screen.getByTestId('compendium-sidebar')).toBeDefined();
    expect(screen.getByTestId('compendium-search')).toBeDefined();
  });

  it('renders category buttons', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    for (const cat of COMPENDIUM_CATEGORIES) {
      expect(screen.getByTestId(`compendium-cat-${cat.id}`)).toBeDefined();
    }
  });

  it('shows welcome page when no article is selected', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    expect(screen.getByText(/Willkommen im Kompendium/)).toBeDefined();
  });

  it('expands category on click and shows articles', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    const catButton = screen.getByTestId('compendium-cat-grundlagen');
    fireEvent.click(catButton);
    const articles = getArticlesByCategory('grundlagen');
    for (const a of articles) {
      expect(screen.getByTestId(`compendium-item-${a.id}`)).toBeDefined();
    }
  });

  it('collapses category on second click', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    const catButton = screen.getByTestId('compendium-cat-grundlagen');
    fireEvent.click(catButton); // expand
    const articles = getArticlesByCategory('grundlagen');
    expect(
      screen.getByTestId(`compendium-item-${articles[0].id}`)
    ).toBeDefined();
    fireEvent.click(catButton); // collapse
    expect(
      screen.queryByTestId(`compendium-item-${articles[0].id}`)
    ).toBeNull();
  });

  it('displays selected article content', () => {
    const article = COMPENDIUM_ARTICLES[0];
    setupStore({ compendiumOpen: true, compendiumArticleId: article.id });
    render(<CompendiumOverlay />);
    // Title appears in both sidebar and article heading
    const matches = screen.getAllByText(new RegExp(article.title));
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(article.summary)).toBeDefined();
  });

  it('navigates to article on sidebar item click', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    // Expand grundlagen category
    fireEvent.click(screen.getByTestId('compendium-cat-grundlagen'));
    const articles = getArticlesByCategory('grundlagen');
    const targetArticle = articles[0];
    fireEvent.click(screen.getByTestId(`compendium-item-${targetArticle.id}`));
    const state = useStore.getState();
    expect(state.compendiumArticleId).toBe(targetArticle.id);
  });

  it('renders seeAlso links for articles that have them', () => {
    const article = COMPENDIUM_ARTICLES.find(
      (a) => a.seeAlso && a.seeAlso.length > 0
    )!;
    setupStore({ compendiumOpen: true, compendiumArticleId: article.id });
    render(<CompendiumOverlay />);
    expect(screen.getByTestId('compendium-see-also')).toBeDefined();
    expect(screen.getByText('SIEHE AUCH')).toBeDefined();
    for (const refId of article.seeAlso!) {
      const refArticle = getArticle(refId);
      if (refArticle) {
        expect(
          screen.getByTestId(`compendium-see-also-${refId}`)
        ).toBeDefined();
      }
    }
  });

  it('navigates to article via seeAlso link click', () => {
    const article = COMPENDIUM_ARTICLES.find(
      (a) => a.seeAlso && a.seeAlso.length > 0
    )!;
    setupStore({ compendiumOpen: true, compendiumArticleId: article.id });
    render(<CompendiumOverlay />);
    const firstRef = article.seeAlso![0];
    fireEvent.click(screen.getByTestId(`compendium-see-also-${firstRef}`));
    const state = useStore.getState();
    expect(state.compendiumArticleId).toBe(firstRef);
  });

  it('filters articles by search query', () => {
    setupStore({ compendiumOpen: true, compendiumSearch: 'mining' });
    render(<CompendiumOverlay />);
    expect(screen.getByText(/TREFFER/)).toBeDefined();
  });

  it('updates search on input change', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    const input = screen.getByTestId('compendium-search');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(useStore.getState().compendiumSearch).toBe('test');
  });

  it('closes on ESC key press', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useStore.getState().compendiumOpen).toBe(false);
  });

  it('closes on [X] button click', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    fireEvent.click(screen.getByTestId('compendium-close'));
    expect(useStore.getState().compendiumOpen).toBe(false);
  });

  it('closes on backdrop click', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    fireEvent.click(screen.getByTestId('compendium-overlay'));
    expect(useStore.getState().compendiumOpen).toBe(false);
  });

  it('does not close when clicking inside content', () => {
    setupStore({ compendiumOpen: true });
    render(<CompendiumOverlay />);
    fireEvent.click(screen.getByTestId('compendium-content'));
    expect(useStore.getState().compendiumOpen).toBe(true);
  });

  it('renders bold text from body markup', () => {
    const article = COMPENDIUM_ARTICLES[0]; // has **bold** in body
    setupStore({ compendiumOpen: true, compendiumArticleId: article.id });
    const { container } = render(<CompendiumOverlay />);
    const strongs = container.querySelectorAll('strong');
    expect(strongs.length).toBeGreaterThan(0);
  });

  it('renders list items from body markup', () => {
    const article = COMPENDIUM_ARTICLES[0]; // has "- " list items
    setupStore({ compendiumOpen: true, compendiumArticleId: article.id });
    const { container } = render(<CompendiumOverlay />);
    const listItems = container.querySelectorAll('li');
    expect(listItems.length).toBeGreaterThan(0);
  });

  it('highlights active article in sidebar', () => {
    const article = COMPENDIUM_ARTICLES[0];
    setupStore({ compendiumOpen: true, compendiumArticleId: article.id });
    render(<CompendiumOverlay />);
    const item = screen.getByTestId(`compendium-item-${article.id}`);
    expect(item.textContent).toContain('▸');
  });

  it('auto-expands category of active article', () => {
    const article = COMPENDIUM_ARTICLES[0]; // grundlagen
    setupStore({ compendiumOpen: true, compendiumArticleId: article.id });
    render(<CompendiumOverlay />);
    // The sidebar item should be visible (category auto-expanded)
    expect(screen.getByTestId(`compendium-item-${article.id}`)).toBeDefined();
  });
});
