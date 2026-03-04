import { useEffect, useCallback } from 'react';
import { UnifiedBezel } from './UnifiedBezel';
import { DesktopLayout } from './DesktopLayout';
import type { MonitorBezelConfig } from './DesktopLayout';
import { DetailPanel } from './DetailPanel';
import { RadarCanvas } from './RadarCanvas';
import { StatusBar, SectorInfo } from './HUD';
import { NavControls } from './NavControls';
import { EventLog } from './EventLog';
import { MiningScreen } from './MiningScreen';
import { CargoScreen } from './CargoScreen';
import { CommsScreen } from './CommsScreen';
import { BookmarkBar } from './BookmarkBar';
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
import { TechDetailPanel } from './TechDetailPanel';
import { BaseOverview } from './BaseOverview';
import { BaseDetailPanel } from './BaseDetailPanel';
import { ShipStatusPanel } from './ShipStatusPanel';
import { CombatStatusPanel } from './CombatStatusPanel';
import { BlueprintDialog } from './BlueprintDialog';
import { QuadMapScreen } from './QuadMapScreen';
import { MehrOverlay } from './MehrOverlay';
import { useStore } from '../state/store';
import { useMobileTabs } from '../hooks/useMobileTabs';
import { MONITORS, MAIN_MONITORS } from '@void-sector/shared';
import type { ChatChannel } from '@void-sector/shared';
import { COLOR_PROFILES, type ColorProfileName } from '../styles/themes';

// --- SHIP-SYS: Settings + Modules + Hangar ---

type ShipSysView = 'settings' | 'modules' | 'hangar';

const SHIP_SYS_MODES: ShipSysView[] = ['settings', 'modules', 'hangar'];

function SettingsView() {
  const colorProfile = useStore((s) => s.colorProfile);
  const setColorProfile = useStore((s) => s.setColorProfile);

  return (
    <div style={{
      padding: '8px 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.65rem',
      lineHeight: 1.5,
      overflow: 'auto',
    }}>
      <div style={{
        letterSpacing: '0.15em',
        fontSize: '0.7rem',
        marginBottom: 8,
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: 2,
      }}>
        SYSTEM-EINSTELLUNGEN
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: '0.65rem', opacity: 0.6 }}>DISPLAY PROFILE</label>
        <select
          value={colorProfile}
          onChange={(e) => setColorProfile(e.target.value as ColorProfileName)}
          style={{
            display: 'block', marginTop: 4, width: '100%',
            background: '#050505', border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
            padding: '4px 8px', fontSize: '0.7rem',
          }}
        >
          {Object.keys(COLOR_PROFILES).map((name) => (
            <option key={name} value={name}>{name.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: 4, color: 'var(--color-dim)' }}>
        SYSTEMS: <span style={{ color: '#00FF88' }}>ONLINE</span>
      </div>
    </div>
  );
}

function ShipSysScreen() {
  const view = (useStore((s) => s.monitorModes[MONITORS.SHIP_SYS]) ?? 'settings') as ShipSysView;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {view === 'settings' && <SettingsView />}
        {view === 'modules' && <ModulePanel />}
        {view === 'hangar' && <HangarPanel />}
      </div>
    </div>
  );
}

// --- Tech Screen (split layout) ---

function TechScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <TechTreePanel />
        </div>
        <div style={{ width: 320, minHeight: 0, overflow: 'auto', borderLeft: '2px solid #2a2a2a' }}>
          <TechDetailPanel />
        </div>
      </div>
    </div>
  );
}

// --- Base Screen (split layout) ---

function BaseSplitScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <BaseOverview />
        </div>
        <div style={{ width: 320, minHeight: 0, overflow: 'auto', borderLeft: '2px solid #2a2a2a' }}>
          <BaseDetailPanel />
        </div>
      </div>
    </div>
  );
}

// Full NavCom screen (used when main is switched to NAV-COM in fullscreen mode)
function NavComScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <RadarCanvas />
        </div>
        <BookmarkBar />
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
    case MONITORS.BASE_LINK: return <BaseSplitScreen />;
    case MONITORS.TRADE: return <TradeScreen />;
    case MONITORS.FACTION: return <FactionScreen />;
    case MONITORS.QUESTS: return <QuestsScreen />;
    case MONITORS.TECH: return <TechScreen />;
    case MONITORS.QUAD_MAP: return <QuadMapScreen />;
    default: return <div style={{ padding: 12 }}>UNKNOWN MONITOR</div>;
  }
}

