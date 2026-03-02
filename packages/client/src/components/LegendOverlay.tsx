import { useEffect } from 'react';
import { SYMBOLS, SECTOR_COLORS, SECTOR_TYPES } from '@void-sector/shared';

const LEGEND_ENTRIES = [
  { symbol: SYMBOLS.ship, name: 'YOUR SHIP', color: '#FFFFFF' },
  { symbol: SYMBOLS.homeBase, name: 'HOME BASE', color: SECTOR_COLORS.home_base },
  { symbol: SYMBOLS.player, name: 'OTHER PLAYER', color: '#FFB000' },
  ...SECTOR_TYPES.map(type => ({
    symbol: SYMBOLS[type as keyof typeof SYMBOLS] ?? SYMBOLS.empty,
    name: type.toUpperCase().replace('_', ' '),
    color: SECTOR_COLORS[type],
  })),
];

export function LegendOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 20,
      background: 'rgba(0,0,0,0.85)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{ padding: 24, maxWidth: 400 }}>
        <h3 style={{ marginBottom: 12 }}>RADAR LEGEND</h3>
        {LEGEND_ENTRIES.map(({ symbol, name, color }) => (
          <div key={name} style={{ display: 'flex', gap: 12, marginBottom: 6, alignItems: 'center' }}>
            <span style={{ color, fontSize: '1.2rem', width: 24, textAlign: 'center' }}>{symbol}</span>
            <span>{name}</span>
          </div>
        ))}
        <div style={{ marginTop: 16, fontSize: '0.75rem', color: 'var(--color-dim)' }}>
          Press ESC or click outside to close
        </div>
      </div>
    </div>
  );
}
