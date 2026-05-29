import { useState } from 'react';
import { useStore } from '../state/store';

/** Top banner for logged-in (non-guest) users whose email isn't verified yet, with a resend button. */
export function EmailVerifyBanner() {
  const token = useStore((s) => s.token);
  const isGuest = useStore((s) => s.isGuest);
  const emailVerified = useStore((s) => s.emailVerified);
  const setEmailVerified = useStore((s) => s.setEmailVerified);
  const addLogEntry = useStore((s) => s.addLogEntry);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!token || isGuest || emailVerified) return null;

  async function resend() {
    if (sending) return;
    setSending(true);
    setStatus(null);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (res.ok && data.status === 'already_verified') {
        setEmailVerified(true);
        addLogEntry('E-Mail bereits bestätigt.');
      } else if (res.ok) {
        setStatus('Mail gesendet — schau in dein Postfach.');
        addLogEntry('Bestätigungsmail erneut gesendet.');
      } else {
        setStatus(data.error || `Fehler ${res.status}`);
      }
    } catch {
      setStatus('Senden fehlgeschlagen.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      data-testid="email-verify-banner"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9500,
        background: '#3a2a00',
        borderBottom: '1px solid var(--color-primary)',
        color: 'var(--color-primary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.72rem',
        letterSpacing: '0.04em',
        textAlign: 'center',
        padding: '5px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <span>⚠ Bitte bestätige deine E-Mail-Adresse{status ? ` — ${status}` : ''}</span>
      <button
        data-testid="resend-verification-btn"
        onClick={resend}
        disabled={sending}
        style={{
          background: 'none',
          border: '1px solid var(--color-primary)',
          color: 'var(--color-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.68rem',
          letterSpacing: '0.05em',
          padding: '1px 8px',
          cursor: sending ? 'default' : 'pointer',
          opacity: sending ? 0.6 : 1,
        }}
      >
        {sending ? '…' : 'Mail erneut senden'}
      </button>
    </div>
  );
}
