import { useEffect } from 'react';
import { useStore } from '../state/store';

const ONBOARDING_STEPS = [
  { text: 'RADAR — Dein Universum. Klicke auf Sektoren für Details.', spotlight: 'cockpit-sec2' },
  { text: 'D-PAD — Steuere dein Schiff. 1 AP pro Sprung.', spotlight: 'cockpit-sec5' },
  { text: 'AP — Action Points: die Kern-Ressource. Sie regenerieren automatisch.', spotlight: null },
  { text: 'ZIEL: Finde einen Asteroiden-Sektor und starte MINING.', spotlight: null },
  { text: 'Kompendium [◈] für alle Details. Viel Erfolg, Pilot.', spotlight: 'compendium-btn' },
];

export function HelpOverlay() {
  const activeTip = useStore((s) => s.activeTip);
  const dismissTip = useStore((s) => s.dismissTip);
  const openCompendium = useStore((s) => s.openCompendium);
  const onboardingStep = useStore((s) => s.onboardingStep);
  const advanceOnboarding = useStore((s) => s.advanceOnboarding);
  const skipOnboarding = useStore((s) => s.skipOnboarding);

  // Keyboard dismiss for help tip
  useEffect(() => {
    if (!activeTip) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissTip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTip, dismissTip]);

  // Auto-advance onboarding after 3s
  useEffect(() => {
    if (onboardingStep === null) return;
    const timer = setTimeout(advanceOnboarding, 3000);
    return () => clearTimeout(timer);
  }, [onboardingStep, advanceOnboarding]);

  // Spotlight: box-shadow cutout on highlighted element
  useEffect(() => {
    if (onboardingStep === null) return;
    if (onboardingStep >= ONBOARDING_STEPS.length) return;
    const step = ONBOARDING_STEPS[onboardingStep];
    if (!step.spotlight) return;
    const el = document.getElementById(step.spotlight);
    if (el) {
      el.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.7)';
      el.style.position = 'relative';
      el.style.zIndex = '10001';
    }
    return () => {
      if (el) {
        el.style.boxShadow = '';
        el.style.position = '';
        el.style.zIndex = '';
      }
    };
  }, [onboardingStep]);

  // Render onboarding flow when active
  if (onboardingStep !== null) {
    if (onboardingStep >= ONBOARDING_STEPS.length) return null;
    const step = ONBOARDING_STEPS[onboardingStep];
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
        {/* Click-through overlay to advance on click */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'all' }} onClick={advanceOnboarding} />
        {/* Message Box */}
        <div style={{
          position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)',
          background: '#0a0a0a', border: '1px solid var(--color-primary)',
          padding: '16px 24px', fontFamily: 'monospace', fontSize: '0.85rem',
          color: 'var(--color-primary)', maxWidth: '400px', textAlign: 'center',
          pointerEvents: 'all', zIndex: 1,
        }}>
          <div style={{ marginBottom: '12px' }}>{step.text}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={skipOnboarding}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.7rem' }}
            >
              [ÜBERSPRINGEN]
            </button>
            <div style={{ color: '#555', fontSize: '0.7rem' }}>{onboardingStep + 1} / 5</div>
            <button
              onClick={(e) => { e.stopPropagation(); advanceOnboarding(); }}
              style={{ border: '1px solid var(--color-primary)', background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontFamily: 'monospace', padding: '2px 8px' }}
            >
              [WEITER]
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeTip) return null;

  return (
    <div
      onClick={dismissTip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 80px 0',
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(0, 0, 0, 0.92)',
          border: '1px solid var(--color-primary)',
          borderLeft: '4px solid var(--color-primary)',
          padding: '16px 20px',
          maxWidth: '480px',
          width: '90%',
          fontFamily: 'var(--font-mono)',
          animation: 'crt-expand 200ms ease-out',
        }}
      >
        <div
          style={{
            color: 'var(--color-primary)',
            fontSize: '0.75rem',
            letterSpacing: '0.15em',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>◈ {activeTip.title}</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--color-dim)' }}>HILFE</span>
        </div>
        <div
          style={{
            color: '#CCCCCC',
            fontSize: '0.8rem',
            lineHeight: 1.6,
          }}
        >
          {activeTip.body}
        </div>
        {activeTip.articleId && (
          <div style={{ marginTop: '10px' }}>
            <button
              onClick={() => {
                openCompendium(activeTip.articleId);
              }}
              data-testid="compendium-link"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                letterSpacing: '0.1em',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              MEHR IM KOMPENDIUM ▸
            </button>
          </div>
        )}
        <div
          style={{
            marginTop: '12px',
            textAlign: 'right',
            fontSize: '0.65rem',
            color: 'var(--color-dim)',
            letterSpacing: '0.1em',
          }}
        >
          [ESC / KLICK zum Schliessen]
        </div>
      </div>
    </div>
  );
}
