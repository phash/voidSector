import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { network } from '../network/client';
import {
  SECTOR_COLORS,
  FUEL_COST_PER_UNIT,
  REP_PRICE_MODIFIERS,
  generateStationName,
  calcHyperjumpAP,
  calcHyperjumpFuel,
  innerCoord,
  JUMPGATE_BUILD_COST,
  STATION_BUILD_COSTS,
  CONQUEST_POOL_MAX,
  CONQUEST_RATE,
} from '@void-sector/shared';
import type { ChatChannel, ConstructionSiteState, DataSlate } from '@void-sector/shared';
import { JumpGatePanel } from './JumpGatePanel';
import { PlayerGatePanel } from './PlayerGatePanel';
import { StationManagePanel } from './StationManagePanel';
import { InlineError } from './InlineError';

type DrillDown =
  | { type: 'player'; username: string; sessionId: string }
  | { type: 'station'; name: string }
  | null;

// Capability labels shown in sector detail (#148)
const CAPABILITY_LABELS: Record<string, string> = {
  trade: 'TRADE',
  quest: 'QUEST',
  mine: 'MINE',
  jump: 'JUMP',
  build: 'BUILD',
  scan: 'SCAN',
};

function getSectorCapabilities(
  sector: any,
  jumpGateInfo: any,
  playerGateInfo: any,
  isPlayerHere: boolean,
): string[] {
  const caps: string[] = [];
  const contents: string[] = (sector as any).contents ?? [];
  const type: string = sector?.type ?? '';

  if (type === 'station' || contents.includes('station')) {
    caps.push('trade', 'quest');
  }
  if (
    type === 'asteroid_field' ||
    contents.includes('asteroid_field') ||
    type === 'nebula' ||
    contents.includes('nebula')
  ) {
    caps.push('mine');
  }
  if (jumpGateInfo || playerGateInfo || contents.includes('jumpgate')) {
    caps.push('jump');
  }
  if (isPlayerHere) {
    caps.push('build', 'scan');
  }
  return caps;
}

function RefuelPanel({
  fuel,
  isFreeRefuel,
}: {
  fuel: { current: number; max: number };
  isFreeRefuel: boolean;
}) {
  const { t } = useTranslation('ui');
  const [amount, setAmount] = useState(Math.max(100, Math.floor((fuel.max - fuel.current) / 100) * 100));
  const reputations = useStore((s) => s.reputations);
  const currentSector = useStore((s) => s.currentSector);
  const npcStationData = useStore((s) => s.npcStationData);

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

  const stationFuel = npcStationData?.stationFuel ?? 0;
  const stationGas = npcStationData?.stationGas ?? 0;
  const gasMode = stationGas >= 1;

  return (
    <div style={{ marginTop: 8, border: '1px solid var(--color-dim)', padding: '6px 8px' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: 4 }}>
        {t('detail.refuelLabel', { price: isFreeRefuel ? t('status.free') : `${unitCost} ${t('detail.crPerUnit')} (${repTier.toUpperCase()})` })}
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--color-dim)', marginBottom: 4, display: 'flex', gap: 8 }}>
        <span>BESTAND: {stationFuel.toLocaleString()} FUEL</span>
        <span style={{ color: gasMode ? '#00FF88' : 'var(--color-dim)' }}>
          GAS: {stationGas} {gasMode ? '▲ BOOST' : ''}
        </span>
      </div>
      <input
        type="range"
        min={100}
        max={Math.max(100, Math.floor(tankSpace / 100) * 100)}
        step={100}
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
        <span>{totalCost > 0 ? `${totalCost} CR` : t('status.free')}</span>
      </div>
      <button
        className="vs-btn"
        style={{ width: '100%', marginTop: 4, fontSize: '0.75rem' }}
        onClick={() => network.sendRefuel(amount)}
      >
        {t('detail.refuel')}
      </button>
    </div>
  );
}

