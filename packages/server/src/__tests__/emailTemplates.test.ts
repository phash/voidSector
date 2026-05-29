import { describe, it, expect } from 'vitest';
import { renderVerificationEmail, escapeHtml } from '../emailTemplates.js';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml('<b>"x"&\'y\'')).toBe('&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;');
  });
});

describe('renderVerificationEmail', () => {
  const link = 'https://voidsector.mr-development.de/api/verify?token=abc123';

  it('includes subject, the verify link (text + html), and the username', () => {
    const m = renderVerificationEmail('vs1pilot', link);
    expect(m.subject).toContain('VOID SECTOR');
    expect(m.text).toContain(link);
    expect(m.text).toContain('vs1pilot');
    expect(m.html).toContain(link);
    expect(m.html).toContain('vs1pilot');
    expect(m.html).toContain('<!doctype html>');
  });

  it('escapes a username with HTML in the HTML body (no injection)', () => {
    const m = renderVerificationEmail('<script>x</script>', link);
    expect(m.html).not.toContain('<script>x</script>');
    expect(m.html).toContain('&lt;script&gt;');
    // plain-text body keeps the raw username (no HTML escaping needed there)
    expect(m.text).toContain('<script>x</script>');
  });
});
