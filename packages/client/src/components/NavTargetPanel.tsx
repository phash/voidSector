import { useState, useCallback, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

/**
 * NavTargetPanel — coordinate input, bookmark selection, hyperjump toggle,
 * cost preview, ENGAGE button, progress bar, and CANCEL during autopilot.
 * CRT-styled amber-on-dark monospace panel.
 */
export function NavTargetPanel() {
  const position = useStore((s) => s.position);
  const bookmarks = useStore((s) => s.bookmarks);
  const autopilot = useStore((s) => s.autopilot);
  const autopilotStatus = useStore((s) => s.autopilotStatus);
  const navTarget = useStore((s) => s.navTarget);
  const fuel = useStore((s) => s.fuel);
  const ap = useStore((s) => s.ap);
  const selectedSector = useStore((s) => s.selectedSector);
  const discoveries = useStore((s) => s.discoveries);

  const [inputX, setInputX] = useState('');
  const [inputY, setInputY] = useState('');
  const [useHyperjump, setUseHyperjump] = useState(false);

  // Sync selected sector from radar click to inputs
  useEffect(() => {
    if (selectedSector && !autopilot?.active) {
      setInputX(String(selectedSector.x));
      setInputY(String(selectedSector.y));
      useStore.getState().setNavTarget({ x: selectedSector.x, y: selectedSector.y });
    }
  }, [selectedSector, autopilot?.active]);

  const targetX = parseInt(inputX, 10);
  const targetY = parseInt(inputY, 10);
  const hasValidTarget = !isNaN(targetX) && !isNaN(targetY) &&
    !(targetX === position.x && targetY === position.y);

  const distance = hasValidTarget
    ? Math.abs(targetX - position.x) + Math.abs(targetY - position.y)
    : 0;

  // Simple cost preview (client-side estimate)
  const estimatedAP = distance; // 1 AP per sector for normal mode
  const estimatedFuel = useHyperjump ? Math.ceil(distance * 0.5) : 0;
  const estimatedTimeSec = useHyperjump
    ? Math.ceil(distance / 3) * 2
    : distance * 3;

  const isTargetDiscovered = hasValidTarget &&
    discoveries[`${targetX}:${targetY}`] !== undefined;

  const canEngage = hasValidTarget && isTargetDiscovered && !autopilot?.active &&
    (ap?.current ?? 0) >= 1 &&
    (!useHyperjump || (fuel?.current ?? 0) >= 1);

  const handleSetTarget = useCallback(() => {
    if (!hasValidTarget) return;
    useStore.getState().setNavTarget({ x: targetX, y: targetY });
  }, [hasValidTarget, targetX, targetY]);

  const handleEngage = useCallback(() => {
    if (!canEngage) return;
    network.sendStartAutopilot(targetX, targetY, useHyperjump);
  }, [canEngage, targetX, targetY, useHyperjump]);

  const handleCancel = useCallback(() => {
    network.sendCancelAutopilot();
  }, []);

  const handleBookmarkSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    const [bx, by] = val.split(',').map(Number);
    setInputX(String(bx));
    setInputY(String(by));
    useStore.getState().setNavTarget({ x: bx, y: by });
  }, []);

  const isActive = autopilot?.active ?? false;
  const progress = autopilotStatus
    ? autopilotStatus.totalSteps > 0
      ? (autopilotStatus.currentStep / autopilotStatus.totalSteps) * 100
      : 0
    : 0;

  const isPaused = autopilotStatus?.status === 'paused';

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>NAV TARGET</div>

      {/* Active autopilot display */}
      {isActive && autopilotStatus && (
        <div style={activeBlockStyle}>
          <div style={{ color: '#FFB000', letterSpacing: '0.15em', marginBottom: 6, fontSize: '0.85rem' }}>
            AUTOPILOT AKTIV
          </div>
          <div style={{ fontSize: '0.8rem', marginBottom: 4 }}>
            Ziel: ({autopilotStatus.targetX}, {autopilotStatus.targetY})
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-dim)', marginBottom: 8 }}>
            Schritt {autopilotStatus.currentStep} / {autopilotStatus.totalSteps}
          </div>
          {/* Progress bar */}
          <div style={progressBarOuterStyle}>
            <div
              data-testid="autopilot-progress-bar"
              style={{
                ...progressBarInnerStyle,
                width: `${Math.min(100, progress)}%`,
              }}
            />
          </div>
          <button className="vs-btn" onClick={handleCancel} style={cancelBtnStyle}>
            [ABBRECHEN]
          </button>
        </div>
      )}

      {/* Paused autopilot display */}
      {isPaused && !isActive && (
        <div style={{ ...activeBlockStyle, borderColor: '#FF6644' }}>
          <div style={{ color: '#FF6644', letterSpacing: '0.15em', marginBottom: 6, fontSize: '0.85rem' }}>
            AUTOPILOT PAUSIERT
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-dim)', marginBottom: 4 }}>
            Grund: {autopilotStatus?.pauseReason ?? 'unknown'}
          </div>
        </div>
      )}

      {/* Coordinate input (hidden during active autopilot) */}
      {!isActive && (
        <>
          <div style={rowStyle}>
            <label style={labelStyle}>X:</label>
            <input
              type="number"
              value={inputX}
              onChange={(e) => {
                setInputX(e.target.value);
                const x = parseInt(e.target.value, 10);
                const y = parseInt(inputY, 10);
                if (!isNaN(x) && !isNaN(y)) {
                  useStore.getState().setNavTarget({ x, y });
                }
              }}
              style={inputStyle}
              aria-label="Target X"
              placeholder="0"
            />
            <label style={{ ...labelStyle, marginLeft: 8 }}>Y:</label>
            <input
              type="number"
              value={inputY}
              onChange={(e) => {
                setInputY(e.target.value);
                const x = parseInt(inputX, 10);
                const y = parseInt(e.target.value, 10);
                if (!isNaN(x) && !isNaN(y)) {
                  useStore.getState().setNavTarget({ x, y });
                }
              }}
              style={inputStyle}
              aria-label="Target Y"
              placeholder="0"
            />
            <button
              className="vs-btn"
              onClick={handleSetTarget}
              disabled={!hasValidTarget}
              style={{ fontSize: '0.7rem', marginLeft: 6 }}
              title="Set nav target"
            >
              SET
            </button>
          </div>

          {/* Bookmark dropdown */}
          {bookmarks.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>Bookmark: </label>
              <select
                onChange={handleBookmarkSelect}
                style={selectStyle}
                defaultValue=""
                aria-label="Select bookmark"
              >
                <option value="">-- Lesezeichen --</option>
                {bookmarks.map((bm) => (
                  <option key={bm.slot} value={`${bm.sectorX},${bm.sectorY}`}>
                    {bm.label || `(${bm.sectorX}, ${bm.sectorY})`} [Slot {bm.slot}]
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Hyperjump toggle */}
          <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ ...labelStyle, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useHyperjump}
                onChange={(e) => setUseHyperjump(e.target.checked)}
                style={{ marginRight: 4 }}
              />
              HYPERJUMP
            </label>
            {useHyperjump && (
              <span style={{ color: '#00CCFF', fontSize: '0.7rem' }}>
                Schneller, verbraucht Treibstoff
              </span>
            )}
          </div>

          {/* Cost preview */}
          {hasValidTarget && (
            <div style={costPreviewStyle}>
              <div style={{ marginBottom: 2 }}>Distanz: {distance} Sektoren</div>
              <div>AP: ~{estimatedAP} | Fuel: ~{estimatedFuel} | Zeit: ~{estimatedTimeSec}s</div>
              {!isTargetDiscovered && (
                <div style={{ color: '#FF3333', marginTop: 4 }}>
                  Ziel nicht entdeckt!
                </div>
              )}
            </div>
          )}

          {/* ENGAGE button */}
          <button
            className="vs-btn"
            onClick={handleEngage}
            disabled={!canEngage}
            style={{
              ...engageBtnStyle,
              opacity: canEngage ? 1 : 0.4,
            }}
          >
            [ENGAGE]
          </button>
        </>
      )}
    </div>
  );
}

