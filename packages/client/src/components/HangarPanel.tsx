import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { HULLS } from '@void-sector/shared';
import type { HullType } from '@void-sector/shared';

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  padding: '1px 4px',
  cursor: 'pointer',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-dim)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  padding: '2px 4px',
  width: '100%',
  maxWidth: 140,
};

const sectionHeader: React.CSSProperties = {
  borderBottom: '1px solid var(--color-dim)',
  paddingBottom: 2,
  marginBottom: 4,
  marginTop: 8,
  fontSize: '0.6rem',
  letterSpacing: '0.15em',
  opacity: 0.7,
};

export function HangarPanel() {
  const ship = useStore((s) => s.ship);
  const [renamingShipId, setRenamingShipId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    network.sendGetShips();
  }, []);

  const handleRename = (shipId: string) => {
    if (renameValue.trim() && renameValue.length <= 20) {
      network.sendRenameShip(shipId, renameValue.trim());
      setRenamingShipId(null);
      setRenameValue('');
    }
  };

  if (!ship) {
    return (
      <div
        style={{
          padding: '4px 6px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          opacity: 0.4,
        }}
      >
        KEIN SCHIFF
      </div>
    );
  }

  const hull = HULLS[ship.hullType as HullType];

  return (
    <div
      style={{
        padding: '4px 6px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        lineHeight: 1.5,
        overflow: 'auto',
        height: '100%',
      }}
    >
      {/* Ship Info */}
      <div style={sectionHeader}>DEIN SCHIFF</div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '2px 0',
          borderBottom: '1px solid rgba(255,176,0,0.1)',
        }}
      >
        <span>
          <span style={{ color: 'var(--color-primary)', marginRight: 4 }}>&#9658;</span>
          <span style={{ color: 'var(--color-primary)' }}>{ship.name}</span>
          <span style={{ color: 'var(--color-dim)', marginLeft: 6, fontSize: '0.55rem' }}>
            {hull?.name || ship.hullType.toUpperCase()}
          </span>
        </span>
        <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ color: '#00FF88', fontSize: '0.55rem' }}>AKTIV</span>
          {renamingShipId === ship.id ? (
            <span style={{ display: 'flex', gap: 2 }}>
              <input
                style={inputStyle}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value.slice(0, 20))}
                onKeyDown={(e) => e.key === 'Enter' && handleRename(ship.id)}
                maxLength={20}
                autoFocus
                placeholder="Name..."
              />
              <button style={btnStyle} onClick={() => handleRename(ship.id)}>
                OK
              </button>
              <button style={btnStyle} onClick={() => setRenamingShipId(null)}>
                X
              </button>
            </span>
          ) : (
            <button
              style={btnStyle}
              onClick={() => {
                setRenamingShipId(ship.id);
                setRenameValue(ship.name);
              }}
            >
              UMBENENNEN
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
