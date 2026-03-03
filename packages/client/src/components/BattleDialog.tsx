import { useStore } from '../state/store';
import { network } from '../network/client';

export function BattleDialog() {
  const activeBattle = useStore((s) => s.activeBattle);

  if (!activeBattle) return null;

  const { pirateLevel, pirateHp, pirateDamage, canNegotiate, negotiateCost, sectorX, sectorY } = activeBattle;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        border: '2px solid #FF3333', background: '#0a0a0a', padding: '16px', maxWidth: '350px',
        fontFamily: 'monospace', fontSize: '12px',
      }}>
        <div style={{ color: '#FF3333', fontSize: '14px', marginBottom: '8px', textAlign: 'center' }}>
          PIRATEN-KONTAKT
        </div>
        <div style={{ color: '#FFB000', marginBottom: '12px' }}>
          <div>Sektor: ({sectorX}, {sectorY})</div>
          <div>Piraten-Level: {pirateLevel}</div>
          <div>HP: {pirateHp} | DMG: {pirateDamage}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => network.sendBattleAction('fight', sectorX, sectorY)}
            style={{
              background: '#1a1a1a', color: '#FF3333', border: '1px solid #FF3333',
              padding: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
            }}
          >
            [KAMPF] -- Auto-Resolve
          </button>

          <button
            onClick={() => network.sendBattleAction('flee', sectorX, sectorY)}
            style={{
              background: '#1a1a1a', color: '#FFB000', border: '1px solid #FFB000',
              padding: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
            }}
          >
            [FLUCHT] -- 2 AP, 60% Chance
          </button>

          {canNegotiate && (
            <button
              onClick={() => network.sendBattleAction('negotiate', sectorX, sectorY)}
              style={{
                background: '#1a1a1a', color: '#00FF88', border: '1px solid #00FF88',
                padding: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
              }}
            >
              [VERHANDELN] -- {negotiateCost} CR
            </button>
          )}

          {!canNegotiate && (
            <div style={{ color: 'rgba(255,176,0,0.3)', fontSize: '10px', textAlign: 'center' }}>
              Verhandlung erfordert Piraten-Rep &gt;= Friendly
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
