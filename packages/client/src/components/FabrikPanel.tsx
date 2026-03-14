import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULES, SPECIALIZED_SLOT_INDEX } from '@void-sector/shared';

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

function AcepTab() {
  const { t } = useTranslation('ui');
  const inventory = useStore((s) => s.inventory);
  const ship = useStore((s) => s.ship);
  const acepBlueprints = useStore((s) => s.acepFactoryBlueprints);

  useEffect(() => {
    network.requestAcepBlueprints();
  }, []);

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
          const mod = MODULES[moduleId];
          if (!mod) return null;
          return (
            <div key={moduleId} style={rowStyle}>
              <span style={{ color: green }}>
                {mod.name ?? moduleId}
                <CostDisplay moduleId={moduleId} />
              </span>
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
                  const modDef = MODULES[m.itemId];
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
  const mod = MODULES[moduleId];
  if (!mod?.cost) return null;
  const parts: string[] = [];
  if (mod.cost.credits) parts.push(`${mod.cost.credits} CR`);
  if (mod.cost.ore) parts.push(`${mod.cost.ore} ORE`);
  if (mod.cost.gas) parts.push(`${mod.cost.gas} GAS`);
  if (mod.cost.crystal) parts.push(`${mod.cost.crystal} CRYSTAL`);
  if (mod.cost.artefact) parts.push(`${mod.cost.artefact} ART`);
  if (parts.length === 0) return null;
  return (
    <span style={{ fontSize: '0.55rem', opacity: 0.5, marginLeft: 4 }}>
      {parts.join(' · ')}
    </span>
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
              const mod = MODULES[moduleId];
              if (!mod) return null;
              return (
                <div key={moduleId} style={rowStyle}>
                  <span style={{ color: '#00BFFF' }}>
                    {mod.name ?? moduleId}
                    <CostDisplay moduleId={moduleId} />
                  </span>
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
