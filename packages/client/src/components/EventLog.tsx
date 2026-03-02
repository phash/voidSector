import { useRef, useEffect } from 'react';
import { useStore } from '../state/store';

export function EventLog() {
  const log = useStore((s) => s.log);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      padding: '6px 12px',
      fontSize: '0.7rem',
      opacity: 0.7,
      lineHeight: 1.6,
    }}>
      {log.map((entry, i) => (
        <div key={i}>&gt; {entry}</div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
