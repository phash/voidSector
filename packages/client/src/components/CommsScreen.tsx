import { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { ChatChannel, AdminCommMessage, AdminQuestOffer } from '@void-sector/shared';

const CHAT_CHANNELS: ChatChannel[] = ['direct', 'faction', 'local'];
type Tab = ChatChannel | 'admin';

export function CommsScreen() {
  const messages       = useStore(s => s.chatMessages);
  const adminComms     = useStore(s => s.adminComms);
  const adminOffers    = useStore(s => s.adminQuestOffers);
  const channel        = useStore(s => s.chatChannel);
  const setChatChannel = useStore(s => s.setChatChannel);
  const clearAlert     = useStore(s => s.clearAlert);

  const [tab, setTab]          = useState<Tab>('local');
  const [input, setInput]      = useState('');
  const [replyState, setReply] = useState<{ msgId: string; text: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const hasAdminContent = adminComms.length > 0 || adminOffers.length > 0;

  useEffect(() => { clearAlert('COMMS'); }, []);

  useEffect(() => {
    if (hasAdminContent) setTab('admin');
  }, [hasAdminContent]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [messages, adminComms, adminOffers, tab]);

  const switchTab = (t: Tab) => {
    setTab(t);
    if (CHAT_CHANNELS.includes(t as ChatChannel)) setChatChannel(t as ChatChannel);
  };

  const send = () => {
    if (!input.trim() || tab === 'admin') return;
    network.sendChat(tab as ChatChannel, input.trim());
    setInput('');
  };

  const sendReply = (msgId: string, text: string) => {
    if (!text.trim()) return;
    network.sendAdminCommReply(msgId, text.trim());
    setReply(null);
  };

  const formatTime = (ts: number, delayed?: boolean) => {
    if (delayed) {
      const ago = Math.round((Date.now() - ts) / 60000);
      return ago >= 60 ? `${Math.round(ago / 60)}h ago` : `${ago}m ago`;
    }
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filtered = messages.filter(m => m.channel === channel);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 6 }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {CHAT_CHANNELS.map(ch => (
          <button key={ch} className="vs-btn"
            style={tab === ch ? { background: 'var(--color-primary)', color: '#000' } : {}}
            onClick={() => switchTab(ch)}>
            [{ch.toUpperCase()}]
          </button>
        ))}
        <button className="vs-btn"
          style={tab === 'admin'
            ? { background: '#ffb000', color: '#000', borderColor: '#ffb000' }
            : { borderColor: '#ffb000', color: '#ffb000' }}
          onClick={() => switchTab('admin')}>
          [ADMIN{hasAdminContent ? ` (${adminComms.length + adminOffers.length})` : ''}]
        </button>
      </div>

      {/* Message / content area */}
      <div ref={logRef} style={{
        flex: 1, overflow: 'auto', fontSize: '0.8rem',
        border: '1px solid var(--color-dim)', padding: 6,
      }}>
        {tab !== 'admin' && (
          <>
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
          </>
        )}

        {tab === 'admin' && (
          <>
            {adminOffers.map(offer => (
              <AdminQuestOfferCard key={offer.adminQuestId} offer={offer}
                onAccept={() => network.sendAcceptAdminQuest(offer.adminQuestId)}
                onDecline={() => network.sendDeclineAdminQuest(offer.adminQuestId)}
              />
            ))}
            {adminComms.map(msg => (
              <AdminCommCard key={msg.id} msg={msg}
                replyState={replyState} setReplyState={setReply}
                sendReply={sendReply} formatTime={formatTime}
              />
            ))}
            {!hasAdminContent && (
              <div style={{ color: 'var(--color-dim)' }}>NO ADMIN MESSAGES</div>
            )}
          </>
        )}
      </div>

      {/* Input row — hidden on admin tab */}
      {tab !== 'admin' && (
        <div style={{ display: 'flex', gap: 4 }}>
          <input type="text" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
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
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AdminQuestOfferCard({
  offer, onAccept, onDecline,
}: {
  offer: AdminQuestOffer;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const amber = { color: '#ffb000' };

  return (
    <div style={{
      borderLeft: '3px solid #ffb000', padding: '6px 10px',
      marginBottom: 8, background: 'rgba(255,176,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ ...amber, fontSize: '0.72rem', letterSpacing: 1 }}>
            ◈ QUEST-ANGEBOT [{offer.scope.toUpperCase()}]
          </span>
          {' '}
          <span style={{ color: 'var(--color-primary)', fontSize: '0.85rem' }}>{offer.title}</span>
        </div>
        <button className="vs-btn" style={{ fontSize: '0.68rem', padding: '1px 5px' }}
          onClick={() => setExpanded(e => !e)}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <>
          <div style={{ color: 'var(--color-dim)', fontSize: '0.72rem', margin: '3px 0' }}>
            {offer.npcName} · {offer.npcFactionId}
          </div>
          {offer.introText && (
            <div style={{ fontStyle: 'italic', fontSize: '0.76rem', margin: '4px 0', color: 'var(--color-primary)' }}>
              &ldquo;{offer.introText}&rdquo;
            </div>
          )}
          <div style={{ fontSize: '0.78rem', margin: '3px 0' }}>{offer.description}</div>

          {Array.isArray(offer.objectives) && offer.objectives.length > 0 && (
            <div style={{ marginTop: 4, fontSize: '0.73rem', color: 'var(--color-dim)' }}>
              {(offer.objectives as any[]).map((obj: any, i: number) => (
                <div key={i}>[ ] {obj.description || `${obj.type}${obj.resource ? ` ${obj.resource} ×${obj.amount}` : ''}`}</div>
              ))}
            </div>
          )}

          {offer.rewards && (
            <div style={{ color: 'var(--color-dim)', fontSize: '0.72rem', marginTop: 3 }}>
              CR: {(offer.rewards as any).credits ?? 0}
              {'  '}XP: {(offer.rewards as any).xp ?? 0}
              {(offer.rewards as any).reputation ? `  REP: +${(offer.rewards as any).reputation}` : ''}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
            <button className="vs-btn" style={{ ...amber, borderColor: '#ffb000', fontSize: '0.72rem' }}
              onClick={onAccept}>
              [ANNEHMEN]
            </button>
            <button className="vs-btn" style={{ color: 'var(--color-dim)', fontSize: '0.72rem' }}
              onClick={onDecline}>
              [ABLEHNEN]
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AdminCommCard({
  msg, replyState, setReplyState, sendReply, formatTime,
}: {
  msg: AdminCommMessage;
  replyState: { msgId: string; text: string } | null;
  setReplyState: (s: { msgId: string; text: string } | null) => void;
  sendReply: (msgId: string, text: string) => void;
  formatTime: (ts: number) => string;
}) {
  const amber = { color: '#ffb000' };
  const isReplying = replyState?.msgId === msg.id;

  return (
    <div style={{ borderLeft: '3px solid #ffb000', padding: '6px 10px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ ...amber, fontSize: '0.73rem' }}>
          Admin:{msg.adminName}
          {' '}<span style={{ opacity: 0.6 }}>[{msg.scope.toUpperCase()}]</span>
        </span>
        <span style={{ color: 'var(--color-dim)', fontSize: '0.7rem' }}>{formatTime(msg.sentAt)}</span>
      </div>
      <div style={{ fontSize: '0.82rem' }}>{msg.content}</div>

      {msg.allowReply && !isReplying && (
        <button className="vs-btn"
          style={{ ...amber, borderColor: '#ffb000', fontSize: '0.7rem', marginTop: 5 }}
          onClick={() => setReplyState({ msgId: msg.id, text: '' })}>
          [ANTWORTEN]
        </button>
      )}
      {msg.allowReply && isReplying && (
        <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
          <input type="text" autoFocus
            value={replyState!.text}
            onChange={e => setReplyState({ msgId: msg.id, text: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter') sendReply(msg.id, replyState!.text);
              if (e.key === 'Escape') setReplyState(null);
            }}
            style={{
              flex: 1, background: 'transparent', border: '1px solid #ffb000',
              color: '#ffb000', fontFamily: 'var(--font-mono)',
              fontSize: '0.76rem', padding: '3px 6px',
            }}
            maxLength={500} placeholder="Antwort..."
          />
          <button className="vs-btn" style={{ ...amber, borderColor: '#ffb000', fontSize: '0.7rem' }}
            onClick={() => sendReply(msg.id, replyState!.text)}>
            [SEND]
          </button>
          <button className="vs-btn" style={{ fontSize: '0.7rem' }}
            onClick={() => setReplyState(null)}>
            [ESC]
          </button>
        </div>
      )}
    </div>
  );
}