const CONSTRUCTION_TYPE_LABELS: Record<string, string> = {
  mining_station: 'MINING-STATION',
  jumpgate: 'JUMPGATE',
  station: 'STATION',
  jumpgate_conn_2: 'JUMPGATE VERBINDUNG L2',
  jumpgate_conn_3: 'JUMPGATE VERBINDUNG L3',
  jumpgate_dist_2: 'JUMPGATE DISTANZ L2',
  jumpgate_dist_3: 'JUMPGATE DISTANZ L3',
};

function ConstructionSitePanel({ site }: { site: ConstructionSiteState }) {
  const cargo = useStore((s) => s.cargo);
  const playerCredits = useStore((s) => s.credits);
  const [amounts, setAmounts] = useState({ ore: 0, gas: 0, crystal: 0, credits: 0, artefact: 0 });

  const remainOre      = Math.max(0, site.neededOre      - site.depositedOre);
  const remainGas      = Math.max(0, site.neededGas      - site.depositedGas);
  const remainCrystal  = Math.max(0, site.neededCrystal  - site.depositedCrystal);
  const remainCredits  = Math.max(0, site.neededCredits  - site.depositedCredits);
  const remainArtefact = Math.max(0, site.neededArtefact - site.depositedArtefact);

  const maxOre      = Math.min(cargo.ore,           remainOre);
  const maxGas      = Math.min(cargo.gas,           remainGas);
  const maxCrystal  = Math.min(cargo.crystal,       remainCrystal);
  const maxCredits  = Math.min(playerCredits,       remainCredits);
  const maxArtefact = Math.min(cargo.artefact ?? 0, remainArtefact);

  const pct = site.progress;
  const canDeliver = amounts.ore + amounts.gas + amounts.crystal + amounts.credits + amounts.artefact > 0;
  const adminToken = localStorage.getItem('vs_admin_token');

  type ResKey = 'ore' | 'gas' | 'crystal' | 'credits' | 'artefact';
  const rows: [string, ResKey, number][] = [
    ['CREDITS',  'credits',  maxCredits],
    ['ORE',      'ore',      maxOre],
    ['GAS',      'gas',      maxGas],
    ['CRYSTAL',  'crystal',  maxCrystal],
    ['ARTEFAKT', 'artefact', maxArtefact],
  ];
  const deliverableRows = rows.filter(([, , max]) => max > 0);

  const statusRows: [string, number, number][] = [
    ['CREDITS',  site.depositedCredits,  site.neededCredits],
    ['ORE',      site.depositedOre,      site.neededOre],
    ['GAS',      site.depositedGas,      site.neededGas],
    ['CRYSTAL',  site.depositedCrystal,  site.neededCrystal],
    ['ARTEFAKT', site.depositedArtefact, site.neededArtefact],
  ];

  function setAmt(key: ResKey, raw: number, max: number) {
    const v = Math.max(0, Math.min(max, isNaN(raw) ? 0 : raw));
    setAmounts((prev) => ({ ...prev, [key]: v }));
  }

  function deliver() {
    network.sendDepositConstruction(site.id, amounts);
    setAmounts({ ore: 0, gas: 0, crystal: 0, credits: 0, artefact: 0 });
  }

  async function adminComplete() {
    if (!adminToken) return;
    const base = `${window.location.protocol}//${window.location.host}`;
    await fetch(`${base}/admin/api/construction-sites/${encodeURIComponent(site.id)}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }

  const typeLabel = CONSTRUCTION_TYPE_LABELS[site.type] ?? site.type.toUpperCase();

  return (
    <div style={{ marginTop: 8 }}>
      {/* Header */}
      <div style={{ fontSize: '0.65rem', color: 'var(--color-dim)', letterSpacing: '0.15em', marginBottom: 4 }}>
        {typeLabel} — IN BAU
        {site.paused && (
          <span style={{ color: '#ff4444', marginLeft: 8 }}>PAUSIERT</span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', marginBottom: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', transition: 'width 0.5s' }} />
      </div>
      <div style={{ fontSize: '0.6rem', color: 'var(--color-dim)', marginBottom: 6 }}>
        {pct}/100 Ticks
      </div>

      {/* Resource status */}
      {statusRows.filter(([, , needed]) => needed > 0).map(([label, deposited, needed]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
          <span style={{ color: 'var(--color-dim)' }}>{label}</span>
          <span style={{ color: deposited >= needed ? 'var(--color-primary)' : '#ffaa00' }}>
            {deposited}/{needed}
          </span>
        </div>
      ))}

      {/* Deposit sliders */}
      {deliverableRows.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {deliverableRows.map(([label, key, max]) => (
            <div key={key} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6rem' }}>
                <span style={{ color: 'var(--color-dim)', width: 50 }}>{label}</span>
                <input
                  type="range"
                  min={0}
                  max={max}
                  value={amounts[key]}
                  onChange={(e) => setAmt(key, Number(e.target.value), max)}
                  style={{ flex: 1, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                />
                <input
                  type="number"
                  min={0}
                  max={max}
                  value={amounts[key]}
                  onChange={(e) => setAmt(key, Number(e.target.value), max)}
                  style={{ width: 42, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontSize: '0.6rem', textAlign: 'center', padding: '1px 2px' }}
                />
                <button
                  className="vs-btn"
                  style={{ fontSize: '0.55rem', padding: '3px 6px' }}
                  onClick={() => setAmt(key, max, max)}
                >
                  MAX
                </button>
              </div>
            </div>
          ))}
          <button
            className="vs-btn"
            style={{ fontSize: '0.7rem', marginTop: 4, width: '100%' }}
            disabled={!canDeliver}
            onClick={deliver}
          >
            [LIEFERN]
          </button>
        </div>
      )}
      {adminToken && (
        <button
          className="vs-btn"
          style={{ fontSize: '0.65rem', marginTop: 8, width: '100%', borderColor: '#ff4444', color: '#ff4444' }}
          onClick={adminComplete}
        >
          [ADMIN: SOFORT VOLLENDEN]
        </button>
      )}
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
  const playerStationInfo = useStore((s) => s.playerStationInfo);
  const playerId = useStore((s) => s.playerId);
  const scanEvents = useStore((s) => s.scanEvents);
  const rescuedSurvivors = useStore((s) => s.rescuedSurvivors);
  const bookmarks = useStore((s) => s.bookmarks);

  const setDetailView = useStore((s) => s.setDetailView);
  const navigateToProgram = useStore((s) => s.navigateToProgram);

  const autopilot = useStore((s) => s.autopilot);
  const ship = useStore((s) => s.ship);

  const autoFollow = useStore((s) => s.autoFollow);
  const mining = useStore((s) => s.mining);
  const activeQuests = useStore((s) => s.activeQuests);
  const setActiveProgram = useStore((s) => s.setActiveProgram);
  const constructionSites = useStore((s) => s.constructionSites);
  const openStationTerminal = useStore((s) => s.openStationTerminal);
  const breadcrumbStack = useStore((s) => s.breadcrumbStack);
  const activeProgram = useStore((s) => s.activeProgram);
  const selectedSlateId = useStore((s) => s.selectedSlateId);
  const mySlates = useStore((s) => s.mySlates);
  const quadrantControls = useStore((s) => s.quadrantControls);

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

  const selectedSlate = selectedSlateId
    ? mySlates.find((s: DataSlate) => s.id === selectedSlateId)
    : null;

  if (activeProgram === 'CARGO' && selectedSlate) {
    return (
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        padding: '8px',
        height: '100%',
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: '0.85rem', marginBottom: 8, letterSpacing: '0.1em' }}>
          DATA SLATE [{selectedSlate.slateType === 'sector' ? 'SEKTOR'
            : selectedSlate.slateType === 'area' ? 'GEBIET'
            : selectedSlate.slateType === 'scan' ? 'SCAN'
            : selectedSlate.slateType === 'jumpgate' ? 'JUMPGATE'
            : 'CUSTOM'}]
        </div>

        <div style={{ opacity: 0.5, fontSize: '0.65rem', marginBottom: 8 }}>
          Erstellt: {new Date(selectedSlate.createdAt).toLocaleDateString('de-DE')}
        </div>

        {/* Custom slate content */}
        {selectedSlate.slateType === 'custom' && selectedSlate.customData && (
          <div>
            <div style={{ marginBottom: 4 }}>Label: {selectedSlate.customData.label}</div>
            {selectedSlate.customData.notes && (
              <div style={{ opacity: 0.7, marginBottom: 4, whiteSpace: 'pre-wrap' }}>
                {selectedSlate.customData.notes}
              </div>
            )}
            {selectedSlate.customData.coordinates && selectedSlate.customData.coordinates.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                Koordinaten: {selectedSlate.customData.coordinates.map((c: any) => `(${c.x},${c.y})`).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Jumpgate slate content */}
        {selectedSlate.slateType === 'jumpgate' && selectedSlate.sectorData?.[0] && (
          <div>
            <div>Gate-ID: {(selectedSlate.sectorData[0] as any).gateId}</div>
            <div>Position: ({(selectedSlate.sectorData[0] as any).sectorX}, {(selectedSlate.sectorData[0] as any).sectorY})</div>
            <div>Owner: {(selectedSlate.sectorData[0] as any).ownerName}</div>
          </div>
        )}

        {/* Sector/Area/Scan slate content — list of sectors */}
        {['sector', 'area', 'scan'].includes(selectedSlate.slateType) && selectedSlate.sectorData && (
          <div>
            {selectedSlate.sectorData.map((sec, i) => (
              <div key={i} style={{
                marginBottom: 6,
                padding: '4px 6px',
                border: '1px solid rgba(255,176,0,0.1)',
              }}>
                <div style={{ opacity: 0.5, fontSize: '0.65rem' }}>
                  {(sec as any).quadrantX !== undefined
                    ? `Q${(sec as any).quadrantX}:${(sec as any).quadrantY} — `
                    : ''}
                  ({sec.x}, {sec.y})
                </div>
                <div>Typ: {sec.type?.toUpperCase() ?? 'UNKNOWN'}</div>
                <div>Ore: {sec.ore} | Gas: {sec.gas} | Crystal: {sec.crystal}</div>
                {(sec as any).structures?.length > 0 && (
                  <div style={{ opacity: 0.7 }}>Strukturen: {(sec as any).structures.join(', ')}</div>
                )}
                {(sec as any).wrecks?.length > 0 && (
                  <div style={{ opacity: 0.7 }}>
                    Wracks: {(sec as any).wrecks.map((w: any) => `${w.playerName} (T${w.tier})`).join(', ')}
                  </div>
                )}
                {(sec as any).scannedAtTick !== undefined && (
                  <div style={{ opacity: 0.4, fontSize: '0.6rem' }}>
                    Scan-Tick: {(sec as any).scannedAtTick}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

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
  const constructionSite = constructionSites.find(
    (c) => c.sectorX === selectedSector.x && c.sectorY === selectedSector.y,
  );

  // Quest target detection (#151)
  const questsTargetingHere = activeQuests.filter((q) =>
    q.objectives.some(
      (o) => o.targetX === selectedSector.x && o.targetY === selectedSector.y && !o.fulfilled,
    ),
  );
  const playersHere = Object.values(players).filter(
    (p) => p.x === selectedSector.x && p.y === selectedSector.y,
  );

  const sectorColor = sector
    ? (SECTOR_COLORS[sector.type as keyof typeof SECTOR_COLORS] ?? SECTOR_COLORS.empty)
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
    const isStation = sector.type === 'station' || (sector as any).contents?.includes('station');
    const isFreeRefuel = false;
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
        {sector.type === 'station' && (() => {
          const stationFaction = (sector as any).faction as string | undefined;
          if (!stationFaction) return null;
          const sx = selectedSector?.x ?? 0;
          const sy = selectedSector?.y ?? 0;
          const qx = Math.floor((sx + 250) / 500);
          const qy = Math.floor((sy + 250) / 500);
          const qc = quadrantControls?.find((q) => q.qx === qx && q.qy === qy);
          const share = qc?.faction_shares?.[stationFaction];
          if (share === undefined || share >= 100) {
            return (
              <div style={{ marginTop: 4, marginBottom: 8, color: '#00FF88', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                ✓ FABRIK-MODUS
              </div>
            );
          }
          return (
            <div style={{ marginTop: 8, marginBottom: 8, borderTop: '1px solid #FF880044', paddingTop: 8 }}>
              <div style={{ color: '#FF8800', fontSize: '0.7rem', letterSpacing: '0.12em', marginBottom: 6 }}>
                ▶ CONQUEST MODE
              </div>
              <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: 2 }}>
                FORTSCHRITT: {Math.floor(share)} / 100
              </div>
              <div style={{ background: '#111', height: 6, marginBottom: 8 }}>
                <div style={{ background: '#FF8800', height: '100%', width: `${Math.min(100, share)}%` }} />
              </div>
            </div>
          );
        })()}
        {isPlayerHere && fuel && fuel.current < fuel.max && isStation && (
          <RefuelPanel fuel={fuel} isFreeRefuel={isFreeRefuel} />
        )}
        {isPlayerHere && jumpGateInfo && <JumpGatePanel gate={jumpGateInfo} />}
        {isPlayerHere && playerGateInfo && <PlayerGatePanel />}
        {isPlayerHere && playerStationInfo && playerStationInfo.ownerId === playerId && (
          <StationManagePanel station={playerStationInfo} />
        )}
        {isPlayerHere && sector?.type === 'station' && (
          <>
            <button
              className="vs-btn"
              style={{
                fontSize: '0.75rem',
                marginTop: 8,
                borderColor: '#00FF88',
                color: '#00FF88',
                display: 'block',
                width: '100%',
              }}
              onClick={openStationTerminal}
            >
              [ANDOCKEN]
            </button>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <button
                className="vs-btn"
                style={{ flex: 1, fontSize: '0.7rem' }}
                onClick={() => navigateToProgram('TRADE')}
              >
                [→ TRADE]
              </button>
              <button
                className="vs-btn"
                style={{ flex: 1, fontSize: '0.7rem' }}
                onClick={() => navigateToProgram('QUESTS')}
              >
                [→ QUESTS]
              </button>
            </div>
          </>
        )}
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
      {breadcrumbStack.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace', fontSize: '0.7rem', borderBottom: '1px solid #222', paddingBottom: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
          {breadcrumbStack.map((crumb, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <span style={{ color: '#333', margin: '0 2px' }}>›</span>}
              {i < breadcrumbStack.length - 1 ? (
                <button
                  onClick={() => setActiveProgram(crumb.program)}
                  style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.7rem', padding: 0 }}
                >
                  {crumb.label}
                </button>
              ) : (
                <span style={{ color: 'var(--color-primary)' }}>{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
      <div style={{ letterSpacing: '0.2em', color: sectorColor, marginBottom: 8 }}>
        SECTOR ({innerCoord(selectedSector.x)}, {innerCoord(selectedSector.y)})
      </div>

      {/* Capability chips — clickable quick-actions (#259) */}
      {sector &&
        (() => {
          const caps = getSectorCapabilities(sector, jumpGateInfo, playerGateInfo, isPlayerHere);
          if (caps.length === 0) return null;
          const capAction: Record<string, (() => void) | undefined> = {
            mine: () => setActiveProgram('MINING'),
            trade: () => setActiveProgram('TRADE'),
            quest: () => setActiveProgram('QUESTS'),
            scan: () => network.sendLocalScan(),
          };
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {caps.map((cap) => {
                const action = capAction[cap];
                return action ? (
                  <button
                    key={cap}
                    onClick={action}
                    style={{
                      fontSize: '0.6rem',
                      letterSpacing: '0.1em',
                      padding: '3px 6px',
                      border: '1px solid var(--color-primary)',
                      color: 'var(--color-primary)',
                      background: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      opacity: 0.9,
                    }}
                  >
                    {CAPABILITY_LABELS[cap]}
                  </button>
                ) : (
                  <span
                    key={cap}
                    style={{
                      fontSize: '0.6rem',
                      letterSpacing: '0.1em',
                      padding: '3px 6px',
                      border: '1px solid var(--color-dim)',
                      color: 'var(--color-dim)',
                      opacity: 0.8,
                    }}
                  >
                    {CAPABILITY_LABELS[cap]}
                  </span>
                );
              })}
            </div>
          );
        })()}

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
                  type: sector.type,
                  data: {
                    name:
                      sector.type === 'station'
                        ? generateStationName(selectedSector.x, selectedSector.y)
                        : sector.type.toUpperCase(),
                    position: `(${selectedSector.x}, ${selectedSector.y})`,
                    faction: (sector as any).faction,
                    resources: sector.resources
                      ? Object.entries(sector.resources)
                          .filter(([r]) => !r.startsWith('max'))
                          .map(([r, a]) => {
                            const maxKey = `max${r.charAt(0).toUpperCase()}${r.slice(1)}` as keyof typeof sector.resources;
                            const maxVal = sector.resources?.[maxKey];
                            return `${r.toUpperCase()} x${a}${maxVal ? `/${maxVal}` : ''}`;
                          })
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
              {Object.entries(sector.resources)
                .filter(([res]) => !res.startsWith('max'))
                .map(([res, amount]) => {
                  const maxKey = `max${res.charAt(0).toUpperCase()}${res.slice(1)}` as keyof typeof sector.resources;
                  const maxVal = sector.resources?.[maxKey];
                  return (
                    <div key={res}>
                      {res.toUpperCase()} ──── {amount}{maxVal ? `/${maxVal}` : ''}
                    </div>
                  );
                })}
            </>
          )}
          {isPlayerHere && (
            <div style={{ marginTop: 8, color: 'var(--color-primary)' }}>YOU ARE HERE</div>
          )}
          {/* Quest target hint (#151) */}
          {questsTargetingHere.length > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: '4px 6px',
                border: '1px solid rgba(255,176,0,0.5)',
                fontSize: '0.7rem',
              }}
            >
              <div style={{ color: '#FFB000', marginBottom: 2, letterSpacing: '0.1em' }}>
                ◎ QUEST-ZIEL
              </div>
              {questsTargetingHere.map((q) => (
                <div key={q.id} style={{ color: 'rgba(255,176,0,0.7)', fontSize: '0.65rem' }}>
                  <span
                    style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                    onClick={() => setActiveProgram('QUESTS')}
                  >
                    {q.title}
                  </span>
                </div>
              ))}
            </div>
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
          {/* Player station management */}
          {isPlayerHere && playerStationInfo && playerStationInfo.ownerId === playerId && (
            <StationManagePanel station={playerStationInfo} />
          )}

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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onClick={() =>
                    setDrillDown({
                      type: 'station',
                      name: generateStationName(selectedSector.x, selectedSector.y),
                    })
                  }
                >
                  <span>◆ {generateStationName(selectedSector.x, selectedSector.y)}</span>
                  <span style={{ display: 'flex', gap: 2 }}>
                    {['TRADE', 'QUEST', 'REFUEL'].map((cap) => (
                      <span
                        key={cap}
                        style={{
                          fontSize: '0.55rem',
                          padding: '0px 3px',
                          border: '1px solid rgba(0,191,255,0.4)',
                          color: 'rgba(0,191,255,0.6)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {cap}
                      </span>
                    ))}
                  </span>
                </button>
              )}
              {playersHere.map((p) => (
                <button
                  key={p.sessionId}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#00FF88',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    padding: '2px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                  }}
                  onClick={() => {
                    if (p.userId) {
                      network.getPlayerCard(p.userId);
                    } else {
                      setDrillDown({ type: 'player', username: p.username, sessionId: p.sessionId });
                    }
                  }}
                >
                  <span>{p.mining ? '⛏' : '◆'} {p.username}</span>
                  {p.acepTotal > 0 && (
                    <span style={{ fontSize: '0.55rem', color: 'var(--color-dim)' }}>
                      ACEP:{p.acepTotal}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Build buttons - only when player is here */}
          {isPlayerHere && constructionSite ? (
            <ConstructionSitePanel key={constructionSite.id} site={constructionSite} />
          ) : isPlayerHere ? (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--color-dim)',
                  letterSpacing: '0.15em',
                  marginBottom: 6,
                }}
              >
                BAUEN
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  <button
                    className="vs-btn"
                    onClick={() => network.sendBuildStation()}
                    style={{ fontSize: '0.7rem' }}
                  >
                    [STATION BAUEN]
                  </button>
                  <div style={{ fontSize: '0.6rem', color: 'var(--color-dim)', marginTop: 2 }}>
                    {STATION_BUILD_COSTS[1].credits} CR · {STATION_BUILD_COSTS[1].crystal} CRYSTAL ·{' '}
                    {STATION_BUILD_COSTS[1].artefact} ARTEFAKT
                  </div>
                </div>
                {!playerGateInfo && (
                  <div>
                    <button
                      className="vs-btn"
                      onClick={() => network.sendBuild('jumpgate')}
                      style={{ fontSize: '0.7rem' }}
                    >
                      [JUMPGATE BAUEN]
                    </button>
                    <div style={{ fontSize: '0.6rem', color: 'var(--color-dim)', marginTop: 2 }}>
                      {JUMPGATE_BUILD_COST.credits} CR · {JUMPGATE_BUILD_COST.crystal} CRYSTAL ·{' '}
                      {JUMPGATE_BUILD_COST.artefact} ARTEFAKT
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {isPlayerHere && <InlineError codes={['BUILD_FAIL', 'INSUFFICIENT']} />}

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
              const hasEnoughFuel = (fuel?.current ?? 0) >= fuelCost;
              return (
                <>
                  <button
                    className="vs-btn"
                    disabled={!hasEnoughFuel}
                    style={{
                      marginTop: 8,
                      display: 'block',
                      width: '100%',
                      opacity: hasEnoughFuel ? 1 : 0.5,
                    }}
                    onClick={() => network.sendHyperJump(selectedSector.x, selectedSector.y)}
                  >
                    [HYPERJUMP ({innerCoord(selectedSector.x)}, {innerCoord(selectedSector.y)})]
                    {shipStats ? ` ${apCost}AP / ${fuelCost}F` : ''}
                  </button>
                  <InlineError codes={['HYPERJUMP_FAIL']} />
                </>
              );
            }
            return null;
          })()}
        </>
      ) : (
        <div style={{ opacity: 0.4 }}>UNEXPLORED</div>
      )}

      {/* Bookmark button — always visible when a sector is selected */}
      {(() => {
        const freeSlot = [1, 2, 3, 4, 5].find((s) => !bookmarks.find((b) => b.slot === s));
        const alreadyBookmarked = bookmarks.some(
          (b) => b.sectorX === selectedSector.x && b.sectorY === selectedSector.y,
        );
        if (alreadyBookmarked) {
          return (
            <button className="vs-btn" style={{ fontSize: '0.7rem', marginTop: 4 }} disabled>
              [BOOKMARKED]
            </button>
          );
        }
        return (
          <button
            className="vs-btn"
            style={{ fontSize: '0.7rem', marginTop: 4, opacity: freeSlot ? 1 : 0.4 }}
            onClick={() => {
              if (freeSlot) {
                network.sendSetBookmark(
                  freeSlot,
                  selectedSector.x,
                  selectedSector.y,
                  `${(sector?.type || 'sector').toUpperCase()} (${selectedSector.x},${selectedSector.y})`,
                );
              }
            }}
            disabled={!freeSlot}
            title={freeSlot ? 'Sektor speichern' : 'Alle 5 Bookmark-Slots belegt'}
          >
            [BOOKMARK]
          </button>
        );
      })()}
    </div>
  );
}
