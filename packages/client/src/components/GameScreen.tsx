import { useEffect } from 'react';
import { CockpitLayout } from './CockpitLayout';
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
import { ModulePanel } from './ModulePanel';
import { HangarPanel } from './HangarPanel';
import { HelpOverlay } from './HelpOverlay';
import { AncientRuinDialog } from './AncientRuinDialog';
import { CompendiumOverlay } from './CompendiumOverlay';
import { StationCombatOverlay } from './StationCombatOverlay';
import { TechTreePanel } from './TechTreePanel';
import { TechDetailPanel } from './TechDetailPanel';
import { BaseOverview } from './BaseOverview';
import { BaseDetailPanel } from './BaseDetailPanel';
import { BlueprintDialog } from './BlueprintDialog';
import { QuadMapScreen } from './QuadMapScreen';
import { NewsScreen } from './NewsScreen';
import { MehrOverlay } from './MehrOverlay';
import { StationTerminalOverlay } from './StationTerminalOverlay';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { useMobileTabs } from '../hooks/useMobileTabs';
import { MONITORS } from '@void-sector/shared';
import { COLOR_PROFILES, type ColorProfileName } from '../styles/themes';

// --- SHIP-SYS: Settings + Modules + Hangar ---

type ShipSysView = 'settings' | 'modules' | 'hangar';

const SHIP_SYS_MODES: ShipSysView[] = ['settings', 'modules', 'hangar'];

const ACEP_PATHS = [
  { key: 'ausbau', label: 'AUSBAU', color: '#ffaa00', max: 50 },
  { key: 'intel', label: 'INTEL', color: '#00ffcc', max: 50 },
  { key: 'kampf', label: 'KAMPF', color: '#ff4444', max: 50 },
  { key: 'explorer', label: 'EXPLORER', color: '#8888ff', max: 50 },
] as const;

function AcepPanel() {
  const ship = useStore((s) => s.ship);
  const xp = ship?.acepXp;
  if (!xp) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.6rem', opacity: 0.6, marginBottom: 4, letterSpacing: '0.1em' }}>
        ADAPTIVE CRAFT EVOLUTION PROTOCOL
      </div>
      {ACEP_PATHS.map(({ key, label, color, max }) => {
        const val = xp[key] ?? 0;
        const pct = Math.min(100, (val / max) * 100);
        return (
          <div key={key} style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
              <span style={{ color }}>{label}</span>
              <span style={{ color: 'var(--color-dim)' }}>{val}/{max}</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', marginTop: 1 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: '0.58rem', color: 'var(--color-dim)', marginTop: 3 }}>
        BUDGET: {xp.total ?? 0}/100
      </div>
    </div>
  );
}

function SettingsView() {
  const colorProfile = useStore((s) => s.colorProfile);
  const setColorProfile = useStore((s) => s.setColorProfile);

  return (
    <div
      style={{
        padding: '8px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        lineHeight: 1.5,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          letterSpacing: '0.15em',
          fontSize: '0.7rem',
          marginBottom: 8,
          borderBottom: '1px solid var(--color-dim)',
          paddingBottom: 2,
        }}
      >
        SYSTEM-EINSTELLUNGEN
      </div>

      <AcepPanel />

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: '0.65rem', opacity: 0.6 }}>DISPLAY PROFILE</label>
        <select
          value={colorProfile}
          onChange={(e) => setColorProfile(e.target.value as ColorProfileName)}
          style={{
            display: 'block',
            marginTop: 4,
            width: '100%',
            background: '#050505',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
            fontSize: '0.7rem',
          }}
        >
          {Object.keys(COLOR_PROFILES).map((name) => (
            <option key={name} value={name}>
              {name.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <TerritoryPanel />

      <div
        style={{
          borderTop: '1px solid var(--color-dim)',
          paddingTop: 4,
          color: 'var(--color-dim)',
        }}
      >
        SYSTEMS: <span style={{ color: '#00FF88' }}>ONLINE</span>
      </div>
    </div>
  );
}

function TerritoryPanel() {
  const q = useStore((s) => s.currentQuadrant);
  if (!q) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: '0.6rem',
          opacity: 0.6,
          marginBottom: 4,
          letterSpacing: '0.1em',
          borderTop: '1px solid var(--color-dim)',
          paddingTop: 6,
        }}
      >
        TERRITORY CONTROL
      </div>
      <div style={{ fontSize: '0.62rem', color: 'var(--color-dim)', marginBottom: 4 }}>
        QUADRANT [{q.qx}:{q.qy}]{q.name ? ` — ${q.name}` : ''}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => network.sendClaimTerritory()}
          style={{
            flex: 1,
            background: 'transparent',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
            fontFamily: 'monospace',
            fontSize: '0.6rem',
            padding: '3px 6px',
            cursor: 'pointer',
          }}
        >
          ⬡ CLAIM
        </button>
        <button
          onClick={() => network.requestMyTerritories()}
          style={{
            flex: 1,
            background: 'transparent',
            border: '1px solid var(--color-dim)',
            color: 'var(--color-dim)',
            fontFamily: 'monospace',
            fontSize: '0.6rem',
            padding: '3px 6px',
            cursor: 'pointer',
          }}
        >
          LIST
        </button>
      </div>
    </div>
  );
}

function ShipSysScreen() {
  const view = (useStore((s) => s.monitorModes[MONITORS.SHIP_SYS]) ?? 'settings') as ShipSysView;

  useEffect(() => {
    network.sendGetShips(); // refresh acepXp + ship stats on open
  }, []);

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
        <div
          style={{ width: 320, minHeight: 0, overflow: 'auto', borderLeft: '2px solid #2a2a2a' }}
        >
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
        <div
          style={{ width: 320, minHeight: 0, overflow: 'auto', borderLeft: '2px solid #2a2a2a' }}
        >
          <BaseDetailPanel />
        </div>
      </div>
    </div>
  );
}

