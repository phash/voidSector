import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { SPECIALIZED_SLOT_CATEGORIES, MODULES, getExtraSlotCount } from '@void-sector/shared';

const CAT_LABELS: Record<string, string> = {
  generator: 'GEN', drive: 'DRV', weapon: 'WPN', armor: 'ARM',
  shield: 'SHD', scanner: 'SCN', miner: 'MIN', cargo: 'CGO',
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
  const ship = useStore((s) => s.ship);
  const moduleInventory = useStore((s) => s.moduleInventory);
  const setHovered = useStore((s) => s.setAcepHoveredModuleId);

  useEffect(() => {
    network.sendGetModuleInventory();
  }, []);

  if (!ship) {
    return (
      <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '1rem', opacity: 0.4 }}>
        KEIN SCHIFF
      </div>
    );
  }

  const ausbauXp = ship.acepXp?.ausbau ?? 0;
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

  function findTargetSlot(category: string): number {
    for (let i = 0; i < SPECIALIZED_SLOT_CATEGORIES.length; i++) {
      if (SPECIALIZED_SLOT_CATEGORIES[i] === category && !moduleBySlot.has(i)) return i;
    }
    for (let i = SPECIALIZED_SLOT_CATEGORIES.length; i < totalSlots; i++) {
      if (!moduleBySlot.has(i)) return i;
    }
    return -1;
  }

  return (
    <div style={{ padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '1rem', overflow: 'auto', height: '100%' }}>
      <div style={sectionHdr}>VERBAUT — {installedCount}/{totalSlots} Slots</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {slots.map(({ index, label, module }) => {
          const def = module ? MODULES[module.moduleId] : null;
          const occupied = !!module;
          return (
            <div
              key={index}
              style={{
                border: `1px solid ${occupied ? '#444' : '#222'}`,
                padding: '7px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onMouseEnter={() => occupied && def ? setHovered(module!.moduleId) : undefined}
              onMouseLeave={() => setHovered(null)}
            >
              {occupied && def ? (
                <>
                  <div>
                    <span style={{ color: '#666', fontSize: '0.8rem' }}>[{label}]</span>
                    <span style={{ color: 'var(--color-primary)', marginLeft: 6 }}>{def.name}</span>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>
                      HP {hpBar(module!.currentHp ?? 0, def.maxHp ?? 20)}
                    </div>
                  </div>
                  <button
                    style={btnDanger}
                    onClick={() => network.sendRemoveModule(ship.id, index)}
                  >
                    [×]
                  </button>
                </>
              ) : (
                <span style={{ color: '#444', fontSize: '0.9rem' }}>[{label}] —</span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
        <div style={sectionHdr}>INVENTAR — {moduleInventory.length} Module</div>
        {moduleInventory.length === 0 ? (
          <div style={{ color: '#444', fontSize: '0.9rem', opacity: 0.6 }}>LEER</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {moduleInventory.map((moduleId, idx) => {
              const def = MODULES[moduleId];
              if (!def) return null;
              const targetSlot = findTargetSlot(def.category);
              return (
                <div
                  key={`${moduleId}-${idx}`}
                  style={{ border: '1px solid #444', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={() => setHovered(moduleId)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div>
                    <div style={{ color: '#FFB000', fontSize: '0.95rem' }}>{def.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>{def.primaryEffect.label}</div>
                  </div>
                  {targetSlot >= 0 ? (
                    <button
                      style={btnPrimary}
                      onClick={() => network.sendInstallModule(ship.id, moduleId, targetSlot)}
                    >
                      [INST]
                    </button>
                  ) : (
                    <span style={{ color: '#444', fontSize: '0.8rem' }}>VOLL</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
