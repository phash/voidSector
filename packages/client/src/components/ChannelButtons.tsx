import { useStore } from '../state/store';
import { MAIN_ONLY_MONITORS } from '@void-sector/shared';
import type { MonitorId } from '@void-sector/shared';

interface ChannelButtonsProps {
  slotIndex: 0 | 1;
  side: 'left' | 'right';
  monitors: MonitorId[];
}

const CHANNEL_LABELS: Record<string, string> = {
  'LOG': 'LOG',
  'SHIP-SYS': 'SYS',
  'MINING': 'MIN',
  'CARGO': 'CRG',
  'COMMS': 'COM',
  'BASE-LINK': 'BAS',
};

export function ChannelButtons({ slotIndex, side, monitors }: ChannelButtonsProps) {
  const sidebarSlots = useStore((s) =>
    side === 'left' ? s.leftSidebarSlots : s.sidebarSlots
  );
  const setSidebarSlot = useStore((s) =>
    side === 'left' ? s.setLeftSidebarSlot : s.setSidebarSlot
  );
  const setMainMonitorMode = useStore((s) => s.setMainMonitorMode);
  const mainMode = useStore((s) => s.mainMonitorMode);
  const alerts = useStore((s) => s.alerts);
  const clearAlert = useStore((s) => s.clearAlert);
  const activeMonitor = sidebarSlots[slotIndex];

  return (
    <div className="channel-buttons">
      {monitors.map((id) => {
        const isMainOnly = MAIN_ONLY_MONITORS.has(id);
        const isActive = isMainOnly ? mainMode === id : activeMonitor === id;
        return (
          <button
            key={id}
            className={`channel-btn ${isActive ? 'active' : ''} ${alerts[id] && !isActive ? 'alert' : ''}`}
            onClick={() => {
              if (isMainOnly) {
                // Redirect large monitors to main area
                setMainMonitorMode(mainMode === id ? 'split' : id);
              } else {
                setSidebarSlot(slotIndex, id);
              }
              if (alerts[id]) clearAlert(id);
            }}
            title={isMainOnly ? `${id} (MAIN)` : id}
          >
            {CHANNEL_LABELS[id] || id.slice(0, 3)}
          </button>
        );
      })}
    </div>
  );
}
