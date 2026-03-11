import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULES, getDamageState } from '@void-sector/shared';

// ─── Damage state helpers (mirrors server-side getDamageState) ────────────────

const DAMAGE_STATE_COLORS = {
  intact:    '#00ff41',
  light:     '#ffcc00',
  heavy:     '#ff8800',
  destroyed: '#ff4136',
};

const DAMAGE_STATE_LABELS = {
  intact:    'INTACT',
  light:     'LIGHT',
  heavy:     'HEAVY',
  destroyed: 'DESTROYED',
};

/**
 * Resource cost to repair one damage bracket (mirrors RepairService.calculateRepairCost).
 *
 * light     → intact: tier × 5 ore
 * heavy     → light:  tier × 3 ore + tier × 2 crystal
 * destroyed → heavy:  tier × 5 crystal
 */
function getRepairCost(
  damageState: 'light' | 'heavy' | 'destroyed',
  repairTier: number,
): { ore: number; crystal: number } {
  switch (damageState) {
    case 'light':     return { ore: repairTier * 5, crystal: 0 };
    case 'heavy':     return { ore: repairTier * 3, crystal: repairTier * 2 };
    case 'destroyed': return { ore: 0,              crystal: repairTier * 5 };
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
};

const dimStyle: React.CSSProperties = {
  ...mono,
  color: 'var(--color-dim)',
};

const hdrStyle: React.CSSProperties = {
  ...dimStyle,
  borderBottom: '1px solid var(--color-dim)',
  paddingBottom: 2,
  marginTop: 8,
  marginBottom: 4,
  letterSpacing: '0.15em',
};

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.55rem',
  padding: '2px 6px',
  cursor: 'pointer',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
};

const btnStationStyle: React.CSSProperties = {
  ...btnStyle,
  borderColor: '#00ffcc',
  color: '#00ffcc',
  fontSize: '0.6rem',
  padding: '3px 8px',
};

// ─── RepairPanel ──────────────────────────────────────────────────────────────

