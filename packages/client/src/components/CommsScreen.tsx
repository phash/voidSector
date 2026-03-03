import { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { ChatChannel } from '@void-sector/shared';

const CHANNELS: ChatChannel[] = ['direct', 'faction', 'local'];

export function CommsScreen() {
  const messages = useStore(s => s.chatMessages);
  const channel = useStore(s => s.chatChannel);
  const setChatChannel = useStore(s => s.setChatChannel);
  const clearAlert = useStore(s => s.clearAlert);
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { clearAlert('COMMS'); }, []);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [messages]);

  const filtered = messages.filter(m => m.channel === channel);

  const send = () => {
    if (!input.trim()) return;
    network.sendChat(channel, input.trim());
    setInput('');
  };

  const formatTime = (ts: number, delayed: boolean) => {
    if (delayed) {
      const ago = Math.round((Date.now() - ts) / 60000);
      return ago >= 60 ? `${Math.round(ago / 60)}h ago` : `${ago}m ago`;
    }
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 8 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {CHANNELS.map(ch => (
          <button key={ch} className="vs-btn"
            style={ch === channel ? { background: 'var(--color-primary)', color: '#000' } : {}}
            onClick={() => setChatChannel(ch)}>
            [{ch.toUpperCase()}]
          </button>
        ))}
      </div>

      <div ref={logRef} style={{
        flex: 1, overflow: 'auto', fontSize: '0.8rem',
        border: '1px solid var(--color-dim)', padding: 6,
      }}>
        {filtered.map(msg => (
          <div key={msg.id} style={{ marginBottom: 2 }}>
            <span style={{ color: 'var(--color-dim)' }}>[{formatTime(msg.sentAt, msg.delayed)}]</span>
            {' '}<span style={{ color: 'var(--color-primary)' }}>{msg.senderName}:</span>
            {' '}{msg.content}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: 'var(--color-dim)' }}>NO MESSAGES ON THIS CHANNEL</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
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
