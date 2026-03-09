// packages/client/src/components/overlays/AlienEncounterToast.tsx
import { useEffect } from 'react';
import { useStore } from '../../state/store';
import { network } from '../../network/client';

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

export function AlienEncounterToast() {
  const encounter = useStore((s) => s.alienEncounterEvent);
  const setEncounter = useStore((s) => s.setAlienEncounterEvent);

  useEffect(() => {
    if (!encounter || encounter.canRespond) return;
    // Auto-dismiss non-interactive encounters after 8s
    const t = setTimeout(() => setEncounter(null), 8000);
    return () => clearTimeout(t);
  }, [encounter, setEncounter]);

  if (!encounter) return null;

  const color = FACTION_COLORS[encounter.factionId] ?? 'var(--color-primary)';

  const handleAccept = () => {
    network.resolveAlienEncounter(encounter.factionId, encounter.eventType, true);
  };

  const handleDecline = () => {
    network.resolveAlienEncounter(encounter.factionId, encounter.eventType, false);
  };

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 16,
      width: 280,
      border: `1px solid ${color}`,
      background: '#050505',
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.7rem',
      zIndex: 150,
    }}>
      <div style={{
        color,
        fontSize: '0.6rem',
        letterSpacing: '0.2em',
        marginBottom: 6,
      }}>
        {encounter.factionId.toUpperCase().replace(/_/g, ' ')} — KONTAKT
        {encounter.humanityTier && (
          <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>
            {' '}MENSCHHEITS-REP: {encounter.humanityTier}
          </span>
        )}
      </div>
      <div style={{
        color: 'var(--color-dim)',
        lineHeight: 1.5,
        marginBottom: encounter.canRespond ? 10 : 0,
      }}>
        {encounter.eventText}
      </div>
      {encounter.canRespond && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button
            onClick={handleDecline}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-dim)',
              color: 'var(--color-dim)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            {encounter.declineLabel ?? 'ABLEHNEN'}
          </button>
          <button
            onClick={handleAccept}
            style={{
              background: color,
              border: 'none',
              color: '#000',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            {encounter.acceptLabel ?? 'ANNEHMEN'}
          </button>
        </div>
      )}
    </div>
  );
}
