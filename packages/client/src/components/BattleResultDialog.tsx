import { useStore } from '../state/store';

export function BattleResultDialog() {
  const lastBattleResult = useStore((s) => s.lastBattleResult);
  const setLastBattleResult = useStore((s) => s.setLastBattleResult);

  if (!lastBattleResult) return null;

  const { encounter, result } = lastBattleResult;

  const outcomeLabels: Record<string, { label: string; color: string }> = {
    victory: { label: 'SIEG', color: '#00FF88' },
    defeat: { label: 'NIEDERLAGE', color: '#FF3333' },
    escaped: { label: 'GEFLOHEN', color: '#FFB000' },
    caught: { label: 'FLUCHT GESCHEITERT', color: '#FF3333' },
    negotiated: { label: 'VERHANDELT', color: '#00BFFF' },
  };

  const { label, color } = outcomeLabels[result.outcome] ?? { label: result.outcome.toUpperCase(), color: '#FFB000' };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        border: `2px solid ${color}`, background: '#0a0a0a', padding: '16px', maxWidth: '350px',
        fontFamily: 'monospace', fontSize: '12px', minWidth: '280px',
      }}>
        <div style={{ color, fontSize: '14px', marginBottom: '12px', textAlign: 'center', letterSpacing: '0.15em' }}>
          {label}
        </div>

        <div style={{ color: '#FFB000', marginBottom: '12px', lineHeight: 1.8 }}>
          <div>Sektor: ({encounter.sectorX}, {encounter.sectorY})</div>
          <div>Piraten-Level: {encounter.pirateLevel}</div>
        </div>

        {result.lootCredits != null && result.lootCredits > 0 && (
          <div style={{ color: '#00FF88', marginBottom: '4px' }}>
            + {result.lootCredits} CREDITS
          </div>
        )}

        {result.lootResources && Object.entries(result.lootResources).some(([, v]) => v && v > 0) && (
          <div style={{ marginBottom: '4px' }}>
            <div style={{ color: '#00FF88', opacity: 0.7, fontSize: '10px' }}>BEUTE:</div>
            {Object.entries(result.lootResources).map(([res, amount]) => (
              amount && amount > 0 ? (
                <div key={res} style={{ color: '#00FF88' }}>+ {amount} {res.toUpperCase()}</div>
              ) : null
            ))}
          </div>
        )}

        {result.cargoLost && Object.entries(result.cargoLost).some(([, v]) => v && v > 0) && (
          <div style={{ marginBottom: '4px' }}>
            <div style={{ color: '#FF3333', opacity: 0.7, fontSize: '10px' }}>VERLUSTE:</div>
            {Object.entries(result.cargoLost).map(([res, amount]) => (
              amount && amount > 0 ? (
                <div key={res} style={{ color: '#FF3333' }}>- {amount} {res.toUpperCase()}</div>
              ) : null
            ))}
          </div>
        )}

        {result.xpGained != null && result.xpGained > 0 && (
          <div style={{ color: '#FFB000', marginBottom: '4px' }}>
            + {result.xpGained} XP
          </div>
        )}

        {result.repChange != null && result.repChange !== 0 && (
          <div style={{ color: result.repChange > 0 ? '#00FF88' : '#FF3333', marginBottom: '4px' }}>
            {result.repChange > 0 ? '+' : ''}{result.repChange} PIRATEN-REP
          </div>
        )}

        <button
          onClick={() => setLastBattleResult(null)}
          style={{
            width: '100%', marginTop: '12px',
            background: '#1a1a1a', color, border: `1px solid ${color}`,
            padding: '8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
            letterSpacing: '0.1em',
          }}
        >
          [BESTÄTIGEN]
        </button>
      </div>
    </div>
  );
}
