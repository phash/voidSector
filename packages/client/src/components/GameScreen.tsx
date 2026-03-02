import { useEffect } from 'react';
import { MonitorBezel } from './MonitorBezel';
import { DesktopLayout } from './DesktopLayout';
import { DetailPanel } from './DetailPanel';
import { RadarCanvas } from './RadarCanvas';
import { StatusBar, SectorInfo } from './HUD';
import { NavControls } from './NavControls';
import { EventLog } from './EventLog';
import { MiningScreen } from './MiningScreen';
import { CargoScreen } from './CargoScreen';
import { CommsScreen } from './CommsScreen';
import { BaseScreen } from './BaseScreen';
import { useStore } from '../state/store';
import { MONITORS, SHIP_CLASSES } from '@void-sector/shared';
import { COLOR_PROFILES, type ColorProfileName } from '../styles/themes';

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

// Full NavCom screen (used when main is switched to NAV-COM in fullscreen mode)
function NavComScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <RadarCanvas />
      </div>
      <SectorInfo />
      <StatusBar />
      <NavControls />
    </div>
  );
}

function renderScreen(monitorId: string) {
  switch (monitorId) {
    case MONITORS.NAV_COM: return <NavComScreen />;
    case MONITORS.LOG: return <EventLog />;
    case MONITORS.SHIP_SYS: return <ShipSysScreen />;
    case MONITORS.MINING: return <MiningScreen />;
    case MONITORS.CARGO: return <CargoScreen />;
    case MONITORS.COMMS: return <CommsScreen />;
    case MONITORS.BASE_LINK: return <BaseScreen />;
    default: return <div style={{ padding: 12 }}>UNKNOWN MONITOR</div>;
  }
}

export function GameScreen() {
  const colorProfile = useStore((s) => s.colorProfile);
  const setActiveMonitor = useStore((s) => s.setActiveMonitor);
  const clearAlert = useStore((s) => s.clearAlert);
  const alerts = useStore((s) => s.alerts);

  useEffect(() => {
    const profile = COLOR_PROFILES[colorProfile];
    document.documentElement.style.setProperty('--color-primary', profile.primary);
    document.documentElement.style.setProperty('--color-dim', profile.dim);
  }, [colorProfile]);

  // Grid area: radar canvas inside bezel
  const gridArea = (
    <MonitorBezel
      monitorId="NAV-COM"
      statusLeds={[
        { label: 'SYS', active: true },
        { label: 'NAV', active: true },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <RadarCanvas />
        </div>
      </div>
    </MonitorBezel>
  );

  // Detail area: sector inspection panel
  const detailArea = (
    <div style={{ height: '100%', background: '#050505' }}>
      <div style={{ padding: '6px 12px', fontSize: '0.75rem', letterSpacing: '0.2em', opacity: 0.6, borderBottom: '1px solid var(--color-dim)' }}>
        DETAIL
      </div>
      <DetailPanel />
    </div>
  );

  // Controls area: sector info, status bar, nav controls
  const controlsArea = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SectorInfo />
      <StatusBar />
      <NavControls />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DesktopLayout
        gridArea={gridArea}
        detailArea={detailArea}
        controlsArea={controlsArea}
        renderScreen={renderScreen}
      />

      {/* Mobile tabs (< 1024px) */}
      <div className="mobile-tabs">
        {[MONITORS.NAV_COM, MONITORS.SHIP_SYS, MONITORS.MINING, MONITORS.CARGO, MONITORS.COMMS, MONITORS.BASE_LINK].map((id) => (
          <button
            key={id}
            className={`vs-btn ${alerts[id] ? 'alert' : ''}`}
            style={{
              flex: 1,
              fontSize: '0.75rem',
              padding: '8px 2px',
              border: '2px solid var(--color-primary)',
              background: 'transparent',
              color: 'var(--color-primary)',
            }}
            onClick={() => {
              setActiveMonitor(id);
              if (alerts[id]) clearAlert(id);
            }}
          >
            [{id}]
          </button>
        ))}
      </div>
    </div>
  );
}
