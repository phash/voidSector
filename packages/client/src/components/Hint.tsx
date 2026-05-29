import { useState, type ReactNode, type CSSProperties } from 'react';

/**
 * Wraps an element (typically a disabled action button) and shows a CRT-styled tooltip on hover
 * explaining why the action is unavailable. When `reason` is null/empty the children render
 * unchanged (no wrapper). The hover lives on the wrapper span because disabled buttons don't
 * emit pointer events themselves. Pass `style` (e.g. `{ display: 'flex', width: '100%' }`) to keep
 * full-width buttons full-width.
 */
export function Hint({
  reason,
  children,
  style,
}: {
  reason?: string | null;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const [show, setShow] = useState(false);

  if (!reason) return <>{children}</>;

  return (
    <span
      data-testid="hint-wrap"
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          data-testid="hint-tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0a0a0a',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            letterSpacing: '0.04em',
            lineHeight: 1.3,
            padding: '4px 8px',
            maxWidth: 220,
            width: 'max-content',
            textAlign: 'center',
            zIndex: 10000,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          {reason}
        </span>
      )}
    </span>
  );
}
