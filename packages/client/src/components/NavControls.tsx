import { useStore } from '../state/store';
import { network } from '../network/client';
import { AP_COSTS, AP_COSTS_LOCAL_SCAN, AP_COSTS_BY_SCANNER, EMERGENCY_WARP_FREE_RADIUS, EMERGENCY_WARP_CREDIT_PER_SECTOR } from '@void-sector/shared';

export function NavControls() {
  const position = useStore((s) => s.position);
  const jumpPending = useStore((s) => s.jumpPending);
  const ap = useStore((s) => s.ap);
  const fuel = useStore((s) => s.fuel);
  const mining = useStore((s) => s.mining);
  const autopilot = useStore((s) => s.autopilot);

  if (autopilot?.active) {
    return (
      <div style={{ padding: '8px 12px', textAlign: 'center' }}>
        <div style={{ color: '#FFB000', fontSize: '0.9rem', letterSpacing: '0.15em', marginBottom: 8 }}>
          AUTOPILOT AKTIV
        </div>
        <div style={{ fontSize: '0.8rem', marginBottom: 8 }}>
          Ziel: ({autopilot.targetX}, {autopilot.targetY}) | Verbleibend: {autopilot.remaining}
        </div>
        <button className="vs-btn" onClick={() => network.sendCancelAutopilot()}>
          [ABBRECHEN]
        </button>
      </div>
    );
  }

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
      {fuel && fuel.current <= 0 && !isMining && (
        <div style={{
          marginTop: 8,
          padding: '8px',
          border: '1px solid #FF3333',
          textAlign: 'center',
          animation: 'bezel-alert-pulse 2s infinite',
        }}>
          <div style={{ color: '#FF3333', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.15em', marginBottom: 4 }}>
            NOTWARP VERFÜGBAR
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-dim)', marginBottom: 6 }}>
            Teleport zur Home Base — {(() => {
              const dist = Math.abs(position.x) + Math.abs(position.y);
              if (dist <= EMERGENCY_WARP_FREE_RADIUS) return 'GRATIS';
              const cost = (dist - EMERGENCY_WARP_FREE_RADIUS) * EMERGENCY_WARP_CREDIT_PER_SECTOR;
              return `${cost} Credits`;
            })()}
          </div>
          <button
            className="vs-btn"
            style={{ borderColor: '#FF3333', color: '#FF3333' }}
            onClick={() => network.sendEmergencyWarp()}
            disabled={jumpPending}
          >
            [NOTWARP AKTIVIEREN]
          </button>
        </div>
      )}
    </div>
  );
}
