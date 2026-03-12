import { useState, useCallback } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { RadarCanvas } from './RadarCanvas';

type NavMode = 'slow' | 'jump';

function useNavMode(): [NavMode, (m: NavMode) => void] {
  const [mode, setModeState] = useState<NavMode>(
    () => (localStorage.getItem('vs_mobile_nav_mode') as NavMode) ?? 'jump',
  );

  const setMode = (m: NavMode) => {
    localStorage.setItem('vs_mobile_nav_mode', m);
    setModeState(m);
  };

  return [mode, setMode];
}

export function MobileNavTab() {
  const [navMode, setNavMode] = useNavMode();
  const bookmarks = useStore((s) => s.bookmarks);
  const slowFlightActive = useStore((s) => s.slowFlightActive);
  const autopilot = useStore((s) => s.autopilot);

  const handleSectorTap = useCallback(
    (x: number, y: number) => {
      if (navMode === 'slow') {
        network.sendSlowFlight(x, y);
      } else {
        network.sendJump(x, y);
      }
    },
    [navMode],
  );

  const handleBookmarkGo = (sectorX: number, sectorY: number) => {
    if (navMode === 'slow') {
      network.sendSlowFlight(sectorX, sectorY);
    } else {
      network.sendJump(sectorX, sectorY);
    }
  };

  return (
    <div className="mobile-nav-tab">
      {/* Mode toggle */}
      <div className="mobile-nav-mode-toggle">
        <button
          className={`mobile-nav-mode-btn${navMode === 'slow' ? ' active' : ''}`}
          onClick={() => setNavMode('slow')}
        >
          SLOW
        </button>
        <button
          className={`mobile-nav-mode-btn${navMode === 'jump' ? ' active' : ''}`}
          onClick={() => setNavMode('jump')}
        >
          JUMP
        </button>
      </div>

      {/* Radar */}
      <div className="mobile-nav-radar">
        <RadarCanvas onSectorTap={handleSectorTap} />
      </div>

      {/* Slow flight progress */}
      {slowFlightActive && autopilot?.active && (
        <div className="mobile-nav-flight-progress">
          <span>
            ({autopilot.targetX}/{autopilot.targetY}) · {autopilot.remaining} Sektoren
          </span>
          <button
            className="mobile-card-stop-btn"
            onClick={() => network.sendCancelAutopilot()}
          >
            STOP
          </button>
        </div>
      )}

      {/* Bookmarks */}
      {bookmarks && bookmarks.length > 0 && (
        <div className="mobile-nav-bookmarks">
          <div className="mobile-nav-bookmarks-header">BOOKMARKS</div>
          {bookmarks.map((bm) => (
            <div key={bm.slot} className="mobile-nav-bookmark-row">
              <span className="mobile-nav-bookmark-label">
                {bm.label} ({bm.sectorX}/{bm.sectorY})
              </span>
              <button
                className="mobile-card-action-btn"
                onClick={() => handleBookmarkGo(bm.sectorX, bm.sectorY)}
                aria-label="→ GO"
              >
                → GO
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
