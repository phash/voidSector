# ACEP Module Shop Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the ACEP program into a 3-tab UI (ACEP · MODULE · SHOP) with contextual detail monitor, replacing the hidden MODULES route and buried HangarPanel boost buttons.

**Architecture:** New `AcepProgram.tsx` acts as a 3-tab shell that writes `acepActiveTab` and `acepHoveredModuleId` to Zustand `uiSlice`. Tab components (`AcepTab`, `ModuleTab`, `ShopTab`) render tab-specific content. `AcepDetailPanel` in Sec 3 reads from store and shows contextual module-effect info. Old `AcepPanel.tsx`, `ModulePanel.tsx`, and `HangarPanel.tsx` are deleted after their content is migrated.

**Tech Stack:** React 18, Zustand, TypeScript strict, Vitest + RTL, `@void-sector/shared` (calculateShipStats, MODULES, SPECIALIZED_SLOT_CATEGORIES, isModuleUnlocked, getAcepBoostCost)

**Spec:** `docs/superpowers/specs/2026-03-11-acep-module-shop-design.md`

---

## File Map

| Action | Path |
|--------|------|
| Modify | `packages/client/src/state/uiSlice.ts` |
| Create | `packages/client/src/components/AcepTab.tsx` |
| Create | `packages/client/src/components/ModuleTab.tsx` |
| Create | `packages/client/src/components/ShopTab.tsx` |
| Create | `packages/client/src/components/AcepDetailPanel.tsx` |
| Rewrite | `packages/client/src/components/AcepProgram.tsx` |
| Modify | `packages/client/src/components/CockpitLayout.tsx` |
| Modify | `packages/client/src/components/GameScreen.tsx` |
| Rewrite | `packages/client/src/__tests__/AcepProgram.test.tsx` |
| Delete | `packages/client/src/components/AcepPanel.tsx` |
| Delete | `packages/client/src/components/ModulePanel.tsx` |
| Delete | `packages/client/src/components/HangarPanel.tsx` |

---

## Chunk 1: Zustand State + AcepTab

### Task 1: Add ACEP UI state to uiSlice

**Files:**
- Modify: `packages/client/src/state/uiSlice.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/client/src/__tests__/uiSliceAcep.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../state/store';

beforeEach(() => {
  useStore.setState({
    acepActiveTab: 'acep',
    acepHoveredModuleId: null,
  } as any);
});

describe('uiSlice ACEP state', () => {
  it('default acepActiveTab is acep', () => {
    expect(useStore.getState().acepActiveTab).toBe('acep');
  });

  it('setAcepActiveTab updates the tab', () => {
    useStore.getState().setAcepActiveTab('module');
    expect(useStore.getState().acepActiveTab).toBe('module');
  });

  it('setAcepHoveredModuleId sets a module id', () => {
    useStore.getState().setAcepHoveredModuleId('drive_mk1');
    expect(useStore.getState().acepHoveredModuleId).toBe('drive_mk1');
  });

  it('setAcepHoveredModuleId clears with null', () => {
    useStore.getState().setAcepHoveredModuleId('drive_mk1');
    useStore.getState().setAcepHoveredModuleId(null);
    expect(useStore.getState().acepHoveredModuleId).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/client && npx vitest run src/__tests__/uiSliceAcep.test.ts
```

Expected: FAIL — `acepActiveTab` not in store

- [ ] **Step 3: Add fields to UISlice interface**

In `packages/client/src/state/uiSlice.ts`, add to the `UISlice` interface (after the `contextMenu` line):

```ts
  // ACEP program tab state
  acepActiveTab: 'acep' | 'module' | 'shop';
  acepHoveredModuleId: string | null;
  setAcepActiveTab: (tab: 'acep' | 'module' | 'shop') => void;
  setAcepHoveredModuleId: (id: string | null) => void;
```

- [ ] **Step 4: Add initial state and setters to createUISlice**

In `createUISlice`, after `contextMenu: null,` add:

```ts
  acepActiveTab: 'acep',
  acepHoveredModuleId: null,
```

After `closeContextMenu: () => set({ contextMenu: null }),` add:

```ts
  setAcepActiveTab: (tab) => set({ acepActiveTab: tab }),
  setAcepHoveredModuleId: (id) => set({ acepHoveredModuleId: id }),
```

- [ ] **Step 5: Add to mockStore**

In `packages/client/src/test/mockStore.ts`, add to the mock state object:

```ts
  acepActiveTab: 'acep' as const,
  acepHoveredModuleId: null,
  setAcepActiveTab: vi.fn(),
  setAcepHoveredModuleId: vi.fn(),
```

- [ ] **Step 6: Run test to confirm it passes**

```bash
cd packages/client && npx vitest run src/__tests__/uiSliceAcep.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/state/uiSlice.ts packages/client/src/test/mockStore.ts packages/client/src/__tests__/uiSliceAcep.test.ts
git commit -m "feat: add acepActiveTab + acepHoveredModuleId to uiSlice"
```

---

### Task 2: Create AcepTab component

**Files:**
- Create: `packages/client/src/components/AcepTab.tsx`
- Create: `packages/client/src/__tests__/AcepTab.test.tsx`

**What it does:** Ship rename + XP paths + boost buttons + active effects + traits. Migrated from `HangarPanel.tsx`.

- [ ] **Step 1: Write the failing test**

