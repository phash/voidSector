import { useStore } from '../state/store';

const panelStyle: React.CSSProperties = {
  padding: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-primary)',
  fontSize: '0.7rem',
  height: '100%',
  overflow: 'auto',
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
        AUSWAHL TREFFEN
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
        AUFTRAG NICHT GEFUNDEN
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
        ZIELE
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
        BELOHNUNG
      </div>

      <div>{quest.rewards.credits} CR</div>
      <div>{quest.rewards.xp} XP</div>
      {quest.rewards.reputation > 0 && <div>+{quest.rewards.reputation} RUF</div>}

      <button
        className="vs-btn"
        style={{
          marginTop: 12,
          fontSize: '0.65rem',
          display: 'block',
          width: '100%',
          borderColor: 'var(--color-danger)',
          color: 'var(--color-danger)',
        }}
        disabled
      >
        [VERLASSEN]
      </button>
    </div>
  );
}
