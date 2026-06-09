/**
 * OriginHubScreen — galactic notice board at the origin sector (0:0)
 *
 * Players can post short messages (max 280 chars) and read the last 50 notices
 * from all pilots. Posting is gated to sector 0:0 — both client-side (UX) and
 * server-side (enforcement). The screen shell is structured so additional tabs
 * (CQ turn-in, bounty board, exchange) can be added later.
 */

import React, { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

type Tab = 'PINNWAND' | 'GEMEINSCHAFT' | 'BOUNTY' | 'EXCHANGE';

const RESOURCE_LABELS: Record<string, string> = {
  ore: 'ERZ',
  gas: 'GAS',
  crystal: 'KRISTALL',
};

function exchangeItemLabel(itemId: string): string {
  if (itemId === 'ore') return 'ORZ';
  if (itemId === 'gas') return 'GAS';
  if (itemId === 'crystal') return 'KRISTALL';
  return itemId.replace(/^blueprint_/, '');
}

function inputStyle(enabled: boolean): React.CSSProperties {
  return {
    width: 52,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--color-dim)',
    color: 'var(--color-primary)',
    fontFamily: 'monospace',
    fontSize: '0.62rem',
    padding: '2px 4px',
    outline: 'none',
    opacity: enabled ? 1 : 0.5,
  };
}

