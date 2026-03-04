import { useStore } from '../state/store';
import { network } from '../network/client';
import { RESOURCE_TYPES } from '@void-sector/shared';
import type { MineableResourceType } from '@void-sector/shared';

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

  const resources = currentSector?.resources || { ore: 0, gas: 0, crystal: 0 };
  const maxYield = Math.max(resources.ore, resources.gas, resources.crystal, 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '12px' }}>
        MINING OPERATIONS
      </div>

      <div style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
        SECTOR ({position.x}, {position.y}) — {currentSector?.type?.toUpperCase() || 'UNKNOWN'}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <ResourceBar label="ORE" value={resources.ore} max={maxYield} />
        <ResourceBar label="GAS" value={resources.gas} max={maxYield} />
        <ResourceBar label="CRYSTAL" value={resources.crystal} max={maxYield} />
      </div>

      <div style={{
        fontSize: '0.9rem',
        marginBottom: '16px',
        padding: '8px',
        border: '1px solid var(--color-dim)',
      }}>
        {mining?.active ? (
          <>
            <div>STATUS: MINING {mining.resource?.toUpperCase()}</div>
            <div>RATE: {mining.rate}u/s</div>
          </>
        ) : (
          <div>STATUS: IDLE</div>
        )}
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
          [STOP]
        </button>
      </div>
    </div>
  );
}
