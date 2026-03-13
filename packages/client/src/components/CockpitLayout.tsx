import { type ReactNode, useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { btn } from '../ui-helpers';
import { ProgramSelector } from './ProgramSelector';
import { SettingsPanel } from './SettingsPanel';
import { HardwareControls } from './HardwareControls';
import { TestPattern } from './TestPattern';
import { TvScreen } from './TvScreen';
import { UnifiedBezel } from './UnifiedBezel';
import { DetailPanel } from './DetailPanel';
import { TechDetailPanel } from './TechDetailPanel';
import { BaseDetailPanel } from './BaseDetailPanel';
import { CargoDetailPanel } from './CargoDetailPanel';
import { TradeDetailPanel } from './TradeDetailPanel';
import { MiningDetailPanel } from './MiningDetailPanel';
import { QuestDetailPanel } from './QuestDetailPanel';
import { FactionDetailPanel } from './FactionDetailPanel';
import { ShipDetailPanel } from './ShipDetailPanel';
import { AcepDetailPanel } from './AcepDetailPanel';
import { WreckPanel } from './WreckPanel';
import { SectorInfo, StatusBar } from './HUD';
import { NavControls } from './NavControls';
import { ShipBlock, CargoBlock } from './ShipBlock';
import { CombatStatusPanel } from './CombatStatusPanel';
import { SlateControls } from './SlateControls';
import { CommsScreen } from './CommsScreen';
import { PlayerContextMenu } from './PlayerContextMenu';
import { StoryEventOverlay } from './overlays/StoryEventOverlay';
import { FirstContactNewsOverlay } from './overlays/FirstContactNewsOverlay';
import { AlienEncounterToast } from './overlays/AlienEncounterToast';
import { QuestCompleteOverlay } from './overlays/QuestCompleteOverlay';
import { LocalScanResultOverlay } from './overlays/LocalScanResultOverlay';
import { getPhysicalCargoTotal } from '@void-sector/shared';

interface CockpitLayoutProps {
  renderScreen: (monitorId: string) => ReactNode;
}

function getDetailForProgram(programId: string): ReactNode | null {
  switch (programId) {
    case 'NAV-COM':
      return <DetailPanel />;
    case 'TECH':
      return <TechDetailPanel />;
    case 'BASE-LINK':
      return <BaseDetailPanel />;
    case 'CARGO':
      return <CargoDetailPanel />;
    case 'TRADE':
      return <TradeDetailPanel />;
    case 'MINING':
      return <MiningDetailPanel />;
    case 'QUESTS':
      return <QuestDetailPanel />;
    case 'FACTION':
      return <FactionDetailPanel />;
    case 'SHIP-SYS':
      return <ShipDetailPanel />;
    case 'ACEP':
      return <AcepDetailPanel />;
    default:
      return null;
  }
}

export function CockpitLayout({ renderScreen }: CockpitLayoutProps) {
  const miningActive = useStore((s) => s.mining?.active ?? false);
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);
  const setActionError = useStore((s) => s.setActionError);
  const cargoFullToastShown = useRef(false);

  const cargoCap = ship?.stats?.cargoCap ?? 5;
  const cargoTotal = getPhysicalCargoTotal(cargo);

  useEffect(() => {
    if (miningActive && cargoTotal >= cargoCap && !cargoFullToastShown.current) {
      cargoFullToastShown.current = true;
      setActionError({ code: 'CARGO_FULL', message: '⚠ CARGO FULL — MINING STOPPED' });
    }
    if (!miningActive) {
      cargoFullToastShown.current = false;
    }
  }, [miningActive, cargoTotal, cargoCap, setActionError]);

  const activeProgram = useStore((s) => s.activeProgram);
  const activeWreck = useStore((s) => s.activeWreck);
  const zoomLevel = useStore((s) => s.zoomLevel);
  const setZoomLevel = useStore((s) => s.setZoomLevel);
  const panOffset = useStore((s) => s.panOffset);
  const setPanOffset = useStore((s) => s.setPanOffset);
  const detailPowerOn = useStore((s) => s.monitorPower['DETAIL'] ?? true);
  const setMonitorPower = useStore((s) => s.setMonitorPower);
  const autoFollow = useStore((s) => s.autoFollow);
  const setAutoFollow = useStore((s) => s.setAutoFollow);
  const detailMonitorMode = useStore((s) => s.monitorModes['DETAIL'] ?? 'tv');
  const setMonitorMode = useStore((s) => s.setMonitorMode);

  const handleMainDpad = (dir: 'up' | 'down' | 'left' | 'right') => {
    const step = 2;
    switch (dir) {
      case 'up':
        setPanOffset({ x: panOffset.x, y: panOffset.y - step });
        break;
      case 'down':
        setPanOffset({ x: panOffset.x, y: panOffset.y + step });
        break;
      case 'left':
        setPanOffset({ x: panOffset.x - step, y: panOffset.y });
        break;
      case 'right':
        setPanOffset({ x: panOffset.x + step, y: panOffset.y });
        break;
    }
  };

  const mainContent = renderScreen(activeProgram);
  const detailContent = activeWreck ? <WreckPanel /> : getDetailForProgram(activeProgram);

  return (
    <div className="cockpit-layout" data-testid="cockpit-layout">
      {/* Section 1: Program Selector */}
      <div className="cockpit-sec1 cockpit-section">
        <ProgramSelector />
      </div>

      {/* Section 2: Main Monitor */}
      <div className="cockpit-sec2 cockpit-section">
        <div className="cockpit-monitor">
          <UnifiedBezel variant="sidebar" monitorId={activeProgram}>
            {mainContent}
          </UnifiedBezel>
        </div>
        <div className="cockpit-hw-strip">
          <HardwareControls
            dpad
            onDpad={handleMainDpad}
            zoom
            zoomValue={zoomLevel}
            onZoom={setZoomLevel}
          />
        </div>
      </div>

      {/* Section 3: Detail Monitor */}
      <div className="cockpit-sec3 cockpit-section">
        <div className="cockpit-monitor">
          <UnifiedBezel variant="sidebar" monitorId="DETAIL">
            {detailPowerOn ? (
              (detailContent ?? (detailMonitorMode === 'tv' ? <TvScreen /> : <TestPattern />))
            ) : (
              <div className="cockpit-off-screen">DISPLAY OFF</div>
            )}
          </UnifiedBezel>
        </div>
        <div className="cockpit-hw-strip">
          <HardwareControls
            follow
            followActive={autoFollow}
            onFollow={() => setAutoFollow(!autoFollow)}
          />
          <div className="hw-mode-toggle">
            <button
              className={`hw-channel-btn${detailMonitorMode === 'detail' ? ' active' : ''}`}
              onClick={() => setMonitorMode('DETAIL', 'detail')}
              title="Detail-Modus"
            >
              {btn('DET')}
            </button>
            <button
              className={`hw-channel-btn${detailMonitorMode === 'tv' ? ' active' : ''}`}
              onClick={() => setMonitorMode('DETAIL', 'tv')}
              title="TV-Modus"
            >
              {btn('TV')}
            </button>
          </div>
        </div>
      </div>

      {/* Section 4: Settings */}
      <div className="cockpit-sec4 cockpit-section">
        <SettingsPanel />
      </div>

      {/* Section 5: Navigation */}
      <div className="cockpit-sec5 cockpit-section">
        <div className="cockpit-monitor cockpit-nav-monitor">
          <div className="nav-zone-a">
            <SectorInfo />
            <StatusBar />
            <NavControls />
          </div>
          <div className="nav-zone-b">
            <ShipBlock />
            <CargoBlock />
            <CombatStatusPanel />
            <SlateControls />
          </div>
        </div>
      </div>

      {/* Section 6: Communication */}
      <div className="cockpit-sec6 cockpit-section">
        <div className="cockpit-monitor">
          <CommsScreen />
        </div>
        <div className="cockpit-hw-strip">
          <HardwareControls />
        </div>
      </div>
      <PlayerContextMenu />
      <LocalScanResultOverlay />
      <StoryEventOverlay />
      <FirstContactNewsOverlay />
      <AlienEncounterToast />
      <QuestCompleteOverlay />
    </div>
  );
}
