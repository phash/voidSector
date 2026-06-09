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

type Tab = 'PINNWAND' | 'GEMEINSCHAFT';

const RESOURCE_LABELS: Record<string, string> = {
  ore: 'ERZ',
  gas: 'GAS',
  crystal: 'KRISTALL',
};

export function OriginHubScreen() {
  const position = useStore((s) => s.position);
  const originNotices = useStore((s) => s.originNotices);
  const showTip = useStore((s) => s.showTip);
  const communityQuest = useStore((s) => s.activeCommunityQuest);
  const cargo = useStore((s) => s.cargo);

  const atOrigin = position.x === 0 && position.y === 0;

  const [text, setText] = useState('');
  const [tab, setTab] = useState<Tab>('PINNWAND');

  // Contribution state
  const [selectedResource, setSelectedResource] = useState<'ore' | 'gas' | 'crystal'>('ore');
  const [amount, setAmount] = useState(10);

  useEffect(() => {
    showTip('first_originhub');
    if (atOrigin) network.requestOriginNotices();
  }, [atOrigin]);

  useEffect(() => {
    if (tab === 'GEMEINSCHAFT') {
      network.requestActiveCommunityQuest();
    }
  }, [tab]);

  const tabs: Tab[] = ['PINNWAND', 'GEMEINSCHAFT'];

  const availableAmount = cargo[selectedResource] ?? 0;
  const canContribute = atOrigin && amount >= 1 && amount <= availableAmount;

  const progressPct =
    communityQuest && communityQuest.targetCount > 0
      ? Math.min(100, Math.round((communityQuest.currentCount / communityQuest.targetCount) * 100))
      : 0;

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
              onClick={() => setTab(t)}
              style={{
                fontSize: '0.62rem',
                color: tab === t ? 'var(--color-primary)' : 'var(--color-dim)',
                border: tab === t ? '1px solid var(--color-primary)' : '1px solid var(--color-dim)',
                padding: '1px 6px',
                letterSpacing: '0.06em',
                cursor: 'pointer',
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

      {/* PINNWAND tab */}
      {tab === 'PINNWAND' && (
        <>
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

          {/* PINNWAND content — only when at origin */}
          {atOrigin && (
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
        </>
      )}

      {/* GEMEINSCHAFT tab */}
      {tab === 'GEMEINSCHAFT' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px' }}>
          {!communityQuest ? (
            <div
              style={{
                padding: '20px 0',
                color: 'var(--color-dim)',
                fontSize: '0.68rem',
                textAlign: 'center',
                letterSpacing: '0.06em',
              }}
            >
              Derzeit kein Gemeinschaftsprojekt aktiv.
            </div>
          ) : (
            <>
              {/* Quest title + status */}
              <div
                style={{
                  borderBottom: '1px solid var(--color-dim)',
                  paddingBottom: 6,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    color: 'var(--color-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    letterSpacing: '0.08em',
                    marginBottom: 2,
                  }}
                >
                  ◈ {communityQuest.title}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--color-dim)',
                      fontSize: '0.58rem',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    STATUS: {communityQuest.status}
                  </span>
                  {communityQuest.expiresAt && (
                    <span
                      style={{
                        color: 'var(--color-dim)',
                        fontSize: '0.58rem',
                        letterSpacing: '0.06em',
                      }}
                    >
                      LÄUFT AB: {new Date(communityQuest.expiresAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {communityQuest.description && (
                <div
                  style={{
                    color: 'var(--color-dim)',
                    fontSize: '0.65rem',
                    lineHeight: 1.5,
                    marginBottom: 10,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {communityQuest.description}
                </div>
              )}

              {/* Progress bar */}
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      color: 'var(--color-dim)',
                      fontSize: '0.6rem',
                      letterSpacing: '0.06em',
                    }}
                  >
                    FORTSCHRITT
                  </span>
                  <span
                    style={{
                      color: 'var(--color-primary)',
                      fontSize: '0.6rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    {communityQuest.currentCount.toLocaleString()} / {communityQuest.targetCount.toLocaleString()} ({progressPct}%)
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--color-dim)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: `${progressPct}%`,
                      background: 'var(--color-primary)',
                      opacity: 0.7,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>

              {/* Reward hint */}
              {communityQuest.rewardType && (
                <div
                  style={{
                    color: 'var(--color-dim)',
                    fontSize: '0.62rem',
                    letterSpacing: '0.06em',
                    marginBottom: 10,
                  }}
                >
                  BELOHNUNG: <span style={{ color: 'var(--color-primary)' }}>{communityQuest.rewardType}</span>
                </div>
              )}

              {/* Divider */}
              <div
                style={{
                  borderTop: '1px solid var(--color-dim)',
                  paddingTop: 8,
                  marginTop: 4,
                }}
              >
                <div
                  style={{
                    color: 'var(--color-dim)',
                    fontSize: '0.6rem',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                  }}
                >
                  ── RESSOURCEN BEITRAGEN ──
                </div>

                {/* Off-origin hint */}
                {!atOrigin && (
                  <div
                    style={{
                      color: 'var(--color-dim)',
                      fontSize: '0.62rem',
                      letterSpacing: '0.06em',
                      marginBottom: 8,
                      fontStyle: 'italic',
                    }}
                  >
                    ⚠ Beitragen nur am Zentrum (0:0)
                  </div>
                )}

                {/* Resource selector */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {(['ore', 'gas', 'crystal'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedResource(r)}
                      disabled={!atOrigin}
                      style={{
                        background:
                          selectedResource === r
                            ? 'rgba(255,170,0,0.12)'
                            : 'transparent',
                        border:
                          selectedResource === r
                            ? '1px solid var(--color-primary)'
                            : '1px solid var(--color-dim)',
                        color:
                          selectedResource === r
                            ? 'var(--color-primary)'
                            : 'var(--color-dim)',
                        fontFamily: 'monospace',
                        fontSize: '0.6rem',
                        cursor: atOrigin ? 'pointer' : 'default',
                        padding: '2px 8px',
                        letterSpacing: '0.06em',
                        opacity: atOrigin ? 1 : 0.5,
                      }}
                    >
                      {RESOURCE_LABELS[r]}<br />
                      <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>{cargo[r] ?? 0}</span>
                    </button>
                  ))}
                </div>

                {/* Amount quick buttons */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-dim)', fontSize: '0.6rem', marginRight: 4 }}>
                    MENGE:
                  </span>
                  {[10, 50, 100].map((q) => (
                    <button
                      key={q}
                      onClick={() => setAmount(q)}
                      disabled={!atOrigin}
                      style={{
                        background:
                          amount === q ? 'rgba(255,170,0,0.08)' : 'transparent',
                        border:
                          amount === q ? '1px solid var(--color-primary)' : '1px solid var(--color-dim)',
                        color:
                          amount === q ? 'var(--color-primary)' : 'var(--color-dim)',
                        fontFamily: 'monospace',
                        fontSize: '0.6rem',
                        cursor: atOrigin ? 'pointer' : 'default',
                        padding: '2px 6px',
                        opacity: atOrigin ? 1 : 0.5,
                      }}
                    >
                      +{q}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={amount}
                    disabled={!atOrigin}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 1) setAmount(Math.min(v, 1000));
                    }}
                    style={{
                      width: 52,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--color-dim)',
                      color: 'var(--color-primary)',
                      fontFamily: 'monospace',
                      fontSize: '0.62rem',
                      padding: '2px 4px',
                      outline: 'none',
                      opacity: atOrigin ? 1 : 0.5,
                    }}
                  />
                </div>

                {/* Contribute button */}
                <button
                  disabled={!canContribute}
                  onClick={() => {
                    if (canContribute) {
                      network.contributeResourceCommunityQuest(selectedResource, amount);
                    }
                  }}
                  style={{
                    background: canContribute ? 'rgba(255,170,0,0.10)' : 'transparent',
                    border: '1px solid var(--color-dim)',
                    color: canContribute ? 'var(--color-primary)' : 'var(--color-dim)',
                    fontFamily: 'monospace',
                    fontSize: '0.65rem',
                    cursor: canContribute ? 'pointer' : 'default',
                    padding: '4px 16px',
                    letterSpacing: '0.08em',
                    fontWeight: 'bold',
                    opacity: canContribute ? 1 : 0.5,
                  }}
                >
                  BEITRAGEN
                </button>

                {/* Cargo validation hint */}
                {atOrigin && amount > availableAmount && (
                  <div
                    style={{
                      color: 'var(--color-dim)',
                      fontSize: '0.58rem',
                      marginTop: 4,
                      fontStyle: 'italic',
                    }}
                  >
                    Nicht genug {RESOURCE_LABELS[selectedResource]} im Frachtraum ({availableAmount} verfügbar).
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
