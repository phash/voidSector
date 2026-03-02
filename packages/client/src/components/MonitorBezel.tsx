import type { ReactNode } from 'react';
import '../styles/crt.css';

interface MonitorBezelProps {
  children: ReactNode;
  monitorId: string;
  statusLeds?: Array<{ label: string; active: boolean }>;
}

export function MonitorBezel({ children, monitorId, statusLeds = [] }: MonitorBezelProps) {
  return (
    <div className="bezel-frame">
      {/* Left side label (vertical) */}
      <div className="bezel-side bezel-left">
        <span className="bezel-label-vertical">{monitorId}</span>
      </div>

      {/* CRT screen area */}
      <div className="crt-wrapper">
        <div className="crt-scanlines" />
        <div className="crt-flicker" />
        <div className="crt-vignette" />
        <div className="crt-content">
          {children}
        </div>
      </div>

      {/* Right side controls (toggle switches, LEDs) */}
      <div className="bezel-side bezel-right">
        {statusLeds.map((led) => (
          <div key={led.label} className="bezel-led-group">
            <span className="bezel-led-label">{led.label}</span>
            <div className={`bezel-led ${led.active ? 'active' : ''}`} />
          </div>
        ))}
        <div className="bezel-toggle">
          <span className="bezel-led-label">ON/OFF</span>
          <div className="bezel-toggle-switch" />
        </div>
      </div>
    </div>
  );
}
