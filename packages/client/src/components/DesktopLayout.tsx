import { useState } from 'react';
import type { ReactNode } from 'react';
import { UnifiedBezel } from './UnifiedBezel';
import { ChannelButtons } from './ChannelButtons';
import { useStore } from '../state/store';
import { LEFT_SIDEBAR_MONITORS, RIGHT_SIDEBAR_MONITORS } from '@void-sector/shared';

/** Extra props forwarded to UnifiedBezel per monitor */
export interface MonitorBezelConfig {
  modes?: string[];
  currentMode?: string;
  onModeChange?: (mode: string) => void;
}

interface DesktopLayoutProps {
  gridArea: ReactNode;
  detailArea: ReactNode;
  controlsArea: ReactNode;
  mainChannelBar: ReactNode;
  renderScreen: (monitorId: string) => ReactNode;
  /** Return bezel mode config for a given monitor ID (optional) */
  getBezelConfig?: (monitorId: string) => MonitorBezelConfig | undefined;
}

export function DesktopLayout({ gridArea, detailArea, controlsArea, mainChannelBar, renderScreen, getBezelConfig }: DesktopLayoutProps) {
  const leftSlots = useStore((s) => s.leftSidebarSlots);
  const rightSlots = useStore((s) => s.sidebarSlots);
  const mainMode = useStore((s) => s.mainMonitorMode);
  const alerts = useStore((s) => s.alerts);

  const leftCollapsed = useStore((s) => s.leftCollapsed);
  const rightCollapsed = useStore((s) => s.rightCollapsed);
  const setLeftCollapsed = useStore((s) => s.setLeftCollapsed);
  const setRightCollapsed = useStore((s) => s.setRightCollapsed);

  const [leftAnimating, setLeftAnimating] = useState(false);
  const [rightAnimating, setRightAnimating] = useState(false);

  function toggleLeft() {
    setLeftAnimating(true);
    setTimeout(() => {
      setLeftCollapsed(!leftCollapsed);
      setLeftAnimating(false);
    }, 250);
  }

  function toggleRight() {
    setRightAnimating(true);
    setTimeout(() => {
      setRightCollapsed(!rightCollapsed);
      setRightAnimating(false);
    }, 250);
  }

  return (
    <div className="desktop-layout-v2">
      {/* Left sidebar */}
      <div className={`sidebar-stack sidebar-left${leftCollapsed ? ' collapsed' : ''}`}>
        <button
          className="sidebar-toggle"
          onClick={toggleLeft}
          title={leftCollapsed ? 'Sidebar einblenden' : 'Sidebar ausblenden'}
        >
          {leftCollapsed ? '\u25B6' : '\u25C0'}
        </button>
        {([0, 1] as const).map((slotIndex) => {
          const monitorId = leftSlots[slotIndex];
          const bezelCfg = getBezelConfig?.(monitorId);
          return (
            <div key={slotIndex} className="sidebar-slot">
              {!leftCollapsed && (
                <ChannelButtons slotIndex={slotIndex} side="left" monitors={LEFT_SIDEBAR_MONITORS} />
              )}
              <div className={`sidebar-slot-content${leftAnimating ? (leftCollapsed ? ' sidebar-crt-expand' : ' sidebar-crt-collapse') : ''}`}>
                <UnifiedBezel
                  variant="sidebar"
                  monitorId={monitorId}
                  alert={!!alerts[monitorId]}
                  modes={bezelCfg?.modes}
                  currentMode={bezelCfg?.currentMode}
                  onModeChange={bezelCfg?.onModeChange}
                >
                  {renderScreen(monitorId)}
                </UnifiedBezel>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main area */}
      <div className="main-area">
        {mainChannelBar}
        {mainMode === 'split' ? (
          <>
            <div className="main-upper">
              <div className="main-grid">{gridArea}</div>
              <div className="main-detail">{detailArea}</div>
            </div>
            <div className="main-lower">{controlsArea}</div>
          </>
        ) : (
          <div className="main-fullscreen">{renderScreen(mainMode)}</div>
        )}
      </div>

      {/* Right sidebar */}
      <div className={`sidebar-stack sidebar-right${rightCollapsed ? ' collapsed' : ''}`}>
        {([0, 1] as const).map((slotIndex) => {
          const monitorId = rightSlots[slotIndex];
          const bezelCfg = getBezelConfig?.(monitorId);
          return (
            <div key={slotIndex} className="sidebar-slot">
              <div className={`sidebar-slot-content${rightAnimating ? (rightCollapsed ? ' sidebar-crt-expand' : ' sidebar-crt-collapse') : ''}`}>
                <UnifiedBezel
                  variant="sidebar"
                  monitorId={monitorId}
                  alert={!!alerts[monitorId]}
                  modes={bezelCfg?.modes}
                  currentMode={bezelCfg?.currentMode}
                  onModeChange={bezelCfg?.onModeChange}
                >
                  {renderScreen(monitorId)}
                </UnifiedBezel>
              </div>
              {!rightCollapsed && (
                <ChannelButtons slotIndex={slotIndex} side="right" monitors={RIGHT_SIDEBAR_MONITORS} />
              )}
            </div>
          );
        })}
        <button
          className="sidebar-toggle"
          onClick={toggleRight}
          title={rightCollapsed ? 'Sidebar einblenden' : 'Sidebar ausblenden'}
        >
          {rightCollapsed ? '\u25C0' : '\u25B6'}
        </button>
      </div>
    </div>
  );
}
