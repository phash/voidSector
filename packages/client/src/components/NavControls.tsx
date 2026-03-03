import { useStore } from '../state/store';
import { network } from '../network/client';
import { AP_COSTS, AP_COSTS_LOCAL_SCAN, AP_COSTS_BY_SCANNER } from '@void-sector/shared';

export function NavControls() {
  const position = useStore((s) => s.position);
  const jumpPending = useStore((s) => s.jumpPending);
  const ap = useStore((s) => s.ap);
  const mining = useStore((s) => s.mining);

  const isMining = mining?.active ?? false;

  function jump(dx: number, dy: number) {
    if (jumpPending || isMining) return;
    network.sendJump(position.x + dx, position.y + dy);
  }

  // AP cost feasibility checks
  const canJump = ap && ap.current >= AP_COSTS.jump;
  const canLocalScan = ap && ap.current >= AP_COSTS_LOCAL_SCAN;
  const canAreaScan = ap && ap.current >= (AP_COSTS_BY_SCANNER[1]?.areaScan ?? 3);

  const insufficientStyle = { borderColor: 'var(--color-danger)', opacity: 0.5 };
  const miningDisabledStyle = isMining ? { opacity: 0.3, cursor: 'not-allowed' as const } : undefined;

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
        <button
          className="vs-btn"
          title={`Jump: ${AP_COSTS.jump} AP`}
          onClick={() => jump(0, -1)}
          disabled={jumpPending || isMining}
          style={isMining ? miningDisabledStyle : (!canJump ? insufficientStyle : undefined)}
        >
          ↑
        </button>
        <button
          className="vs-btn"
          title={`Jump: ${AP_COSTS.jump} AP`}
          onClick={() => jump(-1, 0)}
          disabled={jumpPending || isMining}
          style={isMining ? miningDisabledStyle : (!canJump ? insufficientStyle : undefined)}
        >
          ←
        </button>
        <button
          className="vs-btn"
          title={`Jump: ${AP_COSTS.jump} AP`}
          onClick={() => jump(0, 1)}
          disabled={jumpPending || isMining}
          style={isMining ? miningDisabledStyle : (!canJump ? insufficientStyle : undefined)}
        >
          ↓
        </button>
        <button
          className="vs-btn"
          title={`Jump: ${AP_COSTS.jump} AP`}
          onClick={() => jump(1, 0)}
          disabled={jumpPending || isMining}
          style={isMining ? miningDisabledStyle : (!canJump ? insufficientStyle : undefined)}
        >
          →
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
        <button
          className="vs-btn"
          title={`Local Scan: ${AP_COSTS_LOCAL_SCAN} AP`}
          onClick={() => network.sendLocalScan()}
          disabled={jumpPending || isMining}
          style={isMining ? miningDisabledStyle : (!canLocalScan ? insufficientStyle : undefined)}
        >
          [LOCAL SCAN]
        </button>
        <button
          className="vs-btn"
          title={`Area Scan: ${AP_COSTS_BY_SCANNER[1]?.areaScan ?? 3} AP`}
          onClick={() => network.sendAreaScan()}
          disabled={jumpPending || isMining}
          style={isMining ? miningDisabledStyle : (!canAreaScan ? insufficientStyle : undefined)}
        >
          [AREA SCAN]
        </button>
        <button className="vs-btn" disabled title="Coming soon">[MINE]</button>
        <button className="vs-btn" disabled title="Coming soon">[MARKET]</button>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        <button className="vs-btn" onClick={() => network.sendBuild('comm_relay')}
          title="5 Ore, 2 Crystal, 5 AP" disabled={jumpPending || isMining}
          style={isMining ? { fontSize: '0.7rem', ...miningDisabledStyle } : { fontSize: '0.7rem' }}>
          [BUILD RELAY]
        </button>
        <button className="vs-btn" onClick={() => network.sendBuild('mining_station')}
          title="30 Ore, 15 Gas, 10 Crystal, 15 AP" disabled={jumpPending || isMining}
          style={isMining ? { fontSize: '0.7rem', ...miningDisabledStyle } : { fontSize: '0.7rem' }}>
          [BUILD STATION]
        </button>
        <button className="vs-btn" onClick={() => network.sendBuild('base')}
          title="50 Ore, 30 Gas, 25 Crystal, 25 AP" disabled={jumpPending || isMining}
          style={isMining ? { fontSize: '0.7rem', ...miningDisabledStyle } : { fontSize: '0.7rem' }}>
          [BUILD BASE]
        </button>
      </div>
      {isMining && (
        <div style={{
          marginTop: 8,
          textAlign: 'center',
          color: '#FF3333',
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
        }}>
          ⚠ MINING ACTIVE — NAV LOCKED
        </div>
      )}
    </div>
  );
}
