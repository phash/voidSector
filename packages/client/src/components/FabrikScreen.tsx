import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { BASE_ANKAUF_PREISE, getTierConfig } from '@void-sector/shared';
import type { DistanceTier } from '@void-sector/shared';

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  padding: '3px 8px',
  cursor: 'pointer',
};

const dimBtnStyle: React.CSSProperties = {
  ...btnStyle,
  opacity: 0.35,
  cursor: 'default',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  opacity: 0.5,
  letterSpacing: '0.12em',
  marginBottom: 6,
  borderBottom: '1px solid rgba(255,176,0,0.2)',
  paddingBottom: 3,
};

type LagerTab = 'RESSOURCEN' | 'MODULE' | 'AMMO';

function makeProgressBar(progress: number, width = 16): string {
  const filled = Math.round(Math.max(0, Math.min(1, progress)) * width);
  const empty = width - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

function getStarLabel(
  ankaufPreis: number,
  key: keyof typeof BASE_ANKAUF_PREISE,
): string {
  const base = BASE_ANKAUF_PREISE[key];
  if (ankaufPreis >= base * 1.4) return '\u2605\u2605';
  if (ankaufPreis >= base * 1.1) return '\u2605';
  return '';
}

export function FabrikScreen() {
  const stationProductionState = useStore((s) => s.stationProductionState);
  const credits = useStore((s) => s.credits);
  const [lagerTab, setLagerTab] = useState<LagerTab>('RESSOURCEN');
  const [sellQty, setSellQty] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    network.getStationProduction();
  }, []);

  // Tick to keep progress bar live
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!stationProductionState) {
    return (
      <div
        style={{
          padding: 12,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          opacity: 0.5,
        }}
      >
        [LADE STATIONSDATEN...]
      </div>
    );
  }

  const {
    sectorX,
    sectorY,
    level,
    distanceTier,
    moduleTierLabel,
    resourceStockpile,
    maxStockpile,
    currentItem,
    upcomingQueue,
    finishedGoods,
    maxFinishedGoods,
    ankaufPreise,
    kaufPreise,
  } = stationProductionState;

  const tierConfig = getTierConfig(distanceTier as DistanceTier);
  const allItems = tierConfig.items;

  // Progress for current item
  let progressRatio = 0;
  let remainingSeconds = 0;
  if (currentItem) {
    const elapsed = (now - currentItem.startedAtMs) / 1000;
    progressRatio = Math.min(1, elapsed / currentItem.durationSeconds);
    remainingSeconds = Math.max(0, currentItem.durationSeconds - elapsed);
  }

  const filteredItems = allItems.filter((item) => item.category === lagerTab);

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    ...btnStyle,
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#050505' : 'var(--color-primary)',
  });

  const getSellQty = (key: string) => sellQty[key] ?? 1;

  return (
    <div
      style={{
        padding: 12,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* HEADER */}
      <div style={{ letterSpacing: '0.15em', fontSize: '0.7rem', opacity: 0.7 }}>
        STATION LVL {level} &middot; SEKTOR {sectorX},{sectorY} &middot; MODUL-TIER: {moduleTierLabel}
      </div>

      {/* MAIN BODY — 2 columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* LEFT: PRODUKTION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={sectionHeaderStyle}>PRODUKTION</div>

          {currentItem ? (
            <div>
              <div style={{ fontSize: '0.7rem', marginBottom: 4 }}>
                {currentItem.itemId.toUpperCase().replace(/_/g, ' ')}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', marginBottom: 3 }}>
                {makeProgressBar(progressRatio)}
              </div>
              <div style={{ fontSize: '0.6rem', opacity: 0.55 }}>
                {Math.ceil(remainingSeconds)}s verbleibend
              </div>
            </div>
          ) : (
            <div style={{ opacity: 0.4, fontSize: '0.65rem' }}>KEIN AKTIVER AUFTRAG</div>
          )}

          {/* Queue */}
          {upcomingQueue.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: '0.6rem', opacity: 0.45, marginBottom: 4, letterSpacing: '0.08em' }}>
                WARTESCHLANGE
              </div>
              {upcomingQueue.slice(0, 5).map((itemId, idx) => (
                <div
                  key={`${itemId}-${idx}`}
                  style={{ fontSize: '0.65rem', opacity: 0.65, padding: '1px 0' }}
                >
                  {idx + 1}. {itemId.toUpperCase().replace(/_/g, ' ')}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: LAGER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={sectionHeaderStyle}>LAGER</div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
            {(['RESSOURCEN', 'MODULE', 'AMMO'] as LagerTab[]).map((t) => (
              <button key={t} style={tabBtnStyle(lagerTab === t)} onClick={() => setLagerTab(t)}>
                [{t}]
              </button>
            ))}
          </div>

          {/* Item list */}
          <div style={{ overflowY: 'auto', maxHeight: 200 }}>
            {filteredItems.length === 0 && (
              <div style={{ opacity: 0.4, fontSize: '0.65rem' }}>KEINE ARTIKEL</div>
            )}
            {filteredItems.map((item) => {
              const stock = finishedGoods[item.itemId] ?? 0;
              const maxStock = maxFinishedGoods[item.itemId] ?? item.maxStock;
              const price = kaufPreise[item.itemId] ?? item.buyPrice;
              const canBuy = stock > 0 && credits >= price;
              const stockFilled = maxStock > 0 ? Math.round((stock / maxStock) * 8) : 0;
              const stockBar = '\u2588'.repeat(stockFilled) + '\u2591'.repeat(8 - stockFilled);

              return (
                <div
                  key={item.itemId}
                  style={{
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: '1px solid rgba(255,176,0,0.08)',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', marginBottom: 2 }}>
                    {item.label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.55, marginBottom: 3 }}>
                    {stockBar} {stock}/{maxStock}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {canBuy ? (
                      <button
                        style={{ ...btnStyle, fontSize: '0.6rem' }}
                        onClick={() => network.buyFromStation(item.itemId, 1)}
                      >
                        [KAUFEN] {price}CR
                      </button>
                    ) : (
                      <span style={dimBtnStyle}>[KAUFEN] {price}CR</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM: ROHSTOFFE LIEFERN */}
      <div>
        <div style={sectionHeaderStyle}>ROHSTOFFE (LIEFERN)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(['ore', 'gas', 'crystal'] as const).map((key) => {
            const stock = resourceStockpile[key];
            const max = maxStockpile[key];
            const ankauf = ankaufPreise[key];
            const stars = getStarLabel(ankauf, key);
            const stockPct = max > 0 ? stock / max : 0;
            const barFilled = Math.round(stockPct * 12);
            const stockBar = '\u2588'.repeat(barFilled) + '\u2591'.repeat(12 - barFilled);
            const qty = getSellQty(key);

            return (
              <div
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr auto auto auto',
                  gap: 6,
                  alignItems: 'center',
                  fontSize: '0.65rem',
                }}
              >
                <span style={{ opacity: 0.8 }}>{key.toUpperCase()}</span>
                <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
                  {stockBar} {Math.round(stockPct * 100)}%
                </span>
                <span style={{ opacity: 0.7 }}>
                  {ankauf}CR{stars && <span style={{ color: '#FFD700' }}> {stars}</span>}
                </span>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) =>
                    setSellQty((prev) => ({
                      ...prev,
                      [key]: Math.max(1, parseInt(e.target.value) || 1),
                    }))
                  }
                  style={{
                    width: 44,
                    background: 'transparent',
                    border: '1px solid var(--color-dim)',
                    color: 'var(--color-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    padding: '2px 4px',
                  }}
                />
                <button
                  style={{ ...btnStyle, fontSize: '0.6rem' }}
                  onClick={() => network.sellToStation(key, qty)}
                >
                  [VERKAUFEN]
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
