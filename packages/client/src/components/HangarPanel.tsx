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

const btnDisabledStyle: React.CSSProperties = {
  ...btnStyle,
  opacity: 0.3,
  cursor: 'not-allowed',
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
  const shipList = useStore((s) => s.shipList);
  const credits = useStore((s) => s.credits);
  const baseStructures = useStore((s) => s.baseStructures);
  const [renamingShipId, setRenamingShipId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [buyingHull, setBuyingHull] = useState<HullType | null>(null);
  const [newShipName, setNewShipName] = useState('');

  // Approximate player level from XP -- for hull unlock checks
  // We don't have level in store directly, use a fallback of 1
  // The server will enforce the real level check
  const playerLevel = 10; // Allow UI to show all hulls; server enforces level

  useEffect(() => {
    network.sendGetShips();
    network.requestCredits();
  }, []);

  const hasBase = baseStructures.some((s: any) => s.type === 'base');

  const handleRename = (shipId: string) => {
    if (renameValue.trim() && renameValue.length <= 20) {
      network.sendRenameShip(shipId, renameValue.trim());
      setRenamingShipId(null);
      setRenameValue('');
    }
  };

  const handleBuyHull = (hullType: HullType) => {
    if (newShipName.trim() && newShipName.length <= 20) {
      network.sendBuyHull(hullType, newShipName.trim());
      setBuyingHull(null);
      setNewShipName('');
    }
  };

  return (
    <div style={{
      padding: '4px 6px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.6rem',
      lineHeight: 1.5,
      overflow: 'auto',
      height: '100%',
    }}>
      {/* A) Ship List */}
      <div style={sectionHeader}>
        HANGAR {shipList.length > 0 ? `\u2014 ${shipList.length} SCHIFFE` : ''}
      </div>
      {shipList.length === 0 ? (
        <div style={{ opacity: 0.4, padding: '2px 0' }}>KEINE SCHIFFE</div>
      ) : (
        shipList.map((s) => {
          const hull = HULLS[s.hullType as HullType];
          const isActive = ship?.id === s.id;
          return (
            <div key={s.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 0',
              borderBottom: '1px solid rgba(255,176,0,0.1)',
            }}>
              <span>
                <span style={{
                  color: isActive ? 'var(--color-primary)' : 'var(--color-dim)',
                  marginRight: 4,
                }}>
                  {isActive ? '\u25BA' : ' '}
                </span>
                <span style={{ color: 'var(--color-primary)' }}>{s.name}</span>
                <span style={{ color: 'var(--color-dim)', marginLeft: 6, fontSize: '0.55rem' }}>
                  {hull?.name || s.hullType.toUpperCase()}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {isActive ? (
                  <>
                    <span style={{ color: '#00FF88', fontSize: '0.55rem' }}>AKTIV</span>
                    {renamingShipId === s.id ? (
                      <span style={{ display: 'flex', gap: 2 }}>
                        <input
                          style={inputStyle}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value.slice(0, 20))}
                          onKeyDown={(e) => e.key === 'Enter' && handleRename(s.id)}
                          maxLength={20}
                          autoFocus
                          placeholder="Name..."
                        />
                        <button style={btnStyle} onClick={() => handleRename(s.id)}>OK</button>
                        <button style={btnStyle} onClick={() => setRenamingShipId(null)}>X</button>
                      </span>
                    ) : (
                      <button
                        style={btnStyle}
                        onClick={() => {
                          setRenamingShipId(s.id);
                          setRenameValue(s.name);
                        }}
                      >
                        UMBENENNEN
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    style={hasBase ? btnStyle : btnDisabledStyle}
                    disabled={!hasBase}
                    title={hasBase ? 'Schiff wechseln' : 'Nur an Heimatbasis moeglich'}
                    onClick={() => network.sendSwitchShip(s.id)}
                  >
                    WECHSELN
                  </button>
                )}
              </span>
            </div>
          );
        })
      )}

      {/* B) Buy New Hull */}
      <div style={sectionHeader}>NEUES SCHIFF</div>
      {(Object.entries(HULLS) as [HullType, typeof HULLS[HullType]][]).map(([hullType, hull]) => {
        if (hull.unlockCost === 0) return null; // Skip starter hull
        const canAfford = credits >= hull.unlockCost;
        const levelLocked = playerLevel < hull.unlockLevel;
        const locked = !canAfford || levelLocked;

        return (
          <div key={hullType} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1px 0',
          }}>
            <span>
              <span style={{ color: 'var(--color-primary)' }}>{hull.name}</span>
              <span style={{ color: 'var(--color-dim)', marginLeft: 4, fontSize: '0.55rem' }}>
                {hull.unlockCost} CR LVL {hull.unlockLevel}
              </span>
            </span>
            {buyingHull === hullType ? (
              <span style={{ display: 'flex', gap: 2 }}>
                <input
                  style={inputStyle}
                  value={newShipName}
                  onChange={(e) => setNewShipName(e.target.value.slice(0, 20))}
                  onKeyDown={(e) => e.key === 'Enter' && handleBuyHull(hullType)}
                  maxLength={20}
                  autoFocus
                  placeholder="Schiffname..."
                />
                <button style={btnStyle} onClick={() => handleBuyHull(hullType)}>OK</button>
                <button style={btnStyle} onClick={() => setBuyingHull(null)}>X</button>
              </span>
            ) : (
              <button
                style={locked ? btnDisabledStyle : btnStyle}
                disabled={locked}
                onClick={() => {
                  setBuyingHull(hullType);
                  setNewShipName('');
                }}
              >
                {levelLocked ? 'GESPERRT' : 'KAUFEN'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
