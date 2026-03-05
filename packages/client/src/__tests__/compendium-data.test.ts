import { describe, it, expect } from 'vitest';
import {
  COMPENDIUM_ARTICLES,
  COMPENDIUM_CATEGORIES,
  getArticle,
  getArticlesByCategory,
  searchArticles,
} from '../data/compendium';
import type { CompendiumCategory } from '../data/compendium';

describe('Compendium Data', () => {
  // -------------------------------------------------------------------------
  // Article integrity
  // -------------------------------------------------------------------------

  describe('article integrity', () => {
    it('has at least 30 articles', () => {
      expect(COMPENDIUM_ARTICLES.length).toBeGreaterThanOrEqual(30);
    });

    it('every article has a non-empty id, title, and body', () => {
      for (const a of COMPENDIUM_ARTICLES) {
        expect(a.id, `article missing id`).toBeTruthy();
        expect(a.title, `article ${a.id} missing title`).toBeTruthy();
        expect(a.body, `article ${a.id} missing body`).toBeTruthy();
      }
    });

    it('every article has a valid category', () => {
      const validCats = new Set(COMPENDIUM_CATEGORIES.map((c) => c.id));
      for (const a of COMPENDIUM_ARTICLES) {
        expect(
          validCats.has(a.category),
          `article ${a.id} has invalid category '${a.category}'`,
        ).toBe(true);
      }
    });

    it('every article has a non-empty icon', () => {
      for (const a of COMPENDIUM_ARTICLES) {
        expect(a.icon.length, `article ${a.id} missing icon`).toBeGreaterThan(0);
      }
    });

    it('every article has a non-empty summary', () => {
      for (const a of COMPENDIUM_ARTICLES) {
        expect(a.summary.length, `article ${a.id} missing summary`).toBeGreaterThan(0);
      }
    });

    it('article IDs are unique', () => {
      const ids = COMPENDIUM_ARTICLES.map((a) => a.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });

  // -------------------------------------------------------------------------
  // Required article IDs
  // -------------------------------------------------------------------------

  describe('required article IDs', () => {
    const requiredIds = [
      'grundlagen-start',
      'sektoren',
      'npc-stationen',
      'mining',
      'combat-v2',
      'rettung',
      'treibstoff',
    ];

    for (const id of requiredIds) {
      it(`contains required article '${id}'`, () => {
        const article = getArticle(id);
        expect(article, `missing required article '${id}'`).toBeDefined();
        expect(article!.body.length).toBeGreaterThan(0);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------

  describe('categories', () => {
    it('has at least 8 categories', () => {
      expect(COMPENDIUM_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    });

    it('every category has id, label, and icon', () => {
      for (const c of COMPENDIUM_CATEGORIES) {
        expect(c.id).toBeTruthy();
        expect(c.label).toBeTruthy();
        expect(c.icon).toBeTruthy();
      }
    });

    it('every category has at least one article', () => {
      for (const cat of COMPENDIUM_CATEGORIES) {
        const articles = getArticlesByCategory(cat.id);
        expect(articles.length, `category '${cat.id}' has no articles`).toBeGreaterThan(0);
      }
    });

    it('category IDs are unique', () => {
      const ids = COMPENDIUM_CATEGORIES.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // -------------------------------------------------------------------------
  // seeAlso validity
  // -------------------------------------------------------------------------

  describe('seeAlso references', () => {
    it('all seeAlso IDs point to existing articles', () => {
      const allIds = new Set(COMPENDIUM_ARTICLES.map((a) => a.id));
      for (const a of COMPENDIUM_ARTICLES) {
        if (a.seeAlso) {
          for (const ref of a.seeAlso) {
            expect(
              allIds.has(ref),
              `article '${a.id}' references non-existent seeAlso '${ref}'`,
            ).toBe(true);
          }
        }
      }
    });

    it('seeAlso does not reference the article itself', () => {
      for (const a of COMPENDIUM_ARTICLES) {
        if (a.seeAlso) {
          expect(a.seeAlso.includes(a.id), `article '${a.id}' references itself in seeAlso`).toBe(
            false,
          );
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // getArticle
  // -------------------------------------------------------------------------

  describe('getArticle()', () => {
    it('returns article by id', () => {
      const article = getArticle('universum');
      expect(article).toBeDefined();
      expect(article!.title).toBe('UNIVERSUM & WELTGENERIERUNG');
    });

    it('returns undefined for unknown id', () => {
      expect(getArticle('does-not-exist')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(getArticle('')).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getArticlesByCategory
  // -------------------------------------------------------------------------

  describe('getArticlesByCategory()', () => {
    it('returns only articles of the given category', () => {
      const articles = getArticlesByCategory('kampf');
      expect(articles.length).toBeGreaterThan(0);
      for (const a of articles) {
        expect(a.category).toBe('kampf');
      }
    });

    it('returns empty array for non-matching category', () => {
      // Force a type-cast for testing purposes
      const articles = getArticlesByCategory('nonexistent' as CompendiumCategory);
      expect(articles).toEqual([]);
    });

    it('grundlagen category has at least 4 articles', () => {
      const articles = getArticlesByCategory('grundlagen');
      expect(articles.length).toBeGreaterThanOrEqual(4);
    });
  });

  // -------------------------------------------------------------------------
  // searchArticles
  // -------------------------------------------------------------------------

  describe('searchArticles()', () => {
    it('finds articles by title', () => {
      const results = searchArticles('COMBAT');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((a) => a.id === 'combat-v2')).toBe(true);
    });

    it('finds articles by tag', () => {
      const results = searchArticles('pirat');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((a) => a.id === 'piraten')).toBe(true);
    });

    it('finds articles by body content', () => {
      const results = searchArticles('Lazy Evaluation');
      expect(results.length).toBeGreaterThan(0);
    });

    it('search is case-insensitive', () => {
      const lower = searchArticles('mining');
      const upper = searchArticles('MINING');
      expect(lower.length).toBe(upper.length);
      expect(lower.map((a) => a.id).sort()).toEqual(upper.map((a) => a.id).sort());
    });

    it('returns empty array for empty query', () => {
      expect(searchArticles('')).toEqual([]);
    });

    it('returns empty array for whitespace-only query', () => {
      expect(searchArticles('   ')).toEqual([]);
    });

    it('returns empty array for non-matching query', () => {
      expect(searchArticles('xyzzyplugh12345')).toEqual([]);
    });

    it('title matches come before tag matches', () => {
      // 'RETTUNGSMISSIONEN' is a title; 'rettung' is also a tag on notwarp
      const results = searchArticles('rettung');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // The article with 'rettung' in the title should come first
      const rettungIdx = results.findIndex((a) => a.id === 'rettung');
      expect(rettungIdx).toBeGreaterThanOrEqual(0);
      // Any tag-only match should come after
      for (let i = 0; i < rettungIdx; i++) {
        expect(results[i].title.toLowerCase()).toContain('rettung');
      }
    });

    it('handles partial matches', () => {
      const results = searchArticles('nav');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Content quality
  // -------------------------------------------------------------------------

  describe('content quality', () => {
    it('every article body has at least 100 characters', () => {
      for (const a of COMPENDIUM_ARTICLES) {
        expect(
          a.body.length,
          `article '${a.id}' body too short (${a.body.length} chars)`,
        ).toBeGreaterThanOrEqual(100);
      }
    });

    it('every article summary is between 20 and 200 characters', () => {
      for (const a of COMPENDIUM_ARTICLES) {
        expect(a.summary.length, `article '${a.id}' summary too short`).toBeGreaterThanOrEqual(20);
        expect(a.summary.length, `article '${a.id}' summary too long`).toBeLessThanOrEqual(200);
      }
    });

    it('articles with tags have at least 2 tags', () => {
      for (const a of COMPENDIUM_ARTICLES) {
        if (a.tags) {
          expect(
            a.tags.length,
            `article '${a.id}' should have at least 2 tags`,
          ).toBeGreaterThanOrEqual(2);
        }
      }
    });
  });
});
