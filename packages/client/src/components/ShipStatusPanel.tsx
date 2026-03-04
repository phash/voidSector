import { useStore } from '../state/store';
import { HULLS, MODULES } from '@void-sector/shared';
import type { ShipModule, ModuleCategory } from '@void-sector/shared';

const linkBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.55rem',
  cursor: 'pointer',
  padding: '2px 0',
  textDecoration: 'underline',
  textAlign: 'left' as const,
};

const DISPLAY_CATEGORIES: ModuleCategory[] = [
  'drive', 'scanner', 'cargo', 'armor', 'mining',
];

const CATEGORY_LABELS: Record<string, string> = {
  drive: 'DRIVE',
  scanner: 'SCANNER',
  cargo: 'CARGO',
  armor: 'ARMOR',
  mining: 'MINING',
};

const sectionHeader: React.CSSProperties = {
  borderBottom: '1px solid var(--color-dim)',
  paddingBottom: 2,
  marginBottom: 4,
  marginTop: 8,
  fontSize: '0.55rem',
  letterSpacing: '0.15em',
  color: 'var(--color-dim)',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.55rem',
  color: 'var(--color-dim)',
};

const valueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  color: 'var(--color-primary)',
};

const statRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1px 0',
};

function getModuleForCategory(modules: ShipModule[], category: ModuleCategory): string | null {
  for (const mod of modules) {
    const def = MODULES[mod.moduleId];
    if (def && def.category === category) {
      return def.displayName;
    }
  }
  return null;
}

export function ShipStatusPanel() {
  const ship = useStore((s) => s.ship);
  const fuel = useStore((s) => s.fuel);
  const setActiveProgram = useStore((s) => s.setActiveProgram);

  if (!ship) {
    return (
      <div style={{
        padding: '4px 8px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        color: 'var(--color-dim)',
        opacity: 0.5,
      }}>
        NO SHIP DATA
      </div>
    );
  }

  const hull = HULLS[ship.hullType];
  const { stats } = ship;

  return (
    <div style={{
      padding: '4px 8px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.6rem',
      color: 'var(--color-primary)',
    }}>
      {/* Ship name and hull */}
      <div style={{
        fontSize: '0.6rem',
        letterSpacing: '0.15em',
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: 2,
        marginBottom: 4,
      }}>
        {ship.name}
      </div>
      <div style={{
        fontSize: '0.55rem',
        color: 'var(--color-dim)',
        marginBottom: 6,
      }}>
        {hull?.name ?? ship.hullType.toUpperCase()}
      </div>

      {/* Modules */}
      <div style={sectionHeader}>MODULES</div>
      {DISPLAY_CATEGORIES.map((cat) => {
        const moduleName = getModuleForCategory(ship.modules, cat);
        return (
          <div key={cat} style={statRow}>
            <span style={labelStyle}>{CATEGORY_LABELS[cat]}</span>
            <span style={{
              ...valueStyle,
              opacity: moduleName ? 1 : 0.4,
            }}>
              {moduleName ?? '---'}
            </span>
          </div>
        );
      })}

      {/* Stats */}
      <div style={sectionHeader}>STATS</div>
      <div key="hp" style={statRow}>
        <span style={labelStyle}>HP</span>
        <span style={valueStyle}>{stats.hp}</span>
      </div>
      <div key="cargo" style={statRow}>
        <span style={labelStyle}>CARGO CAP</span>
        <span style={valueStyle}>{stats.cargoCap}</span>
      </div>
      <div key="speed" style={statRow}>
        <span style={labelStyle}>SPEED</span>
        <span style={valueStyle}>{stats.engineSpeed}</span>
      </div>
      <div key="scanner" style={statRow}>
        <span style={labelStyle}>SCANNER LVL</span>
        <span style={valueStyle}>{stats.scannerLevel}</span>
      </div>
      <div key="fuel" style={statRow}>
        <span style={labelStyle}>FUEL</span>
        <span style={valueStyle}>
          {fuel ? `${fuel.current}/${fuel.max}` : `—/${stats.fuelMax}`}
        </span>
      </div>
      <div key="jump" style={statRow}>
        <span style={labelStyle}>JUMP RANGE</span>
        <span style={valueStyle}>{stats.jumpRange}</span>
      </div>

      {/* Quick-access to module/hangar screens */}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, borderTop: '1px solid var(--color-dim)', paddingTop: 4 }}>
        <button style={linkBtn} onClick={() => setActiveProgram('MODULES')}>[MODULES]</button>
        <button style={linkBtn} onClick={() => setActiveProgram('HANGAR')}>[HANGAR]</button>
      </div>
    </div>
  );
}
