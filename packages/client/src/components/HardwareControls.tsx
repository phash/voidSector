interface HardwareControlsProps {
  /** Show D-Pad (up/down/left/right) */
  dpad?: boolean;
  onDpad?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  /** Show zoom slider */
  zoom?: boolean;
  zoomValue?: number;
  onZoom?: (level: number) => void;
  zoomMin?: number;
  zoomMax?: number;
  /** Show power button */
  power?: boolean;
  powerOn?: boolean;
  onPower?: () => void;
  /** Show channel buttons */
  channels?: string[];
  activeChannel?: string;
  onChannel?: (channel: string) => void;
}

export function HardwareControls(props: HardwareControlsProps) {
  const {
    dpad, onDpad,
    zoom, zoomValue = 2, onZoom, zoomMin = 0, zoomMax = 4,
    power, powerOn, onPower,
    channels, activeChannel, onChannel,
  } = props;

  return (
    <div className="hw-controls" data-testid="hardware-controls">
      {dpad && (
        <div className="hw-dpad" data-testid="hw-dpad">
          <button className="hw-dpad-btn" data-testid="hw-dpad-up" onClick={() => onDpad?.('up')}>▲</button>
          <div className="hw-dpad-row">
            <button className="hw-dpad-btn" data-testid="hw-dpad-left" onClick={() => onDpad?.('left')}>◀</button>
            <button className="hw-dpad-btn" data-testid="hw-dpad-right" onClick={() => onDpad?.('right')}>▶</button>
          </div>
          <button className="hw-dpad-btn" data-testid="hw-dpad-down" onClick={() => onDpad?.('down')}>▼</button>
        </div>
      )}

      {zoom && (
        <div className="hw-zoom" data-testid="hw-zoom">
          <label className="hw-zoom-label">ZOOM</label>
          <input
            type="range"
            className="hw-slider"
            min={zoomMin}
            max={zoomMax}
            step={1}
            value={zoomValue}
            onChange={(e) => onZoom?.(parseInt(e.target.value))}
          />
        </div>
      )}

      {power && (
        <button
          className={`hw-power-btn${powerOn ? ' on' : ''}`}
          data-testid="hw-power"
          onClick={() => onPower?.()}
        >
          <span className={`hw-power-led${powerOn ? ' green' : ' orange'}`} />
          PWR
        </button>
      )}

      {channels && channels.length > 0 && (
        <div className="hw-channel-strip" data-testid="hw-channels">
          {channels.map((ch) => (
            <button
              key={ch}
              className={`hw-channel-btn${activeChannel === ch ? ' active' : ''}`}
              data-testid={`hw-channel-${ch}`}
              onClick={() => onChannel?.(ch)}
            >
              {ch.toUpperCase().slice(0, 4)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
