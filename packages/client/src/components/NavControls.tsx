import { useStore } from '../state/store';
import { network } from '../network/client';
import { AP_COSTS, AP_COSTS_LOCAL_SCAN, AP_COSTS_BY_SCANNER } from '@void-sector/shared';

export function NavControls() {
  const position = useStore((s) => s.position);
  const jumpPending = useStore((s) => s.jumpPending);
  const ap = useStore((s) => s.ap);

  function jump(dx: number, dy: number) {
    if (jumpPending) return;
    network.sendJump(position.x + dx, position.y + dy);
  }

  // AP cost feasibility checks
  const canJump = ap && ap.current >= AP_COSTS.jump;
  const canLocalScan = ap && ap.current >= AP_COSTS_LOCAL_SCAN;
  const canAreaScan = ap && ap.current >= (AP_COSTS_BY_SCANNER[1]?.areaScan ?? 3);

  const insufficientStyle = { borderColor: 'var(--color-danger)', opacity: 0.5 };

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
        <button
          className="vs-btn"
          title={`Jump: ${AP_COSTS.jump} AP`}
          onClick={() => jump(0, -1)}
          disabled={jumpPending}
          style={!canJump ? insufficientStyle : undefined}
        >
          ↑
        </button>
        <button
          className="vs-btn"
          title={`Jump: ${AP_COSTS.jump} AP`}
          onClick={() => jump(-1, 0)}
          disabled={jumpPending}
          style={!canJump ? insufficientStyle : undefined}
        >
          ←
        </button>
        <button
          className="vs-btn"
          title={`Jump: ${AP_COSTS.jump} AP`}
          onClick={() => jump(0, 1)}
          disabled={jumpPending}
          style={!canJump ? insufficientStyle : undefined}
        >
          ↓
        </button>
        <button
          className="vs-btn"
          title={`Jump: ${AP_COSTS.jump} AP`}
          onClick={() => jump(1, 0)}
          disabled={jumpPending}
          style={!canJump ? insufficientStyle : undefined}
        >
          →
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
        <button
          className="vs-btn"
          title={`Local Scan: ${AP_COSTS_LOCAL_SCAN} AP`}
          onClick={() => network.sendLocalScan()}
          disabled={jumpPending}
          style={!canLocalScan ? insufficientStyle : undefined}
        >
          [LOCAL SCAN]
        </button>
        <button
          className="vs-btn"
          title={`Area Scan: ${AP_COSTS_BY_SCANNER[1]?.areaScan ?? 3} AP`}
          onClick={() => network.sendAreaScan()}
          disabled={jumpPending}
          style={!canAreaScan ? insufficientStyle : undefined}
        >
          [AREA SCAN]
        </button>
        <button className="vs-btn" disabled title="Coming soon">[MINE]</button>
        <button className="vs-btn" disabled title="Coming soon">[MARKET]</button>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        <button className="vs-btn" onClick={() => network.sendBuild('comm_relay')}
          title="5 Ore, 2 Crystal, 5 AP" disabled={jumpPending}
          style={{ fontSize: '0.7rem' }}>
          [BUILD RELAY]
        </button>
        <button className="vs-btn" onClick={() => network.sendBuild('mining_station')}
          title="30 Ore, 15 Gas, 10 Crystal, 15 AP" disabled={jumpPending}
          style={{ fontSize: '0.7rem' }}>
          [BUILD STATION]
        </button>
        <button className="vs-btn" onClick={() => network.sendBuild('base')}
          title="50 Ore, 30 Gas, 25 Crystal, 25 AP" disabled={jumpPending}
          style={{ fontSize: '0.7rem' }}>
          [BUILD BASE]
        </button>
      </div>
    </div>
  );
}
