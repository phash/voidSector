import { useState, useRef } from 'react';

/**
 * Generic two-click confirmation for destructive actions.
 * First click arms the key; second click within timeout executes the callback.
 * Arming a new key automatically disarms the previous one.
 */
export function useConfirm(timeout: number | null = 3000) {
  const [pending, setPending] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirm = (key: string, onConfirm: () => void) => {
    if (pending === key) {
      clearTimeout(timerRef.current!);
      setPending(null);
      onConfirm();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPending(key);
      if (timeout !== null) {
        timerRef.current = setTimeout(() => setPending(null), timeout);
      }
    }
  };

  const isArmed = (key: string) => pending === key;

  const disarm = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPending(null);
  };

  return { confirm, isArmed, disarm };
}
