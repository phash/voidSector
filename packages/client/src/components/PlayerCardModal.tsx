import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { ChatChannel } from '@void-sector/shared';

export function PlayerCardModal() {
  const target = useStore((s) => s.playerCardTarget);
  const setPlayerCardTarget = useStore((s) => s.setPlayerCardTarget);
  const friendRequests = useStore((s) => s.friendRequests);
  const [confirm, setConfirm] = useState<'remove' | 'block' | null>(null);
  const [localSent, setLocalSent] = useState(false);

  if (!target) return null;

  const close = () => {
    setPlayerCardTarget(null);
    setConfirm(null);
    setLocalSent(false);
  };

  const handleFriendAction = () => {
    if (target.isBlocked) return;
    if (target.isFriend) {
      if (confirm === 'remove') {
        network.removeFriend(target.id);
        close();
      } else {
        setConfirm('remove');
      }
      return;
    }
    if (target.pendingDirection === 'received') {
      const req = friendRequests.find((r) => r.fromId === target.id);
      if (req) {
        network.acceptFriendRequest(req.id);
        close();
      }
      return;
    }
    if (target.pendingDirection === 'sent' || localSent) return;
    network.sendFriendRequest(target.id);
    setLocalSent(true);
  };

  const handleBlockAction = () => {
    if (target.isBlocked) {
      network.unblockPlayer(target.id);
      close();
      return;
    }
    if (confirm === 'block') {
      network.blockPlayer(target.id);
      close();
    } else {
      setConfirm('block');
    }
  };

  const handleMessage = () => {
    useStore.setState({
      chatChannel: 'direct' as ChatChannel,
      directChatRecipient: { id: target.id, name: target.name },
    });
    close();
  };

  const handlePosition = () => {
    if (target.position) {
      useStore.getState().setSelectedSector({ x: target.position.x, y: target.position.y });
      useStore.getState().setActiveProgram('NAV-COM');
    }
    close();
  };

  // Friend button label + style
  const isPendingSent = target.pendingDirection === 'sent' || localSent;
  const isPendingReceived = target.pendingDirection === 'received';
  let friendLabel = '[FREUND +]';
  let friendColor = '#00FF88';
  let friendDisabled = false;
  if (target.isBlocked) {
    friendLabel = '';
  } else if (target.isFriend) {
    friendLabel = confirm === 'remove' ? '[WIRKLICH ENTFERNEN?]' : '[FREUND X]';
    friendColor = '#FF4444';
  } else if (isPendingSent) {
    friendLabel = '[ANFRAGE OK]';
    friendColor = '#666';
    friendDisabled = true;
  } else if (isPendingReceived) {
    friendLabel = '[ANNEHMEN]';
    friendColor = '#00FF88';
  }

  // Block button label + style
  let blockLabel = '[BLOCK]';
  let blockColor = '#FF4444';
  if (target.isBlocked) {
    blockLabel = '[ENTBLOCKEN]';
    blockColor = '#FFB000';
  } else if (confirm === 'block') {
    blockLabel = '[WIRKLICH BLOCKEN?]';
  }

  return (
    <div
      data-testid="player-card-modal"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        style={{
          border: '2px solid var(--color-primary)',
          background: '#040404',
          padding: '20px 24px',
          maxWidth: 400,
          width: '90%',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-primary)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: '1px solid var(--color-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              color: 'var(--color-dim)',
              flexShrink: 0,
            }}
          >
            [P]
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1rem', letterSpacing: '0.15em', marginBottom: 4 }}>
              {target.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-dim)' }}>
              LEVEL {target.level} {target.online
                ? <span style={{ color: '#00FF88' }}>ONLINE</span>
                : <span style={{ color: '#666' }}>OFFLINE</span>}
            </div>
            {target.position && (
              <div style={{ fontSize: '0.65rem', color: 'var(--color-dim)', marginTop: 2 }}>
                POS: ({target.position.x}, {target.position.y})
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!target.isBlocked && friendLabel && (
            <button
              className="vs-btn"
              style={{ fontSize: '0.75rem', borderColor: friendColor, color: friendColor }}
              disabled={friendDisabled}
              onClick={handleFriendAction}
            >
              {friendLabel}
            </button>
          )}

          <button
            className="vs-btn"
            style={{ fontSize: '0.75rem', borderColor: blockColor, color: blockColor }}
            onClick={handleBlockAction}
          >
            {blockLabel}
          </button>

          {!target.isBlocked && (
            <button
              className="vs-btn"
              style={{ fontSize: '0.75rem' }}
              onClick={handleMessage}
            >
              [NACHRICHT]
            </button>
          )}

          {target.position && (
            <button
              className="vs-btn"
              style={{ fontSize: '0.75rem' }}
              onClick={handlePosition}
            >
              [POSITION -&gt; NAV-COM]
            </button>
          )}
        </div>

        {/* Close */}
        <button
          className="vs-btn"
          style={{ fontSize: '0.7rem', marginTop: 12, width: '100%', color: 'var(--color-dim)', borderColor: 'var(--color-dim)' }}
          onClick={close}
        >
          [SCHLIESSEN]
        </button>
      </div>
    </div>
  );
}
