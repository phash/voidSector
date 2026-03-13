import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { SPECIALIZED_SLOT_CATEGORIES, MODULES, getExtraSlotCount, validateModuleInstall } from '@void-sector/shared';

const CAT_LABELS: Record<string, string> = {
  generator: 'GEN', drive: 'DRV', weapon: 'WPN', armor: 'ARM',
  shield: 'SHD', scanner: 'SCN', mining: 'MIN', cargo: 'CGO',
};

function hpBar(current: number, max: number): string {
  if (max <= 0) return '██████';
  const filled = Math.round((current / max) * 6);
  return '█'.repeat(filled) + '░'.repeat(6 - filled);
}

const sectionHdr: React.CSSProperties = {
  fontSize: '0.75rem',
  letterSpacing: '0.12em',
  color: '#666',
  marginBottom: 8,
};

const btnDanger: React.CSSProperties = {
  background: 'transparent', border: '1px solid #f44', color: '#f44',
  fontFamily: 'var(--font-mono)', fontSize: '0.88rem', padding: '3px 9px', cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)', fontSize: '0.88rem', padding: '3px 10px', cursor: 'pointer',
};

export function ModuleTab() {
  const { t } = useTranslation('ui');
  const ship = useStore((s) => s.ship);
  const moduleInventory = useStore((s) => s.moduleInventory);
  const setHovered = useStore((s) => s.setAcepHoveredModuleId);
  const [selectedInvIdx, setSelectedInvIdx] = useState<number | null>(null);

  useEffect(() => {
    network.sendGetModuleInventory();
  }, []);

  if (!ship) {
    return (
      <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '1rem', opacity: 0.4 }}>
        {t('ship.noShip')}
      </div>
    );
  }

  const ausbauXp = ship.acepXp?.ausbau ?? 0;
  const acepXp = ship.acepXp ?? { ausbau: 0, intel: 0, kampf: 0, explorer: 0 };
  const extraSlotCount = getExtraSlotCount(ausbauXp);
  const totalSlots = SPECIALIZED_SLOT_CATEGORIES.length + extraSlotCount;
  const moduleBySlot = new Map(ship.modules.map((m) => [m.slotIndex, m]));
  const installedCount = ship.modules.length;

  const slots = [
    ...SPECIALIZED_SLOT_CATEGORIES.map((cat, idx) => ({
      index: idx,
      label: CAT_LABELS[cat] ?? cat.toUpperCase().slice(0, 3),
      cat,
      module: moduleBySlot.get(idx) ?? null,
    })),
    ...Array.from({ length: extraSlotCount }, (_, i) => ({
      index: SPECIALIZED_SLOT_CATEGORIES.length + i,
      label: `+${i + 1}`,
      cat: null as string | null,
      module: moduleBySlot.get(SPECIALIZED_SLOT_CATEGORIES.length + i) ?? null,
    })),
  ];

  // Determine selected module and compatible slots
  const selectedModuleId = selectedInvIdx !== null ? moduleInventory[selectedInvIdx] : null;
  const compatibleSlots = new Set<number>();
  if (selectedModuleId) {
    for (const slot of slots) {
      if (!slot.module) {
        const result = validateModuleInstall(
          ship.modules, selectedModuleId, slot.index, acepXp,
        );
        if (result.valid) compatibleSlots.add(slot.index);
      }
    }
  }

  function handleInstall(slotIndex: number) {
    if (!selectedModuleId || !ship) return;
    network.sendInstallModule(ship.id, selectedModuleId, slotIndex);
    setSelectedInvIdx(null);
    // Re-fetch inventory after short delay to let server process
    setTimeout(() => network.sendGetModuleInventory(), 200);
  }

  return (
    <div style={{ padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '1rem', overflow: 'auto', height: '100%' }}>
      <div style={sectionHdr}>{t('module.installed', { count: installedCount, total: totalSlots })}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {slots.map(({ index, label, module }) => {
          const def = module ? MODULES[module.moduleId] : null;
          const occupied = !!module && !!def;
          const isCompatible = compatibleSlots.has(index);
          return (
            <div
              key={index}
              style={{
                border: `1px solid ${isCompatible ? 'var(--color-primary)' : occupied ? '#444' : '#222'}`,
                padding: '7px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: isCompatible ? 'rgba(0, 255, 65, 0.06)' : 'transparent',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={() => occupied && module ? setHovered(module.moduleId) : undefined}
              onMouseLeave={() => setHovered(null)}
            >
              {occupied && module && def ? (
                <>
                  <div>
                    <span style={{ color: '#666', fontSize: '0.8rem' }}>[{label}]</span>
                    <span style={{ color: 'var(--color-primary)', marginLeft: 6 }}>{def.name}</span>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>
                      HP {hpBar(module.currentHp ?? 0, def.maxHp ?? 20)}
                    </div>
                  </div>
                  <button
                    style={btnDanger}
                    onClick={() => network.sendRemoveModule(ship.id, index)}
                  >
                    [×]
                  </button>
                </>
              ) : isCompatible ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }}>[{label}] — {t('module.compatible')}</span>
                  <button
                    style={btnPrimary}
                    onClick={() => handleInstall(index)}
                  >
                    [+]
                  </button>
                </div>
              ) : (
                <span style={{ color: '#444', fontSize: '0.9rem' }}>[{label}] — {t('module.empty')}</span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
        <div style={sectionHdr}>{t('module.inventory', { count: moduleInventory.length })}</div>
        {moduleInventory.length === 0 ? (
          <div style={{ color: '#444', fontSize: '0.9rem', opacity: 0.6 }}>{t('module.inventoryEmpty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {moduleInventory.map((moduleId, idx) => {
              const def = MODULES[moduleId];
              if (!def) return null;
              const isSelected = selectedInvIdx === idx;
              return (
                <div
                  key={`${moduleId}-${idx}`}
                  style={{
                    border: `1px solid ${isSelected ? 'var(--color-primary)' : '#444'}`,
                    padding: '8px 10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(0, 255, 65, 0.08)' : 'transparent',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onClick={() => setSelectedInvIdx(isSelected ? null : idx)}
                  onMouseEnter={() => setHovered(moduleId)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div>
                    <div style={{ color: isSelected ? 'var(--color-primary)' : '#FFB000', fontSize: '0.95rem' }}>{def.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>{def.primaryEffect.label}</div>
                  </div>
                  <span style={{ color: isSelected ? 'var(--color-primary)' : '#666', fontSize: '0.8rem' }}>
                    {isSelected ? t('module.selectSlot') : t('module.select')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
