import { useState } from 'react';
import { useStore } from '../../state/store';
import { network } from '../../network/client';

export function LocalScanResultOverlay() {
  const result = useStore((s) => s.localScanResult);
  const setLocalScanResult = useStore((s) => s.setLocalScanResult);
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);
  const [slateSaved, setSlateSaved] = useState(false);

  if (!result) return null;

  const { resources, hiddenSignatures, wrecks, sectorX, sectorY, quadrantX, quadrantY, sectorType, structures, universeTick } = result;
  const hasResources = resources.ore > 0 || resources.gas > 0 || resources.crystal > 0;
  const hasWrecks = wrecks && wrecks.length > 0;

  // Cargo check for slate button
  const cargoTotal = (cargo.ore ?? 0) + (cargo.gas ?? 0) + (cargo.crystal ?? 0)
    + (cargo.slates ?? 0) + (cargo.artefact ?? 0);
  const cargoCap = ship?.stats?.cargoCap ?? 0;
  const cargoFull = cargoCap > 0 && cargoTotal >= cargoCap;

  const handleSaveSlate = () => {
    if (slateSaved || cargoFull) return;
    network.sendCreateSlateFromScan();
    setSlateSaved(true);
  };

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
          <span style={{ color: 'var(--color-dim)' }}>
            LOCAL SCAN{universeTick != null ? ` · TICK ${universeTick}` : ''}
          </span>
        </div>

        {/* Location Context */}
        {sectorX != null && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
            <div style={{ padding: '4px 8px', border: '1px solid rgba(255,176,0,0.15)' }}>
              <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>QUADRANT</div>
              <div style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>Q {quadrantX}:{quadrantY}</div>
            </div>
            <div style={{ padding: '4px 8px', border: '1px solid rgba(255,176,0,0.15)' }}>
              <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>SEKTOR</div>
              <div style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>({sectorX}, {sectorY})</div>
            </div>
          </div>
        )}

        {/* Sector Type + Structures */}
        {sectorType && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
            <div style={{ padding: '4px 8px', border: '1px solid rgba(255,176,0,0.15)' }}>
              <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>SEKTORTYP</div>
              <div style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>{sectorType.toUpperCase()}</div>
            </div>
            <div style={{ padding: '4px 8px', border: '1px solid rgba(255,176,0,0.15)' }}>
              <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>STRUKTUREN</div>
              <div style={{ color: '#4a9', fontSize: '0.75rem' }}>
                {structures && structures.length > 0 ? structures.join(', ') : '—'}
              </div>
            </div>
          </div>
        )}

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

        {/* Buttons: SAVE TO SLATE + CLOSE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', gap: '8px' }}>
          <button
            onClick={handleSaveSlate}
            disabled={slateSaved || cargoFull}
            style={{
              border: `1px solid ${slateSaved ? '#4a9' : cargoFull ? '#333' : '#00BFFF'}`,
              background: 'none',
              color: slateSaved ? '#4a9' : cargoFull ? '#666' : '#00BFFF',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              cursor: slateSaved || cargoFull ? 'not-allowed' : 'pointer',
              padding: '3px 12px',
              letterSpacing: '0.1em',
            }}
          >
            {slateSaved ? '✓ SLATE GESPEICHERT' : cargoFull ? '[SLATE] CARGO VOLL' : '[SAVE TO SLATE]'}
          </button>
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
