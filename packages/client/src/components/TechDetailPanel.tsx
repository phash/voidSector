import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import {
  MODULES,
  isModuleFreelyAvailable,
  canStartResearch,
  MAX_ARTEFACTS_PER_RESEARCH,
  ARTEFACT_WISSEN_BONUS,
} from '@void-sector/shared';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function costLine(cost: {
  credits: number;
  ore?: number;
  gas?: number;
  crystal?: number;
  artefact?: number;
}): string {
  const parts: string[] = [`${cost.credits} CR`];
  if (cost.ore) parts.push(`${cost.ore} ERZ`);
  if (cost.gas) parts.push(`${cost.gas} GAS`);
  if (cost.crystal) parts.push(`${cost.crystal} KRI`);
  if (cost.artefact) parts.push(`${cost.artefact} ART`);
  return parts.join(' | ');
}

function wissenCostLine(wissen: number, artefactsUsed: number): string {
  const bonus = Math.min(artefactsUsed, MAX_ARTEFACTS_PER_RESEARCH) * ARTEFACT_WISSEN_BONUS;
  const actual = Math.max(0, wissen - bonus);
  if (bonus > 0) return `${actual} WISSEN (−${bonus} via ART)`;
  return `${wissen} WISSEN`;
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
  const typedArtefacts = useStore((s) => s.typedArtefacts);
  const labTier = useStore((s) => s.labTier);

  const [now, setNow] = useState(Date.now());
  const [selectedSlot, setSelectedSlot] = useState<1 | 2>(1);
  const [extraArtefacts, setExtraArtefacts] = useState(0);

  // Countdown timer for active research
  useEffect(() => {
    if (!research.activeResearch && !research.activeResearch2) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [research.activeResearch, research.activeResearch2]);

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
        MODUL AUSWÄHLEN
      </div>
    );
  }

  const mod = MODULES[selectedModuleId];
  if (!mod) return null;

  const isFree = isModuleFreelyAvailable(mod.id);
  const isUnlocked = research.unlockedModules.includes(mod.id);
  const hasBP = research.blueprints.includes(mod.id);

  const isResearching1 = research.activeResearch?.moduleId === mod.id;
  const isResearching2 = research.activeResearch2?.moduleId === mod.id;
  const isResearching = isResearching1 || isResearching2;
  const activeSlot = isResearching1 ? 1 : isResearching2 ? 2 : null;
  const activeResearchEntry = isResearching1 ? research.activeResearch! : research.activeResearch2!;
  const remaining = isResearching ? activeResearchEntry.completesAt - now : 0;
  const isComplete = isResearching && remaining <= 0;

  const researchCheck = canStartResearch(mod.id, research, typedArtefacts, labTier, selectedSlot);

  const prerequisiteMod = mod.prerequisite ? MODULES[mod.prerequisite] : null;

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

      {/* Effects */}
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
          EFFEKTE
        </div>
        <div style={{ color: 'var(--color-primary)' }}>{mod.primaryEffect.label}</div>
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
          <span
            style={{
              color: research.unlockedModules.includes(prerequisiteMod.id) ? '#00FF88' : '#FF3333',
            }}
          >
            {prerequisiteMod.name}
          </span>
        </div>
      )}

      {/* Research cost */}
      {mod.researchCost && (
        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              color: 'var(--color-dim)',
              fontSize: '0.55rem',
              letterSpacing: '0.1em',
              marginBottom: 2,
            }}
          >
            FORSCHUNGSKOSTEN
          </div>
          <div>{wissenCostLine(mod.researchCost.wissen, extraArtefacts)}</div>
          {mod.researchCost.artefacts && (
            <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', marginTop: 2 }}>
              {Object.entries(mod.researchCost.artefacts).map(([type, count]) => (
                <span
                  key={type}
                  style={{
                    marginRight: 8,
                    color: (typedArtefacts[type] ?? 0) >= (count ?? 0) ? '#00FF88' : '#FF3333',
                  }}
                >
                  {count}× {type.toUpperCase()}-ART
                </span>
              ))}
            </div>
          )}
          {mod.researchDurationMin && (
            <div style={{ color: 'var(--color-dim)' }}>
              DAUER: {formatDuration(mod.researchDurationMin)}
            </div>
          )}
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
          KAUFPREIS
        </div>
        <div>{costLine(mod.cost)}</div>
      </div>

      {/* Status + Actions */}
      <div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: 6 }}>
        {isFree && <div style={{ color: '#00FF88' }}>FREI VERFÜGBAR</div>}
        {isUnlocked && !isFree && <div style={{ color: '#00FF88' }}>ERFORSCHT ✓</div>}
        {hasBP && !isUnlocked && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ color: '#00BFFF', marginBottom: 4 }}>BLAUPAUSE VORHANDEN</div>
            <button style={btnStyle} onClick={() => network.sendActivateBlueprint(mod.id)}>
              [BLAUPAUSE AKTIVIEREN]
            </button>
          </div>
        )}

        {/* Active research progress */}
        {isResearching && (
          <div>
            {isComplete ? (
              <>
                <div style={{ color: '#00FF88', marginBottom: 4 }}>FORSCHUNG ABGESCHLOSSEN</div>
                <button style={btnStyle} onClick={() => network.sendClaimResearch(activeSlot ?? 1)}>
                  [ABSCHLIESSEN]
                </button>
              </>
            ) : (
              <>
                <div style={{ color: '#FFB000', marginBottom: 4 }}>
                  FORSCHUNG LÄUFT... {formatCountdown(remaining)}
                </div>
                <button
                  style={btnDangerStyle}
                  onClick={() => network.sendCancelResearch(activeSlot ?? 1)}
                >
                  [ABBRECHEN]
                </button>
              </>
            )}
          </div>
        )}

        {/* Lab requirement warning */}
        {labTier === 0 && mod.researchCost && !isUnlocked && !isFree && (
          <div style={{ color: '#FF3333', fontSize: '0.55rem', marginBottom: 4 }}>
            FORSCHUNG NUR MIT LABOR (Lab I+)
          </div>
        )}

        {/* Optional artefact counter */}
        {mod.researchCost && !isUnlocked && !isFree && !isResearching && (
          <div style={{ marginBottom: 6 }}>
            <div
              style={{
                color: 'var(--color-dim)',
                fontSize: '0.55rem',
                letterSpacing: '0.1em',
                marginBottom: 2,
              }}
            >
              ARTEFAKT-BONI (optional)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                style={btnStyle}
                onClick={() => setExtraArtefacts(Math.max(0, extraArtefacts - 1))}
              >
                [-]
              </button>
              <span style={{ color: 'var(--color-primary)' }}>{extraArtefacts}</span>
              <button
                style={btnStyle}
                onClick={() =>
                  setExtraArtefacts(Math.min(MAX_ARTEFACTS_PER_RESEARCH, extraArtefacts + 1))
                }
              >
                [ +]
              </button>
              <span style={{ color: 'var(--color-dim)', fontSize: '0.55rem', marginLeft: 4 }}>
                −{Math.min(extraArtefacts, MAX_ARTEFACTS_PER_RESEARCH) * ARTEFACT_WISSEN_BONUS}{' '}
                WISSEN
              </span>
            </div>
          </div>
        )}

        {/* Slot selector (only for lab tier >= 3) */}
        {labTier >= 3 && mod.researchCost && !isUnlocked && !isFree && !isResearching && (
          <div style={{ marginBottom: 6, display: 'flex', gap: 6 }}>
            <button
              style={{
                ...btnStyle,
                ...(selectedSlot === 1 ? { borderColor: '#FFB000', color: '#FFB000' } : {}),
              }}
              onClick={() => setSelectedSlot(1)}
            >
              [SLOT 1]
            </button>
            <button
              style={{
                ...btnStyle,
                ...(selectedSlot === 2 ? { borderColor: '#FF8800', color: '#FF8800' } : {}),
              }}
              onClick={() => setSelectedSlot(2)}
            >
              [SLOT 2]
            </button>
          </div>
        )}

        {/* Start research button */}
        {!isFree && !isUnlocked && !isResearching && mod.researchCost && researchCheck.valid && (
          <button
            style={btnStyle}
            onClick={() => {
              const artefactsToUse: Record<string, number> = {};
              if (extraArtefacts > 0) artefactsToUse[mod.category] = extraArtefacts;
              network.sendStartResearch(mod.id, selectedSlot, artefactsToUse);
            }}
          >
            [FORSCHUNG STARTEN]
          </button>
        )}
        {!isFree && !isUnlocked && !isResearching && mod.researchCost && !researchCheck.valid && (
          <div style={{ color: '#FF3333', fontSize: '0.55rem' }}>{researchCheck.error}</div>
        )}
      </div>
    </div>
  );
}
