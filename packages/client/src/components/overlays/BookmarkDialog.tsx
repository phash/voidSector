import { useState } from 'react';
import { useStore } from '../../state/store';
import { network } from '../../network/client';
import { innerCoord, QUADRANT_SIZE } from '@void-sector/shared';

function quadrantOf(abs: number): number {
  const half = Math.floor(QUADRANT_SIZE / 2);
  return Math.floor((abs + half) / QUADRANT_SIZE);
}

interface BookmarkDialogProps {
  sectorX: number;
  sectorY: number;
  onClose: () => void;
}

export function BookmarkDialog({ sectorX, sectorY, onClose }: BookmarkDialogProps) {
  const bookmarks = useStore((s) => s.bookmarks);
  const qx = quadrantOf(sectorX);
  const qy = quadrantOf(sectorY);
  const sx = innerCoord(sectorX);
  const sy = innerCoord(sectorY);
  const coordLabel = `Q${qx}:${qy} S${sx},${sy}`;

  const [name, setName] = useState(coordLabel);
  const [description, setDescription] = useState('');
  const freeSlot = [1, 2, 3, 4, 5].find((s) => !bookmarks.find((b) => b.slot === s));
  const [overwriteSlot, setOverwriteSlot] = useState<number | null>(null);
  const allFull = !freeSlot;

  const handleSave = (slot: number) => {
    network.sendSetBookmark(slot, sectorX, sectorY, name.trim() || coordLabel, description.trim());
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#080808',
          border: '1px solid var(--color-primary)',
          borderLeft: '4px solid var(--color-primary)',
          padding: '16px 20px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          maxWidth: '320px',
          width: '90%',
          animation: 'crt-expand 200ms ease-out',
        }}
      >
        <div style={{
          color: 'var(--color-primary)',
          letterSpacing: '0.2em',
          fontSize: '0.7rem',
          borderBottom: '1px solid rgba(255,176,0,0.2)',
          paddingBottom: '6px',
          marginBottom: '12px',
        }}>
          BOOKMARK SETZEN
        </div>

        {/* Name input */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem', marginBottom: '3px' }}>NAME</div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            style={{
              width: '100%',
              background: '#111',
              border: '1px solid rgba(255,176,0,0.3)',
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              padding: '4px 6px',
              boxSizing: 'border-box',
            }}
            autoFocus
          />
        </div>

        {/* Description input */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem', marginBottom: '3px' }}>BESCHREIBUNG</div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={80}
            placeholder="optional"
            style={{
              width: '100%',
              background: '#111',
              border: '1px solid rgba(255,176,0,0.3)',
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              padding: '4px 6px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Overwrite picker when all slots full */}
        {allFull && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ color: '#FF8800', fontSize: '0.6rem', marginBottom: '4px' }}>
              ALLE SLOTS BELEGT — ÜBERSCHREIBEN:
            </div>
            {bookmarks.map((bm) => (
              <button
                key={bm.slot}
                onClick={() => setOverwriteSlot(bm.slot)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: overwriteSlot === bm.slot ? 'rgba(255,176,0,0.1)' : 'transparent',
                  border: `1px solid ${overwriteSlot === bm.slot ? 'rgba(255,176,0,0.5)' : 'rgba(255,176,0,0.15)'}`,
                  color: 'var(--color-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  padding: '3px 6px',
                  marginBottom: '2px',
                  cursor: 'pointer',
                }}
              >
                {bm.slot}: {bm.label || `(${innerCoord(bm.sectorX)},${innerCoord(bm.sectorY)})`}
              </button>
            ))}
          </div>
        )}

        {/* Coordinates footer */}
        <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem', marginBottom: '10px' }}>
          {coordLabel}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleSave(allFull ? (overwriteSlot ?? bookmarks[0].slot) : freeSlot!)}
            disabled={allFull && !overwriteSlot}
            style={{
              flex: 1,
              border: '1px solid var(--color-primary)',
              background: 'none',
              color: allFull && !overwriteSlot ? '#666' : 'var(--color-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              cursor: allFull && !overwriteSlot ? 'not-allowed' : 'pointer',
              padding: '4px 12px',
            }}
          >
            [SPEICHERN]
          </button>
          <button
            onClick={onClose}
            style={{
              border: '1px solid rgba(255,176,0,0.3)',
              background: 'none',
              color: 'var(--color-dim)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              cursor: 'pointer',
              padding: '4px 12px',
            }}
          >
            [ABBRECHEN]
          </button>
        </div>
      </div>
    </div>
  );
}
