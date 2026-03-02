import type { ReactNode } from 'react';
import { SidebarBezel } from './SidebarBezel';
import { ChannelButtons } from './ChannelButtons';
import { useStore } from '../state/store';
import { LEFT_SIDEBAR_MONITORS, RIGHT_SIDEBAR_MONITORS } from '@void-sector/shared';

interface DesktopLayoutProps {
  gridArea: ReactNode;
  detailArea: ReactNode;
  controlsArea: ReactNode;
  renderScreen: (monitorId: string) => ReactNode;
}

export function DesktopLayout({ gridArea, detailArea, controlsArea, renderScreen }: DesktopLayoutProps) {
  const leftSlots = useStore((s) => s.leftSidebarSlots);
  const rightSlots = useStore((s) => s.sidebarSlots);
  const mainMode = useStore((s) => s.mainMonitorMode);
  const alerts = useStore((s) => s.alerts);

  return (
    <div className="desktop-layout-v2">
      {/* Left sidebar */}
      <div className="sidebar-stack sidebar-left">
        {([0, 1] as const).map((slotIndex) => (
          <div key={slotIndex} className="sidebar-slot">
            <ChannelButtons slotIndex={slotIndex} side="left" monitors={LEFT_SIDEBAR_MONITORS} />
            <div className="sidebar-slot-content">
              <SidebarBezel monitorId={leftSlots[slotIndex]} alert={!!alerts[leftSlots[slotIndex]]}>
                {renderScreen(leftSlots[slotIndex])}
              </SidebarBezel>
            </div>
          </div>
        ))}
      </div>

      {/* Main area */}
      <div className="main-area">
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
      <div className="sidebar-stack sidebar-right">
        {([0, 1] as const).map((slotIndex) => (
          <div key={slotIndex} className="sidebar-slot">
            <div className="sidebar-slot-content">
              <SidebarBezel monitorId={rightSlots[slotIndex]} alert={!!alerts[rightSlots[slotIndex]]}>
                {renderScreen(rightSlots[slotIndex])}
              </SidebarBezel>
            </div>
            <ChannelButtons slotIndex={slotIndex} side="right" monitors={RIGHT_SIDEBAR_MONITORS} />
          </div>
        ))}
      </div>
    </div>
  );
}
