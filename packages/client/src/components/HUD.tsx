import { useState, useEffect, useRef } from 'react';
import { useStore } from '../state/store';

function SegmentedBar({ current, max, width = 12 }: { current: number; max: number; width?: number }) {
  const filled = max > 0 ? Math.round((current / max) * width) : 0;
  const empty = width - filled;
  return (
    <span className="vs-bar">
      {'█'.repeat(filled)}{'░'.repeat(empty)}
    </span>
  );
}

export function StatusBar() {
  const ap = useStore((s) => s.ap);
  const fuel = useStore((s) => s.fuel);
  const credits = useStore((s) => s.credits);

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

  useEffect(() => {
    if (ap && ap.current < prevAP.current) {
      setFlashing(true);
      const timer = setTimeout(() => setFlashing(false), 400);
      prevAP.current = ap.current;
      return () => clearTimeout(timer);
    }
    prevAP.current = ap?.current ?? 0;
  }, [ap?.current]);

  // Regen timer display
  const isFull = ap && displayAP >= ap.max;
  const secondsToFull = ap && !isFull
    ? Math.ceil((ap.max - displayAP) / ap.regenPerSecond)
    : 0;

  return (
    <div style={{
      padding: '4px 12px',
      borderTop: '1px solid var(--color-dim)',
      borderBottom: '1px solid var(--color-dim)',
      fontSize: '0.8rem',
      letterSpacing: '0.08em',
      lineHeight: 1.8,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px 16px',
      alignItems: 'center',
    }}>
      <span className={flashing ? 'ap-flash' : ''}>
        AP: {ap ? `${displayAP}/${ap.max}` : '---'}
        {' '}<SegmentedBar current={ap ? displayAP : 0} max={ap?.max ?? 100} width={8} />
      </span>
      {ap && (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-dim)' }}>
          {ap.regenPerSecond}/s {isFull ? <span style={{ color: '#00FF88' }}>FULL</span> : `FULL ${secondsToFull}s`}
        </span>
      )}
      <span style={{ color: 'var(--color-dim)' }}>|</span>
      {fuel && (
        <>
          <span style={{
            color: fuel.current <= 0 ? '#FF3333' : fuel.current < fuel.max * 0.2 ? '#FF6644' : undefined,
            animation: fuel.current <= 0 ? 'bezel-alert-pulse 1s infinite' : undefined,
          }}>
            FUEL: {Math.floor(fuel.current)}/{fuel.max}
            {' '}<SegmentedBar current={fuel.current} max={fuel.max} width={8} />
          </span>
          {fuel.current <= 0 && (
            <span style={{ color: '#FF3333', fontSize: '0.75rem', fontWeight: 'bold' }}>
              TANK LEER
            </span>
          )}
          {fuel.current > 0 && fuel.current < fuel.max * 0.2 && (
            <span style={{ color: '#FF6644', fontSize: '0.75rem' }}>
              TREIBSTOFF NIEDRIG
            </span>
          )}
        </>
      )}
      <span style={{ color: 'var(--color-dim)' }}>|</span>
      <span>CR: {credits.toLocaleString()}</span>
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
    <div style={{
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
    }}>
      <span>SECTOR: ({position.x}, {position.y})</span>
      <span>{currentSector?.type?.toUpperCase() || '---'}</span>
      <span>PILOTS: {playerCount}</span>
      <span>ORIGIN: {distToOrigin.toLocaleString()}</span>
    </div>
  );
}
