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
import { TradeScreen } from './TradeScreen';
import { FactionScreen } from './FactionScreen';
import { QuestsScreen } from './QuestsScreen';
import { BattleDialog } from './BattleDialog';
import { BattleResultDialog } from './BattleResultDialog';
import { useStore } from '../state/store';
import { MONITORS, MAIN_MONITORS, HULLS, MODULES } from '@void-sector/shared';
import type { HullType, ShipModule, ModuleCategory } from '@void-sector/shared';
import { COLOR_PROFILES, type ColorProfileName } from '../styles/themes';

// --- Ship Schematic Helpers ---

const SLOT_LABELS: Record<ModuleCategory, string> = {
  drive: 'DRV',
  cargo: 'CRG',
  scanner: 'SCN',
  armor: 'ARM',
  special: 'SPC',
};

const CATEGORY_DISPLAY: Record<ModuleCategory, string> = {
  drive: 'DRIVE',
  cargo: 'CARGO',
  scanner: 'SCANNER',
  armor: 'ARMOR',
  special: 'SPECIAL',
};

function getSlotLabel(modules: ShipModule[], slotIndex: number): { label: string; filled: boolean } {
  const mod = modules.find((m) => m.slotIndex === slotIndex);
  if (!mod) return { label: '---', filled: false };
  const def = MODULES[mod.moduleId];
  if (!def) return { label: '???', filled: true };
  return { label: `${SLOT_LABELS[def.category] || '???'} ${def.tier}`, filled: true };
}

function getModuleByCategory(modules: ShipModule[], category: ModuleCategory): string {
  const mod = modules.find((m) => {
    const def = MODULES[m.moduleId];
    return def && def.category === category;
  });
  if (!mod) return 'NONE';
  const def = MODULES[mod.moduleId];
  return def ? def.displayName : 'UNKNOWN';
}

type SchematicLine = { text: string; slotIndex?: number };

function getSchematicLines(hullType: HullType): SchematicLine[] {
  switch (hullType) {
    case 'scout':
      return [
        { text: '    \u2571\u2572' },
        { text: '   \u2571  \u2572' },
        { text: '  \u2571 ?? \u2572', slotIndex: 0 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 1 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 2 },
        { text: '  \u2514\u2500\u252C\u252C\u2500\u2518' },
        { text: '    \u2572\u2571' },
      ];
    case 'freighter':
      return [
        { text: '  \u250C\u2500\u2500\u2500\u2500\u2510' },
        { text: '  \u2502 ?? \u2502', slotIndex: 0 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 1 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 2 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 3 },
        { text: '  \u2514\u2500\u2500\u2500\u2500\u2518' },
      ];
    case 'cruiser':
      return [
        { text: '    \u2571\u2572' },
        { text: '   \u2571  \u2572' },
        { text: '  \u250C\u2500\u2500\u2500\u2500\u2510' },
        { text: '  \u2502 ?? \u2502', slotIndex: 0 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 1 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 2 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 3 },
        { text: '  \u2514\u2500\u252C\u252C\u2500\u2518' },
        { text: '    \u2572\u2571' },
      ];
    case 'explorer':
      return [
        { text: '    \u2571\u2572' },
        { text: '   \u2571  \u2572' },
        { text: '  \u2571 ?? \u2572', slotIndex: 0 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 1 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 2 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 3 },
        { text: '  \u251C\u2500\u2500\u2500\u2500\u2524' },
        { text: '  \u2502 ?? \u2502', slotIndex: 4 },
        { text: '  \u2514\u2500\u2572\u2571\u2500\u2518' },
      ];
    case 'battleship':
      return [
        { text: '  \u2554\u2550\u2550\u2550\u2550\u2557' },
        { text: '  \u2551 ?? \u2551', slotIndex: 0 },
        { text: '  \u2560\u2550\u2550\u2550\u2550\u2563' },
        { text: '  \u2551 ?? \u2551', slotIndex: 1 },
        { text: '  \u2560\u2550\u2550\u2550\u2550\u2563' },
        { text: '  \u2551 ?? \u2551', slotIndex: 2 },
        { text: '  \u2560\u2550\u2550\u2550\u2550\u2563' },
        { text: '  \u2551 ?? \u2551', slotIndex: 3 },
        { text: '  \u2560\u2550\u2550\u2550\u2550\u2563' },
        { text: '  \u2551 ?? \u2551', slotIndex: 4 },
        { text: '  \u255A\u2550\u2550\u2550\u2550\u255D' },
      ];
    default:
      return [{ text: '  [UNKNOWN]' }];
  }
}