// Full NavCom screen (used when main is switched to NAV-COM in fullscreen mode)
function NavComScreen() {
  const q = useStore((s) => s.currentQuadrant);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {q && (
        <div
          style={{
            padding: '2px 6px',
            fontSize: '0.65rem',
            color: 'var(--color-dim)',
            borderBottom: '1px solid var(--color-dim)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          [{q.qx}][{q.qy}]{q.name ? ` ${q.name}` : ''}
        </div>
      )}
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
    case MONITORS.NAV_COM:
      return <NavComScreen />;
    case MONITORS.LOG:
      return <EventLog />;
    case MONITORS.SHIP_SYS:
      return <ShipSysScreen />;
    case MONITORS.MINING:
      return <MiningScreen />;
    case MONITORS.CARGO:
      return <CargoScreen />;
    case MONITORS.COMMS:
      return <CommsScreen />;
    case MONITORS.BASE_LINK:
      return <BaseSplitScreen />;
    case MONITORS.TRADE:
      return <TradeScreen />;
    case MONITORS.FACTION:
      return <FactionScreen />;
    case MONITORS.QUESTS:
      return <QuestsScreen />;
    case MONITORS.TECH:
      return <TechScreen />;
    case MONITORS.QUAD_MAP:
      return <QuadMapScreen />;
    case MONITORS.NEWS:
      return <NewsScreen />;
    case 'MODULES':
      return <ModulePanel />;
    case 'HANGAR':
      return <HangarPanel />;
    default:
      return <div style={{ padding: 12 }}>UNKNOWN MONITOR</div>;
  }
}

function CockpitNavCom() {
  const q = useStore((s) => s.currentQuadrant);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {q && (
        <div
          style={{
            padding: '2px 6px',
            fontSize: '0.65rem',
            color: 'var(--color-dim)',
            borderBottom: '1px solid var(--color-dim)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          [{q.qx}][{q.qy}]{q.name ? ` ${q.name}` : ''}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <RadarCanvas />
        </div>
        <BookmarkBar />
      </div>
    </div>
  );
}

/** Simplified renderScreen for cockpit layout — no embedded controls/details */
function renderCockpitScreen(monitorId: string) {
  switch (monitorId) {
    case MONITORS.NAV_COM:
      return <CockpitNavCom />;
    case MONITORS.TECH:
      return <TechTreePanel />;
    case MONITORS.BASE_LINK:
      return <BaseOverview />;
    default:
      return renderScreen(monitorId);
  }
}

export function GameScreen() {
  const colorProfile = useStore((s) => s.colorProfile);
  const activeMonitor = useStore((s) => s.activeMonitor);
  const setActiveMonitor = useStore((s) => s.setActiveMonitor);
  const clearAlert = useStore((s) => s.clearAlert);
  const alerts = useStore((s) => s.alerts);
  const setMoreOverlayOpen = useStore((s) => s.setMoreOverlayOpen);

  // Context-aware mobile tabs
  const { tabs: mobileTabs, mehrMonitors, mehrAlertCount } = useMobileTabs();

  useEffect(() => {
    const profile = COLOR_PROFILES[colorProfile];
    document.documentElement.style.setProperty('--color-primary', profile.primary);
    document.documentElement.style.setProperty('--color-dim', profile.dim);
  }, [colorProfile]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Desktop layout (>= 1024px) */}
      <CockpitLayout renderScreen={renderCockpitScreen} />

      {/* Mobile content (< 1024px): full-screen active monitor */}
      <div className="mobile-content">{renderScreen(activeMonitor)}</div>

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
      <CompendiumOverlay />
      <HelpOverlay />
      <AncientRuinDialog />
      <StationTerminalGate />
    </div>
  );
}

function StationTerminalGate() {
  const stationTerminalOpen = useStore((s) => s.stationTerminalOpen);
  if (!stationTerminalOpen) return null;
  return <StationTerminalOverlay />;
}
