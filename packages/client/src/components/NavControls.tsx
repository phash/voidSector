import { useStore } from '../state/store';
import { network } from '../network/client';
import { useTranslation } from 'react-i18next';
import { btn, btnDisabled } from '../ui-helpers';
import {
  AP_COSTS,
  AP_COSTS_LOCAL_SCAN,
  AP_COSTS_BY_SCANNER,
  innerCoord,
} from '@void-sector/shared';

export function NavControls() {
  const { t } = useTranslation('ui');
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
          {t('status.autopilotActive')}
        </div>
        <div style={{ fontSize: '0.8rem', marginBottom: 8 }}>
          TARGET: ({innerCoord(autopilot.targetX)}, {innerCoord(autopilot.targetY)}) | REMAINING:{' '}
          {autopilot.remaining}
        </div>
        <button className="vs-btn" onClick={() => network.sendCancelAutopilot()}>
          {btn(t('actions.cancel'))}
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
              ? btnDisabled('↑', t('reasons.miningActive'))
              : !canJump
                ? btnDisabled('↑', t('reasons.noAp'))
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
                ? btnDisabled('←', t('reasons.miningActive'))
                : !canJump
                  ? btnDisabled('←', t('reasons.noAp'))
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
                ? btnDisabled('↓', t('reasons.miningActive'))
                : !canJump
                  ? btnDisabled('↓', t('reasons.noAp'))
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
                ? btnDisabled('→', t('reasons.miningActive'))
                : !canJump
                  ? btnDisabled('→', t('reasons.noAp'))
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
              ? btnDisabled(t('actions.scan'), t('reasons.miningActive'))
              : !canLocalScan
                ? btnDisabled(t('actions.scan'), t('reasons.apCost', { n: AP_COSTS_LOCAL_SCAN }))
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
              ? btnDisabled(t('actions.scan'), t('reasons.miningActive'))
              : !canAreaScan
                ? btnDisabled(t('actions.scan'), t('reasons.apCost', { n: AP_COSTS_BY_SCANNER[1]?.areaScan ?? 3 }))
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
          {t('status.miningLocked')}
        </div>
      )}
    </div>
  );
}
