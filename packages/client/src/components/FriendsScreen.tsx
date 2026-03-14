import { useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

type Tab = 'FREUNDE' | 'KONTAKTE';

function AddFriendForm() {
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    network.sendFriendRequestByName(trimmed);
    setSent(true);
    setTimeout(() => setSent(false), 3000);
    setName('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
      <input
        type="text"
        placeholder="Spielername..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          flex: 1,
          background: 'transparent',
          border: '1px solid var(--color-dim)',
          color: 'var(--color-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          padding: '3px 6px',
        }}
      />
      <button
        type="submit"
        className="vs-btn"
        style={{ fontSize: '0.65rem', padding: '3px 8px' }}
        disabled={!name.trim() || sent}
      >
        {sent ? '[GESENDET]' : '[ANFRAGE]'}
      </button>
    </form>
  );
}

export function FriendsScreen() {
  const friends = useStore((s) => s.friends);
  const friendRequests = useStore((s) => s.friendRequests);
  const recentContacts = useStore((s) => s.recentContacts);
  const clearAlert = useStore((s) => s.clearAlert);
  const removeFriendRequest = useStore((s) => s.removeFriendRequest);
  const [tab, setTab] = useState<Tab>('FREUNDE');

  // Clear FRIENDS alert when screen opens
  useState(() => {
    clearAlert('FRIENDS');
  });

  const sortedFriends = [...friends].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const handleAccept = (requestId: string) => {
    network.acceptFriendRequest(requestId);
    removeFriendRequest(requestId);
  };

  const handleDecline = (requestId: string) => {
    network.declineFriendRequest(requestId);
    removeFriendRequest(requestId);
  };

  return (
    <div
      data-testid="friends-screen"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: 8,
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-primary)',
        fontSize: '0.8rem',
      }}
    >
      {/* Pending requests */}
      {friendRequests.length > 0 && (
        <div
          style={{
            marginBottom: 8,
            padding: '6px 8px',
            border: '1px solid #FFB000',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.15em',
              color: '#FFB000',
              marginBottom: 4,
            }}
          >
            ANFRAGEN ({friendRequests.length})
          </div>
          {friendRequests.map((req) => (
            <div
              key={req.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '2px 0',
                fontSize: '0.75rem',
              }}
            >
              <span
                style={{ cursor: 'pointer', color: 'var(--color-primary)' }}
                onClick={() => network.getPlayerCard(req.fromId)}
              >
                {req.fromName}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="vs-btn"
                  style={{
                    fontSize: '0.65rem',
                    padding: '1px 6px',
                    borderColor: '#00FF88',
                    color: '#00FF88',
                  }}
                  onClick={() => handleAccept(req.id)}
                >
                  [OK]
                </button>
                <button
                  className="vs-btn"
                  style={{
                    fontSize: '0.65rem',
                    padding: '1px 6px',
                    borderColor: '#FF4444',
                    color: '#FF4444',
                  }}
                  onClick={() => handleDecline(req.id)}
                >
                  [X]
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginBottom: 8 }}>
        {(['FREUNDE', 'KONTAKTE'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              border: `1px solid ${tab === t ? 'var(--color-primary)' : '#333'}`,
              background: tab === t ? '#001100' : 'none',
              color: tab === t ? 'var(--color-primary)' : '#555',
              padding: '3px 6px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {tab === 'FREUNDE' && (
          <>
            {sortedFriends.length === 0 ? (
              <div style={{ color: 'var(--color-dim)', fontSize: '0.75rem', padding: 8 }}>
                KEINE FREUNDE
                <br />
                <span style={{ fontSize: '0.65rem' }}>
                  Klicke auf einen Spieler im Radar oder Detail-Panel um eine Anfrage zu senden.
                </span>
              </div>
            ) : (
              sortedFriends.map((f) => (
                <div
                  key={f.id}
                  data-testid={`friend-${f.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                  onClick={() => network.getPlayerCard(f.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: f.online ? '#00FF88' : '#444',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: f.online ? 'var(--color-primary)' : 'var(--color-dim)' }}>
                      {f.name}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-dim)' }}>
                    LVL {f.level}
                  </span>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'KONTAKTE' && (
          <>
            <AddFriendForm />
            {recentContacts.length === 0 ? (
              <div style={{ color: 'var(--color-dim)', fontSize: '0.75rem', padding: 8 }}>
                KEINE KONTAKTE
              </div>
            ) : (
              recentContacts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '4px 6px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: 'var(--color-primary)',
                  }}
                  onClick={() => network.getPlayerCard(c.id)}
                >
                  {c.name}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
