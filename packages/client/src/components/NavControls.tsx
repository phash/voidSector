import { useStore } from '../state/store';
import { network } from '../network/client';
import { btn, btnDisabled, UI } from '../ui-strings';
import {
  AP_COSTS,
  AP_COSTS_LOCAL_SCAN,
  AP_COSTS_BY_SCANNER,
  EMERGENCY_WARP_FREE_RADIUS,
  EMERGENCY_WARP_CREDIT_PER_SECTOR,
  innerCoord,
} from '@void-sector/shared';

export function NavControls() {
  const position = useStore((s) => s.position);
  const jumpPending = useStore((s) => s.jumpPending);
  const ap = useStore((s) => s.ap);
  const fuel = useStore((s) => s.fuel);
  const mining = useStore((s) => s.mining);
  const autopilot = useStore((s) => s.autopilot);
  const hyperdrive = useStore((s) => s.hyperdriveState);
  const scanPending = useStore((s) => s.scanPending);

  if (autopilot?.active) {
    return (
      <div style={{ padding: '8px 12px', textAlign: 'center' }}>
        <div
          style={{ color: '#FFB000', fontSize: '0.9rem', letterSpacing: '0.15em', marginBottom: 8 }}
        >
          {UI.status.AUTOPILOT_ACTIVE}
        </div>
        <div style={{ fontSize: '0.8rem', marginBottom: 8 }}>
          TARGET: ({innerCoord(autopilot.targetX)}, {innerCoord(autopilot.targetY)}) | REMAINING:{' '}
          {autopilot.remaining}
        </div>
        <button className="vs-btn" onClick={() => network.sendCancelAutopilot()}>
          {btn(UI.actions.CANCEL)}
        </button>
      </div>
    );
  }

  const isMining = mining?.active ?? false;

  function jump(dx: number, dy: number) {
    if (jumpPending || isMining || scanPending) return;
    network.sendJump(position.x + dx, position.y + dy);
  }

  // AP cost feasibility checks
  const canJump = ap && ap.current >= AP_COSTS.jump;
  const canLocalScan = ap && ap.current >= AP_COSTS_LOCAL_SCAN;
  const canAreaScan = ap && ap.current >= (AP_COSTS_BY_SCANNER[1]?.areaScan ?? 3);

  const insufficientStyle = { borderColor: 'var(--color-danger)', opacity: 0.5 };
  const miningDisabledStyle = isMining
    ? { opacity: 0.3, cursor: 'not-allowed' as const }
    : undefined;

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* D-Pad + Scan: d-pad left, scan buttons stacked right */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
        {/* D-Pad: ↑ centered top, ← ↓ → bottom row */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <button
            className="vs-btn"
            title="Jump: 1 AP, 0 Fuel"
            onClick={() => jump(0, -1)}
            disabled={jumpPending || isMining || scanPending || !canJump}
            style={isMining ? miningDisabledStyle : !canJump ? insufficientStyle : undefined}
          >
            {isMining
              ? btnDisabled('↑', UI.reasons.MINING_ACTIVE)
              : !canJump
                ? btnDisabled('↑', UI.reasons.NO_AP)
                : '↑'}
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="vs-btn"
              title="Jump: 1 AP, 0 Fuel"
              onClick={() => jump(-1, 0)}
              disabled={jumpPending || isMining || scanPending || !canJump}
              style={isMining ? miningDisabledStyle : !canJump ? insufficientStyle : undefined}
            >
              {isMining
                ? btnDisabled('←', UI.reasons.MINING_ACTIVE)
                : !canJump
                  ? btnDisabled('←', UI.reasons.NO_AP)
                  : '←'}
            </button>
            <button
              className="vs-btn"
              title="Jump: 1 AP, 0 Fuel"
              onClick={() => jump(0, 1)}
              disabled={jumpPending || isMining || scanPending || !canJump}
              style={isMining ? miningDisabledStyle : !canJump ? insufficientStyle : undefined}
            >
              {isMining
                ? btnDisabled('↓', UI.reasons.MINING_ACTIVE)
                : !canJump
                  ? btnDisabled('↓', UI.reasons.NO_AP)
                  : '↓'}
            </button>
            <button
              className="vs-btn"
              title="Jump: 1 AP, 0 Fuel"
              onClick={() => jump(1, 0)}
              disabled={jumpPending || isMining || scanPending || !canJump}
              style={isMining ? miningDisabledStyle : !canJump ? insufficientStyle : undefined}
            >
              {isMining
                ? btnDisabled('→', UI.reasons.MINING_ACTIVE)
                : !canJump
                  ? btnDisabled('→', UI.reasons.NO_AP)
                  : '→'}
            </button>
          </div>
        </div>
        {/* Scan buttons stacked vertically */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <button
            className="vs-btn"
            title={`Local Scan: ${AP_COSTS_LOCAL_SCAN} AP`}
            onClick={() => network.sendLocalScan()}
            disabled={jumpPending || isMining || scanPending || !canLocalScan}
            style={
              isMining || scanPending
                ? miningDisabledStyle
                : !canLocalScan
                  ? insufficientStyle
                  : undefined
            }
          >
            {isMining
              ? btnDisabled(UI.actions.SCAN, UI.reasons.MINING_ACTIVE)
              : !canLocalScan
                ? btnDisabled(UI.actions.SCAN, UI.reasons.AP_COST(AP_COSTS_LOCAL_SCAN))
                : btn('LOCAL SCAN')}
          </button>
          <button
            className="vs-btn"
            title={`Area Scan: ${AP_COSTS_BY_SCANNER[1]?.areaScan ?? 3} AP`}
            onClick={() => network.sendAreaScan()}
            disabled={jumpPending || isMining || scanPending || !canAreaScan}
            style={
              isMining || scanPending
                ? miningDisabledStyle
                : !canAreaScan
                  ? insufficientStyle
                  : undefined
            }
          >
            {isMining
              ? btnDisabled(UI.actions.SCAN, UI.reasons.MINING_ACTIVE)
              : !canAreaScan
                ? btnDisabled(UI.actions.SCAN, UI.reasons.AP_COST(AP_COSTS_BY_SCANNER[1]?.areaScan ?? 3))
                : btn('AREA SCAN')}
          </button>
        </div>
      </div>
      {hyperdrive && hyperdrive.maxCharge > 0 && (
        <div
          style={{
            marginTop: 8,
            padding: '4px 8px',
            border: '1px solid #00CCFF33',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            color: '#00CCFF',
          }}
        >
          <span>
            HYPERDRIVE: {Math.floor(hyperdrive.charge)}/{hyperdrive.maxCharge} RNG
          </span>
          {hyperdrive.charge < hyperdrive.maxCharge && (
            <span style={{ color: 'var(--color-dim)', marginLeft: 8 }}>
              +{hyperdrive.regenPerSecond}/s
            </span>
          )}
          {hyperdrive.charge >= hyperdrive.maxCharge && (
            <span style={{ color: '#00FF88', marginLeft: 8 }}>CHARGED</span>
          )}
        </div>
      )}
      {isMining && (
        <div
          style={{
            marginTop: 8,
            textAlign: 'center',
            color: '#FF3333',
            fontSize: '0.75rem',
            letterSpacing: '0.15em',
          }}
        >
          {UI.status.MINING_LOCKED}
        </div>
      )}
      {fuel && fuel.current <= 0 && !isMining && (
        <div
          style={{
            marginTop: 8,
            padding: '8px',
            border: '1px solid #FF3333',
            textAlign: 'center',
            animation: 'bezel-alert-pulse 2s infinite',
          }}
        >
          <div
            style={{
              color: '#FF3333',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              letterSpacing: '0.15em',
              marginBottom: 4,
            }}
          >
            {UI.status.EMERGENCY_WARP}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-dim)', marginBottom: 6 }}>
            Teleport to home base —{' '}
            {(() => {
              const dist = Math.abs(position.x) + Math.abs(position.y);
              if (dist <= EMERGENCY_WARP_FREE_RADIUS) return 'FREE';
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
            {btn('ACTIVATE EMERGENCY WARP')}
          </button>
        </div>
      )}
    </div>
  );
}
