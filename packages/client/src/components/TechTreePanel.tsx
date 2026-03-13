import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULES, isModuleFreelyAvailable } from '@void-sector/shared';
import type { ModuleDefinition, ResearchState, ModuleCategory } from '@void-sector/shared';

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  drive: 'DRIVE',
  cargo: 'CARGO',
  scanner: 'SCANNER',
  armor: 'ARMOR',
  weapon: 'WEAPONS',
  shield: 'SHIELD',
  defense: 'DEFENSE',
  special: 'SPECIAL',
  mining: 'MINING',
};

const CATEGORY_ORDER: ModuleCategory[] = [
  'drive',
  'cargo',
  'scanner',
  'armor',
  'weapon',
  'shield',
  'defense',
  'special',
];

function groupModulesByCategory(): Record<string, ModuleDefinition[]> {
  const groups: Record<string, ModuleDefinition[]> = {};
  for (const mod of Object.values(MODULES)) {
    const cat = mod.factionRequirement ? 'special' : mod.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(mod);
  }
  return groups;
}

function getModuleStatus(
  mod: ModuleDefinition,
  research: ResearchState,
): 'free' | 'unlocked' | 'blueprint' | 'locked' {
  if (isModuleFreelyAvailable(mod.id)) return 'free';
  if (research.unlockedModules.includes(mod.id)) return 'unlocked';
  if (research.blueprints.includes(mod.id)) return 'blueprint';
  return 'locked';
}

export function TechTreePanel() {
  const { t } = useTranslation('ui');
  const research = useStore((s) => s.research);
  const wissen = research.wissen ?? 0;
  const selectedModuleId = useStore((s) => s.selectedTechModule);
  const setSelectedTechModule = useStore((s) => s.setSelectedTechModule);
  const pushBreadcrumb = useStore((s) => s.pushBreadcrumb);

  useEffect(() => {
    network.requestResearchState();
    network.getTechTree();
  }, []);

  const grouped = groupModulesByCategory();

  return (
    <div
      style={{
        padding: '4px 6px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        lineHeight: 1.5,
        overflow: 'auto',
        height: '100%',
        color: 'var(--color-primary)',
      }}
    >
      <div
        style={{
          letterSpacing: '0.15em',
          fontSize: '0.65rem',
          marginBottom: 6,
          borderBottom: '1px solid var(--color-dim)',
          paddingBottom: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span>{t('tech.techTree')}</span>
        <span style={{ color: '#FFB000', fontSize: '0.6rem', letterSpacing: '0.08em' }}>
          &#x25C8; {t('tech.wissen', { n: wissen })}
        </span>
      </div>

      {/* Module groups by category — compact clickable list */}
      {CATEGORY_ORDER.map((cat) => {
        const mods = grouped[cat];
        if (!mods || mods.length === 0) return null;
        return (
          <div key={cat}>
            <div
              style={{
                borderBottom: '1px solid var(--color-dim)',
                paddingBottom: 2,
                marginBottom: 4,
                marginTop: 8,
                fontSize: '0.6rem',
                letterSpacing: '0.15em',
                opacity: 0.7,
              }}
            >
              {CATEGORY_LABELS[cat]}
            </div>
            {mods.map((mod) => {
              const status = getModuleStatus(mod, research);
              const isSelected = selectedModuleId === mod.id;

              return (
                <div
                  key={mod.id}
                  onClick={() => { pushBreadcrumb({ label: mod.name, program: 'TECH' }); setSelectedTechModule(mod.id); }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '2px 4px',
                    cursor: 'pointer',
                    opacity: status === 'locked' ? 0.5 : 1,
                    borderLeft: isSelected
                      ? '2px solid var(--color-primary)'
                      : '2px solid transparent',
                    background: isSelected ? 'rgba(255,176,0,0.05)' : 'transparent',
                  }}
                >
                  <span>
                    <span style={{ color: 'var(--color-primary)' }}>{mod.name}</span>
                    <span style={{ color: 'var(--color-dim)', marginLeft: 4, fontSize: '0.5rem' }}>
                      T{mod.tier}
                    </span>
                  </span>
                  <span style={{ flexShrink: 0, marginLeft: 4, fontSize: '0.5rem' }}>
                    {status === 'free' && <span style={{ color: '#00FF88' }}>FREE</span>}
                    {status === 'unlocked' && <span style={{ color: '#00FF88' }}>&#x2713;</span>}
                    {status === 'blueprint' && <span style={{ color: '#00BFFF' }}>BP</span>}
                    {status === 'locked' && (
                      <span style={{ color: 'var(--color-dim)' }}>&#x1F512;</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
