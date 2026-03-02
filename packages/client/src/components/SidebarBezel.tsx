import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import '../styles/crt.css';

interface SidebarBezelProps {
  children: ReactNode;
  monitorId: string;
  alert?: boolean;
}

export function SidebarBezel({ children, monitorId, alert }: SidebarBezelProps) {
  const brightness = useStore((s) => s.brightness);

  return (
    <div className={`bezel-frame sidebar-bezel ${alert ? 'alert' : ''}`}>
      <div className="bezel-main">
        <div className="bezel-side bezel-left" style={{ minWidth: 20, padding: '4px 2px' }}>
          <span className="bezel-label-vertical" style={{ fontSize: '0.45rem' }}>{monitorId}</span>
        </div>
        <div className="crt-wrapper">
          <div className="crt-scanlines" />
          <div className="crt-vignette" />
          <div className="crt-content" style={{ filter: `brightness(${brightness})` }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
