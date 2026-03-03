import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { SECTOR_COLORS, FUEL_COST_PER_UNIT } from '@void-sector/shared';
import { network } from '../network/client';

export function DetailPanel() {
  const selectedSector = useStore((s) => s.selectedSector);
  const discoveries = useStore((s) => s.discoveries);
  const position = useStore((s) => s.position);
  const players = useStore((s) => s.players);
  const setSelectedSector = useStore((s) => s.setSelectedSector);

  const fuel = useStore((s) => s.fuel);

  const [autoFollow, setAutoFollow] = useState(false);

  useEffect(() => {
    if (autoFollow) {
      setSelectedSector({ x: position.x, y: position.y });
    }
  }, [autoFollow, position.x, position.y, setSelectedSector]);

  if (!selectedSector) {
    return (
      <div style={{ padding: 16, textAlign: 'center', opacity: 0.4, fontSize: '0.8rem' }}>
        <div style={{ marginBottom: 8 }}>SELECT A SECTOR</div>
        <div style={{ fontSize: '0.7rem' }}>CLICK ON THE GRID TO INSPECT</div>
      </div>
    );
  }

  const key = `${selectedSector.x}:${selectedSector.y}`;
  const sector = discoveries[key];
  const isPlayerHere = selectedSector.x === position.x && selectedSector.y === position.y;
  const isHome = selectedSector.x === 0 && selectedSector.y === 0;
  const playersHere = Object.values(players).filter(
    (p) => p.x === selectedSector.x && p.y === selectedSector.y
  );

  const sectorColor = sector
    ? (isHome
      ? SECTOR_COLORS.home_base
      : SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty)
    : 'var(--color-dim)';

  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 1.8, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ letterSpacing: '0.2em', color: sectorColor }}>
          SECTOR ({selectedSector.x}, {selectedSector.y})
        </div>
        <button
          onClick={() => setAutoFollow(!autoFollow)}
          style={{
            background: autoFollow ? 'rgba(255, 176, 0, 0.2)' : 'transparent',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            padding: '2px 8px',
            cursor: 'pointer',
            letterSpacing: '0.1em',
          }}
        >
          {autoFollow ? '\u25CF AUTO' : '\u25CB AUTO'}
        </button>
      </div>

      {sector ? (
        <>
          <div>TYPE ──── <span style={{ color: sectorColor }}>{sector.type.toUpperCase()}</span></div>
          {sector.resources && (
            <>
              <div style={{ marginTop: 8, letterSpacing: '0.15em', opacity: 0.6 }}>RESOURCES</div>
              {Object.entries(sector.resources).map(([res, amount]) => (
                <div key={res}>{res.toUpperCase()} ──── {amount}</div>
              ))}
            </>
          )}
          {isPlayerHere && (
            <div style={{ marginTop: 8, color: 'var(--color-primary)' }}>
              YOU ARE HERE
            </div>
          )}
          {isPlayerHere && sector?.type === 'station' && fuel && fuel.current < fuel.max && (
            <button
              onClick={() => network.sendRefuel(fuel.max - fuel.current)}
              style={{
                background: 'transparent',
                border: '1px solid #FFB000',
                color: '#FFB000',
                fontFamily: 'inherit',
                fontSize: '0.75em',
                padding: '4px 12px',
                cursor: 'pointer',
                marginTop: 8,
              }}
            >
              REFUEL ({Math.ceil((fuel.max - fuel.current) * FUEL_COST_PER_UNIT)} CR)
            </button>
          )}
          {playersHere.length > 0 && (
            <>
              <div style={{ marginTop: 8, letterSpacing: '0.15em', opacity: 0.6 }}>SHIPS IN SECTOR</div>
              {playersHere.map((p) => (
                <div key={p.sessionId}>{p.username}</div>
              ))}
            </>
          )}
        </>
      ) : (
        <div style={{ opacity: 0.4 }}>UNEXPLORED</div>
      )}
    </div>
  );
}
