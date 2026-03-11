import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MONITORS, FACTION_UPGRADE_TIERS } from '@void-sector/shared';
import type { FactionJoinMode, FactionUpgradeChoice } from '@void-sector/shared';

type FactionTab = 'info' | 'members' | 'upgrades' | 'management';

export function FactionScreen() {
  const faction = useStore((s) => s.faction);
  const invites = useStore((s) => s.factionInvites);

  useEffect(() => {
    network.requestFaction();
  }, []);

  if (!faction) {
    return <NoFactionView invites={invites} />;
  }

  return <FactionTabView />;
}

function FactionTabView() {
  const faction = useStore((s) => s.faction)!;
  const members = useStore((s) => s.factionMembers);
  const playerId = useStore((s) => s.playerId);
  const tab = (useStore((s) => s.monitorModes[MONITORS.FACTION]) ?? 'info') as FactionTab;
  const setMonitorMode = useStore((s) => s.setMonitorMode);

  const myRank = members.find((m) => m.playerId === playerId)?.rank ?? 'member';
  const isLeader = myRank === 'leader';
  const isOfficer = myRank === 'officer';

  const tabs: { id: FactionTab; label: string }[] = [
    { id: 'info', label: '[INFO]' },
    { id: 'members', label: '[MEMBERS]' },
    { id: 'upgrades', label: '[UPGRADES]' },
    ...(isLeader || isOfficer ? [{ id: 'management' as FactionTab, label: '[MGMT]' }] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      {/* Header — always visible */}
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '4px' }}>
        FACTION
      </div>
      <div style={{ fontSize: '1rem', marginBottom: '8px' }}>
        [{faction.tag}] {faction.name}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`vs-btn${tab === t.id ? ' vs-btn-active' : ''}`}
            style={{ fontSize: '0.7rem' }}
            onClick={() => setMonitorMode(MONITORS.FACTION, t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'info' && <InfoTab faction={faction} myRank={myRank} isLeader={isLeader} isOfficer={isOfficer} />}
        {tab === 'members' && <MembersTab isLeader={isLeader} isOfficer={isOfficer} />}
        {tab === 'upgrades' && <UpgradesTab isLeader={isLeader} />}
        {tab === 'management' && <ManagementTab isLeader={isLeader} />}
      </div>
    </div>
  );
}

function InfoTab({ faction, myRank, isLeader, isOfficer }: { faction: any; myRank: string; isLeader: boolean; isOfficer: boolean }) {
  return (
    <div style={{ fontSize: '0.8rem' }}>
      <div style={{ opacity: 0.7, marginBottom: '6px' }}>
        Mode: {faction.joinMode.toUpperCase()} | {faction.memberCount} Members
      </div>
      <div style={{ opacity: 0.7, marginBottom: '6px' }}>
        Rank: {myRank.toUpperCase()}
      </div>
      {(isLeader || isOfficer) && faction.joinMode === 'code' && faction.inviteCode && (
        <div style={{ opacity: 0.7, marginBottom: '6px' }}>
          Invite Code: {faction.inviteCode}
        </div>
      )}
    </div>
  );
}

function MembersTab({ isLeader, isOfficer }: { isLeader: boolean; isOfficer: boolean }) {
  const members = useStore((s) => s.factionMembers);
  const playerId = useStore((s) => s.playerId);

  return (
    <div>
      <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>MEMBERS</div>
      {members.map((m) => (
        <div
          key={m.playerId}
          style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px', fontSize: '0.8rem' }}
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
                  onClick={() => network.sendFactionAction('promote', { targetPlayerId: m.playerId })}
                >
                  [+]
                </button>
              )}
              {m.rank === 'officer' && (
                <button
                  className="vs-btn"
                  style={{ fontSize: '0.7rem', padding: '1px 4px' }}
                  onClick={() => network.sendFactionAction('demote', { targetPlayerId: m.playerId })}
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
      {!isLeader && (
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--color-dim)', paddingTop: '8px' }}>
          <button className="vs-btn" onClick={() => network.sendFactionAction('leave')}>
            [LEAVE]
          </button>
        </div>
      )}
    </div>
  );
}

function UpgradesTab({ isLeader }: { isLeader: boolean }) {
  const factionUpgrades = useStore((s) => s.factionUpgrades);

  return (
    <div>
      <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '6px', letterSpacing: '0.1em' }}>
        UPGRADE TREE
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
  );
}

