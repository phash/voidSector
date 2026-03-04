import { useEffect, useState } from 'react';
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
import { CombatV2Dialog } from './CombatV2Dialog';
import { BattleResultDialog } from './BattleResultDialog';
import { DetailViewOverlay } from './DetailViewOverlay';
import { ModulePanel } from './ModulePanel';
import { HangarPanel } from './HangarPanel';
import { HelpOverlay } from './HelpOverlay';
import { StationCombatOverlay } from './StationCombatOverlay';
import { TechTreePanel } from './TechTreePanel';
import { BlueprintDialog } from './BlueprintDialog';
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
  weapon: 'WPN',
  shield: 'SHD',
  defense: 'DEF',
};

const CATEGORY_DISPLAY: Record<ModuleCategory, string> = {
  drive: 'DRIVE',
  cargo: 'CARGO',
  scanner: 'SCANNER',
  armor: 'ARMOR',
  special: 'SPECIAL',
  weapon: 'WEAPON',
  shield: 'SHIELD',
  defense: 'DEFENSE',
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
      // Light interceptor — sleek arrow profile, 3 slots
      return [
        { text: '      ╱△╲' },
        { text: '     ╱   ╲' },
        { text: '    ╱  ??  ╲', slotIndex: 0 },
        { text: '   ╱─────────╲' },
        { text: '   ┤   ??   ├', slotIndex: 1 },
        { text: '   ╲─────────╱' },
        { text: '   │   ??   │', slotIndex: 2 },
        { text: '   └──┬┬────┘' },
        { text: '      ╲╱' },
      ];
    case 'freighter':
      // Heavy cargo hauler — wide blocky rectangle, 4 slots
      return [
        { text: '  ╔══════════╗' },
        { text: '  ║   ??    ║', slotIndex: 0 },
        { text: '  ╠══════════╣' },
        { text: '  ║   ??    ║', slotIndex: 1 },
        { text: '  ╠══════════╣' },
        { text: '  ║   ??    ║', slotIndex: 2 },
        { text: '  ╠══════════╣' },
        { text: '  ║   ??    ║', slotIndex: 3 },
        { text: '  ╚══╦════╦══╝' },
        { text: '     ║    ║' },
      ];
    case 'cruiser':
      // Armored warship — winged hull, 4 slots
      return [
        { text: '      ╱△╲' },
        { text: '     ╱   ╲' },
        { text: '  ╔══╪═════╪══╗' },
        { text: '  ║  │  ?? │  ║', slotIndex: 0 },
        { text: '  ╠══╪═════╪══╣' },
        { text: '  ║  │  ?? │  ║', slotIndex: 1 },
        { text: '  ╠══╪═════╪══╣' },
        { text: '  ║  │  ?? │  ║', slotIndex: 2 },
        { text: '  ║  │  ?? │  ║', slotIndex: 3 },
        { text: '  ╚══╪═════╪══╝' },
        { text: '     ╲   ╱' },
        { text: '      ╲▼╱' },
      ];
    case 'explorer':
      // Science vessel — sensor nose with extended sensor wings, 5 slots
      return [
        { text: '       ╱△╲' },
        { text: '      ╱   ╲' },
        { text: '     ╱  ??  ╲', slotIndex: 0 },
        { text: '    ╱─────────╲' },
        { text: ' ═══╡   ??   ╞', slotIndex: 1 },
        { text: '    │─────────│' },
        { text: ' ═══╡   ??   ╞', slotIndex: 2 },
        { text: '    │─────────│' },
        { text: ' ═══╡   ??   ╞', slotIndex: 3 },
        { text: '    │   ??   │', slotIndex: 4 },
        { text: '    └───┬┬───┘' },
      ];
    case 'battleship':
      // Heavy fortress — armored flanks, dual thruster banks, 5 slots
      return [
        { text: '  ╔═══╦══════╦═══╗' },
        { text: '  ║▓▓▓║  ??  ║▓▓▓║', slotIndex: 0 },
        { text: '  ╠═══╬══════╬═══╣' },
        { text: '  ║▓▓▓║  ??  ║▓▓▓║', slotIndex: 1 },
        { text: '  ╠═══╬══════╬═══╣' },
        { text: '  ║   ║  ??  ║   ║', slotIndex: 2 },
        { text: '  ╠═══╬══════╬═══╣' },
        { text: '  ║   ║  ??  ║   ║', slotIndex: 3 },
        { text: '  ╠═══╬══════╬═══╣' },
        { text: '  ║▓▓▓║  ??  ║▓▓▓║', slotIndex: 4 },
        { text: '  ╚═══╩══╦═══╩═══╝' },
        { text: '         ▼' },
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

type ShipSysView = 'schematic' | 'modules' | 'hangar';

const shipSysTabStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'var(--color-primary)' : 'transparent',
  color: active ? '#000' : 'var(--color-primary)',
  border: '1px solid var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  padding: '2px 6px',
  cursor: 'pointer',
  letterSpacing: '0.1em',
});

