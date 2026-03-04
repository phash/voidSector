import { type ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../state/store';
import { useMonitorLeds, LedDot } from './MonitorLeds';
import { CrtErrorBoundary } from './CrtErrorBoundary';
import '../styles/crt.css';

export interface UnifiedBezelProps {
  children: ReactNode;
  /** 'sidebar' = compact side panel, 'main' = primary CRT monitor */
  variant: 'sidebar' | 'main';
  /** Unique identifier for this monitor (e.g. 'NAV-COM', 'COMMS') */
  monitorId: string;
  /** Available modes for the mode switcher (e.g. ['direct','faction','sector']) */
  modes?: string[];
  /** Currently selected mode */
  currentMode?: string;
  /** Callback when mode changes via < > buttons */
  onModeChange?: (mode: string) => void;
  /** Show nav controls (auto-follow toggle, pan arrows) — main variant only */
  showNavControls?: boolean;
  /** Show zoom slider — main variant only */
  showZoomSlider?: boolean;
  /** Alert state: pulsing border */
  alert?: boolean;
}

/** CRT shutdown animation duration in ms */
const SHUTDOWN_DURATION = 400;

/**
 * UnifiedBezel — replaces both SidebarBezel and MonitorBezel with one
 * configurable CRT monitor component.
 *
 * Structure:
 *  - Top inner edge: Status LED + program label + chrome toggle button
 *  - Bottom inner edge: < | MODE | > mode switcher + power button (LED)
 *  - Main variant extras: zoom slider (bottom), pan arrows (left edge)
 *  - Chrome toggle: hides/shows inner top + bottom bars for max content area
 *  - Power off: CRT shutdown animation, monitor goes dark
 */
export function UnifiedBezel({
  children,
  variant,
  monitorId,
  modes,
  currentMode,
  onModeChange,
  showNavControls = false,
  showZoomSlider = false,
  alert = false,
}: UnifiedBezelProps) {
  const leds = useMonitorLeds(monitorId);
  const brightness = useStore((s) => s.brightness);

  // Power state from Zustand (defaults to true if not set)
  const powerOn = useStore((s) => s.monitorPower[monitorId] ?? true);
  const setMonitorPower = useStore((s) => s.setMonitorPower);

  // Chrome visibility from Zustand (defaults to true if not set)
  const chromeVisible = useStore((s) => s.monitorChromeVisible[monitorId] ?? true);
  const setMonitorChromeVisible = useStore((s) => s.setMonitorChromeVisible);

  // Main-variant zoom/pan state
  const zoomLevel = useStore((s) => s.zoomLevel);
  const setZoomLevel = useStore((s) => s.setZoomLevel);
  const panOffset = useStore((s) => s.panOffset);
  const setPanOffset = useStore((s) => s.setPanOffset);
  const autoFollow = useStore((s) => s.autoFollow);
  const setAutoFollow = useStore((s) => s.setAutoFollow);

  // Shutdown animation state
  const [shutdownActive, setShutdownActive] = useState(false);

  // Program-switch flicker tracking
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);
  const prevChildrenRef = useRef(children);

  useEffect(() => {
    if (prevChildrenRef.current !== children && !switchingRef.current) {
      switchingRef.current = true;
      setSwitching(true);
      const t = setTimeout(() => {
        setSwitching(false);
        switchingRef.current = false;
      }, 300);
      prevChildrenRef.current = children;
      return () => clearTimeout(t);
    }
  }, [children]);

  // Handle power toggle with CRT shutdown animation
  const handlePowerToggle = useCallback(() => {
    if (powerOn) {
      // Turning off: play shutdown animation then set power off
      setShutdownActive(true);
      setTimeout(() => {
        setMonitorPower(monitorId, false);
        setShutdownActive(false);
      }, SHUTDOWN_DURATION);
    } else {
      // Turning on
      setMonitorPower(monitorId, true);
    }
  }, [powerOn, monitorId, setMonitorPower]);

  const handleChromeToggle = useCallback(() => {
    setMonitorChromeVisible(monitorId, !chromeVisible);
  }, [monitorId, chromeVisible, setMonitorChromeVisible]);

  // Mode cycling
  const handleModeNext = useCallback(() => {
    if (!modes || !currentMode || !onModeChange) return;
    const idx = modes.indexOf(currentMode);
    const next = modes[(idx + 1) % modes.length];
    onModeChange(next);
  }, [modes, currentMode, onModeChange]);

  const handleModePrev = useCallback(() => {
    if (!modes || !currentMode || !onModeChange) return;
    const idx = modes.indexOf(currentMode);
    const prev = modes[(idx - 1 + modes.length) % modes.length];
    onModeChange(prev);
  }, [modes, currentMode, onModeChange]);

  // Pan arrow handlers (main variant only)
  const handlePan = useCallback((dx: number, dy: number) => {
    setPanOffset({ x: panOffset.x + dx, y: panOffset.y + dy });
  }, [panOffset, setPanOffset]);

  const isMain = variant === 'main';
  const hasModes = modes && modes.length > 1;

  // Power LED color: green when on, orange on standby
  const powerLedColor = powerOn ? '#00FF88' : '#FFB000';

  return (
    <div
      className={`unified-bezel unified-bezel-${variant}${alert ? ' unified-bezel-alert' : ''}`}
      data-testid={`unified-bezel-${monitorId}`}
    >
      {/* ── Top inner edge: LED + label + chrome toggle ── */}
      {chromeVisible && (
        <div className="unified-bezel-top" data-testid="unified-bezel-chrome-top">
          <div className="unified-bezel-top-left">
            {leds.map((led) => (
              <LedDot key={led.label} led={led} />
            ))}
          </div>
          <span className="unified-bezel-program-label">{monitorId}</span>
          <button
            className="unified-bezel-chrome-toggle"
            onClick={handleChromeToggle}
            aria-label="Toggle chrome"
            title="Hide chrome bars"
          >
            [_]
          </button>
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="unified-bezel-body">
        {/* Pan arrows — main variant, left edge */}
        {isMain && showNavControls && (
          <div className="unified-bezel-pan-arrows" data-testid="unified-bezel-pan-arrows">
            <button
              className="unified-bezel-pan-btn"
              onClick={() => handlePan(0, -2)}
              aria-label="Pan up"
            >^</button>
            <button
              className="unified-bezel-pan-btn"
              onClick={() => handlePan(-2, 0)}
              aria-label="Pan left"
            >&lt;</button>
            <button
              className="unified-bezel-pan-btn"
              onClick={() => handlePan(2, 0)}
              aria-label="Pan right"
            >&gt;</button>
            <button
              className="unified-bezel-pan-btn"
              onClick={() => handlePan(0, 2)}
              aria-label="Pan down"
            >v</button>
          </div>
        )}

        {/* CRT screen */}
        <div className="crt-wrapper">
          <div className="crt-scanlines" />
          {isMain && <div className="crt-flicker" />}
          {isMain && <div className="crt-glitch-bar" />}
          {isMain && <div className="crt-glitch-bar-2" />}
          <div className="crt-vignette" />
          <div
            className={`crt-content${switching ? ' crt-switch-flicker' : ''}`}
            style={{ filter: `brightness(${brightness})` }}
          >
            <CrtErrorBoundary monitorId={monitorId}>
              {children}
            </CrtErrorBoundary>
          </div>
          {/* Power-off overlay */}
          {(!powerOn || shutdownActive) && (
            <div
              className={`crt-monitor-off${shutdownActive ? ' unified-bezel-shutdown' : ''}`}
              data-testid="unified-bezel-off-screen"
            >
              <span className="crt-monitor-off-text">DISPLAY OFF</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom inner edge: mode switcher + power button ── */}
      {chromeVisible && (
        <div className="unified-bezel-bottom" data-testid="unified-bezel-chrome-bottom">
          {/* Mode switcher */}
          <div className="unified-bezel-mode-switcher">
            {hasModes ? (
              <>
                <button
                  className="unified-bezel-mode-btn"
                  onClick={handleModePrev}
                  aria-label="Previous mode"
                >&lt;</button>
                <span
                  className="unified-bezel-mode-label"
                  data-testid="unified-bezel-mode-label"
                >
                  {currentMode?.toUpperCase()}
                </span>
                <button
                  className="unified-bezel-mode-btn"
                  onClick={handleModeNext}
                  aria-label="Next mode"
                >&gt;</button>
              </>
            ) : (
              <span className="unified-bezel-mode-label unified-bezel-mode-single">
                {currentMode?.toUpperCase() ?? monitorId}
              </span>
            )}
          </div>

          {/* Nav controls: auto-follow toggle (main variant) */}
          {isMain && showNavControls && (
            <button
              className={`unified-bezel-auto-btn${autoFollow ? ' active' : ''}`}
              onClick={() => setAutoFollow(!autoFollow)}
              aria-label="Toggle auto-follow"
            >
              [{autoFollow ? 'AUTO' : 'MANUAL'}]
            </button>
          )}

          {/* Power button with LED indicator */}
          <div className="unified-bezel-power">
            <div
              className="unified-bezel-power-led"
              style={{
                backgroundColor: powerLedColor,
                boxShadow: `0 0 4px ${powerLedColor}`,
              }}
              data-testid="unified-bezel-power-led"
            />
            <button
              className={`bezel-power-btn${powerOn ? ' on' : ''}`}
              onClick={handlePowerToggle}
              aria-label="Monitor power"
              title={powerOn ? 'Power off' : 'Power on'}
            />
          </div>
        </div>
      )}

      {/* Chrome-hidden restore button — minimal bar when chrome is hidden */}
      {!chromeVisible && (
        <div className="unified-bezel-chrome-restore">
          <button
            className="unified-bezel-chrome-toggle"
            onClick={handleChromeToggle}
            aria-label="Toggle chrome"
            title="Show chrome bars"
          >
            [+]
          </button>
        </div>
      )}

      {/* ── Zoom slider — main variant, bottom ── */}
      {isMain && showZoomSlider && (
        <div className="unified-bezel-zoom" data-testid="unified-bezel-zoom">
          <span className="unified-bezel-zoom-label">ZOOM</span>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Math.round(parseFloat(e.target.value)))}
            className="unified-bezel-zoom-slider"
            aria-label="Zoom level"
          />
          <span className="unified-bezel-zoom-value">{zoomLevel}</span>
        </div>
      )}
    </div>
  );
}