function ManagementTab({ isLeader }: { isLeader: boolean }) {
  const faction = useStore((s) => s.faction)!;
  const [recruiting, setRecruiting] = useState<boolean>(faction.isRecruiting ?? false);
  const [slogan, setSlogan] = useState<string>(faction.slogan ?? '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {isLeader && faction.joinMode === 'code' && faction.inviteCode && (
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Code: {faction.inviteCode}</div>
      )}

      {/* Invite + join mode + disband */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {isLeader && <InviteButton />}
        {isLeader && <JoinModeSelector currentMode={faction.joinMode} />}
        {isLeader && (
          <button
            className="vs-btn"
            onClick={() => {
              if (confirm('Disband faction?')) network.sendFactionAction('disband');
            }}
          >
            [DISBAND]
          </button>
        )}
      </div>

      {/* Recruiting section — leader only */}
      {isLeader && (
        <div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: '8px' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '6px' }}>RECRUITING</div>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.8rem', marginBottom: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={recruiting}
              onChange={(e) => setRecruiting(e.target.checked)}
            />
            ACTIVE RECRUITING
          </label>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '4px' }}>
            SLOGAN (max 160 chars):
          </div>
          <textarea
            className="vs-input"
            value={slogan}
            onChange={(e) => setSlogan(e.target.value.slice(0, 160))}
            maxLength={160}
            rows={3}
            style={{ width: '100%', resize: 'none', marginBottom: '4px' }}
          />
          <div style={{ fontSize: '0.7rem', opacity: 0.5, textAlign: 'right', marginBottom: '6px' }}>
            {slogan.length}/160
          </div>
          <button
            className="vs-btn"
            onClick={() => network.sendSetRecruiting(recruiting, slogan || null)}
          >
            [SAVE]
          </button>
        </div>
      )}
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
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '8px' }}>
        FACTION
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
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>INVITATIONS</div>
          {invites.map((inv: any) => (
            <div
              key={inv.id}
              style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem', flexWrap: 'wrap' }}
            >
              <span>[{inv.factionTag}] {inv.factionName}</span>
              <span style={{ opacity: 0.5 }}>from {inv.inviterName}</span>
              <button className="vs-btn" style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                onClick={() => network.sendRespondInvite(inv.id, true)}>[YES]</button>
              <button className="vs-btn" style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                onClick={() => network.sendRespondInvite(inv.id, false)}>[NO]</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <button className={`vs-btn ${tab === 'create' ? 'vs-btn-active' : ''}`} onClick={() => setTab('create')}>
          [FOUND]
        </button>
        <button className={`vs-btn ${tab === 'join' ? 'vs-btn-active' : ''}`} onClick={() => setTab('join')}>
          [JOIN]
        </button>
      </div>

      {tab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input className="vs-input" placeholder="Faction name" value={name}
            onChange={(e) => setName(e.target.value)} maxLength={64} />
          <input className="vs-input" placeholder="Tag (3-5 chars)" value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())} maxLength={5} />
          <select className="vs-input" value={joinMode} onChange={(e) => setJoinMode(e.target.value as FactionJoinMode)}>
            <option value="open">OPEN</option>
            <option value="code">CODE</option>
            <option value="invite">INVITE</option>
          </select>
          <button className="vs-btn" disabled={name.trim().length < 3 || tag.trim().length < 3}
            onClick={() => network.sendCreateFaction(name.trim(), tag.trim(), joinMode)}>
            [FOUND FACTION]
          </button>
        </div>
      )}

      {tab === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Enter invite code:</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input className="vs-input" placeholder="CODE" value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} />
            <button className="vs-btn" disabled={code.length < 4}
              onClick={() => network.sendFactionAction('joinCode', { code })}>
              [JOIN]
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
    return <button className="vs-btn" onClick={() => setOpen(true)}>[INVITE]</button>;
  }

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <input className="vs-input" placeholder="Player name" value={name}
        onChange={(e) => setName(e.target.value)} style={{ width: '120px' }} />
      <button className="vs-btn" disabled={!name.trim()}
        onClick={() => {
          network.sendFactionAction('invite', { targetPlayerName: name.trim() });
          setName('');
          setOpen(false);
        }}>[OK]</button>
      <button className="vs-btn" onClick={() => setOpen(false)}>[X]</button>
    </div>
  );
}

function JoinModeSelector({ currentMode }: { currentMode: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return <button className="vs-btn" onClick={() => setOpen(true)}>[MODE]</button>;
  }

  const modes: FactionJoinMode[] = ['open', 'code', 'invite'];
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {modes.map((m) => (
        <button key={m}
          className={`vs-btn ${m === currentMode ? 'vs-btn-active' : ''}`}
          onClick={() => { network.sendFactionAction('setJoinMode', { joinMode: m }); setOpen(false); }}
        >
          [{m.toUpperCase()}]
        </button>
      ))}
    </div>
  );
}