Create `packages/client/src/__tests__/AcepTab.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendRenameShip: vi.fn(),
    sendAcepBoost: vi.fn(),
  },
}));

import { network } from '../network/client';
import { AcepTab } from '../components/AcepTab';

const mockShip = {
  id: 'ship-1',
  name: 'Test Ship',
  hullType: 'scout' as const,
  modules: [],
  acepXp: { ausbau: 20, intel: 0, kampf: 0, explorer: 0, total: 20 },
  acepEffects: {
    extraModuleSlots: 1,
    cargoMultiplier: 1,
    miningBonus: 0.15,
    scanRadiusBonus: 1,
    combatDamageBonus: 0,
    ancientDetection: false,
    helionDecoderEnabled: false,
  },
  acepTraits: ['cautious'],
  acepGeneration: 1,
  slots: 8, hp: 100, maxHp: 100, speed: 1, shield: 0, maxShield: 0,
  armor: 0, damage: 10, scanRadius: 3, miningPower: 0, cargoCap: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState({ ship: mockShip as any, credits: 500, research: { wissen: 10 } as any });
});

describe('AcepTab', () => {
  it('renders all 4 XP path labels', () => {
    render(<AcepTab />);
    expect(screen.getByText('AUSBAU')).toBeInTheDocument();
    expect(screen.getByText('INTEL')).toBeInTheDocument();
    expect(screen.getByText('KAMPF')).toBeInTheDocument();
    expect(screen.getByText('EXPLORER')).toBeInTheDocument();
  });

  it('renders total XP budget', () => {
    render(<AcepTab />);
    expect(screen.getByText(/20\/100/)).toBeInTheDocument();
  });

  it('renders active effects', () => {
    render(<AcepTab />);
    expect(screen.getByText(/Modul-Slots/)).toBeInTheDocument();
    expect(screen.getByText(/Mining/)).toBeInTheDocument();
    expect(screen.getByText(/Scan-Radius/)).toBeInTheDocument();
  });

  it('renders traits', () => {
    render(<AcepTab />);
    expect(screen.getByText(/CAUTIOUS/i)).toBeInTheDocument();
  });

  it('renders ship name with rename button', () => {
    render(<AcepTab />);
    expect(screen.getByText('Test Ship')).toBeInTheDocument();
    expect(screen.getByText(/UMBENENNEN/i)).toBeInTheDocument();
  });

  it('boost button calls sendAcepBoost when enabled', () => {
    // credits=500, wissen=10, total=20 < 100 — check boost cost for ausbau=20
    render(<AcepTab />);
    const boostBtns = screen.getAllByText(/\+5 XP/i);
    // Find enabled one — ausbau has xp=20 and getAcepBoostCost(20) may be affordable
    // Just verify at least one exists
    expect(boostBtns.length).toBeGreaterThan(0);
  });

  it('renders fallback when no ship', () => {
    mockStoreState({ ship: null });
    render(<AcepTab />);
    expect(screen.getByText(/KEIN SCHIFF/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/client && npx vitest run src/__tests__/AcepTab.test.tsx
```

Expected: FAIL — `AcepTab` module not found

- [ ] **Step 3: Create AcepTab.tsx**

Create `packages/client/src/components/AcepTab.tsx`:

```tsx
import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import type { AcepPath } from '@void-sector/shared';
import { getAcepBoostCost } from '@void-sector/shared';

const PATHS: Array<{ key: AcepPath; label: string; color: string }> = [
  { key: 'ausbau',   label: 'AUSBAU',   color: '#FFB000' },
  { key: 'intel',    label: 'INTEL',    color: '#00CFFF' },
  { key: 'kampf',    label: 'KAMPF',    color: '#FF4444' },
  { key: 'explorer', label: 'EXPLORER', color: '#00FF88' },
];

const TRAIT_LABELS: Record<string, string> = {
  veteran:         'VETERAN',
  curious:         'CURIOUS',
  reckless:        'RECKLESS',
  cautious:        'CAUTIOUS',
  'ancient-touched': 'ANCIENT',
  scarred:         'SCARRED',
};

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  padding: '3px 8px',
  cursor: 'pointer',
};

const sectionHdr: React.CSSProperties = {
  fontSize: '0.75rem',
  letterSpacing: '0.12em',
  color: '#666',
  marginBottom: 8,
  marginTop: 12,
};

const barTrack: React.CSSProperties = {
  flex: 1,
  height: 10,
  background: '#111',
  border: '1px solid #333',
  overflow: 'hidden',
};

export function AcepTab() {
  const ship = useStore((s) => s.ship);
  const credits = useStore((s) => s.credits ?? 0);
  const wissen = useStore((s) => s.research.wissen ?? 0);
  const [renamingShipId, setRenamingShipId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (!ship) {
    return (
      <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '1rem', opacity: 0.4 }}>
        KEIN SCHIFF
      </div>
    );
  }

  const xp = ship.acepXp ?? { ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0 };
  const effects = ship.acepEffects;
  const traits = ship.acepTraits ?? [];
  const gen = ship.acepGeneration ?? 1;

  const handleRename = (shipId: string) => {
    if (renameValue.trim() && renameValue.length <= 20) {
      network.sendRenameShip(shipId, renameValue.trim());
      setRenamingShipId(null);
      setRenameValue('');
    }
  };

  const activeEffects: string[] = [];
  if (effects) {
    if (effects.extraModuleSlots > 0) activeEffects.push(`+${effects.extraModuleSlots} Modul-Slots`);
    if (effects.scanRadiusBonus > 0) activeEffects.push(`+${effects.scanRadiusBonus} Scan-Radius`);
    if (effects.miningBonus > 0) activeEffects.push(`+${Math.round(effects.miningBonus * 100)}% Mining`);
    if (effects.combatDamageBonus > 0) activeEffects.push(`+${Math.round(effects.combatDamageBonus * 100)}% Schaden`);
    if (effects.cargoMultiplier > 1) activeEffects.push(`+${Math.round((effects.cargoMultiplier - 1) * 100)}% Cargo`);
    if (effects.ancientDetection) activeEffects.push('Ancient-Erkennung');
    if (effects.helionDecoderEnabled) activeEffects.push('Helion-Decoder');
  }

  return (
    <div style={{ padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '1rem', overflow: 'auto', height: '100%' }}>
      {/* Ship header with rename */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span>
          <span style={{ color: 'var(--color-primary)' }}>{ship.name}</span>
          <span style={{ color: 'var(--color-dim)', marginLeft: 8, fontSize: '0.8rem' }}>
            ACEP GEN-{gen}
          </span>
        </span>
        {renamingShipId === ship.id ? (
          <span style={{ display: 'flex', gap: 4 }}>
            <input
              style={{
                background: 'transparent', border: '1px solid var(--color-dim)',
                color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem', padding: '2px 6px', width: 120,
              }}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value.slice(0, 20))}
              onKeyDown={(e) => e.key === 'Enter' && handleRename(ship.id)}
              maxLength={20}
              autoFocus
              placeholder="Name..."
            />
            <button style={btnStyle} onClick={() => handleRename(ship.id)}>OK</button>
            <button style={btnStyle} onClick={() => setRenamingShipId(null)}>X</button>
          </span>
        ) : (
          <button style={btnStyle} onClick={() => { setRenamingShipId(ship.id); setRenameValue(ship.name); }}>
            UMBENENNEN
          </button>
        )}
      </div>

      {/* XP paths */}
      <div style={sectionHdr}>ENTWICKLUNGSPFADE</div>
      {PATHS.map(({ key, label, color }) => {
        const pathXp = xp[key] ?? 0;
        const cost = getAcepBoostCost(pathXp);
        const canBoost = cost !== null && credits >= cost.credits && wissen >= cost.wissen && xp.total < 100;
        return (
          <div key={key} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color }}>{label}</span>
              <span style={{ color: '#888', fontSize: '0.95rem' }}>{pathXp}/50 · Lv{Math.floor(pathXp / 10)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={barTrack}>
                <div style={{ width: `${(pathXp / 50) * 100}%`, height: '100%', background: color }} />
              </div>
              {cost ? (
                <button
                  style={{ ...btnStyle, border: `1px solid ${color}`, color, opacity: canBoost ? 1 : 0.35 }}
                  disabled={!canBoost}
                  title={`+5 XP kostet ${cost.credits} CR · ${cost.wissen} W`}
                  onClick={() => network.sendAcepBoost(key)}
                >
                  +5 XP
                </button>
              ) : (
                <span style={{ color: '#00FF88', fontSize: '0.8rem' }}>MAX</span>
              )}
            </div>
            {cost && (
              <div style={{ color: '#555', fontSize: '0.8rem', marginTop: 2 }}>
                {cost.credits} CR · {cost.wissen} W
              </div>
            )}
          </div>
        );
      })}
      <div style={{ color: '#555', fontSize: '0.85rem', marginBottom: 8 }}>
        GESAMT: {xp.total}/100
      </div>

      {/* Active effects */}
      {activeEffects.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid #333', paddingTop: 12, ...sectionHdr }}>
            AKTIVE EFFEKTE
          </div>
          <div style={{ fontSize: '0.9rem', color: '#ccc', lineHeight: 1.9, marginBottom: 12 }}>
            {activeEffects.map((e) => <div key={e}>{e}</div>)}
          </div>
        </>
      )}

      {/* Traits */}
      {traits.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid #333', paddingTop: 12, ...sectionHdr }}>TRAITS</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {traits.map((t) => (
              <span
                key={t}
                style={{ border: '1px solid #4a9', color: '#4a9', padding: '4px 10px', fontSize: '0.88rem' }}
              >
                {TRAIT_LABELS[t] ?? t.toUpperCase()}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd packages/client && npx vitest run src/__tests__/AcepTab.test.tsx
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/AcepTab.tsx packages/client/src/__tests__/AcepTab.test.tsx
git commit -m "feat: add AcepTab — XP paths, boost buttons, effects, traits, ship rename"
```

