import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULES, isModuleFreelyAvailable, canStartResearch } from '@void-sector/shared';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function costLine(cost: { credits: number; ore?: number; gas?: number; crystal?: number; artefact?: number }): string {
  const parts: string[] = [`${cost.credits} CR`];
  if (cost.ore) parts.push(`${cost.ore} ERZ`);
  if (cost.gas) parts.push(`${cost.gas} GAS`);
  if (cost.crystal) parts.push(`${cost.crystal} KRI`);
  if (cost.artefact) parts.push(`${cost.artefact} ART`);
  return parts.join(' | ');
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'FERTIG';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
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

const btnDangerStyle: React.CSSProperties = {
  ...btnStyle,
  borderColor: 'var(--color-danger)',
  color: 'var(--color-danger)',
};

export function TechDetailPanel() {
  const selectedModuleId = useStore((s) => s.selectedTechModule);
  const research = useStore((s) => s.research);
  const credits = useStore((s) => s.credits);
  const cargo = useStore((s) => s.cargo);
  const storage = useStore((s) => s.storage);
  const position = useStore((s) => s.position);
  const homeBase = useStore((s) => s.homeBase);

  const [now, setNow] = useState(Date.now());

  // Countdown timer for active research
  useEffect(() => {
    if (!research.activeResearch) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [research.activeResearch]);

  if (!selectedModuleId) {
    return (
      <div style={{
        padding: '12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        color: 'var(--color-dim)',
        textAlign: 'center',
        marginTop: 24,
      }}>
        MODUL AUSWÄHLEN
      </div>
    );
  }

  const mod = MODULES[selectedModuleId];
  if (!mod) return null;

  const isAtHome = position.x === homeBase.x && position.y === homeBase.y;
  const resources = {
    credits,
    ore: cargo.ore + storage.ore,
    gas: cargo.gas + storage.gas,
    crystal: cargo.crystal + storage.crystal,
    artefact: cargo.artefact + storage.artefact,
  };

  const isResearching = research.activeResearch?.moduleId === mod.id;
  const remaining = isResearching ? research.activeResearch!.completesAt - now : 0;
  const isComplete = isResearching && remaining <= 0;
  const isFree = isModuleFreelyAvailable(mod.id);
  const isUnlocked = research.unlockedModules.includes(mod.id);
  const hasBP = research.blueprints.includes(mod.id);
  const researchCheck = canStartResearch(mod.id, research, resources);

  const prerequisiteMod = mod.prerequisite ? MODULES[mod.prerequisite] : null;

  return (
    <div style={{
      padding: '8px 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.65rem',
      lineHeight: 1.6,
      height: '100%',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        fontSize: '0.75rem',
        color: 'var(--color-primary)',
        fontWeight: 'bold',
        marginBottom: 4,
      }}>
        {mod.name}
      </div>
      <div style={{ color: 'var(--color-dim)', marginBottom: 8 }}>
        TIER {mod.tier} | {mod.category.toUpperCase()}
      </div>

      {/* Effects */}
      <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: 4, marginBottom: 6 }}>
        <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', letterSpacing: '0.1em', marginBottom: 2 }}>
          EFFEKTE
        </div>
        <div style={{ color: 'var(--color-primary)' }}>
          {mod.primaryEffect.label}
        </div>
        {mod.secondaryEffects.map((eff, i) => (
          <div key={i} style={{ color: 'var(--color-dim)' }}>
            {eff.label}
          </div>
        ))}
      </div>

      {/* Prerequisite */}
      {prerequisiteMod && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--color-dim)' }}>VORAUSSETZUNG: </span>
          <span style={{
            color: research.unlockedModules.includes(prerequisiteMod.id) ? '#00FF88' : '#FF3333',
          }}>
            {prerequisiteMod.name}
          </span>
        </div>
      )}

      {/* Research cost */}
      {mod.researchCost && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', letterSpacing: '0.1em', marginBottom: 2 }}>
            FORSCHUNGSKOSTEN
          </div>
          <div>{costLine(mod.researchCost)}</div>
          {mod.researchDurationMin && (
            <div style={{ color: 'var(--color-dim)' }}>
              DAUER: {formatDuration(mod.researchDurationMin)}
            </div>
          )}
        </div>
      )}

      {/* Purchase cost */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', letterSpacing: '0.1em', marginBottom: 2 }}>
          KAUFPREIS
        </div>
        <div>{costLine(mod.cost)}</div>
      </div>

      {/* Status + Actions */}
      <div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: 6 }}>
        {isFree && (
          <div style={{ color: '#00FF88' }}>FREI VERFÜGBAR</div>
        )}
        {isUnlocked && !isFree && (
          <div style={{ color: '#00FF88' }}>ERFORSCHT ✓</div>
        )}
        {hasBP && !isUnlocked && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ color: '#00BFFF', marginBottom: 4 }}>BLAUPAUSE VORHANDEN</div>
            <button style={btnStyle} onClick={() => network.sendActivateBlueprint(mod.id)}>
              [BLAUPAUSE AKTIVIEREN]
            </button>
          </div>
        )}
        {isResearching && (
          <div>
            {isComplete ? (
              <>
                <div style={{ color: '#00FF88', marginBottom: 4 }}>FORSCHUNG ABGESCHLOSSEN</div>
                <button style={btnStyle} onClick={() => network.sendClaimResearch()}>
                  [ABSCHLIESSEN]
                </button>
              </>
            ) : (
              <>
                <div style={{ color: '#FFB000', marginBottom: 4 }}>
                  FORSCHUNG LÄUFT... {formatCountdown(remaining)}
                </div>
                <button style={btnDangerStyle} onClick={() => network.sendCancelResearch()}>
                  [ABBRECHEN]
                </button>
              </>
            )}
          </div>
        )}
        {!isFree && !isUnlocked && !isResearching && mod.researchCost && (
          <div>
            {!isAtHome && (
              <div style={{ color: 'var(--color-dim)', marginBottom: 4 }}>
                FORSCHUNG NUR AN HEIMATBASIS
              </div>
            )}
            {isAtHome && researchCheck.valid && !research.activeResearch && (
              <button style={btnStyle} onClick={() => network.sendStartResearch(mod.id)}>
                [FORSCHUNG STARTEN]
              </button>
            )}
            {isAtHome && !researchCheck.valid && (
              <div style={{ color: '#FF3333', fontSize: '0.55rem' }}>
                {researchCheck.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
