// packages/client/src/components/ShipDetailPanel.tsx
import { useStore } from '../state/store';
import { MONITORS, HULLS } from '@void-sector/shared';

const ACEP_DETAIL_PATHS = [
  { key: 'ausbau'   as const, label: 'CNST', color: '#ffaa00' },
  { key: 'intel'    as const, label: 'INTL', color: '#00ffcc' },
  { key: 'kampf'    as const, label: 'CMBT', color: '#ff4444' },
  { key: 'explorer' as const, label: 'EXPL', color: '#8888ff' },
];

const TRAIT_COLORS: Record<string, string> = {
  veteran:           '#00ffcc',  // positive — cyan
  'ancient-touched': '#cc88ff',  // achievement — purple
  curious:           '#8888ff',  // explorer — soft purple
  cautious:          '#44cc88',  // defensive — green
  reckless:          '#ff8800',  // risky — orange
  scarred:           '#ff8800',  // risky — orange
};

function acepBar(xp: number, max = 50): string {
  const filled = Math.round((xp / max) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function toTitleCase(moduleId: string): string {
  return moduleId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ShipDetailPanel() {
  const ship = useStore((s) => s.ship);
  const setMonitorMode = useStore((s) => s.setMonitorMode);

  if (!ship) return null;

  const xp = ship.acepXp;
  const traits = ship.acepTraits ?? [];
  const installedModules = ship.modules ?? [];
  const baseSlots = HULLS[ship.hullType]?.slots ?? 3;
  const extraSlots = ship.acepEffects?.extraModuleSlots ?? 0;
  const maxSlots = baseSlots + extraSlots;
  const freeSlots = maxSlots - installedModules.length;
  const gen = ship.acepGeneration;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px', fontSize: '0.78rem' }}>
      {/* Header */}
      <div style={{ fontSize: '0.7rem', letterSpacing: '2px', color: '#888', marginBottom: '8px' }}>
        ⬡ {ship.name}{gen && gen > 1 ? ` · GEN ${gen}` : ''}
      </div>

      {/* ACEP Paths */}
      <div style={{ background: '#0a0a0a', border: '1px solid #222', padding: '6px 8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '1px', color: '#555', marginBottom: '6px' }}>
          ACEP PATHS
        </div>
        {ACEP_DETAIL_PATHS.map(({ key, label, color }) => {
          const val = xp ? xp[key] : 0;
          return (
            <div
              key={key}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '3px' }}
            >
              <span style={{ color, width: '32px' }}>{label}</span>
              <span style={{ color, letterSpacing: '-1px', flex: 1, margin: '0 6px' }}>{acepBar(val)}</span>
              <span style={{ color: '#555', width: '24px', textAlign: 'right' }}>{val}</span>
            </div>
          );
        })}
        {/* Traits */}
        <div style={{ borderTop: '1px solid #1a1a1a', marginTop: '5px', paddingTop: '5px', fontSize: '0.67rem' }}>
          {traits.length > 0 ? (
            traits.map((t, i) => (
              <span key={t}>
                {i > 0 && <span style={{ color: '#333' }}> · </span>}
                <span data-trait={t} style={{ color: TRAIT_COLORS[t] ?? '#aaa' }}>
                  ⬡ {t.toUpperCase()}
                </span>
              </span>
            ))
          ) : (
            <span style={{ color: '#444' }}>NO TRAITS ACTIVE YET</span>
          )}
        </div>
      </div>

      {/* Modules */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '1px', color: '#555', marginBottom: '4px' }}>
          MODULES · {installedModules.length}/{maxSlots} SLOTS
        </div>
        {installedModules.length > 0 ? (
          <div style={{ color: '#aaa', fontSize: '0.68rem', lineHeight: 1.4 }}>
            {installedModules.map((m) => toTitleCase(m.moduleId)).join(' · ')}
          </div>
        ) : (
          <div style={{ color: '#444', fontSize: '0.65rem' }}>No modules installed</div>
        )}
        <div style={{ color: '#444', fontSize: '0.65rem', marginTop: '2px' }}>
          {freeSlots} slot{freeSlots !== 1 ? 's' : ''} free
        </div>
      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: '4px', marginTop: 'auto' }}>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setMonitorMode(MONITORS.SHIP_SYS, 'acep')}
        >
          [ACEP →]
        </button>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setMonitorMode(MONITORS.SHIP_SYS, 'modules')}
        >
          [MODULES →]
        </button>
      </div>
    </div>
  );
}
