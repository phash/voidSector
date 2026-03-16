import { useStore } from '../state/store';

export function BaseDetailPanel() {
  const constructionSites = useStore((s) => s.constructionSites);

  if (constructionSites.length === 0) {
    return (
      <div
        style={{
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          color: 'var(--color-dim)',
          textAlign: 'center',
          marginTop: 24,
        }}
      >
        NO CONSTRUCTION SITES
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
          fontSize: '0.7rem',
          color: 'var(--color-primary)',
          fontWeight: 'bold',
          marginBottom: 4,
        }}
      >
        BAUSTELLEN
      </div>
      {constructionSites.map((cs) => {
        const dur = Math.max(1, cs.neededOre + cs.neededGas + cs.neededCrystal + cs.neededArtefact);
        const pct = Math.min(100, Math.round((cs.progress / dur) * 100));
        return (
          <div
            key={cs.id}
            style={{
              marginBottom: 8,
              border: '1px solid var(--color-dim)',
              padding: '4px 6px',
            }}
          >
            <div style={{ color: '#ffaa00', marginBottom: 2 }}>
              {cs.type.toUpperCase()} — {cs.paused ? 'PAUSIERT' : `${pct}%`}
            </div>
            <div style={{ opacity: 0.5, fontSize: '0.55rem' }}>
              ORE: {cs.neededOre} | GAS: {cs.neededGas} | CRY: {cs.neededCrystal} | ART: {cs.neededArtefact}
            </div>
            <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', marginTop: 4 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#ffaa00' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
