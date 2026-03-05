import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const STRUCTURE_LABELS: Record<string, string> = {
  base: 'KOMMANDO-KERN',
  comm_relay: 'COMM RELAY',
  mining_station: 'MINING STATION',
  storage: 'LAGER',
  trading_post: 'HANDELSPLATZ',
  factory: 'FABRIK',
  kontor: 'KONTOR',
  research_lab: 'FORSCHUNGSLABOR',
};

const STRUCTURE_ICONS: Record<string, string> = {
  base: '[■]',
  comm_relay: '[~]',
  mining_station: '[M]',
  storage: '[□]',
  trading_post: '[T]',
  factory: '[F]',
  kontor: '[K]',
  research_lab: '[R]',
};

export function BaseOverview() {
  const baseStructures = useStore((s) => s.baseStructures);
  const baseName = useStore((s) => s.baseName);
  const credits = useStore((s) => s.credits);
  const selectedId = useStore((s) => s.selectedBaseStructure);
  const setSelected = useStore((s) => s.setSelectedBaseStructure);

  useEffect(() => {
    network.requestBase();
    network.requestStorage();
    network.requestCredits();
  }, []);

  const hasBase = baseStructures.some((s: any) => s.type === 'base');

  if (!hasBase) {
    return (
      <div
        style={{
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          lineHeight: 1.8,
        }}
      >
        <div style={{ letterSpacing: '0.2em', marginBottom: 4, opacity: 0.6 }}>
          BASE-LINK — NO SIGNAL
        </div>
        <div style={{ opacity: 0.4, marginBottom: 12 }}>KEINE BASIS ERRICHTET</div>
        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>
          Navigiere zu einem Sektor und nutze [BUILD BASE] um deine Heimatbasis zu errichten.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '8px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        lineHeight: 1.6,
        height: '100%',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          letterSpacing: '0.15em',
          fontSize: '0.7rem',
          marginBottom: 4,
          borderBottom: '1px solid var(--color-dim)',
          paddingBottom: 2,
        }}
      >
        {baseName || 'HEIMATBASIS'} — CONNECTED
      </div>

      <div style={{ color: 'var(--color-dim)', marginBottom: 8 }}>
        CREDITS: <span style={{ color: 'var(--color-primary)' }}>{credits.toLocaleString()}</span>
      </div>

      <div
        style={{
          fontSize: '0.55rem',
          letterSpacing: '0.1em',
          color: 'var(--color-dim)',
          marginBottom: 4,
        }}
      >
        GEBÄUDE ({baseStructures.length})
      </div>

      {baseStructures.map((s: any) => (
        <div
          key={s.id}
          onClick={() => setSelected(s.id)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 6px',
            cursor: 'pointer',
            borderLeft:
              selectedId === s.id ? '2px solid var(--color-primary)' : '2px solid transparent',
            background: selectedId === s.id ? 'rgba(255,176,0,0.05)' : 'transparent',
            marginBottom: 2,
          }}
        >
          <span>
            <span style={{ color: 'var(--color-dim)', marginRight: 4 }}>
              {STRUCTURE_ICONS[s.type] || '[?]'}
            </span>
            <span style={{ color: 'var(--color-primary)' }}>
              {STRUCTURE_LABELS[s.type] || s.type.toUpperCase()}
            </span>
          </span>
          <span style={{ opacity: 0.5, fontSize: '0.55rem' }}>
            {s.tier > 1 ? `T${s.tier}` : ''} AKTIV
          </span>
        </div>
      ))}
    </div>
  );
}