function SchematicView() {
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
      padding: '4px 8px',
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
            <span>ENGINE: <span style={{ color: 'var(--color-primary)' }}>SPD {stats.engineSpeed}</span></span>
            <span>FUEL/J: <span style={{ color: 'var(--color-primary)' }}>{stats.fuelPerJump}</span></span>
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

function ShipSysScreen() {
  const [view, setView] = useState<ShipSysView>('schematic');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '4px 6px',
        borderBottom: '1px solid var(--color-dim)',
        flexShrink: 0,
      }}>
        <button style={shipSysTabStyle(view === 'schematic')} onClick={() => setView('schematic')}>
          SCHEMATIC
        </button>
        <button style={shipSysTabStyle(view === 'modules')} onClick={() => setView('modules')}>
          MODULE
        </button>
        <button style={shipSysTabStyle(view === 'hangar')} onClick={() => setView('hangar')}>
          HANGAR
        </button>
      </div>

      {/* Sub-view content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {view === 'schematic' && <SchematicView />}
        {view === 'modules' && <ModulePanel />}
        {view === 'hangar' && <HangarPanel />}
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
    case MONITORS.TECH: return <TechTreePanel />;
    default: return <div style={{ padding: 12 }}>UNKNOWN MONITOR</div>;
  }
}

const MOBILE_TABS: Array<{ id: string; icon: string; label: string }> = [
  { id: MONITORS.NAV_COM,   icon: '◉', label: 'NAV' },
  { id: MONITORS.SHIP_SYS,  icon: '⚙', label: 'SHIP' },
  { id: MONITORS.MINING,    icon: '⛏', label: 'MINE' },
  { id: MONITORS.CARGO,     icon: '▤', label: 'CARGO' },
  { id: MONITORS.COMMS,     icon: '⌘', label: 'COMMS' },
  { id: MONITORS.BASE_LINK, icon: '⌂', label: 'BASE' },
  { id: MONITORS.TECH, icon: '⚗', label: 'TECH' },
];

export function GameScreen() {
  const colorProfile = useStore((s) => s.colorProfile);
  const mainMode = useStore((s) => s.mainMonitorMode);
  const setMainMonitorMode = useStore((s) => s.setMainMonitorMode);
  const activeMonitor = useStore((s) => s.activeMonitor);
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <RadarCanvas />
        </div>
        <DetailViewOverlay />
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
      {/* Desktop layout (>= 1024px) */}
      <DesktopLayout
        gridArea={gridArea}
        detailArea={detailArea}
        controlsArea={controlsArea}
        mainChannelBar={mainChannelBar}
        renderScreen={renderScreen}
      />

      {/* Mobile content (< 1024px): full-screen active monitor */}
      <div className="mobile-content">
        {renderScreen(activeMonitor)}
      </div>

      {/* Mobile tabs (< 1024px) */}
      <div className="mobile-tabs">
        {MOBILE_TABS.map(({ id, icon, label }) => (
          <button
            key={id}
            className={`mobile-tab-btn${activeMonitor === id ? ' active' : ''}${alerts[id] ? ' alert' : ''}`}
            onClick={() => {
              setActiveMonitor(id);
              if (alerts[id]) clearAlert(id);
            }}
          >
            <span className="mobile-tab-icon">{icon}</span>
            <span className="mobile-tab-label">{label}</span>
          </button>
        ))}
      </div>
      <BattleDialog />
      <CombatV2Dialog />
      <StationCombatOverlay />
      <BattleResultDialog />
      <BlueprintDialog />
      <HelpOverlay />
    </div>
  );
}
