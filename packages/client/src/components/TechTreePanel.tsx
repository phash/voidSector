import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULES, isModuleFreelyAvailable } from '@void-sector/shared';
import type { ModuleDefinition, ResearchState, ModuleCategory } from '@void-sector/shared';

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  drive: 'ANTRIEB',
  cargo: 'FRACHT',
  scanner: 'SCANNER',
  armor: 'PANZERUNG',
  weapon: 'WAFFEN',
  shield: 'SCHILD',
  defense: 'VERTEIDIGUNG',
  special: 'SPEZIAL',
  mining: 'BERGBAU',
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
): 'free' | 'unlocked' | 'blueprint' | 'locked' | 'researching' {
  if (research.activeResearch?.moduleId === mod.id) return 'researching';
  if (isModuleFreelyAvailable(mod.id)) return 'free';
  if (research.unlockedModules.includes(mod.id)) return 'unlocked';
  if (research.blueprints.includes(mod.id)) return 'blueprint';
  return 'locked';
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'FERTIG';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

export function TechTreePanel() {
  const research = useStore((s) => s.research);
  const selectedModuleId = useStore((s) => s.selectedTechModule);
  const setSelectedTechModule = useStore((s) => s.setSelectedTechModule);
  const pushBreadcrumb = useStore((s) => s.pushBreadcrumb);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    network.requestResearchState();
  }, []);

  useEffect(() => {
    if (!research.activeResearch) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [research.activeResearch]);

  const grouped = groupModulesByCategory();
  const activeResearch = research.activeResearch;
  const activeMod = activeResearch ? MODULES[activeResearch.moduleId] : null;
  const remaining = activeResearch ? activeResearch.completesAt - now : 0;
  const isComplete = activeResearch ? remaining <= 0 : false;

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
        }}
      >
        TECH-BAUM / FORSCHUNG
      </div>

      {/* Active Research */}
      {activeResearch && activeMod && (
        <div
          style={{
            border: '1px solid var(--color-primary)',
            padding: '4px 6px',
            marginBottom: 6,
            cursor: 'pointer',
          }}
          onClick={() => { pushBreadcrumb({ label: 'TECH', program: 'TECH' }); setSelectedTechModule(activeMod.id); }}
        >
          <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', letterSpacing: '0.1em' }}>
            AKTIVE FORSCHUNG
          </div>
          <div style={{ marginTop: 2 }}>
            {activeMod.name}
            <span style={{ color: 'var(--color-dim)', marginLeft: 4 }}>T{activeMod.tier}</span>
          </div>
          <div style={{ marginTop: 2, fontSize: '0.55rem' }}>
            {isComplete ? (
              <span style={{ color: '#00FF88' }}>ABGESCHLOSSEN</span>
            ) : (
              <span style={{ color: '#FFB000' }}>{formatCountdown(remaining)}</span>
            )}
          </div>
        </div>
      )}

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
                  onClick={() => { pushBreadcrumb({ label: 'TECH', program: 'TECH' }); setSelectedTechModule(mod.id); }}
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
                    {status === 'free' && <span style={{ color: '#00FF88' }}>FREI</span>}
                    {status === 'unlocked' && <span style={{ color: '#00FF88' }}>&#x2713;</span>}
                    {status === 'blueprint' && <span style={{ color: '#00BFFF' }}>BP</span>}
                    {status === 'researching' && <span style={{ color: '#FFB000' }}>&#x21BB;</span>}
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
