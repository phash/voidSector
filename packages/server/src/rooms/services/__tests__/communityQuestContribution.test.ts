import { describe, it, expect } from 'vitest';
import { validateContribution, CQ_CONTRIB_MAX } from '../CommunityQuestService.js';

describe('validateContribution', () => {
  it('accepts ore/gas/crystal with a positive integer amount', () => {
    for (const r of ['ore', 'gas', 'crystal']) {
      expect(validateContribution(r, 10)).toMatchObject({ ok: true, resourceType: r, amount: 10 });
    }
  });

  it('rejects a non-basic resource', () => {
    expect(validateContribution('slate', 10).ok).toBe(false);
  });

  it('rejects amount < 1, non-integer, or over the cap', () => {
    expect(validateContribution('ore', 0).ok).toBe(false);
    expect(validateContribution('ore', 1.5).ok).toBe(false);
    expect(validateContribution('ore', CQ_CONTRIB_MAX + 1).ok).toBe(false);
  });

  it('returns BAD_RESOURCE reason for unknown resource', () => {
    const result = validateContribution('slate', 10);
    expect(result).toMatchObject({ ok: false, reason: 'BAD_RESOURCE' });
  });

  it('returns BAD_AMOUNT for amount 0', () => {
    const result = validateContribution('ore', 0);
    expect(result).toMatchObject({ ok: false, reason: 'BAD_AMOUNT' });
  });

  it('returns TOO_MUCH reason when over cap', () => {
    const result = validateContribution('ore', CQ_CONTRIB_MAX + 1);
    expect(result).toMatchObject({ ok: false, reason: 'TOO_MUCH' });
  });

  it('accepts exactly the cap', () => {
    expect(validateContribution('crystal', CQ_CONTRIB_MAX)).toMatchObject({
      ok: true,
      resourceType: 'crystal',
      amount: CQ_CONTRIB_MAX,
    });
  });

  it('accepts amount of 1', () => {
    expect(validateContribution('gas', 1)).toMatchObject({ ok: true, resourceType: 'gas', amount: 1 });
  });
});
