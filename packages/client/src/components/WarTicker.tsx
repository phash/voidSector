import React from 'react';
import { useStore } from '../state/store';

export function WarTicker() {
  const warTicker = useStore(s => s.warTicker);

  if (warTicker.length === 0) return null;

  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65em',
        color: '#ff8844',
        borderTop: '1px solid #333',
        padding: '2px 6px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {warTicker.map((evt, i) => (
        <span
          key={evt.ts}
          style={{ marginRight: 24, opacity: Math.max(0.3, 1 - i * 0.08) }}
        >
          &#9658; {evt.message}
        </span>
      ))}
    </div>
  );
}
