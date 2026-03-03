import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { SECTOR_COLORS, FUEL_COST_PER_UNIT, HYPERJUMP_AP_DISCOUNT, FREE_REFUEL_MAX_SHIPS, REP_PRICE_MODIFIERS, generateStationName } from '@void-sector/shared';
import { network } from '../network/client';
import { JumpGatePanel } from './JumpGatePanel';

function RefuelPanel({ fuel, isFreeRefuel }: {
  fuel: { current: number; max: number };
  isFreeRefuel: boolean;
}) {
  const [amount, setAmount] = useState(Math.ceil(fuel.max - fuel.current));
  const reputations = useStore((s) => s.reputations);
  const currentSector = useStore((s) => s.currentSector);

  // Reputation-based pricing
  const factionRep = currentSector?.faction
    ? reputations.find((r: any) => r.factionId === currentSector.faction)
    : null;
  const repTier = factionRep?.tier ?? 'neutral';
  const priceModifier = REP_PRICE_MODIFIERS[repTier] ?? 1.0;
  const unitCost = isFreeRefuel ? 0 : Math.ceil(FUEL_COST_PER_UNIT * priceModifier);
  const totalCost = isFreeRefuel ? 0 : Math.ceil(amount * FUEL_COST_PER_UNIT * priceModifier);
  const tankSpace = Math.ceil(fuel.max - fuel.current);

  return (
    <div style={{ marginTop: 8, border: '1px solid var(--color-dim)', padding: '6px 8px' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: 4 }}>
        REFUEL — {isFreeRefuel ? 'GRATIS' : `${unitCost} CR/u (${repTier.toUpperCase()})`}
      </div>
      <input
        type="range"
        min={1}
        max={tankSpace}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--color-primary)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginTop: 2 }}>
        <span>+{amount} FUEL</span>
        <span>{totalCost > 0 ? `${totalCost} CR` : 'GRATIS'}</span>
      </div>
      <button
        className="vs-btn"
        style={{ width: '100%', marginTop: 4, fontSize: '0.75rem' }}
        onClick={() => network.sendRefuel(amount)}
      >
        [REFUEL]
      </button>
    </div>
  );
}

