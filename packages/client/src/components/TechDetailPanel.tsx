import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULES, isModuleFreelyAvailable, canStartResearch } from '@void-sector/shared';

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
  const selectedModuleId = useStore((s) => s.selectedTechModule);
  const research = useStore((s) => s.research);
  const credits = useStore((s) => s.credits);
  const cargo = useStore((s) => s.cargo);
  const storage = useStore((s) => s.storage);
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
        MODUL AUSWÄHLEN
      </div>
    );
  }

  const mod = MODULES[selectedModuleId];
  if (!mod) return null;

  const isAtStation = currentSector?.type === 'station';
  const hasBase = baseStructures.some((s: any) => s.type === 'base');
  const canShop = isAtStation || hasBase;
  const resources = {
    credits,
    ore: cargo.ore + storage.ore,
    gas: cargo.gas + storage.gas,
    crystal: cargo.crystal + storage.crystal,
    artefact: cargo.artefact + storage.artefact,
  };

  const isFree = isModuleFreelyAvailable(mod.id);
  const isUnlocked = research.unlockedModules.includes(mod.id);
  const hasBP = research.blueprints.includes(mod.id);
  const researchCheck = canStartResearch(mod.id, research, resources);

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
          <div>{costLine(mod.researchCost)}</div>
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
        {(isFree || isUnlocked) && (
          <div>
            <div style={{ color: '#00FF88', marginBottom: 4 }}>
              {isFree ? 'FREI VERFÜGBAR' : 'ERFORSCHT'}
            </div>
            {canShop && (
              <button style={btnStyle} onClick={() => network.sendBuyModule(mod.id)}>
                [KAUFEN — {costLine(mod.cost)}]
              </button>
            )}
            {!canShop && (
              <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem' }}>
                KAUF NUR AN STATION ODER BASIS
              </div>
            )}
          </div>
        )}
        {hasBP && !isUnlocked && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ color: '#00BFFF', marginBottom: 4 }}>BLAUPAUSE VORHANDEN</div>
            <button style={btnStyle} onClick={() => network.sendActivateBlueprint(mod.id)}>
              [BLAUPAUSE AKTIVIEREN]
            </button>
          </div>
        )}
        {!isFree && !isUnlocked && mod.researchCost && !researchCheck.valid && (
          <div style={{ color: '#FF3333', fontSize: '0.55rem' }}>{researchCheck.error}</div>
        )}
      </div>
    </div>
  );
}
