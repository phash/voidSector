import type { CSSProperties } from 'react';
import { useStore } from '../state/store';
import { MODULES, calculateShipStats } from '@void-sector/shared';
import type { ShipStats } from '@void-sector/shared';

const TRAIT_INFO: Record<string, { label: string; desc: string }> = {
  veteran:           { label: 'VETERAN',  desc: 'Kampferprobt. Hohe KAMPF-Erfahrung.' },
  curious:           { label: 'CURIOUS',  desc: 'Ständig am scannen. Hohe INTEL-Erfahrung.' },
  reckless:          { label: 'RECKLESS', desc: 'Kämpfer ohne Logistik-Sinn.' },
  cautious:          { label: 'CAUTIOUS', desc: 'Bauer, der Konflikten ausweicht.' },
  'ancient-touched': { label: 'ANCIENT',  desc: 'Hat Ruinen entdeckt. Hohe EXPLORER-Erfahrung.' },
  scarred:           { label: 'SCARRED',  desc: 'Tunnelblick-Kämpfer, kaum anderes.' },
};

const STAT_LABELS: Array<{ key: keyof ShipStats; label: string; format?: (v: number) => string }> = [
  { key: 'engineSpeed', label: 'Antrieb',    format: (v) => `${Math.round(v * 100)}%` },
  { key: 'cargoCap',    label: 'Cargo' },
  { key: 'scannerLevel', label: 'Scanner' },
  { key: 'damageMod',   label: 'Schaden',    format: (v) => `${Math.round(v * 100)}%` },
  { key: 'shieldHp',    label: 'Schild' },
  { key: 'hp',          label: 'Rumpf' },
  { key: 'jumpRange',   label: 'Sprungweite' },
];

function formatVal(v: number, format?: (v: number) => string): string {
  return format ? format(v) : String(Math.round(v * 10) / 10);
}

const dimStyle: CSSProperties = { fontSize: '0.85rem', color: '#555', padding: 14, fontFamily: 'var(--font-mono)' };
const hdrStyle: CSSProperties = { fontSize: '0.75rem', letterSpacing: '0.12em', color: '#666', marginBottom: 8 };

export function AcepDetailPanel() {
  const ship = useStore((s) => s.ship);
  const activeTab = useStore((s) => s.acepActiveTab);
  const hoveredId = useStore((s) => s.acepHoveredModuleId);

  if (!ship) return <div style={dimStyle}>KEIN SCHIFF</div>;

  // ACEP tab: show trait explanations
  if (activeTab === 'acep') {
    const traits = ship.acepTraits ?? [];
    if (traits.length === 0) {
      return (
        <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
          <div style={hdrStyle}>TRAITS</div>
          <div style={{ color: '#555' }}>Noch keine Traits</div>
          <div style={{ color: '#444', fontSize: '0.8rem', marginTop: 8 }}>
            Traits entstehen durch XP-Verteilung auf die 4 Pfade.
          </div>
        </div>
      );
    }
    return (
      <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
        <div style={hdrStyle}>TRAITS</div>
        {traits.map((t) => {
          const info = TRAIT_INFO[t];
          if (!info) return null;
          return (
            <div key={t} style={{ marginBottom: 10 }}>
              <div style={{ color: '#4a9', fontSize: '0.95rem', marginBottom: 2 }}>{info.label}</div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>{info.desc}</div>
            </div>
          );
        })}
      </div>
    );
  }

  // MODULE or SHOP tab: hover for module detail
  if (!hoveredId) {
    return <div style={dimStyle}>Modul hovern für Details</div>;
  }

  const def = MODULES[hoveredId];
  if (!def) return <div style={dimStyle}>—</div>;

  // Build AcepXpSnapshot (without total field)
  const acepXp = ship.acepXp
    ? { ausbau: ship.acepXp.ausbau, intel: ship.acepXp.intel, kampf: ship.acepXp.kampf, explorer: ship.acepXp.explorer }
    : undefined;

  // Compute delta: stats with vs without this module
  const currentModules = ship.modules ?? [];
  const withoutModule = currentModules.filter((m) => m.moduleId !== hoveredId);
  const statsWithout = calculateShipStats(ship.hullType, withoutModule, acepXp);
  const statsCandidate =
    activeTab === 'shop'
      ? calculateShipStats(ship.hullType, [...withoutModule, { moduleId: hoveredId, slotIndex: 99, source: 'standard' as const }], acepXp)
      : calculateShipStats(ship.hullType, currentModules, acepXp);

  const deltas = STAT_LABELS
    .map(({ key, label, format }) => {
      const beforeNum = statsWithout[key] as number;
      const afterNum = statsCandidate[key] as number;
      const delta = afterNum - beforeNum;
      if (Math.abs(delta) < 0.001) return null;
      const sign = delta > 0 ? '+' : '-';
      return {
        label,
        before: formatVal(beforeNum, format),
        deltaStr: formatVal(Math.abs(delta), format),
        after: formatVal(afterNum, format),
        sign,
        positive: delta > 0,
      };
    })
    .filter(Boolean) as Array<{ label: string; before: string; deltaStr: string; after: string; sign: string; positive: boolean }>;

  // Find currently installed module in same category (for SHOP tab replacement note)
  const replacedModule = activeTab === 'shop'
    ? ship.modules.find((m) => {
        const d = MODULES[m.moduleId];
        return d && d.category === def.category;
      })
    : undefined;

  return (
    <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', overflow: 'auto', height: '100%' }}>
      <div style={{ color: 'var(--color-primary)', fontSize: '1rem', marginBottom: 4 }}>{def.displayName ?? def.name}</div>
      <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: 12 }}>[{def.category.toUpperCase()}]</div>

      {activeTab === 'shop' && (
        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: 10 }}>
          {replacedModule
            ? `Ersetzt: ${MODULES[replacedModule.moduleId]?.name ?? replacedModule.moduleId}`
            : `Installiert in: [${(MODULES[hoveredId]?.category ?? '?').toUpperCase().slice(0, 3)}]-Slot`}
        </div>
      )}

      <div style={hdrStyle}>AUSWIRKUNG AUF SCHIFF</div>
      {deltas.length === 0 ? (
        <div style={{ color: '#555', fontSize: '0.85rem' }}>Keine direkten Stat-Änderungen</div>
      ) : (
        deltas.map(({ label, before, deltaStr, after, sign, positive }) => (
          <div key={label} style={{ marginBottom: 6 }}>
            <span style={{ color: '#888', fontSize: '0.8rem' }}>{label}: </span>
            <span style={{ color: '#ccc' }}>{before}</span>
            <span style={{ color: '#555' }}> → </span>
            <span style={{ color: positive ? '#00FF88' : '#f44' }}>{sign}{deltaStr}</span>
            <span style={{ color: '#555' }}> = </span>
            <span style={{ color: '#ccc' }}>{after}</span>
          </div>
        ))
      )}

      {activeTab === 'module' && (
        <>
          <div style={{ ...hdrStyle, marginTop: 12 }}>HP</div>
          <div style={{ color: '#ccc', fontSize: '0.9rem' }}>
            {(() => {
              const installed = ship.modules.find((m) => m.moduleId === hoveredId);
              if (!installed) return '—';
              const maxHp = MODULES[hoveredId]?.maxHp ?? 20;
              return `${installed.currentHp ?? maxHp} / ${maxHp}`;
            })()}
          </div>
        </>
      )}
    </div>
  );
}
