import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { QuadMapCanvas } from './QuadMapCanvas';
import { QUAD_SECTOR_SIZE } from '@void-sector/shared';

function coordsToQuadrant(x: number, y: number): { qx: number; qy: number } {
  return { qx: Math.floor(x / QUAD_SECTOR_SIZE), qy: Math.floor(y / QUAD_SECTOR_SIZE) };
}

export function QuadMapScreen() {
  const knownQuadrants = useStore((s) => s.knownQuadrants);
  const position = useStore((s) => s.position);
  const firstContact = useStore((s) => s.firstContactQuadrant);
  const { qx, qy } = coordsToQuadrant(position.x, position.y);
  const currentQuad = knownQuadrants.find(q => q.qx === qx && q.qy === qy);

  // Load quadrant data on mount
  useEffect(() => {
    network.requestKnownQuadrants();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 8 }}>
      {/* Header */}
      <div style={{
        fontSize: '0.65rem', letterSpacing: '0.2em', opacity: 0.7,
        borderBottom: '1px solid var(--color-dim)', paddingBottom: 6,
      }}>
        QUAD-MAP  ║  POS ({qx}, {qy})  ║  {knownQuadrants.length} KNOWN
      </div>

      {/* First-contact hint */}
      {firstContact && (
        <div style={{
          fontSize: '0.7rem', color: 'var(--color-primary)',
          border: '1px solid var(--color-primary)', padding: '6px 10px',
          letterSpacing: '0.1em',
        }}>
          ⚡ FIRST CONTACT — Quadrant ({firstContact.qx}, {firstContact.qy})
          <br />
          A naming dialog will appear. Check the screen.
        </div>
      )}

      {/* Canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <QuadMapCanvas />
      </div>

      {/* Current quadrant info */}
      {currentQuad && (
        <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', opacity: 0.8, lineHeight: 1.6 }}>
          <div>▶ {currentQuad.name ?? '—'}</div>
          {currentQuad.discoveredAt && (
            <div style={{ opacity: 0.5 }}>
              Discovered: {new Date(currentQuad.discoveredAt).toLocaleDateString()}
            </div>
          )}
          <div style={{ opacity: 0.5, marginTop: 4 }}>
            RES ×{currentQuad.config.resourceFactor.toFixed(2)}  ·
            STA ×{currentQuad.config.stationDensity.toFixed(2)}  ·
            PIR ×{currentQuad.config.pirateDensity.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}