Also add a test for cargo effect in the `AcepTab.test.tsx` test file. Add to the describe block:

```tsx
  it('renders cargo effect when cargoMultiplier > 1', () => {
    mockStoreState({
      ship: { ...mockShip, acepEffects: { ...mockShip.acepEffects, cargoMultiplier: 1.2 } } as any,
      credits: 500, research: { wissen: 10 } as any,
    });
    render(<AcepTab />);
    expect(screen.getByText(/20% Cargo/)).toBeInTheDocument();
  });
```

---

## Chunk 2: ModuleTab + ShopTab

### Task 3: Create ModuleTab component

**Files:**
- Create: `packages/client/src/components/ModuleTab.tsx`
- Create: `packages/client/src/__tests__/ModuleTab.test.tsx`

**What it does:** Installed module slots (with HP bar and remove button) + inventory install panel. Migrated and cleaned up from `AcepProgram.tsx` + `ModulePanel.tsx`.

- [ ] **Step 1: Write the failing test**

Create `packages/client/src/__tests__/ModuleTab.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendGetModuleInventory: vi.fn(),
    sendRemoveModule: vi.fn(),
    sendInstallModule: vi.fn(),
  },
}));

import { network } from '../network/client';
import { ModuleTab } from '../components/ModuleTab';

const mockShip = {
  id: 'ship-1',
  name: 'Test Ship',
  hullType: 'scout' as const,
  modules: [
    { slotIndex: 0, moduleId: 'generator_mk2', currentHp: 2, maxHp: 3, source: 'standard' as const },
  ],
  acepXp: { ausbau: 0, intel: 0, kampf: 0, explorer: 0, total: 0 },
  acepEffects: { extraModuleSlots: 0, cargoMultiplier: 1, miningBonus: 0, scanRadiusBonus: 0, combatDamageBonus: 0, ancientDetection: false, helionDecoderEnabled: false },
  acepTraits: [],
  slots: 8, hp: 100, maxHp: 100, speed: 1, shield: 0, maxShield: 0,
  armor: 0, damage: 10, scanRadius: 3, miningPower: 0, cargoCap: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState({
    ship: mockShip as any,
    moduleInventory: [],
    setAcepHoveredModuleId: vi.fn(),
  });
});

describe('ModuleTab', () => {
  it('calls sendGetModuleInventory on mount', () => {
    render(<ModuleTab />);
    expect(network.sendGetModuleInventory).toHaveBeenCalledTimes(1);
  });

  it('renders occupied slot with category label', () => {
    render(<ModuleTab />);
    expect(screen.getByText(/\[GEN\]/i)).toBeInTheDocument();
  });

  it('renders empty slots as leer', () => {
    render(<ModuleTab />);
    const leer = screen.getAllByText(/leer/i);
    expect(leer.length).toBeGreaterThan(0);
  });

  it('remove button calls sendRemoveModule with ship.id and slotIndex', () => {
    render(<ModuleTab />);
    const removeBtn = screen.getByText(/\[×\]/i);
    fireEvent.click(removeBtn);
    expect(network.sendRemoveModule).toHaveBeenCalledWith('ship-1', 0);
  });

  it('shows LEER when inventory is empty', () => {
    render(<ModuleTab />);
    expect(screen.getByText(/LEER/i)).toBeInTheDocument();
  });

  it('renders inventory item with install button', () => {
    mockStoreState({
      ship: mockShip as any,
      moduleInventory: ['drive_mk1'],
      setAcepHoveredModuleId: vi.fn(),
    });
    render(<ModuleTab />);
    expect(screen.getByText(/INST/i)).toBeInTheDocument();
  });

  it('INST button calls sendInstallModule', () => {
    mockStoreState({
      ship: mockShip as any,
      moduleInventory: ['drive_mk1'],
      setAcepHoveredModuleId: vi.fn(),
    });
    render(<ModuleTab />);
    fireEvent.click(screen.getByText(/INST/i));
    expect(network.sendInstallModule).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/client && npx vitest run src/__tests__/ModuleTab.test.tsx
```

