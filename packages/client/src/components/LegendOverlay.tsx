import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SYMBOLS, SECTOR_COLORS, SECTOR_TYPES } from '@void-sector/shared';

const LEGEND_ENTRIES = [
  { symbol: SYMBOLS.ship, name: 'YOUR SHIP', color: '#FFFFFF', key: 'YOUR SHIP' },
  { symbol: SYMBOLS.player, name: 'OTHER PLAYER', color: '#FFB000', key: 'OTHER PLAYER' },
  ...SECTOR_TYPES.map((type) => ({
    symbol: SYMBOLS[type as keyof typeof SYMBOLS] ?? SYMBOLS.empty,
    name: type.toUpperCase().replace('_', ' '),
    color: SECTOR_COLORS[type],
    key: type,
  })),
];

const LEGEND_DESCRIPTION_KEYS: Record<string, string> = {
  'YOUR SHIP': 'legend.yourShip',
  'OTHER PLAYER': 'legend.otherPlayer',
  empty: 'legend.empty',
  station: 'legend.station',
  asteroid_field: 'legend.asteroidField',
  nebula: 'legend.nebula',
  anomaly: 'legend.anomaly',
  pirate: 'legend.pirate',
  wormhole: 'legend.wormhole',
};

export function LegendOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('ui');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', padding: 24, maxWidth: 400, width: '90%' }}
      >
        {/* X close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'none',
            border: 'none',
            color: 'var(--color-primary)',
            fontSize: '1rem',
            cursor: 'pointer',
            lineHeight: 1,
            fontFamily: 'var(--font-mono)',
          }}
          title={t('actions.close')}
        >
          ✕
        </button>

        <h3 style={{ marginBottom: 12 }}>{t('legend.radarLegend')}</h3>
        {LEGEND_ENTRIES.map(({ symbol, name, color, key }) => (
          <div key={name}>
            <div
              onClick={() => setSelectedItem(selectedItem === key ? null : key)}
              style={{
                display: 'flex',
                gap: 12,
                marginBottom: 4,
                alignItems: 'center',
                cursor: 'pointer',
                padding: '2px 4px',
                background: selectedItem === key ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderLeft:
                  selectedItem === key ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}
            >
              <span style={{ color, fontSize: '1.2rem', width: 24, textAlign: 'center' }}>
                {symbol}
              </span>
              <span>{name}</span>
              {LEGEND_DESCRIPTION_KEYS[key] && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.6rem',
                    color: 'var(--color-dim)',
                    opacity: 0.6,
                  }}
                >
                  {selectedItem === key ? '▲' : '▼'}
                </span>
              )}
            </div>
            {selectedItem === key && LEGEND_DESCRIPTION_KEYS[key] && (
              <div
                style={{
                  margin: '0 4px 8px 40px',
                  padding: '6px 8px',
                  border: '1px solid var(--color-dim)',
                  borderLeft: `2px solid ${color}`,
                  color: '#CCCCCC',
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {t(LEGEND_DESCRIPTION_KEYS[key])}
              </div>
            )}
          </div>
        ))}
        <div style={{ marginTop: 16, fontSize: '0.75rem', color: 'var(--color-dim)' }}>
          {t('legend.closeHint')}
        </div>
      </div>
    </div>
  );
}
