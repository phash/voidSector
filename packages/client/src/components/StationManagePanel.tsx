import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import {
  STATION_EXPANSION_TYPES,
  expansionCost,
  STATION_TIER_THRESHOLDS,
  stationCargoCapacity,
  MAX_STATION_LEVEL,
} from '@void-sector/shared';

interface Props {
  station: any;
}

const EXPANSION_LABELS: Record<string, string> = {
  factory:  'Fabrik',
  cargo:    'Lager',
  markt:    'Markt',
  werft:    'Werft',
  refinery: 'Raffinerie',
  sensor:   'Sensor',
};

function formatCost(cost: ReturnType<typeof expansionCost>): string {
  const parts: string[] = [];
  if (cost.ore > 0)      parts.push(`${cost.ore} ORE`);
  if (cost.gas > 0)      parts.push(`${cost.gas} GAS`);
  if (cost.crystal > 0)  parts.push(`${cost.crystal} CRYSTAL`);
  if (cost.credits > 0)  parts.push(`${cost.credits} CR`);
  if (cost.artefact > 0) parts.push(`${cost.artefact} ART`);
  return parts.join(' · ');
}

function useCountdown(buildCompleteAt: string | null): string {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!buildCompleteAt) { setRemaining(''); return; }
    const update = () => {
      const ms = Date.parse(buildCompleteAt) - Date.now();
      if (ms <= 0) { setRemaining('FERTIG'); return; }
      const secs = Math.ceil(ms / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      setRemaining(`${m}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [buildCompleteAt]);
  return remaining;
}

function BuildInProgress({ station }: { station: any }) {
  const countdown = useCountdown(station.build_complete_at);
  const label = EXPANSION_LABELS[station.building_expansion] ?? station.building_expansion;
  return (
    <div style={{
      margin: '6px 0',
      padding: '4px 6px',
      border: '1px solid rgba(255,176,0,0.4)',
      background: 'rgba(255,176,0,0.06)',
    }}>
      <span style={{ color: '#FFB000' }}>⚙ {label.toUpperCase()} BAUT</span>
      {' — '}
      <span style={{ color: '#00BFFF' }}>{countdown}</span>
    </div>
  );
}

function BetriebBar({ station }: { station: any }) {
  const volume: number = station.trade_volume ?? 0;
  const stationLevel: number = station.level ?? 1;

  // Find the threshold for the next tier above current station level
  const nextThreshold = stationLevel < MAX_STATION_LEVEL
    ? STATION_TIER_THRESHOLDS[stationLevel] ?? null  // index = current level (0-based: threshold[stationLevel] is for level stationLevel+1)
    : null;

  const currentThreshold = STATION_TIER_THRESHOLDS[stationLevel - 1] ?? 0;
  const progress = nextThreshold != null && nextThreshold > currentThreshold
    ? Math.min(1, (volume - currentThreshold) / (nextThreshold - currentThreshold))
    : 1;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: '#888', fontSize: '0.6rem', letterSpacing: '0.08em', marginBottom: 2 }}>
        BETRIEB
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#00FF88', minWidth: 50 }}>{volume.toLocaleString()}</span>
        <div style={{ flex: 1, height: 4, background: 'rgba(0,255,136,0.15)' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: '#00FF88' }} />
        </div>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.55rem' }}>
          {nextThreshold != null ? `→ ${nextThreshold.toLocaleString()}` : 'MAX'}
        </span>
      </div>
    </div>
  );
}

function StationMarketSection({ station }: { station: any }) {
  const [amounts, setAmounts] = useState<Record<string, number>>({ ore: 1, gas: 1, crystal: 1 });
  const resources = ['ore', 'gas', 'crystal'] as const;
  const capacity = stationCargoCapacity(station.cargo_level ?? 0);
  const contents: Record<string, number> = station.cargo_contents ?? {};

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: '#FFB000', fontSize: '0.6rem', letterSpacing: '0.1em', marginBottom: 4 }}>
        ─── MARKT ───
      </div>
      <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
        Kapazität: {Object.values(contents).reduce((a, b) => a + b, 0)}/{capacity}
      </div>
      {resources.map((res) => (
        <div key={res} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ color: '#888', minWidth: 42, fontSize: '0.65rem' }}>{res.toUpperCase()}</span>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', minWidth: 28 }}>
            [{contents[res] ?? 0}]
          </span>
          <input
            type="number"
            min={1}
            value={amounts[res]}
            onChange={(e) => setAmounts((prev) => ({ ...prev, [res]: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
            style={{
              width: 40,
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,176,0,0.3)',
              color: '#FFB000',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              padding: '1px 3px',
              textAlign: 'center',
            }}
          />
          <button
            className="vs-btn"
            style={{ fontSize: '0.55rem' }}
            onClick={() => network.sendStationMarketTrade(station.id, 'buy', res, amounts[res])}
          >
            [KAUFEN]
          </button>
          <button
            className="vs-btn"
            style={{ fontSize: '0.55rem' }}
            onClick={() => network.sendStationMarketTrade(station.id, 'sell', res, amounts[res])}
          >
            [VERKAUFEN]
          </button>
        </div>
      ))}
    </div>
  );
}

export function StationManagePanel({ station }: Props) {
  const showTip = useStore((s) => s.showTip);

  // Show help tip on first visit
  useEffect(() => {
    showTip('first_station_expansions');
  }, [showTip]);

  const stationLevel: number = station.level ?? 1;
  const buildingExpansion: string | null = station.building_expansion ?? null;

  const handleBuild = useCallback((type: string) => {
    network.sendBuildStationExpansion(station.id, type);
  }, [station.id]);

  return (
    <div style={{ padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ letterSpacing: '0.1em', opacity: 0.6 }}>─── STATION VERWALTUNG ───</span>
        <button
          onClick={() => showTip('first_station_expansions')}
          style={{
            background: 'none',
            border: '1px solid var(--color-dim)',
            color: 'var(--color-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            padding: '0 4px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="Hilfe"
        >[?]</button>
      </div>

      {/* Station tier */}
      <div style={{ color: '#FFB000', marginBottom: 6, fontSize: '0.65rem' }}>
        STATION STUFE: {stationLevel}/{MAX_STATION_LEVEL}
      </div>

      {/* Betrieb bar */}
      <BetriebBar station={station} />

      {/* Build in progress */}
      {buildingExpansion && <BuildInProgress station={station} />}

      {/* Expansion list */}
      <div style={{ marginBottom: 4, color: '#888', fontSize: '0.6rem', letterSpacing: '0.08em' }}>
        ERWEITERUNGEN
      </div>
      {STATION_EXPANSION_TYPES.map((type) => {
        const currentLevel: number = station[`${type}_level`] ?? 0;
        const nextLevel = currentLevel + 1;
        const tierLocked = nextLevel > stationLevel;
        const atMax = currentLevel >= 5;
        const busy = buildingExpansion !== null;
        const cost = !atMax ? expansionCost(type, nextLevel) : null;

        return (
          <div key={type} style={{ marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, flexWrap: 'wrap' }}>
              <span style={{ color: '#00BFFF', minWidth: 70 }}>{EXPANSION_LABELS[type]}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem' }}>
                LV {currentLevel}/5
              </span>
              {!atMax && cost && (
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.55rem', flex: 1 }}>
                  {formatCost(cost)}
                </span>
              )}
            </div>
            {atMax && (
              <div style={{ color: 'rgba(0,191,255,0.4)', fontSize: '0.6rem' }}>MAX</div>
            )}
            {!atMax && tierLocked && (
              <div style={{ color: 'rgba(255,176,0,0.4)', fontSize: '0.6rem' }}>
                STATION STUFE {nextLevel} NÖTIG
              </div>
            )}
            {!atMax && !tierLocked && (
              <button
                className="vs-btn"
                style={{
                  fontSize: '0.6rem',
                  opacity: busy ? 0.4 : 1,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
                disabled={busy}
                onClick={() => handleBuild(type)}
                title={busy ? 'Station baut bereits eine Erweiterung' : undefined}
              >
                [BAUEN → LV{nextLevel}]
              </button>
            )}
          </div>
        );
      })}

      {/* Market section (markt_level >= 1) */}
      {(station.markt_level ?? 0) >= 1 && (
        <StationMarketSection station={station} />
      )}

      <div style={{ fontSize: '0.55rem', color: 'rgba(255,176,0,0.3)', marginTop: 6 }}>
        Sektor ({station.sectorX ?? station.sector_x}, {station.sectorY ?? station.sector_y})
      </div>
    </div>
  );
}
