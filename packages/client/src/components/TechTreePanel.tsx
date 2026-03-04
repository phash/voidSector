import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULES, isModuleUnlocked, isModuleFreelyAvailable, canStartResearch } from '@void-sector/shared';
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
  'drive', 'cargo', 'scanner', 'armor', 'weapon', 'shield', 'defense', 'special',
];

const sectionHeader: React.CSSProperties = {
  borderBottom: '1px solid var(--color-dim)',
  paddingBottom: 2,
  marginBottom: 4,
  marginTop: 8,
  fontSize: '0.6rem',
  letterSpacing: '0.15em',
  opacity: 0.7,
};

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.55rem',
  padding: '1px 4px',
  cursor: 'pointer',
  letterSpacing: '0.05em',
};

const btnDangerStyle: React.CSSProperties = {
  ...btnStyle,
  borderColor: 'var(--color-danger)',
  color: 'var(--color-danger)',
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'FERTIG';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

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

function costString(cost: { credits: number; ore?: number; gas?: number; crystal?: number; artefact?: number }): string {
  const parts: string[] = [`${cost.credits} CR`];
  if (cost.ore) parts.push(`${cost.ore} ERZ`);
  if (cost.gas) parts.push(`${cost.gas} GAS`);
  if (cost.crystal) parts.push(`${cost.crystal} KRI`);
  if (cost.artefact) parts.push(`${cost.artefact} ART`);
  return parts.join(' ');
}

export function TechTreePanel() {
  const research = useStore(s => s.research);
  const credits = useStore(s => s.credits);
  const cargo = useStore(s => s.cargo);
  const storage = useStore(s => s.storage);
  const position = useStore(s => s.position);
  const homeBase = useStore(s => s.homeBase);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    network.requestResearchState();
  }, []);

  // Countdown timer for active research
  useEffect(() => {
    if (!research.activeResearch) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [research.activeResearch]);

  const isAtHome = position.x === homeBase.x && position.y === homeBase.y;
  const grouped = groupModulesByCategory();

  const activeResearch = research.activeResearch;
  const activeMod = activeResearch ? MODULES[activeResearch.moduleId] : null;
  const remaining = activeResearch ? activeResearch.completesAt - now : 0;
  const isComplete = activeResearch ? remaining <= 0 : false;

  const resources = {
    credits,
    ore: cargo.ore + storage.ore,
    gas: cargo.gas + storage.gas,
    crystal: cargo.crystal + storage.crystal,
    artefact: cargo.artefact + storage.artefact,
  };

  return (
    <div style={{
      padding: '4px 6px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.6rem',
      lineHeight: 1.5,
      overflow: 'auto',
      height: '100%',
      color: 'var(--color-primary)',
    }}>
      <div style={{
        letterSpacing: '0.15em',
        fontSize: '0.65rem',
        marginBottom: 6,
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: 2,
      }}>
        TECH-BAUM / FORSCHUNG
      </div>

      {/* Active Research */}
      {activeResearch && activeMod && (
        <div style={{
          border: '1px solid var(--color-primary)',
          padding: '4px 6px',
          marginBottom: 6,
        }}>
          <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', letterSpacing: '0.1em' }}>
            AKTIVE FORSCHUNG
          </div>
          <div style={{ marginTop: 2 }}>
            {activeMod.name}
            <span style={{ color: 'var(--color-dim)', marginLeft: 4 }}>T{activeMod.tier}</span>
          </div>
          <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem' }}>
            {activeMod.primaryEffect.label}
          </div>
          <div style={{ marginTop: 4 }}>
            {isComplete ? (
              <span style={{ color: '#00FF88' }}>ABGESCHLOSSEN</span>
            ) : (
              <span>{formatCountdown(remaining)}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {isComplete ? (
              <button style={btnStyle} onClick={() => network.sendClaimResearch()}>
                [ABSCHLIESSEN]
              </button>
            ) : (
              <button style={btnDangerStyle} onClick={() => network.sendCancelResearch()}>
                [ABBRECHEN]
              </button>
            )}
          </div>
        </div>
      )}

      {!isAtHome && (
        <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', marginBottom: 6 }}>
          FORSCHUNG NUR AN HEIMATBASIS MÖGLICH
        </div>
      )}

      {/* Blueprints */}
      {research.blueprints.length > 0 && (
        <>
          <div style={sectionHeader}>BLAUPAUSEN</div>
          {research.blueprints.map(bpId => {
            const mod = MODULES[bpId];
            if (!mod) return null;
            const alreadyUnlocked = research.unlockedModules.includes(bpId);
            return (
              <div key={bpId} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1px 0',
              }}>
                <span>
                  <span style={{ color: '#00BFFF' }}>BLAUPAUSE</span>
                  <span style={{ marginLeft: 4 }}>{mod.name}</span>
                  <span style={{ color: 'var(--color-dim)', marginLeft: 4, fontSize: '0.5rem' }}>
                    {mod.primaryEffect.label}
                  </span>
                </span>
                {!alreadyUnlocked && (
                  <button style={btnStyle} onClick={() => network.sendActivateBlueprint(bpId)}>
                    [AKTIVIEREN]
                  </button>
                )}
                {alreadyUnlocked && (
                  <span style={{ color: '#00FF88', fontSize: '0.5rem' }}>FREIGESCHALTET</span>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Module groups by category */}
      {CATEGORY_ORDER.map(cat => {
        const mods = grouped[cat];
        if (!mods || mods.length === 0) return null;
        return (
          <div key={cat}>
            <div style={sectionHeader}>{CATEGORY_LABELS[cat]}</div>
            {mods.map(mod => {
              const status = getModuleStatus(mod, research);
              const researchCheck = canStartResearch(mod.id, research, resources);

              return (
                <div key={mod.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1px 0',
                  opacity: status === 'locked' ? 0.5 : 1,
                }}>
                  <span>
                    <span style={{ color: 'var(--color-primary)' }}>{mod.name}</span>
                    <span style={{ color: 'var(--color-dim)', marginLeft: 4, fontSize: '0.5rem' }}>
                      T{mod.tier}
                    </span>
                    <span style={{ color: 'var(--color-dim)', marginLeft: 4, fontSize: '0.5rem' }}>
                      {mod.primaryEffect.label}
                    </span>
                  </span>
                  <span style={{ flexShrink: 0, marginLeft: 4 }}>
                    {status === 'free' && (
                      <span style={{ color: '#00FF88', fontSize: '0.5rem' }}>FREI</span>
                    )}
                    {status === 'unlocked' && (
                      <span style={{ color: '#00FF88', fontSize: '0.5rem' }}>&#x2713;</span>
                    )}
                    {status === 'blueprint' && (
                      <span style={{ color: '#00BFFF', fontSize: '0.5rem' }}>BLAUPAUSE</span>
                    )}
                    {status === 'researching' && (
                      <span style={{ color: '#FFB000', fontSize: '0.5rem' }}>FORSCHUNG...</span>
                    )}
                    {status === 'locked' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {mod.researchCost && (
                          <span style={{ color: 'var(--color-dim)', fontSize: '0.5rem' }}>
                            {costString(mod.researchCost)}
                            {mod.researchDurationMin ? ` ${formatDuration(mod.researchDurationMin)}` : ''}
                          </span>
                        )}
                        {isAtHome && researchCheck.valid && !research.activeResearch && (
                          <button
                            style={btnStyle}
                            onClick={() => network.sendStartResearch(mod.id)}
                          >
                            [FORSCHUNG STARTEN]
                          </button>
                        )}
                        {!researchCheck.valid && mod.researchCost && (
                          <span style={{ color: 'var(--color-dim)', fontSize: '0.45rem' }}>
                            &#x1F512;
                          </span>
                        )}
                      </span>
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
