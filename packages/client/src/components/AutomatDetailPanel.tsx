import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { getShipComputerLevel } from '@void-sector/shared';

const STATUS_LABELS: Record<string, string> = {
  running: 'LÄUFT',
  paused: 'PAUSIERT',
  idle: 'INAKTIV',
  drift: 'NOTABSCHALTUNG',
  error: 'FEHLER',
};

const LEVEL_FEATURES: Record<number, string> = {
  1: 'fly · scan · mine · sell',
  2: '+if/else · +repeat',
  3: '+repeat N · +verschachtelt · +erweiterte Bedingungen',
  4: '+Offline-Modus',
  5: '+max (volle Kontrolle)',
};

const panelStyle: React.CSSProperties = {
  padding: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-primary)',
  fontSize: '0.75rem',
  height: '100%',
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

export function AutomatDetailPanel() {
  const ship = useStore((s) => s.ship);
  const shipProgramRun = useStore((s) => s.shipProgramRun);
  const shipProgramLog = useStore((s) => s.shipProgramLog);
  const logBottomRef = useRef<HTMLDivElement>(null);

  const level = getShipComputerLevel(ship?.modules ?? []);

  // Auto-scroll log to bottom when new entries arrive
  useEffect(() => {
    if (logBottomRef.current && typeof logBottomRef.current.scrollIntoView === 'function') {
      logBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [shipProgramLog.length]);

  // Show first-contact tip on mount
  useEffect(() => {
    useStore.getState().showTip('first_automat');
  }, []);

  const statusKey = shipProgramRun?.status ?? 'idle';
  const statusLabel = STATUS_LABELS[statusKey] ?? statusKey.toUpperCase();
  const isRunning = statusKey === 'running';

  return (
    <div style={panelStyle}>
      {/* Computer badge */}
      <div>
        <div
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.15em',
            opacity: 0.5,
            marginBottom: '4px',
          }}
        >
          BORDCOMPUTER
        </div>
        {level === 0 ? (
          <div style={{ color: '#555', fontSize: '0.8rem' }}>KEIN COMPUTER</div>
        ) : (
          <>
            <div
              style={{
                fontSize: '0.9rem',
                letterSpacing: '0.1em',
                color: 'var(--color-primary)',
                marginBottom: '2px',
              }}
            >
              BORDCOMPUTER MK.{level}
            </div>
            <div style={{ fontSize: '0.65rem', opacity: 0.6, lineHeight: 1.4 }}>
              {LEVEL_FEATURES[level] ?? ''}
            </div>
          </>
        )}
      </div>

      {/* Run status */}
      <div>
        <div
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.15em',
            opacity: 0.5,
            marginBottom: '4px',
          }}
        >
          STATUS
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              color: statusKey === 'error' || statusKey === 'drift'
                ? '#ff4444'
                : statusKey === 'running'
                  ? '#00FF88'
                  : 'var(--color-primary)',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
            }}
          >
            {statusLabel}
          </span>
          {isRunning && shipProgramRun && (
            <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>
              PC:{shipProgramRun.pc}
            </span>
          )}
        </div>
      </div>

      {/* Live log */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.15em',
            opacity: 0.5,
            marginBottom: '4px',
            flexShrink: 0,
          }}
        >
          LOG
        </div>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            lineHeight: 1.5,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.05)',
            padding: '6px 8px',
            minHeight: 0,
          }}
        >
          {shipProgramLog.length === 0 ? (
            <span style={{ opacity: 0.35 }}>— kein Log —</span>
          ) : (
            shipProgramLog.map((line, i) => (
              <div key={i} style={{ opacity: 0.85 }}>
                {line}
              </div>
            ))
          )}
          <div ref={logBottomRef} />
        </div>
      </div>
    </div>
  );
}
