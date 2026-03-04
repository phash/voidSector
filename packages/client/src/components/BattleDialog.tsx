import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const PIRATE_ART = [
  '    ╱╲  ╱╲    ',
  '   ╱██╲╱██╲   ',
  '  │╔══╗╔══╗│  ',
  '══╡║ ▓╟╢▓ ║╞══',
  '  │╚══╝╚══╝│  ',
  '   ╲  ╱╲  ╱   ',
  '    ╲╱  ╲╱    ',
];

const ANCIENT_ART = [
  ' ≋≋≋≋≋≋≋≋≋≋≋≋ ',
  '≋ ◈ ════════ ◈ ≋',
  '≋ ║ ◆◇◆◇◆◇◆ ║ ≋',
  '≋ ╠═[ANCIENT]=╣ ≋',
  '≋ ║ ◇◆◇◆◇◆◇ ║ ≋',
  '≋ ◈ ════════ ◈ ≋',
  ' ≋≋≋≋≋≋≋≋≋≋≋≋ ',
];

export function BattleDialog() {
  const activeBattle = useStore((s) => s.activeBattle);

  useEffect(() => {
    if (!activeBattle) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        network.sendBattleAction('flee', activeBattle.sectorX, activeBattle.sectorY);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeBattle]);

  if (!activeBattle) return null;

  const { pirateLevel, pirateHp, pirateDamage, canNegotiate, negotiateCost, sectorX, sectorY } = activeBattle;
  const isAncient = pirateLevel >= 6;
  const enemyArt = isAncient ? ANCIENT_ART : PIRATE_ART;
  const contactLabel = isAncient ? 'ALIEN-KONTAKT' : 'PIRATEN-KONTAKT';
  const contactColor = isAncient ? '#00BFFF' : '#FF3333';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="battle-title"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div style={{
        border: `2px solid ${contactColor}`, background: '#0a0a0a', padding: '16px', maxWidth: '380px',
        fontFamily: 'monospace', fontSize: '12px',
      }}>
        <div id="battle-title" style={{ color: contactColor, fontSize: '14px', marginBottom: '8px', textAlign: 'center' }}>
          {contactLabel}
        </div>
        <pre style={{
          color: contactColor, fontSize: '0.65rem', lineHeight: 1.3, margin: '0 0 10px',
          textAlign: 'center', textShadow: `0 0 6px ${contactColor}`,
        }}>
          {enemyArt.join('\n')}
        </pre>
        <div style={{ color: '#FFB000', marginBottom: '12px' }}>
          <div>Sektor: ({sectorX}, {sectorY})</div>
          <div>{isAncient ? 'Alien-Level' : 'Piraten-Level'}: {pirateLevel}</div>
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
