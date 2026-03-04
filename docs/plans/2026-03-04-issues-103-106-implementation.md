# Issues #103, #104, #105, #106 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enlarge scan radius, redesign main-lower area with ship/combat status panels, and add main+detail split views for Tech and Base monitors.

**Architecture:** Pure client-side changes except for scan radius constants in shared. Main-lower becomes a CSS grid with nav center, ship-status left, combat-status right. Tech and Base monitors switch from fullscreen to the existing split layout pattern (main-grid + main-detail). SHIP-SYS schematic view content migrates to the new panels.

**Tech Stack:** React, Zustand, TypeScript, CSS, Vitest + RTL

---

## Task 1: Enlarge Scan Radius (#105)

**Files:**
- Modify: `packages/shared/src/constants.ts:29-35`

**Step 1: Update scan radius constants**

In `packages/shared/src/constants.ts`, replace the `AP_COSTS_BY_SCANNER` object:

```typescript
export const AP_COSTS_BY_SCANNER: Record<number, { areaScan: number; areaScanRadius: number }> = {
  1: { areaScan: 3, areaScanRadius: 3 },
  2: { areaScan: 6, areaScanRadius: 6 },
  3: { areaScan: 10, areaScanRadius: 9 },
  4: { areaScan: 14, areaScanRadius: 12 },
  5: { areaScan: 18, areaScanRadius: 15 },
};
```