const COMMS_MODES: ChatChannel[] = ['direct', 'faction', 'local', 'sector', 'quadrant'];

export function GameScreen() {
  const colorProfile = useStore((s) => s.colorProfile);
  const mainMode = useStore((s) => s.mainMonitorMode);
  const setMainMonitorMode = useStore((s) => s.setMainMonitorMode);
  const activeMonitor = useStore((s) => s.activeMonitor);
  const setActiveMonitor = useStore((s) => s.setActiveMonitor);
  const clearAlert = useStore((s) => s.clearAlert);
  const alerts = useStore((s) => s.alerts);
  const setMoreOverlayOpen = useStore((s) => s.setMoreOverlayOpen);

  // Context-aware mobile tabs
  const { tabs: mobileTabs, mehrMonitors, mehrAlertCount } = useMobileTabs();

  // COMMS mode state (chat channel)
  const chatChannel = useStore((s) => s.chatChannel);
  const setChatChannel = useStore((s) => s.setChatChannel);

  // SHIP-SYS mode state (from monitorModes store)
  const shipSysMode = useStore((s) => s.monitorModes[MONITORS.SHIP_SYS]) ?? 'settings';
  const setMonitorMode = useStore((s) => s.setMonitorMode);

  // Bezel config callback for mode-aware monitors
  const getBezelConfig = useCallback((monitorId: string): MonitorBezelConfig | undefined => {
    switch (monitorId) {
      case MONITORS.COMMS:
        return {
          modes: COMMS_MODES,
          currentMode: chatChannel,
          onModeChange: (mode: string) => setChatChannel(mode as ChatChannel),
        };
      case MONITORS.SHIP_SYS:
        return {
          modes: SHIP_SYS_MODES,
          currentMode: shipSysMode,
          onModeChange: (mode: string) => setMonitorMode(MONITORS.SHIP_SYS, mode),
        };
      default:
        return undefined;
    }
  }, [chatChannel, setChatChannel, shipSysMode, setMonitorMode]);

  useEffect(() => {
    const profile = COLOR_PROFILES[colorProfile];
    document.documentElement.style.setProperty('--color-primary', profile.primary);
    document.documentElement.style.setProperty('--color-dim', profile.dim);
  }, [colorProfile]);

  // Grid area: radar canvas inside bezel
  const gridArea = (
    <UnifiedBezel
      variant="main"
      monitorId="NAV-COM"
      showNavControls
      showZoomSlider
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <RadarCanvas />
          </div>
          <BookmarkBar />
        </div>
        <DetailViewOverlay />
      </div>
    </UnifiedBezel>
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

  // Controls area: sector info, status bar, nav controls, ship/combat panels
  const controlsArea = (
    <div className="main-lower-layout">
      <div className="main-lower-top">
        <SectorInfo />
        <StatusBar />
      </div>
      <div className="main-lower-center">
        <NavControls />
      </div>
      <div className="main-lower-bottom">
        <div className="main-lower-left">
          <ShipStatusPanel />
        </div>
        <div className="main-lower-right">
          <CombatStatusPanel />
        </div>
      </div>
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
        getBezelConfig={getBezelConfig}
      />

      {/* Mobile content (< 1024px): full-screen active monitor */}
      <div className="mobile-content">
        {renderScreen(activeMonitor)}
      </div>

      {/* Mobile tabs (< 1024px) — context-aware via useMobileTabs() */}
      <div className="mobile-tabs" data-testid="mobile-tabs">
        {mobileTabs.map(({ id, icon, label, isMehr }) => (
          <button
            key={id}
            className={`mobile-tab-btn${!isMehr && activeMonitor === id ? ' active' : ''}${!isMehr && alerts[id] ? ' alert' : ''}`}
            data-testid={`mobile-tab-${id}`}
            onClick={() => {
              if (isMehr) {
                setMoreOverlayOpen(true);
              } else {
                setActiveMonitor(id);
                if (alerts[id]) clearAlert(id);
              }
            }}
          >
            <span className="mobile-tab-icon">{icon}</span>
            <span className="mobile-tab-label">{label}</span>
            {isMehr && mehrAlertCount > 0 && (
              <span className="mobile-tab-badge" data-testid="mehr-alert-badge">
                {mehrAlertCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <MehrOverlay monitors={mehrMonitors} />
      <BattleDialog />
      <CombatV2Dialog />
      <StationCombatOverlay />
      <BattleResultDialog />
      <BlueprintDialog />
      <HelpOverlay />
    </div>
  );
}
