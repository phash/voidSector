interface WantedPosterProps {
  targetName: string;
  targetLevel: number;
  reward: number;
}

export function WantedPoster({ targetName, reward, targetLevel }: WantedPosterProps) {
  const formattedReward = reward.toLocaleString('de-DE');

  return (
    <div style={{
      border: '2px solid #c8a020',
      background: '#0a0800',
      color: '#c8a020',
      fontFamily: 'monospace',
      padding: '8px',
      width: '110px',
      flexShrink: 0,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid #c8a020', paddingBottom: '4px', marginBottom: '4px' }}>
        WANTED
      </div>
      <div style={{ fontSize: '18px', margin: '6px 0', color: '#e8c040' }}>
        ◉_◉
      </div>
      <div style={{ fontSize: '9px', fontWeight: 'bold', lineHeight: '1.2' }}>
        {targetName.toUpperCase()}
      </div>
      <div style={{ borderTop: '1px solid #c8a020', marginTop: '6px', paddingTop: '4px', fontSize: '10px' }}>
        {formattedReward} ¢
      </div>
      <div style={{ fontSize: '9px', marginTop: '2px', color: '#a08010' }}>
        LVL{targetLevel} {'█'.repeat(targetLevel)}
      </div>
    </div>
  );
}
