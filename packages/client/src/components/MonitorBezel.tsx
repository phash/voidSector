import { type ReactNode, useState } from 'react';
import { useStore } from '../state/store';
import { LegendOverlay } from './LegendOverlay';
import { BezelKnob } from './BezelKnob';
import '../styles/crt.css';

interface MonitorBezelProps {
  children: ReactNode;
  monitorId: string;
  statusLeds?: Array<{ label: string; active: boolean }>;
}

export function MonitorBezel({ children, monitorId, statusLeds = [] }: MonitorBezelProps) {
  const brightness = useStore((s) => s.brightness);
  const setBrightness = useStore((s) => s.setBrightness);
  const zoomLevel = useStore((s) => s.zoomLevel);
  const setZoomLevel = useStore((s) => s.setZoomLevel);
  const panOffset = useStore((s) => s.panOffset);
  const setPanOffset = useStore((s) => s.setPanOffset);
  const [showLegend, setShowLegend] = useState(false);

  return (
    <div className="bezel-frame">
      <div className="bezel-main">
        {/* Left side label + PAN knob */}
        <div className="bezel-side bezel-left">
          <span className="bezel-label-vertical">{monitorId}</span>
          <BezelKnob
            label="PAN"
            value={panOffset.y}
            min={-3}
            max={3}
            onChange={(v) => setPanOffset({ x: panOffset.x, y: v })}
          />
        </div>

        {/* CRT screen area */}
        <div className="crt-wrapper">
          <div className="crt-scanlines" />
          <div className="crt-flicker" />
          <div className="crt-vignette" />
          <div className="crt-content" style={{ filter: `brightness(${brightness})` }}>
            {children}
          </div>
        </div>

        {/* Right side controls (toggle switches, LEDs) + ZOOM knob */}
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
          <BezelKnob
            label="ZOOM"
            value={zoomLevel}
            min={0}
            max={3}
            onChange={(v) => setZoomLevel(Math.round(v))}
          />
        </div>
      </div>

      {/* Bottom bezel controls */}
      <div className="bezel-bottom">
        <BezelKnob
          label="BRIGHTNESS"
          value={brightness}
          min={0.5}
          max={1.5}
          onChange={setBrightness}
        />
        <button className="vs-btn" onClick={() => setShowLegend(true)}
          style={{ fontSize: '0.7rem', padding: '4px 8px', marginLeft: 'auto' }}>
          [?]
        </button>
      </div>
      {showLegend && <LegendOverlay onClose={() => setShowLegend(false)} />}
    </div>
  );
}
