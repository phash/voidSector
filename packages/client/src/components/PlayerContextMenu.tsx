import { useStore } from '../state/store';
import type { ChatChannel } from '@void-sector/shared';

export function PlayerContextMenu() {
  const menu = useStore(s => s.contextMenu);
  const close = useStore(s => s.closeContextMenu);

  if (!menu) return null;

  const startDirectMessage = () => {
    useStore.setState({
      chatChannel: 'direct' as ChatChannel,
      directChatRecipient: { id: menu.playerId, name: menu.playerName },
    });
    close();
  };

  return (
    <>
      <div
        data-testid="context-menu-backdrop"
        style={{ position: 'fixed', inset: 0, zIndex: 100 }}
        onClick={close}
      />
      <div
        data-testid="context-menu"
        style={{
          position: 'fixed',
          left: menu.x,
          top: menu.y,
          zIndex: 101,
          background: '#0a0a0a',
          border: '1px solid var(--color-primary)',
          padding: 4,
          minWidth: 160,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
        }}
      >
        <div style={{
          padding: '2px 8px',
          color: 'var(--color-primary)',
          borderBottom: '1px solid var(--color-dim)',
          marginBottom: 4,
          fontWeight: 'bold',
        }}>
          {menu.playerName}
        </div>
        <div
          data-testid="ctx-direct-msg"
          style={{ padding: '4px 8px', cursor: 'pointer', color: 'var(--color-primary)' }}
          onClick={startDirectMessage}
        >
          NACHRICHT SENDEN
        </div>
        <div
          style={{ padding: '4px 8px', color: 'var(--color-dim)', cursor: 'not-allowed', opacity: 0.5 }}
        >
          VISITENKARTE (bald)
        </div>
      </div>
    </>
  );
}