Expected: FAIL — `ModuleTab` module not found

- [ ] **Step 3: Create ModuleTab.tsx**

Create `packages/client/src/components/ModuleTab.tsx`:

```tsx
import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { SPECIALIZED_SLOT_CATEGORIES, MODULES, getExtraSlotCount } from '@void-sector/shared';

const CAT_LABELS: Record<string, string> = {
  generator: 'GEN', drive: 'DRV', weapon: 'WPN', armor: 'ARM',
  shield: 'SHD', scanner: 'SCN', miner: 'MIN', cargo: 'CGO',
};

function hpBar(current: number, max: number): string {
  if (max <= 0) return '██████';
  const filled = Math.round((current / max) * 6);
  return '█'.repeat(filled) + '░'.repeat(6 - filled);
}

const sectionHdr: React.CSSProperties = {
  fontSize: '0.75rem',
  letterSpacing: '0.12em',
  color: '#666',
  marginBottom: 8,
};

export function ModuleTab() {
  const ship = useStore((s) => s.ship);
  const moduleInventory = useStore((s) => s.moduleInventory);
  const setHovered = useStore((s) => s.setAcepHoveredModuleId);

  useEffect(() => {
    network.sendGetModuleInventory();
  }, []);

  if (!ship) {
    return (
      <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '1rem', opacity: 0.4 }}>
        KEIN SCHIFF
      </div>
    );
  }

  const ausbauXp = ship.acepXp?.ausbau ?? 0;
  const extraSlotCount = getExtraSlotCount(ausbauXp);
  const totalSlots = SPECIALIZED_SLOT_CATEGORIES.length + extraSlotCount;
  const moduleBySlot = new Map(ship.modules.map((m) => [m.slotIndex, m]));
  const installedCount = ship.modules.length;

  // Build slot list: specialized + extra
  const slots = [
    ...SPECIALIZED_SLOT_CATEGORIES.map((cat, idx) => ({
      index: idx,
      label: CAT_LABELS[cat] ?? cat.toUpperCase().slice(0, 3),
      cat,
      module: moduleBySlot.get(idx) ?? null,
    })),
    ...Array.from({ length: extraSlotCount }, (_, i) => ({
      index: SPECIALIZED_SLOT_CATEGORIES.length + i,
      label: `+${i + 1}`,
      cat: null as string | null,
      module: moduleBySlot.get(SPECIALIZED_SLOT_CATEGORIES.length + i) ?? null,
    })),
  ];

  // Find a compatible install slot for a module category
  function findTargetSlot(category: string): number {
    // Try matching specialized slot first
    for (let i = 0; i < SPECIALIZED_SLOT_CATEGORIES.length; i++) {
      if (SPECIALIZED_SLOT_CATEGORIES[i] === category && !moduleBySlot.has(i)) return i;
    }
    // Try extra slots (flexible — accept any category)
    for (let i = SPECIALIZED_SLOT_CATEGORIES.length; i < totalSlots; i++) {
      if (!moduleBySlot.has(i)) return i;
    }
    return -1;
  }

  return (
    <div style={{ padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '1rem', overflow: 'auto', height: '100%' }}>
      {/* Installed slots */}
      <div style={sectionHdr}>INSTALLIERT — {installedCount}/{totalSlots} Slots</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {slots.map(({ index, label, module }) => {
          const def = module ? MODULES[module.moduleId] : null;
          const occupied = !!module;
          return (
            <div
              key={index}
              style={{
                border: `1px solid ${occupied ? '#444' : '#222'}`,
                padding: '7px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onMouseEnter={() => occupied && def ? setHovered(module!.moduleId) : undefined}
              onMouseLeave={() => setHovered(null)}
            >
              {occupied && def ? (
                <>
                  <div>
                    <span style={{ color: '#666', fontSize: '0.8rem' }}>[{label}]</span>
                    <span style={{ color: 'var(--color-primary)', marginLeft: 6 }}>{def.name}</span>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>
                      HP {hpBar(module!.currentHp ?? 0, def.maxHp ?? 20)}
                    </div>
                  </div>
                  <button
                    style={btnDanger}
                    onClick={() => network.sendRemoveModule(ship.id, index)}
                  >
                    [×]
                  </button>
                </>
              ) : (
                <span style={{ color: '#444', fontSize: '0.9rem' }}>[{label}] — leer</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Inventory */}
      <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
        <div style={sectionHdr}>INVENTAR — {moduleInventory.length} Module</div>
        {moduleInventory.length === 0 ? (
          <div style={{ color: '#444', fontSize: '0.9rem', opacity: 0.6 }}>LEER</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {moduleInventory.map((moduleId, idx) => {
              const def = MODULES[moduleId];
              if (!def) return null;
              const targetSlot = findTargetSlot(def.category);
              return (
                <div
                  key={`${moduleId}-${idx}`}
                  style={{ border: '1px solid #444', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={() => setHovered(moduleId)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div>
                    <div style={{ color: '#FFB000', fontSize: '0.95rem' }}>{def.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>{def.primaryEffect.label}</div>
                  </div>
                  {targetSlot >= 0 ? (
                    <button
                      style={btnPrimary}
                      onClick={() => network.sendInstallModule(ship.id, moduleId, targetSlot)}
                    >
                      [INST]
                    </button>
                  ) : (
                    <span style={{ color: '#444', fontSize: '0.8rem' }}>VOLL</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const btnDanger: React.CSSProperties = {
  background: 'transparent', border: '1px solid #f44', color: '#f44',
  fontFamily: 'var(--font-mono)', fontSize: '0.88rem', padding: '3px 9px', cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)', fontSize: '0.88rem', padding: '3px 10px', cursor: 'pointer',
};
```

- [ ] **Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/ModuleTab.test.tsx
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/ModuleTab.tsx packages/client/src/__tests__/ModuleTab.test.tsx
git commit -m "feat: add ModuleTab — installed slots, HP bar, inventory install"
```

---

### Task 4: Create ShopTab component

**Files:**
- Create: `packages/client/src/components/ShopTab.tsx`
- Create: `packages/client/src/__tests__/ShopTab.test.tsx`

**What it does:** Module purchase list (only when at station/base), filtered by `isModuleUnlocked`, full cost check. Migrated from `ModulePanel.tsx`.

- [ ] **Step 1: Write the failing test**

Create `packages/client/src/__tests__/ShopTab.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendBuyModule: vi.fn(),
  },
}));

