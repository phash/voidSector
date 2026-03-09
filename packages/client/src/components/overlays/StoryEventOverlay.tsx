import { useStore } from '../../state/store';
import { network } from '../../network/client';

export function StoryEventOverlay() {
  const storyEvent = useStore((s) => s.storyEvent);
  const setStoryEvent = useStore((s) => s.setStoryEvent);

  if (!storyEvent) return null;

  const handleChoice = (branchId: string | null) => {
    network.sendStoryChoice(storyEvent.chapterId, branchId);
    setStoryEvent(null);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200,
    }}>
      <div style={{
        border: '2px solid var(--color-primary)',
        background: '#040404',
        padding: '24px 32px',
        maxWidth: 520,
        width: '90%',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-primary)',
      }}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '0.3em', color: 'var(--color-dim)', marginBottom: 8 }}>
          KAPITEL {storyEvent.chapterId}
        </div>
        <div style={{ fontSize: '1.1rem', letterSpacing: '0.2em', marginBottom: 16 }}>
          {storyEvent.title}
        </div>
        <div style={{
          fontSize: '0.8rem', lineHeight: 1.7,
          color: 'var(--color-dim)', marginBottom: 20,
          borderLeft: '2px solid var(--color-primary)',
          paddingLeft: 12,
        }}>
          {storyEvent.flavorText}
        </div>

        {storyEvent.branches ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {storyEvent.branches.map((b) => (
              <button
                key={b.id}
                onClick={() => handleChoice(b.id)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-primary)',
                  color: 'var(--color-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  letterSpacing: '0.05em',
                }}
              >
                [{b.id}] {b.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => handleChoice(null)}
            style={{
              background: 'var(--color-primary)',
              border: 'none',
              color: '#000',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              padding: '8px 24px',
              cursor: 'pointer',
              letterSpacing: '0.1em',
            }}
          >
            VERSTANDEN
          </button>
        )}
      </div>
    </div>
  );
}
