import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULE_MAP, SPECIALIZED_SLOT_INDEX } from '@void-sector/shared';

const green = '#00FF88';
const dimGreen = 'rgba(0,255,136,0.3)';
const amber = '#FFB000';

const panelStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.7rem',
  overflowY: 'auto',
  height: '100%',
};

const headerStyle: React.CSSProperties = {
  borderBottom: `1px solid ${dimGreen}`,
  paddingBottom: 3,
  marginBottom: 6,
  letterSpacing: '0.1em',
  opacity: 0.7,
  marginTop: 8,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  borderBottom: 'rgba(0,255,136,0.1)',
  gap: 8,
  flexWrap: 'wrap',
};

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${green}`,
  color: green,
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  padding: '2px 6px',
  cursor: 'pointer',
};

function CraftProgress() {
  const craftSite = useStore((s) => s.craftSite);
  const cargo = useStore((s) => s.cargo);
  const credits = useStore((s) => s.credits);

  useEffect(() => {
    if (!craftSite) return;
    const iv = setInterval(() => network.sendGetCraftStatus(), 5000);
    return () => clearInterval(iv);
  }, [craftSite?.id]);

  if (!craftSite) return null;
  const mod = MODULE_MAP.get(craftSite.module_id);
  const pct = craftSite.duration > 0 ? Math.floor((craftSite.progress / craftSite.duration) * 100) : 0;
  const remaining = craftSite.duration - craftSite.progress;
  const ticksPerSec = 5 / 5; // 5 progress per 5s tick = 1/s
  const etaSec = Math.ceil(remaining / ticksPerSec);
  const etaMin = Math.floor(etaSec / 60);
  const etaS = etaSec % 60;
  const etaStr = etaMin > 0 ? `${etaMin}m ${etaS}s` : `${etaS}s`;

  const allDeposited =
    craftSite.deposited_ore >= craftSite.needed_ore &&
    craftSite.deposited_gas >= craftSite.needed_gas &&
    craftSite.deposited_crystal >= craftSite.needed_crystal &&
    craftSite.deposited_credits >= craftSite.needed_credits;

  function depositAll() {
    if (!craftSite) return;
    network.sendDepositCraftResources({
      ore: Math.min(cargo.ore ?? 0, craftSite.needed_ore - craftSite.deposited_ore),
      gas: Math.min(cargo.gas ?? 0, craftSite.needed_gas - craftSite.deposited_gas),
      crystal: Math.min(cargo.crystal ?? 0, craftSite.needed_crystal - craftSite.deposited_crystal),
      credits: Math.min(credits, craftSite.needed_credits - craftSite.deposited_credits),
    });
  }

  return (
    <div>
      <div style={{ ...headerStyle, marginTop: 0, color: amber }}>
        HERSTELLUNG: {mod?.name ?? craftSite.module_id.toUpperCase().replace(/_/g, ' ')}
      </div>
      <div style={{ margin: '8px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: amber }}>
          <span>{pct}% {allDeposited && remaining > 0 ? `— ${etaStr}` : ''}</span>
          <span>{craftSite.progress}/{craftSite.duration}</span>
        </div>
        <div style={{ background: '#222', height: 8, marginTop: 2 }}>
          <div style={{ background: amber, height: '100%', width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
        {!allDeposited && (
          <div style={{ color: '#f44', fontSize: '0.6rem', marginTop: 2 }}>PAUSIERT — Rohstoffe fehlen</div>
        )}
      </div>
      <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        {craftSite.needed_ore > 0 && (
          <ResRow label="ORE" dep={craftSite.deposited_ore} need={craftSite.needed_ore} />
        )}
        {craftSite.needed_gas > 0 && (
          <ResRow label="GAS" dep={craftSite.deposited_gas} need={craftSite.needed_gas} />
        )}
        {craftSite.needed_crystal > 0 && (
          <ResRow label="CRYSTAL" dep={craftSite.deposited_crystal} need={craftSite.needed_crystal} />
        )}
        {craftSite.needed_credits > 0 && (
          <ResRow label="CREDITS" dep={craftSite.deposited_credits} need={craftSite.needed_credits} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {!allDeposited && (
          <button style={{ ...btnStyle, borderColor: amber, color: amber }} onClick={depositAll}>
            [EINZAHLEN]
          </button>
        )}
        <button
          style={{ ...btnStyle, borderColor: '#f44', color: '#f44' }}
          onClick={() => network.sendCancelCraft()}
        >
          [ABBRECHEN]
        </button>
      </div>
    </div>
  );
}

function ResRow({ label, dep, need }: { label: string; dep: number; need: number }) {
  const done = dep >= need;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: done ? green : amber }}>{label}</span>
      <span style={{ color: done ? green : '#888' }}>{dep}/{need}</span>
    </div>
  );
}

function AcepTab() {
  const { t } = useTranslation('ui');
  const inventory = useStore((s) => s.inventory);
  const ship = useStore((s) => s.ship);
  const acepBlueprints = useStore((s) => s.acepFactoryBlueprints);
  const craftSite = useStore((s) => s.craftSite);

  useEffect(() => {
    network.requestAcepBlueprints();
    network.sendGetCraftStatus();
    useStore.getState().showTip('first_fabrik');
  }, []);

  if (craftSite) {
    return <CraftProgress />;
  }

  const blueprintsInCargo = inventory.filter((i) => i.itemType === 'blueprint');
  const cargoModules = inventory.filter((i) => i.itemType === 'module');
  const installedIds = new Set((ship?.modules ?? []).map((m) => m.moduleId));

  return (
    <div>
      {/* Consumed blueprints — available for crafting */}
      <div style={{ ...headerStyle, marginTop: 0, color: green }}>VERFÜGBARE REZEPTE</div>
      {acepBlueprints.length === 0 ? (
        <div style={{ opacity: 0.4, color: green }}>KEINE BLUEPRINTS EINGELEGT</div>
      ) : (
        acepBlueprints.map((moduleId) => {
          const mod = MODULE_MAP.get(moduleId);
          if (!mod) return null;
          return (
            <div key={moduleId} style={rowStyle}>
              <div style={{ color: green }}>
                {mod.name ?? moduleId}
                <CostDisplay moduleId={moduleId} />
              </div>
              <button
                style={btnStyle}
                onClick={() => network.sendCraftModule(moduleId)}
              >
                {t('fabrik.manufacture')}
              </button>
            </div>
          );
        })
      )}

      {/* Blueprints in cargo — can be consumed */}
      {blueprintsInCargo.length > 0 && (
        <>
          <div style={headerStyle}>BLUEPRINTS IM CARGO → EINLEGEN</div>
          {blueprintsInCargo.map((bp) => (
            <div key={bp.itemId} style={rowStyle}>
              <span style={{ color: amber }}>{bp.itemId.toUpperCase().replace(/_/g, ' ')}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  style={{ ...btnStyle, borderColor: amber, color: amber }}
                  onClick={() => network.sendConsumeBlueprint('acep', bp.itemId)}
                >
                  [EINLEGEN]
                </button>
                <button
                  style={btnStyle}
                  onClick={() => network.sendActivateBlueprint(bp.itemId)}
                >
                  {t('fabrik.activate')}
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Cargo modules — install */}
      {cargoModules.length > 0 && (
        <>
          <div style={headerStyle}>{t('fabrik.fromCargo')}</div>
          {cargoModules.map((m) => (
            <div key={m.itemId} style={rowStyle}>
              <span style={{ color: green }}>
                {m.itemId.toUpperCase().replace(/_/g, ' ')} x{m.quantity}
              </span>
              <button
                style={{ ...btnStyle, opacity: installedIds.has(m.itemId) ? 0.4 : 1 }}
                disabled={installedIds.has(m.itemId)}
                onClick={() => {
                  const modDef = MODULE_MAP.get(m.itemId);
                  const slot = modDef ? (SPECIALIZED_SLOT_INDEX[modDef.category] ?? 0) : 0;
                  network.sendInstallModule('', m.itemId, slot);
                }}
              >
                {installedIds.has(m.itemId) ? t('fabrik.installed') : t('fabrik.install')}
              </button>
            </div>
          ))}
        </>
      )}

      {acepBlueprints.length === 0 && blueprintsInCargo.length === 0 && cargoModules.length === 0 && (
        <div style={{ opacity: 0.4, marginTop: 8, color: green }}>
          {t('fabrik.noModulesOrBlueprints')}
        </div>
      )}
    </div>
  );
}

function CostDisplay({ moduleId }: { moduleId: string }) {
  const mod = MODULE_MAP.get(moduleId);
  if (!mod) return null;
  const parts: string[] = [];
  if (mod.costCredits) parts.push(`${mod.costCredits} CR`);
  if (mod.costOre) parts.push(`${mod.costOre} ORE`);
  if (mod.costGas) parts.push(`${mod.costGas} GAS`);
  if (mod.costCrystal) parts.push(`${mod.costCrystal} CRYSTAL`);
  if (mod.costArtefact && mod.costArtefact !== '0') parts.push(`${mod.costArtefact} ART`);
  if (parts.length === 0) return null;
  return (
    <div style={{ fontSize: '0.55rem', opacity: 0.5, marginTop: 1 }}>
      {parts.join(' · ')}
    </div>
  );
}

function StationTab() {
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const stations = useStore((s) => s.myStations);
  const stationBlueprintsMap = useStore((s) => s.stationBlueprintsMap);
  const inventory = useStore((s) => s.inventory);

  useEffect(() => {
    network.requestMyStations();
  }, []);

  // When a station is selected, request its details (blueprints)
  useEffect(() => {
    if (selectedStation) {
      network.requestStationDetails(selectedStation);
    }
  }, [selectedStation]);

  const blueprintsInCargo = inventory.filter((i) => i.itemType === 'blueprint');
  const stationsWithFactory = stations.filter((s) => s.factory_level >= 1);
  const selected = stations.find((s) => s.id === selectedStation);
  const stationBlueprints = selectedStation ? (stationBlueprintsMap[selectedStation] ?? []) : [];

  return (
    <div>
      <div style={{ ...headerStyle, marginTop: 0, color: '#00BFFF' }}>STATIONEN</div>

      {stations.length === 0 ? (
        <div style={{ opacity: 0.4, color: '#00BFFF', fontSize: '0.6rem' }}>
          KEINE STATIONEN GEBAUT
        </div>
      ) : stationsWithFactory.length === 0 ? (
        <div style={{ opacity: 0.4, color: '#00BFFF', fontSize: '0.6rem' }}>
          Keine Station hat eine Factory. Nutze VERWALTUNG im Detail-Panel um Factory auszubauen.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
          {stationsWithFactory.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStation(s.id)}
              style={{
                background: selectedStation === s.id ? '#00BFFF' : 'transparent',
                color: selectedStation === s.id ? '#000' : '#00BFFF',
                border: '1px solid #00BFFF',
                padding: '3px 6px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                textAlign: 'left',
              }}
            >
              ({s.sector_x}, {s.sector_y}) · FAB L{s.factory_level} · CARGO L{s.cargo_level}
            </button>
          ))}
        </div>
      )}

      {/* Selected station: show recipes + blueprints */}
      {selected && (
        <>
          {/* Station blueprints — available for crafting */}
          <div style={{ ...headerStyle, color: '#00BFFF' }}>VERFÜGBARE REZEPTE</div>
          {stationBlueprints.length === 0 ? (
            <div style={{ opacity: 0.4, color: '#00BFFF', fontSize: '0.6rem' }}>
              KEINE BLUEPRINTS IN DIESER FACTORY
            </div>
          ) : (
            stationBlueprints.map((moduleId) => {
              const mod = MODULE_MAP.get(moduleId);
              if (!mod) return null;
              return (
                <div key={moduleId} style={rowStyle}>
                  <div style={{ color: '#00BFFF' }}>
                    {mod.name ?? moduleId}
                    <CostDisplay moduleId={moduleId} />
                  </div>
                  <button
                    style={{ ...btnStyle, borderColor: '#00BFFF', color: '#00BFFF' }}
                    onClick={() => network.sendStartProduction(selected.id, moduleId, 1)}
                  >
                    [HERSTELLEN]
                  </button>
                </div>
              );
            })
          )}

          {/* Blueprints in cargo — consume into station */}
          {blueprintsInCargo.length > 0 && (
            <>
              <div style={{ ...headerStyle, color: '#00BFFF' }}>BLUEPRINTS EINLEGEN</div>
              {blueprintsInCargo.map((bp) => (
                <div key={bp.itemId} style={rowStyle}>
                  <span style={{ color: amber }}>{bp.itemId.toUpperCase().replace(/_/g, ' ')}</span>
                  <button
                    style={{ ...btnStyle, borderColor: '#00BFFF', color: '#00BFFF' }}
                    onClick={() => network.sendConsumeBlueprint('station', bp.itemId, selected.id)}
                  >
                    [EINLEGEN]
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Station cargo overview */}
          {selected.cargo_contents && Object.keys(selected.cargo_contents).length > 0 && (
            <>
              <div style={{ ...headerStyle, color: '#00BFFF' }}>STATIONS-CARGO</div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(0,191,255,0.6)' }}>
                {Object.entries(selected.cargo_contents)
                  .filter(([, v]) => (v as number) > 0)
                  .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
                  .join(' · ') || 'LEER'}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function FabrikPanel() {
  const [tab, setTab] = useState<'acep' | 'station'>('acep');

  return (
    <div style={panelStyle}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
        {(['acep', 'station'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              background: tab === t ? (t === 'acep' ? green : '#00BFFF') : 'transparent',
              color: tab === t ? '#000' : (t === 'acep' ? green : '#00BFFF'),
              border: `1px solid ${t === 'acep' ? green : '#00BFFF'}`,
              padding: '3px 6px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              letterSpacing: '0.1em',
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'acep' && <AcepTab />}
      {tab === 'station' && <StationTab />}
    </div>
  );
}
