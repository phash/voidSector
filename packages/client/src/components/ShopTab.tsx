import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULE_DEFINITIONS, isModuleUnlocked } from '@void-sector/shared';
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
  if (credits < def.costCredits) return false;
  if (def.costOre > 0 && cargo.ore < def.costOre) return false;
  if (def.costGas > 0 && cargo.gas < def.costGas) return false;
  if (def.costCrystal > 0 && cargo.crystal < def.costCrystal) return false;
  // costArtefact is a string like "20 Engine Artefact" or "0"
  if (def.costArtefact && def.costArtefact !== '0') {
    const match = def.costArtefact.match(/^(\d+)/);
    const needed = match ? parseInt(match[1], 10) : 0;
    if (needed > 0 && cargo.artefact < needed) return false;
  }
  return true;
}

function getAffordanceReason(def: ModuleDefinition, credits: number, cargo: CargoState, tFn: (k: string) => string): string | null {
  if (credits < def.costCredits) {
    return `${tFn('shop.needCredits')}: ${def.costCredits - credits} CR`;
  }
  if (def.costOre > 0 && cargo.ore < def.costOre) {
    return `${tFn('shop.needOre')}: ${def.costOre - cargo.ore}`;
  }
  if (def.costGas > 0 && cargo.gas < def.costGas) {
    return `${tFn('shop.needGas')}: ${def.costGas - cargo.gas}`;
  }
  if (def.costCrystal > 0 && cargo.crystal < def.costCrystal) {
    return `${tFn('shop.needCrystal')}: ${def.costCrystal - cargo.crystal}`;
  }
  return null;
}

function costLabel(def: ModuleDefinition, tFn: (k: string) => string): string {
  const parts: string[] = [`${def.costCredits} CR`];
  if (def.costOre) parts.push(`${def.costOre} ${tFn('resources.ore')}`);
  if (def.costGas) parts.push(`${def.costGas} ${tFn('resources.gas')}`);
  if (def.costCrystal) parts.push(`${def.costCrystal} ${tFn('resources.crystal')}`);
  if (def.costArtefact && def.costArtefact !== '0') parts.push(`${def.costArtefact}`);
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
  const availableModules = MODULE_DEFINITIONS.filter(
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
                    {def.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 3 }}>
                    {def.description} · {costLabel(def, t)}
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
                  {reason}
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
              {selectedModule.name}
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
