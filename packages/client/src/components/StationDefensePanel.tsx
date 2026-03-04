import { useStore } from '../state/store';
import { network } from '../network/client';
import { STATION_DEFENSE_DEFS } from '@void-sector/shared';

export function StationDefensePanel() {
  const stationDefenses = useStore((s) => s.stationDefenses);
  const credits = useStore((s) => s.credits);

  const handleInstall = (defenseType: string) => {
    network.sendInstallDefense(defenseType);
  };

  return (
    <div style={{ padding: 8, fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
      <div style={{
        color: 'var(--color-primary)', letterSpacing: '0.15em',
        marginBottom: 8, fontSize: '0.75rem',
      }}>
        STATIONSVERTEIDIGUNG
      </div>

      {stationDefenses.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#888', marginBottom: 4 }}>INSTALLIERT:</div>
          {stationDefenses.map(d => (
            <div key={d.id} style={{ color: '#00FF88', marginBottom: 2 }}>
              &bull; {d.defenseType.replace(/_/g, ' ').toUpperCase()}
            </div>
          ))}
        </div>
      )}

      <div style={{ color: '#888', marginBottom: 4 }}>VERFÜGBAR:</div>
      {Object.entries(STATION_DEFENSE_DEFS).map(([id, def]) => {
        const installed = stationDefenses.some(d => d.defenseType === id);
        const costStr = Object.entries(def.cost)
          .filter(([, v]) => v && v > 0)
          .map(([k, v]) => `${v} ${k === 'credits' ? 'CR' : k}`)
          .join(' + ');
        const canAfford = credits >= def.cost.credits;

        return (
          <div key={id} style={{
            border: '1px solid #333', padding: 6, marginBottom: 4,
            opacity: installed ? 0.4 : 1,
          }}>
            <div style={{ color: 'var(--color-primary)' }}>
              {id.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div style={{ color: '#666', fontSize: '0.55rem' }}>
              {def.damage ? `${def.damage} DMG/Runde` : ''}
              {def.shieldHp ? `Schild: ${def.shieldHp} HP, +${def.shieldRegen}/Runde` : ''}
              {def.oncePer ? ' (1\u00d7 pro Kampf)' : ''}
              {def.bypassShields ? ' | Ignoriert Schilde' : ''}
            </div>
            <div style={{ color: '#555', fontSize: '0.55rem' }}>{costStr}</div>
            {!installed && (
              <button
                onClick={() => handleInstall(id)}
                disabled={!canAfford}
                style={{
                  marginTop: 4, background: 'transparent',
                  border: `1px solid ${canAfford ? 'var(--color-primary)' : '#333'}`,
                  color: canAfford ? 'var(--color-primary)' : '#555',
                  fontFamily: 'var(--font-mono)', fontSize: '0.55rem',
                  padding: '3px 8px', cursor: canAfford ? 'pointer' : 'not-allowed',
                }}
              >
                [INSTALLIEREN]
              </button>
            )}
            {installed && (
              <div style={{ color: '#00FF88', fontSize: '0.55rem', marginTop: 4 }}>INSTALLIERT</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
