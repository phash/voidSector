import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { WreckItem } from '@void-sector/shared';

function difficultyLabel(difficulty: number): string {
  if (difficulty <= 0.25) return 'EINFACH';
  if (difficulty <= 0.55) return 'MITTEL';
  if (difficulty <= 0.75) return 'SCHWER';
  return 'SEHR SCHWER';
}

function itemLabel(item: WreckItem): string {
  if (item.itemType === 'resource') {
    return item.itemId.startsWith('artefact_')
      ? `ARTEFAKT (${item.itemId.replace('artefact_', '')})`
      : `${item.itemId.toUpperCase()} ×${item.quantity}`;
  }
  if (item.itemType === 'blueprint') return `BLUEPRINT: ${item.itemId}`;
  if (item.itemType === 'data_slate') return 'DATA SLATE ◈';
  return item.itemId;
}

function ProgressBar({ startedAt, duration }: { startedAt: number; duration: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(1, elapsed / duration));
    }, 100);
    return () => clearInterval(interval);
  }, [startedAt, duration]);

  const filled = Math.round(progress * 16);
  const empty = 16 - filled;
  const remaining = Math.max(0, Math.ceil((duration - (Date.now() - startedAt)) / 1000));

  return (
    <span style={{ color: 'var(--color-primary)', fontSize: '0.7rem' }}>
      {'█'.repeat(filled)}{'░'.repeat(empty)}
      {' '}BERGUNG... {remaining}s
    </span>
  );
}

export function WreckPanel() {
  const activeWreck = useStore((s) => s.activeWreck);
  const salvageSession = useStore((s) => s.salvageSession);
  const setActiveWreck = useStore((s) => s.setActiveWreck);

  if (!activeWreck) return null;

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.8rem',
      padding: '12px',
      height: '100%',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        color: 'var(--color-primary)',
        letterSpacing: '0.15em',
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: '8px',
        marginBottom: '12px',
      }}>
        ⊠ WRACK — TIER {activeWreck.tier} · {activeWreck.size.toUpperCase()}
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 80px 100px',
        gap: '4px',
        color: 'var(--color-dim)',
        fontSize: '0.65rem',
        letterSpacing: '0.1em',
        marginBottom: '6px',
      }}>
        <span>FRACHT</span>
        <span>CHANCE</span>
        <span></span>
      </div>

      {/* Items */}
      {activeWreck.items.map((item, idx) => {
        const isActive = salvageSession?.itemIndex === idx && salvageSession?.wreckId === activeWreck.wreckId;
        const chance = Math.round((1.0 - item.baseDifficulty) * 100);

        return (
          <div
            key={idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 100px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid rgba(255,176,0,0.1)',
              opacity: item.salvaged ? 0.4 : 1,
            }}
          >
            <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>
              {itemLabel(item)}
            </span>

            <span style={{ color: 'var(--color-dim)', fontSize: '0.7rem' }}>
              {item.salvaged ? '—' : `${chance}%`}
            </span>

            <span>
              {item.salvaged ? (
                <span style={{ fontSize: '0.65rem', color: '#666' }}>VERSUCHT</span>
              ) : isActive && salvageSession ? (
                <ProgressBar startedAt={salvageSession.startedAt} duration={salvageSession.duration} />
              ) : (
                <button
                  disabled={!!salvageSession}
                  onClick={() => network.sendStartSalvage(idx)}
                  style={{
                    border: '1px solid var(--color-primary)',
                    background: 'none',
                    color: 'var(--color-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    cursor: salvageSession ? 'not-allowed' : 'pointer',
                    padding: '2px 6px',
                    opacity: salvageSession ? 0.4 : 1,
                  }}
                >
                  [BERGEN]
                </button>
              )}
            </span>
          </div>
        );
      })}

      {/* Close */}
      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setActiveWreck(null)}
          style={{
            border: '1px solid var(--color-dim)',
            background: 'none',
            color: 'var(--color-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            cursor: 'pointer',
            padding: '2px 8px',
          }}
        >
          [SCHLIESSEN]
        </button>
      </div>
    </div>
  );
}
