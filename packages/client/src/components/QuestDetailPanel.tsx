import { useStore } from '../state/store';
import { network } from '../network/client';
import { WantedPoster } from './WantedPoster';

const panelStyle: React.CSSProperties = {
  padding: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-primary)',
  fontSize: '0.7rem',
  height: '100%',
  overflow: 'auto',
};

const abandonBtnStyle: React.CSSProperties = {
  marginTop: 12,
  fontSize: '0.65rem',
  display: 'block',
  width: '100%',
  borderColor: 'var(--color-danger)',
  color: 'var(--color-danger)',
};

export function QuestDetailPanel() {
  const selectedQuest = useStore((s) => s.selectedQuest);
  const activeQuests = useStore((s) => s.activeQuests);

  if (!selectedQuest) {
    return (
      <div
        style={{
          ...panelStyle,
          color: 'var(--color-dim)',
          textAlign: 'center',
          marginTop: 24,
        }}
      >
        SELECT A QUEST
      </div>
    );
  }

  const quest = activeQuests.find((q) => q.id === selectedQuest);
  if (!quest) {
    return (
      <div
        style={{
          ...panelStyle,
          color: 'var(--color-dim)',
          textAlign: 'center',
          marginTop: 24,
        }}
      >
        QUEST NOT FOUND
      </div>
    );
  }

  const trailObj = quest.objectives[0]?.type === 'bounty_trail' ? quest.objectives[0] : null;

  if (trailObj) {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
          <WantedPoster
            targetName={trailObj.targetName ?? '???'}
            targetLevel={trailObj.targetLevel ?? 1}
            reward={quest.rewards.credits ?? 0}
          />
          <div style={{ flex: 1, fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#e8c040' }}>
              {(trailObj.targetName ?? '???').toUpperCase()}
            </div>
            <div>Typ: Pirat Kl.{trailObj.targetLevel ?? '?'}</div>
            <div>Von: {quest.npcName}</div>
            <div>Belohnung: {(quest.rewards.credits ?? 0).toLocaleString('de-DE')}¢</div>
            <div>XP: +{quest.rewards.xp ?? 0}</div>
          </div>
        </div>
        {trailObj.currentHint && (
          <div style={{ marginBottom: '8px', padding: '4px', border: '1px solid #333', fontSize: '10px' }}>
            <span style={{ color: '#c8a020' }}>◈ HINWEIS</span>
            <div style={{ marginTop: '2px', color: '#aaa' }}>{trailObj.currentHint}</div>
          </div>
        )}
        <div style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--color-dim)', marginBottom: 4 }}>
          OBJECTIVES
        </div>
        {quest.objectives.map((obj, i) => (
          <div key={i} style={{ marginBottom: 4, color: obj.fulfilled ? '#00FF88' : 'var(--color-primary)' }}>
            <span>{obj.fulfilled ? '[x]' : '[ ]'} </span>
            <span>{obj.description}</span>
          </div>
        ))}
        <button
          className="vs-btn"
          style={abandonBtnStyle}
          onClick={() => network.sendAbandonQuest(quest.id)}
        >
          [ABANDON]
        </button>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 'bold',
          marginBottom: 4,
          letterSpacing: '0.1em',
        }}
      >
        {quest.title}
      </div>

      <div style={{ color: 'var(--color-dim)', marginBottom: 8 }}>{quest.description}</div>

      {/* Objectives */}
      <div
        style={{
          fontSize: '0.6rem',
          letterSpacing: '0.1em',
          color: 'var(--color-dim)',
          marginBottom: 4,
        }}
      >
        OBJECTIVES
      </div>

      {quest.objectives.map((obj, i) => (
        <div
          key={i}
          style={{
            marginBottom: 4,
            color: obj.fulfilled ? '#00FF88' : 'var(--color-primary)',
          }}
        >
          <span>{obj.fulfilled ? '[x]' : '[ ]'} </span>
          <span>{obj.description}</span>
          {obj.amount != null && obj.progress != null && (
            <span style={{ color: 'var(--color-dim)' }}>
              {' '}
              ({obj.progress}/{obj.amount})
            </span>
          )}
        </div>
      ))}

      {/* Rewards */}
      <div
        style={{
          marginTop: 8,
          fontSize: '0.6rem',
          letterSpacing: '0.1em',
          color: 'var(--color-dim)',
          marginBottom: 4,
        }}
      >
        REWARD
      </div>

      <div>{quest.rewards.credits} CR</div>
      <div>{quest.rewards.xp} XP</div>
      {quest.rewards.reputation > 0 && <div>+{quest.rewards.reputation} REP</div>}
      {quest.rewards.rewardBlueprint && (
        <div style={{ color: '#AA88FF', fontSize: '0.7rem', marginTop: 4 }}>
          BLUEPRINT: {quest.rewards.rewardBlueprint.toUpperCase().replace(/_/g, ' ')}
        </div>
      )}

      <button
        className="vs-btn"
        style={abandonBtnStyle}
        onClick={() => network.sendAbandonQuest(quest.id)}
      >
        [ABANDON]
      </button>
    </div>
  );
}