export function DetailPanel() {
  const selectedSector = useStore((s) => s.selectedSector);
  const discoveries = useStore((s) => s.discoveries);
  const position = useStore((s) => s.position);
  const players = useStore((s) => s.players);
  const setSelectedSector = useStore((s) => s.setSelectedSector);

  const fuel = useStore((s) => s.fuel);
  const jumpGateInfo = useStore((s) => s.jumpGateInfo);
  const scanEvents = useStore((s) => s.scanEvents);
  const rescuedSurvivors = useStore((s) => s.rescuedSurvivors);
  const bookmarks = useStore((s) => s.bookmarks);

  const setDetailView = useStore((s) => s.setDetailView);

  const autopilot = useStore((s) => s.autopilot);
  const ship = useStore((s) => s.ship);

  const autoFollow = useStore((s) => s.autoFollow);
  const mining = useStore((s) => s.mining);
  const shipList = useStore((s) => s.shipList);
  const homeBase = useStore((s) => s.homeBase);

  useEffect(() => {
    if (autoFollow) {
      setSelectedSector({ x: position.x, y: position.y });
    }
  }, [autoFollow, position.x, position.y, setSelectedSector]);

  if (!selectedSector) {
    return (
      <div style={{ padding: 16, textAlign: 'center', opacity: 0.4, fontSize: '0.8rem' }}>
        <div style={{ marginBottom: 8 }}>SELECT A SECTOR</div>
        <div style={{ fontSize: '0.7rem' }}>CLICK ON THE GRID TO INSPECT</div>
      </div>
    );
  }

  const key = `${selectedSector.x}:${selectedSector.y}`;
  const sector = discoveries[key];
  const isPlayerHere = selectedSector.x === position.x && selectedSector.y === position.y;
  const isHome = selectedSector.x === 0 && selectedSector.y === 0;
  const playersHere = Object.values(players).filter(
    (p) => p.x === selectedSector.x && p.y === selectedSector.y
  );

  const sectorColor = sector
    ? (isHome
      ? SECTOR_COLORS.home_base
      : SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty)
    : 'var(--color-dim)';

  const sectorScanEvents = scanEvents.filter(
    e => e.sectorX === selectedSector.x && e.sectorY === selectedSector.y && e.status === 'discovered'
  );

  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 1.8, height: '100%', overflow: 'auto' }}>
      <div style={{ letterSpacing: '0.2em', color: sectorColor, marginBottom: 8 }}>
        SECTOR ({selectedSector.x}, {selectedSector.y})
      </div>

      {sector ? (
        <>
          <div>TYPE ──── <span
            style={{ color: sectorColor, cursor: 'pointer', textDecoration: 'underline dotted' }}
            onClick={() => setDetailView({
              type: isHome ? 'home_base' : sector.type,
              data: {
                name: sector.type === 'station'
                  ? generateStationName(selectedSector.x, selectedSector.y)
                  : sector.type.toUpperCase(),
                position: `(${selectedSector.x}, ${selectedSector.y})`,
                faction: sector.faction,
                resources: sector.resources
                  ? Object.entries(sector.resources).map(([r, a]) => `${r.toUpperCase()} x${a}`).join(', ')
                  : undefined,
              },
            })}
          >{sector.type.toUpperCase()}</span></div>
          {sector.resources && (
            <>
              <div style={{ marginTop: 8, letterSpacing: '0.15em', opacity: 0.6 }}>RESOURCES</div>
              {Object.entries(sector.resources).map(([res, amount]) => (
                <div key={res}>{res.toUpperCase()} ──── {amount}</div>
              ))}
            </>
          )}
          {isPlayerHere && (
            <div style={{ marginTop: 8, color: 'var(--color-primary)' }}>
              YOU ARE HERE
            </div>
          )}
          {mining?.active && mining.sectorX === sector?.x && mining.sectorY === sector?.y && (
            <div style={{
              marginTop: 8,
              padding: '6px 8px',
              border: '1px solid var(--color-primary)',
              fontSize: '0.75rem',
              animation: 'bezel-alert-pulse 2s infinite',
            }}>
              <div>MINING: {mining.resource?.toUpperCase()}</div>
              <div style={{ color: 'var(--color-dim)' }}>RATE: {mining.rate}u/s</div>
            </div>
          )}
          {isPlayerHere && fuel && fuel.current < fuel.max && (() => {
            const isHomeBase = position.x === homeBase.x && position.y === homeBase.y;
            const isFreeRefuel = isHomeBase && shipList.length <= FREE_REFUEL_MAX_SHIPS;
            return (
              <RefuelPanel fuel={fuel} isFreeRefuel={isFreeRefuel} />
            );
          })()}

          {/* JumpGate Panel */}
          {isPlayerHere && jumpGateInfo && (
            <JumpGatePanel gate={jumpGateInfo} />
          )}

          {/* Rescue button - distress signal scan event at this sector */}
          {isPlayerHere && scanEvents.some(e =>
            e.sectorX === selectedSector.x && e.sectorY === selectedSector.y &&
            e.eventType === 'distress_signal' && e.status === 'discovered'
          ) && (
            <button
              onClick={() => network.sendRescue(selectedSector.x, selectedSector.y)}
              style={{
                background: 'transparent',
                border: '1px solid #FF3333',
                color: '#FF3333',
                fontFamily: 'inherit',
                fontSize: '0.75em',
                padding: '4px 12px',
                cursor: 'pointer',
                marginTop: 8,
                display: 'block',
              }}
            >
              BERGEN (5 AP)
            </button>
          )}

          {/* Deliver survivors at station */}
          {isPlayerHere && sector?.type === 'station' && rescuedSurvivors.length > 0 && (
            <button
              onClick={() => network.sendDeliverSurvivors(selectedSector.x, selectedSector.y)}
              style={{
                background: 'transparent',
                border: '1px solid #00FF88',
                color: '#00FF88',
                fontFamily: 'inherit',
                fontSize: '0.75em',
                padding: '4px 12px',
                cursor: 'pointer',
                marginTop: 8,
                display: 'block',
              }}
            >
              ÜBERLEBENDE ABLIEFERN ({rescuedSurvivors.length})
            </button>
          )}

          {/* Multi-content features */}
          {(jumpGateInfo || sectorScanEvents.length > 0) && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: 'rgba(255,176,0,0.6)', fontSize: '0.7em', letterSpacing: '0.1em' }}>FEATURES</div>
              {jumpGateInfo && <div style={{ color: '#00BFFF' }}>◆ JUMPGATE ({jumpGateInfo.gateType})</div>}
              {sectorScanEvents.map(e => (
                <div key={e.id} style={{ color: e.eventType === 'distress_signal' ? '#FF3333' : '#FF00FF' }}>
                  ◆ {e.eventType === 'distress_signal' ? 'DISTRESS SIGNAL' : e.eventType.toUpperCase().replace('_', ' ')}
                </div>
              ))}
            </div>
          )}

          {playersHere.length > 0 && (
            <>
              <div style={{ marginTop: 8, letterSpacing: '0.15em', opacity: 0.6 }}>SHIPS IN SECTOR</div>
              {playersHere.map((p) => (
                <div
                  key={p.sessionId}
                  style={{ cursor: 'pointer', textDecoration: 'underline dotted', color: 'var(--color-primary)' }}
                  onClick={() => setDetailView({ type: 'ship', data: { name: p.username } })}
                >
                  {p.username}
                </div>
              ))}
            </>
          )}

          {/* Bookmark button */}
          <button className="vs-btn" style={{ fontSize: '0.7rem', marginTop: 4 }}
            onClick={() => {
              const freeSlot = [1, 2, 3, 4, 5].find(s => !bookmarks.find(b => b.slot === s));
              if (freeSlot && selectedSector) {
                network.sendSetBookmark(freeSlot, selectedSector.x, selectedSector.y, sector?.type || '');
              }
            }}>
            [BOOKMARK]
          </button>

          {/* Hyperjump button */}
          {(() => {
            const distance = Math.abs(selectedSector.x - position.x) + Math.abs(selectedSector.y - position.y);
            const isAdjacent = distance <= 1;
            if (!isPlayerHere && !isAdjacent && !autopilot?.active) {
              const shipStats = ship?.stats ?? null;
              const apCost = shipStats ? Math.ceil(distance * shipStats.apCostJump * HYPERJUMP_AP_DISCOUNT) : 0;
              const fuelCost = shipStats ? distance : 0;
              return (
                <button className="vs-btn" style={{ marginTop: 8, display: 'block', width: '100%' }}
                  onClick={() => network.sendHyperJump(selectedSector.x, selectedSector.y)}>
                  [HYPERJUMP ({selectedSector.x}, {selectedSector.y})]
                  {shipStats ? ` ${apCost}AP / ${fuelCost}F` : ''}
                </button>
              );
            }
            return null;
          })()}
        </>
      ) : (
        <div style={{ opacity: 0.4 }}>UNEXPLORED</div>
      )}
    </div>
  );
}
