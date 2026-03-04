import { useStore } from '../state/store';
import { MODULES } from '@void-sector/shared';
import type { ShipModule } from '@void-sector/shared';

function BarDisplay({ current, max, width = 8 }: { current: number; max: number; width?: number }) {
  const filled = max > 0 ? Math.round((current / max) * width) : 0;
  return <span>{'\u2588'.repeat(filled)}{'\u2591'.repeat(width - filled)}</span>;
}

const labelStyle: React.CSSProperties = {
  width: 28,
  flexShrink: 0,
  color: 'var(--color-dim)',
};

export function CombatStatusPanel() {
  const ship = useStore((s) => s.ship);

  if (!ship) {
    return (
      <div style={{
        padding: '4px 6px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        color: 'var(--color-dim)',
        opacity: 0.5,
      }}>
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

  const damageModColor = stats.damageMod > 0
    ? '#00FF88'
    : stats.damageMod < 0
      ? '#FF3333'
      : 'var(--color-dim)';

  return (
    <div style={{
      padding: '4px 6px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.6rem',
      lineHeight: 1.6,
    }}>
      {/* Header */}
      <div style={{
        color: 'var(--color-primary)',
        letterSpacing: '0.15em',
        marginBottom: 4,
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: 2,
      }}>
        COMBAT SYSTEMS
      </div>

      {/* Weapon */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={labelStyle}>WPN</span>
        {weaponDef ? (
          <span style={{ color: 'var(--color-primary)' }}>
            {weaponDef.displayName} ATK:{stats.weaponAttack} {stats.weaponType.toUpperCase()}
            {stats.weaponPiercing > 0 && ` PRC:${Math.round(stats.weaponPiercing * 100)}%`}
          </span>
        ) : (
          <span style={{ color: 'var(--color-dim)', opacity: 0.4 }}>---</span>
        )}
      </div>

      {/* Shield */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={labelStyle}>SHD</span>
        {shieldDef ? (
          <span style={{ color: '#00CCFF' }}>
            <BarDisplay current={stats.shieldHp} max={stats.shieldHp} />
            {' '}{stats.shieldHp} +{stats.shieldRegen}/rnd
          </span>
        ) : (
          <span style={{ color: 'var(--color-dim)', opacity: 0.4 }}>---</span>
        )}
      </div>

      {/* Defense */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={labelStyle}>DEF</span>
        {defenseDef ? (
          <span style={{ color: 'var(--color-primary)' }}>
            {defenseDef.displayName} PD:{Math.round(stats.pointDefense * 100)}%
          </span>
        ) : (
          <span style={{ color: 'var(--color-dim)', opacity: 0.4 }}>---</span>
        )}
      </div>

      {/* ECM */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={labelStyle}>ECM</span>
        <span style={{ color: stats.ecmReduction > 0 ? 'var(--color-primary)' : 'var(--color-dim)', opacity: stats.ecmReduction > 0 ? 1 : 0.4 }}>
          {stats.ecmReduction > 0 ? `${Math.round(stats.ecmReduction * 100)}%` : '---'}
        </span>
      </div>

      {/* Damage Modifier */}
      {stats.damageMod !== 0 && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={labelStyle}>DMG</span>
          <span style={{ color: damageModColor }}>
            {stats.damageMod > 0 ? '+' : ''}{Math.round(stats.damageMod * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
