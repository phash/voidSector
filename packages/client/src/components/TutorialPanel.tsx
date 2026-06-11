/**
 * Tutorial-Panel — persistenter Wegweiser für Neuspieler über dem Radar.
 * Zeigt den aktuellen Schritt der serverseitig getrackten Tutorial-Kette
 * (BEWEGEN → SCANNEN → MINEN → LIEFERN); verschwindet nach Abschluss.
 */

import React from 'react';
import { TUTORIAL_STEPS } from '@void-sector/shared';
import { useStore } from '../state/store';

export function TutorialPanel() {
  const tutorial = useStore((s) => s.tutorial);
  const showTip = useStore((s) => s.showTip);

  if (!tutorial || tutorial.done) return null;
  const step = TUTORIAL_STEPS[tutorial.step];
  if (!step) return null;

  return (
    <div
      data-testid="tutorial-panel"
      style={{
        position: 'absolute',
        top: 6,
        left: 6,
        zIndex: 5,
        maxWidth: 280,
        background: 'rgba(0, 12, 4, 0.88)',
        border: '1px solid var(--color-primary)',
        padding: '5px 8px',
        fontFamily: 'monospace',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span
          data-testid="tutorial-step"
          style={{
            color: 'var(--color-primary)',
            fontSize: '0.6rem',
            letterSpacing: '0.08em',
            fontWeight: 'bold',
          }}
        >
          ◈ TUTORIAL [{tutorial.step + 1}/{tutorial.total}]
        </span>
        <button
          onClick={() => showTip('first_tutorial')}
          title="Hilfe"
          data-testid="tutorial-help"
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: '1px solid var(--color-dim)',
            color: 'var(--color-dim)',
            fontSize: '0.55rem',
            cursor: 'pointer',
            padding: '0px 4px',
            fontFamily: 'monospace',
          }}
        >
          ?
        </button>
      </div>
      <div
        style={{
          color: 'var(--color-primary)',
          fontSize: '0.68rem',
          fontWeight: 'bold',
          letterSpacing: '0.06em',
        }}
      >
        {step.title}
        {tutorial.step === 2 && (
          <span style={{ color: 'var(--color-dim)', marginLeft: 6, fontWeight: 'normal' }}>
            {tutorial.oreMined}/{tutorial.oreTarget} Erz
          </span>
        )}
      </div>
      <div style={{ color: 'var(--color-dim)', fontSize: '0.62rem', lineHeight: 1.45, marginTop: 2 }}>
        → {step.hint}
      </div>
    </div>
  );
}
