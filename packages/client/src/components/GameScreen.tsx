import { MonitorBezel } from './MonitorBezel';
import { RadarCanvas } from './RadarCanvas';
import { StatusBar, SectorInfo } from './HUD';
import { NavControls } from './NavControls';
import { EventLog } from './EventLog';
import { useStore } from '../state/store';
import { MONITORS } from '@void-sector/shared';

function NavComScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 12px', fontSize: '0.7rem', letterSpacing: '0.2em', opacity: 0.6 }}>
        VOID SECTOR — NAV-COM
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <RadarCanvas />
      </div>
      <SectorInfo />
      <StatusBar />
      <NavControls />
      <EventLog />
    </div>
  );
}

function ShipSysScreen() {
  const ship = useStore((s) => s.ship);
  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 2 }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: '16px' }}>
        {ship ? `${ship.shipClass.toUpperCase()}` : 'NO SHIP DATA'}
      </div>
      <div>ION DRIVE ──── [RANGE: {ship?.jumpRange ?? '?'} SECTORS]</div>
      <div>CARGO HOLD ─── [CAP: {ship?.cargoCap ?? '?'} UNITS]</div>
      <div>SCANNER ────── [LEVEL: {ship?.scannerLevel ?? '?'}]</div>
      <div>SAFE SLOTS ─── [{ship?.safeSlots ?? '?'}]</div>
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-dim)', paddingTop: '8px' }}>
        SYSTEMS: ONLINE
      </div>
    </div>
  );
}

export function GameScreen() {
  const activeMonitor = useStore((s) => s.activeMonitor);
  const setActiveMonitor = useStore((s) => s.setActiveMonitor);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <MonitorBezel
          monitorId={activeMonitor}
          statusLeds={[
            { label: 'SYS', active: true },
            { label: 'NAV', active: activeMonitor === MONITORS.NAV_COM },
          ]}
        >
          {activeMonitor === MONITORS.NAV_COM && <NavComScreen />}
          {activeMonitor === MONITORS.SHIP_SYS && <ShipSysScreen />}
        </MonitorBezel>
      </div>

      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '4px',
        background: '#111',
        borderTop: '2px solid #2a2a2a',
      }}>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setActiveMonitor(MONITORS.NAV_COM)}
        >
          [NAV-COM]
        </button>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setActiveMonitor(MONITORS.SHIP_SYS)}
        >
          [SHIP-SYS]
        </button>
      </div>
    </div>
  );
}
