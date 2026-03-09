/**
 * NewsScreen — CRT-style news broadcast display (Issue #204)
 *
 * Displays recent server-wide events in a news ticker format:
 * - Quadrant discoveries (aggregated every 30 min)
 * - Alien first contact events
 * - Territory claims and decisive events
 *
 * Design: news-broadcast aesthetic, headline ticker, subtitle-style summaries.
 */

import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const EVENT_ICONS: Record<string, string> = {
  quadrant_discovery: '◈',
  alien_first_contact: '◉',
  territory_claimed: '⬡',
  territory_defeated: '⚠',
  permadeath: '✦',
  station_destroyed: '✗',
};

const EVENT_COLORS: Record<string, string> = {
  quadrant_discovery: 'var(--color-primary)',
  alien_first_contact: '#00ffaa',
  territory_claimed: '#ffaa00',
  territory_defeated: '#ff4444',
  permadeath: '#ff8800',
  station_destroyed: '#ff4444',
};

function formatRelativeTime(isoDate: string): string {
  const delta = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'SOEBEN';
  if (minutes < 60) return `VOR ${minutes}M`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `VOR ${hours}H`;
  return `VOR ${Math.floor(hours / 24)}T`;
}

function NewsItem({
  item,
  highlight,
}: {
  item: {
    id: number;
    event_type: string;
    headline: string;
    summary: string | null;
    player_name: string | null;
    quadrant_x: number | null;
    quadrant_y: number | null;
    created_at: string;
  };
  highlight: boolean;
}) {
  const icon = EVENT_ICONS[item.event_type] ?? '■';
  const color = EVENT_COLORS[item.event_type] ?? 'var(--color-primary)';

  return (
    <div
      style={{
        borderBottom: '1px solid var(--color-dim)',
        padding: '6px 8px',
        background: highlight ? 'rgba(255,170,0,0.05)' : 'transparent',
        transition: 'background 0.4s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ color, fontSize: '0.7rem', flexShrink: 0 }}>{icon}</span>
        <span
          style={{
            color: 'var(--color-primary)',
            fontSize: '0.72rem',
            fontFamily: 'monospace',
            flex: 1,
            lineHeight: 1.3,
          }}
        >
          {item.headline}
        </span>
        <span
          style={{
            color: 'var(--color-dim)',
            fontSize: '0.6rem',
            flexShrink: 0,
            fontFamily: 'monospace',
          }}
        >
          {formatRelativeTime(item.created_at)}
        </span>
      </div>
      {item.summary && (
        <div
          style={{
            color: 'var(--color-dim)',
            fontSize: '0.62rem',
            fontFamily: 'monospace',
            marginTop: 2,
            paddingLeft: 16,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.summary}
        </div>
      )}
      {item.quadrant_x !== null && item.quadrant_y !== null && (
        <div
          style={{
            color: 'var(--color-dim)',
            fontSize: '0.58rem',
            fontFamily: 'monospace',
            marginTop: 1,
            paddingLeft: 16,
          }}
        >
          Quadrant [{item.quadrant_x}:{item.quadrant_y}]
        </div>
      )}
    </div>
  );
}

export function NewsScreen() {
  const newsItems = useStore((s) => s.newsItems);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [newestId, setNewestId] = useState<number | null>(null);

  const refresh = () => {
    setLoading(true);
    network.requestNews();
    setTimeout(() => {
      setLoading(false);
      setLastRefresh(new Date());
    }, 800);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000); // auto-refresh every 60s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (newsItems.length > 0) {
      setNewestId(newsItems[0]?.id ?? null);
    }
  }, [newsItems]);

  const grouped: Record<string, (typeof newsItems)[0][]> = {};
  for (const item of newsItems) {
    const date = new Date(item.created_at).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'monospace',
        background: 'var(--color-bg, #0a0a0a)',
      }}
    >
      {/* Header / ticker bar */}
      <div
        style={{
          borderBottom: '2px solid var(--color-primary)',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,170,0,0.04)',
        }}
      >
        <span
          style={{
            color: 'var(--color-primary)',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            letterSpacing: '0.1em',
          }}
        >
          ◈ VOID SECTOR NEWS
        </span>
        <span
          style={{
            color: 'var(--color-dim)',
            fontSize: '0.58rem',
            marginLeft: 'auto',
          }}
        >
          {lastRefresh ? `AKTUALISIERT: ${lastRefresh.toLocaleTimeString('de-DE')}` : 'LADEN…'}
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            background: 'transparent',
            border: '1px solid var(--color-dim)',
            color: 'var(--color-dim)',
            fontSize: '0.6rem',
            cursor: 'pointer',
            padding: '2px 6px',
            fontFamily: 'monospace',
          }}
        >
          {loading ? '…' : '↺'}
        </button>
      </div>

      {/* Category filter hint */}
      <div
        style={{
          padding: '3px 8px',
          borderBottom: '1px solid var(--color-dim)',
          display: 'flex',
          gap: 10,
          fontSize: '0.58rem',
          color: 'var(--color-dim)',
        }}
      >
        <span>◈ ENTDECKUNG</span>
        <span style={{ color: '#00ffaa' }}>◉ ERSTKONTAKT</span>
        <span style={{ color: '#ffaa00' }}>⬡ TERRITORIUM</span>
        <span style={{ color: '#ff8800' }}>✦ EREIGNIS</span>
      </div>

      {/* News feed */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {newsItems.length === 0 ? (
          <div
            style={{
              padding: 20,
              color: 'var(--color-dim)',
              fontSize: '0.68rem',
              textAlign: 'center',
            }}
          >
            {loading ? 'EMPFANGE SIGNAL…' : 'KEINE NACHRICHTEN. TRANSMITTER INAKTIV.'}
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div
                style={{
                  padding: '3px 8px',
                  background: 'rgba(255,255,255,0.03)',
                  borderBottom: '1px solid var(--color-dim)',
                  fontSize: '0.58rem',
                  color: 'var(--color-dim)',
                  letterSpacing: '0.08em',
                }}
              >
                ── {date} ──
              </div>
              {items.map((item) => (
                <NewsItem key={item.id} item={item} highlight={item.id === newestId} />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid var(--color-dim)',
          padding: '3px 8px',
          fontSize: '0.58rem',
          color: 'var(--color-dim)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{newsItems.length} MELDUNGEN</span>
        <span>AUTO-REFRESH: 60S</span>
      </div>
    </div>
  );
}
