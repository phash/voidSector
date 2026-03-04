import { useStore } from '../state/store';
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
  const alerts = useStore((s) => s.alerts);
  const clearAlert = useStore((s) => s.clearAlert);
  const activeMonitor = sidebarSlots[slotIndex];

  return (
    <div className="channel-buttons">
      {monitors.map((id) => (
        <button
          key={id}
          className={`channel-btn ${activeMonitor === id ? 'active' : ''} ${alerts[id] && activeMonitor !== id ? 'alert' : ''}`}
          onClick={() => {
            setSidebarSlot(slotIndex, id);
            if (alerts[id]) clearAlert(id);
          }}
          title={id}
        >
          {CHANNEL_LABELS[id] || id.slice(0, 3)}
        </button>
      ))}
    </div>
  );
}
