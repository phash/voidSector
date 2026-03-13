import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const DAMAGE_STATE_KEYS = {
  intact:    'repair.damageState.intact',
  light:     'repair.damageState.light',
  heavy:     'repair.damageState.heavy',
  destroyed: 'repair.damageState.destroyed',
} as const;

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

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
};

const dimStyle: React.CSSProperties = {
  ...mono,
  color: '#88aa66',
};

const hdrStyle: React.CSSProperties = {
  ...dimStyle,
  borderBottom: '1px solid #88aa66',
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
  const { t } = useTranslation('ui');
  const ship          = useStore((s) => s.ship);
  const cargo         = useStore((s) => s.cargo);
  const credits       = useStore((s) => s.credits);
  const currentSector = useStore((s) => s.currentSector);

  const [busy, setBusy] = useState<string | null>(null);  // moduleId currently being repaired
  const [stationBusy, setStationBusy] = useState(false);
  const [repairResult, setRepairResult] = useState<string | null>(null);

  if (!ship) {
    return (
      <div style={{ padding: '8px', ...dimStyle, opacity: 0.5 }}>
        {t('ship.noShipData')}
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
    setTimeout(() => {
      setBusy(null);
      setRepairResult(t('repair.success'));
      setTimeout(() => setRepairResult(null), 3000);
    }, 2000);
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
      {/* Aria live region for repair feedback */}
      <div aria-live="polite" style={srOnlyStyle}>
        {repairResult}
      </div>

      {/* Repair Module Status */}
      <div style={hdrStyle}>{t('repair.repairSystem')}</div>
      {repairModEntry && repairModDef ? (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={dimStyle}>{t('repair.drone')}</span>
            <span style={{ color: repairModDestroyed ? DAMAGE_STATE_COLORS.destroyed : '#00ff41' }}>
              {t('repair.droneName', { name: repairModDef.displayName ?? repairModDef.name, tier: repairTier })}
            </span>
          </div>
          {repairModDestroyed && (
            <div style={{ color: DAMAGE_STATE_COLORS.destroyed, fontSize: '0.55rem', marginTop: 2 }}>
              {t('repair.droneDestroyed')}
            </div>
          )}
          {repairTier < 3 && !repairModDestroyed && (
            <div style={{ ...dimStyle, fontSize: '0.55rem', marginTop: 2 }}>
              {t('repair.tierLimited', { tier: repairTier })}
            </div>
          )}
          {repairTier >= 3 && !repairModDestroyed && (
            <div style={{ ...dimStyle, fontSize: '0.55rem', marginTop: 2 }}>
              {t('repair.tierFull', { tier: repairTier })}
            </div>
          )}
        </div>
      ) : (
        <div
          data-testid="no-repair-module"
          style={{ color: DAMAGE_STATE_COLORS.destroyed, fontSize: '0.6rem', marginBottom: 6 }}
        >
          {t('repair.noRepairModule')}
        </div>
      )}

      {/* Station Repair */}
      {isAtStation && (
        <>
          <div style={hdrStyle}>{t('repair.stationRepair')}</div>
          {hasModuleDamage ? (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={dimStyle}>{t('repair.cost')}</span>
                <span style={{ color: credits >= stationRepairCost ? '#00ff41' : DAMAGE_STATE_COLORS.heavy }}>
                  {stationRepairCost} CR
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={dimStyle}>{t('repair.available')}</span>
                <span>{credits} CR</span>
              </div>
              <button
                className="repair-btn"
                data-testid="station-repair-btn"
                style={{
                  ...btnStationStyle,
                  opacity: (stationBusy || credits < stationRepairCost) ? 0.4 : 1,
                  cursor: (stationBusy || credits < stationRepairCost) ? 'not-allowed' : 'pointer',
                }}
                onClick={handleStationRepair}
                disabled={stationBusy || credits < stationRepairCost}
              >
                {stationBusy ? t('repair.repairing') : t('repair.fullRepair')}
              </button>
            </div>
          ) : (
            <div style={{ ...dimStyle, marginBottom: 8 }}>{t('repair.allIntact')}</div>
          )}
        </>
      )}

      {/* Module List */}
      <div style={hdrStyle}>{t('repair.modules')}</div>
      {installedModules.length === 0 ? (
        <div style={{ ...dimStyle, opacity: 0.5 }}>{t('repair.noModules')}</div>
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

          const moduleName = def.displayName ?? def.name;

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
                  {moduleName}
                </span>
                <span
                  data-testid={`damage-state-${m.moduleId}`}
                  style={{ color: stateColor, fontSize: '0.6rem', fontWeight: 'bold' }}
                >
                  {t(DAMAGE_STATE_KEYS[dmgState])}
                </span>
              </div>

              {/* HP bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div
                  role="meter"
                  aria-label={`${moduleName} Trefferpunkte`}
                  aria-valuenow={curHp}
                  aria-valuemin={0}
                  aria-valuemax={maxHp}
                  aria-valuetext={`${curHp} von ${maxHp}`}
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
                        className="repair-btn"
                        data-testid={`repair-btn-${m.moduleId}`}
                        style={{
                          ...btnStyle,
                          opacity: (busy === m.moduleId || !canAfford) ? 0.4 : 1,
                          cursor: (busy === m.moduleId || !canAfford) ? 'not-allowed' : 'pointer',
                        }}
                        onClick={() => handleRepairModule(m.moduleId)}
                        disabled={!!busy || !canAfford}
                      >
                        {busy === m.moduleId ? t('repair.repairing') : t('repair.doRepair')}
                      </button>
                      <span style={dimStyle}>
                        {cost.ore > 0 && `${cost.ore} ${t('resources.ore')}`}
                        {cost.ore > 0 && cost.crystal > 0 && ' + '}
                        {cost.crystal > 0 && `${cost.crystal} ${t('resources.crystal')}`}
                      </span>
                      {!canAfford && (
                        <span style={{ color: DAMAGE_STATE_COLORS.heavy, fontSize: '0.55rem' }}>
                          {t('repair.missing')}
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ ...dimStyle, fontSize: '0.55rem' }}>
                      {!repairModEntry
                        ? t('repair.noRepairModuleShort')
                        : repairModDestroyed
                        ? t('repair.droneDestroyedShort')
                        : t('repair.needsT3Drone', { state: t(DAMAGE_STATE_KEYS[dmgState]) })}
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
