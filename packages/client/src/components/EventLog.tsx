import { useStore } from '../state/store';

export function EventLog() {
  const log = useStore((s) => s.log);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      minHeight: 0,
      padding: '6px 12px',
      fontSize: '0.7rem',
      opacity: 0.7,
      lineHeight: 1.6,
    }}>
      {[...log].reverse().map((entry, i) => (
        <div key={i} style={
          entry.includes('NOTRUF') ? { color: '#FF3333' } : undefined
        }>&gt; {entry}</div>
      ))}
    </div>
  );
}
