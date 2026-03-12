import { useStore } from '../state/store';
import { MODULES } from '@void-sector/shared';
import type { ShipModule } from '@void-sector/shared';

export function CombatStatusPanel() {
  const ship = useStore((s) => s.ship);

  if (!ship) {
    return (
      <div className="nav-block">
        <div className="nav-block-header">── COMBAT ──</div>
        <span style={{ color: 'var(--color-dim)', opacity: 0.5 }}>NO DATA</span>
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
    <div className="nav-block">
      <div className="nav-block-header">── COMBAT ──</div>
      <div className="combat-line">
        <span style={{ color: 'var(--color-dim)' }}>WPN:</span> {wpnName}{' | '}
        <span style={{ color: 'var(--color-dim)' }}>SHD:</span> {shdVal}{' | '}
        <span style={{ color: 'var(--color-dim)' }}>DEF:</span> {defName}
      </div>
    </div>
  );
}
