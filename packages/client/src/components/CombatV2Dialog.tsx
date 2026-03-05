import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { innerCoord } from '@void-sector/shared';
import type { CombatTactic, SpecialAction, CombatRound } from '@void-sector/shared';

function HpBar({
  current,
  max,
  label,
  color,
}: {
  current: number;
  max: number;
  label: string;
  color: string;
}) {
  const pct = max > 0 ? Math.max(0, current / max) : 0;
  const barWidth = 20;
  const filled = Math.round(pct * barWidth);
  const bar = '\u25A0'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color }}>
      {label} [{bar}] {current}/{max}
    </div>
  );
}

export function CombatV2Dialog() {
  const combat = useStore((s) => s.activeCombatV2);
  const [selectedSpecial, setSelectedSpecial] = useState<SpecialAction>('none');

  const handleTactic = useCallback(
    (tactic: CombatTactic) => {
      if (!combat) return;
      network.sendCombatV2Action(
        tactic,
        selectedSpecial,
        combat.encounter.sectorX,
        combat.encounter.sectorY,
      );
      setSelectedSpecial('none');
    },
    [combat, selectedSpecial],
  );

  const handleFlee = useCallback(() => {
    if (!combat) return;
    network.sendCombatV2Flee(combat.encounter.sectorX, combat.encounter.sectorY);
  }, [combat]);

  useEffect(() => {
    if (!combat) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleFlee();
      if (e.key === 'F1' || e.key === '1') {
        e.preventDefault();
        handleTactic('assault');
      }
      if (e.key === 'F2' || e.key === '2') {
        e.preventDefault();
        handleTactic('balanced');
      }
      if (e.key === 'F3' || e.key === '3') {
        e.preventDefault();
        handleTactic('defensive');
      }
      if (e.key === 'F4' || e.key === '4') {
        e.preventDefault();
        setSelectedSpecial((s) => (s === 'aim' ? 'none' : 'aim'));
      }
      if (e.key === 'F5' || e.key === '5') {
        e.preventDefault();
        setSelectedSpecial((s) => (s === 'evade' ? 'none' : 'evade'));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [combat, handleFlee, handleTactic]);

  if (!combat) return null;

  const {
    encounter,
    currentRound,
    maxRounds,
    playerHp,
    playerMaxHp,
    playerShield,
    playerMaxShield,
    enemyHp,
    enemyMaxHp,
    rounds,
    specialActionsUsed,
  } = combat;

  const isAncient = encounter.pirateLevel >= 6;
  const enemyName = isAncient
    ? `ALIEN-KONTAKT LV.${encounter.pirateLevel}`
    : `PIRATEN-KREUZER LV.${encounter.pirateLevel}`;
  const enemyColor = isAncient ? '#00BFFF' : '#FF3333';

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#000' : 'var(--color-primary)',
    border: '1px solid var(--color-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    padding: '8px 12px',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    minWidth: 100,
  });

  const disabledBtn: React.CSSProperties = {
    ...btnStyle(),
    opacity: 0.3,
    cursor: 'not-allowed',
    color: '#555',
    borderColor: '#333',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="combat-v2-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(5, 5, 5, 0.95)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-primary)',
      }}
    >
      {/* Header */}
      <div
        id="combat-v2-title"
        style={{
          fontSize: '0.8rem',
          letterSpacing: '0.2em',
          marginBottom: 12,
          borderBottom: '1px solid var(--color-primary)',
          paddingBottom: 8,
          width: '100%',
          maxWidth: 600,
          textAlign: 'center',
        }}
      >
        KAMPF-SYSTEM v2 &bull; SEKTOR ({innerCoord(encounter.sectorX)},{' '}
        {innerCoord(encounter.sectorY)}) &bull; RUNDE {currentRound}/{maxRounds}
      </div>

      {/* Ship panels */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          width: '100%',
          maxWidth: 600,
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1, border: '1px solid #333', padding: 8 }}>
          <div style={{ fontSize: '0.7rem', color: '#00FF88', marginBottom: 4 }}>DEIN SCHIFF</div>
          {playerMaxShield > 0 && (
            <HpBar current={playerShield} max={playerMaxShield} label="SCHILD" color="#00BFFF" />
          )}
          <HpBar current={playerHp} max={playerMaxHp} label="RUMPF " color="#00FF88" />
        </div>
        <div style={{ flex: 1, border: `1px solid ${enemyColor}40`, padding: 8 }}>
          <div style={{ fontSize: '0.7rem', color: enemyColor, marginBottom: 4 }}>{enemyName}</div>
          <HpBar current={enemyHp} max={enemyMaxHp} label="RUMPF " color={enemyColor} />
        </div>
      </div>

      {/* Combat log */}
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          border: '1px solid #333',
          padding: 8,
          marginBottom: 12,
          maxHeight: 120,
          overflowY: 'auto',
          fontSize: '0.6rem',
          color: '#888',
        }}
      >
        <div style={{ color: '#555', marginBottom: 4 }}>KAMPF-PROTOKOLL</div>
        {rounds.map((r: CombatRound) => (
          <div key={r.round}>
            <span style={{ color: 'var(--color-primary)' }}>RUNDE {r.round}:</span> Angriff{' '}
            {r.playerAttack} DMG | Feind {r.enemyAttack} DMG
            {r.specialEffects.map((e, i) => (
              <span key={i} style={{ color: '#00BFFF' }}>
                {' '}
                [{e}]
              </span>
            ))}
          </div>
        ))}
        {rounds.length === 0 && (
          <div style={{ color: '#555' }}>Taktik f&uuml;r Runde 1 w&auml;hlen...</div>
        )}
      </div>

      {/* Tactic buttons */}
      <div style={{ marginBottom: 8, fontSize: '0.65rem', color: '#555', letterSpacing: '0.1em' }}>
        TAKTIK
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <button style={btnStyle()} onClick={() => handleTactic('assault')}>
          [1] ANGRIFF
          <br />
          <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>+30% DMG -20% DEF</span>
        </button>
        <button style={btnStyle()} onClick={() => handleTactic('balanced')}>
          [2] AUSGEWOGEN
          <br />
          <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>Balanced</span>
        </button>
        <button style={btnStyle()} onClick={() => handleTactic('defensive')}>
          [3] DEFENSIV
          <br />
          <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>-25% DMG +35% DEF</span>
        </button>
      </div>

      {/* Special actions */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <button
          style={specialActionsUsed.aim ? disabledBtn : btnStyle(selectedSpecial === 'aim')}
          disabled={specialActionsUsed.aim}
          onClick={() =>
            !specialActionsUsed.aim && setSelectedSpecial((s) => (s === 'aim' ? 'none' : 'aim'))
          }
        >
          [4] ZIELEN{specialActionsUsed.aim ? ' (benutzt)' : ''}
        </button>
        <button
          style={specialActionsUsed.evade ? disabledBtn : btnStyle(selectedSpecial === 'evade')}
          disabled={specialActionsUsed.evade}
          onClick={() =>
            !specialActionsUsed.evade &&
            setSelectedSpecial((s) => (s === 'evade' ? 'none' : 'evade'))
          }
        >
          [5] AUSWEICHEN{specialActionsUsed.evade ? ' (benutzt)' : ''}
        </button>
      </div>

      {/* Flee */}
      <button
        style={{ ...btnStyle(), borderColor: '#FF3333', color: '#FF3333', marginTop: 4 }}
        onClick={handleFlee}
      >
        [ESC] FLUCHT — 2 AP, ~60%
      </button>
    </div>
  );
}
