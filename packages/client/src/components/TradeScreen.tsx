import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD, MAX_TRADE_ROUTES, TRADE_ROUTE_MIN_CYCLE, TRADE_ROUTE_MAX_CYCLE, PRODUCTION_RECIPES, PROCESSED_ITEM_TYPES } from '@void-sector/shared';
import type { ResourceType, DataSlate, ConfigureRouteMessage, AnyItemType } from '@void-sector/shared';

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  padding: '3px 8px',
  cursor: 'pointer',
};

const ITEM_LABELS: Record<string, string> = {
  ore: 'ERZ', gas: 'GAS', crystal: 'KRISTALL',
  fuel_cell: 'TREIBST.', circuit_board: 'SCHALTK.', alloy_plate: 'LEGIER.',
  void_shard: 'V.SHARD', bio_extract: 'BIOEXTR.',
};

function StockBar({ stock, maxStock }: { stock: number; maxStock: number }) {
  const pct = maxStock > 0 ? Math.round((stock / maxStock) * 100) : 0;
  const filled = Math.round(pct / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', opacity: 0.6 }}>
      {bar} {stock}/{maxStock}
    </span>
  );
}

export function TradeScreen() {
  const credits = useStore((s) => s.credits);
  const storage = useStore((s) => s.storage);
  const cargo = useStore((s) => s.cargo);
  const baseStructures = useStore((s) => s.baseStructures);
  const tradeOrders = useStore((s) => s.tradeOrders);
  const myOrders = useStore((s) => s.myOrders);
  const mySlates = useStore((s) => s.mySlates);
  const playerId = useStore((s) => s.playerId);
  const tradeRoutes = useStore((s) => s.tradeRoutes);
  const currentSector = useStore((s) => s.currentSector);
  const position = useStore((s) => s.position);
  const ship = useStore((s) => s.ship);
  const homeBase = useStore((s) => s.homeBase);
  const stationInfo = useStore((s) => s.stationInfo);
  const myKontorOrders = useStore((s) => s.myKontorOrders);
  const sectorKontorOrders = useStore((s) => s.sectorKontorOrders);

  const [amount, setAmount] = useState(1);
  const [tab, setTab] = useState<'npc' | 'npcv2' | 'market' | 'slates' | 'routes' | 'kontor'>('npc');
  const [kontorItem, setKontorItem] = useState<AnyItemType>('ore');
  const [kontorAmt, setKontorAmt] = useState(10);
  const [kontorPrice, setKontorPrice] = useState(5);

  const tradingPost = baseStructures.find((s: any) => s.type === 'trading_post');
  const kontorStruct = baseStructures.find((s: any) => s.type === 'kontor');
  const tier = tradingPost?.tier ?? 0;

  const isStation = currentSector?.type === 'station';
  const isHomeBase = position.x === homeBase.x && position.y === homeBase.y;
  const canTrade = isStation || isHomeBase;

  useEffect(() => {
    network.requestCredits();
    if (isStation) {
      network.requestStationInventory(position.x, position.y);
      network.requestSectorKontorOrders();
    } else {
      network.requestStorage();
      if (tier >= 2) {
        network.requestTradeOrders();
        network.requestMyOrders();
        network.requestMySlates();
      }
      if (kontorStruct) {
        network.requestMyKontorOrders();
      }
    }
  }, [tier, isStation, position.x, position.y, kontorStruct]);

  if (!canTrade) {
    return (
      <div style={{ padding: 16, textAlign: 'center', opacity: 0.4, fontSize: '0.8rem' }}>
        <div style={{ marginBottom: 8 }}>KEIN HANDEL VERFÜGBAR</div>
        <div style={{ fontSize: '0.7rem' }}>Navigate to a station or your home base to trade.</div>
      </div>
    );
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    ...btnStyle,
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#050505' : 'var(--color-primary)',
  });

  const cargoCap = ship?.stats?.cargoCap ?? 5;
  const cargoTotal = (cargo.ore ?? 0) + (cargo.gas ?? 0) + (cargo.crystal ?? 0) + (cargo.slates ?? 0);

  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 1.8, height: '100%', overflow: 'auto' }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: '8px', opacity: 0.6 }}>
        TRADE — {isStation ? `STATION LV.${stationInfo?.station.level ?? '?'}` : `T${tier}`} | {credits} CR
      </div>

      {/* Station XP bar */}
      {isStation && stationInfo && (
        <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: 6 }}>
          XP: {stationInfo.station.xp} | BESUCHE: {stationInfo.station.visitCount}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <button style={tabStyle(tab === 'npc')} onClick={() => setTab('npc')}>NPC HANDEL</button>
        {isStation && <button style={tabStyle(tab === 'npcv2')} onClick={() => setTab('npcv2')}>LAGER</button>}
        {!isStation && tier >= 2 && <button style={tabStyle(tab === 'market')} onClick={() => setTab('market')}>MARKT</button>}
        {!isStation && tier >= 2 && <button style={tabStyle(tab === 'slates')} onClick={() => setTab('slates')}>[SLATES]</button>}
        {!isStation && tier >= 3 && <button style={tabStyle(tab === 'routes')} onClick={() => setTab('routes')}>ROUTEN</button>}
        {(kontorStruct || sectorKontorOrders.length > 0) && (
          <button style={tabStyle(tab === 'kontor')} onClick={() => setTab('kontor')}>KONTOR</button>
        )}
      </div>

      <div style={{ fontSize: '0.7rem', marginBottom: 8 }}>
        <label>MENGE: </label>
        <input
          type="number" min={1} value={amount}
          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
          style={{ width: 50, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', padding: '2px 4px' }}
        />
      </div>

      {/* Classic NPC trade tab (legacy fixed prices) */}
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
          {isStation ? (
            <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: 8 }}>
              CARGO: ERZ {cargo.ore} | GAS {cargo.gas} | KRISTALL {cargo.crystal} ({cargoTotal}/{cargoCap})
            </div>
          ) : (
            <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: 8 }}>
              LAGER: ERZ {storage.ore} | GAS {storage.gas} | KRISTALL {storage.crystal}
            </div>
          )}
        </div>
      )}

      {/* New NPC trade V2 — with station inventory */}
      {tab === 'npcv2' && isStation && (
        <div>
          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px' }}>
            STATIONS-LAGER
          </div>
          {!stationInfo ? (
            <div style={{ opacity: 0.4 }}>LADE LAGER...</div>
          ) : stationInfo.inventory.length === 0 ? (
            <div style={{ opacity: 0.4 }}>KEIN LAGER</div>
          ) : (
            stationInfo.inventory.map((item) => (
              <div key={item.itemType} style={{ marginBottom: 8, borderBottom: '1px solid rgba(255,176,0,0.1)', paddingBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ width: 70 }}>{ITEM_LABELS[item.itemType] ?? item.itemType.toUpperCase()}</span>
                  <StockBar stock={item.stock} maxStock={item.maxStock} />
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                  <button
                    style={{ ...btnStyle, opacity: item.available ? 1 : 0.3 }}
                    disabled={!item.available}
                    onClick={() => network.sendNpcTradeV2(item.itemType, amount, 'buy', position.x, position.y)}
                  >
                    KAUFEN ({item.available ? item.sellPrice * amount : '—'} CR)
                  </button>
                  <button
                    style={{ ...btnStyle, opacity: item.accepts ? 1 : 0.3 }}
                    disabled={!item.accepts}
                    onClick={() => network.sendNpcTradeV2(item.itemType, amount, 'sell', position.x, position.y)}
                  >
                    VERK. ({item.accepts ? item.buyPrice * amount : 'VOLL'} CR)
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'market' && !isStation && tier >= 2 && (
        <div>
          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px' }}>
            MARKT ORDERS
          </div>
          {tradeOrders.length === 0 ? (
            <div style={{ opacity: 0.4 }}>KEINE ORDERS</div>
          ) : (
            tradeOrders.map((o: any) => (
              <div key={o.id} style={{ fontSize: '0.7rem', marginBottom: 4 }}>
                [{o.type.toUpperCase()}] {o.amount}x {o.resource?.toUpperCase() ?? o.item_type?.toUpperCase()} @ {o.price_per_unit} CR — {o.player_name}
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
                [{o.type}] {o.amount}x {o.resource ?? o.item_type} @ {o.price_per_unit}
                <button style={{ ...btnStyle, fontSize: '0.6rem' }} onClick={() => network.sendCancelOrder(o.id)}>X</button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'slates' && !isStation && (
        <div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '8px' }}>SLATE MARKTPLATZ</div>

          {mySlates.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.8rem', marginBottom: '4px', opacity: 0.7 }}>MEINE SLATES:</div>
              {mySlates.map((slate: DataSlate) => (
                <div key={slate.id} style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                  <span style={{ opacity: 0.7 }}>
                    [{slate.slateType === 'sector' ? 'S' : slate.slateType === 'area' ? 'A' : 'C'}] {slate.sectorData.length} Sektoren
                  </span>
                  <input type="number" min="1" placeholder="CR" style={{ width: '60px' }} className="vs-input" id={`slate-price-${slate.id}`} />
                  <button className="vs-btn" style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    onClick={() => {
                      const input = document.getElementById(`slate-price-${slate.id}`) as HTMLInputElement;
                      const price = parseInt(input?.value || '0', 10);
                      if (price > 0) network.sendListSlate(slate.id, price);
                    }}>
                    [LISTEN]
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: '0.8rem', marginBottom: '4px', opacity: 0.7 }}>ANGEBOTE:</div>
          {tradeOrders.filter((o: any) => o.resource === 'slate').map((order: any) => (
            <div key={order.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem' }}>
              <span>{order.playerName}: {order.pricePerUnit} CR</span>
              <button className="vs-btn" style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                disabled={order.playerId === playerId}
                onClick={() => network.sendAcceptSlateOrder(order.id)}>
                [KAUFEN]
              </button>
            </div>
          ))}
          {tradeOrders.filter((o: any) => o.resource === 'slate').length === 0 && (
            <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Keine Angebote</div>
          )}
        </div>
      )}

      {tab === 'routes' && !isStation && tier >= 3 && (
        <div>
          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px' }}>
            HANDELSROUTEN ({tradeRoutes.length}/{MAX_TRADE_ROUTES})
          </div>
          {tradeRoutes.map(route => (
            <div key={route.id} style={{ border: '1px solid rgba(255,176,0,0.2)', padding: 6, marginBottom: 6, fontSize: '0.75rem' }}>
              <div>ROUTE &rarr; [{route.targetX},{route.targetY}]</div>
              {route.sellResource && <div>SELL: {route.sellAmount}x {route.sellResource.toUpperCase()}</div>}
              {route.buyResource && <div>BUY: {route.buyAmount}x {route.buyResource.toUpperCase()}</div>}
              <div>ZYKLUS: {route.cycleMinutes} MIN | {route.active ? 'AKTIV' : 'PAUSIERT'}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button style={btnStyle} onClick={() => network.sendToggleRoute(route.id, !route.active)}>
                  {route.active ? 'PAUSE' : 'START'}
                </button>
                <button style={{ ...btnStyle, borderColor: '#FF3333', color: '#FF3333' }} onClick={() => network.sendDeleteRoute(route.id)}>
                  LÖSCHEN
                </button>
              </div>
            </div>
          ))}
          {tradeRoutes.length === 0 && <div style={{ opacity: 0.4, marginBottom: 8 }}>KEINE ROUTEN</div>}
          {tradeRoutes.length < MAX_TRADE_ROUTES && <NewRouteForm />}
        </div>
      )}

      {/* Kontor Tab */}
      {tab === 'kontor' && (
        <div>
          {/* Sector kontor orders (can sell to these) */}
          {sectorKontorOrders.length > 0 && (
            <>
              <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px' }}>
                KAUFAUFTRÄGE IN DIESEM SEKTOR
              </div>
              {sectorKontorOrders.map((order) => {
                const remaining = order.amountWanted - order.amountFilled;
                return (
                  <div key={order.id} style={{ border: '1px solid rgba(255,176,0,0.2)', padding: 6, marginBottom: 6, fontSize: '0.75rem' }}>
                    <div>{ITEM_LABELS[order.itemType] ?? order.itemType} — {order.pricePerUnit} CR/unit</div>
                    <div style={{ opacity: 0.6 }}>Benötigt: {remaining}/{order.amountWanted} | Von: {order.ownerName}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <button style={btnStyle} disabled={order.ownerId === playerId}
                        onClick={() => network.sendKontorSell(order.id, Math.min(amount, remaining))}>
                        VERKAUFEN ({Math.min(amount, remaining)}x = {Math.min(amount, remaining) * order.pricePerUnit} CR)
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* My kontor orders */}
          {!isStation && kontorStruct && (
            <>
              <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px', marginTop: 12 }}>
                MEINE KAUFAUFTRÄGE
              </div>

              {myKontorOrders.filter(o => o.active).map((order) => (
                <div key={order.id} style={{ border: '1px solid rgba(255,176,0,0.2)', padding: 6, marginBottom: 6, fontSize: '0.75rem' }}>
                  <div>{ITEM_LABELS[order.itemType] ?? order.itemType} — {order.pricePerUnit} CR/unit</div>
                  <div style={{ opacity: 0.6 }}>
                    {order.amountFilled}/{order.amountWanted} units | Budget: {order.budgetReserved} CR
                  </div>
                  <button style={{ ...btnStyle, marginTop: 4, borderColor: '#FF3333', color: '#FF3333', fontSize: '0.6rem' }}
                    onClick={() => network.sendKontorCancelOrder(order.id)}>
                    STORNIEREN
                  </button>
                </div>
              ))}

              <div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: 8, marginTop: 8, fontSize: '0.7rem' }}>
                <div style={{ opacity: 0.6, marginBottom: 6 }}>NEUER KAUFAUFTRAG</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                  <label>ITEM:</label>
                  <select className="vs-input" value={kontorItem}
                    onChange={e => setKontorItem(e.target.value as AnyItemType)}>
                    {(['ore', 'gas', 'crystal', ...PROCESSED_ITEM_TYPES] as AnyItemType[]).map(item => (
                      <option key={item} value={item}>{ITEM_LABELS[item] ?? item}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                  <label>MENGE:</label>
                  <input type="number" min={1} value={kontorAmt} className="vs-input" style={{ width: 60 }}
                    onChange={e => setKontorAmt(Math.max(1, parseInt(e.target.value) || 1))} />
                  <label>PREIS:</label>
                  <input type="number" min={1} value={kontorPrice} className="vs-input" style={{ width: 60 }}
                    onChange={e => setKontorPrice(Math.max(1, parseInt(e.target.value) || 1))} />
                  <span style={{ opacity: 0.6 }}>CR/u = {kontorAmt * kontorPrice} CR total</span>
                </div>
                <button style={btnStyle}
                  onClick={() => network.sendKontorPlaceOrder(kontorItem, kontorAmt, kontorPrice)}>
                  AUFTRAG ERSTELLEN
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NewRouteForm() {
  const [targetX, setTargetX] = useState(0);
  const [targetY, setTargetY] = useState(0);
  const [sellRes, setSellRes] = useState<ResourceType | ''>('');
  const [sellAmt, setSellAmt] = useState(1);
  const [buyRes, setBuyRes] = useState<ResourceType | ''>('');
  const [buyAmt, setBuyAmt] = useState(1);
  const [cycle, setCycle] = useState(30);

  const baseStructures = useStore((s) => s.baseStructures);
  const tradingPost = baseStructures.find((s: any) => s.type === 'trading_post');

  const handleSubmit = () => {
    if (!tradingPost) return;
    const config: ConfigureRouteMessage = {
      tradingPostId: tradingPost.id,
      targetX, targetY,
      sellResource: sellRes || null,
      sellAmount: sellRes ? sellAmt : 0,
      buyResource: buyRes || null,
      buyAmount: buyRes ? buyAmt : 0,
      cycleMinutes: cycle,
    };
    network.sendConfigureRoute(config);
  };

  return (
    <div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: 8, fontSize: '0.7rem' }}>
      <div style={{ marginBottom: 4, opacity: 0.6 }}>NEUE ROUTE</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        <label>ZIEL X:</label>
        <input type="number" value={targetX} onChange={e => setTargetX(parseInt(e.target.value) || 0)} className="vs-input" style={{ width: 60 }} />
        <label>Y:</label>
        <input type="number" value={targetY} onChange={e => setTargetY(parseInt(e.target.value) || 0)} className="vs-input" style={{ width: 60 }} />
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        <label>SELL:</label>
        <select className="vs-input" value={sellRes} onChange={e => setSellRes(e.target.value as ResourceType | '')}>
          <option value="">---</option>
          <option value="ore">ORE</option>
          <option value="gas">GAS</option>
          <option value="crystal">CRYSTAL</option>
        </select>
        <input type="number" min={1} value={sellAmt} onChange={e => setSellAmt(Math.max(1, parseInt(e.target.value) || 1))} className="vs-input" style={{ width: 40 }} />
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        <label>BUY:</label>
        <select className="vs-input" value={buyRes} onChange={e => setBuyRes(e.target.value as ResourceType | '')}>
          <option value="">---</option>
          <option value="ore">ORE</option>
          <option value="gas">GAS</option>
          <option value="crystal">CRYSTAL</option>
        </select>
        <input type="number" min={1} value={buyAmt} onChange={e => setBuyAmt(Math.max(1, parseInt(e.target.value) || 1))} className="vs-input" style={{ width: 40 }} />
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
        <label>ZYKLUS:</label>
        <input type="number" min={TRADE_ROUTE_MIN_CYCLE} max={TRADE_ROUTE_MAX_CYCLE} value={cycle}
          onChange={e => setCycle(Math.min(TRADE_ROUTE_MAX_CYCLE, Math.max(TRADE_ROUTE_MIN_CYCLE, parseInt(e.target.value) || 30)))}
          className="vs-input" style={{ width: 50 }} />
        <span>MIN</span>
      </div>
      <button onClick={handleSubmit} style={{ ...btnStyle }}>ROUTE ERSTELLEN</button>
    </div>
  );
}
