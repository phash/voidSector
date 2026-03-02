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

  return (
    <div style={{
      padding: '6px 12px',
      borderTop: '1px solid var(--color-dim)',
      borderBottom: '1px solid var(--color-dim)',
      fontSize: '0.7rem',
      letterSpacing: '0.08em',
      lineHeight: 1.8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px 16px' }}>
        <span>
          AP: {ap ? `${ap.current}/${ap.max}` : '---'}
          {' '}<SegmentedBar current={ap?.current ?? 0} max={ap?.max ?? 100} />
        </span>
      </div>
    </div>
  );
}

export function SectorInfo() {
  const position = useStore((s) => s.position);
  const currentSector = useStore((s) => s.currentSector);
  const players = useStore((s) => s.players);
  const playerCount = Object.keys(players).length;

  return (
    <div style={{
      padding: '6px 12px',
      borderTop: '1px solid var(--color-dim)',
      borderBottom: '1px solid var(--color-dim)',
      fontSize: '0.75rem',
      display: 'flex',
      justifyContent: 'space-between',
      letterSpacing: '0.1em',
    }}>
      <span>SECTOR: ({position.x}, {position.y})</span>
      <span>{currentSector?.type?.toUpperCase() || '---'}</span>
      <span>PILOTS: {playerCount}</span>
    </div>
  );
}
