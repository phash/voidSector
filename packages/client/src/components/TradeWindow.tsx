import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULE_MAP } from '@void-sector/shared';
import type { InventoryItem } from '@void-sector/shared';

const TRADEABLE_TYPES = ['resource', 'module', 'data_slate', 'blueprint'];

function itemLabel(itemType: string, itemId: string): string {
  if (itemType === 'module') return MODULE_MAP.get(itemId)?.name ?? itemId;
  return itemId.toUpperCase().replace(/_/g, ' ');
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.92)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 210,
};

const boxStyle: React.CSSProperties = {
  border: '2px solid var(--color-primary)',
  background: '#040404',
  padding: '16px 20px',
  maxWidth: 560,
  width: '94%',
  maxHeight: '88vh',
  overflowY: 'auto',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-primary)',
  fontSize: '0.8rem',
};

/** P2P direct-trade negotiation window (#225 / SP3). */
export function TradeWindow() {
  const trade = useStore((s) => s.activeTrade);
  const playerId = useStore((s) => s.playerId);
  const inventory = useStore((s) => s.inventory);
  const showTip = useStore((s) => s.showTip);

  const [myOffer, setMyOffer] = useState<Record<string, number>>({});
  const [myCredits, setMyCredits] = useState(0);
  const tradeIdRef = useRef<string | null>(null);

  // Seed the local offer once per trade session, then surface the help tip.
  useEffect(() => {
    if (!trade) {
      tradeIdRef.current = null;
      return;
    }
    if (tradeIdRef.current !== trade.tradeId) {
      tradeIdRef.current = trade.tradeId;
      const meIsFrom = trade.fromPlayerId === playerId;
      const mine = meIsFrom ? trade.fromItems : trade.toItems;
      const map: Record<string, number> = {};
      mine.forEach((i) => {
        map[`${i.itemType}:${i.itemId}`] = i.quantity;
      });
      setMyOffer(map);
      setMyCredits(meIsFrom ? trade.fromCredits : trade.toCredits);
      showTip('first_p2p_trade');
    }
  }, [trade, playerId, showTip]);

  if (!trade) return null;

  const meIsFrom = trade.fromPlayerId === playerId;
  const theirItems = meIsFrom ? trade.toItems : trade.fromItems;
  const theirCredits = meIsFrom ? trade.toCredits : trade.fromCredits;
  const theirName = meIsFrom ? trade.toPlayerName : trade.fromPlayerName;
  const theirId = meIsFrom ? trade.toPlayerId : trade.fromPlayerId;
  const myConfirmed = trade.confirmedBy.includes(playerId ?? '');
  const theirConfirmed = trade.confirmedBy.includes(theirId);

  const tradeable = inventory.filter((i) => TRADEABLE_TYPES.includes(i.itemType));

  function pushOffer(offer: Record<string, number>, credits: number) {
    if (!trade) return;
    const items: InventoryItem[] = Object.entries(offer)
      .filter(([, q]) => q > 0)
      .map(([key, q]) => {
        const sep = key.indexOf(':');
        return {
          itemType: key.slice(0, sep) as InventoryItem['itemType'],
          itemId: key.slice(sep + 1),
          quantity: q,
        };
      });
    network.sendTradeOffer(trade.tradeId, items, credits);
  }

  function changeQty(key: string, qty: number) {
    const next = { ...myOffer, [key]: qty };
    setMyOffer(next);
    pushOffer(next, myCredits);
  }

  function changeCredits(value: number) {
    const credits = Math.max(0, Math.floor(value) || 0);
    setMyCredits(credits);
    pushOffer(myOffer, credits);
  }

  return (
    <div
      data-testid="trade-window"
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) network.sendTradeCancel(trade.tradeId);
      }}
    >
      <div style={boxStyle}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--color-dim)',
            paddingBottom: 8,
            marginBottom: 10,
          }}
        >
          <span style={{ letterSpacing: '0.12em' }}>DIREKTHANDEL — {theirName}</span>
          <button
            className="vs-btn"
            style={{ fontSize: '0.65rem', padding: '0 6px' }}
            title="Hilfe"
            onClick={() => showTip('first_p2p_trade')}
          >
            [?]
          </button>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {/* My offer (editable) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ opacity: 0.6, marginBottom: 6 }}>
              DEIN ANGEBOT {myConfirmed && <span style={{ color: '#00FF88' }}>✓</span>}
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {tradeable.length === 0 && (
                <div style={{ opacity: 0.4, fontSize: '0.7rem' }}>Nichts Handelbares im Cargo</div>
              )}
              {tradeable.map((item) => {
                const key = `${item.itemType}:${item.itemId}`;
                const offered = myOffer[key] ?? 0;
                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      padding: '3px 0',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {itemLabel(item.itemType, item.itemId)} ({item.quantity})
                    </span>
                    <button
                      className="vs-btn"
                      style={{ fontSize: '0.6rem', padding: '0 5px' }}
                      disabled={offered <= 0}
                      onClick={() => changeQty(key, Math.max(0, offered - 1))}
                    >
                      -
                    </button>
                    <span style={{ width: 22, textAlign: 'center', fontSize: '0.7rem' }}>{offered}</span>
                    <button
                      className="vs-btn"
                      style={{ fontSize: '0.6rem', padding: '0 5px' }}
                      disabled={offered >= item.quantity}
                      onClick={() => changeQty(key, Math.min(item.quantity, offered + 1))}
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 8, fontSize: '0.7rem' }}>
              <label>CR: </label>
              <input
                type="number"
                min={0}
                value={myCredits}
                onChange={(e) => changeCredits(parseInt(e.target.value))}
                style={{
                  width: 80,
                  background: 'transparent',
                  border: '1px solid var(--color-dim)',
                  color: 'var(--color-primary)',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 4px',
                }}
              />
            </div>
          </div>

          {/* Their offer (read-only) */}
          <div style={{ flex: 1, minWidth: 0, borderLeft: '1px solid var(--color-dim)', paddingLeft: 16 }}>
            <div style={{ opacity: 0.6, marginBottom: 6 }}>
              {theirName.toUpperCase()} BIETET {theirConfirmed && <span style={{ color: '#00FF88' }}>✓</span>}
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {theirItems.length === 0 && theirCredits === 0 && (
                <div style={{ opacity: 0.4, fontSize: '0.7rem' }}>— noch nichts —</div>
              )}
              {theirItems.map((item) => (
                <div key={`${item.itemType}:${item.itemId}`} style={{ fontSize: '0.7rem', padding: '3px 0' }}>
                  {itemLabel(item.itemType, item.itemId)} ×{item.quantity}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: '0.7rem' }}>CR: {theirCredits}</div>
          </div>
        </div>

        {/* Status line */}
        <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: 10 }}>
          {theirConfirmed && !myConfirmed
            ? `${theirName} hat bestätigt — wartet auf dich.`
            : myConfirmed && !theirConfirmed
              ? `Du hast bestätigt — wartet auf ${theirName}.`
              : 'Angebot ändern setzt Bestätigungen zurück. Beide müssen bestätigen.'}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            className="vs-btn"
            style={{ flex: 1, fontSize: '0.75rem', borderColor: '#00FF88', color: myConfirmed ? '#666' : '#00FF88' }}
            disabled={myConfirmed}
            onClick={() => network.sendTradeConfirm(trade.tradeId)}
          >
            {myConfirmed ? '[BESTÄTIGT]' : '[BESTÄTIGEN]'}
          </button>
          <button
            className="vs-btn"
            style={{ flex: 1, fontSize: '0.75rem', borderColor: '#FF4444', color: '#FF4444' }}
            onClick={() => network.sendTradeCancel(trade.tradeId)}
          >
            [ABBRECHEN]
          </button>
        </div>
      </div>
    </div>
  );
}
