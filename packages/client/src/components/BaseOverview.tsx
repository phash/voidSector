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
  const myStations = useStore((s) => s.myStations);
  const knownJumpGates = useStore((s) => s.knownJumpGates);
  const playerId = useStore((s) => s.playerId);
  const [bookmarkTarget, setBookmarkTarget] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    network.requestBase();
    network.requestStorage();
    network.requestCredits();
    network.requestMyStations();
  }, []);

  const hasAnything = constructionSites.length > 0 || myStations.length > 0 || knownJumpGates.length > 0;

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
        <div style={{ opacity: 0.4, marginBottom: 12 }}>KEINE STRUKTUREN GEBAUT</div>
        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>
          Navigiere zu einem Sektor und nutze [STATION BAUEN] oder [JUMPGATE BAUEN] im Detail-Panel.
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
        {baseName || 'STRUKTUREN'} — ÜBERSICHT
      </div>

      <div style={{ color: 'var(--color-dim)', marginBottom: 8 }}>
        CREDITS: <span style={{ color: 'var(--color-primary)' }}>{credits.toLocaleString()}</span>
      </div>

      {/* Player Stations */}
      {myStations.length > 0 && (
        <>
          <div style={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: '#00FF88', marginTop: 8, marginBottom: 4, borderBottom: '1px solid rgba(0,255,136,0.2)', paddingBottom: 2 }}>
            STATIONEN ({myStations.length})
          </div>
          {myStations.map((st) => (
            <div
              key={st.id}
              style={{
                padding: '4px 6px',
                marginBottom: 2,
                borderLeft: '2px solid #00FF88',
                background: 'rgba(0,255,136,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <span style={{ color: '#00FF88', marginRight: 4 }}>◆</span>
                  <span style={{ color: '#00FF88' }}>STATION LV.{st.level}</span>
                </span>
                <span style={{ fontSize: '0.5rem', color: 'var(--color-dim)' }}>
                  ({innerCoord(st.sector_x)}, {innerCoord(st.sector_y)})
                </span>
              </div>
              <div style={{ fontSize: '0.5rem', color: '#666', marginTop: 1 }}>
                FAB:{st.factory_level} · CARGO:{st.cargo_level}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Player Jumpgates */}
      {knownJumpGates.length > 0 && (
        <>
          <div style={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: '#00BFFF', marginTop: 8, marginBottom: 4, borderBottom: '1px solid rgba(0,191,255,0.2)', paddingBottom: 2 }}>
            JUMPGATES ({knownJumpGates.length})
          </div>
          {knownJumpGates.map((g) => (
            <div
              key={g.gateId}
              style={{
                padding: '4px 6px',
                marginBottom: 2,
                borderLeft: '2px solid #00BFFF',
                background: 'rgba(0,191,255,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <span style={{ color: '#00BFFF', marginRight: 4 }}>◎</span>
                  <span style={{ color: '#00BFFF' }}>{g.gateType?.toUpperCase() ?? 'GATE'}</span>
                </span>
                <span style={{ fontSize: '0.5rem', color: 'var(--color-dim)' }}>
                  ({innerCoord(g.fromX)}, {innerCoord(g.fromY)}) → ({innerCoord(g.toX)}, {innerCoord(g.toY)})
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Construction Sites */}
      {constructionSites.length > 0 && (
        <>
          <div style={{ fontSize: '0.55rem', letterSpacing: '0.1em', color: '#ffaa00', marginTop: 8, marginBottom: 4, borderBottom: '1px solid rgba(255,170,0,0.2)', paddingBottom: 2 }}>
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
