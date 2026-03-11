import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULE_EP_COSTS, MODULE_HP_BY_TIER } from '@void-sector/shared';
import type { ClientCombatState, ClientModule } from '../state/gameSlice';

// ─── EP cost helpers ─────────────────────────────────────────────────────────

type PowerLevel = 'off' | 'low' | 'mid' | 'high';

const POWER_LEVELS: PowerLevel[] = ['off', 'low', 'mid', 'high'];

function getEpCost(category: string, powerLevel: PowerLevel): number {
  const costs = MODULE_EP_COSTS[category as keyof typeof MODULE_EP_COSTS];
  if (!costs) return 0;
  return costs[powerLevel] ?? 0;
}

function calcTotalEpCost(allocations: Record<string, PowerLevel>, modules: ClientModule[]): number {
  let total = 0;
  for (const mod of modules) {
    if (mod.category === 'generator') continue; // generator allocates, not costs
    const pl = allocations[mod.moduleId] ?? 'off';
    total += getEpCost(mod.category, pl);
  }
  return total;
}

// ─── sr-only style ────────────────────────────────────────────────────────────

const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function HpBar({
  current,
  max,
  label,
  color,
  name,
}: {
  current: number;
  max: number;
  label: string;
  color: string;
  name: string;
}) {
  const pct = max > 0 ? Math.max(0, current / max) : 0;
  const barWidth = 18;
  const filled = Math.round(pct * barWidth);
  const bar = '\u25A0'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  return (
    <div
      role="meter"
      aria-label={`${name} Trefferpunkte`}
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={`${current} von ${max}`}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.68rem',
        color,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {label.padEnd(7)} [{bar}] {current}/{max}
    </div>
  );
}

function moduleHpColor(current: number, max: number): string {
  if (max <= 0) return '#555';
  const ratio = current / max;
  if (ratio >= 0.75) return '#00ff41';
  if (ratio >= 0.5) return '#aaff00';
  if (ratio >= 0.25) return '#ff8800';
  if (ratio > 0) return '#ff4136';
  return '#333'; // destroyed
}

function EpCostLabel({ cost }: { cost: number }) {
  if (cost === 0) return <span style={{ color: '#6a6a6a' }}>0EP</span>;
  return <span style={{ color: '#aaa' }}>{cost}EP</span>;
}

// ─── Main CombatDialog ────────────────────────────────────────────────────────

type PrimaryActionType = 'attack' | 'scan' | 'flee' | 'wait' | 'aim';
type ReactionType = 'none' | 'shield_boost' | 'ecm_pulse' | 'emergency_eject';

const SECTION: React.CSSProperties = {
  border: '1px solid #1a3a1a',
  padding: '8px',
  marginBottom: '8px',
};

const SECTION_HEADER: React.CSSProperties = {
  fontSize: '0.58rem',
  color: '#55aa55',
  letterSpacing: '0.15em',
  marginBottom: '6px',
};

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.68rem',
};

function powerLevelLabel(pl: PowerLevel): string {
  return pl.toUpperCase().padEnd(4);
}

