import { useStore } from '../state/store';

export function EventLog() {
  const log = useStore((s) => s.log);
  const stats = useStore((s) => s.playerStats);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '4px 12px',
          fontSize: '0.7rem',
          color: 'var(--color-primary)',
          borderBottom: '1px solid var(--color-primary)',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        SCANS: {stats.sectorsScanned} | QUADRANTEN: {stats.quadrantsVisited.length} | ENTDECKER:{' '}
        {stats.quadrantsFirstDiscovered} | STATIONEN: {stats.stationsVisited.length} | PILOTEN:{' '}
        {stats.playersEncountered}
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          padding: '6px 12px',
          fontSize: '0.7rem',
          opacity: 0.7,
          lineHeight: 1.6,
          display: 'flex',
          flexDirection: 'column-reverse',
        }}
      >
        <div>
          {log.map((entry, i) => (
            <div
              key={`${i}-${entry.slice(0, 20)}`}
              style={entry.includes('NOTRUF') ? { color: '#FF3333' } : undefined}
            >
              &gt; {entry}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
