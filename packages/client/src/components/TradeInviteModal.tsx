import { useStore } from '../state/store';
import { network } from '../network/client';

/** Incoming P2P trade invite — accept opens the TradeWindow (#225 / SP3). */
export function TradeInviteModal() {
  const invite = useStore((s) => s.tradeInvitePending);
  const activeTrade = useStore((s) => s.activeTrade);

  // Once a trade window is open the invite is superseded.
  if (!invite || activeTrade) return null;

  const accept = () => {
    network.requestTradeState(invite.tradeId);
    // activeTrade arrives via the broadcast; clear the invite either way.
    useStore.getState().setTradeInvitePending(null);
  };

  const decline = () => {
    network.sendTradeCancel(invite.tradeId);
    useStore.getState().setTradeInvitePending(null);
  };

  return (
    <div
      data-testid="trade-invite-modal"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 205,
      }}
    >
      <div
        style={{
          border: '2px solid var(--color-primary)',
          background: '#040404',
          padding: '20px 24px',
          maxWidth: 360,
          width: '88%',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-primary)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '0.9rem', marginBottom: 16, letterSpacing: '0.1em' }}>
          {invite.fromPlayerName} möchte handeln
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="vs-btn"
            style={{ flex: 1, fontSize: '0.8rem', borderColor: '#00FF88', color: '#00FF88' }}
            onClick={accept}
          >
            [ANNEHMEN]
          </button>
          <button
            className="vs-btn"
            style={{ flex: 1, fontSize: '0.8rem', borderColor: '#FF4444', color: '#FF4444' }}
            onClick={decline}
          >
            [ABLEHNEN]
          </button>
        </div>
      </div>
    </div>
  );
}
