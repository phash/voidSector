import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD, MODULE_MAP } from '@void-sector/shared';

const RESOURCES = ['ore', 'gas', 'crystal'] as const;
const RES_COLORS: Record<string, string> = { ore: '#FFB000', gas: '#00BFFF', crystal: '#FF44FF' };

function TradeRow({
  label,
  buyPrice,
  sellPrice,
  stock,
  maxStock,
  playerAmount,
  onBuy,
  onSell,
}: {
  label: string;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  maxStock: number;
  playerAmount: number;
  onBuy: (qty: number) => void;
  onSell: (qty: number) => void;
}) {
  const [buyQty, setBuyQty] = useState(1);
  const [sellQty, setSellQty] = useState(1);
  const credits = useStore((s) => s.credits);
  const color = RES_COLORS[label.toLowerCase()] ?? '#FFB000';
  const outOfStock = stock <= 0;
  const maxBuy = Math.min(stock, Math.floor(credits / Math.max(1, buyPrice)));
  const maxSell = Math.min(playerAmount, maxStock - stock);

  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,176,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color, fontSize: '0.8rem', fontWeight: 'bold' }}>{label}</span>
        <span style={{ color: '#555', fontSize: '0.6rem' }}>
          Vorrat: {stock}/{maxStock} | Cargo: {playerAmount}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* BUY */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#00FF66', fontSize: '0.6rem', width: 28 }}>BUY</span>
          <button className="vs-btn" style={{ fontSize: '0.55rem', padding: '1px 4px' }}
            onClick={() => setBuyQty(Math.max(1, buyQty - 1))} disabled={buyQty <= 1}>-</button>
          <span style={{ color: '#FFB000', width: 20, textAlign: 'center', fontSize: '0.7rem' }}>{buyQty}</span>
          <button className="vs-btn" style={{ fontSize: '0.55rem', padding: '1px 4px' }}
            onClick={() => setBuyQty(Math.min(maxBuy, buyQty + 1))} disabled={buyQty >= maxBuy || outOfStock}>+</button>
          <span style={{ color: '#888', fontSize: '0.6rem', width: 50 }}>= {buyQty * buyPrice} CR</span>
          <button className="vs-btn"
            style={{ fontSize: '0.55rem', padding: '2px 6px', borderColor: '#00FF66', color: '#00FF66' }}
            disabled={outOfStock || buyQty > maxBuy}
            onClick={() => onBuy(buyQty)}
          >[BUY]</button>
        </div>
        {/* SELL */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#FF6644', fontSize: '0.6rem', width: 28 }}>SELL</span>
          <button className="vs-btn" style={{ fontSize: '0.55rem', padding: '1px 4px' }}
            onClick={() => setSellQty(Math.max(1, sellQty - 1))} disabled={sellQty <= 1}>-</button>
          <span style={{ color: '#FFB000', width: 20, textAlign: 'center', fontSize: '0.7rem' }}>{sellQty}</span>
          <button className="vs-btn" style={{ fontSize: '0.55rem', padding: '1px 4px' }}
            onClick={() => setSellQty(Math.min(maxSell, sellQty + 1))} disabled={sellQty >= maxSell || playerAmount <= 0}>+</button>
          <span style={{ color: '#888', fontSize: '0.6rem', width: 50 }}>= {sellQty * sellPrice} CR</span>
          <button className="vs-btn"
            style={{ fontSize: '0.55rem', padding: '2px 6px', borderColor: '#FF6644', color: '#FF6644' }}
            disabled={playerAmount <= 0 || sellQty > maxSell}
            onClick={() => onSell(sellQty)}
          >[SELL]</button>
        </div>
      </div>
    </div>
  );
}

export function StationTradeTab() {
  const cargo = useStore((s) => s.cargo);
  const credits = useStore((s) => s.credits);
  const npcStationData = useStore((s) => s.npcStationData);
  const currentSector = useStore((s) => s.currentSector);
  const isStation = currentSector?.type === 'station';
  const openStationTerminal = useStore((s) => s.openStationTerminal);

  // Station with full NPC data
  if (isStation && npcStationData) {
    const resources = npcStationData.inventory.filter((item: any) => !MODULE_MAP.has(item.itemType));
    const modules = npcStationData.inventory.filter((item: any) => MODULE_MAP.has(item.itemType));

    return (
      <div>
        {/* Station header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #333', paddingBottom: 6, marginBottom: 8,
        }}>
          <span style={{ fontSize: '0.75rem' }}>
            {npcStationData.name?.toUpperCase()} LV.{npcStationData.level}
          </span>
          <button className="vs-btn" style={{ fontSize: '0.6rem', borderColor: '#00FF88', color: '#00FF88' }}
            onClick={openStationTerminal}>[ANDOCKEN]</button>
        </div>

        {/* Resources */}
        {resources.map((item: any) => (
          <TradeRow
            key={item.itemType}
            label={item.itemType.toUpperCase()}
            buyPrice={item.buyPrice}
            sellPrice={item.sellPrice}
            stock={item.stock}
            maxStock={item.maxStock}
            playerAmount={cargo[item.itemType as keyof typeof cargo] ?? 0}
            onBuy={(qty) => network.sendNpcTrade(item.itemType, qty, 'buy')}
            onSell={(qty) => network.sendNpcTrade(item.itemType, qty, 'sell')}
          />
        ))}

        {/* Modules */}
        {modules.length > 0 && (
          <>
            <div style={{ fontSize: '0.65rem', color: '#666', letterSpacing: '0.1em', marginTop: 10, marginBottom: 6, borderBottom: '1px solid #222', paddingBottom: 3 }}>
              MODULE
            </div>
            {modules.map((item: any) => {
              const mod = MODULE_MAP.get(item.itemType);
              return (
                <div key={item.itemType} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,176,0,0.05)' }}>
                  <span style={{ color: '#FFB000', fontSize: '0.7rem' }}>{mod?.name ?? item.itemType}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: '0.6rem' }}>{item.buyPrice} CR</span>
                    <button className="vs-btn" style={{ fontSize: '0.55rem', padding: '2px 6px', borderColor: '#00FF66', color: '#00FF66' }}
                      disabled={item.stock <= 0 || credits < item.buyPrice}
                      onClick={() => network.sendNpcTrade(item.itemType, 1, 'buy')}>[BUY]</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 10, padding: '6px 0', borderTop: '1px solid #333', fontSize: '0.65rem', color: '#555' }}>
          CARGO: ORE {cargo.ore ?? 0} | GAS {cargo.gas ?? 0} | CRYSTAL {cargo.crystal ?? 0} | ART {cargo.artefact ?? 0}
        </div>
      </div>
    );
  }

  // Simple fallback (no station data)
  return (
    <div>
      <div style={{ fontSize: '0.65rem', color: '#666', letterSpacing: '0.1em', marginBottom: 8, borderBottom: '1px solid #333', paddingBottom: 3 }}>
        STANDARD-PREISE
      </div>
      {RESOURCES.map((res) => {
        const buyPrice = Math.ceil(NPC_PRICES[res] * NPC_BUY_SPREAD);
        const sellPrice = Math.floor(NPC_PRICES[res] * NPC_SELL_SPREAD);
        return (
          <TradeRow
            key={res}
            label={res.toUpperCase()}
            buyPrice={buyPrice}
            sellPrice={sellPrice}
            stock={999}
            maxStock={999}
            playerAmount={cargo[res] ?? 0}
            onBuy={(qty) => network.sendNpcTrade(res, qty, 'buy')}
            onSell={(qty) => network.sendNpcTrade(res, qty, 'sell')}
          />
        );
      })}
    </div>
  );
}
