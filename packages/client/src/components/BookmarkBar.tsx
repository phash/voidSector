import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { innerCoord } from '@void-sector/shared';
import type { TrackedQuest } from '../state/gameSlice';

const QUEST_TYPE_SHORT: Record<string, string> = {
  fetch: 'LFR',
  scan: 'SCN',
  delivery: 'DEL',
  bounty: 'BNT',
  story: 'STR',
  community: 'COM',
  traders: 'TDR',
  scientists: 'SCI',
  pirates: 'PIR',
  ancients: 'ANC',
  diplomacy: 'DIP',
  war_support: 'WAR',
};

function TrackedQuestTooltip({ quest, onClose }: { quest: TrackedQuest; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '100%',
        top: 0,
        marginLeft: 4,
        background: '#0a0a0a',
        border: '1px solid rgba(0,120,255,0.5)',
        padding: '6px 8px',
        fontSize: '0.65rem',
        fontFamily: 'monospace',
        zIndex: 100,
        minWidth: 160,
        maxWidth: 240,
        color: '#FFB000',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        boxShadow: '0 0 8px rgba(0,80,200,0.3)',
      }}
    >
      <div
        style={{
          color: '#4488FF',
          marginBottom: 4,
          letterSpacing: '0.05em',
          fontSize: '0.6rem',
        }}
      >
        [{quest.type.toUpperCase()}] VERFOLGT
      </div>
      <div style={{ color: '#FFB000', marginBottom: 4 }}>{quest.title}</div>
      {quest.targetX != null && quest.targetY != null && (
        <div style={{ color: 'rgba(255,176,0,0.6)', fontSize: '0.6rem' }}>
          ZIEL: ({innerCoord(quest.targetX)}, {innerCoord(quest.targetY)})
        </div>
      )}
      <button
        onClick={onClose}
        style={{
          background: 'none',
          color: 'rgba(255,176,0,0.4)',
          border: 'none',
          fontFamily: 'inherit',
          fontSize: '0.6rem',
          cursor: 'pointer',
          marginTop: 4,
          padding: 0,
        }}
      >
        [SCHLIESSEN]
      </button>
    </div>
  );
}

export function BookmarkBar() {
  const bookmarks = useStore((s) => s.bookmarks);
  const trackedQuests = useStore((s) => s.trackedQuests);
  const position = useStore((s) => s.position);
  const setPanOffset = useStore((s) => s.setPanOffset);
  const setSelectedSector = useStore((s) => s.setSelectedSector);
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);

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

      {/* Tracked quests section */}
      {trackedQuests.length > 0 && (
        <>
          <div
            style={{
              borderTop: '1px solid rgba(0,100,200,0.3)',
              marginTop: 2,
              paddingTop: 4,
              color: 'rgba(68,136,255,0.7)',
              fontSize: '0.5rem',
              letterSpacing: '0.1em',
            }}
          >
            VERFOLGT
          </div>
          {trackedQuests.map((tq) => {
            const typeShort = QUEST_TYPE_SHORT[tq.type] ?? tq.type.slice(0, 3).toUpperCase();
            const isOpen = openTooltipId === tq.questId;
            return (
              <div key={tq.questId} style={{ position: 'relative' }}>
                <button
                  className="vs-btn"
                  onClick={() => setOpenTooltipId(isOpen ? null : tq.questId)}
                  style={{
                    fontSize: '0.5rem',
                    padding: '2px 4px',
                    borderColor: '#4488FF',
                    color: '#4488FF',
                    width: '100%',
                    textAlign: 'left',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                  title={tq.title}
                >
                  [{typeShort}] {tq.title}
                </button>
                {isOpen && (
                  <TrackedQuestTooltip
                    quest={tq}
                    onClose={() => setOpenTooltipId(null)}
                  />
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
