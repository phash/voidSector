import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { MODULES, calculateShipStats } from '@void-sector/shared';
import type { ShipStats } from '@void-sector/shared';
import { ModuleArtwork } from './ModuleArtwork';

const TRAIT_KEYS: Record<string, { labelKey: string; descKey: string }> = {
  veteran:           { labelKey: 'acep.traits.veteran.label',       descKey: 'acep.traits.veteran.desc' },
  curious:           { labelKey: 'acep.traits.curious.label',       descKey: 'acep.traits.curious.desc' },
  reckless:          { labelKey: 'acep.traits.reckless.label',      descKey: 'acep.traits.reckless.desc' },
  cautious:          { labelKey: 'acep.traits.cautious.label',      descKey: 'acep.traits.cautious.desc' },
  'ancient-touched': { labelKey: 'acep.traits.ancientTouched.label', descKey: 'acep.traits.ancientTouched.desc' },
  scarred:           { labelKey: 'acep.traits.scarred.label',       descKey: 'acep.traits.scarred.desc' },
};

const STAT_KEYS: Array<{ key: keyof ShipStats; labelKey: string; format?: (v: number) => string }> = [
  { key: 'engineSpeed', labelKey: 'stats.drive',     format: (v) => `${Math.round(v * 100)}%` },
  { key: 'cargoCap',    labelKey: 'stats.cargo' },
  { key: 'scannerLevel', labelKey: 'stats.scanner' },
  { key: 'damageMod',   labelKey: 'stats.damage',    format: (v) => `${Math.round(v * 100)}%` },
  { key: 'shieldHp',    labelKey: 'stats.shield' },
  { key: 'hp',          labelKey: 'stats.hull' },
  { key: 'jumpRange',   labelKey: 'stats.jumpRange' },
];

function formatVal(v: number, format?: (v: number) => string): string {
  return format ? format(v) : String(Math.round(v * 10) / 10);
}

const dimStyle: CSSProperties = { fontSize: '0.85rem', color: '#555', padding: 14, fontFamily: 'var(--font-mono)' };
const hdrStyle: CSSProperties = { fontSize: '0.75rem', letterSpacing: '0.12em', color: '#666', marginBottom: 8 };

