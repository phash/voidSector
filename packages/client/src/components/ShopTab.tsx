import type { CSSProperties } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULES, isModuleUnlocked } from '@void-sector/shared';
import type { ModuleDefinition, CargoState } from '@void-sector/shared';
import { getModuleSourceColor } from './moduleUtils';

const sectionHdr: CSSProperties = {
  fontSize: '0.75rem',
  letterSpacing: '0.12em',
  color: '#666',
  marginBottom: 10,
};

const btnStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  padding: '4px 10px',
  cursor: 'pointer',
};

function canAfford(def: ModuleDefinition, credits: number, cargo: CargoState): boolean {
  if (credits < def.cost.credits) return false;
  if (def.cost.ore !== undefined && cargo.ore < def.cost.ore) return false;
  if (def.cost.gas !== undefined && cargo.gas < def.cost.gas) return false;
  if (def.cost.crystal !== undefined && cargo.crystal < def.cost.crystal) return false;
  if (def.cost.artefact !== undefined && cargo.artefact < def.cost.artefact) return false;
  return true;
}

function costLabel(def: ModuleDefinition): string {
  const parts: string[] = [`${def.cost.credits} CR`];
  if (def.cost.ore !== undefined) parts.push(`${def.cost.ore} Erz`);
  if (def.cost.gas !== undefined) parts.push(`${def.cost.gas} Gas`);
  if (def.cost.crystal !== undefined) parts.push(`${def.cost.crystal} Kristall`);
  if (def.cost.artefact !== undefined) parts.push(`${def.cost.artefact} Artefakt`);
  return parts.join(' + ');
}

export function ShopTab() {
  const credits = useStore((s) => s.credits);
  const cargo = useStore((s) => s.cargo);
  const research = useStore((s) => s.research);
  const techTree = useStore((s) => s.techTree);
  const currentSector = useStore((s) => s.currentSector);
  const baseStructures = useStore((s) => s.baseStructures);
  const setHovered = useStore((s) => s.setAcepHoveredModuleId);

  const atStation =
    currentSector?.type === 'station' ||
    baseStructures.some((s) => s.type === 'base');

  if (!atStation) {
    return (
      <div style={{ padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
        <div style={sectionHdr}>MODUL-SHOP</div>
        <div
          style={{
            padding: '9px 11px',
            background: '#0a0a0a',
            border: '1px solid #222',
            fontSize: '0.85rem',
            color: '#555',
          }}
        >
          Modul-Shop nur an Station oder Home Base verfügbar
        </div>
      </div>
    );
  }

  const researchedNodes = techTree?.researchedNodes ?? {};
  const availableModules = Object.values(MODULES).filter(
    (m) => !m.isFoundOnly && isModuleUnlocked(m.id, m, researchedNodes, research.blueprints),
  );

  return (
    <div
      style={{
        padding: '14px',
        fontFamily: 'var(--font-mono)',
        fontSize: '1rem',
        overflow: 'auto',
        height: '100%',
      }}
    >
      <div style={sectionHdr}>
        MODUL-SHOP <span style={{ color: '#4a9' }}>● AN STATION</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {availableModules.map((def: ModuleDefinition) => {
          const affordable = canAfford(def, credits, cargo);
          return (
            <div
              key={def.id}
              style={{
                border: '1px solid #333',
                padding: '9px 11px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onMouseEnter={() => setHovered(def.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div>
                <div style={{ color: getModuleSourceColor(undefined), fontSize: '0.95rem' }}>
                  {def.displayName ?? def.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 3 }}>
                  {def.primaryEffect.label} · {costLabel(def)}
                </div>
              </div>
              <button
                style={{
                  ...btnStyle,
                  opacity: affordable ? 1 : 0.3,
                  cursor: affordable ? 'pointer' : 'not-allowed',
                }}
                disabled={!affordable}
                onClick={() => network.sendBuyModule(def.id)}
              >
                [KAUFEN]
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
