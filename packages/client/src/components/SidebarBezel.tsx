import { useEffect, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { useMonitorLeds, LedDot } from './MonitorLeds';
import '../styles/crt.css';

interface SidebarBezelProps {
  children: ReactNode;
  monitorId: string;
  alert?: boolean;
}

export function SidebarBezel({ children, monitorId, alert }: SidebarBezelProps) {
  const brightness = useStore((s) => s.brightness);
  const leds = useMonitorLeds(monitorId);

  // Auto-clear alert when this monitor becomes visible in a sidebar
  useEffect(() => {
    if (useStore.getState().alerts[monitorId]) {
      useStore.getState().clearAlert(monitorId);
    }
  }, [monitorId]);

  return (
    <div className={`bezel-frame sidebar-bezel ${alert ? 'alert' : ''}`}>
      <div className="bezel-main">
        <div className="bezel-side bezel-left" style={{ minWidth: 20, padding: '4px 2px' }}>
          <span className="bezel-label-vertical" style={{ fontSize: '0.45rem' }}>{monitorId}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
            {leds.map((led) => (
              <LedDot key={led.label} led={led} />
            ))}
          </div>
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
