import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { HULLS, MODULES, isModuleUnlocked } from '@void-sector/shared';
import type { ModuleDefinition } from '@void-sector/shared';

const MODULE_ICONS: Record<string, string> = {
  drive: '[>>>]',
  cargo: '[═══]',
  scanner: '[(◉)]',
  armor: '[▓▓▓]',
};

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  padding: '1px 4px',
  cursor: 'pointer',
  letterSpacing: '0.05em',
};

const btnDangerStyle: React.CSSProperties = {
  ...btnStyle,
  borderColor: 'var(--color-danger)',
  color: 'var(--color-danger)',
};

const sectionHeader: React.CSSProperties = {
  borderBottom: '1px solid var(--color-dim)',
  paddingBottom: 2,
  marginBottom: 4,
  marginTop: 8,
  fontSize: '0.6rem',
  letterSpacing: '0.15em',
  opacity: 0.7,
};

export function ModulePanel() {
  const ship = useStore((s) => s.ship);
  const moduleInventory = useStore((s) => s.moduleInventory);
  const credits = useStore((s) => s.credits);
  const research = useStore((s) => s.research);
  const currentSector = useStore((s) => s.currentSector);
  const baseStructures = useStore((s) => s.baseStructures);

  useEffect(() => {
    network.sendGetModuleInventory();
    network.requestCredits();
  }, []);

  if (!ship) {
    return (
      <div style={{ padding: '6px 8px', fontSize: '0.65rem', opacity: 0.5 }}>
        KEIN SCHIFF AKTIV
      </div>
    );
  }

  const hull = HULLS[ship.hullType];
  const totalSlots = hull ? hull.slots : 3;

  // Find first empty slot
  const occupiedSlots = new Set(ship.modules.map((m) => m.slotIndex));
  const firstEmptySlot = (() => {
    for (let i = 0; i < totalSlots; i++) {
      if (!occupiedSlots.has(i)) return i;
    }
    return -1;
  })();

  // Check if player is at home base or station (for shop access)
  const isAtStation = currentSector?.type === 'station';
  const hasBase = baseStructures.some((s: any) => s.type === 'base');
  const canShop = isAtStation || hasBase;

  return (
    <div style={{
      padding: '4px 6px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.6rem',
      lineHeight: 1.5,
      overflow: 'auto',
      height: '100%',
    }}>
      {/* A) Installed Modules */}
      <div style={sectionHeader}>INSTALLIERTE MODULE</div>
      {Array.from({ length: totalSlots }, (_, i) => {
        const mod = ship.modules.find((m) => m.slotIndex === i);
        const def = mod ? MODULES[mod.moduleId] : null;
        return (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1px 0',
          }}>
            <span>
              <span style={{ color: 'var(--color-dim)', marginRight: 4 }}>SLOT {i}:</span>
              {def ? (
                <span style={{ color: 'var(--color-primary)' }}>{def.name}</span>
              ) : (
                <span style={{ color: 'var(--color-dim)', opacity: 0.4 }}>--- LEER ---</span>
              )}
            </span>
            {def && (
              <button
                style={btnDangerStyle}
                onClick={() => network.sendRemoveModule(ship.id, i)}
              >
                ENTFERNEN
              </button>
            )}
          </div>
        );
      })}

      {/* B) Module Inventory */}
      <div style={sectionHeader}>INVENTAR</div>
      {moduleInventory.length === 0 ? (
        <div style={{ opacity: 0.4, padding: '2px 0' }}>LEER</div>
      ) : (
        moduleInventory.map((moduleId, idx) => {
          const def = MODULES[moduleId];
          if (!def) return null;
          const targetSlot = firstEmptySlot;
          return (
            <div key={`${moduleId}-${idx}`} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1px 0',
            }}>
              <span style={{ color: 'var(--color-dim)', marginRight: 4 }}>{MODULE_ICONS[def.category] ?? '[   ]'}</span>
              <span style={{ color: 'var(--color-primary)' }}>{def.name}</span>
              {targetSlot >= 0 ? (
                <button
                  style={btnStyle}
                  onClick={() => network.sendInstallModule(ship.id, moduleId, targetSlot)}
                >
                  SLOT {targetSlot} EINBAUEN
                </button>
              ) : (
                <span style={{ color: 'var(--color-dim)', fontSize: '0.55rem' }}>VOLL</span>
              )}
            </div>
          );
        })
      )}

      {/* C) Module Shop */}
      {canShop && (
        <>
          <div style={sectionHeader}>MODUL-SHOP</div>
          {Object.values(MODULES).filter(m => isModuleUnlocked(m.id, research)).map((def: ModuleDefinition) => {
            const costParts: string[] = [];
            costParts.push(`${def.cost.credits} CR`);
            if (def.cost.ore) costParts.push(`${def.cost.ore} ERZ`);
            if (def.cost.gas) costParts.push(`${def.cost.gas} GAS`);
            if (def.cost.crystal) costParts.push(`${def.cost.crystal} KRI`);
            const canAfford = credits >= def.cost.credits;
            return (
              <div key={def.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1px 0',
              }}>
                <span>
                  <span style={{ color: 'var(--color-dim)', marginRight: 4 }}>{MODULE_ICONS[def.category] ?? '[   ]'}</span>
                  <span style={{ color: 'var(--color-primary)' }}>{def.displayName}</span>
                  <span style={{ color: 'var(--color-dim)', marginLeft: 4, fontSize: '0.55rem' }}>
                    {costParts.join(' ')}
                  </span>
                  <span style={{ color: 'var(--color-dim)', marginLeft: 4, fontSize: '0.5rem' }}>
                    {def.primaryEffect.label}
                  </span>
                </span>
                <button
                  style={{
                    ...btnStyle,
                    opacity: canAfford ? 1 : 0.3,
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                  }}
                  disabled={!canAfford}
                  onClick={() => network.sendBuyModule(def.id)}
                >
                  KAUFEN
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