export function AcepDetailPanel() {
  const { t } = useTranslation('ui');
  const ship = useStore((s) => s.ship);
  const activeTab = useStore((s) => s.acepActiveTab);
  const hoveredId = useStore((s) => s.acepHoveredModuleId);

  if (!ship) return <div style={dimStyle}>{t('ship.noShip')}</div>;

  // ACEP tab: show trait explanations
  if (activeTab === 'acep') {
    const traits = ship.acepTraits ?? [];
    if (traits.length === 0) {
      const xp = ship.acepXp ?? { ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0 };
      return (
        <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
          <div style={hdrStyle}>{t('acep.traits')}</div>
          <div style={{ color: '#555' }}>{t('acep.noTraits')}</div>
          <div style={{ color: '#444', fontSize: '0.8rem', marginTop: 8 }}>
            {t('acep.traitsExplain')}
          </div>
          <div style={{ color: '#888', fontSize: '0.85rem', marginTop: 12 }}>
            {t('acep.budget', { current: xp.total, max: 100 })}
          </div>
          <div style={{ color: '#666', fontSize: '0.8rem', marginTop: 6 }}>
            {t('acep.xpDistribution', { ausbau: xp.ausbau, intel: xp.intel, kampf: xp.kampf, explorer: xp.explorer })}
          </div>
        </div>
      );
    }
    return (
      <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
        <div style={hdrStyle}>{t('acep.traits')}</div>
        {traits.map((trait) => {
          const info = TRAIT_KEYS[trait];
          if (!info) return null;
          return (
            <div key={trait} style={{ marginBottom: 10 }}>
              <div style={{ color: '#4a9', fontSize: '0.95rem', marginBottom: 2 }}>{t(info.labelKey)}</div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>{t(info.descKey)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  // MODULE or SHOP tab: hover for module detail
  if (!hoveredId) {
    return <div style={dimStyle}>{t('acep.hoverModuleForDetails')}</div>;
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
  const statsWithout = calculateShipStats(withoutModule, acepXp);
  const statsCandidate = calculateShipStats(
    [...withoutModule, { moduleId: hoveredId, slotIndex: 99, source: 'standard' as const }],
    acepXp,
  );

  const deltas = STAT_KEYS
    .map(({ key, labelKey, format }) => {
      const beforeNum = typeof statsWithout[key] === 'number' ? statsWithout[key] as number : 0;
      const afterNum = typeof statsCandidate[key] === 'number' ? statsCandidate[key] as number : 0;
      const delta = afterNum - beforeNum;
      if (Math.abs(delta) < 0.001) return null;
      const sign = delta > 0 ? '+' : '-';
      return {
        labelKey,
        before: formatVal(beforeNum, format),
        deltaStr: formatVal(Math.abs(delta), format),
        after: formatVal(afterNum, format),
        sign,
        positive: delta > 0,
      };
    })
    .filter(Boolean) as Array<{ labelKey: string; before: string; deltaStr: string; after: string; sign: string; positive: boolean }>;

  // Find currently installed module in same category (for SHOP tab replacement note)
  const replacedModule = activeTab === 'shop'
    ? (ship.modules ?? []).find((m) => {
        const d = MODULES[m.moduleId];
        return d && d.category === def.category;
      })
    : undefined;

  return (
    <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', overflow: 'auto', height: '100%' }}>
      <ModuleArtwork category={def.category} tier={def.tier} />
      <div style={{ color: 'var(--color-primary)', fontSize: '1rem', marginBottom: 4 }}>{def.displayName ?? def.name}</div>
      <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: 12 }}>[{def.category.toUpperCase()}]</div>

      {activeTab === 'shop' && (
        <>
          <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: 6 }}>
            {replacedModule
              ? t('acep.replaces', { name: MODULES[replacedModule.moduleId]?.name ?? replacedModule.moduleId })
              : t('acep.installsIn', { cat: (MODULES[hoveredId]?.category ?? '?').toUpperCase().slice(0, 3) })}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#4a9', marginBottom: 10 }}>
            {(() => {
              const parts: string[] = [`${def.cost.credits} CR`];
              if (def.cost.ore !== undefined) parts.push(`${def.cost.ore} ${t('resources.ore')}`);
              if (def.cost.gas !== undefined) parts.push(`${def.cost.gas} ${t('resources.gas')}`);
              if (def.cost.crystal !== undefined) parts.push(`${def.cost.crystal} ${t('resources.crystal')}`);
              if (def.cost.artefact !== undefined) parts.push(`${def.cost.artefact} ${t('resources.artefact')}`);
              return parts.join(' + ');
            })()}
          </div>
        </>
      )}

      <div style={hdrStyle}>{t('acep.effectOnShip')}</div>
      {deltas.length === 0 ? (
        <div style={{ color: '#555', fontSize: '0.85rem' }}>{t('acep.noStatChanges')}</div>
      ) : (
        deltas.map(({ labelKey, before, deltaStr, after, sign, positive }) => (
          <div key={labelKey} style={{ marginBottom: 6 }}>
            <span style={{ color: '#888', fontSize: '0.8rem' }}>{t(labelKey)}: </span>
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
          {(() => {
            const installed = (ship.modules ?? []).find((m) => m.moduleId === hoveredId);
            if (!installed) return null;
            const maxHp = MODULES[hoveredId]?.maxHp ?? 20;
            const currentHp = installed.currentHp ?? maxHp;
            const filled = maxHp > 0 ? Math.round((currentHp / maxHp) * 6) : 6;
            const bar = '█'.repeat(filled) + '░'.repeat(6 - filled);
            return (
              <div style={{ marginTop: 12, color: '#ccc', fontSize: '0.9rem' }}>
                HP: {currentHp}/{maxHp} {bar}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
