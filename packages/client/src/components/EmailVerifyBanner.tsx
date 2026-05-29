import { useStore } from '../state/store';

/** Top banner shown to logged-in (non-guest) users whose email isn't verified yet. */
export function EmailVerifyBanner() {
  const token = useStore((s) => s.token);
  const isGuest = useStore((s) => s.isGuest);
  const emailVerified = useStore((s) => s.emailVerified);

  if (!token || isGuest || emailVerified) return null;

  return (
    <div
      data-testid="email-verify-banner"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9500,
        background: '#3a2a00',
        borderBottom: '1px solid var(--color-primary)',
        color: 'var(--color-primary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.72rem',
        letterSpacing: '0.05em',
        textAlign: 'center',
        padding: '4px 8px',
      }}
    >
      ⚠ Bitte bestätige deine E-Mail-Adresse — der Bestätigungslink wurde dir gesendet.
    </div>
  );
}
