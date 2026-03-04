import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { FIRST_CONTACT_TIMEOUT_MS } from '@void-sector/shared';

export function FirstContactDialog() {
  const firstContact = useStore((s) => s.firstContactQuadrant);
  const setFirstContactQuadrant = useStore((s) => s.setFirstContactQuadrant);
  const [name, setName] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(FIRST_CONTACT_TIMEOUT_MS / 1000);

  useEffect(() => {
    if (!firstContact) { setName(''); setSecondsLeft(FIRST_CONTACT_TIMEOUT_MS / 1000); return; }
    setSecondsLeft(FIRST_CONTACT_TIMEOUT_MS / 1000);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { setFirstContactQuadrant(null); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [firstContact, setFirstContactQuadrant]);

  if (!firstContact) return null;

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return;
    network.sendNameQuadrant(trimmed);
    setName('');
  };

  const handleSkip = () => {
    setFirstContactQuadrant(null);
    setName('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') handleSkip();
  };

  const barStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    background: 'var(--color-primary)',
    width: `${(secondsLeft / (FIRST_CONTACT_TIMEOUT_MS / 1000)) * 100}%`,
    transition: 'width 1s linear',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
    }}>
      <div style={{
        border: '1px solid var(--color-primary)',
        background: '#050505',
        padding: '24px 32px',
        minWidth: 400,
        position: 'relative',
        fontFamily: 'monospace',
        color: 'var(--color-primary)',
        letterSpacing: '0.1em',
      }}>
        <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: 4 }}>
          ⚡ FIRST CONTACT — QUADRANT ({firstContact.qx}, {firstContact.qy})
        </div>
        <div style={{ fontSize: '0.85rem', marginBottom: 16 }}>
          You are the first to enter this quadrant.<br />
          Designate a name for the historical record.
        </div>

        <input
          autoFocus
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          onKeyDown={handleKey}
          placeholder='ENTER NAME...'
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
            fontFamily: 'monospace',
            fontSize: '1rem',
            letterSpacing: '0.15em',
            padding: '4px 0',
            outline: 'none',
            marginBottom: 20,
          }}
        />

        <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem' }}>
          <button
            onClick={handleConfirm}
            disabled={name.trim().length < 3}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-primary)',
              color: 'var(--color-primary)',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              padding: '4px 16px',
              cursor: name.trim().length < 3 ? 'not-allowed' : 'pointer',
              opacity: name.trim().length < 3 ? 0.4 : 1,
            }}
          >
            [CONFIRM]
          </button>
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-dim)',
              color: 'var(--color-dim)',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              padding: '4px 16px',
              cursor: 'pointer',
            }}
          >
            [SKIP → AUTO-NAME]
          </button>
          <span style={{ marginLeft: 'auto', opacity: 0.5, lineHeight: '1.8' }}>
            {secondsLeft}s
          </span>
        </div>

        <div style={barStyle} />
      </div>
    </div>
  );
}
