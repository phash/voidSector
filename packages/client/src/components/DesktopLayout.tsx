import type { ReactNode } from 'react';
import { SidebarBezel } from './SidebarBezel';
import { ChannelButtons } from './ChannelButtons';
import { useStore } from '../state/store';

interface DesktopLayoutProps {
  mainMonitor: ReactNode;
  renderScreen: (monitorId: string) => ReactNode;
}

export function DesktopLayout({ mainMonitor, renderScreen }: DesktopLayoutProps) {
  const sidebarSlots = useStore((s) => s.sidebarSlots);

  return (
    <div className="desktop-layout">
      <div className="main-monitor">
        {mainMonitor}
      </div>
      <div className="sidebar-stack">
        {([0, 1] as const).map((slotIndex) => (
          <div key={slotIndex} className="sidebar-slot">
            <div className="sidebar-slot-content">
              <SidebarBezel monitorId={sidebarSlots[slotIndex]}>
                {renderScreen(sidebarSlots[slotIndex])}
              </SidebarBezel>
            </div>
            <ChannelButtons slotIndex={slotIndex} />
          </div>
        ))}
      </div>
    </div>
  );
}
