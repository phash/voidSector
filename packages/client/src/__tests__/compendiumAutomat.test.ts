import { describe, it, expect } from 'vitest';
import { getArticle } from '../data/compendium';
import { HELP_TIPS } from '../state/helpSlice';
import { PROGRAM_TEMPLATES } from '@void-sector/shared';

describe('AUTOMAT onboarding content', () => {
  it('has a first_automat help tip linking the compendium article', () => {
    const tip = HELP_TIPS.find((t) => t.id === 'first_automat')!;
    expect(tip).toBeTruthy();
    expect(tip.articleId).toBe('schiffsprogrammierung');
  });
  it('publishes a compendium article with the real DSL keywords and every template script', () => {
    const a = getArticle('schiffsprogrammierung')!;
    expect(a).toBeTruthy();
    for (const kw of ['fly ', 'mine until full', 'sell all', 'if ', 'repeat']) expect(a.body).toContain(kw);
    for (const t of PROGRAM_TEMPLATES) {
      const firstLine = t.source.split('\n')[0];
      expect(a.body, `article must include template "${t.name}"`).toContain(firstLine);
    }
  });
});
