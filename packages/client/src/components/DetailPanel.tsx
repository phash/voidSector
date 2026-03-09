import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import {
  SECTOR_COLORS,
  FUEL_COST_PER_UNIT,
  FREE_REFUEL_MAX_SHIPS,
  REP_PRICE_MODIFIERS,
  generateStationName,
  calcHyperjumpAP,
  calcHyperjumpFuel,
  innerCoord,
} from '@void-sector/shared';
import type { ChatChannel } from '@void-sector/shared';
import { network } from '../network/client';
import { JumpGatePanel } from './JumpGatePanel';
import { PlayerGatePanel } from './PlayerGatePanel';
import { InlineError } from './InlineError';

type DrillDown =
  | { type: 'player'; username: string; sessionId: string }
  | { type: 'station'; name: string }
  | null;

function RefuelPanel({
  fuel,
  isFreeRefuel,
}: {
  fuel: { current: number; max: number };
  isFreeRefuel: boolean;
}) {
  const [amount, setAmount] = useState(Math.ceil(fuel.max - fuel.current));
  const reputations = useStore((s) => s.reputations);
  const currentSector = useStore((s) => s.currentSector);

  // Reputation-based pricing
  const sectorFaction = (currentSector as any)?.faction;
  const factionRep = sectorFaction
    ? reputations.find((r: any) => r.factionId === sectorFaction)
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          marginTop: 2,
        }}
      >
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
  const playerGateInfo = useStore((s) => s.playerGateInfo);
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

  const [drillDown, setDrillDown] = useState<DrillDown>(null);

  useEffect(() => {
    if (autoFollow) {
      setSelectedSector({ x: position.x, y: position.y });
    }
  }, [autoFollow, position.x, position.y, setSelectedSector]);

  // Reset drill-down when sector changes
  useEffect(() => {
    setDrillDown(null);
  }, [selectedSector?.x, selectedSector?.y]);

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
  const isHome = selectedSector.x === homeBase.x && selectedSector.y === homeBase.y;
  const playersHere = Object.values(players).filter(
    (p) => p.x === selectedSector.x && p.y === selectedSector.y,
  );

  const sectorColor = sector
    ? isHome
      ? SECTOR_COLORS.home_base
      : (SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty)
    : 'var(--color-dim)';

  const sectorScanEvents = scanEvents.filter(
    (e) =>
      e.sectorX === selectedSector.x && e.sectorY === selectedSector.y && e.status === 'discovered',
  );

  // Drill-down: player detail view
  if (drillDown?.type === 'player') {
    const startDirectMessage = () => {
      useStore.setState({
        chatChannel: 'direct' as ChatChannel,
        directChatRecipient: { id: drillDown.sessionId, name: drillDown.username },
      });
    };
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
        <button
          className="vs-btn"
          style={{ fontSize: '0.7rem', marginBottom: 8 }}
          onClick={() => setDrillDown(null)}
        >
          [ZURÜCK]
        </button>
        <div style={{ letterSpacing: '0.2em', color: 'var(--color-primary)', marginBottom: 8 }}>
          SCHIFF: {drillDown.username}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-dim)', marginBottom: 12 }}>
          POSITION: ({innerCoord(selectedSector.x)}, {innerCoord(selectedSector.y)})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button className="vs-btn" style={{ fontSize: '0.7rem' }} onClick={startDirectMessage}>
            [NACHRICHT SENDEN]
          </button>
        </div>
      </div>
    );
  }

  // Drill-down: station detail view
  if (drillDown?.type === 'station' && sector) {
    const isHomeBase = position.x === homeBase.x && position.y === homeBase.y;
    const isStation = sector.type === 'station' || (sector as any).contents?.includes('station');
    const isFreeRefuel = isHomeBase && shipList.length <= FREE_REFUEL_MAX_SHIPS;
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
        <button
          className="vs-btn"
          style={{ fontSize: '0.7rem', marginBottom: 8 }}
          onClick={() => setDrillDown(null)}
        >
          [ZURÜCK]
        </button>
        <div style={{ letterSpacing: '0.2em', color: sectorColor, marginBottom: 8 }}>
          {drillDown.name}
        </div>
        {sector.type === 'station' && (
          <div style={{ fontSize: '0.7rem', color: 'var(--color-dim)', marginBottom: 4 }}>
            FACTION: {(sector as any).faction ?? 'INDEPENDENT'}
          </div>
        )}
        {isPlayerHere && fuel && fuel.current < fuel.max && (isStation || isHomeBase) && (
          <RefuelPanel fuel={fuel} isFreeRefuel={isFreeRefuel} />
        )}
        {isPlayerHere && jumpGateInfo && <JumpGatePanel gate={jumpGateInfo} />}
        {isPlayerHere && playerGateInfo && <PlayerGatePanel />}
        {isPlayerHere && sector?.type === 'station' && rescuedSurvivors.length > 0 && (
          <button
            className="vs-btn"
            style={{ fontSize: '0.7rem', marginTop: 8, borderColor: '#00FF88', color: '#00FF88' }}
            onClick={() => network.sendDeliverSurvivors(selectedSector.x, selectedSector.y)}
          >
            [ÜBERLEBENDE ABLIEFERN ({rescuedSurvivors.length})]
          </button>
        )}
      </div>
    );
  }

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
      <div style={{ letterSpacing: '0.2em', color: sectorColor, marginBottom: 8 }}>
        SECTOR ({innerCoord(selectedSector.x)}, {innerCoord(selectedSector.y)})
      </div>

      {sector ? (
        <>
          <div>
            TYPE ────{' '}
            <button
              style={{
                background: 'none',
                border: 'none',
                color: sectorColor,
                cursor: 'pointer',
                textDecoration: 'underline dotted',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                padding: 0,
              }}
              onClick={() =>
                setDetailView({
                  type: isHome ? 'home_base' : sector.type,
                  data: {
                    name:
                      sector.type === 'station'
                        ? generateStationName(selectedSector.x, selectedSector.y)
                        : sector.type.toUpperCase(),
                    position: `(${selectedSector.x}, ${selectedSector.y})`,
                    faction: (sector as any).faction,
                    resources: sector.resources
                      ? Object.entries(sector.resources)
                          .map(([r, a]) => `${r.toUpperCase()} x${a}`)
                          .join(', ')
                      : undefined,
                    stationVariant: sector.metadata?.stationVariant as string | undefined,
                  },
                })
              }
            >
              {sector.type.toUpperCase()}
            </button>
          </div>
          {(sector as any).environment === 'black_hole' && (
            <div style={{ color: '#FF3333', marginTop: 4, fontSize: '0.7rem' }}>
              WARNUNG: SCHWARZES LOCH — UNPASSIERBAR
            </div>
          )}
          {sector.resources && (
            <>
              <div style={{ marginTop: 8, letterSpacing: '0.15em', opacity: 0.6 }}>RESOURCES</div>
              {Object.entries(sector.resources).map(([res, amount]) => (
                <div key={res}>
                  {res.toUpperCase()} ──── {amount}
                </div>
              ))}
            </>
          )}
          {isPlayerHere && (
            <div style={{ marginTop: 8, color: 'var(--color-primary)' }}>YOU ARE HERE</div>
          )}
          {mining?.active && mining.sectorX === sector?.x && mining.sectorY === sector?.y && (
            <div
              style={{
                marginTop: 8,
                padding: '6px 8px',
                border: '1px solid var(--color-primary)',
                fontSize: '0.75rem',
                animation: 'bezel-alert-pulse 2s infinite',
              }}
            >
              <div>MINING: {mining.resource?.toUpperCase()}</div>
              <div style={{ color: 'var(--color-dim)' }}>RATE: {mining.rate}u/s</div>
            </div>
          )}
          {/* JumpGate visible on main view too */}
          {isPlayerHere && jumpGateInfo && <JumpGatePanel gate={jumpGateInfo} />}
          {/* Player-built jumpgate panel */}
          {isPlayerHere && playerGateInfo && <PlayerGatePanel />}

          {/* Rescue button - distress signal scan event at this sector */}
          {isPlayerHere &&
            scanEvents.some(
              (e) =>
                e.sectorX === selectedSector.x &&
                e.sectorY === selectedSector.y &&
                e.eventType === 'distress_signal' &&
                e.status === 'discovered',
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

          {/* Multi-content features */}
          {(jumpGateInfo || playerGateInfo || sectorScanEvents.length > 0) && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{ color: 'rgba(255,176,0,0.6)', fontSize: '0.7em', letterSpacing: '0.1em' }}
              >
                FEATURES
              </div>
              {jumpGateInfo && (
                <div style={{ color: '#00BFFF' }}>◆ JUMPGATE ({jumpGateInfo.gateType})</div>
              )}
              {playerGateInfo && (
                <div style={{ color: '#00BFFF' }}>
                  ◆ SPIELER-GATE [L{playerGateInfo.gate.levelConnection}/L
                  {playerGateInfo.gate.levelDistance}]
                </div>
              )}
              {sectorScanEvents.map((e) => (
                <div key={e.id}>
                  <div style={{ color: e.eventType === 'distress_signal' ? '#FF3333' : '#FF00FF' }}>
                    ◆{' '}
                    {e.eventType === 'distress_signal'
                      ? 'DISTRESS SIGNAL'
                      : e.eventType.toUpperCase().replace('_', ' ')}
                  </div>
                  {e.eventType === 'distress_signal' &&
                    (e.data as { message?: string }).message && (
                      <div
                        style={{
                          marginTop: '4px',
                          padding: '6px 8px',
                          border: '1px solid #FF3333',
                          borderLeft: '3px solid #FF3333',
                          color: '#FF9999',
                          fontSize: '0.75rem',
                          lineHeight: 1.5,
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'pre-wrap',
                          opacity: 0.9,
                        }}
                      >
                        {(e.data as { message: string }).message}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}

          {/* Sector elements list */}
          {(sector.type === 'station' ||
            (sector as any).contents?.includes('station') ||
            isHome ||
            playersHere.length > 0) && (
            <div style={{ marginTop: 8 }}>
              <div style={{ letterSpacing: '0.15em', opacity: 0.6, marginBottom: 4 }}>
                OBJEKTE IM SEKTOR
              </div>
              {(sector.type === 'station' || (sector as any).contents?.includes('station')) && (
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#00BFFF',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    padding: '2px 0',
                    display: 'block',
                  }}
                  onClick={() =>
                    setDrillDown({
                      type: 'station',
                      name: generateStationName(selectedSector.x, selectedSector.y),
                    })
                  }
                >
                  ◆ {generateStationName(selectedSector.x, selectedSector.y)}
                </button>
              )}
              {isHome && (
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: SECTOR_COLORS.home_base,
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    padding: '2px 0',
                    display: 'block',
                  }}
                  onClick={() => setDrillDown({ type: 'station', name: 'HOME BASE' })}
                >
                  ◆ HOME BASE
                </button>
              )}
              {playersHere.map((p) => (
                <button
                  key={p.sessionId}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-primary)',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    padding: '2px 0',
                    display: 'block',
                  }}
                  onClick={() =>
                    setDrillDown({ type: 'player', username: p.username, sessionId: p.sessionId })
                  }
                >
                  ◆ {p.username}
                </button>
              ))}
            </div>
          )}

          {/* Build buttons - only when player is here */}
          {isPlayerHere && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              <button
                className="vs-btn"
                onClick={() => network.sendBuild('comm_relay')}
                title="5 Ore, 2 Crystal, 5 AP"
                style={{ fontSize: '0.7rem' }}
              >
                [BUILD RELAY]
              </button>
              <button
                className="vs-btn"
                onClick={() => network.sendBuild('mining_station')}
                title="30 Ore, 15 Gas, 10 Crystal, 15 AP"
                style={{ fontSize: '0.7rem' }}
              >
                [BUILD STATION]
              </button>
              <button
                className="vs-btn"
                onClick={() => network.sendBuild('base')}
                title="50 Ore, 30 Gas, 25 Crystal, 25 AP"
                style={{ fontSize: '0.7rem' }}
              >
                [BUILD BASE]
              </button>
            </div>
          )}

          {isPlayerHere && <InlineError codes={['BUILD_FAIL', 'INSUFFICIENT']} />}

          {/* Bookmark button */}
          <button
            className="vs-btn"
            style={{ fontSize: '0.7rem', marginTop: 4 }}
            onClick={() => {
              const freeSlot = [1, 2, 3, 4, 5].find((s) => !bookmarks.find((b) => b.slot === s));
              if (freeSlot && selectedSector) {
                network.sendSetBookmark(
                  freeSlot,
                  selectedSector.x,
                  selectedSector.y,
                  sector?.type || '',
                );
              }
            }}
          >
            [BOOKMARK]
          </button>

          {/* Hyperjump button */}
          {(() => {
            const distance =
              Math.abs(selectedSector.x - position.x) + Math.abs(selectedSector.y - position.y);
            const isAdjacent = distance <= 1;
            const isBlackHole = (selectedSector as any).environment === 'black_hole';
            if (!isPlayerHere && !isAdjacent && !autopilot?.active && !isBlackHole) {
              const shipStats = ship?.stats ?? null;
              const apCost = shipStats ? calcHyperjumpAP(shipStats.engineSpeed) : 0;
              const fuelCost = shipStats ? calcHyperjumpFuel(shipStats.fuelPerJump, distance) : 0;
              return (
                <button
                  className="vs-btn"
                  style={{ marginTop: 8, display: 'block', width: '100%' }}
                  onClick={() => network.sendHyperJump(selectedSector.x, selectedSector.y)}
                >
                  [HYPERJUMP ({innerCoord(selectedSector.x)}, {innerCoord(selectedSector.y)})]
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
