import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const RESOURCES = ['ore', 'gas', 'crystal', 'artefact'] as const;

const inputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-dim)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  padding: '2px 4px',
};

/** Global player-to-player market (trade_orders) with escrow (#525 / SP6). */
export function MarketTab() {
  const tradeOrders = useStore((s) => s.tradeOrders);
  const myOrders = useStore((s) => s.myOrders);
  const playerId = useStore((s) => s.playerId);
  const showTip = useStore((s) => s.showTip);

  const [resource, setResource] = useState<(typeof RESOURCES)[number]>('ore');
  const [amount, setAmount] = useState(1);
  const [price, setPrice] = useState(1);
  const [type, setType] = useState<'buy' | 'sell'>('sell');

  useEffect(() => {
    network.requestTradeOrders();
    network.requestMyOrders();
    showTip('first_market');
  }, [showTip]);

  const othersOrders = tradeOrders.filter((o: any) => o.player_id !== playerId);

  return (
    <div style={{ fontSize: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ letterSpacing: '0.1em', opacity: 0.7 }}>MARKT (Spielerbörse)</span>
        <button className="vs-btn" style={{ fontSize: '0.65rem', padding: '0 6px' }} title="Hilfe" onClick={() => showTip('first_market')}>
          [?]
        </button>
      </div>

      {/* Place order form */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, fontSize: '0.7rem' }}>
        <select value={type} onChange={(e) => setType(e.target.value as 'buy' | 'sell')} style={inputStyle}>
          <option value="sell">VERKAUFEN</option>
          <option value="buy">KAUFEN</option>
        </select>
        <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle, width: 50 }} />
        <select value={resource} onChange={(e) => setResource(e.target.value as (typeof RESOURCES)[number])} style={inputStyle}>
          {RESOURCES.map((r) => (
            <option key={r} value={r}>{r.toUpperCase()}</option>
          ))}
        </select>
        <span>@</span>
        <input type="number" min={1} value={price} onChange={(e) => setPrice(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle, width: 56 }} />
        <span>CR</span>
        <button className="vs-btn" style={{ fontSize: '0.65rem', padding: '2px 8px' }} onClick={() => network.sendPlaceOrder(resource, amount, price, type)}>
          [PLATZIEREN]
        </button>
      </div>

      {/* Open orders from others */}
      <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: 4, marginBottom: 6, opacity: 0.6 }}>OFFENE ORDERS</div>
      {othersOrders.length === 0 ? (
        <div style={{ opacity: 0.4, fontSize: '0.7rem' }}>Keine Orders</div>
      ) : (
        othersOrders.map((o: any) => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: '0.7rem', padding: '3px 0' }}>
            <span>
              [{o.type === 'sell' ? 'V' : 'K'}] {o.amount}× {String(o.resource).toUpperCase()} @ {o.price_per_unit} CR — {o.player_name}
            </span>
            <button className="vs-btn" style={{ fontSize: '0.6rem', padding: '0 6px' }} onClick={() => network.sendFulfillOrder(o.id)}>
              [FÜLLEN]
            </button>
          </div>
        ))
      )}

      {/* My orders */}
      <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: 4, margin: '10px 0 6px', opacity: 0.6 }}>MEINE ORDERS</div>
      {myOrders.length === 0 ? (
        <div style={{ opacity: 0.4, fontSize: '0.7rem' }}>Keine Orders</div>
      ) : (
        myOrders.map((o: any) => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: '0.7rem', padding: '3px 0' }}>
            <span>
              [{o.type === 'sell' ? 'V' : 'K'}] {o.amount}× {String(o.resource).toUpperCase()} @ {o.price_per_unit} CR
            </span>
            <button className="vs-btn" style={{ fontSize: '0.6rem', padding: '0 6px', borderColor: '#FF4444', color: '#FF4444' }} onClick={() => network.sendCancelOrder(o.id)}>
              [X]
            </button>
          </div>
        ))
      )}
    </div>
  );
}
