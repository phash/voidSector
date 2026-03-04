import { useEffect } from 'react';
import { useStore } from '../state/store';

export function HelpOverlay() {
  const activeTip = useStore((s) => s.activeTip);
  const dismissTip = useStore((s) => s.dismissTip);

  useEffect(() => {
    if (!activeTip) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissTip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTip, dismissTip]);

  if (!activeTip) return null;

  return (
    <div
      onClick={dismissTip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 80px 0',
        pointerEvents: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(0, 0, 0, 0.92)',
          border: '1px solid var(--color-primary)',
          borderLeft: '4px solid var(--color-primary)',
          padding: '16px 20px',
          maxWidth: '480px',
          width: '90%',
          fontFamily: 'var(--font-mono)',
          animation: 'crt-expand 200ms ease-out',
        }}
      >
        <div style={{
          color: 'var(--color-primary)',
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
          marginBottom: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>◈ {activeTip.title}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--color-dim)' }}>HILFE</span>
        </div>
        <div style={{
          color: '#CCCCCC',
          fontSize: '0.8rem',
          lineHeight: 1.6,
        }}>
          {activeTip.body}
        </div>
        <div style={{
          marginTop: '12px',
          textAlign: 'right',
          fontSize: '0.65rem',
          color: 'var(--color-dim)',
          letterSpacing: '0.1em',
        }}>
          [ESC / KLICK zum Schliessen]
        </div>
      </div>
    </div>
  );
}
