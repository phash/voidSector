import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULE_MAP, isModuleFreelyAvailable, BLUEPRINT_COPY_BASE_COST } from '@void-sector/shared';
import type { ModuleDefinition } from '@void-sector/shared';

function costLine(mod: ModuleDefinition): string {
  const parts: string[] = [`${mod.costCredits} CR`];
  if (mod.costOre) parts.push(`${mod.costOre} ERZ`);
  if (mod.costGas) parts.push(`${mod.costGas} GAS`);
  if (mod.costCrystal) parts.push(`${mod.costCrystal} KRI`);
  if (mod.costArtefact && mod.costArtefact !== '0') parts.push(`${mod.costArtefact} ART`);
  return parts.join(' | ');
}

/** Format stats object as readable lines */
function statLines(stats: Record<string, number>): string[] {
  return Object.entries(stats)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`);
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  padding: '3px 8px',
  cursor: 'pointer',
  letterSpacing: '0.05em',
};

export function TechDetailPanel() {
  const { t } = useTranslation('ui');
  const selectedModuleId = useStore((s) => s.selectedTechModule);
  const research = useStore((s) => s.research);
  const currentSector = useStore((s) => s.currentSector);
  const baseStructures = useStore((s) => s.baseStructures);

  if (!selectedModuleId) {
    return (
      <div
        style={{
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          color: 'var(--color-dim)',
          textAlign: 'center',
          marginTop: 24,
        }}
      >
        {t('tech.selectModule')}
      </div>
    );
  }

  const mod = MODULE_MAP.get(selectedModuleId);
  if (!mod) return null;

  const isAtStation = currentSector?.type === 'station';
  const hasBase = baseStructures.some((s: any) => s.type === 'base');
  const canShop = isAtStation || hasBase;

  const isFree = isModuleFreelyAvailable(mod.id);
  const isUnlocked = research.unlockedModules.includes(mod.id);
  const hasBP = research.blueprints.includes(mod.id);

  const prerequisiteMod = mod.prerequisiteModuleId ? MODULE_MAP.get(mod.prerequisiteModuleId) : null;

  return (
    <div
      style={{
        padding: '8px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        lineHeight: 1.6,
        height: '100%',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--color-primary)',
          fontWeight: 'bold',
          marginBottom: 4,
        }}
      >
        {mod.name}
      </div>
      <div style={{ color: 'var(--color-dim)', marginBottom: 8 }}>
        TIER {mod.tier} | {mod.category.toUpperCase()}
      </div>

      {/* Effects / Stats */}
      <div
        style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: 4, marginBottom: 6 }}
      >
        <div
          style={{
            color: 'var(--color-dim)',
            fontSize: '0.55rem',
            letterSpacing: '0.1em',
            marginBottom: 2,
          }}
        >
          {t('tech.effects')}
        </div>
        <div style={{ color: 'var(--color-primary)' }}>{mod.description}</div>
        {statLines(mod.stats).map((line, i) => (
          <div key={i} style={{ color: 'var(--color-dim)' }}>
            {line}
          </div>
        ))}
      </div>

      {/* Prerequisite */}
      {prerequisiteMod && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--color-dim)' }}>{t('tech.prerequisite')}: </span>
          <span
            style={{
              color: research.unlockedModules.includes(prerequisiteMod.id) ? '#00FF88' : '#FF3333',
            }}
          >
            {prerequisiteMod.name}
          </span>
        </div>
      )}

      {/* Purchase cost */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            color: 'var(--color-dim)',
            fontSize: '0.55rem',
            letterSpacing: '0.1em',
            marginBottom: 2,
          }}
        >
          {t('tech.purchasePrice')}
        </div>
        <div>{costLine(mod)}</div>
      </div>

      {/* Status + Actions */}
      <div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: 6 }}>
        {(isFree || isUnlocked) && (
          <div>
            <div style={{ color: '#00FF88', marginBottom: 4 }}>
              {isFree ? t('tech.freeAvailable') : t('tech.researched')}
            </div>
            {canShop && (
              <button style={btnStyle} onClick={() => network.sendBuyModule(mod.id)}>
                {t('tech.buy', { cost: costLine(mod) })}
              </button>
            )}
            {!canShop && (
              <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem' }}>
                {t('tech.onlyAtStationOrBase')}
              </div>
            )}
          </div>
        )}
        {hasBP && !isUnlocked && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ color: '#00BFFF', marginBottom: 4 }}>{t('tech.blueprintAvailable')}</div>
            <button style={btnStyle} onClick={() => network.sendActivateBlueprint(mod.id)}>
              {t('tech.activateBlueprint')}
            </button>
          </div>
        )}
        {isUnlocked && mod.costCredits > 0 && (
          <div style={{ marginTop: 6 }}>
            <button
              style={btnStyle}
              onClick={() => network.sendCreateBlueprintCopy(mod.id)}
            >
              [BLUEPRINT HERSTELLEN — {BLUEPRINT_COPY_BASE_COST * mod.tier} CR]
            </button>
          </div>
        )}
        {!isFree && !isUnlocked && !hasBP && (
          <div style={{ color: '#FF3333', fontSize: '0.55rem' }}>{t('tech.locked')}</div>
        )}
      </div>
    </div>
  );
}
