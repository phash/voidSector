import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { RESOURCE_TYPES, innerCoord } from '@void-sector/shared';
import type { MineableResourceType } from '@void-sector/shared';
import { btn, UI } from '../ui-strings';
import { InlineError } from './InlineError';

function ResourceBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = 10;
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  const bar = '\u2587'.repeat(filled) + '\u2591'.repeat(width - filled);
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
      {label.padEnd(10)} {bar} {String(value).padStart(3)}
    </div>
  );
}

export function MiningScreen() {
  const mining = useStore((s) => s.mining);
  const currentSector = useStore((s) => s.currentSector);
  const position = useStore((s) => s.position);
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);

  const [miningProgress, setMiningProgress] = useState(0);

  useEffect(() => {
    if (!mining?.active || mining.startedAt === null) {
      setMiningProgress(0);
      return;
    }
    const startedAt = mining.startedAt;
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setMiningProgress(Math.min(1, (elapsed * mining.rate) / mining.sectorYield));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [mining?.active, mining?.startedAt, mining?.rate, mining?.sectorYield]);

  const resources = currentSector?.resources || { ore: 0, gas: 0, crystal: 0 };
  const maxYield = Math.max(resources.ore, resources.gas, resources.crystal, 1);
  const hasResources = resources.ore > 0 || resources.gas > 0 || resources.crystal > 0;
  const cargoCap = ship?.stats?.cargoCap ?? 5;
  const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      <div
        style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '12px' }}
      >
        MINING OPERATIONS
      </div>

      <div style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
        SECTOR ({innerCoord(position.x)}, {innerCoord(position.y)}) —{' '}
        {currentSector?.type?.toUpperCase() || 'UNKNOWN'}
      </div>

      {!hasResources && !mining?.active && (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-dim)', marginBottom: '12px' }}>
          {UI.empty.NO_RESOURCES}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <ResourceBar label="ORE" value={resources.ore} max={maxYield} />
        <ResourceBar label="GAS" value={resources.gas} max={maxYield} />
        <ResourceBar label="CRYSTAL" value={resources.crystal} max={maxYield} />
      </div>

      <div
        style={{
          fontSize: '0.9rem',
          marginBottom: '16px',
          padding: '8px',
          border: '1px solid var(--color-dim)',
        }}
      >
        {mining?.active ? (
          <>
            <div style={{ marginBottom: '6px' }}>
              MINING {mining.resource?.toUpperCase()} — RATE: {mining.rate}u/s |{' '}
              {UI.status.YIELD}: {Math.round(miningProgress * mining.sectorYield)}/{mining.sectorYield}u
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div
                style={{
                  flex: 1,
                  height: '6px',
                  background: '#0a0a0a',
                  border: '1px solid rgba(255,176,0,0.3)',
                }}
              >
                <div
                  style={{
                    width: `${miningProgress * 100}%`,
                    height: '100%',
                    background: 'var(--color-primary)',
                    transition: 'width 0.2s linear',
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <div>STATUS: {UI.status.IDLE}</div>
        )}
        <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '4px' }}>
          CARGO: {cargoTotal}/{cargoCap} — ORE:{cargo.ore} GAS:{cargo.gas} CRYSTAL:{cargo.crystal}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {RESOURCE_TYPES.map((res: MineableResourceType) => (
          <button
            key={res}
            className="vs-btn"
            disabled={mining?.active === true || resources[res] <= 0}
            onClick={() => network.sendMine(res)}
          >
            [MINE {res.toUpperCase()}]
          </button>
        ))}
        <button
          className="vs-btn"
          disabled={!mining?.active}
          onClick={() => network.sendStopMine()}
        >
          {btn(UI.actions.STOP)}
        </button>
      </div>
      <InlineError codes={['NO_RESOURCES', 'MINE_FAILED', 'RATE_LIMIT', 'INVALID_INPUT']} />
    </div>
  );
}
