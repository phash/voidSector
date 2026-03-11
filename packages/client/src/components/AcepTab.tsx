import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { AcepPath } from '@void-sector/shared';
import { getAcepBoostCost } from '@void-sector/shared';

const PATHS: Array<{ key: AcepPath; label: string; color: string }> = [
  { key: 'ausbau',   label: 'AUSBAU', color: '#FFB000' },
  { key: 'intel',    label: 'INTEL',  color: '#4af' },
  { key: 'kampf',    label: 'KAMPF',  color: '#FF4444' },
  { key: 'explorer', label: 'EXPLR',  color: '#4fa' },
];

const TRAIT_LABELS: Record<string, string> = {
  veteran:           'VETERAN',
  curious:           'CURIOUS',
  reckless:          'RECKLESS',
  cautious:          'CAUTIOUS',
  'ancient-touched': 'ANCIENT',
  scarred:           'SCARRED',
};

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  padding: '3px 8px',
  cursor: 'pointer',
};

const sectionHdr: React.CSSProperties = {
  fontSize: '0.75rem',
  letterSpacing: '0.12em',
  color: '#666',
  marginBottom: 8,
  marginTop: 12,
};

const barTrack: React.CSSProperties = {
  flex: 1,
  height: 10,
  background: '#111',
  border: '1px solid #333',
  overflow: 'hidden',
};

export function AcepTab() {
  const ship = useStore((s) => s.ship);
  const credits = useStore((s) => s.credits ?? 0);
  const wissen = useStore((s) => s.research.wissen ?? 0);
  const [renamingShipId, setRenamingShipId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (!ship) {
    return (
      <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '1rem', opacity: 0.4 }}>
        KEIN SCHIFF
      </div>
    );
  }

  const xp = ship.acepXp ?? { ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0 };
  const effects = ship.acepEffects;
  const traits = ship.acepTraits ?? [];
  const gen = ship.acepGeneration ?? 1;

  const handleRename = (shipId: string) => {
    if (renameValue.trim() && renameValue.length <= 20) {
      network.sendRenameShip(shipId, renameValue.trim());
      setRenamingShipId(null);
      setRenameValue('');
    }
  };

  const activeEffects: string[] = [];
  if (effects) {
    if (effects.extraModuleSlots > 0) activeEffects.push(`+${effects.extraModuleSlots} Modul-Slots`);
    if (effects.scanRadiusBonus > 0) activeEffects.push(`+${effects.scanRadiusBonus} Scan-Radius`);
    if (effects.miningBonus > 0) activeEffects.push(`+${Math.round(effects.miningBonus * 100)}% Mining`);
    if (effects.combatDamageBonus > 0) activeEffects.push(`+${Math.round(effects.combatDamageBonus * 100)}% Schaden`);
    if (effects.cargoMultiplier > 1) activeEffects.push(`+${Math.round((effects.cargoMultiplier - 1) * 100)}% Cargo`);
    if (effects.ancientDetection) activeEffects.push('Ancient-Erkennung');
    if (effects.helionDecoderEnabled) activeEffects.push('Helion-Decoder');
  }

  return (
    <div style={{ padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '1rem', overflow: 'auto', height: '100%' }}>
      {/* Ship header with rename */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span>
          <span style={{ color: 'var(--color-primary)' }}>{ship.name}</span>
          <span style={{ color: 'var(--color-dim)', marginLeft: 8, fontSize: '0.8rem' }}>
            ACEP GEN-{gen}
          </span>
        </span>
        {renamingShipId === ship.id ? (
          <span style={{ display: 'flex', gap: 4 }}>
            <input
              style={{
                background: 'transparent', border: '1px solid var(--color-dim)',
                color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem', padding: '2px 6px', width: 120,
              }}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value.slice(0, 20))}
              onKeyDown={(e) => e.key === 'Enter' && handleRename(ship.id)}
              maxLength={20}
              autoFocus
              placeholder="Name..."
            />
            <button style={btnStyle} onClick={() => handleRename(ship.id)}>OK</button>
            <button style={btnStyle} onClick={() => setRenamingShipId(null)}>X</button>
          </span>
        ) : (
          <button style={btnStyle} onClick={() => { setRenamingShipId(ship.id); setRenameValue(ship.name); }}>
            UMBENENNEN
          </button>
        )}
      </div>

      {/* XP paths */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={sectionHdr}>ENTWICKLUNGSPFADE</div>
        <div style={{ color: '#555', fontSize: '0.85rem' }}>
          GESAMT: {xp.total}/100
        </div>
      </div>
      {PATHS.map(({ key, label, color }) => {
        const pathXp = xp[key] ?? 0;
        const cost = getAcepBoostCost(pathXp);
        const canBoost = cost !== null && credits >= cost.credits && wissen >= cost.wissen && xp.total < 100;
        return (
          <div key={key} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color }}>{label}</span>
              <span style={{ color: '#888', fontSize: '0.95rem' }}>{pathXp}/50 · Lv{Math.floor(pathXp / 10)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={barTrack}>
                <div style={{ width: `${(pathXp / 50) * 100}%`, height: '100%', background: color }} />
              </div>
              {cost ? (
                <button
                  style={{ ...btnStyle, border: `1px solid ${color}`, color, opacity: canBoost ? 1 : 0.35 }}
                  disabled={!canBoost}
                  title={`+5 XP kostet ${cost.credits} CR · ${cost.wissen} W`}
                  onClick={() => network.sendAcepBoost(key)}
                >
                  [+5]
                </button>
              ) : (
                <span style={{ color: '#00FF88', fontSize: '0.8rem' }}>MAX</span>
              )}
            </div>
            {cost && (
              <div style={{ color: '#555', fontSize: '0.8rem', marginTop: 2 }}>
                {cost.credits} CR · {cost.wissen} W
              </div>
            )}
          </div>
        );
      })}
      {/* Active effects */}
      <>
        <div style={{ borderTop: '1px solid #333', paddingTop: 12, ...sectionHdr }}>
          AKTIVE EFFEKTE
        </div>
        {activeEffects.length > 0 && (
          <div style={{ fontSize: '0.9rem', color: '#ccc', lineHeight: 1.9, marginBottom: 12 }}>
            {activeEffects.map((e) => <div key={e}>{e}</div>)}
          </div>
        )}
      </>

      {/* Traits */}
      <>
        <div style={{ borderTop: '1px solid #333', paddingTop: 12, ...sectionHdr }}>TRAITS</div>
        {traits.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {traits.map((t) => (
              <span
                key={t}
                style={{ border: '1px solid #4a9', color: '#4a9', padding: '4px 10px', fontSize: '0.88rem' }}
              >
                {TRAIT_LABELS[t] ?? t.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </>
    </div>
  );
}
