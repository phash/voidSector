import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../state/store';

const FACTION_COLORS: Record<string, string> = {
  archivists: '#88ffcc',
  kthari: '#ff4444',
  mycelians: '#44ff88',
  consortium: '#ffaa44',
  tourist_guild: '#ffff44',
  scrappers: '#aaaaaa',
  mirror_minds: '#cc88ff',
  silent_swarm: '#ff8844',
  helions: '#ff44ff',
  axioms: '#ffffff',
};

interface NewsOverlayProps {
  newsText: string;
  factionId: string;
  onDone: () => void;
}

function NewsOverlay({ newsText, factionId, onDone }: NewsOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(true);
  const color = FACTION_COLORS[factionId] ?? 'var(--color-primary)';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
    video.onended = () => {
      setVisible(false);
      onDone();
    };
    // Fallback: hide after 15s
    const t = setTimeout(() => {
      setVisible(false);
      onDone();
    }, 15000);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'relative', width: '100%', maxWidth: 800 }}>
        <video
          ref={videoRef}
          src="/tv/anchor-green.mp4"
          style={{ width: '100%', display: 'block' }}
        />
        {/* Text overlaid on the greenscreen area */}
        <div
          style={{
            position: 'absolute',
            top: '18%',
            left: '38%',
            width: '58%',
            height: '55%',
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '12px 16px',
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: '0.55rem',
              letterSpacing: '0.3em',
              color,
              marginBottom: 8,
            }}
          >
            ⚠ EILMELDUNG — ERSTKONTAKT
          </div>
          <div style={{ fontSize: '0.8rem', color: '#fff', lineHeight: 1.5 }}>{newsText}</div>
        </div>
      </div>

      <button
        onClick={() => {
          setVisible(false);
          onDone();
        }}
        style={{
          position: 'absolute',
          bottom: 32,
          right: 32,
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          padding: '4px 12px',
          cursor: 'pointer',
        }}
      >
        ÜBERSPRINGEN
      </button>
    </div>
  );
}

export function FirstContactNewsOverlay() {
  const [pending, setPending] = useState<{ newsText: string; factionId: string } | null>(null);
  const shownIds = useRef(new Set<number | string>());

  // newsItems is the field in gameSlice that holds recent news events
  const newsItems = useStore((s) => s.newsItems);

  useEffect(() => {
    if (!newsItems?.length) return;

    // Find an alien_first_contact event we haven't shown yet
    const firstContactEvent = newsItems.find(
      (n) => n.event_type === 'alien_first_contact' && !shownIds.current.has(n.id ?? n.headline),
    );

    if (firstContactEvent) {
      const id = firstContactEvent.id ?? firstContactEvent.headline;
      shownIds.current.add(id);
      setPending({
        newsText: firstContactEvent.summary ?? 'ERSTKONTAKT BESTÄTIGT.',
        factionId: (firstContactEvent as any).eventData?.factionId ?? 'archivists',
      });
    }
  }, [newsItems]);

  if (!pending) return null;

  return (
    <NewsOverlay
      newsText={pending.newsText}
      factionId={pending.factionId}
      onDone={() => setPending(null)}
    />
  );
}
