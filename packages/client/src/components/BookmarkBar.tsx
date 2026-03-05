import { useStore } from '../state/store';
import { network } from '../network/client';
import { innerCoord } from '@void-sector/shared';

export function BookmarkBar() {
  const bookmarks = useStore((s) => s.bookmarks);
  const position = useStore((s) => s.position);
  const setPanOffset = useStore((s) => s.setPanOffset);
  const setSelectedSector = useStore((s) => s.setSelectedSector);

  function jumpTo(x: number, y: number) {
    setPanOffset({ x: x - position.x, y: y - position.y });
    setSelectedSector({ x, y });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '4px',
        fontSize: '0.55rem',
        minWidth: 48,
      }}
    >
      <button
        className="vs-btn"
        style={{ fontSize: '0.55rem', padding: '2px 4px' }}
        onClick={() => jumpTo(0, 0)}
      >
        HOME
      </button>
      <button
        className="vs-btn"
        style={{ fontSize: '0.55rem', padding: '2px 4px' }}
        onClick={() => jumpTo(position.x, position.y)}
      >
        SHIP
      </button>
      {[1, 2, 3, 4, 5].map((slot) => {
        const bm = bookmarks.find((b) => b.slot === slot);
        return (
          <button
            key={slot}
            className="vs-btn"
            style={{ fontSize: '0.55rem', padding: '2px 4px', opacity: bm ? 1 : 0.3 }}
            onClick={() => bm && jumpTo(bm.sectorX, bm.sectorY)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (bm) network.sendClearBookmark(slot);
            }}
            disabled={!bm}
          >
            {bm
              ? `${slot}: ${bm.label || `(${innerCoord(bm.sectorX)},${innerCoord(bm.sectorY)})`}`
              : `${slot}: ---`}
          </button>
        );
      })}
    </div>
  );
}
