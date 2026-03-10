import { useEffect } from 'react';
import { useStore } from '../../state/store';

const QUEST_TYPE_ICONS: Record<string, string> = {
  fetch: '📦',
  delivery: '🚚',
  scan: '🔭',
  bounty: '💀',
  story: '📖',
  community: '🌐',
};

export function QuestCompleteOverlay() {
  const queue = useStore((s) => s.questCompleteQueue);
  const shiftQuestComplete = useStore((s) => s.shiftQuestComplete);

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(shiftQuestComplete, 5000);
    return () => clearTimeout(t);
  }, [current, shiftQuestComplete]);

  if (!current) return null;

  const typePrefix = current.id.split('_')[0] ?? '';
  const icon = QUEST_TYPE_ICONS[typePrefix] ?? '✓';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: 16,
        width: 260,
        border: '1px solid #00FF88',
        background: '#050505',
        padding: '10px 14px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        zIndex: 150,
        cursor: 'pointer',
      }}
      onClick={shiftQuestComplete}
    >
      <div
        style={{
          color: '#00FF88',
          fontSize: '0.6rem',
          letterSpacing: '0.2em',
          marginBottom: 4,
        }}
      >
        {icon} QUEST ABGESCHLOSSEN
      </div>
      <div style={{ color: 'var(--color-primary)', marginBottom: 6 }}>{current.title}</div>
      <div style={{ color: 'rgba(255,176,0,0.6)', fontSize: '0.65rem' }}>
        +{current.rewards.credits ?? 0} CR · +{current.rewards.xp ?? 0} XP
        {current.rewards.wissen ? ` · +${current.rewards.wissen} Wissen` : ''}
        {current.rewards.reputation ? ` · +${current.rewards.reputation} REP` : ''}
      </div>
      <div
        style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.55rem', marginTop: 6, textAlign: 'right' }}
      >
        [KLICK ZUM SCHLIEßEN]
      </div>
    </div>
  );
}
