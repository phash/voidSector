import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { AcepPath } from '@void-sector/shared';
import { getAcepBoostCost } from '@void-sector/shared';

const PATHS: Array<{ key: AcepPath; label: string; color: string }> = [
  { key: 'ausbau', label: 'AUSBAU', color: '#FFB000' },
  { key: 'intel', label: 'INTEL', color: '#00CFFF' },
  { key: 'kampf', label: 'KAMPF', color: '#FF4444' },
  { key: 'explorer', label: 'EXPLORER', color: '#00FF88' },
];

export function HangarPanel() {
  const ship = useStore((s) => s.ship);
  const credits = useStore((s) => s.credits ?? 0);
  const wissen = useStore((s) => s.research.wissen ?? 0);
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

  const xp = ship.acepXp ?? { ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0 };
  const effects = ship.acepEffects;
  const gen = ship.acepGeneration ?? 1;
  const traits = ship.acepTraits ?? [];
  const baseSlots = 3;
  const extraSlots = effects?.extraModuleSlots ?? 0;
  const totalSlots = baseSlots + extraSlots;
  const installedCount = ship.modules.length;

  return (
    <div style={panelStyle}>
      {/* Ship header */}
      <div style={sectionHdr}>DEIN SCHIFF</div>
      <div style={headerRow}>
        <span>
          <span style={{ color: 'var(--color-primary)' }}>{ship.name}</span>
          <span style={{ color: 'var(--color-dim)', marginLeft: 6, fontSize: '0.55rem' }}>
            ACEP GEN-{gen}
          </span>
        </span>
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
      </div>

      {/* XP Paths */}
      <div style={sectionHdr}>ENTWICKLUNGSPFADE</div>
      {PATHS.map(({ key, label, color }) => {
        const pathXp = xp[key] ?? 0;
        const cost = getAcepBoostCost(pathXp);
        const canBoost =
          cost !== null && credits >= cost.credits && wissen >= cost.wissen && xp.total < 100;
        return (
          <div key={key} style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
              <span style={{ color }}>{label}</span>
              <span style={{ color: 'var(--color-dim)', fontSize: '0.55rem' }}>
                {pathXp}/50
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <div style={barTrack}>
                <div
                  style={{ ...barFill, width: `${(pathXp / 50) * 100}%`, background: color }}
                />
              </div>
              {cost ? (
                <button
                  style={{
                    ...btnStyle,
                    opacity: canBoost ? 1 : 0.35,
                    fontSize: '0.55rem',
                    padding: '1px 3px',
                  }}
                  disabled={!canBoost}
                  title={`+5 XP kostet ${cost.credits} CR \u00B7 ${cost.wissen} W`}
                  onClick={() => network.sendAcepBoost(key)}
                >
                  +5 XP
                </button>
              ) : (
                <span style={{ color: '#00FF88', fontSize: '0.5rem', marginLeft: 2 }}>MAX</span>
              )}
            </div>
            {cost && (
              <div style={{ color: 'var(--color-dim)', fontSize: '0.5rem', marginTop: 1 }}>
                {cost.credits} CR &middot; {cost.wissen} W
              </div>
            )}
          </div>
        );
      })}
      <div
        style={{ color: 'var(--color-dim)', fontSize: '0.55rem', marginTop: 2, marginBottom: 4 }}
      >
        GESAMT: {xp.total}/100
      </div>

      {/* Active Effects */}
      {effects &&
        (effects.extraModuleSlots > 0 ||
          effects.scanRadiusBonus > 0 ||
          effects.miningBonus > 0 ||
          effects.combatDamageBonus > 0 ||
          effects.ancientDetection ||
          effects.helionDecoderEnabled) && (
          <>
            <div style={sectionHdr}>AKTIVE EFFEKTE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
              {effects.extraModuleSlots > 0 && (
                <span style={effectTag}>+{effects.extraModuleSlots} Modul-Slots</span>
              )}
              {effects.scanRadiusBonus > 0 && (
                <span style={effectTag}>+{effects.scanRadiusBonus} Scan-Radius</span>
              )}
              {effects.miningBonus > 0 && (
                <span style={effectTag}>+{Math.round(effects.miningBonus * 100)}% Mining</span>
              )}
              {effects.combatDamageBonus > 0 && (
                <span style={effectTag}>
                  +{Math.round(effects.combatDamageBonus * 100)}% Schaden
                </span>
              )}
              {effects.ancientDetection && (
                <span style={effectTag}>Ancient-Erkennung</span>
              )}
              {effects.helionDecoderEnabled && (
                <span style={effectTag}>Helion-Decoder</span>
              )}
            </div>
          </>
        )}

      {/* Module Slots */}
      <div style={sectionHdr}>MODUL-SLOTS</div>
      <div style={{ color: 'var(--color-primary)', marginBottom: 4, fontSize: '0.6rem' }}>
        {installedCount}/{totalSlots} SLOTS BELEGT
        {extraSlots > 0 && (
          <span style={{ color: '#FFB000', marginLeft: 6, fontSize: '0.55rem' }}>
            +{extraSlots} AUSBAU
          </span>
        )}
      </div>

      {/* Traits */}
      {traits.length > 0 && (
        <>
          <div style={sectionHdr}>TRAITS</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {traits.map((t) => (
              <span key={t} style={{ color: '#00CFFF', fontSize: '0.55rem' }}>
                &#9672; {t.toUpperCase()}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// -- Styles ------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  padding: '4px 6px',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  lineHeight: 1.5,
  overflow: 'auto',
  height: '100%',
};

const sectionHdr: React.CSSProperties = {
  borderBottom: '1px solid var(--color-dim)',
  paddingBottom: 2,
  marginBottom: 4,
  marginTop: 8,
  fontSize: '0.6rem',
  letterSpacing: '0.15em',
  opacity: 0.7,
};

const headerRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '2px 0',
  borderBottom: '1px solid rgba(255,176,0,0.1)',
};

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

const barTrack: React.CSSProperties = {
  flex: 1,
  height: 4,
  background: 'rgba(255,255,255,0.1)',
  borderRadius: 2,
  overflow: 'hidden',
};

const barFill: React.CSSProperties = {
  height: '100%',
  borderRadius: 2,
  transition: 'width 0.3s',
};

const effectTag: React.CSSProperties = {
  color: '#FFB000',
  fontSize: '0.55rem',
  opacity: 0.85,
  background: 'rgba(255,176,0,0.08)',
  padding: '0 3px',
  borderRadius: 1,
};
