import { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const MAX_VISIBLE_MESSAGES = 15;
const MESSAGE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function CommsScreen() {
  const messages = useStore(s => s.chatMessages);
  const channel = useStore(s => s.chatChannel);
  const clearAlert = useStore(s => s.clearAlert);
  const recentContacts = useStore(s => s.recentContacts);
  const addRecentContact = useStore(s => s.addRecentContact);
  const openContextMenu = useStore(s => s.openContextMenu);
  const directChatRecipient = useStore(s => s.directChatRecipient);
  const [input, setInput] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { clearAlert('COMMS'); }, []);

  // Pick up recipient from context menu pre-selection
  useEffect(() => {
    if (directChatRecipient) {
      setRecipientId(directChatRecipient.id);
      setRecipientName(directChatRecipient.name);
      useStore.setState({ directChatRecipient: null });
    }
  }, [directChatRecipient]);

  // Prune old messages (>2h) periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const current = useStore.getState().chatMessages;
      const pruned = current.filter(m => now - m.sentAt < MESSAGE_MAX_AGE_MS);
      if (pruned.length < current.length) {
        useStore.setState({ chatMessages: pruned });
      }
    }, 60_000); // check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [messages]);

  const filtered = messages.filter(m => m.channel === channel);

  const send = () => {
    if (!input.trim()) return;
    if (channel === 'direct') {
      if (!recipientId) return;
      network.sendChat(channel, input.trim(), recipientId);
      addRecentContact(recipientId, recipientName || recipientId);
    } else {
      network.sendChat(channel, input.trim());
    }
    setInput('');
  };

  const selectContact = (contact: { id: string; name: string }) => {
    setRecipientId(contact.id);
    setRecipientName(contact.name);
    setShowContacts(false);
  };

  const formatTime = (ts: number, delayed: boolean) => {
    if (delayed) {
      const ago = Math.round((Date.now() - ts) / 60000);
      return ago >= 60 ? `${Math.round(ago / 60)}h ago` : `${ago}m ago`;
    }
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: 8, gap: 8 }}>
      {/* Channel indicator -- switching is handled by the bezel mode switcher */}
      <div style={{ fontSize: '0.65rem', color: 'var(--color-dim)', flexShrink: 0 }}>
        CHANNEL: <span style={{ color: 'var(--color-primary)' }}>{channel.toUpperCase()}</span>
      </div>

      {/* Direct message recipient selector */}
      {channel === 'direct' && (
        <div style={{ fontSize: '0.7rem', flexShrink: 0, display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ color: 'var(--color-dim)' }}>TO:</span>
          <span style={{ color: 'var(--color-primary)' }}>{recipientName || '---'}</span>
          <button
            className="vs-btn"
            style={{ fontSize: '0.65rem', padding: '1px 4px' }}
            onClick={() => setShowContacts(!showContacts)}
          >
            [CONTACTS]
          </button>
        </div>
      )}

      {/* Address book dropdown */}
      {channel === 'direct' && showContacts && (
        <div
          data-testid="contacts-list"
          style={{
            border: '1px solid var(--color-dim)',
            padding: 4,
            fontSize: '0.7rem',
            maxHeight: 120,
            overflow: 'auto',
            flexShrink: 0,
          }}
        >
          {recentContacts.length === 0 ? (
            <div style={{ color: 'var(--color-dim)' }}>NO RECENT CONTACTS</div>
          ) : (
            recentContacts.map(c => (
              <div
                key={c.id}
                data-testid={`contact-${c.id}`}
                style={{
                  cursor: 'pointer',
                  padding: '2px 4px',
                  color: c.id === recipientId ? 'var(--color-primary)' : 'var(--color-dim)',
                }}
                onClick={() => selectContact(c)}
              >
                {c.name}
              </div>
            ))
          )}
        </div>
      )}

      <div ref={logRef} style={{
        flex: 1, minHeight: 0, overflow: 'auto', fontSize: '0.8rem',
        border: '1px solid var(--color-dim)', padding: 6,
      }}>
        {filtered.slice(-MAX_VISIBLE_MESSAGES).map(msg => (
          <div key={msg.id} style={{ marginBottom: 2 }}>
            <span style={{ color: 'var(--color-dim)' }}>[{formatTime(msg.sentAt, msg.delayed)}]</span>
            {' '}<span
              style={{ color: 'var(--color-primary)', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                openContextMenu(msg.senderId, msg.senderName, e.clientX, e.clientY);
              }}
            >{msg.senderName}:</span>
            {' '}{msg.content}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: 'var(--color-dim)' }}>NO MESSAGES ON THIS CHANNEL</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          style={{
            flex: 1, background: 'transparent',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
          }}
          maxLength={500} placeholder="Type message..."
        />
        <button className="vs-btn" onClick={send}>[SEND]</button>
      </div>
    </div>
  );
}