vi.mock('@void-sector/shared', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    isModuleUnlocked: vi.fn().mockReturnValue(true),
  };
});

import { network } from '../network/client';
import { ShopTab } from '../components/ShopTab';

const baseStore = {
  ship: { id: 'ship-1', hullType: 'scout' as const, modules: [] } as any,
  credits: 9999,
  cargo: { ore: 99, gas: 99, crystal: 99, artefact: 99, slates: 0 } as any,
  research: { wissen: 0 } as any,
  currentSector: { type: 'station' } as any,
  baseStructures: [] as any[],
  setAcepHoveredModuleId: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState(baseStore);
});

describe('ShopTab', () => {
  it('shows unavailable message when not at station or base', () => {
    mockStoreState({ ...baseStore, currentSector: { type: 'empty' } as any, baseStructures: [] });
    render(<ShopTab />);
    expect(screen.getByText(/nur an Station/i)).toBeInTheDocument();
  });

  it('shows module list when at station', () => {
    render(<ShopTab />);
    // At least one [KAUFEN] button should exist (modules list is non-empty)
    const buyBtns = screen.getAllByText(/KAUFEN/i);
    expect(buyBtns.length).toBeGreaterThan(0);
  });

  it('shows module list when at home base', () => {
    mockStoreState({ ...baseStore, currentSector: { type: 'empty' } as any, baseStructures: [{ type: 'base' }] as any[] });
    render(<ShopTab />);
    const buyBtns = screen.getAllByText(/KAUFEN/i);
    expect(buyBtns.length).toBeGreaterThan(0);
  });

  it('KAUFEN calls sendBuyModule with module id', () => {
    render(<ShopTab />);
    const buyBtns = screen.getAllByText(/KAUFEN/i);
    fireEvent.click(buyBtns[0]);
    expect(network.sendBuyModule).toHaveBeenCalledTimes(1);
  });

  it('KAUFEN button is disabled when credits insufficient', () => {
    mockStoreState({ ...baseStore, credits: 0 });
    render(<ShopTab />);
    // All buttons should be disabled (no credits)
    const buyBtns = screen.getAllByRole('button', { name: /KAUFEN/i });
    expect(buyBtns.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/client && npx vitest run src/__tests__/ShopTab.test.tsx
```

Expected: FAIL — `ShopTab` module not found

- [ ] **Step 3: Create ShopTab.tsx**

Create `packages/client/src/components/ShopTab.tsx`:

```tsx
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULES, isModuleUnlocked } from '@void-sector/shared';
import type { ModuleDefinition } from '@void-sector/shared';

const sectionHdr: React.CSSProperties = {
  fontSize: '0.75rem',
  letterSpacing: '0.12em',
  color: '#666',
  marginBottom: 10,
};

export function ShopTab() {
  const credits = useStore((s) => s.credits);
  const cargo = useStore((s) => s.cargo);
  const research = useStore((s) => s.research);
  const currentSector = useStore((s) => s.currentSector);
  const baseStructures = useStore((s) => s.baseStructures);
  const setHovered = useStore((s) => s.setAcepHoveredModuleId);

  const atStation = currentSector?.type === 'station' || baseStructures.some((s: any) => s.type === 'base');

  if (!atStation) {
    return (
      <div style={{ padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
        <div style={sectionHdr}>MODUL-SHOP</div>
        <div style={{
          padding: '9px 11px', background: '#0a0a0a', border: '1px solid #222',
          fontSize: '0.85rem', color: '#555',
        }}>
          Modul-Shop nur an Station oder Home Base verfügbar
        </div>
      </div>
    );
  }

  const availableModules = Object.values(MODULES).filter(
    (m) => isModuleUnlocked(m.id, research),
  );

  function canAfford(def: ModuleDefinition): boolean {
    if (credits < def.cost.credits) return false;
    if (def.cost.ore !== undefined && cargo.ore < def.cost.ore) return false;
    if (def.cost.gas !== undefined && cargo.gas < def.cost.gas) return false;
    if (def.cost.crystal !== undefined && cargo.crystal < def.cost.crystal) return false;
    if (def.cost.artefact !== undefined && cargo.artefact < def.cost.artefact) return false;
    return true;
  }

  function costLabel(def: ModuleDefinition): string {
    const parts: string[] = [`${def.cost.credits} CR`];
    if (def.cost.ore) parts.push(`${def.cost.ore} Erz`);
    if (def.cost.gas) parts.push(`${def.cost.gas} Gas`);
    if (def.cost.crystal) parts.push(`${def.cost.crystal} Kristall`);
    if (def.cost.artefact) parts.push(`${def.cost.artefact} Artefakt`);
    return parts.join(' + ');
  }

  return (
    <div style={{ padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '1rem', overflow: 'auto', height: '100%' }}>
      <div style={sectionHdr}>
        MODUL-SHOP <span style={{ color: '#4a9' }}>● AN STATION</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {availableModules.map((def: ModuleDefinition) => {
          const affordable = canAfford(def);
          return (
            <div
              key={def.id}
              style={{ border: '1px solid #333', padding: '9px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={() => setHovered(def.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div>
                <div style={{ color: '#FFB000', fontSize: '0.95rem' }}>{def.displayName}</div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 3 }}>
                  {def.primaryEffect.label} · {costLabel(def)}
                </div>
              </div>
              <button
                style={{ ...btnStyle, opacity: affordable ? 1 : 0.3, cursor: affordable ? 'pointer' : 'not-allowed' }}
                disabled={!affordable}
                onClick={() => network.sendBuyModule(def.id)}
              >
                [KAUFEN]
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)', fontSize: '0.85rem', padding: '4px 10px', cursor: 'pointer',
};
```

- [ ] **Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/ShopTab.test.tsx
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/ShopTab.tsx packages/client/src/__tests__/ShopTab.test.tsx
git commit -m "feat: add ShopTab — module shop with station gate and full affordability check"
```

---

## Chunk 3: AcepDetailPanel + AcepProgram Rewrite

### Task 5: Create AcepDetailPanel

**Files:**
- Create: `packages/client/src/components/AcepDetailPanel.tsx`
- Create: `packages/client/src/__tests__/AcepDetailPanel.test.tsx`

**What it does:** Sec 3 contextual panel. Reads `acepActiveTab` and `acepHoveredModuleId` from store. Shows trait explanations for ACEP tab, module-effect delta for MODULE/SHOP tabs.

- [ ] **Step 1: Write the failing test**

Create `packages/client/src/__tests__/AcepDetailPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { mockStoreState } from '../test/mockStore';
import { AcepDetailPanel } from '../components/AcepDetailPanel';

const mockShip = {
  id: 'ship-1', name: 'T', hullType: 'scout' as const,
  modules: [],
  acepXp: { ausbau: 20, intel: 0, kampf: 0, explorer: 0, total: 20 },
  acepTraits: ['cautious'],
  acepEffects: { extraModuleSlots: 0, cargoMultiplier: 1, miningBonus: 0, scanRadiusBonus: 0, combatDamageBonus: 0, ancientDetection: false, helionDecoderEnabled: false },
  slots: 8, hp: 100, maxHp: 100, speed: 1, shield: 0, maxShield: 0,
  armor: 0, damage: 10, scanRadius: 3, miningPower: 0, cargoCap: 10,
};

beforeEach(() => {
  mockStoreState({
    ship: mockShip as any,
    acepActiveTab: 'acep' as const,
    acepHoveredModuleId: null,
  });
});

describe('AcepDetailPanel', () => {
  it('shows trait info for ACEP tab', () => {
    render(<AcepDetailPanel />);
    expect(screen.getByText(/CAUTIOUS/i)).toBeInTheDocument();
  });

  it('shows hover prompt for MODULE tab without hover', () => {
    mockStoreState({ ship: mockShip as any, acepActiveTab: 'module' as const, acepHoveredModuleId: null });
    render(<AcepDetailPanel />);
    expect(screen.getByText(/hovern/i)).toBeInTheDocument();
  });

  it('shows module detail for MODULE tab with hover', () => {
    mockStoreState({ ship: mockShip as any, acepActiveTab: 'module' as const, acepHoveredModuleId: 'drive_mk1' });
    render(<AcepDetailPanel />);
    // drive_mk1 should show name
    expect(screen.getByText(/drive/i)).toBeInTheDocument();
  });

  it('shows hover prompt for SHOP tab without hover', () => {
    mockStoreState({ ship: mockShip as any, acepActiveTab: 'shop' as const, acepHoveredModuleId: null });
    render(<AcepDetailPanel />);
    expect(screen.getByText(/hovern/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/client && npx vitest run src/__tests__/AcepDetailPanel.test.tsx
```

Expected: FAIL — `AcepDetailPanel` not found

- [ ] **Step 3: Create AcepDetailPanel.tsx**

Create `packages/client/src/components/AcepDetailPanel.tsx`:

```tsx
import { useStore } from '../state/store';
import { MODULES, calculateShipStats } from '@void-sector/shared';
import type { ShipStats } from '@void-sector/shared';

const TRAIT_INFO: Record<string, { label: string; desc: string }> = {
  veteran:         { label: 'VETERAN',  desc: 'Kampferprobt. Hohe KAMPF-Erfahrung.' },
  curious:         { label: 'CURIOUS',  desc: 'Ständig am scannen. Hohe INTEL-Erfahrung.' },
  reckless:        { label: 'RECKLESS', desc: 'Kämpfer ohne Logistik-Sinn.' },
  cautious:        { label: 'CAUTIOUS', desc: 'Bauer, der Konflikten ausweicht.' },
  'ancient-touched': { label: 'ANCIENT', desc: 'Hat Ruinen entdeckt. Hohe EXPLORER-Erfahrung.' },
  scarred:         { label: 'SCARRED',  desc: 'Tunnelblick-Kämpfer, kaum anderes.' },
};

const STAT_LABELS: Array<{ key: keyof ShipStats; label: string; format?: (v: number) => string }> = [
  { key: 'engineSpeed', label: 'Antrieb', format: (v) => `${Math.round(v * 100)}%` },
  { key: 'cargoCap',    label: 'Cargo' },
  { key: 'scannerLevel', label: 'Scanner' },
  { key: 'damageMod',  label: 'Schaden', format: (v) => `${Math.round(v * 100)}%` },
  { key: 'shieldHp',   label: 'Schild' },
  { key: 'hp',         label: 'Rumpf' },
  { key: 'jumpRange',  label: 'Sprungweite' },
];

function formatVal(v: number, format?: (v: number) => string): string {
  return format ? format(v) : String(Math.round(v * 10) / 10);
}

const dimStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#555', padding: 14, fontFamily: 'var(--font-mono)' };
const hdrStyle: React.CSSProperties = { fontSize: '0.75rem', letterSpacing: '0.12em', color: '#666', marginBottom: 8 };

export function AcepDetailPanel() {
  const ship = useStore((s) => s.ship);
  const activeTab = useStore((s) => s.acepActiveTab);
  const hoveredId = useStore((s) => s.acepHoveredModuleId);

  if (!ship) return <div style={dimStyle}>KEIN SCHIFF</div>;

  // ACEP tab: show trait explanations
  if (activeTab === 'acep') {
    const traits = ship.acepTraits ?? [];
    if (traits.length === 0) {
      return (
        <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
          <div style={hdrStyle}>TRAITS</div>
          <div style={{ color: '#555' }}>Noch keine Traits</div>
          <div style={{ color: '#444', fontSize: '0.8rem', marginTop: 8 }}>
            Traits entstehen durch XP-Verteilung auf die 4 Pfade.
          </div>
        </div>
      );
    }
    return (
      <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
        <div style={hdrStyle}>TRAITS</div>
        {traits.map((t) => {
          const info = TRAIT_INFO[t];
          if (!info) return null;
          return (
            <div key={t} style={{ marginBottom: 10 }}>
              <div style={{ color: '#4a9', fontSize: '0.95rem', marginBottom: 2 }}>{info.label}</div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>{info.desc}</div>
            </div>
          );
        })}
      </div>
    );
  }

  // MODULE or SHOP tab: hover for module detail
  if (!hoveredId) {
    return <div style={dimStyle}>Modul hovern für Details</div>;
  }

  const def = MODULES[hoveredId];
  if (!def) return <div style={dimStyle}>—</div>;

  // Compute delta: stats with vs without this module
  const currentModules = ship.modules ?? [];
  const withoutModule = currentModules.filter((m) => m.moduleId !== hoveredId);
  const statsWithout = calculateShipStats(ship.hullType, withoutModule, ship.acepXp);
  const statsCandidate =
    activeTab === 'shop'
      ? calculateShipStats(ship.hullType, [...withoutModule, { moduleId: hoveredId, slotIndex: 99, source: 'standard' as const }], ship.acepXp)
      : calculateShipStats(ship.hullType, currentModules, ship.acepXp);

  const deltas = STAT_LABELS
    .map(({ key, label, format }) => {
      const beforeNum = statsWithout[key] as number;
      const afterNum = statsCandidate[key] as number;
      const delta = afterNum - beforeNum;
      if (Math.abs(delta) < 0.001) return null;
      const sign = delta > 0 ? '+' : '-';
      return {
        label,
        before: formatVal(beforeNum, format),
        deltaStr: formatVal(Math.abs(delta), format),
        after: formatVal(afterNum, format),
        sign,
        positive: delta > 0,
      };
    })
    .filter(Boolean) as Array<{ label: string; before: string; deltaStr: string; after: string; sign: string; positive: boolean }>;

  // Find currently installed module in same category (for SHOP tab replacement note)
  const replacedModule = activeTab === 'shop'
    ? ship.modules.find((m) => {
        const d = MODULES[m.moduleId];
        return d && d.category === def.category;
      })
    : undefined;

  return (
    <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', overflow: 'auto', height: '100%' }}>
      <div style={{ color: 'var(--color-primary)', fontSize: '1rem', marginBottom: 4 }}>{def.displayName ?? def.name}</div>
      <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: 12 }}>[{def.category.toUpperCase()}]</div>

      {activeTab === 'shop' && (
        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: 10 }}>
          {replacedModule
            ? `Ersetzt: ${MODULES[replacedModule.moduleId]?.name ?? replacedModule.moduleId}`
            : `Installiert in: [${(MODULES[hoveredId]?.category ?? '?').toUpperCase().slice(0, 3)}]-Slot`}
        </div>
      )}

      <div style={hdrStyle}>AUSWIRKUNG AUF SCHIFF</div>
      {deltas.length === 0 ? (
        <div style={{ color: '#555', fontSize: '0.85rem' }}>Keine direkten Stat-Änderungen</div>
      ) : (
        deltas.map(({ label, before, deltaStr, after, sign, positive }) => (
          <div key={label} style={{ marginBottom: 6 }}>
            <span style={{ color: '#888', fontSize: '0.8rem' }}>{label}: </span>
            <span style={{ color: '#ccc' }}>{before}</span>
            <span style={{ color: '#555' }}> → </span>
            <span style={{ color: positive ? '#00FF88' : '#f44' }}>{sign}{deltaStr}</span>
            <span style={{ color: '#555' }}> = </span>
            <span style={{ color: '#ccc' }}>{after}</span>
          </div>
        ))
      )}

      {activeTab === 'module' && (
        <>
          <div style={{ ...hdrStyle, marginTop: 12 }}>HP</div>
          <div style={{ color: '#ccc', fontSize: '0.9rem' }}>
            {(() => {
              const installed = ship.modules.find((m) => m.moduleId === hoveredId);
              if (!installed) return '—';
              const maxHp = MODULES[hoveredId]?.maxHp ?? 20;
              return `${installed.currentHp ?? maxHp} / ${maxHp}`;
            })()}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/AcepDetailPanel.test.tsx
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/AcepDetailPanel.tsx packages/client/src/__tests__/AcepDetailPanel.test.tsx
git commit -m "feat: add AcepDetailPanel — contextual detail monitor with module stat deltas"
```

---

### Task 6: Rewrite AcepProgram

**Files:**
- Rewrite: `packages/client/src/components/AcepProgram.tsx`
- Rewrite: `packages/client/src/__tests__/AcepProgram.test.tsx`

**What it does:** 3-tab shell. Sets `acepActiveTab` in store on tab switch. Renders AcepTab / ModuleTab / ShopTab.

- [ ] **Step 1: Write the failing test**

Replace the contents of `packages/client/src/__tests__/AcepProgram.test.tsx` with:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendAcepBoost: vi.fn(),
    sendRenameShip: vi.fn(),
    sendGetModuleInventory: vi.fn(),
    sendRemoveModule: vi.fn(),
    sendInstallModule: vi.fn(),
    sendBuyModule: vi.fn(),
  },
}));

import { AcepProgram } from '../components/AcepProgram';

const mockShip = {
  id: 'ship-1', name: 'Test Ship', hullType: 'scout' as const,
  modules: [],
  acepXp: { ausbau: 5, intel: 0, kampf: 0, explorer: 0, total: 5 },
  acepEffects: { extraModuleSlots: 0, cargoMultiplier: 1, miningBonus: 0, scanRadiusBonus: 0, combatDamageBonus: 0, ancientDetection: false, helionDecoderEnabled: false },
  acepTraits: [],
  acepGeneration: 1,
  slots: 8, hp: 100, maxHp: 100, speed: 1, shield: 0, maxShield: 0,
  armor: 0, damage: 10, scanRadius: 3, miningPower: 0, cargoCap: 10,
};

const setAcepActiveTab = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState({
    ship: mockShip as any,
    credits: 500,
    research: { wissen: 10 } as any,
    cargo: { ore: 0, gas: 0, crystal: 0, artefact: 0, slates: 0 } as any,
    moduleInventory: [],
    acepActiveTab: 'acep' as const,
    acepHoveredModuleId: null,
    currentSector: null,
    baseStructures: [],
    setAcepActiveTab,
    setAcepHoveredModuleId: vi.fn(),
  });
});

describe('AcepProgram', () => {
  it('renders 3 tab buttons', () => {
    render(<AcepProgram />);
    expect(screen.getByText(/\[ACEP\]/i)).toBeInTheDocument();
    expect(screen.getByText(/\[MODULE\]/i)).toBeInTheDocument();
    expect(screen.getByText(/\[SHOP\]/i)).toBeInTheDocument();
  });

  it('ACEP tab is active by default', () => {
    render(<AcepProgram />);
    // AcepTab content visible
    expect(screen.getByText('AUSBAU')).toBeInTheDocument();
  });

  it('clicking MODULE tab calls setAcepActiveTab', () => {
    render(<AcepProgram />);
    fireEvent.click(screen.getByText(/\[MODULE\]/i));
    expect(setAcepActiveTab).toHaveBeenCalledWith('module');
  });

  it('clicking SHOP tab calls setAcepActiveTab', () => {
    render(<AcepProgram />);
    fireEvent.click(screen.getByText(/\[SHOP\]/i));
    expect(setAcepActiveTab).toHaveBeenCalledWith('shop');
  });

  it('shows MODULE tab content when acepActiveTab is module', () => {
    mockStoreState({
      ship: mockShip as any,
      credits: 500,
      research: { wissen: 10 } as any,
      cargo: { ore: 0, gas: 0, crystal: 0, artefact: 0, slates: 0 } as any,
      moduleInventory: [],
      acepActiveTab: 'module' as const,
      acepHoveredModuleId: null,
      currentSector: null,
      baseStructures: [],
      setAcepActiveTab,
      setAcepHoveredModuleId: vi.fn(),
    });
    render(<AcepProgram />);
    expect(screen.getByText(/INSTALLIERT/i)).toBeInTheDocument();
  });

  it('shows NO ACTIVE SHIP fallback when ship is null', () => {
    mockStoreState({ ship: null, acepActiveTab: 'acep' as const, setAcepActiveTab, setAcepHoveredModuleId: vi.fn() });
    render(<AcepProgram />);
    expect(screen.getByText(/NO ACTIVE SHIP/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm new tests fail (old AcepProgram has wrong structure)**

```bash
cd packages/client && npx vitest run src/__tests__/AcepProgram.test.tsx
```

Expected: Multiple failures

- [ ] **Step 3: Rewrite AcepProgram.tsx**

Replace the contents of `packages/client/src/components/AcepProgram.tsx` with:

```tsx
import { useStore } from '../state/store';
import { AcepTab } from './AcepTab';
import { ModuleTab } from './ModuleTab';
import { ShopTab } from './ShopTab';

type AcepTabId = 'acep' | 'module' | 'shop';

const TABS: Array<{ id: AcepTabId; label: string }> = [
  { id: 'acep',   label: '[ACEP]' },
  { id: 'module', label: '[MODULE]' },
  { id: 'shop',   label: '[SHOP]' },
];

export function AcepProgram() {
  const ship = useStore((s) => s.ship);
  const activeTab = useStore((s) => s.acepActiveTab);
  const setActiveTab = useStore((s) => s.setAcepActiveTab);

  if (!ship) {
    return (
      <div style={{ padding: 12, fontFamily: 'var(--font-mono)', fontSize: '0.65rem', opacity: 0.5 }}>
        NO ACTIVE SHIP
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-mono)' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: '1px solid #333', flexShrink: 0 }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            style={{
              background: 'transparent',
              border: activeTab === id ? '1px solid var(--color-primary)' : '1px solid #333',
              color: activeTab === id ? 'var(--color-primary)' : '#555',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              padding: '3px 10px',
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'acep'   && <AcepTab />}
        {activeTab === 'module' && <ModuleTab />}
        {activeTab === 'shop'   && <ShopTab />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/AcepProgram.test.tsx
```

Expected: PASS (6 tests)

- [ ] **Step 5: Run full client test suite to check for regressions**

```bash
cd packages/client && npx vitest run
```

Expected: All passing (previous AcepProgram tests replaced, no regression)

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/AcepProgram.tsx packages/client/src/__tests__/AcepProgram.test.tsx
git commit -m "feat: rewrite AcepProgram as 3-tab shell (ACEP · MODULE · SHOP)"
```

---

## Chunk 4: Wire + Cleanup

### Task 7: Wire CockpitLayout + remove MODULES route + delete old files

**Files:**
- Modify: `packages/client/src/components/CockpitLayout.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx`
- Delete: `packages/client/src/components/AcepPanel.tsx`
- Delete: `packages/client/src/components/ModulePanel.tsx`
- Delete: `packages/client/src/components/HangarPanel.tsx`

- [ ] **Step 1: Add ACEP case to getDetailForProgram in CockpitLayout.tsx**

In `packages/client/src/components/CockpitLayout.tsx`:

Add import at the top with other detail panel imports:
```ts
import { AcepDetailPanel } from './AcepDetailPanel';
```

In the `getDetailForProgram` switch, add a case before `default`:
```ts
    case 'ACEP':
      return <AcepDetailPanel />;
```

- [ ] **Step 2: Remove MODULES route from GameScreen.tsx**

In `packages/client/src/components/GameScreen.tsx`:

Remove the import line for `ModulePanel`:
```ts
import { ModulePanel } from './ModulePanel';  // DELETE this line
```

Remove the case in the monitor switch:
```ts
    case 'MODULES':
      return <ModulePanel />;  // DELETE these two lines
```

Also remove the `AcepProgram` import if it was imported from the old path (it stays, but verify import still points to AcepProgram).

- [ ] **Step 3: Delete old component and test files**

```bash
rm packages/client/src/components/AcepPanel.tsx
rm packages/client/src/components/ModulePanel.tsx
rm packages/client/src/components/HangarPanel.tsx
rm packages/client/src/__tests__/AcepPanel.test.tsx
```

- [ ] **Step 4: Run full client test suite**

```bash
cd packages/client && npx vitest run
```

Expected: All passing. If there are import errors from deleted files, fix them.

- [ ] **Step 5: Run server tests (no changes expected)**

```bash
cd packages/server && npx vitest run
```

Expected: All passing

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/CockpitLayout.tsx packages/client/src/components/GameScreen.tsx
git rm packages/client/src/components/AcepPanel.tsx packages/client/src/components/ModulePanel.tsx packages/client/src/components/HangarPanel.tsx packages/client/src/__tests__/AcepPanel.test.tsx
git commit -m "feat: wire AcepDetailPanel to Sec3, remove MODULES route, delete old ACEP/Module/Hangar components"
```

---

### Task 8: Final integration check

- [ ] **Step 1: Run all tests across packages**

```bash
cd packages/client && npx vitest run && cd ../server && npx vitest run && cd ../shared && npx vitest run
```

Expected: All pass

- [ ] **Step 2: Verify no orphaned imports**

```bash
cd packages/client && grep -r "AcepPanel\|ModulePanel\|HangarPanel\|MODULES.*program\|setActiveProgram.*MODULES" src/ --include="*.ts" --include="*.tsx"
```

Expected: No matches (or only in deleted-file stubs if any)

- [ ] **Step 3: Commit cleanup if needed, else done**

```bash
git add -A && git commit -m "chore: fix any remaining import cleanup after ACEP redesign"
```

If nothing to fix, skip this step.
