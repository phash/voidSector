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

/**
 * Per-sector consignment board (kontorEngine, #525 / SP6). Players post BUY
 * orders here (credits escrowed); other players at the same sector sell into them.
 */
export function KontorTab() {
  const kontorOrders = useStore((s) => s.kontorOrders);
  const cargo = useStore((s) => s.cargo);
  const playerId = useStore((s) => s.playerId);
  const showTip = useStore((s) => s.showTip);

  const [resource, setResource] = useState<(typeof RESOURCES)[number]>('ore');
  const [amount, setAmount] = useState(1);
  const [price, setPrice] = useState(1);

  useEffect(() => {
    network.requestKontorOrders();
    showTip('first_kontor');
  }, [showTip]);

  const buyOrders = kontorOrders.filter((o) => o.active && o.ownerId !== playerId);
  const myOrders = kontorOrders.filter((o) => o.active && o.ownerId === playerId);

  return (
    <div style={{ fontSize: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ letterSpacing: '0.1em', opacity: 0.7 }}>BÖRSE (Sektor-Aufträge)</span>
        <button className="vs-btn" style={{ fontSize: '0.65rem', padding: '0 6px' }} title="Hilfe" onClick={() => showTip('first_kontor')}>
          [?]
        </button>
      </div>

      {/* Place buy order */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, fontSize: '0.7rem' }}>
        <span>KAUFE</span>
        <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle, width: 50 }} />
        <select value={resource} onChange={(e) => setResource(e.target.value as (typeof RESOURCES)[number])} style={inputStyle}>
          {RESOURCES.map((r) => (
            <option key={r} value={r}>{r.toUpperCase()}</option>
          ))}
        </select>
        <span>@</span>
        <input type="number" min={1} value={price} onChange={(e) => setPrice(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle, width: 56 }} />
        <span>CR</span>
        <button className="vs-btn" style={{ fontSize: '0.65rem', padding: '2px 8px' }} onClick={() => network.sendKontorPlaceOrder(resource, amount, price)}>
          [AUFTRAG]
        </button>
      </div>

      {/* Buy orders from others — sell into them */}
      <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: 4, marginBottom: 6, opacity: 0.6 }}>KAUFGESUCHE HIER</div>
      {buyOrders.length === 0 ? (
        <div style={{ opacity: 0.4, fontSize: '0.7rem' }}>Keine Aufträge in diesem Sektor</div>
      ) : (
        buyOrders.map((o) => {
          const remaining = o.amountWanted - o.amountFilled;
          const have = (cargo as unknown as Record<string, number>)[o.itemId] ?? 0;
          const sellAmt = Math.min(remaining, have);
          return (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: '0.7rem', padding: '3px 0' }}>
              <span>
                {remaining}× {String(o.itemId).toUpperCase()} @ {o.pricePerUnit} CR
              </span>
              <button
                className="vs-btn"
                style={{ fontSize: '0.6rem', padding: '0 6px' }}
                disabled={sellAmt <= 0}
                onClick={() => network.sendKontorSellTo(o.id, sellAmt)}
              >
                [VERKAUFEN {sellAmt > 0 ? sellAmt : ''}]
              </button>
            </div>
          );
        })
      )}

      {/* My buy orders */}
      <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: 4, margin: '10px 0 6px', opacity: 0.6 }}>MEINE AUFTRÄGE</div>
      {myOrders.length === 0 ? (
        <div style={{ opacity: 0.4, fontSize: '0.7rem' }}>Keine eigenen Aufträge</div>
      ) : (
        myOrders.map((o) => (
          <div key={o.id} style={{ fontSize: '0.7rem', padding: '3px 0' }}>
            KAUFE {o.amountWanted - o.amountFilled}× {String(o.itemId).toUpperCase()} @ {o.pricePerUnit} CR
          </div>
        ))
      )}
    </div>
  );
}
