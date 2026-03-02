import { useStore } from '../state/store';
import { SIDEBAR_MONITORS } from '@void-sector/shared';

interface ChannelButtonsProps {
  slotIndex: 0 | 1;
}

const CHANNEL_LABELS: Record<string, string> = {
  'SHIP-SYS': 'SYS',
  'MINING': 'MIN',
  'CARGO': 'CRG',
  'COMMS': 'COM',
  'BASE-LINK': 'BAS',
};

export function ChannelButtons({ slotIndex }: ChannelButtonsProps) {
  const sidebarSlots = useStore((s) => s.sidebarSlots);
  const setSidebarSlot = useStore((s) => s.setSidebarSlot);
  const unreadComms = useStore((s) => s.unreadComms);
  const activeMonitor = sidebarSlots[slotIndex];

  return (
    <div className="channel-buttons">
      {SIDEBAR_MONITORS.map((id) => (
        <button
          key={id}
          className={`channel-btn ${activeMonitor === id ? 'active' : ''}`}
          onClick={() => {
            setSidebarSlot(slotIndex, id);
            if (id === 'COMMS') useStore.getState().setUnreadComms(false);
          }}
          title={id}
        >
          {CHANNEL_LABELS[id] || id.slice(0, 3)}
          {id === 'COMMS' && unreadComms && <span className="channel-dot" />}
        </button>
      ))}
    </div>
  );
}
