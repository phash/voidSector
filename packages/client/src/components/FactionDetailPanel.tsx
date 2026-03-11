import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { MONITORS, FACTION_UPGRADE_TIERS } from '@void-sector/shared';
import { network } from '../network/client';

function getRepTier(rep: number): string {
  if (rep < -200) return 'FEINDSELIG';
  if (rep > 200) return 'FREUNDLICH';
  return 'NEUTRAL';
}

export function FactionDetailPanel() {
  const faction = useStore((s) => s.faction);
  if (faction) return <FactionMemberPanel />;
  return <FactionRecruitPanel />;
}

function FactionMemberPanel() {
  const faction = useStore((s) => s.faction)!;
  const members = useStore((s) => s.factionMembers);
  const factionUpgrades = useStore((s) => s.factionUpgrades);
  const playerId = useStore((s) => s.playerId);
  const setMonitorMode = useStore((s) => s.setMonitorMode);

  const myRank = members.find((m) => m.playerId === playerId)?.rank ?? 'member';

  const activeUpgrades = factionUpgrades.map((u) => {
    const tierDef = FACTION_UPGRADE_TIERS[u.tier];
    const opt = u.choice === 'A' ? tierDef.optionA : tierDef.optionB;
    return opt.effect;
  });

  const nextTierNum = [1, 2, 3].find((t) => !factionUpgrades.some((u) => u.tier === t));
  const nextTierDef = nextTierNum ? FACTION_UPGRADE_TIERS[nextTierNum] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px', fontSize: '0.78rem' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '2px', color: '#ffb000', marginBottom: '8px' }}>
        ◈ {faction.name} · {faction.memberCount} MEMBERS
      </div>

      <div style={{ background: '#0a0800', border: '1px solid #222', padding: '6px 8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.6rem', color: '#555', marginBottom: '2px' }}>DEIN RANG</div>
        <div style={{ color: '#fff', fontSize: '0.9rem' }}>{myRank.toUpperCase()}</div>
      </div>

      {activeUpgrades.length > 0 && (
        <div style={{ marginBottom: '6px' }}>
          <div style={{ fontSize: '0.6rem', color: '#555', marginBottom: '2px' }}>ACTIVE UPGRADES</div>
          <div style={{ color: '#aaa', fontSize: '0.68rem' }}>
            {activeUpgrades.map((u) => `✓ ${u}`).join('  ')}
          </div>
        </div>
      )}

      {nextTierDef && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '0.6rem', color: '#555', marginBottom: '2px' }}>NÄCHSTER UPGRADE</div>
          <div style={{ color: '#ffb000', fontSize: '0.68rem' }}>
            → TIER {nextTierNum}: {nextTierDef.optionA.name} vs {nextTierDef.optionB.name}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', marginTop: 'auto' }}>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setMonitorMode(MONITORS.FACTION, 'members')}
        >
          [MEMBERS →]
        </button>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setMonitorMode(MONITORS.FACTION, 'upgrades')}
        >
          [UPGRADES →]
        </button>
      </div>
    </div>
  );
}

function FactionRecruitPanel() {
  const humanityReps = useStore((s) => s.humanityReps);
  const recruitingFactions = useStore((s) => s.recruitingFactions);
  const setMonitorMode = useStore((s) => s.setMonitorMode);
  const setActiveProgram = useStore((s) => s.setActiveProgram);
  const [cardIdx, setCardIdx] = useState(0);

  useEffect(() => {
    network.requestHumanityReps();
  }, []);

  useEffect(() => {
    if (recruitingFactions.length <= 1) return;
    const t = setInterval(() => {
      setCardIdx((i) => (i + 1) % recruitingFactions.length);
    }, 5000);
    return () => clearInterval(t);
  }, [recruitingFactions.length]);

  const repEntries = Object.values(humanityReps);
  const totalRep = repEntries.reduce((sum, e) => sum + e.repValue, 0);
  const repTier = repEntries.length > 0 ? getRepTier(totalRep) : null;
  const currentCard = recruitingFactions[cardIdx] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px', fontSize: '0.78rem' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '10px' }}>
        {repTier ? (
          <>
            ◈ HUMANITY REP:{' '}
            <span style={{ color: '#00ffcc' }}>
              {repTier} {totalRep >= 0 ? '+' : ''}{totalRep}
            </span>
          </>
        ) : (
          <span style={{ color: '#555' }}>◈ HUMANITY REP: LOADING...</span>
        )}
      </div>

      {recruitingFactions.length === 0 ? (
        <div style={{ color: '#444', fontSize: '0.7rem' }}>NO OPEN RECRUITMENT</div>
      ) : (
        <>
          <div style={{ fontSize: '0.62rem', letterSpacing: '1px', color: '#ffb000', marginBottom: '6px' }}>
            ◈ OPEN RECRUITMENT · {cardIdx + 1} OF {recruitingFactions.length}
          </div>

          {currentCard && (
            <div
              style={{
                border: '1px solid rgba(255,176,0,0.33)',
                background: '#0a0800',
                padding: '8px 10px',
                marginBottom: '6px',
                flex: 1,
              }}
            >
              <div style={{ color: '#ffb000', fontSize: '0.75rem', marginBottom: '4px' }}>
                ⬡ {currentCard.name}
              </div>
              {currentCard.slogan && (
                <div style={{ color: '#aaa', fontSize: '0.68rem', lineHeight: 1.5, marginBottom: '4px' }}>
                  &ldquo;{currentCard.slogan}&rdquo;
                </div>
              )}
              <div style={{ color: '#555', fontSize: '0.62rem' }}>
                {currentCard.memberCount} Mitglieder
              </div>
            </div>
          )}

          {recruitingFactions.length > 1 && (
            <div
              data-testid="progress-dots"
              style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}
            >
              {recruitingFactions.map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: '3px',
                    background: i === cardIdx ? '#ffb000' : '#333',
                    borderRadius: '2px',
                  }}
                />
              ))}
            </div>
          )}

          {currentCard && (
            <button
              className="vs-btn"
              style={{ fontSize: '0.65rem', width: '100%', textAlign: 'left' }}
              onClick={() => setActiveProgram('FACTION')}
            >
              [{currentCard.name} →]
            </button>
          )}
        </>
      )}
    </div>
  );
}
