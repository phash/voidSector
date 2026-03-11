import { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { innerCoord } from '@void-sector/shared';
import type { TrackedQuest } from '../state/gameSlice';
import { UI } from '../ui-strings';

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

function TrackedQuestPanel({ quest, onClose }: { quest: TrackedQuest; onClose?: () => void }) {
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
        fontSize: '0.75rem',
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
          fontSize: '0.75rem',
        }}
      >
        [{quest.type.toUpperCase()}] {UI.status.TRACKED}
      </div>
      <div style={{ color: '#FFB000', marginBottom: 4 }}>{quest.title}</div>
      {quest.description && (
        <div style={{ color: 'rgba(255,176,0,0.75)', fontSize: '0.75rem', marginBottom: 4 }}>
          {quest.description}
        </div>
      )}
      {quest.targetX != null && quest.targetY != null && (
        <div style={{ color: 'rgba(255,176,0,0.6)', fontSize: '0.75rem' }}>
          {UI.status.TARGET}: ({innerCoord(quest.targetX)}, {innerCoord(quest.targetY)})
        </div>
      )}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            color: 'rgba(255,176,0,0.4)',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: '0.75rem',
            cursor: 'pointer',
            marginTop: 4,
            padding: 0,
          }}
        >
          [{UI.actions.CLOSE}]
        </button>
      )}
    </div>
  );
}

export function BookmarkBar() {
  const bookmarks = useStore((s) => s.bookmarks);
  const trackedQuests = useStore((s) => s.trackedQuests);
  const position = useStore((s) => s.position);
  const setPanOffset = useStore((s) => s.setPanOffset);
  const setSelectedSector = useStore((s) => s.setSelectedSector);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [questPanelSlot, setQuestPanelSlot] = useState<string | null>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, []);

  function jumpTo(x: number, y: number) {
    setPanOffset({ x: x - position.x, y: y - position.y });
    setSelectedSector({ x, y });
  }

  function showQuestPanel(id: string) {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setQuestPanelSlot(id);
  }

  function hideQuestPanel() {
    hideTimeout.current = setTimeout(() => setQuestPanelSlot(null), 150);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '4px',
        fontSize: '0.75rem',
        minWidth: 48,
      }}
    >
      <button
        className="vs-btn"
        style={{ fontSize: '0.75rem', padding: '2px 4px' }}
        onClick={() => jumpTo(0, 0)}
      >
        HOME
      </button>
      <button
        className="vs-btn"
        style={{ fontSize: '0.75rem', padding: '2px 4px' }}
        onClick={() => jumpTo(position.x, position.y)}
      >
        SHIP
      </button>
      {[1, 2, 3, 4, 5].map((slot) => {
        const bm = bookmarks.find((b) => b.slot === slot);
        const slotId = `bm-${slot}`;
        return (
          <div
            key={slot}
            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            onMouseEnter={() => setHoveredSlot(slotId)}
            onMouseLeave={() => setHoveredSlot(null)}
          >
            <button
              className="vs-btn"
              style={{
                fontSize: '0.75rem',
                padding: '2px 4px',
                opacity: bm ? 1 : 0.3,
                width: '100%',
                paddingRight: hoveredSlot === slotId && bm ? '18px' : '4px',
              }}
              onClick={() => bm && jumpTo(bm.sectorX, bm.sectorY)}
              disabled={!bm}
            >
              {bm
                ? `${slot}: ${bm.label || `(${innerCoord(bm.sectorX)},${innerCoord(bm.sectorY)})`}`
                : `${slot}: ---`}
            </button>
            {hoveredSlot === slotId && bm && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  network.sendClearBookmark(slot);
                }}
                style={{
                  position: 'absolute',
                  right: 0,
                  background: 'none',
                  border: 'none',
                  color: '#f44',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  padding: '0 2px',
                }}
              >
                [X]
              </button>
            )}
          </div>
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
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
            }}
          >
            {UI.status.TRACKED}
          </div>
          {trackedQuests.map((tq) => {
            const typeShort = QUEST_TYPE_SHORT[tq.type] ?? tq.type.slice(0, 3).toUpperCase();
            const slotId = `tq-${tq.questId}`;
            return (
              <div
                key={tq.questId}
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                onMouseEnter={() => {
                  setHoveredSlot(slotId);
                  showQuestPanel(tq.questId);
                }}
                onMouseLeave={() => {
                  setHoveredSlot(null);
                  hideQuestPanel();
                }}
              >
                <button
                  className="vs-btn"
                  onClick={() => {
                    if (tq.targetX != null && tq.targetY != null) {
                      jumpTo(tq.targetX, tq.targetY);
                    }
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 4px',
                    borderColor: '#4488FF',
                    color: '#4488FF',
                    width: '100%',
                    textAlign: 'left',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    paddingRight: hoveredSlot === slotId ? '18px' : '4px',
                  }}
                  title={tq.title}
                >
                  [{typeShort}] {tq.title}
                </button>
                {hoveredSlot === slotId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      network.sendTrackQuest(tq.questId, false);
                    }}
                    style={{
                      position: 'absolute',
                      right: 0,
                      background: 'none',
                      border: 'none',
                      color: '#f44',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      padding: '0 2px',
                    }}
                  >
                    [X]
                  </button>
                )}
                {questPanelSlot === tq.questId && <TrackedQuestPanel quest={tq} />}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