// --- CRT-styled inline styles ---

const panelStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontFamily: '\'Share Tech Mono\', \'Courier New\', monospace',
  fontSize: '0.8rem',
  color: '#FFB000',
  background: 'rgba(0, 0, 0, 0.3)',
};

const headerStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  letterSpacing: '0.2em',
  borderBottom: '1px solid #FFB00044',
  paddingBottom: 4,
  marginBottom: 8,
  color: '#FFB000',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 6,
  gap: 4,
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#FFB000',
  letterSpacing: '0.1em',
};

const inputStyle: React.CSSProperties = {
  width: 60,
  background: '#0a0a0a',
  border: '1px solid #FFB00044',
  color: '#FFB000',
  fontFamily: '\'Share Tech Mono\', \'Courier New\', monospace',
  fontSize: '0.8rem',
  padding: '2px 4px',
  textAlign: 'center',
};

const selectStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #FFB00044',
  color: '#FFB000',
  fontFamily: '\'Share Tech Mono\', \'Courier New\', monospace',
  fontSize: '0.75rem',
  padding: '2px 4px',
  maxWidth: '100%',
};

const costPreviewStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--color-dim, #887744)',
  marginBottom: 8,
  padding: '4px 6px',
  border: '1px solid #FFB00022',
  background: '#0a0a0a',
};

const activeBlockStyle: React.CSSProperties = {
  marginBottom: 8,
  padding: '6px 8px',
  border: '1px solid #FFB00044',
  textAlign: 'center',
};

const progressBarOuterStyle: React.CSSProperties = {
  width: '100%',
  height: 8,
  background: '#1a1a1a',
  border: '1px solid #FFB00033',
  marginBottom: 8,
};

const progressBarInnerStyle: React.CSSProperties = {
  height: '100%',
  background: '#FFB000',
  transition: 'width 0.3s ease',
};

const engageBtnStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'center',
  letterSpacing: '0.2em',
  fontSize: '0.85rem',
  padding: '6px 12px',
};

const cancelBtnStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'center',
  borderColor: '#FF3333',
  color: '#FF3333',
};
