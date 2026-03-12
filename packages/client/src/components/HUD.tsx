import { useState, useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { innerCoord } from '@void-sector/shared';

function SegmentedBar({
  current,
  max,
  width = 12,
}: {
  current: number;
  max: number;
  width?: number;
}) {
  const filled = max > 0 ? Math.round((current / max) * width) : 0;
  const empty = width - filled;
  return (
    <span className="vs-bar">
      {'█'.repeat(filled)}
      {'░'.repeat(empty)}
    </span>
  );
}

export function StatusBar() {
  const ap = useStore((s) => s.ap);
  const fuel = useStore((s) => s.fuel);
  const ship = useStore((s) => s.ship);
  const credits = useStore((s) => s.credits);
  const isGuest = useStore((s) => s.isGuest);
  const seenTips = useStore((s) => s.seenTips);
  const showTip = useStore((s) => s.showTip);


  // Live-updating AP accounting for regen since last server tick
  const [displayAP, setDisplayAP] = useState(ap?.current ?? 0);

  useEffect(() => {
    if (!ap) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - ap.lastTick) / 1000;
      const regen = Math.min(ap.current + elapsed * ap.regenPerSecond, ap.max);
      setDisplayAP(Math.floor(regen));
    }, 500);
    return () => clearInterval(interval);
  }, [ap]);

  // Flash animation on AP spend
  const prevAP = useRef(ap?.current ?? 0);
  const [flashing, setFlashing] = useState(false);
  const [apPulse, setApPulse] = useState(false);

  useEffect(() => {
    const prev = prevAP.current;
    const curr = ap?.current ?? 0;

    if (ap && curr < prev) {
      setFlashing(true);
      const timer = setTimeout(() => setFlashing(false), 400);
      prevAP.current = curr;

      // NEU: AP-Erschöpfungs-Feedback
      if (prev > 0 && curr === 0) {
        // Layer B: AP-Balken Pulse
        setApPulse(true);
        setTimeout(() => setApPulse(false), 1500);

        // Layer A: InlineError-Meldung
        const secondsToFull = ap
          ? Math.ceil((ap.max - curr) / (ap.regenPerSecond ?? 1))
          : null;
        const msg = secondsToFull
          ? `⚡ NO AP — REGENERATING · FULL IN ${secondsToFull}s`
          : '⚡ NO AP — REGENERATING AUTOMATICALLY';
        useStore.getState().setActionError({ code: 'NO_AP', message: msg });
        setTimeout(() => useStore.getState().setActionError(null), 3000);

        // Layer D: einmaliger HelpTip beim ersten AP=0
        const AP_TIP_KEY = 'ap-depleted-first';
        if (!seenTips.has(AP_TIP_KEY)) {
          showTip(AP_TIP_KEY);
        }
      }

      return () => clearTimeout(timer);
    }
    prevAP.current = curr;
  }, [ap?.current]);

  // Regen timer display
  const isFull = ap && displayAP >= ap.max;
  const secondsToFull = ap && !isFull ? Math.ceil((ap.max - displayAP) / ap.regenPerSecond) : 0;

  return (
    <div
      style={{
        padding: '4px 12px',
        borderTop: '1px solid var(--color-dim)',
        borderBottom: '1px solid var(--color-dim)',
        fontSize: '0.8rem',
        letterSpacing: '0.08em',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Row 1: AP */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.6,
        }}
      >
        <span className={[flashing ? 'ap-flash' : '', apPulse ? 'ap-pulse' : ''].filter(Boolean).join(' ')}>
          AP: {ap ? `${displayAP}/${ap.max}` : '---'}{' '}
          <SegmentedBar current={ap ? displayAP : 0} max={ap?.max ?? 100} width={8} />
        </span>
        {ap && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-dim)' }}>
            {ap.regenPerSecond}/s {isFull ? <span style={{ color: '#00FF88' }}>FULL</span> : `IN ${secondsToFull}s`}
          </span>
        )}
      </div>

      {/* Row 2: FUEL + CR + GAST */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.6,
        }}
      >
        {fuel && (
          <>
            <span
              style={{
                color:
                  fuel.current <= 0
                    ? '#FF3333'
                    : fuel.current < fuel.max * 0.2
                      ? '#FF6644'
                      : undefined,
                animation: fuel.current <= 0 ? 'bezel-alert-pulse 1s infinite' : undefined,
              }}
            >
              FUEL: {Math.floor(fuel.current)}/{fuel.max}{' '}
              <SegmentedBar current={fuel.current} max={fuel.max} width={8} />
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-dim)' }}>
              SPD {ship?.stats.engineSpeed ?? 1}
            </span>
          </>
        )}
        <span style={{ color: 'var(--color-dim)' }}>|</span>
        <span>CR: {credits.toLocaleString()}</span>
        {isGuest && (
          <>
            <span style={{ color: 'var(--color-dim)' }}>|</span>
            <span style={{ color: '#FFAA00', fontWeight: 'bold' }}>[GAST]</span>
          </>
        )}
      </div>
    </div>
  );
}

export function SectorInfo() {
  const position = useStore((s) => s.position);
  const currentSector = useStore((s) => s.currentSector);
  const players = useStore((s) => s.players);
  const playerCount = Object.keys(players).length;
  const distToOrigin = Math.ceil(Math.sqrt(position.x ** 2 + position.y ** 2));

  return (
    <div
      style={{
        padding: '3px 12px',
        borderTop: '1px solid var(--color-dim)',
        borderBottom: '1px solid var(--color-dim)',
        fontSize: '0.75rem',
        letterSpacing: '0.1em',
        color: 'var(--color-dim)',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '2px 12px',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <span style={{ whiteSpace: 'nowrap' }}>
        SECTOR: ({innerCoord(position.x)}, {innerCoord(position.y)})
      </span>
      <span>{currentSector?.type?.toUpperCase() || '---'}</span>
      <span>PILOTS: {playerCount}</span>
      <span>ORIGIN: {distToOrigin.toLocaleString()}</span>
    </div>
  );
}
