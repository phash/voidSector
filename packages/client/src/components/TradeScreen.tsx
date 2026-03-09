import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import {
  NPC_PRICES,
  NPC_BUY_SPREAD,
  NPC_SELL_SPREAD,
  MAX_TRADE_ROUTES,
  TRADE_ROUTE_MIN_CYCLE,
  TRADE_ROUTE_MAX_CYCLE,
} from '@void-sector/shared';
import type { ResourceType, DataSlate, ConfigureRouteMessage } from '@void-sector/shared';
import { InlineError } from './InlineError';

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
  const npcStationData = useStore((s) => s.npcStationData);
  const kontorOrders = useStore((s) => s.kontorOrders);
  const navReturnProgram = useStore((s) => s.navReturnProgram);
  const setActiveProgram = useStore((s) => s.setActiveProgram);
  const clearNavReturn = useStore((s) => s.clearNavReturn);
  const [amount, setAmount] = useState(1);
  const [tab, setTab] = useState<'npc' | 'market' | 'slates' | 'routes' | 'kontor'>('npc');

  const tradingPost = baseStructures.find((s: any) => s.type === 'trading_post');
  const tier = tradingPost?.tier ?? 0;

  const isStation = currentSector?.type === 'station';
  const isHomeBase = position.x === homeBase.x && position.y === homeBase.y;
  const canTrade = isStation || isHomeBase;
  const hasKontorOrders = kontorOrders.length > 0;

  useEffect(() => {
    network.requestCredits();
    network.requestKontorOrders();
    if (isStation) {
      network.requestNpcStationData();
    } else {
      network.requestStorage();
      if (tier >= 2) {
        network.requestTradeOrders();
        network.requestMyOrders();
        network.requestMySlates();
      }
    }
  }, [tier, isStation]);

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

  // At stations: cargo-based trading, NPC tab only
  // At home base: storage-based trading, all tabs based on trading post tier
  const cargoCap = ship?.stats?.cargoCap ?? 5;
  const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;

  return (
    <div
      style={{
        padding: '12px',
        fontSize: '0.8rem',
        lineHeight: 1.8,
        height: '100%',
        overflow: 'auto',
      }}
    >
      {navReturnProgram && (
        <button
          className="vs-btn"
          style={{ fontSize: '0.7rem', marginBottom: 8 }}
          onClick={() => { setActiveProgram(navReturnProgram); clearNavReturn(); }}
        >
          [← ZURÜCK]
        </button>
      )}
      <div style={{ letterSpacing: '0.2em', marginBottom: '8px', opacity: 0.6 }}>
        TRADE — {isStation ? 'STATION' : `T${tier}`} | {credits} CR
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <button style={tabStyle(tab === 'npc')} onClick={() => setTab('npc')}>
          NPC HANDEL
        </button>
        {!isStation && tier >= 2 && (
          <button style={tabStyle(tab === 'market')} onClick={() => setTab('market')}>
            MARKT
          </button>
        )}
        {!isStation && tier >= 2 && (
          <button style={tabStyle(tab === 'slates')} onClick={() => setTab('slates')}>
            [SLATES]
          </button>
        )}
        {!isStation && tier >= 3 && (
          <button style={tabStyle(tab === 'routes')} onClick={() => setTab('routes')}>
            ROUTEN
          </button>
        )}
        {hasKontorOrders && (
          <button style={tabStyle(tab === 'kontor')} onClick={() => setTab('kontor')}>
            KONTOR
          </button>
        )}
      </div>

      <div style={{ fontSize: '0.7rem', marginBottom: 8 }}>
        <label>MENGE: </label>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
          style={{
            width: 50,
            background: 'transparent',
            border: '1px solid var(--color-dim)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-mono)',
            padding: '2px 4px',
          }}
        />
      </div>

      {tab === 'npc' && (
        <div>
          {isStation && npcStationData ? (
            <>
              <div
                style={{
                  borderBottom: '1px solid var(--color-dim)',
                  paddingBottom: '4px',
                  marginBottom: '8px',
                }}
              >
                {npcStationData.name.toUpperCase()} LV.{npcStationData.level} — XP:{' '}
                {npcStationData.xp}/{npcStationData.nextLevelXp}
              </div>
              {npcStationData.inventory.map((item) => {
                const filled =
                  item.maxStock > 0 ? Math.round((item.stock / item.maxStock) * 10) : 0;
                const empty = 10 - filled;
                const stockBar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
                const outOfStock = item.stock < amount;
                const buyTotal = item.buyPrice * amount;
                const sellTotal = item.sellPrice * amount;
                const playerAmount = cargo[item.itemType as 'ore' | 'gas' | 'crystal'] ?? 0;
                return (
                  <div key={item.itemType} style={{ marginBottom: 6 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                      }}
                    >
                      <span style={{ width: 56 }}>{item.itemType.toUpperCase()}</span>
                      <span style={{ letterSpacing: '0.05em' }}>{stockBar}</span>
                      <span style={{ opacity: 0.6, minWidth: 60 }}>
                        {item.stock}/{item.maxStock}
                      </span>
                      <span style={{ opacity: 0.5, marginLeft: 'auto', fontSize: '0.65rem' }}>
                        AN BORD: <span style={{ color: 'var(--color-primary)' }}>{playerAmount}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2, marginLeft: 56 }}>
                      {outOfStock ? (
                        <span style={{ ...btnStyle, opacity: 0.3, cursor: 'default' }}>
                          [UNAVAILABLE]
                        </span>
                      ) : (
                        <button
                          style={btnStyle}
                          onClick={() => network.sendNpcTrade(item.itemType, amount, 'buy')}
                        >
                          KAUFEN ({buyTotal} CR)
                        </button>
                      )}
                      <button
                        style={btnStyle}
                        onClick={() => network.sendNpcTrade(item.itemType, amount, 'sell')}
                      >
                        VERKAUFEN ({sellTotal} CR)
                      </button>
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: 8 }}>
                CARGO: ERZ {cargo.ore} | GAS {cargo.gas} | KRISTALL {cargo.crystal} | ART{' '}
                {cargo.artefact} ({cargoTotal}/{cargoCap})
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  borderBottom: '1px solid var(--color-dim)',
                  paddingBottom: '4px',
                  marginBottom: '8px',
                }}
              >
                NPC PREISE (KAUF / VERKAUF)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: 8, fontSize: '0.65rem', opacity: 0.5 }}>
                <span>STATION</span><span>BESTAND</span>
              </div>
              {(['ore', 'gas', 'crystal'] as const).map((res) => {
                const buyPrice = Math.ceil(NPC_PRICES[res] * NPC_BUY_SPREAD * amount);
                const sellPrice = Math.floor(NPC_PRICES[res] * NPC_SELL_SPREAD * amount);
                const playerAmount = isStation ? cargo[res] : storage[res];
                return (
                  <div
                    key={res}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, alignItems: 'center', marginBottom: 6 }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: '0.75rem' }}>{res.toUpperCase()}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ ...btnStyle, fontSize: '0.6rem' }} onClick={() => network.sendNpcTrade(res, amount, 'buy')}>
                          K ({buyPrice}CR)
                        </button>
                        <button style={{ ...btnStyle, fontSize: '0.6rem' }} onClick={() => network.sendNpcTrade(res, amount, 'sell')}>
                          V ({sellPrice}CR)
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', paddingLeft: 4 }}>
                      {playerAmount}
                      <span style={{ opacity: 0.4, fontSize: '0.65rem' }}> {isStation ? 'Cargo' : 'Lager'}</span>
                    </div>
                  </div>
                );
              })}
              {isStation ? (
                <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: 8 }}>
                  CARGO: ERZ {cargo.ore} | GAS {cargo.gas} | KRISTALL {cargo.crystal} | ART{' '}
                  {cargo.artefact} ({cargoTotal}/{cargoCap})
                </div>
              ) : (
                <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: 8 }}>
                  LAGER: ERZ {storage.ore} | GAS {storage.gas} | KRISTALL {storage.crystal} | ART{' '}
                  {storage.artefact}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'market' && !isStation && tier >= 2 && (
        <div>
          <div
            style={{
              borderBottom: '1px solid var(--color-dim)',
              paddingBottom: '4px',
              marginBottom: '8px',
            }}
          >
            MARKT ORDERS
          </div>
          {tradeOrders.length === 0 ? (
            <div style={{ opacity: 0.4 }}>KEINE ORDERS</div>
          ) : (
            tradeOrders.map((o: any) => (
              <div key={o.id} style={{ fontSize: '0.7rem', marginBottom: 4 }}>
                [{o.type.toUpperCase()}] {o.amount}x {o.resource.toUpperCase()} @ {o.price_per_unit}{' '}
                CR — {o.player_name}
              </div>
            ))
          )}

          <div
            style={{
              borderBottom: '1px solid var(--color-dim)',
              paddingBottom: '4px',
              marginBottom: '8px',
              marginTop: '12px',
            }}
          >
            MEINE ORDERS
          </div>
          {myOrders.length === 0 ? (
            <div style={{ opacity: 0.4 }}>KEINE EIGENEN ORDERS</div>
          ) : (
            myOrders.map((o: any) => (
              <div key={o.id} style={{ fontSize: '0.7rem', display: 'flex', gap: 8 }}>
                [{o.type}] {o.amount}x {o.resource} @ {o.price_per_unit}
                <button
                  style={{ ...btnStyle, fontSize: '0.6rem' }}
                  onClick={() => network.sendCancelOrder(o.id)}
                >
                  X
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'slates' && !isStation && (
        <div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '8px' }}>
            SLATE MARKTPLATZ
          </div>

          {mySlates.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.8rem', marginBottom: '4px', opacity: 0.7 }}>
                MEINE SLATES:
              </div>
              {mySlates.map((slate: DataSlate) => (
                <div
                  key={slate.id}
                  style={{
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center',
                    marginBottom: '4px',
                    fontSize: '0.8rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ opacity: 0.7 }}>
                    [{slate.slateType === 'sector' ? 'S' : slate.slateType === 'area' ? 'A' : 'C'}]{' '}
                    {slate.sectorData.length} Sektoren
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
                      const input = document.getElementById(
                        `slate-price-${slate.id}`,
                      ) as HTMLInputElement;
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
              <div
                key={order.id}
                style={{
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                  marginBottom: '4px',
                  fontSize: '0.8rem',
                }}
              >
                <span>
                  {order.playerName}: {order.pricePerUnit} CR
                </span>
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

      {tab === 'routes' && !isStation && tier >= 3 && (
        <div>
          <div
            style={{
              borderBottom: '1px solid var(--color-dim)',
              paddingBottom: '4px',
              marginBottom: '8px',
            }}
          >
            HANDELSROUTEN ({tradeRoutes.length}/{MAX_TRADE_ROUTES})
          </div>

          {tradeRoutes.map((route) => (
            <div
              key={route.id}
              style={{
                border: '1px solid rgba(255,176,0,0.2)',
                padding: 6,
                marginBottom: 6,
                fontSize: '0.75rem',
              }}
            >
              <div>
                ROUTE &rarr; [{route.targetX},{route.targetY}]
              </div>
              {route.sellResource && (
                <div>
                  SELL: {route.sellAmount}x {route.sellResource.toUpperCase()}
                </div>
              )}
              {route.buyResource && (
                <div>
                  BUY: {route.buyAmount}x {route.buyResource.toUpperCase()}
                </div>
              )}
              <div>
                ZYKLUS: {route.cycleMinutes} MIN | {route.active ? 'AKTIV' : 'PAUSIERT'}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button
                  style={btnStyle}
                  onClick={() => network.sendToggleRoute(route.id, !route.active)}
                >
                  {route.active ? 'PAUSE' : 'START'}
                </button>
                <button
                  style={{ ...btnStyle, borderColor: '#FF3333', color: '#FF3333' }}
                  onClick={() => network.sendDeleteRoute(route.id)}
                >
                  LÖSCHEN
                </button>
              </div>
            </div>
          ))}

          {tradeRoutes.length === 0 && (
            <div style={{ opacity: 0.4, marginBottom: 8 }}>KEINE ROUTEN</div>
          )}

          {tradeRoutes.length < MAX_TRADE_ROUTES && <NewRouteForm />}
        </div>
      )}

      {tab === 'kontor' && hasKontorOrders && (
        <div>
          <div
            style={{
              borderBottom: '1px solid var(--color-dim)',
              paddingBottom: '4px',
              marginBottom: '8px',
            }}
          >
            KONTOR ORDERS
          </div>
          {kontorOrders.map((order, idx) => {
            const remaining = order.amountWanted - order.amountFilled;
            const isOwn = order.ownerId === playerId;
            return (
              <div
                key={order.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                  fontSize: '0.7rem',
                }}
              >
                <span>
                  #{idx + 1} BUYING {order.itemType.toUpperCase()} {remaining}u remaining @
                  {order.pricePerUnit}cr/u
                </span>
                <button
                  style={{
                    ...btnStyle,
                    fontSize: '0.6rem',
                    opacity: isOwn ? 0.3 : 1,
                    cursor: isOwn ? 'default' : 'pointer',
                  }}
                  disabled={isOwn}
                  onClick={() => !isOwn && network.sendKontorSellTo(order.id, amount)}
                >
                  SELL
                </button>
              </div>
            );
          })}
        </div>
      )}
      <InlineError codes={['INSUFFICIENT', 'BUILD_FAIL']} />
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

  // Find trading post from baseStructures
  const baseStructures = useStore((s) => s.baseStructures);
  const tradingPost = baseStructures.find((s: any) => s.type === 'trading_post');

  const handleSubmit = () => {
    if (!tradingPost) return;
    const config: ConfigureRouteMessage = {
      tradingPostId: tradingPost.id,
      targetX,
      targetY,
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
        <input
          type="number"
          value={targetX}
          onChange={(e) => setTargetX(parseInt(e.target.value) || 0)}
          className="vs-input"
          style={{ width: 60 }}
        />
        <label>Y:</label>
        <input
          type="number"
          value={targetY}
          onChange={(e) => setTargetY(parseInt(e.target.value) || 0)}
          className="vs-input"
          style={{ width: 60 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        <label>SELL:</label>
        <select
          className="vs-input"
          value={sellRes}
          onChange={(e) => setSellRes(e.target.value as ResourceType | '')}
        >
          <option value="">---</option>
          <option value="ore">ORE</option>
          <option value="gas">GAS</option>
          <option value="crystal">CRYSTAL</option>
        </select>
        <input
          type="number"
          min={1}
          value={sellAmt}
          onChange={(e) => setSellAmt(Math.max(1, parseInt(e.target.value) || 1))}
          className="vs-input"
          style={{ width: 40 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        <label>BUY:</label>
        <select
          className="vs-input"
          value={buyRes}
          onChange={(e) => setBuyRes(e.target.value as ResourceType | '')}
        >
          <option value="">---</option>
          <option value="ore">ORE</option>
          <option value="gas">GAS</option>
          <option value="crystal">CRYSTAL</option>
        </select>
        <input
          type="number"
          min={1}
          value={buyAmt}
          onChange={(e) => setBuyAmt(Math.max(1, parseInt(e.target.value) || 1))}
          className="vs-input"
          style={{ width: 40 }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
        <label>ZYKLUS:</label>
        <input
          type="number"
          min={TRADE_ROUTE_MIN_CYCLE}
          max={TRADE_ROUTE_MAX_CYCLE}
          value={cycle}
          onChange={(e) =>
            setCycle(
              Math.min(
                TRADE_ROUTE_MAX_CYCLE,
                Math.max(TRADE_ROUTE_MIN_CYCLE, parseInt(e.target.value) || 30),
              ),
            )
          }
          className="vs-input"
          style={{ width: 50 }}
        />
        <span>MIN</span>
      </div>
      <button
        onClick={handleSubmit}
        style={{
          background: 'transparent',
          border: '1px solid var(--color-primary)',
          color: 'var(--color-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          padding: '3px 8px',
          cursor: 'pointer',
        }}
      >
        ROUTE ERSTELLEN
      </button>
    </div>
  );
}
