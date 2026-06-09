/**
 * OriginHubScreen — galactic notice board at the origin sector (0:0)
 *
 * Players can post short messages (max 280 chars) and read the last 50 notices
 * from all pilots. Posting is gated to sector 0:0 — both client-side (UX) and
 * server-side (enforcement). The screen shell is structured so additional tabs
 * (CQ turn-in, bounty board, exchange) can be added later.
 */

import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

export function OriginHubScreen() {
  const position = useStore((s) => s.position);
  const originNotices = useStore((s) => s.originNotices);
  const showTip = useStore((s) => s.showTip);

  const atOrigin = position.x === 0 && position.y === 0;

  const [text, setText] = useState('');
  const [tab] = useState<'PINNWAND'>('PINNWAND');

  useEffect(() => {
    showTip('first_originhub');
    if (atOrigin) network.requestOriginNotices();
  }, [atOrigin]);

  const tabs: Array<'PINNWAND'> = ['PINNWAND'];

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
      {/* Header */}
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
          ◈ ORIGIN HUB
        </span>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {tabs.map((t) => (
            <span
              key={t}
              style={{
                fontSize: '0.62rem',
                color: tab === t ? 'var(--color-primary)' : 'var(--color-dim)',
                border: tab === t ? '1px solid var(--color-primary)' : '1px solid var(--color-dim)',
                padding: '1px 6px',
                letterSpacing: '0.06em',
                cursor: 'default',
              }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Help button */}
        <button
          onClick={() => showTip('first_originhub')}
          title="Hilfe"
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: '1px solid var(--color-dim)',
            color: 'var(--color-dim)',
            fontSize: '0.6rem',
            cursor: 'pointer',
            padding: '1px 6px',
            fontFamily: 'monospace',
          }}
        >
          ?
        </button>
      </div>

      {/* Not at origin — gating message */}
      {!atOrigin && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              color: 'var(--color-dim)',
              fontSize: '0.68rem',
              letterSpacing: '0.06em',
              lineHeight: 1.6,
            }}
          >
            ⚠ REISE ZUM ZENTRUM (SEKTOR 0:0),<br />
            UM DEN HUB ZU NUTZEN
          </span>
        </div>
      )}

      {/* PINNWAND tab — only when at origin */}
      {atOrigin && tab === 'PINNWAND' && (
        <>
          {/* Post box */}
          <div
            style={{
              padding: '6px 8px',
              borderBottom: '1px solid var(--color-dim)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <textarea
              maxLength={280}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nachricht an die Galaxis…"
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--color-dim)',
                color: 'var(--color-primary)',
                fontFamily: 'monospace',
                fontSize: '0.68rem',
                padding: '4px 6px',
                resize: 'none',
                outline: 'none',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <span style={{ color: 'var(--color-dim)', fontSize: '0.58rem' }}>
                {text.length}/280
              </span>
              <button
                disabled={text.trim() === ''}
                onClick={() => {
                  network.postOriginNotice(text.trim());
                  setText('');
                }}
                style={{
                  background: text.trim() === '' ? 'transparent' : 'rgba(255,170,0,0.08)',
                  border: '1px solid var(--color-dim)',
                  color: text.trim() === '' ? 'var(--color-dim)' : 'var(--color-primary)',
                  fontFamily: 'monospace',
                  fontSize: '0.62rem',
                  cursor: text.trim() === '' ? 'default' : 'pointer',
                  padding: '2px 10px',
                  letterSpacing: '0.06em',
                }}
              >
                POSTEN
              </button>
            </div>
          </div>

          {/* Notice list */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {originNotices.length === 0 ? (
              <div
                style={{
                  padding: 20,
                  color: 'var(--color-dim)',
                  fontSize: '0.68rem',
                  textAlign: 'center',
                }}
              >
                Noch keine Meldungen — sei der Erste.
              </div>
            ) : (
              originNotices.map((n) => (
                <div
                  key={n.id}
                  style={{
                    borderBottom: '1px solid var(--color-dim)',
                    padding: '6px 8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--color-primary)',
                        fontSize: '0.68rem',
                        fontFamily: 'monospace',
                      }}
                    >
                      ◈ {n.player_name}
                    </span>
                    <span
                      style={{
                        color: 'var(--color-dim)',
                        fontSize: '0.58rem',
                        fontFamily: 'monospace',
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    >
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{
                      color: 'var(--color-dim)',
                      fontSize: '0.65rem',
                      fontFamily: 'monospace',
                      lineHeight: 1.4,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {n.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
