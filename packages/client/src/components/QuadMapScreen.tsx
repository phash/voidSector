import { useCallback, useEffect, useState, useRef } from 'react';
import { useCanvas } from '../canvas/useCanvas';
import {
  drawQuadrantMap,
  quadrantAtPoint,
  sectorToQuadrantCoords,
  QUAD_CELL_SIZES,
} from '../canvas/QuadrantMapRenderer';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { COLOR_PROFILES } from '../styles/themes';
import { QUADRANT_NAME_MIN_LENGTH, QUADRANT_NAME_MAX_LENGTH } from '@void-sector/shared';
import { WarTicker } from './WarTicker';

// --- First-Contact Dialog ---

function FirstContactDialog() {
  const firstContactEvent = useStore((s) => s.firstContactEvent);
  const setFirstContactEvent = useStore((s) => s.setFirstContactEvent);
  const [name, setName] = useState('');
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!firstContactEvent) return;
    setName('');
    setCountdown(60);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Auto-name on timeout
          if (timerRef.current) clearInterval(timerRef.current);
          setFirstContactEvent(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [firstContactEvent, setFirstContactEvent]);

  if (!firstContactEvent) return null;

  const isValid =
    name.trim().length >= QUADRANT_NAME_MIN_LENGTH &&
    name.trim().length <= QUADRANT_NAME_MAX_LENGTH &&
    /^[a-zA-Z0-9 ]+$/.test(name.trim());

  const handleConfirm = () => {
    if (!isValid) return;
    const { qx, qy } = firstContactEvent.quadrant;
    network.sendNameQuadrant(qx, qy, name.trim());
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleSkip = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setFirstContactEvent(null);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          border: '2px solid var(--color-primary)',
          background: '#0a0a0a',
          padding: '16px 24px',
          maxWidth: 400,
          width: '90%',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          color: 'var(--color-primary)',
        }}
      >
        <div
          style={{
            fontSize: '1rem',
            letterSpacing: '0.2em',
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          FIRST CONTACT
        </div>

        <div style={{ marginBottom: 8, color: 'var(--color-dim)' }}>
          You have discovered a new quadrant at ({firstContactEvent.quadrant.qx},{' '}
          {firstContactEvent.quadrant.qy}).
        </div>

        <div style={{ marginBottom: 12, color: 'var(--color-dim)' }}>
          Auto-name:{' '}
          <span style={{ color: 'var(--color-primary)' }}>{firstContactEvent.autoName}</span>
        </div>

        <div style={{ marginBottom: 4, fontSize: '0.7rem', color: 'var(--color-dim)' }}>
          NAME THIS QUADRANT ({QUADRANT_NAME_MIN_LENGTH}-{QUADRANT_NAME_MAX_LENGTH} chars,
          alphanumeric + spaces)
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={QUADRANT_NAME_MAX_LENGTH}
          placeholder={firstContactEvent.autoName}
          style={{
            width: '100%',
            background: '#050505',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            padding: '6px 8px',
            marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />

        <div
          style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span
            style={{ fontSize: '0.7rem', color: countdown <= 10 ? '#FF3333' : 'var(--color-dim)' }}
          >
            {countdown}s
          </span>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSkip}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-dim)',
                color: 'var(--color-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              SKIP
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isValid}
              style={{
                background: isValid ? 'var(--color-primary)' : 'transparent',
                border: '1px solid var(--color-primary)',
                color: isValid ? '#000' : 'var(--color-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                padding: '4px 12px',
                cursor: isValid ? 'pointer' : 'default',
                opacity: isValid ? 1 : 0.5,
              }}
            >
              CONFIRM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Derive a stable HSL color for a player/faction based on their ID string. */
function playerColor(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 80%, 55%)`;
}

// --- QuadMapScreen ---

export function QuadMapScreen() {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [selectedQuadrant, setSelectedQuadrant] = useState<{ qx: number; qy: number } | null>(null);
  const knownQuadrants = useStore((s) => s.knownQuadrants);
  const position = useStore((s) => s.position);
  const currentQuadrant = sectorToQuadrantCoords(position.x, position.y);

  // Request known quadrants + territory data on mount
  useEffect(() => {
    network.requestKnownQuadrants();
    network.requestAllTerritories();
  }, []);

  // Update current quadrant in store
  useEffect(() => {
    useStore.getState().setCurrentQuadrant(currentQuadrant);
  }, [currentQuadrant.qx, currentQuadrant.qy]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const state = useStore.getState();
      const themeColors = COLOR_PROFILES[state.colorProfile];

      // Build faction territory color map
      const factionTerritoryColors = new Map<string, string>();
      for (const [key, claim] of Object.entries(state.territoryMap)) {
        factionTerritoryColors.set(key, playerColor(claim.playerId));
      }

      drawQuadrantMap(ctx, {
        knownQuadrants: state.knownQuadrants,
        currentQuadrant: sectorToQuadrantCoords(state.position.x, state.position.y),
        selectedQuadrant,
        themeColor: themeColors.primary,
        dimColor: themeColors.dim,
        zoomLevel,
        panOffset,
        animTime: performance.now(),
        factionTerritoryColors,
        quadrantControls: state.quadrantControls,
        npcFleets: state.npcFleets,
      });
    },
    [zoomLevel, panOffset, selectedQuadrant],
  );

  const canvasRef = useCanvas(draw);

  // Mousewheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoomLevel((prev) => {
        const next = e.deltaY < 0 ? Math.min(3, prev + 1) : Math.max(0, prev - 1);
        return next;
      });
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // Click to select quadrant + drag pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    let dragMoved = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let panStartX = 0;
    let panStartY = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panStartX = panOffset.x;
      panStartY = panOffset.y;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const movedX = Math.abs(e.clientX - dragStartX);
      const movedY = Math.abs(e.clientY - dragStartY);
      if (movedX > 5 || movedY > 5) dragMoved = true;
      const cellW = QUAD_CELL_SIZES[zoomLevel]?.w ?? 16;
      const cellH = QUAD_CELL_SIZES[zoomLevel]?.h ?? 16;
      const dx = Math.round((e.clientX - dragStartX) / cellW);
      const dy = Math.round((e.clientY - dragStartY) / cellH);
      setPanOffset({
        x: panStartX - dx,
        y: panStartY + dy,
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragMoved && dragging && canvas) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const result = quadrantAtPoint(rect.width, rect.height, clickX, clickY, {
          currentQuadrant,
          panOffset,
          zoomLevel,
        });
        if (result) {
          setSelectedQuadrant(result);
        }
      }
      dragging = false;
    };

    const onDblClick = () => {
      setPanOffset({ x: 0, y: 0 });
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('dblclick', onDblClick);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('dblclick', onDblClick);
    };
  }, [zoomLevel, panOffset, currentQuadrant]);

  // Find selected quadrant info
  const selectedInfo = selectedQuadrant
    ? knownQuadrants.find((q) => q.qx === selectedQuadrant.qx && q.qy === selectedQuadrant.qy) ?? null
    : null;
  const territoryMap = useStore((s) => s.territoryMap);
  const selectedTerritory = selectedQuadrant
    ? territoryMap[`${selectedQuadrant.qx}:${selectedQuadrant.qy}`] ?? null
    : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'var(--font-mono)',
        position: 'relative',
      }}
    >
      {/* Canvas area */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        <FirstContactDialog />
      </div>

      {/* Info panel */}
      <div
        style={{
          padding: '4px 8px',
          borderTop: '1px solid var(--color-dim)',
          fontSize: '0.7rem',
          color: 'var(--color-dim)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            QUADRANTS:{' '}
            <span style={{ color: 'var(--color-primary)' }}>{knownQuadrants.length}</span> KNOWN
            {' | '}
            CURRENT:{' '}
            <span style={{ color: 'var(--color-primary)' }}>
              ({currentQuadrant.qx}, {currentQuadrant.qy})
            </span>
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setZoomLevel((prev) => Math.max(0, prev - 1))}
              style={zoomBtnStyle}
              disabled={zoomLevel === 0}
            >
              -
            </button>
            <button
              onClick={() => setZoomLevel((prev) => Math.min(3, prev + 1))}
              style={zoomBtnStyle}
              disabled={zoomLevel === 3}
            >
              +
            </button>
            <button
              onClick={() => {
                setPanOffset({ x: 0, y: 0 });
                setSelectedQuadrant(null);
              }}
              style={zoomBtnStyle}
            >
              CENTER
            </button>
            <button
              onClick={() => network.requestSyncQuadrants()}
              style={zoomBtnStyle}
              title="Sync quadrant data at stations"
            >
              SYNC
            </button>
          </div>
        </div>

        {selectedQuadrant && (
          <div
            style={{ marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4 }}
          >
            <span>
              SELECTED: ({selectedQuadrant.qx}, {selectedQuadrant.qy})
              {selectedInfo?.name && (
                <span style={{ color: 'var(--color-primary)' }}> ★ {selectedInfo.name}</span>
              )}
              {selectedInfo ? (
                <>
                  <span>
                    {' '}| LEARNED:{' '}
                    <span style={{ color: 'var(--color-primary)' }}>
                      {new Date(selectedInfo.learnedAt).toLocaleDateString()}
                    </span>
                  </span>
                  {selectedInfo.discoveredByName && (
                    <span>
                      {' '}| FIRST CONTACT:{' '}
                      <span style={{ color: '#00FF88' }}>{selectedInfo.discoveredByName}</span>
                    </span>
                  )}
                  {selectedTerritory && (
                    <span>
                      {' '}| TERRITORY:{' '}
                      <span style={{ color: playerColor(selectedTerritory.playerId) }}>
                        {selectedTerritory.playerName}
                      </span>
                      {selectedTerritory.defenseRating === 'HIGH' && (
                        <span style={{ color: '#FF3333' }}> [HIGH DEF]</span>
                      )}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: '#FF3333' }}> | UNKNOWN</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Expansion warfare: war event ticker */}
      <WarTicker />
    </div>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-dim)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  padding: '1px 6px',
  cursor: 'pointer',
  letterSpacing: '0.05em',
};
