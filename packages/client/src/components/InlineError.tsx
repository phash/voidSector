import { useEffect } from 'react';
import { useStore } from '../state/store';

interface InlineErrorProps {
  /** Only show error if its code matches one of these prefixes */
  codes?: string[];
  style?: React.CSSProperties;
  autoClearMs?: number;
}

/**
 * Shows the current actionError inline, near the action that caused it.
 * Automatically clears after autoClearMs (default 4000ms).
 */
export function InlineError({ codes, style, autoClearMs = 4000 }: InlineErrorProps) {
  const actionError = useStore((s) => s.actionError);
  const setActionError = useStore((s) => s.setActionError);

  const visible =
    actionError !== null && (!codes || codes.some((c) => actionError.code.startsWith(c)));

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setActionError(null), autoClearMs);
    return () => clearTimeout(t);
  }, [visible, actionError, autoClearMs, setActionError]);

  if (!visible || !actionError) return null;

  return (
    <div
      style={{
        color: '#FF4444',
        fontSize: '0.75rem',
        letterSpacing: '0.08em',
        marginTop: 4,
        padding: '2px 4px',
        border: '1px solid #FF444488',
        background: '#FF000011',
        ...style,
      }}
    >
      ⚠ {actionError.message}
    </div>
  );
}
