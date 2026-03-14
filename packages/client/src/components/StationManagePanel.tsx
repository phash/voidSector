import { useState, useEffect } from 'react';
import { network } from '../network/client';
import {
  STATION_BUILD_COSTS,
  STATION_MODULE_UPGRADE_COST,
  MAX_STATION_LEVEL,
} from '@void-sector/shared';
import type { PlayerStation } from '@void-sector/shared';

interface Props {
  station: PlayerStation;
}

function formatCosts(costs: { credits: number; crystal: number; artefact: number }): string {
  return `${costs.credits} CR · ${costs.crystal} CRYSTAL · ${costs.artefact} ARTEFAKT`;
}

export function StationManagePanel({ station }: Props) {
  const [confirmUpgrade, setConfirmUpgrade] = useState<string | null>(null);

  // Reset confirm on station change
  useEffect(() => {
    setConfirmUpgrade(null);
  }, [station.level, station.factoryLevel, station.cargoLevel]);

  const canUpgradeStation = station.level < MAX_STATION_LEVEL;
  const nextStationCosts = canUpgradeStation
    ? STATION_BUILD_COSTS[(station.level + 1) as keyof typeof STATION_BUILD_COSTS]
    : null;

  const canUpgradeFactory = station.factoryLevel < station.level;
  const nextFactoryCost = canUpgradeFactory ? STATION_MODULE_UPGRADE_COST(station.factoryLevel + 1) : 0;

  const canUpgradeCargo = station.cargoLevel < station.level;
  const nextCargoCost = canUpgradeCargo ? STATION_MODULE_UPGRADE_COST(station.cargoLevel + 1) : 0;

  const handleUpgrade = (key: string, action: () => void) => {
    if (confirmUpgrade === key) {
      action();
      setConfirmUpgrade(null);
    } else {
      setConfirmUpgrade(key);
    }
  };

  return (
    <div style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
      <div style={{ letterSpacing: '0.1em', opacity: 0.6, marginBottom: 6 }}>
        ─── STATION VERWALTUNG ───
      </div>

      {/* Station Level */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: '#FFB000', marginBottom: 4 }}>
          STATION LEVEL: {station.level}/{MAX_STATION_LEVEL}
        </div>
        <div style={{
          height: 4,
          background: 'rgba(255,176,0,0.15)',
          marginBottom: 4,
        }}>
          <div style={{
            height: '100%',
            width: `${(station.level / MAX_STATION_LEVEL) * 100}%`,
            background: '#FFB000',
          }} />
        </div>
        {canUpgradeStation && nextStationCosts && (
          <button
            className="vs-btn"
            style={{
              fontSize: '0.65rem',
              borderColor: confirmUpgrade === 'station' ? '#00FF88' : undefined,
              color: confirmUpgrade === 'station' ? '#00FF88' : undefined,
            }}
            onClick={() => handleUpgrade('station', () => network.sendUpgradeStation(station.id))}
          >
            {confirmUpgrade === 'station'
              ? `[BESTÄTIGEN — ${formatCosts(nextStationCosts)}]`
              : `[UPGRADE → LV${station.level + 1}] ${formatCosts(nextStationCosts)}`}
          </button>
        )}
        {!canUpgradeStation && (
          <div style={{ color: 'rgba(255,176,0,0.4)', fontSize: '0.6rem' }}>MAX LEVEL</div>
        )}
      </div>

      {/* Factory Module */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: '#00BFFF', marginBottom: 4 }}>
          FACTORY: LV {station.factoryLevel}/{station.level}
        </div>
        {station.factoryLevel > 0 && (
          <div style={{
            height: 3,
            background: 'rgba(0,191,255,0.15)',
            marginBottom: 4,
          }}>
            <div style={{
              height: '100%',
              width: `${(station.factoryLevel / station.level) * 100}%`,
              background: '#00BFFF',
            }} />
          </div>
        )}
        {canUpgradeFactory && (
          <button
            className="vs-btn"
            style={{
              fontSize: '0.65rem',
              borderColor: confirmUpgrade === 'factory' ? '#00FF88' : undefined,
              color: confirmUpgrade === 'factory' ? '#00FF88' : undefined,
            }}
            onClick={() => handleUpgrade('factory', () =>
              network.sendUpgradeStationModule(station.id, 'factory'),
            )}
          >
            {confirmUpgrade === 'factory'
              ? `[BESTÄTIGEN — ${nextFactoryCost} CR]`
              : `[UPGRADE → LV${station.factoryLevel + 1}] ${nextFactoryCost} CR`}
          </button>
        )}
        {!canUpgradeFactory && station.factoryLevel > 0 && (
          <div style={{ color: 'rgba(0,191,255,0.4)', fontSize: '0.6rem' }}>
            STATION LEVEL ERHÖHEN FÜR WEITERES UPGRADE
          </div>
        )}
        {station.factoryLevel === 0 && !canUpgradeFactory && (
          <div style={{ color: 'rgba(0,191,255,0.4)', fontSize: '0.6rem' }}>
            STATION LEVEL ERHÖHEN UM FACTORY FREIZUSCHALTEN
          </div>
        )}
      </div>

      {/* Cargo Module */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: '#00FF88', marginBottom: 4 }}>
          CARGO: LV {station.cargoLevel}/{station.level}
        </div>
        {station.cargoLevel > 0 && (
          <div style={{
            height: 3,
            background: 'rgba(0,255,136,0.15)',
            marginBottom: 4,
          }}>
            <div style={{
              height: '100%',
              width: `${(station.cargoLevel / station.level) * 100}%`,
              background: '#00FF88',
            }} />
          </div>
        )}
        {canUpgradeCargo && (
          <button
            className="vs-btn"
            style={{
              fontSize: '0.65rem',
              borderColor: confirmUpgrade === 'cargo' ? '#00FF88' : undefined,
              color: confirmUpgrade === 'cargo' ? '#00FF88' : undefined,
            }}
            onClick={() => handleUpgrade('cargo', () =>
              network.sendUpgradeStationModule(station.id, 'cargo'),
            )}
          >
            {confirmUpgrade === 'cargo'
              ? `[BESTÄTIGEN — ${nextCargoCost} CR]`
              : `[UPGRADE → LV${station.cargoLevel + 1}] ${nextCargoCost} CR`}
          </button>
        )}
        {!canUpgradeCargo && station.cargoLevel > 0 && (
          <div style={{ color: 'rgba(0,255,136,0.4)', fontSize: '0.6rem' }}>
            STATION LEVEL ERHÖHEN FÜR WEITERES UPGRADE
          </div>
        )}
        {station.cargoLevel === 0 && !canUpgradeCargo && (
          <div style={{ color: 'rgba(0,255,136,0.4)', fontSize: '0.6rem' }}>
            STATION LEVEL ERHÖHEN UM CARGO FREIZUSCHALTEN
          </div>
        )}
      </div>

      <div style={{ fontSize: '0.55rem', color: 'rgba(255,176,0,0.3)', marginTop: 4 }}>
        Sektor ({station.sectorX}, {station.sectorY}) · Quadrant ({station.quadrantX}:{station.quadrantY})
      </div>
    </div>
  );
}
