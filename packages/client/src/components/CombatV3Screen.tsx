import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { CombatV3State, CombatModule, CombatV3RoundResult } from '@void-sector/shared';

function HpBar({ current, max, color, label }: { current: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: 'var(--color-dim)' }}>
        <span>{label}</span>
        <span>{Math.round(current)} / {max}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// Suppress unused import warning — types used only for annotation
type _CombatModule = CombatModule;
type _CombatV3RoundResult = CombatV3RoundResult;

export function CombatV3Screen() {
  const combatState = useStore((s) => s.combatV3);
  const combatLog = useStore((s) => s.combatV3Log);
  const clearCombatV3 = useStore((s) => s.clearCombatV3);
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());
  const [tactic, setTactic] = useState<'assault' | 'balanced' | 'defensive'>('balanced');

  if (!combatState) return null;

  const state = combatState as CombatV3State;
  const energyBudget = state.playerEnergyBudget;
  const energyUsed = state.playerModules
    .filter((m) => activeModules.has(m.moduleId) && m.energyCost > 0 && m.hp > 0)
    .reduce((sum, m) => sum + m.energyCost, 0);
  const overBudget = energyUsed > energyBudget;

  function toggleModule(moduleId: string) {
    setActiveModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  function handleFire() {
    if (overBudget) return;
    network.sendCombatV3Action([...activeModules], tactic);
  }

  function handleFlee() {
    network.sendCombatV3Flee();
  }

  // Initialize active modules on first render — activate all that fit in budget
  if (activeModules.size === 0 && state.playerModules.length > 0) {
    const initial = new Set<string>();
    let remaining = energyBudget;
    for (const m of state.playerModules) {
      if (m.hp > 0 && m.energyCost > 0 && m.energyCost <= remaining) {
        initial.add(m.moduleId);
        remaining -= m.energyCost;
      }
    }
    if (initial.size > 0) setActiveModules(initial);
  }

  const tacticColors = { assault: '#FF4444', balanced: '#FFB000', defensive: '#00BFFF' };

  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '8px',
      display: 'flex', flexDirection: 'column', height: '100%', gap: 6,
    }}>
      {/* Header */}
      <div style={{ color: '#FF4444', letterSpacing: '0.2em', fontSize: '0.65rem' }}>
        COMBAT V3 — RUNDE {state.round} / {state.maxRounds}
        {state.outcome && (
          <span style={{ marginLeft: 8, color: state.outcome === 'victory' ? '#00FF88' : '#FF4444' }}>
            [{state.outcome.toUpperCase()}]
          </span>
        )}
      </div>

      {/* Status bars — player vs enemy side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ color: '#00FF88', fontSize: '0.55rem', letterSpacing: '0.1em', marginBottom: 2 }}>SPIELER</div>
          <HpBar current={state.playerShield} max={state.playerShieldMax} color="#00BFFF" label="SHIELD" />
          <HpBar current={state.playerArmorHp} max={state.playerArmorMax} color="#FF8800" label="ARMOR" />
        </div>
        <div>
          <div style={{ color: '#FF4444', fontSize: '0.55rem', letterSpacing: '0.1em', marginBottom: 2 }}>GEGNER</div>
          <HpBar current={state.enemyShield} max={state.enemyShieldMax} color="#00BFFF" label="SHIELD" />
          <HpBar current={state.enemyArmorHp} max={state.enemyArmorMax ?? state.enemyArmorHp} color="#FF8800" label="ARMOR" />
        </div>
      </div>

      {/* Energy budget bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem' }}>
          <span style={{ color: overBudget ? '#FF4444' : 'var(--color-primary)' }}>
            ENERGY: {energyUsed} / {energyBudget} {overBudget ? '⚠ ÜBERLASTET' : ''}
          </span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, energyBudget > 0 ? (energyUsed / energyBudget) * 100 : 0)}%`,
            background: overBudget ? '#FF4444' : '#FFB000',
          }} />
        </div>
      </div>

      {/* Module toggles */}
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid rgba(255,176,0,0.15)', padding: 4 }}>
        {state.playerModules.filter((m) => m.energyCost > 0 || m.category.startsWith('weapon')).map((m) => {
          const isActive = activeModules.has(m.moduleId);
          const isDestroyed = m.hp <= 0;
          return (
            <div key={m.moduleId} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '2px 4px', marginBottom: 1,
              opacity: isDestroyed ? 0.3 : 1,
              background: isActive ? 'rgba(255,176,0,0.05)' : 'transparent',
            }}>
              <button
                onClick={() => !isDestroyed && !state.outcome && toggleModule(m.moduleId)}
                disabled={isDestroyed || !!state.outcome}
                style={{
                  background: 'none', border: 'none', color: isActive ? '#00FF88' : '#555',
                  fontFamily: 'inherit', fontSize: '0.6rem', cursor: isDestroyed ? 'default' : 'pointer',
                  padding: 0, width: 30,
                }}
              >
                [{isActive ? 'ON' : 'OFF'}]
              </button>
              <span style={{ flex: 1, color: isDestroyed ? '#555' : 'var(--color-primary)', fontSize: '0.6rem', marginLeft: 4 }}>
                {m.name} {isDestroyed ? '✕' : ''}
              </span>
              <span style={{ color: 'var(--color-dim)', fontSize: '0.55rem', width: 40, textAlign: 'right' }}>
                {m.energyCost}E
              </span>
              <span style={{ color: 'var(--color-dim)', fontSize: '0.55rem', width: 50, textAlign: 'right' }}>
                {m.category.startsWith('weapon') ? `ATK ${m.stats.atk ?? 0}` :
                 m.category === 'shield' ? `SHD ${m.stats.shield ?? 0}` :
                 m.category.startsWith('defense') ? 'DEF' :
                 m.category === 'repair' ? `REP ${m.stats.repairRate ?? 0}` : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tactic selector */}
      {!state.outcome && (
        <div style={{ display: 'flex', gap: 4 }}>
          {(['assault', 'balanced', 'defensive'] as const).map((t) => (
            <button key={t}
              onClick={() => setTactic(t)}
              style={{
                flex: 1, padding: '3px 0', fontFamily: 'inherit', fontSize: '0.6rem',
                background: tactic === t ? 'rgba(255,176,0,0.1)' : 'none',
                border: `1px solid ${tactic === t ? tacticColors[t] : '#333'}`,
                color: tactic === t ? tacticColors[t] : '#555', cursor: 'pointer',
              }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {!state.outcome && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="vs-btn" onClick={handleFire} disabled={overBudget}
            style={{ flex: 2, fontSize: '0.7rem', opacity: overBudget ? 0.4 : 1 }}>
            [FEUERN]
          </button>
          <button className="vs-btn" onClick={handleFlee} disabled={state.round < 2}
            style={{ flex: 1, fontSize: '0.7rem', opacity: state.round < 2 ? 0.3 : 1, borderColor: '#FF8800', color: '#FF8800' }}>
            [FLIEHEN]
          </button>
        </div>
      )}

      {/* Close button — dismiss the result screen once combat has ended */}
      {state.outcome && (
        <button className="vs-btn" onClick={clearCombatV3}
          style={{ width: '100%', fontSize: '0.7rem' }}>
          [SCHLIESSEN]
        </button>
      )}

      {/* Round log */}
      {combatLog.length > 0 && (
        <div style={{ maxHeight: 80, overflowY: 'auto', border: '1px solid rgba(255,176,0,0.1)', padding: 4, fontSize: '0.55rem', color: 'var(--color-dim)' }}>
          {combatLog.slice().reverse().flatMap((r) =>
            r.roundLog.map((line, i) => <div key={`${r.round}-${i}`}>[R{r.round}] {line}</div>)
          )}
        </div>
      )}
    </div>
  );
}
