import { useEffect } from 'react';
import { MonitorBezel } from './MonitorBezel';
import { RadarCanvas } from './RadarCanvas';
import { StatusBar, SectorInfo } from './HUD';
import { NavControls } from './NavControls';
import { EventLog } from './EventLog';
import { MiningScreen } from './MiningScreen';
import { CargoScreen } from './CargoScreen';
import { CommsScreen } from './CommsScreen';
import { useStore } from '../state/store';
import { MONITORS, SHIP_CLASSES } from '@void-sector/shared';
import { COLOR_PROFILES, type ColorProfileName } from '../styles/themes';

function NavComScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 12px', fontSize: '0.85rem', letterSpacing: '0.2em', opacity: 0.6 }}>
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
  const colorProfile = useStore((s) => s.colorProfile);
  const setColorProfile = useStore((s) => s.setColorProfile);
  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 2 }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: '16px' }}>
        {ship ? SHIP_CLASSES[ship.shipClass].name : 'NO SHIP DATA'}
      </div>
      <div>ION DRIVE ──── [RANGE: {ship?.jumpRange ?? '?'} SECTORS]</div>
      <div>CARGO HOLD ─── [CAP: {ship?.cargoCap ?? '?'} UNITS]</div>
      <div>SCANNER ────── [LEVEL: {ship?.scannerLevel ?? '?'}]</div>
      <div>SAFE SLOTS ─── [{ship?.safeSlots ?? '?'}]</div>
      <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-dim)', paddingTop: '8px' }}>
        SYSTEMS: ONLINE
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: '0.8rem' }}>DISPLAY PROFILE</label>
        <select
          value={colorProfile}
          onChange={(e) => setColorProfile(e.target.value as ColorProfileName)}
          style={{
            display: 'block', marginTop: 4,
            background: 'transparent', border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
          }}
        >
          {Object.keys(COLOR_PROFILES).map(name => (
            <option key={name} value={name}>{name.toUpperCase()}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function GameScreen() {
  const activeMonitor = useStore((s) => s.activeMonitor);
  const setActiveMonitor = useStore((s) => s.setActiveMonitor);
  const colorProfile = useStore((s) => s.colorProfile);
  const unreadComms = useStore((s) => s.unreadComms);

  useEffect(() => {
    const profile = COLOR_PROFILES[colorProfile];
    document.documentElement.style.setProperty('--color-primary', profile.primary);
    document.documentElement.style.setProperty('--color-dim', profile.dim);
  }, [colorProfile]);

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
          {activeMonitor === MONITORS.MINING && <MiningScreen />}
          {activeMonitor === MONITORS.CARGO && <CargoScreen />}
          {activeMonitor === MONITORS.COMMS && <CommsScreen />}
        </MonitorBezel>
      </div>

      <div style={{
        display: 'flex',
        gap: '2px',
        padding: '4px',
        background: '#111',
        borderTop: '2px solid #2a2a2a',
      }}>
        {[MONITORS.NAV_COM, MONITORS.SHIP_SYS, MONITORS.MINING, MONITORS.CARGO, MONITORS.COMMS].map((id) => (
          <button
            key={id}
            className="vs-btn"
            style={{
              flex: 1,
              fontSize: '0.85rem',
              padding: '8px 4px',
              border: '2px solid var(--color-primary)',
              background: activeMonitor === id ? 'var(--color-primary)' : 'transparent',
              color: activeMonitor === id ? '#050505' : 'var(--color-primary)',
            }}
            onClick={() => {
              setActiveMonitor(id);
              if (id === MONITORS.COMMS) useStore.getState().setUnreadComms(false);
            }}
          >
            [{id}]{id === MONITORS.COMMS && unreadComms ? ' \u2022' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