export function RepairPanel() {
  const ship          = useStore((s) => s.ship);
  const cargo         = useStore((s) => s.cargo);
  const credits       = useStore((s) => s.credits);
  const currentSector = useStore((s) => s.currentSector);

  const [busy, setBusy] = useState<string | null>(null);  // moduleId currently being repaired
  const [stationBusy, setStationBusy] = useState(false);

  if (!ship) {
    return (
      <div style={{ padding: '8px', ...dimStyle, opacity: 0.5 }}>
        NO SHIP DATA
      </div>
    );
  }

  const installedModules = ship.modules ?? [];
  const isAtStation      = currentSector?.type === 'station';

  // Find the player's repair module (category='repair', powerLevel != 'off')
  const repairModEntry = installedModules.find((m) => {
    const def = MODULES[m.moduleId];
    return def?.category === 'repair' && (m.powerLevel ?? 'high') !== 'off';
  });
  const repairModDef  = repairModEntry ? MODULES[repairModEntry.moduleId] : null;
  const repairTier    = repairModDef?.tier ?? 0;

  // Determine if repair module itself is destroyed
  const repairModMaxHp     = repairModDef ? (repairModDef.maxHp ?? 20) : 20;
  const repairModCurrentHp = repairModEntry ? (repairModEntry.currentHp ?? repairModMaxHp) : repairModMaxHp;
  const repairModDestroyed =
    repairModEntry !== undefined &&
    getDamageState(repairModCurrentHp, repairModMaxHp) === 'destroyed';

  // Calculate station repair cost: sum of (maxHp - currentHp) × 2
  let stationRepairCost = 0;
  for (const m of installedModules) {
    const def     = MODULES[m.moduleId];
    if (!def) continue;
    const maxHp    = def.maxHp ?? 20;
    const curHp    = m.currentHp ?? maxHp;
    stationRepairCost += (maxHp - curHp) * 2;
  }
  stationRepairCost = Math.ceil(stationRepairCost);
  const hasModuleDamage = stationRepairCost > 0;

  function handleRepairModule(moduleId: string) {
    if (busy) return;
    setBusy(moduleId);
    network.sendRepairModule(moduleId);
    // Clear busy after a short delay (result handled by message handler)
    setTimeout(() => setBusy(null), 2000);
  }

  function handleStationRepair() {
    if (stationBusy) return;
    setStationBusy(true);
    network.sendStationRepair();
    setTimeout(() => setStationBusy(false), 2000);
  }

  return (
    <div
      data-testid="repair-panel"
      style={{ padding: '4px 8px', ...mono, color: 'var(--color-primary)', overflowY: 'auto' }}
    >
      {/* Repair Module Status */}
      <div style={hdrStyle}>REPAIR SYSTEM</div>
      {repairModEntry && repairModDef ? (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={dimStyle}>DRONE</span>
            <span style={{ color: repairModDestroyed ? DAMAGE_STATE_COLORS.destroyed : '#00ff41' }}>
              {repairModDef.displayName ?? repairModDef.name} (T{repairTier})
            </span>
          </div>
          {repairModDestroyed && (
            <div style={{ color: DAMAGE_STATE_COLORS.destroyed, fontSize: '0.55rem', marginTop: 2 }}>
              REPAIR DRONE DESTROYED — cannot be used
            </div>
          )}
          {repairTier < 3 && !repairModDestroyed && (
            <div style={{ ...dimStyle, fontSize: '0.55rem', marginTop: 2 }}>
              Tier {repairTier}: can repair LIGHT → INTACT only
            </div>
          )}
          {repairTier >= 3 && !repairModDestroyed && (
            <div style={{ ...dimStyle, fontSize: '0.55rem', marginTop: 2 }}>
              Tier {repairTier}: can repair all damage brackets
            </div>
          )}
        </div>
      ) : (
        <div
          data-testid="no-repair-module"
          style={{ color: DAMAGE_STATE_COLORS.destroyed, fontSize: '0.6rem', marginBottom: 6 }}
        >
          NO REPAIR MODULE INSTALLED
        </div>
      )}

      {/* Station Repair */}
      {isAtStation && (
        <>
          <div style={hdrStyle}>STATION REPAIR</div>
          {hasModuleDamage ? (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={dimStyle}>COST</span>
                <span style={{ color: credits >= stationRepairCost ? '#00ff41' : DAMAGE_STATE_COLORS.heavy }}>
                  {stationRepairCost} CR
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={dimStyle}>AVAILABLE</span>
                <span>{credits} CR</span>
              </div>
              <button
                data-testid="station-repair-btn"
                style={{
                  ...btnStationStyle,
                  opacity: (stationBusy || credits < stationRepairCost) ? 0.4 : 1,
                  cursor: (stationBusy || credits < stationRepairCost) ? 'not-allowed' : 'pointer',
                }}
                onClick={handleStationRepair}
                disabled={stationBusy || credits < stationRepairCost}
              >
                {stationBusy ? '[REPAIRING...]' : '[FULL REPAIR — ALL MODULES]'}
              </button>
            </div>
          ) : (
            <div style={{ ...dimStyle, marginBottom: 8 }}>All modules intact — no cost</div>
          )}
        </>
      )}

      {/* Module List */}
      <div style={hdrStyle}>MODULES</div>
      {installedModules.length === 0 ? (
        <div style={{ ...dimStyle, opacity: 0.5 }}>No modules installed</div>
      ) : (
        installedModules.map((m) => {
          const def      = MODULES[m.moduleId];
          if (!def) return null;
          const maxHp    = def.maxHp ?? 20;
          const curHp    = m.currentHp ?? maxHp;
          const dmgState = getDamageState(curHp, maxHp);
          const stateColor = DAMAGE_STATE_COLORS[dmgState];
          const hpPct    = maxHp > 0 ? Math.round((curHp / maxHp) * 100) : 100;

          // Can this module be repaired onboard?
          const canRepairOnboard =
            repairModEntry !== undefined &&
            !repairModDestroyed &&
            dmgState !== 'intact' &&
            (dmgState === 'light' || repairTier >= 3);

          const cost = dmgState !== 'intact'
            ? getRepairCost(dmgState as 'light' | 'heavy' | 'destroyed', Math.max(1, repairTier))
            : null;

          // Can afford?
          const canAfford = cost
            ? (cargo.ore ?? 0) >= cost.ore && (cargo.crystal ?? 0) >= cost.crystal
            : false;

          return (
            <div
              key={m.moduleId}
              data-testid={`module-row-${m.moduleId}`}
              style={{
                marginBottom: 8,
                paddingBottom: 6,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {/* Module name + damage label */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--color-primary)' }}>
                  {def.displayName ?? def.name}
                </span>
                <span
                  data-testid={`damage-state-${m.moduleId}`}
                  style={{ color: stateColor, fontSize: '0.6rem', fontWeight: 'bold' }}
                >
                  {DAMAGE_STATE_LABELS[dmgState]}
                </span>
              </div>

              {/* HP bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div
                  style={{
                    flex: 1,
                    height: 3,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 1,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${hpPct}%`,
                      background: stateColor,
                      transition: 'width 0.3s',
                      borderRadius: 1,
                    }}
                  />
                </div>
                <span style={{ ...dimStyle, whiteSpace: 'nowrap' }}>
                  {curHp}/{maxHp}
                </span>
              </div>

              {/* Repair button (onboard) */}
              {dmgState !== 'intact' && cost !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {canRepairOnboard ? (
                    <>
                      <button
                        data-testid={`repair-btn-${m.moduleId}`}
                        style={{
                          ...btnStyle,
                          opacity: (busy === m.moduleId || !canAfford) ? 0.4 : 1,
                          cursor: (busy === m.moduleId || !canAfford) ? 'not-allowed' : 'pointer',
                        }}
                        onClick={() => handleRepairModule(m.moduleId)}
                        disabled={!!busy || !canAfford}
                      >
                        {busy === m.moduleId ? '[REPAIRING...]' : '[REPAIR]'}
                      </button>
                      <span style={dimStyle}>
                        {cost.ore > 0 && `${cost.ore} ORE`}
                        {cost.ore > 0 && cost.crystal > 0 && ' + '}
                        {cost.crystal > 0 && `${cost.crystal} CRYSTAL`}
                      </span>
                      {!canAfford && (
                        <span style={{ color: DAMAGE_STATE_COLORS.heavy, fontSize: '0.55rem' }}>
                          INSUFF.
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ ...dimStyle, fontSize: '0.55rem' }}>
                      {!repairModEntry
                        ? '— no repair module'
                        : repairModDestroyed
                        ? '— repair drone destroyed'
                        : `— needs T3 drone (${DAMAGE_STATE_LABELS[dmgState]})`}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
