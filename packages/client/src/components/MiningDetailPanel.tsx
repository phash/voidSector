import { useStore } from '../state/store';
import { MiningArtwork } from './MiningArtwork';
import { MINING_STORY, STORY_FRAGMENT_COUNT } from '../data/miningStory';

const panelStyle: React.CSSProperties = {
  padding: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-primary)',
  fontSize: '0.7rem',
  height: '100%',
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

export function MiningDetailPanel() {
  const mining = useStore((s) => s.mining);
  const storyIndex = useStore((s) => s.miningStoryIndex);

  const isActive = mining?.active === true;
  const resource = isActive ? mining.resource : null;

  // Show the latest unlocked fragment
  const displayIndex = Math.min(storyIndex, STORY_FRAGMENT_COUNT) - 1;
  const fragment = displayIndex >= 0 ? MINING_STORY[displayIndex] : null;
  const isComplete = storyIndex >= STORY_FRAGMENT_COUNT;

  return (
    <div style={panelStyle}>
      <MiningArtwork resource={resource} />

      {fragment ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {fragment.chapter && (
            <div
              style={{
                fontSize: '0.65rem',
                letterSpacing: '0.15em',
                opacity: 0.5,
                marginBottom: 8,
              }}
            >
              {fragment.chapter}
            </div>
          )}
          <div
            key={displayIndex}
            style={{
              fontSize: '0.75rem',
              lineHeight: 1.6,
              color: 'var(--color-primary)',
              opacity: 0.85,
              animation: 'fadeIn 0.8s ease-in',
            }}
          >
            {fragment.text}
          </div>

          <div
            style={{
              marginTop: 'auto',
              paddingTop: 12,
              fontSize: '0.55rem',
              opacity: 0.3,
              letterSpacing: '0.1em',
            }}
          >
            {isComplete
              ? 'THE END — SO LONG, AND THANKS FOR ALL THE ORE.'
              : `[FRAGMENT ${storyIndex}/${STORY_FRAGMENT_COUNT}]`}
          </div>
        </div>
      ) : (
        <div style={{ opacity: 0.4, fontSize: '0.65rem', textAlign: 'center', marginTop: 16 }}>
          {isActive
            ? 'INITIALIZING STORY DATABASE...'
            : 'MINE TO BEGIN THE STORY...'}
        </div>
      )}

      {!isActive && fragment && !isComplete && (
        <div
          style={{
            fontSize: '0.6rem',
            opacity: 0.35,
            textAlign: 'center',
            marginTop: 8,
            letterSpacing: '0.1em',
          }}
        >
          MINE TO CONTINUE...
        </div>
      )}
    </div>
  );
}
