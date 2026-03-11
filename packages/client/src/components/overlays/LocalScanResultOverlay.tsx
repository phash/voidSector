import { useStore } from '../../state/store';

export function LocalScanResultOverlay() {
  const result = useStore((s) => s.localScanResult);
  const setLocalScanResult = useStore((s) => s.setLocalScanResult);

  if (!result) return null;

  const { resources, hiddenSignatures, wrecks } = result;
  const hasResources = resources.ore > 0 || resources.gas > 0 || resources.crystal > 0;
  const hasWrecks = wrecks && wrecks.length > 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        pointerEvents: 'auto',
      }}
      onClick={() => setLocalScanResult(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#080808',
          border: '1px solid var(--color-primary)',
          borderLeft: '4px solid var(--color-primary)',
          padding: '20px 24px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          maxWidth: '360px',
          width: '90%',
          animation: 'crt-expand 200ms ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          color: 'var(--color-primary)',
          letterSpacing: '0.2em',
          fontSize: '0.7rem',
          borderBottom: '1px solid rgba(255,176,0,0.2)',
          paddingBottom: '8px',
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>◈ SCAN ERGEBNIS</span>
          <span style={{ color: 'var(--color-dim)' }}>LOCAL SCAN</span>
        </div>

        {/* Resources */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: 'var(--color-dim)', marginBottom: '6px', letterSpacing: '0.1em' }}>
            RESSOURCEN
          </div>
          {hasResources ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {resources.ore > 0 && (
                <div style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid rgba(255,176,0,0.3)' }}>
                  <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>ORE</div>
                  <div style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>{resources.ore}</div>
                </div>
              )}
              {resources.gas > 0 && (
                <div style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid rgba(255,176,0,0.3)' }}>
                  <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>GAS</div>
                  <div style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>{resources.gas}</div>
                </div>
              )}
              {resources.crystal > 0 && (
                <div style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid rgba(255,176,0,0.3)' }}>
                  <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>CRYSTAL</div>
                  <div style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>{resources.crystal}</div>
                </div>
              )}
              {!resources.ore && !resources.gas && !resources.crystal && (
                <div style={{ gridColumn: '1/-1', color: 'var(--color-dim)' }}>— keine —</div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--color-dim)' }}>— keine Ressourcen —</div>
          )}
        </div>

        {/* Wrecks */}
        {hasWrecks && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: 'var(--color-dim)', marginBottom: '6px', letterSpacing: '0.1em' }}>
              WRACKS ENTDECKT
            </div>
            {wrecks!.map((wreck) => (
              <div key={wreck.id} style={{
                padding: '5px 8px',
                border: '1px solid rgba(255,176,0,0.2)',
                marginBottom: '4px',
                fontSize: '0.7rem',
              }}>
                <div style={{ color: 'var(--color-primary)' }}>
                  {wreck.playerName}
                  <span style={{ color: 'var(--color-dim)', marginLeft: 6 }}>
                    T{wreck.radarIconData.tier} / {wreck.radarIconData.path}
                  </span>
                  {wreck.hasSalvage && (
                    <span style={{ color: '#4a9', marginLeft: 6, fontSize: '0.65rem' }}>[BERGBAR]</span>
                  )}
                </div>
                {wreck.lastLogEntry && (
                  <div style={{ color: '#666', fontSize: '0.65rem', marginTop: 2, fontStyle: 'italic' }}>
                    &ldquo;{wreck.lastLogEntry}&rdquo;
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hidden signatures */}
        {hiddenSignatures && (
          <div style={{
            padding: '6px 8px',
            border: '1px solid rgba(255,100,0,0.4)',
            color: '#FF8800',
            fontSize: '0.7rem',
            marginBottom: '12px',
          }}>
            ⚠ UNBEKANNTE SIGNATUREN — SCANNER-UPGRADE ERFORDERLICH
          </div>
        )}

        {/* Close */}
        <div style={{ textAlign: 'right', marginTop: '8px' }}>
          <button
            onClick={() => setLocalScanResult(null)}
            style={{
              border: '1px solid var(--color-primary)',
              background: 'none',
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              cursor: 'pointer',
              padding: '3px 12px',
              letterSpacing: '0.1em',
            }}
          >
            [SCHLIESSEN]
          </button>
        </div>
      </div>
    </div>
  );
}