export function OriginHubScreen() {
  const position = useStore((s) => s.position);
  const originNotices = useStore((s) => s.originNotices);
  const bounties = useStore((s) => s.bounties);
  const credits = useStore((s) => s.credits);
  const showTip = useStore((s) => s.showTip);
  const communityQuest = useStore((s) => s.activeCommunityQuest);
  const cargo = useStore((s) => s.cargo);
  const exchangeListings = useStore((s) => s.exchangeListings);
  const myTradeableItems = useStore((s) => s.myTradeableItems);
  const ownPlayerId = useStore((s) => s.playerId);

  const atOrigin = position.x === 0 && position.y === 0;

  const [text, setText] = useState('');
  const [tab, setTab] = useState<Tab>('PINNWAND');

  // Contribution state
  const [selectedResource, setSelectedResource] = useState<'ore' | 'gas' | 'crystal'>('ore');
  const [amount, setAmount] = useState(10);

  // Bounty form state
  const [bountyType, setBountyType] = useState<'pirate_defeat' | 'reach_sector'>('pirate_defeat');
  const [bountyQx, setBountyQx] = useState(0);
  const [bountyQy, setBountyQy] = useState(0);
  const [bountySectorX, setBountySectorX] = useState(0);
  const [bountySectorY, setBountySectorY] = useState(0);
  const [bountyReward, setBountyReward] = useState(100);

  // Exchange form state
  const [selectedExchangeIdx, setSelectedExchangeIdx] = useState<number | null>(null);
  const [exchangeQty, setExchangeQty] = useState(1);
  const [exchangePrice, setExchangePrice] = useState(100);

  useEffect(() => {
    showTip('first_originhub');
    if (atOrigin) network.requestOriginNotices();
  }, [atOrigin]);

  useEffect(() => {
    if (tab === 'GEMEINSCHAFT') {
      network.requestActiveCommunityQuest();
    }
    if (tab === 'BOUNTY') {
      network.requestBounties();
    }
    if (tab === 'EXCHANGE') {
      network.requestExchange();
    }
  }, [tab]);

  const tabs: Tab[] = ['PINNWAND', 'GEMEINSCHAFT', 'BOUNTY', 'EXCHANGE'];

  // Bounty form validation
  const bountyTargetValid =
    bountyType === 'pirate_defeat'
      ? Number.isInteger(bountyQx) && Number.isInteger(bountyQy)
      : Number.isInteger(bountySectorX) && Number.isInteger(bountySectorY);
  const bountyRewardValid = bountyReward >= 1 && bountyReward <= credits;
  const canPostBounty = atOrigin && bountyTargetValid && bountyRewardValid;

  const availableAmount = cargo[selectedResource] ?? 0;
  const canContribute = atOrigin && amount >= 1 && amount <= availableAmount;

  // Exchange computed
  const selectedExchangeItem =
    selectedExchangeIdx !== null ? myTradeableItems[selectedExchangeIdx] ?? null : null;
  const maxExchangeQty = selectedExchangeItem?.quantity ?? 0;
  const canListExchange =
    atOrigin &&
    selectedExchangeItem !== null &&
    exchangeQty >= 1 &&
    exchangeQty <= maxExchangeQty &&
    exchangePrice >= 1;

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

      {/* BOUNTY tab */}
      {tab === 'BOUNTY' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px' }}>
          {/* Bounty list */}
          <div
            style={{
              color: 'var(--color-dim)',
              fontSize: '0.6rem',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}
          >
            ── OFFENE KOPFGELDER ──
          </div>
          {bounties.filter((b) => b.status === 'open').length === 0 ? (
            <div
              style={{
                padding: '12px 0',
                color: 'var(--color-dim)',
                fontSize: '0.68rem',
                textAlign: 'center',
                letterSpacing: '0.06em',
              }}
            >
              Keine offenen Kopfgelder.
            </div>
          ) : (
            bounties
              .filter((b) => b.status === 'open')
              .map((b) => (
                <div
                  key={b.id}
                  style={{
                    borderBottom: '1px solid var(--color-dim)',
                    padding: '6px 4px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--color-primary)',
                        fontSize: '0.72rem',
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                      }}
                    >
                      {b.reward_credits.toLocaleString()} CR
                    </span>
                    <span
                      style={{
                        color: 'var(--color-dim)',
                        fontSize: '0.58rem',
                        fontFamily: 'monospace',
                      }}
                    >
                      von {b.poster_name}
                    </span>
                  </div>
                  <div
                    style={{
                      color: 'var(--color-dim)',
                      fontSize: '0.65rem',
                      fontFamily: 'monospace',
                      lineHeight: 1.4,
                    }}
                  >
                    {b.objective_type === 'pirate_defeat'
                      ? `Piraten in Quadrant ${b.objective_data?.qx ?? '?'}:${b.objective_data?.qy ?? '?'} besiegen`
                      : `Sektor ${b.objective_data?.sectorX ?? '?'}:${b.objective_data?.sectorY ?? '?'} erreichen`}
                  </div>
                  <div
                    style={{
                      color: 'var(--color-dim)',
                      fontSize: '0.58rem',
                      fontFamily: 'monospace',
                      marginTop: 2,
                      opacity: 0.7,
                    }}
                  >
                    läuft ab: {new Date(b.expires_at).toLocaleDateString()}
                  </div>
                </div>
              ))
          )}

          {/* Post bounty form */}
          <div
            style={{
              borderTop: '1px solid var(--color-dim)',
              paddingTop: 10,
              marginTop: 10,
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
              ── KOPFGELD AUSSETZEN ──
            </div>

            {!atOrigin && (
              <div
                style={{
                  color: 'var(--color-dim)',
                  fontSize: '0.62rem',
                  letterSpacing: '0.06em',
                  fontStyle: 'italic',
                  marginBottom: 8,
                }}
              >
                ⚠ Aussetzen nur am Zentrum (0:0)
              </div>
            )}

            {/* Objective type selector */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {(['pirate_defeat', 'reach_sector'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setBountyType(t)}
                  disabled={!atOrigin}
                  style={{
                    background:
                      bountyType === t ? 'rgba(255,170,0,0.12)' : 'transparent',
                    border:
                      bountyType === t
                        ? '1px solid var(--color-primary)'
                        : '1px solid var(--color-dim)',
                    color:
                      bountyType === t ? 'var(--color-primary)' : 'var(--color-dim)',
                    fontFamily: 'monospace',
                    fontSize: '0.58rem',
                    cursor: atOrigin ? 'pointer' : 'default',
                    padding: '2px 8px',
                    letterSpacing: '0.05em',
                    opacity: atOrigin ? 1 : 0.5,
                  }}
                >
                  {t === 'pirate_defeat' ? 'PIRATEN-KOPFGELD' : 'SEKTOR-ZIEL'}
                </button>
              ))}
            </div>

            {/* Target inputs */}
            {bountyType === 'pirate_defeat' ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>QUADRANT:</span>
                <input
                  type="number"
                  value={bountyQx}
                  disabled={!atOrigin}
                  onChange={(e) => setBountyQx(parseInt(e.target.value, 10))}
                  style={inputStyle(atOrigin)}
                  placeholder="QX"
                />
                <span style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>:</span>
                <input
                  type="number"
                  value={bountyQy}
                  disabled={!atOrigin}
                  onChange={(e) => setBountyQy(parseInt(e.target.value, 10))}
                  style={inputStyle(atOrigin)}
                  placeholder="QY"
                />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>SEKTOR:</span>
                <input
                  type="number"
                  value={bountySectorX}
                  disabled={!atOrigin}
                  onChange={(e) => setBountySectorX(parseInt(e.target.value, 10))}
                  style={inputStyle(atOrigin)}
                  placeholder="X"
                />
                <span style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>:</span>
                <input
                  type="number"
                  value={bountySectorY}
                  disabled={!atOrigin}
                  onChange={(e) => setBountySectorY(parseInt(e.target.value, 10))}
                  style={inputStyle(atOrigin)}
                  placeholder="Y"
                />
              </div>
            )}

            {/* Reward input */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>BELOHNUNG:</span>
              <input
                type="number"
                min={1}
                max={Math.min(1000000, credits)}
                value={bountyReward}
                disabled={!atOrigin}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1) setBountyReward(Math.min(v, Math.min(1000000, credits)));
                }}
                style={{ ...inputStyle(atOrigin), width: 80 }}
              />
              <span style={{ color: 'var(--color-dim)', fontSize: '0.58rem' }}>
                CR (max: {Math.min(1000000, credits).toLocaleString()})
              </span>
            </div>

            <button
              disabled={!canPostBounty}
              onClick={() => {
                if (!canPostBounty) return;
                const objectiveData =
                  bountyType === 'pirate_defeat'
                    ? { qx: bountyQx, qy: bountyQy }
                    : { sectorX: bountySectorX, sectorY: bountySectorY };
                network.postBounty(bountyType, objectiveData, bountyReward);
              }}
              style={{
                background: canPostBounty ? 'rgba(255,170,0,0.10)' : 'transparent',
                border: '1px solid var(--color-dim)',
                color: canPostBounty ? 'var(--color-primary)' : 'var(--color-dim)',
                fontFamily: 'monospace',
                fontSize: '0.65rem',
                cursor: canPostBounty ? 'pointer' : 'default',
                padding: '4px 16px',
                letterSpacing: '0.08em',
                fontWeight: 'bold',
                opacity: canPostBounty ? 1 : 0.5,
              }}
            >
              AUSSETZEN
            </button>
          </div>
        </div>
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
      {/* EXCHANGE tab */}
      {tab === 'EXCHANGE' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px' }}>
          {/* Listings */}
          <div
            style={{
              color: 'var(--color-dim)',
              fontSize: '0.6rem',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}
          >
            ── ANGEBOTE ──
          </div>

          {exchangeListings.filter((l) => l.status === 'open').length === 0 ? (
            <div
              style={{
                padding: '12px 0',
                color: 'var(--color-dim)',
                fontSize: '0.68rem',
                textAlign: 'center',
                letterSpacing: '0.06em',
              }}
            >
              Keine Angebote.
            </div>
          ) : (
            exchangeListings
              .filter((l) => l.status === 'open')
              .map((l) => {
                const isOwn = l.seller_id === ownPlayerId;
                return (
                  <div
                    key={l.id}
                    style={{
                      borderBottom: '1px solid var(--color-dim)',
                      padding: '6px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          color: 'var(--color-primary)',
                          fontSize: '0.72rem',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                        }}
                      >
                        {l.quantity}× {exchangeItemLabel(l.item_id)}
                      </span>
                      <span
                        style={{
                          color: 'var(--color-primary)',
                          fontSize: '0.68rem',
                          fontFamily: 'monospace',
                          marginLeft: 8,
                        }}
                      >
                        {l.price.toLocaleString()} CR
                      </span>
                      <span
                        style={{
                          color: 'var(--color-dim)',
                          fontSize: '0.58rem',
                          fontFamily: 'monospace',
                          marginLeft: 8,
                        }}
                      >
                        {isOwn ? '(deins)' : `von ${l.seller_name}`}
                      </span>
                    </div>
                    {isOwn ? (
                      <button
                        onClick={() => network.cancelExchange(l.id)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--color-dim)',
                          color: 'var(--color-dim)',
                          fontFamily: 'monospace',
                          fontSize: '0.58rem',
                          cursor: 'pointer',
                          padding: '2px 8px',
                          letterSpacing: '0.05em',
                          flexShrink: 0,
                        }}
                      >
                        ABBRECHEN
                      </button>
                    ) : (
                      <button
                        disabled={!atOrigin}
                        onClick={() => {
                          if (atOrigin) network.buyExchange(l.id);
                        }}
                        style={{
                          background: atOrigin ? 'rgba(255,170,0,0.08)' : 'transparent',
                          border: '1px solid var(--color-dim)',
                          color: atOrigin ? 'var(--color-primary)' : 'var(--color-dim)',
                          fontFamily: 'monospace',
                          fontSize: '0.58rem',
                          cursor: atOrigin ? 'pointer' : 'default',
                          padding: '2px 8px',
                          letterSpacing: '0.05em',
                          opacity: atOrigin ? 1 : 0.5,
                          flexShrink: 0,
                        }}
                      >
                        KAUFEN
                      </button>
                    )}
                  </div>
                );
              })
          )}

          {/* Sell form */}
          <div
            style={{
              borderTop: '1px solid var(--color-dim)',
              paddingTop: 10,
              marginTop: 10,
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
              ── WARE ANBIETEN ──
            </div>

            {!atOrigin && (
              <div
                style={{
                  color: 'var(--color-dim)',
                  fontSize: '0.62rem',
                  letterSpacing: '0.06em',
                  fontStyle: 'italic',
                  marginBottom: 8,
                }}
              >
                ⚠ Anbieten nur am Zentrum (0:0)
              </div>
            )}

            {myTradeableItems.length === 0 ? (
              <div
                style={{
                  color: 'var(--color-dim)',
                  fontSize: '0.65rem',
                  fontStyle: 'italic',
                  marginBottom: 8,
                }}
              >
                Keine handelbaren Waren im Lager.
              </div>
            ) : (
              <>
                {/* Item picker */}
                <div style={{ marginBottom: 8 }}>
                  <span
                    style={{ color: 'var(--color-dim)', fontSize: '0.6rem', marginRight: 6 }}
                  >
                    WARE:
                  </span>
                  <select
                    disabled={!atOrigin}
                    value={selectedExchangeIdx ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedExchangeIdx(v === '' ? null : parseInt(v, 10));
                      setExchangeQty(1);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--color-dim)',
                      color: 'var(--color-primary)',
                      fontFamily: 'monospace',
                      fontSize: '0.62rem',
                      padding: '2px 4px',
                      outline: 'none',
                      opacity: atOrigin ? 1 : 0.5,
                    }}
                  >
                    <option value="">-- wählen --</option>
                    {myTradeableItems.map((item, idx) => (
                      <option key={idx} value={idx}>
                        {exchangeItemLabel(item.item_id)} ×{item.quantity}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity + Price */}
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    marginBottom: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>MENGE:</span>
                    <input
                      type="number"
                      min={1}
                      max={maxExchangeQty}
                      value={exchangeQty}
                      disabled={!atOrigin || !selectedExchangeItem}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1)
                          setExchangeQty(Math.min(v, maxExchangeQty));
                      }}
                      style={{ ...inputStyle(atOrigin && selectedExchangeItem !== null), width: 56 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>PREIS (CR):</span>
                    <input
                      type="number"
                      min={1}
                      max={100000000}
                      value={exchangePrice}
                      disabled={!atOrigin || !selectedExchangeItem}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1)
                          setExchangePrice(Math.min(v, 100000000));
                      }}
                      style={{ ...inputStyle(atOrigin && selectedExchangeItem !== null), width: 80 }}
                    />
                  </div>
                </div>

                <button
                  disabled={!canListExchange}
                  onClick={() => {
                    if (!canListExchange || !selectedExchangeItem) return;
                    network.listExchange(
                      selectedExchangeItem.item_type,
                      selectedExchangeItem.item_id,
                      exchangeQty,
                      exchangePrice,
                    );
                    setSelectedExchangeIdx(null);
                    setExchangeQty(1);
                    setExchangePrice(100);
                  }}
                  style={{
                    background: canListExchange ? 'rgba(255,170,0,0.10)' : 'transparent',
                    border: '1px solid var(--color-dim)',
                    color: canListExchange ? 'var(--color-primary)' : 'var(--color-dim)',
                    fontFamily: 'monospace',
                    fontSize: '0.65rem',
                    cursor: canListExchange ? 'pointer' : 'default',
                    padding: '4px 16px',
                    letterSpacing: '0.08em',
                    fontWeight: 'bold',
                    opacity: canListExchange ? 1 : 0.5,
                  }}
                >
                  ANBIETEN
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
