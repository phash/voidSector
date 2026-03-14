import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { innerCoord } from '@void-sector/shared';

const STRUCTURE_LABELS: Record<string, string> = {
  base: 'COMMAND CENTER',
  comm_relay: 'COMM RELAY',
  mining_station: 'MINING STATION',
  storage: 'STORAGE',
  trading_post: 'TRADING POST',
  factory: 'FACTORY',
  kontor: 'KONTOR',
  research_lab: 'RESEARCH LAB',
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

const CONSTRUCTION_LABELS: Record<string, string> = {
  mining_station: 'MINING STATION',
  jumpgate: 'JUMPGATE',
  station: 'STATION',
  jumpgate_conn_2: 'GATE VERBINDUNG L2',
  jumpgate_conn_3: 'GATE VERBINDUNG L3',
  jumpgate_dist_2: 'GATE DISTANZ L2',
  jumpgate_dist_3: 'GATE DISTANZ L3',
};

export function BaseOverview() {
  const baseStructures = useStore((s) => s.baseStructures);
  const constructionSites = useStore((s) => s.constructionSites);
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
  const hasAnything = hasBase || constructionSites.length > 0;

  if (!hasAnything) {
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
        <div style={{ opacity: 0.4, marginBottom: 12 }}>NO BASE CONSTRUCTED</div>
        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>
          Navigate to a sector and use [BUILD BASE] to establish your home base.
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
        {baseName || 'HOME BASE'} — CONNECTED
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
        STRUCTURES ({baseStructures.length})
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
            {s.tier > 1 ? `T${s.tier}` : ''} ACTIVE
          </span>
        </div>
      ))}

      {/* Construction Sites */}
      {constructionSites.length > 0 && (
        <>
          <div
            style={{
              fontSize: '0.55rem',
              letterSpacing: '0.1em',
              color: 'var(--color-dim)',
              marginTop: 8,
              marginBottom: 4,
            }}
          >
            BAUSTELLEN ({constructionSites.length})
          </div>
          {constructionSites.map((cs) => {
            const dur = Math.max(1, cs.neededOre + cs.neededGas + cs.neededCrystal + cs.neededArtefact);
            const pct = Math.min(100, Math.round((cs.progress / dur) * 100));
            return (
              <div
                key={cs.id}
                style={{
                  padding: '4px 6px',
                  marginBottom: 2,
                  borderLeft: '2px solid #ffaa00',
                  background: 'rgba(255,170,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <span style={{ color: '#ffaa00', marginRight: 4 }}>[B]</span>
                    <span style={{ color: '#ffaa00' }}>
                      {CONSTRUCTION_LABELS[cs.type] ?? cs.type.toUpperCase()}
                    </span>
                  </span>
                  <span style={{ opacity: 0.6, fontSize: '0.55rem', color: cs.paused ? '#ff4444' : '#ffaa00' }}>
                    {cs.paused ? 'PAUSIERT' : `${pct}%`}
                  </span>
                </div>
                <div style={{ fontSize: '0.5rem', color: 'var(--color-dim)' }}>
                  ({innerCoord(cs.sectorX)}, {innerCoord(cs.sectorY)})
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', marginTop: 2 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#ffaa00' }} />
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