**Step 2: Run shared tests**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass (existing tests don't assert specific radius values)

**Step 3: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat: enlarge area scan radius — base 3, +3 per scanner level (#105)"
```

---

## Task 2: Create ShipStatusPanel Component (#106)

**Files:**
- Create: `packages/client/src/components/ShipStatusPanel.tsx`

**Step 1: Create the component**

Create `packages/client/src/components/ShipStatusPanel.tsx`:

```tsx
import { useStore } from '../state/store';
import { HULLS, MODULES } from '@void-sector/shared';
import type { ShipModule, ModuleCategory } from '@void-sector/shared';

const DISPLAY_CATEGORIES: { cat: ModuleCategory; label: string }[] = [
  { cat: 'drive', label: 'DRV' },
  { cat: 'scanner', label: 'SCN' },
  { cat: 'cargo', label: 'CRG' },
  { cat: 'armor', label: 'ARM' },
  { cat: 'mining', label: 'MNG' },
];

function getModuleForCategory(modules: ShipModule[], cat: ModuleCategory): string {
  const mod = modules.find((m) => {
    const def = MODULES[m.moduleId];
    return def && def.category === cat;
  });
  if (!mod) return '---';
  const def = MODULES[mod.moduleId];
  return def ? `${def.displayName}` : '???';
}

export function ShipStatusPanel() {
  const ship = useStore((s) => s.ship);
  const fuel = useStore((s) => s.fuel);

  const hull = ship ? HULLS[ship.hullType] : null;
  const stats = ship?.stats;

  if (!ship || !hull || !stats) {
    return (
      <div style={{ padding: '4px 8px', fontSize: '0.65rem', color: 'var(--color-dim)' }}>
        NO SHIP DATA
      </div>
    );
  }

  return (
    <div style={{
      padding: '4px 8px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.6rem',
      lineHeight: 1.6,
    }}>
      <div style={{
        fontSize: '0.55rem',
        letterSpacing: '0.15em',
        color: 'var(--color-dim)',
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: 2,
        marginBottom: 3,
      }}>
        SHIP SYSTEMS
      </div>
      <div style={{ color: 'var(--color-primary)', marginBottom: 2 }}>
        {hull.name} &quot;{ship.name}&quot;
      </div>
      {DISPLAY_CATEGORIES.map(({ cat, label }) => (
        <div key={cat} style={{ display: 'flex', gap: 4 }}>
          <span style={{ color: 'var(--color-dim)', width: 28, flexShrink: 0 }}>{label}:</span>
          <span style={{ color: 'var(--color-primary)' }}>
            {getModuleForCategory(ship.modules, cat)}
          </span>
        </div>
      ))}
      <div style={{ color: 'var(--color-dim)', margin: '2px 0' }}>
        {'\u2500'.repeat(18)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 6px' }}>
        <span>HP: <span style={{ color: 'var(--color-primary)' }}>{stats.hp}</span></span>
        <span>CRG: <span style={{ color: 'var(--color-primary)' }}>{stats.cargoCap}</span></span>
        <span>SPD: <span style={{ color: 'var(--color-primary)' }}>{stats.engineSpeed}</span></span>
        <span>SCN: <span style={{ color: 'var(--color-primary)' }}>{stats.scannerLevel}</span></span>
        <span>FUEL: <span style={{
          color: fuel && fuel.current <= 0 ? '#FF3333' : 'var(--color-primary)',
        }}>{fuel ? `${Math.floor(fuel.current)}/${fuel.max}` : '---'}</span></span>
        <span>RNG: <span style={{ color: 'var(--color-primary)' }}>{stats.jumpRange}</span></span>
      </div>
    </div>
  );
}
```

**Step 2: Run client tests to verify no breakage**

Run: `cd packages/client && npx vitest run`
Expected: All existing tests pass

**Step 3: Commit**

```bash
git add packages/client/src/components/ShipStatusPanel.tsx
git commit -m "feat: add ShipStatusPanel component for main-lower left (#106)"
```

---

## Task 3: Create CombatStatusPanel Component (#106)

**Files:**
- Create: `packages/client/src/components/CombatStatusPanel.tsx`

**Step 1: Create the component**

Create `packages/client/src/components/CombatStatusPanel.tsx`:

```tsx
import { useStore } from '../state/store';
import { MODULES } from '@void-sector/shared';
import type { ShipModule } from '@void-sector/shared';

function BarDisplay({ current, max, width = 8 }: { current: number; max: number; width?: number }) {
  const filled = max > 0 ? Math.round((current / max) * width) : 0;
  const empty = width - filled;
  return <span>{'\u2588'.repeat(filled)}{'\u2591'.repeat(empty)}</span>;
}

function getWeaponModule(modules: ShipModule[]) {
  const mod = modules.find((m) => {
    const def = MODULES[m.moduleId];
    return def && def.category === 'weapon';
  });
  if (!mod) return null;
  return MODULES[mod.moduleId] ?? null;
}

function getShieldModule(modules: ShipModule[]) {
  const mod = modules.find((m) => {
    const def = MODULES[m.moduleId];
    return def && def.category === 'shield';
  });
  if (!mod) return null;
  return MODULES[mod.moduleId] ?? null;
}

function getDefenseModule(modules: ShipModule[]) {
  const mod = modules.find((m) => {
    const def = MODULES[m.moduleId];
    return def && def.category === 'defense';
  });
  if (!mod) return null;
  return MODULES[mod.moduleId] ?? null;
}

export function CombatStatusPanel() {
  const ship = useStore((s) => s.ship);
  const stats = ship?.stats;

  if (!ship || !stats) {
    return (
      <div style={{ padding: '4px 8px', fontSize: '0.65rem', color: 'var(--color-dim)' }}>
        NO COMBAT DATA
      </div>
    );
  }

  const weapon = getWeaponModule(ship.modules);
  const shield = getShieldModule(ship.modules);
  const defense = getDefenseModule(ship.modules);

  return (
    <div style={{
      padding: '4px 8px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.6rem',
      lineHeight: 1.6,
    }}>
      <div style={{
        fontSize: '0.55rem',
        letterSpacing: '0.15em',
        color: 'var(--color-dim)',
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: 2,
        marginBottom: 3,
      }}>
        COMBAT SYSTEMS
      </div>

      {/* Weapon */}
      <div style={{ display: 'flex', gap: 4 }}>
        <span style={{ color: 'var(--color-dim)', width: 28, flexShrink: 0 }}>WPN:</span>
        <span style={{ color: weapon ? 'var(--color-primary)' : 'var(--color-dim)' }}>
          {weapon ? weapon.displayName : '---'}
        </span>
      </div>
      {stats.weaponAttack > 0 && (
        <div style={{ display: 'flex', gap: 4, marginLeft: 32 }}>
          <span style={{ color: 'var(--color-dim)' }}>
            ATK:{stats.weaponAttack} {stats.weaponType.toUpperCase()} PRC:{stats.weaponPiercing}
          </span>
        </div>
      )}

      {/* Shield */}
      <div style={{ display: 'flex', gap: 4 }}>
        <span style={{ color: 'var(--color-dim)', width: 28, flexShrink: 0 }}>SHD:</span>
        {stats.shieldHp > 0 ? (
          <span style={{ color: '#00CCFF' }}>
            <BarDisplay current={stats.shieldHp} max={stats.shieldHp} />
            {' '}{stats.shieldHp} (+{stats.shieldRegen}/r)
          </span>
        ) : (
          <span style={{ color: 'var(--color-dim)' }}>---</span>
        )}
      </div>

      {/* Defense */}
      <div style={{ display: 'flex', gap: 4 }}>
        <span style={{ color: 'var(--color-dim)', width: 28, flexShrink: 0 }}>DEF:</span>
        <span style={{ color: defense ? 'var(--color-primary)' : 'var(--color-dim)' }}>
          {defense ? defense.displayName : '---'}
        </span>
      </div>
      {stats.pointDefense > 0 && (
        <div style={{ display: 'flex', gap: 4, marginLeft: 32 }}>
          <span style={{ color: 'var(--color-dim)' }}>PD:{stats.pointDefense}</span>
        </div>
      )}

      {/* ECM */}
      <div style={{ display: 'flex', gap: 4 }}>
        <span style={{ color: 'var(--color-dim)', width: 28, flexShrink: 0 }}>ECM:</span>
        <span style={{ color: stats.ecmReduction > 0 ? 'var(--color-primary)' : 'var(--color-dim)' }}>
          {stats.ecmReduction > 0 ? `${Math.round(stats.ecmReduction * 100)}%` : '---'}
        </span>
      </div>

      {/* Damage modifier */}
      {stats.damageMod !== 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
          <span style={{ color: 'var(--color-dim)', width: 28, flexShrink: 0 }}>DMG:</span>
          <span style={{ color: stats.damageMod > 0 ? '#00FF88' : '#FF3333' }}>
            {stats.damageMod > 0 ? '+' : ''}{Math.round(stats.damageMod * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All existing tests pass

**Step 3: Commit**

```bash
git add packages/client/src/components/CombatStatusPanel.tsx
git commit -m "feat: add CombatStatusPanel component for main-lower right (#106)"
```

---

## Task 4: Restructure Main-Lower Layout (#106)

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx:438-445` (controlsArea)
- Modify: `packages/client/src/styles/crt.css:447-453` (main-lower styles)

**Step 1: Update controlsArea in GameScreen.tsx**

In `packages/client/src/components/GameScreen.tsx`, add imports at the top:

```tsx
import { ShipStatusPanel } from './ShipStatusPanel';
import { CombatStatusPanel } from './CombatStatusPanel';
```

Then replace the `controlsArea` definition (around line 439-445):

```tsx
  // Controls area: sector info, status bar, nav controls, ship/combat panels
  const controlsArea = (
    <div className="main-lower-layout">
      <div className="main-lower-top">
        <SectorInfo />
        <StatusBar />
      </div>
      <div className="main-lower-center">
        <NavControls />
      </div>
      <div className="main-lower-bottom">
        <div className="main-lower-left">
          <ShipStatusPanel />
        </div>
        <div className="main-lower-right">
          <CombatStatusPanel />
        </div>
      </div>
    </div>
  );
```

**Step 2: Add CSS for the new main-lower grid**

In `packages/client/src/styles/crt.css`, replace the `.main-lower` rule (around line 447-453) with:

```css
.main-lower {
  flex: 1;
  min-height: 0;
  max-height: 45%;
  overflow: auto;
  border-top: 2px solid #2a2a2a;
}

.main-lower-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.main-lower-top {
  flex-shrink: 0;
}

.main-lower-center {
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-dim);
}

.main-lower-bottom {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.main-lower-left {
  flex: 1;
  min-width: 0;
  overflow: auto;
  border-right: 1px solid var(--color-dim);
}

.main-lower-right {
  flex: 1;
  min-width: 0;
  overflow: auto;
}
```

**Step 3: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/client/src/components/GameScreen.tsx packages/client/src/styles/crt.css
git commit -m "feat: restructure main-lower with ship/combat status panels (#106)"
```

---

## Task 5: Simplify SHIP-SYS to Settings + Modules + Hangar (#106)

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx` (SchematicView → SettingsView, SHIP_SYS_MODES)

**Step 1: Replace SchematicView with SettingsView**

In `GameScreen.tsx`, replace the `SchematicView` function (lines ~189-306) with a simplified settings view. Keep only the color profile selector and system status:

```tsx
function SettingsView() {
  const colorProfile = useStore((s) => s.colorProfile);
  const setColorProfile = useStore((s) => s.setColorProfile);

  return (
    <div style={{
      padding: '8px 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.65rem',
      lineHeight: 1.5,
      overflow: 'auto',
    }}>
      <div style={{
        letterSpacing: '0.15em',
        fontSize: '0.7rem',
        marginBottom: 8,
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: 2,
      }}>
        SYSTEM-EINSTELLUNGEN
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: '0.65rem', opacity: 0.6 }}>DISPLAY PROFILE</label>
        <select
          value={colorProfile}
          onChange={(e) => setColorProfile(e.target.value as ColorProfileName)}
          style={{
            display: 'block', marginTop: 4, width: '100%',
            background: '#050505', border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
            padding: '4px 8px', fontSize: '0.7rem',
          }}
        >
          {Object.keys(COLOR_PROFILES).map((name) => (
            <option key={name} value={name}>{name.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: 4, color: 'var(--color-dim)' }}>
        SYSTEMS: <span style={{ color: '#00FF88' }}>ONLINE</span>
      </div>
    </div>
  );
}
```

**Step 2: Update SHIP_SYS_MODES and ShipSysScreen**

Update the mode array and ShipSysScreen to use SettingsView instead of SchematicView:

```tsx
type ShipSysView = 'settings' | 'modules' | 'hangar';

const SHIP_SYS_MODES: ShipSysView[] = ['settings', 'modules', 'hangar'];

function ShipSysScreen() {
  const view = (useStore((s) => s.monitorModes[MONITORS.SHIP_SYS]) ?? 'settings') as ShipSysView;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {view === 'settings' && <SettingsView />}
        {view === 'modules' && <ModulePanel />}
        {view === 'hangar' && <HangarPanel />}
      </div>
    </div>
  );
}
```

**Step 3: Clean up unused imports**

Remove the schematic helper functions and types that are no longer needed: `SLOT_LABELS`, `CATEGORY_DISPLAY`, `getSlotLabel`, `getModuleByCategory`, `SchematicLine`, `getSchematicLines`, `renderSchematicLine`. Keep the `HULLS` import only if used elsewhere in the file.

**Step 4: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass (update any tests that reference 'schematic' mode to use 'settings')

**Step 5: Commit**

```bash
git add packages/client/src/components/GameScreen.tsx
git commit -m "feat: simplify SHIP-SYS to settings/modules/hangar — ship status now in main-lower (#106)"
```

---

## Task 6: Tech-View Split — Create TechDetailPanel (#103)

**Files:**
- Create: `packages/client/src/components/TechDetailPanel.tsx`

**Step 1: Create the detail panel component**

This shows the selected module's full details + research action buttons.

Create `packages/client/src/components/TechDetailPanel.tsx`:

```tsx
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULES, isModuleFreelyAvailable, canStartResearch } from '@void-sector/shared';
import type { ModuleDefinition } from '@void-sector/shared';

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function costLine(cost: { credits: number; ore?: number; gas?: number; crystal?: number; artefact?: number }): string {
  const parts: string[] = [`${cost.credits} CR`];
  if (cost.ore) parts.push(`${cost.ore} ERZ`);
  if (cost.gas) parts.push(`${cost.gas} GAS`);
  if (cost.crystal) parts.push(`${cost.crystal} KRI`);
  if (cost.artefact) parts.push(`${cost.artefact} ART`);
  return parts.join(' | ');
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  padding: '3px 8px',
  cursor: 'pointer',
  letterSpacing: '0.05em',
};

const btnDangerStyle: React.CSSProperties = {
  ...btnStyle,
  borderColor: 'var(--color-danger)',
  color: 'var(--color-danger)',
};

export function TechDetailPanel() {
  const selectedModuleId = useStore((s) => s.selectedTechModule);
  const research = useStore((s) => s.research);
  const credits = useStore((s) => s.credits);
  const cargo = useStore((s) => s.cargo);
  const storage = useStore((s) => s.storage);
  const position = useStore((s) => s.position);
  const homeBase = useStore((s) => s.homeBase);

  if (!selectedModuleId) {
    return (
      <div style={{
        padding: '12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        color: 'var(--color-dim)',
        textAlign: 'center',
        marginTop: 24,
      }}>
        MODULE AUSWÄHLEN
      </div>
    );
  }

  const mod = MODULES[selectedModuleId];
  if (!mod) return null;

  const isAtHome = position.x === homeBase.x && position.y === homeBase.y;
  const resources = {
    credits,
    ore: cargo.ore + storage.ore,
    gas: cargo.gas + storage.gas,
    crystal: cargo.crystal + storage.crystal,
    artefact: cargo.artefact + storage.artefact,
  };

  const isResearching = research.activeResearch?.moduleId === mod.id;
  const isComplete = isResearching && research.activeResearch!.completesAt <= Date.now();
  const isFree = isModuleFreelyAvailable(mod.id);
  const isUnlocked = research.unlockedModules.includes(mod.id);
  const hasBP = research.blueprints.includes(mod.id);
  const researchCheck = canStartResearch(mod.id, research, resources);

  const prerequisiteMod = mod.prerequisite ? MODULES[mod.prerequisite] : null;

  return (
    <div style={{
      padding: '8px 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.65rem',
      lineHeight: 1.6,
      height: '100%',
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{
        fontSize: '0.75rem',
        color: 'var(--color-primary)',
        fontWeight: 'bold',
        marginBottom: 4,
      }}>
        {mod.name}
      </div>
      <div style={{ color: 'var(--color-dim)', marginBottom: 8 }}>
        TIER {mod.tier} | {mod.category.toUpperCase()}
      </div>

      {/* Effects */}
      <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: 4, marginBottom: 6 }}>
        <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', letterSpacing: '0.1em', marginBottom: 2 }}>
          EFFEKTE
        </div>
        <div style={{ color: 'var(--color-primary)' }}>
          {mod.primaryEffect.label}
        </div>
        {mod.secondaryEffects.map((eff, i) => (
          <div key={i} style={{ color: 'var(--color-dim)' }}>
            {eff.label}
          </div>
        ))}
      </div>

      {/* Prerequisite */}
      {prerequisiteMod && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--color-dim)' }}>VORAUSSETZUNG: </span>
          <span style={{
            color: research.unlockedModules.includes(prerequisiteMod.id) ? '#00FF88' : '#FF3333',
          }}>
            {prerequisiteMod.name}
          </span>
        </div>
      )}

      {/* Research cost */}
      {mod.researchCost && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', letterSpacing: '0.1em', marginBottom: 2 }}>
            FORSCHUNGSKOSTEN
          </div>
          <div>{costLine(mod.researchCost)}</div>
          {mod.researchDurationMin && (
            <div style={{ color: 'var(--color-dim)' }}>
              DAUER: {formatDuration(mod.researchDurationMin)}
            </div>
          )}
        </div>
      )}

      {/* Purchase cost */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', letterSpacing: '0.1em', marginBottom: 2 }}>
          KAUFPREIS
        </div>
        <div>{costLine(mod.cost)}</div>
      </div>

      {/* Status + Actions */}
      <div style={{ borderTop: '1px solid var(--color-dim)', paddingTop: 6 }}>
        {isFree && (
          <div style={{ color: '#00FF88' }}>FREI VERFÜGBAR</div>
        )}
        {isUnlocked && !isFree && (
          <div style={{ color: '#00FF88' }}>ERFORSCHT ✓</div>
        )}
        {hasBP && !isUnlocked && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ color: '#00BFFF', marginBottom: 4 }}>BLAUPAUSE VORHANDEN</div>
            <button style={btnStyle} onClick={() => network.sendActivateBlueprint(mod.id)}>
              [BLAUPAUSE AKTIVIEREN]
            </button>
          </div>
        )}
        {isResearching && (
          <div>
            {isComplete ? (
              <>
                <div style={{ color: '#00FF88', marginBottom: 4 }}>FORSCHUNG ABGESCHLOSSEN</div>
                <button style={btnStyle} onClick={() => network.sendClaimResearch()}>
                  [ABSCHLIESSEN]
                </button>
              </>
            ) : (
              <>
                <div style={{ color: '#FFB000', marginBottom: 4 }}>FORSCHUNG LÄUFT...</div>
                <button style={btnDangerStyle} onClick={() => network.sendCancelResearch()}>
                  [ABBRECHEN]
                </button>
              </>
            )}
          </div>
        )}
        {!isFree && !isUnlocked && !isResearching && mod.researchCost && (
          <div>
            {!isAtHome && (
              <div style={{ color: 'var(--color-dim)', marginBottom: 4 }}>
                FORSCHUNG NUR AN HEIMATBASIS
              </div>
            )}
            {isAtHome && researchCheck.valid && !research.activeResearch && (
              <button style={btnStyle} onClick={() => network.sendStartResearch(mod.id)}>
                [FORSCHUNG STARTEN]
              </button>
            )}
            {isAtHome && !researchCheck.valid && (
              <div style={{ color: '#FF3333', fontSize: '0.55rem' }}>
                {researchCheck.reason === 'prerequisites' && 'VORAUSSETZUNG NICHT ERFÜLLT'}
                {researchCheck.reason === 'resources' && 'RESSOURCEN NICHT AUSREICHEND'}
                {researchCheck.reason === 'already_unlocked' && 'BEREITS ERFORSCHT'}
                {researchCheck.reason === 'active_research' && 'ANDERE FORSCHUNG AKTIV'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add `selectedTechModule` to Zustand store**

In `packages/client/src/state/gameSlice.ts`, add to the state interface and initial state:

```typescript
// In the state interface:
selectedTechModule: string | null;
setSelectedTechModule: (id: string | null) => void;

// In initial state:
selectedTechModule: null,
setSelectedTechModule: (id) => set({ selectedTechModule: id }),
```

**Step 3: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/client/src/components/TechDetailPanel.tsx packages/client/src/state/gameSlice.ts
git commit -m "feat: add TechDetailPanel component and selectedTechModule state (#103)"
```

---

## Task 7: Tech-View Split — Refactor TechTreePanel + Wire Into GameScreen (#103)

**Files:**
- Modify: `packages/client/src/components/TechTreePanel.tsx` — make it a clickable list
- Modify: `packages/client/src/components/GameScreen.tsx` — add TechScreen with split layout

**Step 1: Refactor TechTreePanel to clickable list**

In `TechTreePanel.tsx`, add selection support. Add `selectedTechModule` and `setSelectedTechModule` from store. Change each module row to be clickable:

- Import `setSelectedTechModule` from store
- Add `onClick={() => setSelectedTechModule(mod.id)}` to each module row
- Add a selected highlight style (border-left or background)
- Remove the large detailed inline view (costs, research buttons) — that's now in TechDetailPanel
- Keep the compact list with status indicators

Replace the module row rendering (inside the `CATEGORY_ORDER.map` loop). Each row should be a compact line like:

```tsx
<div
  key={mod.id}
  onClick={() => setSelectedTechModule(mod.id)}
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '2px 4px',
    cursor: 'pointer',
    opacity: status === 'locked' ? 0.5 : 1,
    borderLeft: selectedTechModule === mod.id ? '2px solid var(--color-primary)' : '2px solid transparent',
    background: selectedTechModule === mod.id ? 'rgba(255,176,0,0.05)' : 'transparent',
  }}
>
  <span>
    <span style={{ color: 'var(--color-primary)' }}>{mod.name}</span>
    <span style={{ color: 'var(--color-dim)', marginLeft: 4, fontSize: '0.5rem' }}>T{mod.tier}</span>
  </span>
  <span style={{ flexShrink: 0, marginLeft: 4, fontSize: '0.5rem' }}>
    {status === 'free' && <span style={{ color: '#00FF88' }}>FREI</span>}
    {status === 'unlocked' && <span style={{ color: '#00FF88' }}>✓</span>}
    {status === 'blueprint' && <span style={{ color: '#00BFFF' }}>BP</span>}
    {status === 'researching' && <span style={{ color: '#FFB000' }}>⟳</span>}
    {status === 'locked' && <span style={{ color: 'var(--color-dim)' }}>🔒</span>}
  </span>
</div>
```

**Step 2: Add TechScreen to GameScreen.tsx**

In `GameScreen.tsx`, add a `TechScreen` component that uses the split layout pattern:

```tsx
import { TechDetailPanel } from './TechDetailPanel';

// Add this function before GameScreen():
function TechScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <TechTreePanel />
        </div>
        <div style={{ width: 320, minHeight: 0, overflow: 'auto', borderLeft: '2px solid #2a2a2a' }}>
          <TechDetailPanel />
        </div>
      </div>
    </div>
  );
}
```

Then update `renderScreen` to use `TechScreen`:

```tsx
case MONITORS.TECH: return <TechScreen />;
```

**Step 3: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/client/src/components/TechTreePanel.tsx packages/client/src/components/GameScreen.tsx
git commit -m "feat: Tech-View with main+detail split layout (#103)"
```

---

## Task 8: Base-View Split — Create BaseOverview and BaseDetailPanel (#104)

**Files:**
- Create: `packages/client/src/components/BaseOverview.tsx` — left panel (structure list)
- Create: `packages/client/src/components/BaseDetailPanel.tsx` — right panel (selected structure)

**Step 1: Add `selectedBaseStructure` to Zustand store**

In `packages/client/src/state/gameSlice.ts`:

```typescript
// In state interface:
selectedBaseStructure: string | null;
setSelectedBaseStructure: (id: string | null) => void;

// In initial state:
selectedBaseStructure: null,
setSelectedBaseStructure: (id) => set({ selectedBaseStructure: id }),
```

**Step 2: Create BaseOverview component**

Create `packages/client/src/components/BaseOverview.tsx`:

```tsx
import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const STRUCTURE_LABELS: Record<string, string> = {
  base: 'KOMMANDO-KERN',
  comm_relay: 'COMM RELAY',
  mining_station: 'MINING STATION',
  storage: 'LAGER',
  trading_post: 'HANDELSPLATZ',
  factory: 'FABRIK',
  kontor: 'KONTOR',
  research_lab: 'FORSCHUNGSLABOR',
};

const STRUCTURE_ICONS: Record<string, string> = {
  base: '[■]',
  comm_relay: '[≈]',
  mining_station: '[⛏]',
  storage: '[□]',
  trading_post: '[₿]',
  factory: '[⚙]',
  kontor: '[K]',
  research_lab: '[🔬]',
};

export function BaseOverview() {
  const baseStructures = useStore((s) => s.baseStructures);
  const baseName = useStore((s) => s.baseName);
  const credits = useStore((s) => s.credits);
  const selectedId = useStore((s) => s.selectedBaseStructure);
  const setSelected = useStore((s) => s.setSelectedBaseStructure);

  useEffect(() => {
    network.requestBase();
    network.requestStorage();
    network.requestCredits();
  }, []);

  const hasBase = baseStructures.some((s: any) => s.type === 'base');

  if (!hasBase) {
    return (
      <div style={{
        padding: '12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        lineHeight: 1.8,
      }}>
        <div style={{ letterSpacing: '0.2em', marginBottom: 4, opacity: 0.6 }}>
          BASE-LINK — NO SIGNAL
        </div>
        <div style={{ opacity: 0.4, marginBottom: 12 }}>KEINE BASIS ERRICHTET</div>
        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>
          Navigiere zu einem Sektor und nutze [BUILD BASE] um deine Heimatbasis zu errichten.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '8px 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.65rem',
      lineHeight: 1.6,
      height: '100%',
      overflow: 'auto',
    }}>
      <div style={{
        letterSpacing: '0.15em',
        fontSize: '0.7rem',
        marginBottom: 4,
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: 2,
      }}>
        {baseName || 'HEIMATBASIS'} — CONNECTED
      </div>

      <div style={{ color: 'var(--color-dim)', marginBottom: 8 }}>
        CREDITS: <span style={{ color: 'var(--color-primary)' }}>{credits.toLocaleString()}</span>
      </div>

      <div style={{
        fontSize: '0.55rem',
        letterSpacing: '0.1em',
        color: 'var(--color-dim)',
        marginBottom: 4,
      }}>
        GEBÄUDE ({baseStructures.length})
      </div>

      {baseStructures.map((s: any) => (
        <div
          key={s.id}
          onClick={() => setSelected(s.id)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 6px',
            cursor: 'pointer',
            borderLeft: selectedId === s.id ? '2px solid var(--color-primary)' : '2px solid transparent',
            background: selectedId === s.id ? 'rgba(255,176,0,0.05)' : 'transparent',
            marginBottom: 2,
          }}
        >
          <span>
            <span style={{ color: 'var(--color-dim)', marginRight: 4 }}>
              {STRUCTURE_ICONS[s.type] || '[?]'}
            </span>
            <span style={{ color: 'var(--color-primary)' }}>
              {STRUCTURE_LABELS[s.type] || s.type.toUpperCase()}
            </span>
          </span>
          <span style={{ opacity: 0.5, fontSize: '0.55rem' }}>
            {s.tier > 1 ? `T${s.tier}` : ''} AKTIV
          </span>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Create BaseDetailPanel component**

Create `packages/client/src/components/BaseDetailPanel.tsx`. This component shows detail for the selected structure. It extracts the relevant sections from the existing `BaseScreen.tsx` (storage transfer, factory progress, kontor orders, upgrade buttons):

```tsx
import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { STORAGE_TIERS, TRADING_POST_TIERS, PRODUCTION_RECIPES } from '@void-sector/shared';

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  padding: '2px 6px',
  cursor: 'pointer',
};

export function BaseDetailPanel() {
  const selectedId = useStore((s) => s.selectedBaseStructure);
  const baseStructures = useStore((s) => s.baseStructures);
  const cargo = useStore((s) => s.cargo);
  const storage = useStore((s) => s.storage);
  const factoryState = useStore((s) => s.factoryState);
  const research = useStore((s) => s.research);
  const kontorOrders = useStore((s) => s.kontorOrders);
  const baseName = useStore((s) => s.baseName);
  const [transferAmount, setTransferAmount] = useState(1);
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  const [kontorItemType, setKontorItemType] = useState('ore');
  const [kontorAmount, setKontorAmount] = useState(100);
  const [kontorPrice, setKontorPrice] = useState(2);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const structure = baseStructures.find((s: any) => s.id === selectedId);

  if (!structure) {
    return (
      <div style={{
        padding: '12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        color: 'var(--color-dim)',
        textAlign: 'center',
        marginTop: 24,
      }}>
        GEBÄUDE AUSWÄHLEN
      </div>
    );
  }

  const STRUCTURE_LABELS: Record<string, string> = {
    base: 'KOMMANDO-KERN',
    comm_relay: 'COMM RELAY',
    mining_station: 'MINING STATION',
    storage: 'LAGER',
    trading_post: 'HANDELSPLATZ',
    factory: 'FABRIK',
    kontor: 'KONTOR',
    research_lab: 'FORSCHUNGSLABOR',
  };

  const handleRenameBase = () => {
    if (renameValue.trim() && renameValue.length <= 20) {
      network.sendRenameBase(renameValue.trim());
      setRenaming(false);
      setRenameValue('');
    }
  };

  return (
    <div style={{
      padding: '8px 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.65rem',
      lineHeight: 1.6,
      height: '100%',
      overflow: 'auto',
    }}>
      <div style={{
        fontSize: '0.7rem',
        color: 'var(--color-primary)',
        fontWeight: 'bold',
        marginBottom: 4,
      }}>
        {STRUCTURE_LABELS[structure.type] || structure.type.toUpperCase()}
      </div>
      <div style={{ color: 'var(--color-dim)', marginBottom: 8 }}>
        {structure.tier > 1 ? `TIER ${structure.tier}` : 'TIER 1'} | AKTIV
      </div>

      {/* Base — rename */}
      {structure.type === 'base' && (
        <div style={{ marginBottom: 8 }}>
          {renaming ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                style={{
                  background: 'transparent', border: '1px solid var(--color-dim)',
                  color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem', padding: '2px 4px', maxWidth: 140,
                }}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value.slice(0, 20))}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameBase()}
                maxLength={20} autoFocus placeholder="Name..."
              />
              <button style={btnStyle} onClick={handleRenameBase}>OK</button>
              <button style={btnStyle} onClick={() => setRenaming(false)}>X</button>
            </div>
          ) : (
            <button style={btnStyle} onClick={() => { setRenaming(true); setRenameValue(baseName || ''); }}>
              UMBENENNEN
            </button>
          )}
        </div>
      )}

      {/* Storage */}
      {structure.type === 'storage' && (() => {
        const storageTier = structure.tier ?? 1;
        const storageCap = STORAGE_TIERS[storageTier]?.capacity ?? 0;
        const storageTotal = storage.ore + storage.gas + storage.crystal + storage.artefact;
        return (
          <>
            <div style={{ marginBottom: 6 }}>
              KAPAZITÄT: {storageTotal}/{storageCap}
            </div>
            <div style={{ marginBottom: 4 }}>
              ERZ: {storage.ore} | GAS: {storage.gas} | KRI: {storage.crystal} | ART: {storage.artefact}
            </div>
            <div style={{ marginTop: 8, marginBottom: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
              <label>MENGE:</label>
              <input
                type="number" min={1} value={transferAmount}
                onChange={(e) => setTransferAmount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 50, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', padding: '2px 4px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {(['ore', 'gas', 'crystal', 'artefact'] as const).map((res) => (
                <div key={res} style={{ display: 'flex', gap: 2 }}>
                  <button style={btnStyle} onClick={() => network.sendTransfer(res, transferAmount, 'toStorage')}>
                    {res.toUpperCase()}→LAG
                  </button>
                  <button style={btnStyle} onClick={() => network.sendTransfer(res, transferAmount, 'fromStorage')}>
                    LAG→{res.toUpperCase()}
                  </button>
                </div>
              ))}
            </div>
            {storageTier < 3 && (
              <button style={{ ...btnStyle, marginTop: 8 }} onClick={() => network.sendUpgradeStructure(structure.id)}>
                UPGRADE T{storageTier + 1} ({STORAGE_TIERS[storageTier + 1]?.upgradeCost} CR)
              </button>
            )}
          </>
        );
      })()}

      {/* Factory */}
      {structure.type === 'factory' && factoryState && (
        <>
          {factoryState.error && (
            <div style={{ color: 'var(--color-danger)', marginBottom: 4 }}>ERROR: {factoryState.error}</div>
          )}
          {factoryState.activeRecipe ? (
            <>
              <div>Rezept: {factoryState.activeRecipe.outputItem.replace(/_/g, ' ').toUpperCase()}</div>
              <div style={{ fontFamily: 'var(--font-mono)' }}>
                {(() => {
                  const pct = Math.min(factoryState.progress, 1);
                  const filled = Math.round(pct * 10);
                  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${Math.round(pct * 100)}%`;
                })()}
              </div>
              <div>Fertig: {factoryState.completedCycles} Zyklen</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {factoryState.completedCycles > 0 && (
                  <button style={btnStyle} onClick={() => network.sendFactoryCollect()}>[EINSAMMELN]</button>
                )}
                <button style={btnStyle} onClick={() => setShowRecipeSelector(!showRecipeSelector)}>
                  [REZEPT WECHSELN]
                </button>
              </div>
            </>
          ) : (
            <div>
              <span style={{ opacity: 0.5 }}>Kein Rezept aktiv. </span>
              <button style={btnStyle} onClick={() => setShowRecipeSelector(!showRecipeSelector)}>
                [REZEPT WÄHLEN]
              </button>
            </div>
          )}
          {showRecipeSelector && (
            <div style={{ marginTop: 6, border: '1px solid var(--color-dim)', padding: 4 }}>
              {PRODUCTION_RECIPES.map((r) => {
                const locked = r.researchRequired && !research.unlockedModules.includes(r.researchRequired);
                const inputStr = r.inputs.map((i) => `${i.amount} ${i.resource}`).join(', ');
                return (
                  <div key={r.id} style={{ marginBottom: 2 }}>
                    {locked ? (
                      <span style={{ opacity: 0.4 }}>{r.outputItem.replace(/_/g, ' ').toUpperCase()} — gesperrt</span>
                    ) : (
                      <button
                        style={{ ...btnStyle, textAlign: 'left', width: '100%', border: 'none', padding: '2px 0' }}
                        onClick={() => { network.sendFactorySetRecipe(r.id); setShowRecipeSelector(false); }}
                      >
                        {'> '}{r.outputItem.replace(/_/g, ' ').toUpperCase()} — {inputStr} — {r.cycleSeconds}s
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Kontor */}
      {structure.type === 'kontor' && (
        <>
          <div style={{ border: '1px solid var(--color-dim)', padding: 4, marginBottom: 6 }}>
            <div style={{ opacity: 0.6, marginBottom: 4 }}>NEUER AUFTRAG</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
              <select
                value={kontorItemType} onChange={(e) => setKontorItemType(e.target.value)}
                style={{ background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', padding: '2px' }}
              >
                <option value="ore">ERZ</option>
                <option value="gas">GAS</option>
                <option value="crystal">KRISTALL</option>
              </select>
              <input type="number" min={1} value={kontorAmount} onChange={(e) => setKontorAmount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 50, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', padding: '2px' }} />
              <span>@</span>
              <input type="number" min={1} value={kontorPrice} onChange={(e) => setKontorPrice(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 40, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', padding: '2px' }} />
              <button style={btnStyle} onClick={() => network.sendKontorPlaceOrder(kontorItemType, kontorAmount, kontorPrice)}>
                AUFGEBEN
              </button>
            </div>
          </div>
          {kontorOrders.length > 0 ? (
            kontorOrders.map((order, idx) => (
              <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span>#{idx + 1} {order.itemType.toUpperCase()} {order.amountFilled}/{order.amountWanted} @{order.pricePerUnit}cr</span>
                <button
                  style={{ ...btnStyle, borderColor: '#FF3333', color: '#FF3333', fontSize: '0.5rem' }}
                  onClick={() => network.sendKontorCancel(order.id)}
                >X</button>
              </div>
            ))
          ) : (
            <div style={{ opacity: 0.4 }}>KEINE AUFTRÄGE</div>
          )}
        </>
      )}

      {/* Trading Post — upgrade */}
      {structure.type === 'trading_post' && (structure.tier ?? 1) < 3 && (
        <button style={{ ...btnStyle, marginTop: 8 }} onClick={() => network.sendUpgradeStructure(structure.id)}>
          UPGRADE T{(structure.tier ?? 1) + 1} ({TRADING_POST_TIERS[(structure.tier ?? 1) + 1]?.upgradeCost} CR)
        </button>
      )}

      {/* Generic info for other structures */}
      {!['base', 'storage', 'factory', 'kontor', 'trading_post'].includes(structure.type) && (
        <div style={{ color: 'var(--color-dim)' }}>
          Status: AKTIV
        </div>
      )}

      {/* Cargo on ship */}
      <div style={{
        borderTop: '1px solid var(--color-dim)',
        paddingTop: 6,
        marginTop: 8,
        color: 'var(--color-dim)',
        fontSize: '0.55rem',
      }}>
        CARGO: ERZ:{cargo.ore} GAS:{cargo.gas} KRI:{cargo.crystal} ART:{cargo.artefact}
      </div>
    </div>
  );
}
```

**Step 4: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/client/src/components/BaseOverview.tsx packages/client/src/components/BaseDetailPanel.tsx packages/client/src/state/gameSlice.ts
git commit -m "feat: add BaseOverview and BaseDetailPanel components (#104)"
```

---

## Task 9: Base-View Split — Wire Into GameScreen (#104)

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx` — add BaseScreen split
- Modify: `packages/client/src/components/BaseScreen.tsx` — remove (replaced by split)

**Step 1: Add BaseScreen split to GameScreen**

In `GameScreen.tsx`, add imports and a split BaseScreen:

```tsx
import { BaseOverview } from './BaseOverview';
import { BaseDetailPanel } from './BaseDetailPanel';

function BaseSplitScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <BaseOverview />
        </div>
        <div style={{ width: 320, minHeight: 0, overflow: 'auto', borderLeft: '2px solid #2a2a2a' }}>
          <BaseDetailPanel />
        </div>
      </div>
    </div>
  );
}
```

Then update `renderScreen`:

```tsx
case MONITORS.BASE_LINK: return <BaseSplitScreen />;
```

**Step 2: Remove old BaseScreen import if no longer used**

If `BaseScreen` is only used in `renderScreen`, remove the import. Keep the `BaseScreen.tsx` file as-is for now (mobile might still reference it, or it can be deleted later).

**Step 3: Run all tests**

Run: `cd packages/client && npx vitest run`
Run: `cd packages/shared && npx vitest run`
Run: `cd packages/server && npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/client/src/components/GameScreen.tsx
git commit -m "feat: Base-View with main+detail split layout (#104)"
```

---

## Task 10: Final Verification

**Step 1: TypeScript check**

Run: `cd packages/shared && npx tsc --noEmit && cd ../server && npx tsc --noEmit && cd ../client && npx tsc --noEmit`
Expected: No errors

**Step 2: Full test suite**

Run: `npm test`
Expected: All tests pass (1126+ tests)

**Step 3: Commit any fixes if needed**

---

## Summary of New/Modified Files

| File | Action | Issue |
|------|--------|-------|
| `packages/shared/src/constants.ts` | Modify | #105 |
| `packages/client/src/components/ShipStatusPanel.tsx` | Create | #106 |
| `packages/client/src/components/CombatStatusPanel.tsx` | Create | #106 |
| `packages/client/src/components/TechDetailPanel.tsx` | Create | #103 |
| `packages/client/src/components/BaseOverview.tsx` | Create | #104 |
| `packages/client/src/components/BaseDetailPanel.tsx` | Create | #104 |
| `packages/client/src/components/GameScreen.tsx` | Modify | #103, #104, #106 |
| `packages/client/src/components/TechTreePanel.tsx` | Modify | #103 |
| `packages/client/src/components/NavControls.tsx` | Modify | #106 |
| `packages/client/src/components/HUD.tsx` | Modify | #106 |
| `packages/client/src/styles/crt.css` | Modify | #106 |
| `packages/client/src/state/gameSlice.ts` | Modify | #103, #104 |
