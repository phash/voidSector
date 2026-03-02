import { useStore } from '../state/store';
import { network } from '../network/client';

export function NavControls() {
  const position = useStore((s) => s.position);
  const jumpPending = useStore((s) => s.jumpPending);

  function jump(dx: number, dy: number) {
    if (jumpPending) return;
    network.sendJump(position.x + dx, position.y + dy);
  }

  function scan() {
    network.sendScan();
  }

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
        <button className="vs-btn" onClick={() => jump(0, -1)} disabled={jumpPending}>
          ↑
        </button>
        <button className="vs-btn" onClick={() => jump(-1, 0)} disabled={jumpPending}>
          ←
        </button>
        <button className="vs-btn" onClick={() => jump(0, 1)} disabled={jumpPending}>
          ↓
        </button>
        <button className="vs-btn" onClick={() => jump(1, 0)} disabled={jumpPending}>
          →
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
        <button className="vs-btn" onClick={scan} disabled={jumpPending}>[SCAN]</button>
        <button className="vs-btn" disabled title="Coming soon">[MINE]</button>
        <button className="vs-btn" disabled title="Coming soon">[MARKET]</button>
      </div>
    </div>
  );
}
