import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import {
  SPECIALIZED_SLOT_CATEGORIES,
  getExtraSlotCount,
  getAcepLevel,
  MODULES,
} from '@void-sector/shared';
import { AcepPanel } from './AcepPanel';
import { getModuleSourceColor } from './moduleUtils';

const CAT_LABELS: Record<string, string> = {
  generator: 'GEN',
  drive: 'DRV',
  weapon: 'WPN',
  armor: 'ARM',
  shield: 'SHD',
  scanner: 'SCN',
  miner: 'MIN',
  cargo: 'CGO',
};

function hpBar(current: number, max: number): string {
  if (max <= 0) return '███';
  const filled = Math.round((current / max) * 3);
  return '█'.repeat(filled) + '░'.repeat(3 - filled);
}

export function AcepProgram() {
  const ship = useStore((s) => s.ship);
  const setActiveProgram = useStore((s) => s.setActiveProgram);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  if (!ship) {
    return (
      <div style={{ padding: 12, fontFamily: 'var(--font-mono)', fontSize: '0.65rem', opacity: 0.5 }}>
        NO ACTIVE SHIP
      </div>
    );
  }

  const { acepXp, acepEffects, acepTraits, modules } = ship as any;
  const ausbauXp = acepXp?.ausbau ?? 0;
  const extraSlotCount = getExtraSlotCount(ausbauXp);
  const moduleBySlot = new Map((modules ?? []).map((m: any) => [m.slotIndex, m]));

  const specializedSlots = SPECIALIZED_SLOT_CATEGORIES.map((cat, idx) => ({
    index: idx,
    cat,
    label: CAT_LABELS[cat] ?? cat.toUpperCase().slice(0, 3),
    module: (moduleBySlot.get(idx) as any) ?? null,
  }));

  const extraSlots = Array.from({ length: extraSlotCount }, (_, i) => ({
    index: SPECIALIZED_SLOT_CATEGORIES.length + i,
    label: `+${i + 1}`,
    module: (moduleBySlot.get(SPECIALIZED_SLOT_CATEGORIES.length + i) as any) ?? null,
  }));

  const handleSlotClick = (idx: number) => {
    const mod = moduleBySlot.get(idx);
    if (!mod) {
      setActiveProgram('MODULES');
    } else {
      setSelectedSlot(selectedSlot === idx ? null : idx);
    }
  };

  const acepForPanel =
    acepXp && acepTraits
      ? { ...acepXp, traits: acepTraits }
      : null;

  const colStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    overflow: 'auto',
    padding: '8px 10px',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.6rem',
    padding: '2px 4px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    lineHeight: 1.6,
  };

  const renderSlotRow = (
    idx: number,
    catLabel: string,
    mod: any | null,
  ) => {
    const isSelected = selectedSlot === idx;
    const modDef = mod ? MODULES[mod.moduleId] : null;
    const color = mod ? getModuleSourceColor(mod.source) : 'var(--color-dim)';
    const name = modDef ? modDef.name : '—';
    const bar = mod ? hpBar(mod.currentHp, mod.maxHp) : '───';

    return (
      <div key={idx}>
        <div
          data-testid={`acep-slot-${idx}`}
          style={{ ...rowStyle, color: mod ? color : 'var(--color-dim)' }}
          onClick={() => handleSlotClick(idx)}
        >
          <span style={{ opacity: 0.6, minWidth: 28 }}>[{catLabel}]</span>
          <span
            style={{
              flex: 1,
              paddingLeft: 6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
          <span style={{ fontFamily: 'monospace', letterSpacing: 0, opacity: 0.7 }}>{bar}</span>
        </div>
        {isSelected && mod && (
          <div style={{ padding: '2px 4px 4px', display: 'flex', gap: 4 }}>
            <button
              style={{
                background: 'transparent',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.55rem',
                padding: '1px 6px',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                network.sendUninstallModule(idx);
                setSelectedSlot(null);
              }}
            >
              UNINSTALL
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--font-mono)' }}>
      {/* Left column: module slots */}
      <div style={{ ...colStyle, borderRight: '1px solid var(--color-dim)' }}>
        <div
          style={{
            fontSize: '0.6rem',
            opacity: 0.5,
            letterSpacing: '0.1em',
            marginBottom: 6,
          }}
        >
          MODUL-SLOTS — ACEP
        </div>
        {specializedSlots.map(({ index, label, module }) =>
          renderSlotRow(index, label, module),
        )}
        {extraSlots.length > 0 && (
          <>
            <div
              style={{
                fontSize: '0.55rem',
                opacity: 0.4,
                marginTop: 6,
                marginBottom: 2,
                letterSpacing: '0.1em',
              }}
            >
              ─── EXTRA SLOTS ───
            </div>
            {extraSlots.map(({ index, label, module }) =>
              renderSlotRow(index, label, module),
            )}
          </>
        )}
      </div>

      {/* Right column: XP paths + effects + traits */}
      <div style={colStyle}>
        <div
          style={{
            fontSize: '0.6rem',
            opacity: 0.5,
            letterSpacing: '0.1em',
            marginBottom: 6,
          }}
        >
          ENTWICKLUNGSPFADE
        </div>
        {acepForPanel ? (
          <AcepPanel acep={acepForPanel} />
        ) : (
          <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>NO ACEP DATA</div>
        )}
        {acepEffects && (
          <div
            style={{
              marginTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: 6,
            }}
          >
            <div
              style={{
                fontSize: '0.55rem',
                opacity: 0.4,
                marginBottom: 4,
                letterSpacing: '0.1em',
              }}
            >
              AKTIVE EFFEKTE
            </div>
            {acepEffects.extraModuleSlots > 0 && (
              <div style={{ fontSize: '0.58rem', color: '#00FF88' }}>
                +{acepEffects.extraModuleSlots} Modul-Slots
              </div>
            )}
            {acepEffects.scanRadiusBonus > 0 && (
              <div style={{ fontSize: '0.58rem', color: '#00FF88' }}>
                +{acepEffects.scanRadiusBonus} Scan-Radius
              </div>
            )}
            {acepEffects.miningBonus > 0 && (
              <div style={{ fontSize: '0.58rem', color: '#00FF88' }}>
                +{Math.round(acepEffects.miningBonus * 100)}% Mining
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
