import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

function getAffordanceReason(def: ModuleDefinition, credits: number, cargo: CargoState, tFn: (k: string) => string): string | null {
  if (credits < def.cost.credits) {
    return `${tFn('shop.needCredits')}: ${def.cost.credits - credits} CR`;
  }
  if (def.cost.ore !== undefined && cargo.ore < def.cost.ore) {
    return `${tFn('shop.needOre')}: ${def.cost.ore - cargo.ore}`;
  }
  if (def.cost.gas !== undefined && cargo.gas < def.cost.gas) {
    return `${tFn('shop.needGas')}: ${def.cost.gas - cargo.gas}`;
  }
  if (def.cost.crystal !== undefined && cargo.crystal < def.cost.crystal) {
    return `${tFn('shop.needCrystal')}: ${def.cost.crystal - cargo.crystal}`;
  }
  if (def.cost.artefact !== undefined && cargo.artefact < def.cost.artefact) {
    return `${tFn('shop.needArtefact')}: ${def.cost.artefact - cargo.artefact}`;
  }
  return null;
}

// costLabel is a pure helper used only in ShopTab display — no i18n needed here
// as resource names in cost strings are formatted inline
function costLabel(def: ModuleDefinition, tFn: (k: string) => string): string {
  const parts: string[] = [`${def.cost.credits} CR`];
  if (def.cost.ore !== undefined) parts.push(`${def.cost.ore} ${tFn('resources.ore')}`);
  if (def.cost.gas !== undefined) parts.push(`${def.cost.gas} ${tFn('resources.gas')}`);
  if (def.cost.crystal !== undefined) parts.push(`${def.cost.crystal} ${tFn('resources.crystal')}`);
  if (def.cost.artefact !== undefined) parts.push(`${def.cost.artefact} ${tFn('resources.artefact')}`);
  return parts.join(' + ');
}

export function ShopTab() {
  const { t } = useTranslation('ui');
  const credits = useStore((s) => s.credits);
  const cargo = useStore((s) => s.cargo);
  const research = useStore((s) => s.research);
  const techTree = useStore((s) => s.techTree);
  const currentSector = useStore((s) => s.currentSector);
  const baseStructures = useStore((s) => s.baseStructures);
  const setHovered = useStore((s) => s.setAcepHoveredModuleId);

  const [selectedModule, setSelectedModule] = useState<ModuleDefinition | null>(null);

  const atStation =
    currentSector?.type === 'station' ||
    baseStructures.some((s) => s.type === 'base');

  if (!atStation) {
    return (
      <div style={{ padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
        <div style={sectionHdr}>{t('shop.moduleShop')}</div>
        <div
          style={{
            padding: '9px 11px',
            background: '#0a0a0a',
            border: '1px solid #222',
            fontSize: '0.85rem',
            color: '#555',
          }}
        >
          {t('shop.onlyAtStation')}
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
        {t('shop.moduleShop')} <span style={{ color: '#4a9' }}>● {t('shop.atStation')}</span>
      </div>
      {credits === 0 && (
        <div style={{
          padding: '8px 11px',
          marginBottom: 10,
          background: '#0a0a0a',
          border: '1px solid #222',
          fontSize: '0.75rem',
          color: '#555',
          lineHeight: 1.5,
        }}>
          Dein Kontostand ist 0. Das Universum begann ebenfalls mit nichts —
          allerdings hatte es keine Kaufabsichten.<br />
          <span style={{ color: '#444' }}>Credits: Scans · Quests · Bergbau · Handel</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {availableModules.map((def: ModuleDefinition) => {
          const affordable = canAfford(def, credits, cargo);
          const reason = !affordable ? getAffordanceReason(def, credits, cargo, t) : null;
          return (
            <div
              key={def.id}
              style={{
                border: `1px solid ${affordable ? '#333' : '#2a1a1a'}`,
                padding: '9px 11px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
              onMouseEnter={() => setHovered(def.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: getModuleSourceColor(undefined), fontSize: '0.95rem' }}>
                    {def.displayName ?? def.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 3 }}>
                    {def.primaryEffect.label} · {costLabel(def, t)}
                  </div>
                </div>
                <button
                  style={{
                    ...btnStyle,
                    opacity: affordable ? 1 : 0.3,
                    cursor: affordable ? 'pointer' : 'not-allowed',
                  }}
                  disabled={!affordable}
                  onClick={() => setSelectedModule(def)}
                >
                  {t('shop.buy')}
                </button>
              </div>
              {reason && (
                <div style={{ fontSize: '0.75rem', color: '#ff6666', paddingTop: 4, borderTop: '1px solid #3a2a2a' }}>
                  ⚠ {reason}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedModule && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9000,
          }}
          onClick={() => setSelectedModule(null)}
        >
          <div
            style={{
              background: '#0a0a0a',
              border: '1px solid var(--color-primary)',
              padding: '16px 20px',
              maxWidth: '300px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: 12, color: 'var(--color-primary)', letterSpacing: '0.1em' }}>
              {selectedModule.displayName ?? selectedModule.name}
            </div>
            <div style={{ marginBottom: 12, color: '#888', fontSize: '0.75rem', lineHeight: 1.6 }}>
              {costLabel(selectedModule, t)}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedModule(null)}
                style={{
                  background: 'transparent',
                  border: '1px solid #555',
                  color: '#888',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  network.sendBuyModule(selectedModule.id);
                  setSelectedModule(null);
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-primary)',
                  color: 'var(--color-primary)',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}
              >
                {t('shop.buy')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
