import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD } from '@void-sector/shared';
import type { ResourceType, DataSlate } from '@void-sector/shared';

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  padding: '3px 8px',
  cursor: 'pointer',
};

export function TradeScreen() {
  const credits = useStore((s) => s.credits);
  const storage = useStore((s) => s.storage);
  const baseStructures = useStore((s) => s.baseStructures);
  const tradeOrders = useStore((s) => s.tradeOrders);
  const myOrders = useStore((s) => s.myOrders);
  const mySlates = useStore((s) => s.mySlates);
  const playerId = useStore((s) => s.player?.id);
  const [amount, setAmount] = useState(1);
  const [tab, setTab] = useState<'npc' | 'market' | 'slates'>('npc');

  const tradingPost = baseStructures.find((s: any) => s.type === 'trading_post');
  const tier = tradingPost?.tier ?? 0;

  useEffect(() => {
    network.requestCredits();
    network.requestStorage();
    if (tier >= 2) {
      network.requestTradeOrders();
      network.requestMyOrders();
      network.requestMySlates();
    }
  }, [tier]);

  if (!tradingPost) {
    return (
      <div style={{ padding: 16, textAlign: 'center', opacity: 0.4, fontSize: '0.8rem' }}>
        <div style={{ marginBottom: 8 }}>NO TRADING POST</div>
        <div style={{ fontSize: '0.7rem' }}>Build a Trading Post at your home base.</div>
      </div>
    );
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    ...btnStyle,
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#050505' : 'var(--color-primary)',
  });

  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 1.8, height: '100%', overflow: 'auto' }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: '8px', opacity: 0.6 }}>
        TRADE — T{tier} | {credits} CR
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button style={tabStyle(tab === 'npc')} onClick={() => setTab('npc')}>NPC HANDEL</button>
        {tier >= 2 && <button style={tabStyle(tab === 'market')} onClick={() => setTab('market')}>MARKT</button>}
        {tier >= 2 && <button style={tabStyle(tab === 'slates')} onClick={() => setTab('slates')}>[SLATES]</button>}
      </div>

      <div style={{ fontSize: '0.7rem', marginBottom: 8 }}>
        <label>MENGE: </label>
        <input
          type="number" min={1} value={amount}
          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
          style={{ width: 50, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', padding: '2px 4px' }}
        />
      </div>

      {tab === 'npc' && (
        <div>
          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px' }}>
            NPC PREISE (KAUF / VERKAUF)
          </div>
          {(['ore', 'gas', 'crystal'] as ResourceType[]).map((res) => {
            const buyPrice = Math.ceil(NPC_PRICES[res] * NPC_BUY_SPREAD * amount);
            const sellPrice = Math.floor(NPC_PRICES[res] * NPC_SELL_SPREAD * amount);
            return (
              <div key={res} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 60 }}>{res.toUpperCase()}</span>
                <button style={btnStyle} onClick={() => network.sendNpcTrade(res, amount, 'buy')}>
                  KAUFEN ({buyPrice} CR)
                </button>
                <button style={btnStyle} onClick={() => network.sendNpcTrade(res, amount, 'sell')}>
                  VERKAUFEN ({sellPrice} CR)
                </button>
              </div>
            );
          })}
          <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: 8 }}>
            LAGER: ERZ {storage.ore} | GAS {storage.gas} | KRISTALL {storage.crystal}
          </div>
        </div>
      )}

      {tab === 'market' && tier >= 2 && (
        <div>
          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px' }}>
            MARKT ORDERS
          </div>
          {tradeOrders.length === 0 ? (
            <div style={{ opacity: 0.4 }}>KEINE ORDERS</div>
          ) : (
            tradeOrders.map((o: any) => (
              <div key={o.id} style={{ fontSize: '0.7rem', marginBottom: 4 }}>
                [{o.type.toUpperCase()}] {o.amount}x {o.resource.toUpperCase()} @ {o.price_per_unit} CR — {o.player_name}
              </div>
            ))
          )}

          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px', marginTop: '12px' }}>
            MEINE ORDERS
          </div>
          {myOrders.length === 0 ? (
            <div style={{ opacity: 0.4 }}>KEINE EIGENEN ORDERS</div>
          ) : (
            myOrders.map((o: any) => (
              <div key={o.id} style={{ fontSize: '0.7rem', display: 'flex', gap: 8 }}>
                [{o.type}] {o.amount}x {o.resource} @ {o.price_per_unit}
                <button style={{ ...btnStyle, fontSize: '0.6rem' }} onClick={() => network.sendCancelOrder(o.id)}>X</button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'slates' && (
        <div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '8px' }}>SLATE MARKTPLATZ</div>

          {mySlates.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.8rem', marginBottom: '4px', opacity: 0.7 }}>MEINE SLATES:</div>
              {mySlates.map((slate: DataSlate) => (
                <div key={slate.id} style={{
                  display: 'flex',
                  gap: '4px',
                  alignItems: 'center',
                  marginBottom: '4px',
                  fontSize: '0.8rem',
                  flexWrap: 'wrap',
                }}>
                  <span style={{ opacity: 0.7 }}>
                    [{slate.slateType === 'sector' ? 'S' : 'A'}] {slate.sectorData.length} Sektoren
                  </span>
                  <input
                    type="number"
                    min="1"
                    placeholder="CR"
                    style={{ width: '60px' }}
                    className="vs-input"
                    id={`slate-price-${slate.id}`}
                  />
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    onClick={() => {
                      const input = document.getElementById(`slate-price-${slate.id}`) as HTMLInputElement;
                      const price = parseInt(input?.value || '0', 10);
                      if (price > 0) network.sendListSlate(slate.id, price);
                    }}
                  >
                    [LISTEN]
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: '0.8rem', marginBottom: '4px', opacity: 0.7 }}>ANGEBOTE:</div>
          {tradeOrders
            .filter((o: any) => o.resource === 'slate')
            .map((order: any) => (
              <div key={order.id} style={{
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                marginBottom: '4px',
                fontSize: '0.8rem',
              }}>
                <span>{order.playerName}: {order.pricePerUnit} CR</span>
                <button
                  className="vs-btn"
                  style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                  disabled={order.playerId === playerId}
                  onClick={() => network.sendAcceptSlateOrder(order.id)}
                >
                  [KAUFEN]
                </button>
              </div>
            ))}
          {tradeOrders.filter((o: any) => o.resource === 'slate').length === 0 && (
            <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Keine Angebote</div>
          )}
        </div>
      )}
    </div>
  );
}
