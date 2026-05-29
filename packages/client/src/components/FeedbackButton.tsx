import { useState } from 'react';
import { useStore } from '../state/store';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idee' },
  { value: 'praise', label: 'Lob' },
  { value: 'other', label: 'Sonstiges' },
];

export function FeedbackButton() {
  const token = useStore((s) => s.token);
  const isGuest = useStore((s) => s.isGuest);
  const addLogEntry = useStore((s) => s.addLogEntry);
  const showTip = useStore((s) => s.showTip);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('idea');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!token || isGuest) return null;

  function openModal() {
    setError(null);
    setOpen(true);
    showTip('first_feedback');
  }

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, message: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Fehler ${res.status}`);
      }
      addLogEntry('Danke für dein Feedback!');
      setMessage('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Senden fehlgeschlagen');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        data-testid="feedback-fab"
        onClick={openModal}
        title="Feedback geben"
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 9000,
          background: '#0a0a0a',
          border: '1px solid var(--color-primary)',
          color: 'var(--color-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          letterSpacing: '0.1em',
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        FEEDBACK
      </button>
      {open && (
        <div
          data-testid="feedback-modal"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9001,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0a0a0a',
              border: '1px solid var(--color-primary)',
              padding: 16,
              width: 'min(420px, 90vw)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: '0.8rem', letterSpacing: '0.2em', flex: 1 }}>FEEDBACK</span>
              <button
                onClick={() => showTip('first_feedback')}
                title="Hilfe"
                style={{
                  background: 'none',
                  border: '1px solid var(--color-dim)',
                  color: 'var(--color-dim)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  padding: '0 4px',
                  cursor: 'pointer',
                }}
              >
                [?]
              </button>
            </div>
            <select
              data-testid="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                marginBottom: 8,
                background: '#0d0d0d',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-dim)',
                fontFamily: 'var(--font-mono)',
                padding: 4,
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <textarea
              data-testid="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Dein Feedback…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#0d0d0d',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-dim)',
                fontFamily: 'var(--font-mono)',
                padding: 4,
                resize: 'vertical',
              }}
            />
            {error && (
              <div style={{ color: '#FF4444', fontSize: '0.75rem', marginTop: 4 }}>⚠ {error}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
              <button className="vs-btn" onClick={() => setOpen(false)}>
                [ABBRECHEN]
              </button>
              <button
                className="vs-btn"
                data-testid="feedback-send"
                disabled={!message.trim() || sending}
                onClick={submit}
              >
                {sending ? '…' : '[SENDEN]'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
