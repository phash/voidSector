import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { innerCoord } from '@void-sector/shared';
import { BookmarkDialog } from './overlays/BookmarkDialog';

const CONSTRUCTION_LABELS: Record<string, string> = {
  jumpgate: 'JUMPGATE',
  station: 'STATION',
  jumpgate_conn_2: 'GATE VERBINDUNG L2',
  jumpgate_conn_3: 'GATE VERBINDUNG L3',
  jumpgate_dist_2: 'GATE DISTANZ L2',
  jumpgate_dist_3: 'GATE DISTANZ L3',
};

export function BaseOverview() {
  const constructionSites = useStore((s) => s.constructionSites);
  const baseName = useStore((s) => s.baseName);
  const credits = useStore((s) => s.credits);
  const bookmarks = useStore((s) => s.bookmarks);
  const [bookmarkTarget, setBookmarkTarget] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    network.requestBase();
    network.requestStorage();
    network.requestCredits();
  }, []);

  const hasAnything = constructionSites.length > 0;

  if (!hasAnything) {
    return (
      <div
        style={{
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          lineHeight: 1.8,
        }}
      >
        <div style={{ letterSpacing: '0.2em', marginBottom: 4, opacity: 0.6 }}>
          BASE-LINK — NO SIGNAL
        </div>
        <div style={{ opacity: 0.4, marginBottom: 12 }}>NO BASE CONSTRUCTED</div>
        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>
          Navigate to a sector and use [BUILD BASE] to establish your home base.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '8px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        lineHeight: 1.6,
        height: '100%',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          letterSpacing: '0.15em',
          fontSize: '0.7rem',
          marginBottom: 4,
          borderBottom: '1px solid var(--color-dim)',
          paddingBottom: 2,
        }}
      >
        {baseName || 'HOME BASE'} — CONNECTED
      </div>

      <div style={{ color: 'var(--color-dim)', marginBottom: 8 }}>
        CREDITS: <span style={{ color: 'var(--color-primary)' }}>{credits.toLocaleString()}</span>
      </div>

      {/* Construction Sites */}
      {constructionSites.length > 0 && (
        <>
          <div
            style={{
              fontSize: '0.55rem',
              letterSpacing: '0.1em',
              color: 'var(--color-dim)',
              marginTop: 8,
              marginBottom: 4,
            }}
          >
            BAUSTELLEN ({constructionSites.length})
          </div>
          {constructionSites.map((cs) => {
            const dur = Math.max(1, cs.neededOre + cs.neededGas + cs.neededCrystal + cs.neededArtefact);
            const pct = Math.min(100, Math.round((cs.progress / dur) * 100));
            return (
              <div
                key={cs.id}
                style={{
                  padding: '4px 6px',
                  marginBottom: 2,
                  borderLeft: '2px solid #ffaa00',
                  background: 'rgba(255,170,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <span style={{ color: '#ffaa00', marginRight: 4 }}>[B]</span>
                    <span style={{ color: '#ffaa00' }}>
                      {CONSTRUCTION_LABELS[cs.type] ?? cs.type.toUpperCase()}
                    </span>
                  </span>
                  <span style={{ opacity: 0.6, fontSize: '0.55rem', color: cs.paused ? '#ff4444' : '#ffaa00' }}>
                    {cs.paused ? 'PAUSIERT' : `${pct}%`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.5rem', color: 'var(--color-dim)' }}>
                    ({innerCoord(cs.sectorX)}, {innerCoord(cs.sectorY)})
                  </span>
                  {!bookmarks.some((b) => b.sectorX === cs.sectorX && b.sectorY === cs.sectorY) && (
                    <button
                      onClick={() => setBookmarkTarget({ x: cs.sectorX, y: cs.sectorY })}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-dim)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.5rem',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      [BM]
                    </button>
                  )}
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', marginTop: 2 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#ffaa00' }} />
                </div>
              </div>
            );
          })}
        </>
      )}
      {bookmarkTarget && (
        <BookmarkDialog
          sectorX={bookmarkTarget.x}
          sectorY={bookmarkTarget.y}
          onClose={() => setBookmarkTarget(null)}
        />
      )}
    </div>
  );
}
