import { describe, it, expect } from 'vitest';
import { validateNoticeMessage, NOTICE_MAX_LEN } from '../NoticeService.js';

describe('validateNoticeMessage', () => {
  it('accepts a normal message (trimmed)', () => {
    expect(validateNoticeMessage('  Hallo Galaxis  ')).toEqual({ ok: true, message: 'Hallo Galaxis' });
  });
  it('rejects empty / whitespace-only', () => {
    expect(validateNoticeMessage('   ').ok).toBe(false);
    expect(validateNoticeMessage('').ok).toBe(false);
  });
  it(`rejects over ${NOTICE_MAX_LEN} chars`, () => {
    expect(validateNoticeMessage('x'.repeat(NOTICE_MAX_LEN + 1)).ok).toBe(false);
  });
  it('accepts exactly the max length', () => {
    expect(validateNoticeMessage('x'.repeat(NOTICE_MAX_LEN)).ok).toBe(true);
  });
});
