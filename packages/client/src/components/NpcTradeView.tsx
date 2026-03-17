import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const RESOURCES = ['ore', 'gas', 'crystal'] as const;
const RES_COLORS: Record<string, string> = { ore: '#FFB000', gas: '#00BFFF', crystal: '#FF44FF' };

function ResourceTradeRow({
  resource,
  price,
  stock,
  action,
  npcId,
  playerCredits,
  playerStock,
}: {
  resource: string;
  price: number;
  stock: number;
  action: 'buy' | 'sell';
  npcId: number;
  playerCredits: number;
  playerStock: number;
}) {
  const [qty, setQty] = useState(1);
  const color = RES_COLORS[resource] ?? '#FFB000';
  const isBuy = action === 'buy';
  const maxQty = isBuy ? Math.min(stock, Math.floor(playerCredits / Math.max(1, price))) : playerStock;
  const totalCost = qty * price;
  const canTrade = price > 0 && qty > 0 && qty <= maxQty;
  const unavailable = isBuy ? stock <= 0 : false;

  useEffect(() => {
    if (qty > maxQty && maxQty > 0) setQty(maxQty);
  }, [maxQty]);

  if (unavailable) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', opacity: 0.3 }}>
        <span style={{ color }}>{resource.toUpperCase()}</span>
        <span style={{ color: '#444' }}>ausverkauft</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flexWrap: 'wrap' }}>
      <span style={{ color, width: 60, fontSize: '0.75rem' }}>{resource.toUpperCase()}</span>
      <span style={{ color: '#666', fontSize: '0.65rem', width: 30 }}>×{stock}</span>
      <span style={{ color: '#888', fontSize: '0.65rem', width: 55 }}>{price} CR/St</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          className="vs-btn"
          style={{ fontSize: '0.6rem', padding: '1px 5px' }}
          onClick={() => setQty(Math.max(1, qty - 1))}
          disabled={qty <= 1}
        >
          -
        </button>
        <span style={{ color: '#FFB000', width: 24, textAlign: 'center', fontSize: '0.75rem' }}>{qty}</span>
        <button
          className="vs-btn"
          style={{ fontSize: '0.6rem', padding: '1px 5px' }}
          onClick={() => setQty(Math.min(maxQty, qty + 1))}
          disabled={qty >= maxQty}
        >
          +
        </button>
      </div>
      <span style={{ color: '#555', fontSize: '0.6rem', width: 50 }}>= {totalCost} CR</span>
      <button
        className="vs-btn"
        style={{
          fontSize: '0.6rem',
          padding: '2px 8px',
          borderColor: isBuy ? '#00FF66' : '#FF6644',
          color: isBuy ? '#00FF66' : '#FF6644',
        }}
        disabled={!canTrade}
        onClick={() => {
          network.sendNpcShipTrade(npcId, resource, qty, action);
          // Refresh trade info after short delay
          setTimeout(() => network.sendGetNpcTradeInfo(npcId), 300);
        }}
      >
        {isBuy ? '[BUY]' : '[SELL]'}
      </button>
    </div>
  );
}

export function NpcTradeView() {
  const npcTradeOpen = useStore((s) => s.npcTradeOpen);
  const npcTradeInfo = useStore((s) => s.npcTradeInfo);
  const credits = useStore((s) => s.credits);
  const cargo = useStore((s) => s.cargo);

  useEffect(() => {
    if (npcTradeOpen) {
      network.sendGetNpcTradeInfo(npcTradeOpen.npcId);
    }
  }, [npcTradeOpen?.npcId]);

  function handleClose() {
    useStore.setState({ npcTradeOpen: null, npcTradeInfo: null });
  }

  if (!npcTradeOpen || !npcTradeInfo) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#0a0a0a', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#555' }}>LADE HANDELSDATEN...</span>
      </div>
    );
  }

  const { name, role, level, prices, artefacts } = npcTradeInfo;
  const roleColor = role === 'trader' ? '#00FF66' : '#FF3333';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#0a0a0a',
        fontFamily: 'var(--font-mono)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid #333',
          fontSize: '0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          <span style={{ color: roleColor, letterSpacing: '0.15em' }}>HANDEL</span>
          <span style={{ color: '#888', marginLeft: 8 }}>
            {name} [{role.toUpperCase()}]{level > 1 ? ` Lv.${level}` : ''}
          </span>
        </span>
        <span
          style={{ cursor: 'pointer', color: '#666' }}
          onClick={handleClose}
        >
          [ESC]
        </span>
      </div>

      {/* Trade content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {/* BUY section */}
        <div style={{ fontSize: '0.7rem', color: '#00FF66', letterSpacing: '0.1em', marginBottom: 6, borderBottom: '1px solid rgba(0,255,102,0.2)', paddingBottom: 3 }}>
          KAUFEN (vom NPC)
        </div>
        {RESOURCES.map((res) => (
          <ResourceTradeRow
            key={`buy-${res}`}
            resource={res}
            price={prices[res]?.buy ?? 0}
            stock={prices[res]?.stock ?? 0}
            action="buy"
            npcId={npcTradeOpen.npcId}
            playerCredits={credits}
            playerStock={0}
          />
        ))}

        {/* SELL section */}
        <div style={{ fontSize: '0.7rem', color: '#FF6644', letterSpacing: '0.1em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid rgba(255,102,68,0.2)', paddingBottom: 3 }}>
          VERKAUFEN (an NPC)
        </div>
        {RESOURCES.map((res) => (
          <ResourceTradeRow
            key={`sell-${res}`}
            resource={res}
            price={prices[res]?.sell ?? 0}
            stock={prices[res]?.stock ?? 0}
            action="sell"
            npcId={npcTradeOpen.npcId}
            playerCredits={credits}
            playerStock={cargo[res] ?? 0}
          />
        ))}

        {/* Artefacts (outlaws only) */}
        {artefacts && artefacts.length > 0 && (
          <>
            <div style={{ fontSize: '0.7rem', color: '#FFDD22', letterSpacing: '0.1em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid rgba(255,221,34,0.2)', paddingBottom: 3 }}>
              ARTEFAKTE
            </div>
            {artefacts.map((art: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                <span style={{ color: '#FFDD22', fontSize: '0.7rem' }}>{art.type.toUpperCase()} Artefakt</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: '0.65rem' }}>{art.price} CR</span>
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.6rem', padding: '2px 8px', borderColor: '#FFDD22', color: '#FFDD22' }}
                    disabled={credits < art.price}
                    onClick={() => {
                      network.sendNpcShipTrade(npcTradeOpen.npcId, `artefact_${art.type}`, 1, 'buy');
                      setTimeout(() => network.sendGetNpcTradeInfo(npcTradeOpen.npcId), 300);
                    }}
                  >
                    [KAUFEN]
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '6px 12px',
          borderTop: '1px solid #333',
          fontSize: '0.7rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#FFB000' }}>CR: {credits.toLocaleString()}</span>
        <span style={{ color: '#555' }}>
          NPC: ORE:{prices.ore?.stock ?? 0} GAS:{prices.gas?.stock ?? 0} CRY:{prices.crystal?.stock ?? 0}
        </span>
        <button
          className="vs-btn"
          style={{ fontSize: '0.65rem' }}
          onClick={handleClose}
        >
          [ZURÜCK]
        </button>
      </div>
    </div>
  );
}
