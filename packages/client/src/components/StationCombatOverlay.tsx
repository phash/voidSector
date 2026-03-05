import { useStore } from '../state/store';
import { innerCoord } from '@void-sector/shared';

export function StationCombatOverlay() {
  const event = useStore((s) => s.stationCombatEvent);
  const setStationCombatEvent = useStore((s) => s.setStationCombatEvent);

  if (!event) return null;

  const outcomeColor =
    event.outcome === 'defended' ? '#00FF88' : event.outcome === 'damaged' ? '#FFB000' : '#FF3333';
  const outcomeText =
    event.outcome === 'defended'
      ? 'ABGEWEHRT'
      : event.outcome === 'damaged'
        ? 'BESCH\u00c4DIGT'
        : 'ZERST\u00d6RT';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(5, 5, 5, 0.90)',
        zIndex: 950,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <div
        style={{ color: '#FF3333', fontSize: '0.9rem', letterSpacing: '0.2em', marginBottom: 16 }}
      >
        STATION UNTER ANGRIFF
      </div>
      <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: 8 }}>
        Sektor ({innerCoord(event.sectorX)}, {innerCoord(event.sectorY)}) &bull; Angreifer LV.
        {event.attackerLevel}
      </div>
      <div
        style={{ color: outcomeColor, fontSize: '1rem', letterSpacing: '0.15em', marginBottom: 16 }}
      >
        {outcomeText}
      </div>
      {event.hpLost > 0 && (
        <div style={{ color: '#FF3333', fontSize: '0.7rem', marginBottom: 12 }}>
          HP-Verlust: {event.hpLost}
        </div>
      )}
      <button
        onClick={() => setStationCombatEvent(null)}
        style={{
          background: 'transparent',
          border: '1px solid var(--color-primary)',
          color: 'var(--color-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          padding: '8px 24px',
          cursor: 'pointer',
        }}
      >
        [BEST\u00c4TIGEN]
      </button>
    </div>
  );
}
