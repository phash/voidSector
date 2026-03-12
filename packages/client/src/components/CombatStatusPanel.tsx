import { useStore } from '../state/store';
import { MODULES } from '@void-sector/shared';
import type { ShipModule } from '@void-sector/shared';

export function CombatStatusPanel() {
  const ship = useStore((s) => s.ship);

  if (!ship) {
    return (
      <div
        style={{
          padding: '4px 6px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          color: 'var(--color-dim)',
          opacity: 0.5,
        }}
      >
        NO COMBAT DATA
      </div>
    );
  }

  const { modules, stats } = ship;

  const weaponMod = modules.find((m: ShipModule) => MODULES[m.moduleId]?.category === 'weapon');
  const shieldMod = modules.find((m: ShipModule) => MODULES[m.moduleId]?.category === 'shield');
  const defenseMod = modules.find((m: ShipModule) => MODULES[m.moduleId]?.category === 'defense');

  const weaponDef = weaponMod ? MODULES[weaponMod.moduleId] : null;
  const shieldDef = shieldMod ? MODULES[shieldMod.moduleId] : null;
  const defenseDef = defenseMod ? MODULES[defenseMod.moduleId] : null;

  const wpnName = weaponDef?.displayName || '---';
  const shdVal = shieldDef ? `${stats.shieldHp}` : '---';
  const defName = defenseDef?.displayName || '---';

  return (
    <div
      style={{
        padding: '4px 8px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        lineHeight: 1.6,
        color: 'var(--color-primary)',
      }}
    >
      <div
        style={{
          borderTop: '1px solid var(--color-dim)',
          borderBottom: '1px solid var(--color-dim)',
          paddingTop: 2,
          paddingBottom: 2,
        }}
      >
        <span style={{ color: 'var(--color-dim)' }}>WPN:</span> {wpnName} {' | '}
        <span style={{ color: 'var(--color-dim)' }}>SHD:</span> {shdVal} {' | '}
        <span style={{ color: 'var(--color-dim)' }}>DEF:</span> {defName}
      </div>
    </div>
  );
}
