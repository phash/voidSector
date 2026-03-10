import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { FACTION_UPGRADE_TIERS } from '@void-sector/shared';
import type { FactionJoinMode, FactionUpgradeChoice } from '@void-sector/shared';

export function FactionScreen() {
  const faction = useStore((s) => s.faction);
  const members = useStore((s) => s.factionMembers);
  const invites = useStore((s) => s.factionInvites);
  const playerId = useStore((s) => s.playerId);
  const factionUpgrades = useStore((s) => s.factionUpgrades);

  useEffect(() => {
    network.requestFaction();
  }, []);

  if (!faction) {
    return <NoFactionView invites={invites} />;
  }

  const myRank = members.find((m) => m.playerId === playerId)?.rank ?? 'member';
  const isLeader = myRank === 'leader';
  const isOfficer = myRank === 'officer';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      <div
        style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '8px' }}
      >
        FRAKTION
      </div>

      <div style={{ fontSize: '1rem', marginBottom: '4px' }}>
        [{faction.tag}] {faction.name}
      </div>
      <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '12px' }}>
        Modus: {faction.joinMode.toUpperCase()}
        {faction.joinMode === 'code' && faction.inviteCode && isLeader && (
          <span> | Code: {faction.inviteCode}</span>
        )}
        {' | '}
        {faction.memberCount} Mitglieder
      </div>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>MITGLIEDER</div>
        {members.map((m) => (
          <div
            key={m.playerId}
            style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              marginBottom: '2px',
              fontSize: '0.8rem',
            }}
          >
            <span style={{ opacity: 0.5, width: '32px' }}>
              {m.rank === 'leader' ? 'LDR' : m.rank === 'officer' ? 'OFF' : 'MBR'}
            </span>
            <span style={{ flex: 1 }}>{m.playerName}</span>
            {isLeader && m.playerId !== playerId && (
              <>
                {m.rank === 'member' && (
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.7rem', padding: '1px 4px' }}
                    onClick={() =>
                      network.sendFactionAction('promote', { targetPlayerId: m.playerId })
                    }
                  >
                    [+]
                  </button>
                )}
                {m.rank === 'officer' && (
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.7rem', padding: '1px 4px' }}
                    onClick={() =>
                      network.sendFactionAction('demote', { targetPlayerId: m.playerId })
                    }
                  >
                    [-]
                  </button>
                )}
                <button
                  className="vs-btn"
                  style={{ fontSize: '0.7rem', padding: '1px 4px' }}
                  onClick={() => network.sendFactionAction('kick', { targetPlayerId: m.playerId })}
                >
                  [X]
                </button>
              </>
            )}
            {isOfficer && m.rank === 'member' && m.playerId !== playerId && (
              <button
                className="vs-btn"
                style={{ fontSize: '0.7rem', padding: '1px 4px' }}
                onClick={() => network.sendFactionAction('kick', { targetPlayerId: m.playerId })}
              >
                [X]
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Upgrade Tree */}
      <div
        style={{
          borderTop: '1px solid var(--color-dim)',
          paddingTop: '8px',
          marginBottom: '8px',
        }}
      >
        <div
          style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '6px', letterSpacing: '0.1em' }}
        >
          VERBESSERUNGSBAUM
        </div>
        {[1, 2, 3].map((tier) => {
          const tierDef = FACTION_UPGRADE_TIERS[tier];
          const chosen = factionUpgrades.find((u) => u.tier === tier);
          const prevChosen = tier === 1 || factionUpgrades.some((u) => u.tier === tier - 1);

          return (
            <div key={tier} style={{ marginBottom: 12, opacity: prevChosen ? 1 : 0.3 }}>
              <div style={{ fontSize: '0.75rem', marginBottom: 4, opacity: 0.6 }}>
                TIER {tier} — {tierDef.cost} CR
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['A', 'B'] as FactionUpgradeChoice[]).map((choice) => {
                  const opt = choice === 'A' ? tierDef.optionA : tierDef.optionB;
                  const isChosen = chosen?.choice === choice;
                  const isOtherChosen = chosen && chosen.choice !== choice;
                  return (
                    <button
                      key={choice}
                      disabled={!!chosen || !isLeader || !prevChosen}
                      onClick={() => network.sendFactionUpgrade(tier, choice)}
                      style={{
                        flex: 1,
                        background: isChosen ? 'rgba(255,176,0,0.2)' : 'transparent',
                        border: `1px solid ${isChosen ? '#FFB000' : 'rgba(255,176,0,0.3)'}`,
                        color: isOtherChosen ? 'rgba(255,176,0,0.3)' : '#FFB000',
                        padding: '6px',
                        fontFamily: 'inherit',
                        fontSize: '0.75rem',
                        cursor: chosen || !isLeader ? 'default' : 'pointer',
                        textDecoration: isOtherChosen ? 'line-through' : 'none',
                      }}
                    >
                      <div>{opt.name}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{opt.effect}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          borderTop: '1px solid var(--color-dim)',
          paddingTop: '8px',
        }}
      >
        {(isLeader || isOfficer) && <InviteButton />}
        {isLeader && (
          <>
            <JoinModeSelector currentMode={faction.joinMode} />
            <button
              className="vs-btn"
              onClick={() => {
                if (confirm('Fraktion auflösen?')) network.sendFactionAction('disband');
              }}
            >
              [AUFLÖSEN]
            </button>
          </>
        )}
        {!isLeader && (
          <button className="vs-btn" onClick={() => network.sendFactionAction('leave')}>
            [VERLASSEN]
          </button>
        )}
      </div>
    </div>
  );
}

function NoFactionView({ invites }: { invites: any[] }) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [joinMode, setJoinMode] = useState<FactionJoinMode>('invite');
  const [code, setCode] = useState('');
  const setActiveProgram = useStore((s) => s.setActiveProgram);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      <div
        style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '8px' }}
      >
        FRAKTION
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'monospace', color: '#555', marginBottom: '12px' }}>
        <div>NOT IN A FACTION</div>
        <div style={{ fontSize: '0.7rem' }}>Open QUESTS to find faction recruitment missions.</div>
        <button onClick={() => setActiveProgram('QUESTS')} style={{ border: '1px solid #333', background: 'none', color: '#888', fontFamily: 'monospace', cursor: 'pointer', padding: '3px 8px', fontSize: '0.75rem' }}>
          [OPEN QUESTS]
        </button>
      </div>

      {invites.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>EINLADUNGEN</div>
          {invites.map((inv: any) => (
            <div
              key={inv.id}
              style={{
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                marginBottom: '4px',
                fontSize: '0.8rem',
                flexWrap: 'wrap',
              }}
            >
              <span>
                [{inv.factionTag}] {inv.factionName}
              </span>
              <span style={{ opacity: 0.5 }}>von {inv.inviterName}</span>
              <button
                className="vs-btn"
                style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                onClick={() => network.sendRespondInvite(inv.id, true)}
              >
                [JA]
              </button>
              <button
                className="vs-btn"
                style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                onClick={() => network.sendRespondInvite(inv.id, false)}
              >
                [NEIN]
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <button
          className={`vs-btn ${tab === 'create' ? 'vs-btn-active' : ''}`}
          onClick={() => setTab('create')}
        >
          [GRÜNDEN]
        </button>
        <button
          className={`vs-btn ${tab === 'join' ? 'vs-btn-active' : ''}`}
          onClick={() => setTab('join')}
        >
          [BEITRETEN]
        </button>
      </div>

      {tab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input
            className="vs-input"
            placeholder="Fraktionsname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
          />
          <input
            className="vs-input"
            placeholder="Tag (3-5 Zeichen)"
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())}
            maxLength={5}
          />
          <select
            className="vs-input"
            value={joinMode}
            onChange={(e) => setJoinMode(e.target.value as FactionJoinMode)}
          >
            <option value="open">Offen</option>
            <option value="code">Einladungscode</option>
            <option value="invite">Nur Einladung</option>
          </select>
          <button
            className="vs-btn"
            disabled={name.trim().length < 3 || tag.trim().length < 3}
            onClick={() => network.sendCreateFaction(name.trim(), tag.trim(), joinMode)}
          >
            [FRAKTION GRÜNDEN]
          </button>
        </div>
      )}

      {tab === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Einladungscode eingeben:</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              className="vs-input"
              placeholder="CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
            <button
              className="vs-btn"
              disabled={code.length < 4}
              onClick={() => network.sendFactionAction('joinCode', { code })}
            >
              [BEITRETEN]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InviteButton() {
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="vs-btn" onClick={() => setOpen(true)}>
        [EINLADEN]
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <input
        className="vs-input"
        placeholder="Spielername"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: '120px' }}
      />
      <button
        className="vs-btn"
        disabled={!name.trim()}
        onClick={() => {
          network.sendFactionAction('invite', { targetPlayerName: name.trim() });
          setName('');
          setOpen(false);
        }}
      >
        [OK]
      </button>
      <button className="vs-btn" onClick={() => setOpen(false)}>
        [X]
      </button>
    </div>
  );
}

function JoinModeSelector({ currentMode }: { currentMode: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="vs-btn" onClick={() => setOpen(true)}>
        [MODUS]
      </button>
    );
  }

  const modes: FactionJoinMode[] = ['open', 'code', 'invite'];
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {modes.map((m) => (
        <button
          key={m}
          className={`vs-btn ${m === currentMode ? 'vs-btn-active' : ''}`}
          onClick={() => {
            network.sendFactionAction('setJoinMode', { joinMode: m });
            setOpen(false);
          }}
        >
          [{m.toUpperCase()}]
        </button>
      ))}
    </div>
  );
}