function renderSchematicLine(
  line: SchematicLine,
  modules: ShipModule[],
): React.ReactNode {
  if (line.slotIndex === undefined) {
    return <span style={{ color: 'var(--color-dim)' }}>{line.text}</span>;
  }
  const { label, filled } = getSlotLabel(modules, line.slotIndex);
  // Pad label to 3 chars for consistent width
  const padded = label.length < 4 ? label.padEnd(4, ' ').slice(0, 5) : label.slice(0, 5);
  const parts = line.text.split('??');
  return (
    <>
      <span style={{ color: 'var(--color-dim)' }}>{parts[0]}</span>
      <span style={{ color: filled ? 'var(--color-primary)' : 'var(--color-dim)', opacity: filled ? 1 : 0.4 }}>
        {padded}
      </span>
      <span style={{ color: 'var(--color-dim)' }}>{parts[1] || ''}</span>
    </>
  );
}

function ShipSysScreen() {
  const ship = useStore((s) => s.ship);
  const colorProfile = useStore((s) => s.colorProfile);
  const setColorProfile = useStore((s) => s.setColorProfile);

  const hull = ship ? HULLS[ship.hullType] : null;
  const stats = ship?.stats;

  if (!ship || !hull || !stats) {
    return (
      <div style={{ padding: '8px 12px', fontSize: '0.8rem', lineHeight: 1.8 }}>
        <div style={{ letterSpacing: '0.2em', fontSize: '0.85rem', color: 'var(--color-dim)' }}>
          NO SHIP DATA
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: '0.75rem', opacity: 0.6 }}>DISPLAY PROFILE</label>
          <select
            value={colorProfile}
            onChange={(e) => setColorProfile(e.target.value as ColorProfileName)}
            style={{
              display: 'block', marginTop: 4, width: '100%',
              background: 'transparent', border: '1px solid var(--color-primary)',
              color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
              padding: '4px 8px', fontSize: '0.8rem',
            }}
          >
            {Object.keys(COLOR_PROFILES).map((name) => (
              <option key={name} value={name}>{name.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  const schematicLines = getSchematicLines(ship.hullType);
  const categories: ModuleCategory[] = ['drive', 'cargo', 'scanner', 'armor', 'special'];

  return (
    <div style={{
      padding: '6px 8px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.65rem',
      lineHeight: 1.5,
      overflow: 'auto',
    }}>
      {/* Two-column layout: schematic + stats */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {/* Left: Ship schematic */}
        <div style={{ flexShrink: 0, whiteSpace: 'pre' }}>
          {schematicLines.map((line, i) => (
            <div key={i}>{renderSchematicLine(line, ship.modules)}</div>
          ))}
        </div>

        {/* Right: Stats panel */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: 'var(--color-primary)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
            {hull.name} &quot;{ship.name}&quot;
          </div>
          <div style={{ color: 'var(--color-dim)', margin: '2px 0' }}>
            {'\u2500'.repeat(20)}
          </div>
          {categories.map((cat) => (
            <div key={cat} style={{ display: 'flex', gap: 4 }}>
              <span style={{ color: 'var(--color-dim)', width: 64, flexShrink: 0 }}>
                {CATEGORY_DISPLAY[cat]}:
              </span>
              <span style={{
                color: getModuleByCategory(ship.modules, cat) !== 'NONE'
                  ? 'var(--color-primary)' : 'var(--color-dim)',
                opacity: getModuleByCategory(ship.modules, cat) !== 'NONE' ? 1 : 0.5,
              }}>
                {getModuleByCategory(ship.modules, cat)}
              </span>
            </div>
          ))}
          <div style={{ color: 'var(--color-dim)', margin: '2px 0' }}>
            {'\u2500'.repeat(20)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
            <span>FUEL: <span style={{ color: 'var(--color-primary)' }}>{stats.fuelMax}</span></span>
            <span>CARGO: <span style={{ color: 'var(--color-primary)' }}>{stats.cargoCap}</span></span>
            <span>JUMP: <span style={{ color: 'var(--color-primary)' }}>{stats.jumpRange}</span></span>
            <span>AP/J: <span style={{ color: 'var(--color-primary)' }}>{stats.apCostJump}</span></span>
            <span>SCAN: <span style={{ color: 'var(--color-primary)' }}>{stats.scannerLevel}</span></span>
            <span>HP: <span style={{ color: 'var(--color-primary)' }}>{stats.hp}</span></span>
            <span>COMM: <span style={{ color: 'var(--color-primary)' }}>{stats.commRange}</span></span>
          </div>
        </div>
      </div>

      {/* Systems status */}
      <div style={{ marginTop: 6, borderTop: '1px solid var(--color-dim)', paddingTop: 4, color: 'var(--color-dim)' }}>
        SYSTEMS: <span style={{ color: '#00FF88' }}>ONLINE</span>
      </div>

      {/* Color profile selector */}
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: '0.65rem', opacity: 0.6 }}>DISPLAY PROFILE</label>
        <select
          value={colorProfile}
          onChange={(e) => setColorProfile(e.target.value as ColorProfileName)}
          style={{
            display: 'block', marginTop: 2, width: '100%',
            background: 'transparent', border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
            padding: '3px 6px', fontSize: '0.7rem',
          }}
        >
          {Object.keys(COLOR_PROFILES).map((name) => (
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
    case MONITORS.TRADE: return <TradeScreen />;
    case MONITORS.FACTION: return <FactionScreen />;
    case MONITORS.QUESTS: return <QuestsScreen />;
    default: return <div style={{ padding: 12 }}>UNKNOWN MONITOR</div>;
  }
}

export function GameScreen() {
  const colorProfile = useStore((s) => s.colorProfile);
  const mainMode = useStore((s) => s.mainMonitorMode);
  const setMainMonitorMode = useStore((s) => s.setMainMonitorMode);
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
      <div style={{ padding: '6px 12px', fontSize: '0.75rem', letterSpacing: '0.2em', borderBottom: '1px solid var(--color-dim)' }}>
        <span style={{ opacity: 0.6 }}>DETAIL</span>
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

  // Main area channel bar (NAV split + fullscreen program switching)
  const mainChannelBar = (
    <div className="main-channel-bar">
      <button
        className={`channel-btn-small ${mainMode === 'split' ? 'active' : ''}`}
        onClick={() => setMainMonitorMode('split')}
      >
        NAV
      </button>
      {MAIN_MONITORS.filter(id => id !== MONITORS.NAV_COM).map((id) => (
        <button
          key={id}
          className={`channel-btn-small ${mainMode === id ? 'active' : ''} ${alerts[id] && mainMode !== id ? 'alert' : ''}`}
          onClick={() => {
            setMainMonitorMode(id);
            if (alerts[id]) clearAlert(id);
          }}
        >
          {id.slice(0, 3)}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DesktopLayout
        gridArea={gridArea}
        detailArea={detailArea}
        controlsArea={controlsArea}
        mainChannelBar={mainChannelBar}
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
      <BattleDialog />
      <BattleResultDialog />
    </div>
  );
}
