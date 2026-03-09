import { useStore } from '../state/store';

export function AncientRuinDialog() {
  const scan = useStore((s) => s.activeAncientRuinScan);
  const setActiveAncientRuinScan = useStore((s) => s.setActiveAncientRuinScan);

  if (!scan) return null;

  const levelLabel = scan.ruinLevel === 3 ? 'MAJOR RUIN' : scan.ruinLevel === 2 ? 'RUIN' : 'MINOR RUIN';

  return (
    <div
      onClick={() => setActiveAncientRuinScan(null)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 8500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        cursor: 'pointer',
        pointerEvents: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0a0800',
          border: '1px solid #c8a96e',
          borderLeft: '4px solid #c8a96e',
          padding: '20px 24px',
          maxWidth: '520px',
          width: '90%',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {/* Header */}
        <div style={{
          color: '#c8a96e',
          fontSize: '0.7rem',
          letterSpacing: '0.2em',
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>◈ ANCIENT RUINS — {levelLabel}</span>
          <span style={{ color: '#664a20' }}>SEKTOR ({scan.sectorX}, {scan.sectorY})</span>
        </div>

        {/* Lore fragment */}
        <div style={{
          color: '#c8a96e',
          fontSize: '0.8rem',
          lineHeight: 1.8,
          whiteSpace: 'pre-line',
          borderTop: '1px solid #3a2a10',
          paddingTop: '12px',
          marginBottom: '12px',
        }}>
          {scan.fragmentText}
        </div>

        {/* Artefact reward */}
        {scan.artefactFound && (
          <div style={{
            color: '#FFB000',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            borderTop: '1px solid #3a2a10',
            paddingTop: '10px',
            marginBottom: '12px',
          }}>
            ◆ ARTEFAKT GEFUNDEN — +1 ARTEFAKT IN CARGO
          </div>
        )}

        {/* Dismiss */}
        <div style={{
          textAlign: 'right',
          fontSize: '0.65rem',
          color: '#664a20',
          letterSpacing: '0.1em',
        }}>
          [KLICK ZUM SCHLIEßEN]
        </div>
      </div>
    </div>
  );
}