export function CombatDialog() {
  const combat = useStore((s) => s.activeCombat);
  const setActiveCombat = useStore((s) => s.setActiveCombat);

  // Energy allocations: moduleId → powerLevel
  const [allocations, setAllocations] = useState<Record<string, PowerLevel>>({});
  // Primary action
  const [primaryAction, setPrimaryAction] = useState<PrimaryActionType>('attack');
  // Aim target module category (used when primaryAction === 'aim')
  const [aimTarget, setAimTarget] = useState<string>('');
  // Reaction
  const [reaction, setReaction] = useState<ReactionType>('none');
  // Use ancient ability this round
  const [useAncient, setUseAncient] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset allocations when combat starts
  useEffect(() => {
    if (!combat) return;
    const defaults: Record<string, PowerLevel> = {};
    for (const mod of combat.playerModules) {
      defaults[mod.moduleId] = (mod.powerLevel as PowerLevel) ?? 'off';
    }
    setAllocations(defaults);
    setPrimaryAction('attack');
    setAimTarget('');
    setReaction('none');
    setUseAncient(false);
  }, [combat?.round]); // reset on each new round

  // Scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [combat?.log]);

  const handleClose = useCallback(() => {
    setActiveCombat(null);
  }, [setActiveCombat]);

  // ── Focus trapping ──────────────────────────────────────────────────────────
  const isEnded = !!(combat?.outcome && combat.outcome !== 'ongoing');

  useEffect(() => {
    if (!combat) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement as HTMLElement;

    const firstFocusable = dialog.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isEnded) {
        handleClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        dialog!.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [combat, isEnded, handleClose]);

  if (!combat) return null;

  const nonGeneratorModules = combat.playerModules.filter((m) => m.category !== 'generator');
  const generatorModule = combat.playerModules.find((m) => m.category === 'generator');

  // Available EP: generator output (simplified client-side estimate) + epBuffer
  // Exact server-side calc is authoritative; client shows estimate
  const generatorEpEstimate = (() => {
    if (!generatorModule) return 0;
    const tier = generatorModule.tier ?? 1;
    const EP_BY_TIER: Record<number, number> = { 1: 6, 2: 9, 3: 12, 4: 15, 5: 18 };
    const baseEp = EP_BY_TIER[tier] ?? 6; // T1=6, T2=9, T3=12, T4=15, T5=18
    const currentHp = generatorModule.currentHp ?? MODULE_HP_BY_TIER[tier as keyof typeof MODULE_HP_BY_TIER] ?? 20;
    const maxHp = generatorModule.maxHp ?? MODULE_HP_BY_TIER[tier as keyof typeof MODULE_HP_BY_TIER] ?? 20;
    const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;
    const pl = (allocations[generatorModule.moduleId] ?? 'high') as PowerLevel;
    const mult = pl === 'off' ? 0 : pl === 'low' ? 0.4 : pl === 'mid' ? 0.7 : 1.0;
    return baseEp * hpRatio * mult;
  })();
  const availableEp = generatorEpEstimate + combat.epBuffer;
  const totalEpCost = calcTotalEpCost(allocations, nonGeneratorModules);
  const overBudget = totalEpCost > availableEp;

  // Check which modules have HP > 0 and can be powered
  const hasWeaponPowered = nonGeneratorModules.some(
    (m) => m.category === 'weapon' && (allocations[m.moduleId] ?? 'off') !== 'off' && (m.currentHp ?? 0) > 0,
  );
  const hasScannerPowered = nonGeneratorModules.some(
    (m) => m.category === 'scanner' && (allocations[m.moduleId] ?? 'off') !== 'off' && (m.currentHp ?? 0) > 0,
  );
  const hasDrivePowered = nonGeneratorModules.some(
    (m) => m.category === 'drive' && (allocations[m.moduleId] ?? 'off') !== 'off' && (m.currentHp ?? 0) > 0,
  );
  const hasShield = nonGeneratorModules.some(
    (m) => m.category === 'shield' && (m.currentHp ?? 0) > 0,
  );

  // Ancient ability availability
  const hasAncientCore = combat.playerModules.some((m) => m.category === 'ancient_core');
  const ancientReady =
    hasAncientCore && combat.ancientChargeRounds >= 3 && !combat.ancientAbilityUsed;

  // Revealed enemy modules for aim target selection
  const revealedEnemyModules = combat.enemyModules.filter((m) => m.revealed && m.currentHp > 0);

  const hpLow = combat.playerHp / combat.playerMaxHp < 0.15;

  const handleSubmit = useCallback(() => {
    if (overBudget || isEnded) return;

    // Build energy allocations array
    const energyAllocations = combat.playerModules.map((mod) => ({
      moduleId: mod.moduleId,
      category: mod.category,
      powerLevel: (allocations[mod.moduleId] ?? 'off') as PowerLevel,
    }));

    // Build primary action
    let pa: { type: string; targetModuleId?: string; targetModuleCategory?: string };
    if (primaryAction === 'aim' && aimTarget) {
      pa = { type: 'aim', targetModuleCategory: aimTarget };
    } else {
      pa = { type: primaryAction };
    }

    // Build reaction
    const rc = reaction !== 'none' ? { type: reaction } : undefined;

    // Ancient ability
    const aa = useAncient && ancientReady ? { type: 'energy_pulse' } : undefined;

    // Determine sectorX/Y — not tracked in ClientCombatState, use 0/0 as placeholder
    // (server knows the position from the session)
    network.sendCombatRound({ energyAllocations, primaryAction: pa, reactionChoice: rc, ancientAbility: aa }, 0, 0);
  }, [
    combat,
    allocations,
    primaryAction,
    aimTarget,
    reaction,
    useAncient,
    ancientReady,
    overBudget,
    isEnded,
  ]);

  const enemyName = `${combat.enemyType.toUpperCase()} LV.${combat.enemyLevel}`;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.95)',
    zIndex: 1100,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    fontFamily: 'var(--font-mono)',
    color: '#00ff41',
    overflowY: 'auto',
  };

  const dialogStyle: React.CSSProperties = {
    border: '2px solid #00ff41',
    background: '#020802',
    padding: '14px',
    width: '100%',
    maxWidth: '600px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0px',
    boxShadow: '0 0 20px rgba(0,255,65,0.15)',
  };

  // ── Outcome label for live region ────────────────────────────────────────────
  const outcomeLabels: Record<string, string> = {
    victory: 'SIEG',
    defeat: 'NIEDERLAGE',
    fled: 'FLUCHT ERFOLGREICH',
    draw: 'UNENTSCHIEDEN',
    ejected: 'NOTAUSSTIEG',
  };
  const outcome = combat.outcome ? (outcomeLabels[combat.outcome] ?? combat.outcome.toUpperCase()) : '';

  // ── Result Overlay ──────────────────────────────────────────────────────────
  if (isEnded) {
    const outcomeColors: Record<string, string> = {
      victory: '#00ff41',
      defeat: '#ff4136',
      fled: '#ffaa00',
      draw: '#aaaaaa',
      ejected: '#ff8800',
    };
    const oc = combat.outcome ?? 'draw';
    const color = outcomeColors[oc] ?? '#aaa';
    const label = outcomeLabels[oc] ?? oc.toUpperCase();

    return (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="combat-result-title"
        style={containerStyle}
      >
        {/* Kampfergebnis — assertive live region */}
        <div aria-live="assertive" aria-atomic="true" style={srOnlyStyle}>
          Kampf beendet: {outcome}
        </div>

        <div style={{ ...dialogStyle, textAlign: 'center' }}>
          <div
            id="combat-result-title"
            style={{
              fontSize: '2rem',
              color,
              letterSpacing: '0.3em',
              textShadow: `0 0 20px ${color}`,
              marginBottom: '16px',
            }}
          >
            {label}
          </div>

          {combat.outcome === 'victory' && combat.loot && (
            <div style={{ marginBottom: '16px', ...MONO }}>
              <div style={{ color: '#55aa55', fontSize: '0.6rem', marginBottom: '6px', letterSpacing: '0.15em' }}>
                BEUTE
              </div>
              {combat.loot.credits !== undefined && combat.loot.credits > 0 && (
                <div style={{ color: '#ffaa00' }}>+{combat.loot.credits} CR</div>
              )}
              {combat.loot.ore !== undefined && combat.loot.ore > 0 && (
                <div style={{ color: '#aaccaa' }}>+{combat.loot.ore} ORE</div>
              )}
              {combat.loot.crystal !== undefined && combat.loot.crystal > 0 && (
                <div style={{ color: '#88ccff' }}>+{combat.loot.crystal} CRYSTAL</div>
              )}
            </div>
          )}

          <div
            style={{
              fontSize: '0.65rem',
              color: '#77aa77',
              marginBottom: '16px',
              maxHeight: '100px',
              overflowY: 'auto',
              textAlign: 'left',
            }}
          >
            {combat.log.slice(-5).map((line, i) => (
              <div key={i} style={{ color: '#66aa66' }}>{line}</div>
            ))}
          </div>

          <button
            className="combat-btn"
            onClick={handleClose}
            data-testid="combat-close-btn"
            style={{
              background: 'transparent',
              color,
              border: `1px solid ${color}`,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              padding: '10px 24px',
              cursor: 'pointer',
              letterSpacing: '0.15em',
            }}
          >
            [SCHLIESSEN]
          </button>
        </div>
      </div>
    );
  }

  // ── Active Combat Dialog ────────────────────────────────────────────────────
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="combat-title"
      style={containerStyle}
    >
      {/* Unsichtbare Live-Region für Rundenwechsel */}
      <div aria-live="polite" aria-atomic="true" style={srOnlyStyle}>
        {combat && `Runde ${combat.round} von 10. Schiff: ${combat.playerHp} von ${combat.playerMaxHp} HP. Feind: ${combat.enemyHp} von ${combat.enemyMaxHp} HP.`}
      </div>

      <div style={dialogStyle}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          id="combat-title"
          style={{
            fontSize: '0.78rem',
            letterSpacing: '0.2em',
            borderBottom: '1px solid #1a3a1a',
            paddingBottom: '6px',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>KAMPF — RUNDE {combat.round}/10</span>
          <span style={{ color: '#ff4136', fontSize: '0.7rem' }}>{enemyName}</span>
        </div>

        {/* ── Status Bars ────────────────────────────────────────────────── */}
        <div style={{ ...SECTION }}>
          <div style={SECTION_HEADER}>STATUS</div>
          <HpBar current={combat.playerHp} max={combat.playerMaxHp} label="SCHIFF" color="#00ff41" name="Schiff" />
          <HpBar current={combat.enemyHp} max={combat.enemyMaxHp} label="FEIND " color="#ff4136" name="Feind" />
          <div
            style={{
              fontSize: '0.6rem',
              color: '#77aa77',
              marginTop: '4px',
            }}
          >
            EP: {availableEp.toFixed(1)} verf. | {combat.epBuffer.toFixed(1)} Puffer
          </div>
        </div>

        {/* ── Energy Distribution ─────────────────────────────────────────── */}
        <div style={{ ...SECTION }}>
          <div style={SECTION_HEADER}>
            ENERGIE-VERTEILUNG
            <span
              style={{
                marginLeft: '8px',
                color: overBudget ? '#ff4136' : '#00ff41',
              }}
            >
              {totalEpCost.toFixed(1)}/{availableEp.toFixed(1)} EP
              {overBudget && (
                <span role="alert" style={{ color: '#ff4136', marginLeft: '8px' }}>
                  ÜBERBUDGET
                </span>
              )}
            </span>
          </div>

          {/* Generator row (controls output) */}
          {generatorModule && (
            <div
              style={{
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: '0.62rem',
                  color: moduleHpColor(generatorModule.currentHp ?? generatorModule.maxHp, generatorModule.maxHp),
                  minWidth: '80px',
                }}
              >
                GENERATOR T{generatorModule.tier}
              </span>
              <span style={{ fontSize: '0.58rem', color: '#6a6a6a' }}>
                {generatorModule.currentHp ?? generatorModule.maxHp}/{generatorModule.maxHp} HP
              </span>
              {POWER_LEVELS.map((pl) => {
                const active = (allocations[generatorModule.moduleId] ?? 'high') === pl;
                return (
                  <button
                    className="combat-btn"
                    key={pl}
                    data-testid={`gen-pl-${pl}`}
                    onClick={() =>
                      setAllocations((prev) => ({ ...prev, [generatorModule.moduleId]: pl }))
                    }
                    style={{
                      background: active ? '#003300' : 'transparent',
                      color: active ? '#00ff41' : '#55aa55',
                      border: `1px solid ${active ? '#00ff41' : '#1a3a1a'}`,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.58rem',
                      padding: '5px 8px',
                      minHeight: '32px',
                      cursor: 'pointer',
                    }}
                  >
                    {powerLevelLabel(pl)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Module rows */}
          {nonGeneratorModules.map((mod) => {
            const pl = (allocations[mod.moduleId] ?? 'off') as PowerLevel;
            const destroyed = (mod.currentHp ?? 0) <= 0;
            return (
              <div
                key={mod.moduleId}
                style={{
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexWrap: 'wrap',
                  opacity: destroyed ? 0.35 : 1,
                }}
              >
                <span
                  style={{
                    fontSize: '0.62rem',
                    color: moduleHpColor(mod.currentHp ?? mod.maxHp, mod.maxHp),
                    minWidth: '80px',
                    textTransform: 'uppercase',
                  }}
                >
                  {mod.category} T{mod.tier}
                </span>
                <span style={{ fontSize: '0.58rem', color: '#6a6a6a' }}>
                  {mod.currentHp ?? mod.maxHp}/{mod.maxHp} HP
                </span>
                {POWER_LEVELS.map((level) => {
                  const active = pl === level;
                  const cost = getEpCost(mod.category, level);
                  return (
                    <button
                      className="combat-btn"
                      key={level}
                      data-testid={`mod-${mod.moduleId}-${level}`}
                      disabled={destroyed}
                      onClick={() =>
                        !destroyed &&
                        setAllocations((prev) => ({ ...prev, [mod.moduleId]: level }))
                      }
                      title={`${level.toUpperCase()} — ${cost} EP`}
                      style={{
                        background: active ? '#003300' : 'transparent',
                        color: active ? '#00ff41' : '#55aa55',
                        border: `1px solid ${active ? '#00ff41' : '#1a3a1a'}`,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.58rem',
                        padding: '5px 8px',
                        minHeight: '32px',
                        cursor: destroyed ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {powerLevelLabel(level)}
                      <br />
                      <EpCostLabel cost={cost} />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* ── Primary Action ──────────────────────────────────────────────── */}
        <div style={{ ...SECTION }}>
          <div style={SECTION_HEADER}>PRIMÄRAKTION</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(
              [
                { action: 'attack' as const, label: 'ANGRIFF', enabled: hasWeaponPowered, tooltip: 'Waffe muss auf LOW+' },
                { action: 'aim' as const, label: 'GEZIELT', enabled: hasWeaponPowered, tooltip: 'Waffe muss auf LOW+' },
                { action: 'scan' as const, label: 'SCAN', enabled: hasScannerPowered, tooltip: 'Scanner muss auf LOW+' },
                { action: 'flee' as const, label: 'FLUCHT', enabled: hasDrivePowered, tooltip: 'Antrieb muss auf LOW+' },
                { action: 'wait' as const, label: 'WARTEN', enabled: true, tooltip: '' },
              ] as const
            ).map(({ action, label, enabled, tooltip }) => (
              <button
                className="combat-btn"
                key={action}
                data-testid={`action-${action}`}
                disabled={!enabled}
                onClick={() => enabled && setPrimaryAction(action)}
                title={tooltip}
                style={{
                  background: primaryAction === action ? '#003300' : 'transparent',
                  color: primaryAction === action ? '#00ff41' : enabled ? '#55aa55' : '#4a4a4a',
                  border: `1px solid ${primaryAction === action ? '#00ff41' : enabled ? '#1a3a1a' : '#111'}`,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.62rem',
                  padding: '5px 8px',
                  cursor: enabled ? 'pointer' : 'not-allowed',
                  opacity: enabled ? 1 : 0.4,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Disabled action hints */}
          {primaryAction === 'attack' && !hasWeaponPowered && (
            <div style={{ fontSize: '0.6rem', color: '#ff8800', marginTop: '4px' }}>
              Waffe muss mindestens auf LOW stehen
            </div>
          )}
          {primaryAction === 'scan' && !hasScannerPowered && (
            <div style={{ fontSize: '0.6rem', color: '#ff8800', marginTop: '4px' }}>
              Scanner muss mindestens auf LOW stehen
            </div>
          )}
          {primaryAction === 'flee' && !hasDrivePowered && (
            <div style={{ fontSize: '0.6rem', color: '#ff8800', marginTop: '4px' }}>
              Antrieb muss mindestens auf LOW stehen
            </div>
          )}

          {/* Aim target selector */}
          {primaryAction === 'aim' && revealedEnemyModules.length > 0 && (
            <div style={{ marginTop: '6px', ...MONO, fontSize: '0.62rem' }}>
              <label htmlFor="aim-target-select" style={{ color: '#77aa77', marginRight: '6px' }}>ZIEL:</label>
              <select
                id="aim-target-select"
                value={aimTarget}
                onChange={(e) => setAimTarget(e.target.value)}
                data-testid="aim-target-select"
                style={{
                  background: '#020802',
                  color: '#00ff41',
                  border: '1px solid #1a3a1a',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.62rem',
                  padding: '2px 4px',
                }}
              >
                <option value="">-- Modul wählen --</option>
                {revealedEnemyModules.map((em, i) => (
                  <option key={i} value={em.category}>
                    {em.category.toUpperCase()} T{em.tier} ({em.currentHp}/{em.maxHp} HP)
                  </option>
                ))}
              </select>
            </div>
          )}
          {primaryAction === 'aim' && revealedEnemyModules.length === 0 && (
            <div style={{ marginTop: '6px', fontSize: '0.6rem', color: '#555' }}>
              Feind-Module nicht aufgedeckt — Scan zuerst
            </div>
          )}
        </div>

        {/* ── Reaction ───────────────────────────────────────────────────── */}
        <div style={{ ...SECTION }}>
          <div style={SECTION_HEADER}>REAKTION (OPTIONAL)</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(
              [
                { type: 'none' as const, label: 'KEINE', enabled: true },
                { type: 'shield_boost' as const, label: 'SCHILD BOOST', enabled: hasShield },
                { type: 'ecm_pulse' as const, label: 'ECM PULS', enabled: true },
                { type: 'emergency_eject' as const, label: '⚠ NOTAUSSTIEG', enabled: hpLow },
              ] as const
            ).map(({ type, label, enabled }) => (
              <button
                className="combat-btn"
                key={type}
                data-testid={`reaction-${type}`}
                disabled={!enabled}
                onClick={() => enabled && setReaction(type)}
                style={{
                  background: reaction === type ? '#003300' : 'transparent',
                  color:
                    type === 'emergency_eject'
                      ? reaction === type
                        ? '#ff8800'
                        : '#773300'
                      : reaction === type
                        ? '#00ff41'
                        : enabled
                          ? '#55aa55'
                          : '#4a4a4a',
                  border: `1px solid ${
                    type === 'emergency_eject'
                      ? reaction === type
                        ? '#ff8800'
                        : '#331100'
                      : reaction === type
                        ? '#00ff41'
                        : enabled
                          ? '#1a3a1a'
                          : '#111'
                  }`,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.58rem',
                  padding: '4px 7px',
                  cursor: enabled ? 'pointer' : 'not-allowed',
                  opacity: enabled ? 1 : 0.3,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {!hpLow && (
            <div style={{ fontSize: '0.57rem', color: '#555', marginTop: '4px' }}>
              Notausstieg bei &lt;15% HP verfügbar
            </div>
          )}
        </div>

        {/* ── Ancient Ability ────────────────────────────────────────────── */}
        {ancientReady && (
          <div style={{ ...SECTION, borderColor: '#0a2a4a' }}>
            <div style={{ ...SECTION_HEADER, color: '#00BFFF' }}>
              ANCIENT ABILITY — BEREIT ({combat.ancientChargeRounds} Runden geladen)
            </div>
            <button
              className="combat-btn"
              data-testid="ancient-ability-btn"
              onClick={() => setUseAncient((v) => !v)}
              style={{
                background: useAncient ? '#001133' : 'transparent',
                color: useAncient ? '#00BFFF' : '#005577',
                border: `1px solid ${useAncient ? '#00BFFF' : '#003355'}`,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.62rem',
                padding: '5px 10px',
                cursor: 'pointer',
              }}
            >
              {useAncient ? '[AKTIV] ' : ''}ENERGIE-PULS — Ignoriert Schilde, 20 Direktschaden
            </button>
          </div>
        )}
        {hasAncientCore && !ancientReady && !combat.ancientAbilityUsed && (
          <div style={{ fontSize: '0.58rem', color: '#334', marginBottom: '6px', paddingLeft: '2px' }}>
            ANCIENT CORE: {combat.ancientChargeRounds}/3 Runden geladen
          </div>
        )}

        {/* ── Enemy Modules ──────────────────────────────────────────────── */}
        <div style={{ ...SECTION }}>
          <div style={SECTION_HEADER}>FEIND-MODULE</div>
          {combat.enemyModules.length === 0 && (
            <div style={{ fontSize: '0.6rem', color: '#555' }}>Keine Module bekannt</div>
          )}
          {combat.enemyModules.map((em, i) => (
            <div
              key={i}
              style={{
                fontSize: '0.62rem',
                marginBottom: '2px',
                color: em.revealed ? moduleHpColor(em.currentHp, em.maxHp) : '#555',
              }}
            >
              {em.revealed ? (
                <>
                  {em.category.toUpperCase()} T{em.tier} — {em.currentHp}/{em.maxHp} HP
                  {em.currentHp <= 0 && <span style={{ color: '#555' }}> [ZERSTÖRT]</span>}
                </>
              ) : (
                <span style={{ color: '#4a4a4a' }}>??? [UNBEKANNT — Scan für Details]</span>
              )}
            </div>
          ))}
        </div>

        {/* ── Combat Log ─────────────────────────────────────────────────── */}
        <div style={{ ...SECTION }}>
          <div style={SECTION_HEADER}>KAMPF-PROTOKOLL</div>
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            style={{
              maxHeight: '90px',
              overflowY: 'auto',
              fontSize: '0.6rem',
              color: '#66aa66',
              lineHeight: 1.5,
            }}
          >
            {combat.log.length === 0 && (
              <div style={{ color: '#223322' }}>Kampf beginnt in Runde 1...</div>
            )}
            {combat.log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>

        {/* ── Submit ─────────────────────────────────────────────────────── */}
        <button
          className="combat-btn"
          data-testid="submit-round-btn"
          disabled={overBudget}
          onClick={handleSubmit}
          style={{
            background: overBudget ? 'transparent' : '#001a00',
            color: overBudget ? '#4a4a4a' : '#00ff41',
            border: `2px solid ${overBudget ? '#4a4a4a' : '#00ff41'}`,
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            padding: '10px',
            cursor: overBudget ? 'not-allowed' : 'pointer',
            letterSpacing: '0.2em',
            width: '100%',
            marginTop: '4px',
          }}
        >
          {overBudget ? '⚠ EP-BUDGET ÜBERSCHRITTEN' : 'RUNDE AUSFÜHREN'}
        </button>
      </div>
    </div>
  );
}
