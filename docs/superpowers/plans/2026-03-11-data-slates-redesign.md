# Data-Slates Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple data slates from cargo capacity, give them a scanner-based memory budget, a dedicated SLATES tab in CargoScreen, and a detail view in Sec 3.

**Architecture:** New `memory` stat on `ShipStats` accumulated from scanner module effects. Shared `getPhysicalCargoTotal()` utility replaces all inline cargo-total calculations (excluding slates). Server validation checks memory budget instead of cargo capacity for slate operations. Client gets a 4th tab in CargoScreen and a slate detail view in DetailPanel.

**Tech Stack:** TypeScript, React, Zustand, Colyseus, Vitest

**Spec:** `docs/superpowers/specs/2026-03-11-data-slates-redesign-design.md`

---

## Chunk 1: Shared Foundation

### Task 1: Add `memory` stat and `getPhysicalCargoTotal` to shared

**Files:**
- Modify: `packages/shared/src/types.ts` (ShipStats interface)
- Modify: `packages/shared/src/constants.ts` (BASE_SCANNER_MEMORY, getPhysicalCargoTotal, module effects)
- Modify: `packages/shared/src/shipCalculator.ts` (memory init + clamp)
- Test: `packages/shared/src/__tests__/shipCalculator.test.ts`

- [ ] **Step 1: Add `memory` to `ShipStats` interface**

In `packages/shared/src/types.ts`, add after `repairHpPerSecond`:

```typescript
  memory: number;
```

- [ ] **Step 2: Add `BASE_SCANNER_MEMORY` constant and `getPhysicalCargoTotal` utility**

In `packages/shared/src/constants.ts`, add near the other slate constants (after line ~331):

```typescript
export const BASE_SCANNER_MEMORY = 2;

export function getPhysicalCargoTotal(cargo: { ore: number; gas: number; crystal: number; artefact: number }): number {
  return cargo.ore + cargo.gas + cargo.crystal + cargo.artefact;
}
```

Export `getPhysicalCargoTotal` and `BASE_SCANNER_MEMORY` from `packages/shared/src/index.ts` if not auto-exported.

- [ ] **Step 3: Add `memory` to scanner module effects**

In `packages/shared/src/constants.ts`, add `memory` to each scanner module's `effects` object:

| Module ID | Line | Change |
|-----------|------|--------|
| `scanner_mk1` | ~930 | `effects: { scannerLevel: 1, memory: 4 }` |
| `scanner_mk2` | ~943 | `effects: { scannerLevel: 1, commRange: 50, memory: 6 }` |
| `scanner_mk3` | ~963 | `effects: { scannerLevel: 2, commRange: 100, artefactChanceBonus: 0.03, memory: 10 }` |
| `scanner_mk4` | ~1427 | `effects: { scannerLevel: 3, commRange: 150, artefactChanceBonus: 0.05, miningBonus: 0.1, memory: 14 }` |
| `scanner_mk5` | ~1447 | `effects: { scannerLevel: 4, commRange: 250, artefactChanceBonus: 0.08, miningBonus: 0.15, memory: 20 }` |
| `quantum_scanner` | ~1254 | `effects: { scannerLevel: 3, commRange: 200, artefactChanceBonus: 0.05, memory: 10 }` |
| `war_scanner` | ~1778 | `effects: { artefactChanceBonus: 0, scannerLevel: -2, memory: 0 }` |

Also add `memory` to each module's `secondaryEffects` array where appropriate:
- `scanner_mk1`: add `{ stat: 'memory', delta: 4, label: 'Memory +4' }` to secondaryEffects
- `scanner_mk2`: add `{ stat: 'memory', delta: 6, label: 'Memory +6' }`
- `scanner_mk3`: add `{ stat: 'memory', delta: 10, label: 'Memory +10' }`
- `scanner_mk4`: add `{ stat: 'memory', delta: 14, label: 'Memory +14' }`
- `scanner_mk5`: add `{ stat: 'memory', delta: 20, label: 'Memory +20' }`
- `quantum_scanner`: add `{ stat: 'memory', delta: 10, label: 'Memory +10' }`

- [ ] **Step 4: Initialize and clamp `memory` in `calculateShipStats`**

In `packages/shared/src/shipCalculator.ts`:

Add to stats initialization (after `scannerLevel: hull.baseScannerLevel`):

```typescript
    memory: BASE_SCANNER_MEMORY,
```

Import `BASE_SCANNER_MEMORY` from constants.

Add clamp after existing clamps (after `hyperdriveFuelEfficiency` clamp):

```typescript
  stats.memory = Math.max(0, Math.round(stats.memory));
```

- [ ] **Step 5: Write test for memory calculation**

In `packages/shared/src/__tests__/shipCalculator.test.ts`, add:

```typescript
describe('memory stat', () => {
  it('returns BASE_SCANNER_MEMORY with no scanner modules', () => {
    const stats = calculateShipStats('voidling', []);
    expect(stats.memory).toBe(2);
  });

  it('adds scanner module memory to base', () => {
    const stats = calculateShipStats('voidling', [{ moduleId: 'scanner_mk1', slot: 0 }]);
    expect(stats.memory).toBe(6); // 2 base + 4
  });

  it('accumulates memory from multiple scanners', () => {
    const stats = calculateShipStats('voidling', [
      { moduleId: 'scanner_mk1', slot: 0 },
      { moduleId: 'quantum_scanner', slot: 1 },
    ]);
    expect(stats.memory).toBe(16); // 2 + 4 + 10
  });

  it('war_scanner adds 0 memory', () => {
    const stats = calculateShipStats('voidling', [{ moduleId: 'war_scanner', slot: 0 }]);
    expect(stats.memory).toBe(2); // 2 base + 0
  });

  it('clamps memory to minimum 0', () => {
    // Edge case: if future module had negative memory
    const stats = calculateShipStats('voidling', []);
    expect(stats.memory).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 6: Write test for `getPhysicalCargoTotal`**

In `packages/shared/src/__tests__/shipCalculator.test.ts` (or a new test file):

```typescript
import { getPhysicalCargoTotal } from '@void-sector/shared';

describe('getPhysicalCargoTotal', () => {
  it('sums ore + gas + crystal + artefact, excludes slates', () => {
    const cargo = { ore: 5, gas: 3, crystal: 2, slates: 10, artefact: 1 };
    expect(getPhysicalCargoTotal(cargo)).toBe(11);
  });

  it('returns 0 for empty cargo', () => {
    expect(getPhysicalCargoTotal({ ore: 0, gas: 0, crystal: 0, artefact: 0 })).toBe(0);
  });
});
```

- [ ] **Step 7: Run tests and verify**

Run: `cd packages/shared && npx vitest run`
Expected: All tests pass including new memory and getPhysicalCargoTotal tests.

- [ ] **Step 8: Build shared package**

Run: `cd packages/shared && npm run build`
Required before server/client can use new exports.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/src/shipCalculator.ts packages/shared/src/__tests__/shipCalculator.test.ts
git commit -m "feat: add memory stat to ShipStats + getPhysicalCargoTotal utility (#276)"
```

---

## Chunk 2: Server Validation

### Task 2: Update server slate validation to use memory budget

**Files:**
- Modify: `packages/server/src/engine/commands.ts` (~lines 317–349)
- Modify: `packages/server/src/rooms/services/WorldService.ts` (~lines 784, 887, 1146)
- Test: `packages/server/src/engine/__tests__/commands-slates.test.ts`
- Test: `packages/server/src/__tests__/scanToSlate.test.ts`

- [ ] **Step 1: Update `CreateSlateState` and `validateCreateSlate`**

In `packages/server/src/engine/commands.ts`:

Replace `CreateSlateState` interface (lines 317–322):

```typescript
interface CreateSlateState {
  ap: number;
  scannerLevel: number;
  slateCount: number;
  memory: number;
}
```

Replace cargo check in `validateCreateSlate` (line 338–339):

Old:
```typescript
  if (state.cargoTotal >= state.cargoCap) {
    return { valid: false, error: 'Cargo full — no space for slate' };
  }
```

New:
```typescript
  if (state.slateCount >= state.memory) {
    return { valid: false, error: 'Memory full — no space for slate' };
  }
```

- [ ] **Step 2: Update `handleCreateSlate` caller**

In `packages/server/src/rooms/services/WorldService.ts` (~line 784):

Old:
```typescript
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;

    const validation = validateCreateSlate(
      {
        ap: currentAP.current,
        scannerLevel: ship.scannerLevel,
        cargoTotal,
        cargoCap: ship.cargoCap,
      },
      data.slateType,
    );
```

New:
```typescript
    const validation = validateCreateSlate(
      {
        ap: currentAP.current,
        scannerLevel: ship.scannerLevel,
        slateCount: cargo.slates,
        memory: ship.memory,
      },
      data.slateType,
    );
```

- [ ] **Step 3: Update `handleCreateSlateFromScan` check**

In `packages/server/src/rooms/services/WorldService.ts` (~lines 885–891):

Old:
```typescript
    const ship = this.ctx.getShipForClient(client.sessionId);
    const cargo = await getCargoState(auth.userId);
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
    if (cargoTotal + 1 > ship.cargoCap) {
      client.send('slateFromScanResult', { success: false, error: 'CARGO_FULL' });
      return;
    }
```

New:
```typescript
    const ship = this.ctx.getShipForClient(client.sessionId);
    const cargo = await getCargoState(auth.userId);
    if (cargo.slates >= ship.memory) {
      client.send('slateFromScanResult', { success: false, error: 'MEMORY_FULL' });
      return;
    }
```

- [ ] **Step 4: Update `handleAcceptSlateOrder` check**

In `packages/server/src/rooms/services/WorldService.ts` (~lines 1144–1149):

Old:
```typescript
    const cargo = await getCargoState(auth.userId);
    const ship = this.ctx.getShipForClient(client.sessionId);
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
    if (cargoTotal >= ship.cargoCap) {
      client.send('error', { code: 'CARGO_FULL', message: 'No cargo space' });
      return;
    }
```

New:
```typescript
    const cargo = await getCargoState(auth.userId);
    const ship = this.ctx.getShipForClient(client.sessionId);
    if (cargo.slates >= ship.memory) {
      client.send('error', { code: 'MEMORY_FULL', message: 'Memory full — no space for slate' });
      return;
    }
```

- [ ] **Step 5: Update `commands-slates.test.ts`**

In `packages/server/src/engine/__tests__/commands-slates.test.ts`, update test interface from `cargoTotal`/`cargoCap` to `slateCount`/`memory`:

```typescript
// Old pattern:
validateCreateSlate({ ap: 5, scannerLevel: 1, cargoTotal: 10, cargoCap: 10 }, 'sector')
// New pattern:
validateCreateSlate({ ap: 5, scannerLevel: 1, slateCount: 2, memory: 2 }, 'sector')
```

Update error message assertions from `'Cargo full'` to `'Memory full'`.

- [ ] **Step 6: Update `scanToSlate.test.ts`**

In `packages/server/src/__tests__/scanToSlate.test.ts`, update cargo-full test (~line 77):

Old mock pattern:
```typescript
vi.mocked(getCargoState).mockResolvedValue({
  ore: 10, gas: 5, crystal: 3, slates: 2, artefact: 0,
});
```

New: Mock should test memory-full condition instead:
```typescript
vi.mocked(getCargoState).mockResolvedValue({
  ore: 0, gas: 0, crystal: 0, slates: 6, artefact: 0,
});
// And mock ship.memory = 6 to trigger MEMORY_FULL
```

- [ ] **Step 7: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/engine/commands.ts packages/server/src/rooms/services/WorldService.ts packages/server/src/engine/__tests__/commands-slates.test.ts packages/server/src/__tests__/scanToSlate.test.ts
git commit -m "feat: slate validation uses memory budget instead of cargo capacity (#276)"
```

---

## Chunk 3: Client cargoTotal Replacement

### Task 3: Replace all inline cargoTotal with `getPhysicalCargoTotal`

**Files:**
- Modify: `packages/client/src/network/client.ts` (~line 475)
- Modify: `packages/client/src/components/CockpitLayout.tsx` (~line 71)
- Modify: `packages/client/src/components/TradeScreen.tsx` (~line 111)
- Modify: `packages/client/src/components/MiningScreen.tsx` (~line 50)
- Modify: `packages/client/src/components/ProgramSelector.tsx` (~line 26)
- Modify: `packages/client/src/components/overlays/LocalScanResultOverlay.tsx` (~line 19)

All changes follow the same pattern — replace inline `cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact` with `getPhysicalCargoTotal(cargo)`.

- [ ] **Step 1: Update `client.ts` auto-stop mining**

In `packages/client/src/network/client.ts` (~line 475):

Old:
```typescript
    const cargoTotal = (data.ore ?? 0) + (data.gas ?? 0) + (data.crystal ?? 0)
      + (data.slates ?? 0) + (data.artefact ?? 0);
```

New:
```typescript
    const cargoTotal = getPhysicalCargoTotal(data);
```

Add import: `import { getPhysicalCargoTotal } from '@void-sector/shared';`

- [ ] **Step 2: Update `CockpitLayout.tsx`**

In `packages/client/src/components/CockpitLayout.tsx` (~line 71):

Old:
```typescript
const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
```

New:
```typescript
const cargoTotal = getPhysicalCargoTotal(cargo);
```

Add import: `import { getPhysicalCargoTotal } from '@void-sector/shared';`

- [ ] **Step 3: Update `TradeScreen.tsx`**

In `packages/client/src/components/TradeScreen.tsx` (~line 111):

Same pattern. Replace inline sum with `getPhysicalCargoTotal(cargo)`. Add import.

- [ ] **Step 4: Update `MiningScreen.tsx`**

In `packages/client/src/components/MiningScreen.tsx` (~line 50):

Same pattern. Replace inline sum with `getPhysicalCargoTotal(cargo)`. Add import.

- [ ] **Step 5: Update `ProgramSelector.tsx`**

In `packages/client/src/components/ProgramSelector.tsx` (~line 26):

Same pattern. Replace inline sum with `getPhysicalCargoTotal(cargo)`. Add import.

- [ ] **Step 6: Update `LocalScanResultOverlay.tsx` — change to memory check**

In `packages/client/src/components/overlays/LocalScanResultOverlay.tsx` (~lines 19–22):

This overlay has a "SAVE TO SLATE" button that should check **memory** (not cargo):

Old:
```typescript
const cargoTotal = (cargo.ore ?? 0) + (cargo.gas ?? 0) + (cargo.crystal ?? 0)
  + (cargo.slates ?? 0) + (cargo.artefact ?? 0);
const cargoCap = ship?.stats?.cargoCap ?? 0;
const cargoFull = cargoCap > 0 && cargoTotal >= cargoCap;
```

New:
```typescript
const memory = ship?.stats?.memory ?? 2;
const memoryFull = cargo.slates >= memory;
```

Then use `memoryFull` instead of `cargoFull` for the SAVE TO SLATE button disabled state. If `cargoFull` is also used for non-slate purposes in this file, keep both variables but compute `cargoFull` using `getPhysicalCargoTotal`.

Add import: `import { getPhysicalCargoTotal } from '@void-sector/shared';`

- [ ] **Step 7: Update `MiningAutoStop.test.ts`**

In `packages/client/src/__tests__/MiningAutoStop.test.ts`:

The test uses a pure `shouldAutoStop` function. If it now needs to exclude slates from total, update accordingly. The test itself may not need changes since it tests a generic `(cargoTotal, cargoCap)` signature — the important thing is the caller passes the right total.

- [ ] **Step 8: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/client/src/network/client.ts packages/client/src/components/CockpitLayout.tsx packages/client/src/components/TradeScreen.tsx packages/client/src/components/MiningScreen.tsx packages/client/src/components/ProgramSelector.tsx packages/client/src/components/overlays/LocalScanResultOverlay.tsx packages/client/src/__tests__/MiningAutoStop.test.ts
git commit -m "refactor: replace inline cargoTotal with getPhysicalCargoTotal (#276)"
```

---

## Chunk 4: Client UI — SLATES Tab + Store

### Task 4: Add `selectedSlateId` to uiSlice

**Files:**
- Modify: `packages/client/src/state/uiSlice.ts`

- [ ] **Step 1: Add `selectedSlateId` state and setter**

In `packages/client/src/state/uiSlice.ts`:

Add to `UISlice` interface (after `acepHoveredModuleId`):

```typescript
  selectedSlateId: string | null;
  setSelectedSlateId: (id: string | null) => void;
```

Add to initial state (after `acepHoveredModuleId: null`):

```typescript
  selectedSlateId: null,
```

Add setter (after `setAcepHoveredModuleId`):

```typescript
  setSelectedSlateId: (id) => set({ selectedSlateId: id }),
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/state/uiSlice.ts
git commit -m "feat: add selectedSlateId to uiSlice (#276)"
```

### Task 5: Add SLATES tab to CargoScreen

**Files:**
- Modify: `packages/client/src/components/CargoScreen.tsx`

- [ ] **Step 1: Update tab type and imports**

Change tab state type:

Old:
```typescript
const [activeTab, setActiveTab] = useState<'resource' | 'module' | 'blueprint'>('resource');
```

New:
```typescript
const [activeTab, setActiveTab] = useState<'resource' | 'module' | 'blueprint' | 'slates'>('resource');
```

Add imports:

```typescript
import { getPhysicalCargoTotal } from '@void-sector/shared';
```

Add store selector:

```typescript
const selectedSlateId = useStore((s) => s.selectedSlateId);
const setSelectedSlateId = useStore((s) => s.setSelectedSlateId);
const memory = ship?.stats?.memory ?? 2;
```

Remove the local `selectedSlateId` state (line ~77) since it moves to uiSlice.

- [ ] **Step 2: Update cargo total calculation**

Old:
```typescript
const total = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
```

New:
```typescript
const total = getPhysicalCargoTotal(cargo);
```

- [ ] **Step 3: Remove "VESSEL:" label**

Remove line ~107:
```typescript
<div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>VESSEL: {ship?.name ?? '---'}</div>
```

- [ ] **Step 4: Add SLATES tab button**

After the BLUEPRINTS tab button, add:

```typescript
<button
  style={tabBtnStyle(activeTab === 'slates')}
  onClick={() => { setActiveTab('slates'); setSelectedSlateId(null); }}
>
  SLATES
</button>
```

- [ ] **Step 5: Remove slates from RESOURCES tab**

Remove the `CargoBar` for slates:
```typescript
<CargoBar label="SLATES" value={cargo.slates} max={cargoCap} />
```

Remove the entire slate listing section (lines ~195–267) from the resources tab — it moves to the SLATES tab.

- [ ] **Step 6: Add SLATES tab content**

Add new tab content block (inside the `activeTab === 'slates'` condition):

```typescript
{activeTab === 'slates' && (
  <div>
    <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
      MEMORY: {cargo.slates}/{memory}
      {cargo.slates > memory && (
        <span style={{ color: '#FF3333', marginLeft: 8 }}>OVER CAPACITY</span>
      )}
    </div>
    <div style={{
      height: 6,
      background: 'rgba(255,176,0,0.1)',
      marginBottom: 8,
      position: 'relative',
    }}>
      <div style={{
        height: '100%',
        width: `${Math.min(100, (cargo.slates / Math.max(1, memory)) * 100)}%`,
        background: cargo.slates > memory ? '#FF3333' : 'var(--color-primary)',
        transition: 'width 0.3s',
      }} />
    </div>

    {mySlates.length === 0 && (
      <div style={{ opacity: 0.4, fontSize: '0.75rem' }}>Keine Data Slates</div>
    )}

    {mySlates.map((slate: DataSlate) => (
      <div
        key={slate.id}
        style={{
          fontSize: '0.8rem',
          marginBottom: '6px',
          padding: '4px 6px',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          flexWrap: 'wrap',
          cursor: 'pointer',
          background: selectedSlateId === slate.id ? 'rgba(255,176,0,0.08)' : 'transparent',
          border: selectedSlateId === slate.id ? '1px solid rgba(255,176,0,0.2)' : '1px solid transparent',
        }}
        onClick={() => setSelectedSlateId(selectedSlateId === slate.id ? null : slate.id)}
      >
        <span style={{ opacity: 0.7 }}>
          [{slate.slateType === 'sector' ? 'S'
            : slate.slateType === 'area' ? 'A'
            : slate.slateType === 'scan' ? 'SC'
            : slate.slateType === 'jumpgate' ? 'JG'
            : 'C'}]
          {slate.slateType === 'custom' && slate.customData
            ? ` ${slate.customData.label}`
            : slate.slateType === 'scan'
              ? ` Scan Q${(slate.sectorData?.[0] as any)?.quadrantX ?? '?'}:${(slate.sectorData?.[0] as any)?.quadrantY ?? '?'} (${slate.sectorData?.[0]?.x ?? '?'},${slate.sectorData?.[0]?.y ?? '?'})`
              : slate.slateType === 'jumpgate'
                ? ` Gate (${(slate.sectorData?.[0] as any)?.sectorX ?? '?'},${(slate.sectorData?.[0] as any)?.sectorY ?? '?'})`
                : ` ${slate.sectorData?.length ?? 0} Sektoren`}
        </span>
        <button
          className="vs-btn"
          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
          onClick={(e) => { e.stopPropagation(); network.sendActivateSlate(slate.id); }}
        >
          {btn(UI.actions.ACTIVATE)}
        </button>
        <button
          className="vs-btn"
          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
          onClick={(e) => { e.stopPropagation(); network.sendNpcBuyback(slate.id); }}
        >
          {btn('NPC SELL')}
        </button>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 7: Clear selectedSlateId when switching away from SLATES tab or CARGO program**

Add a `useEffect` to clear selection:

```typescript
const activeProgram = useStore((s) => s.activeProgram);

useEffect(() => {
  if (activeProgram !== 'CARGO') {
    setSelectedSlateId(null);
  }
}, [activeProgram, setSelectedSlateId]);

useEffect(() => {
  if (activeTab !== 'slates') {
    setSelectedSlateId(null);
  }
}, [activeTab, setSelectedSlateId]);
```

- [ ] **Step 8: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass. Some CargoScreen tests may need mock updates for `memory` stat.

- [ ] **Step 9: Commit**

```bash
git add packages/client/src/components/CargoScreen.tsx
git commit -m "feat: add SLATES tab to CargoScreen with memory budget (#276)"
```

---

## Chunk 5: Detail Panel + SlateControls

### Task 6: Slate detail view in DetailPanel (Sec 3)

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx`

- [ ] **Step 1: Add slate detail rendering**

At the top of `DetailPanel`'s render function, before any existing content, add a conditional branch:

```typescript
const activeProgram = useStore((s) => s.activeProgram);
const selectedSlateId = useStore((s) => s.selectedSlateId);
const mySlates = useStore((s) => s.mySlates);

const selectedSlate = selectedSlateId
  ? mySlates.find((s: DataSlate) => s.id === selectedSlateId)
  : null;

if (activeProgram === 'CARGO' && selectedSlate) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '0.75rem',
      padding: '8px',
      height: '100%',
      overflowY: 'auto',
    }}>
      <div style={{ fontSize: '0.85rem', marginBottom: 8, letterSpacing: '0.1em' }}>
        DATA SLATE [{selectedSlate.slateType === 'sector' ? 'SEKTOR'
          : selectedSlate.slateType === 'area' ? 'GEBIET'
          : selectedSlate.slateType === 'scan' ? 'SCAN'
          : selectedSlate.slateType === 'jumpgate' ? 'JUMPGATE'
          : 'CUSTOM'}]
      </div>

      <div style={{ opacity: 0.5, fontSize: '0.65rem', marginBottom: 8 }}>
        Erstellt: {new Date(selectedSlate.createdAt).toLocaleDateString('de-DE')}
      </div>

      {/* Custom slate content */}
      {selectedSlate.slateType === 'custom' && selectedSlate.customData && (
        <div>
          <div style={{ marginBottom: 4 }}>Label: {selectedSlate.customData.label}</div>
          {selectedSlate.customData.notes && (
            <div style={{ opacity: 0.7, marginBottom: 4, whiteSpace: 'pre-wrap' }}>
              {selectedSlate.customData.notes}
            </div>
          )}
          {selectedSlate.customData.coordinates && selectedSlate.customData.coordinates.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              Koordinaten: {selectedSlate.customData.coordinates.map(c => `(${c.x},${c.y})`).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Jumpgate slate content */}
      {selectedSlate.slateType === 'jumpgate' && selectedSlate.sectorData?.[0] && (
        <div>
          <div>Gate-ID: {(selectedSlate.sectorData[0] as any).gateId}</div>
          <div>Position: ({(selectedSlate.sectorData[0] as any).sectorX}, {(selectedSlate.sectorData[0] as any).sectorY})</div>
          <div>Owner: {(selectedSlate.sectorData[0] as any).ownerName}</div>
        </div>
      )}

      {/* Sector/Area/Scan slate content — list of sectors */}
      {['sector', 'area', 'scan'].includes(selectedSlate.slateType) && selectedSlate.sectorData && (
        <div>
          {selectedSlate.sectorData.map((sec, i) => (
            <div key={i} style={{
              marginBottom: 6,
              padding: '4px 6px',
              border: '1px solid rgba(255,176,0,0.1)',
            }}>
              <div style={{ opacity: 0.5, fontSize: '0.65rem' }}>
                {(sec as any).quadrantX !== undefined
                  ? `Q${(sec as any).quadrantX}:${(sec as any).quadrantY} — `
                  : ''}
                ({sec.x}, {sec.y})
              </div>
              <div>Typ: {sec.type?.toUpperCase() ?? 'UNKNOWN'}</div>
              <div>Ore: {sec.ore} | Gas: {sec.gas} | Crystal: {sec.crystal}</div>
              {(sec as any).structures?.length > 0 && (
                <div style={{ opacity: 0.7 }}>Strukturen: {(sec as any).structures.join(', ')}</div>
              )}
              {(sec as any).wrecks?.length > 0 && (
                <div style={{ opacity: 0.7 }}>
                  Wracks: {(sec as any).wrecks.map((w: any) => `${w.playerName} (T${w.tier})`).join(', ')}
                </div>
              )}
              {(sec as any).scannedAtTick !== undefined && (
                <div style={{ opacity: 0.4, fontSize: '0.6rem' }}>
                  Scan-Tick: {(sec as any).scannedAtTick}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Add imports at the top:

```typescript
import type { DataSlate } from '@void-sector/shared';
```

- [ ] **Step 2: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx
git commit -m "feat: slate detail view in DetailPanel for CARGO program (#276)"
```

### Task 7: Update SlateControls for memory budget

**Files:**
- Modify: `packages/client/src/components/SlateControls.tsx`

- [ ] **Step 1: Replace cargo-cap with memory budget**

In `packages/client/src/components/SlateControls.tsx`:

Replace imports — add `getPhysicalCargoTotal`:

```typescript
import {
  SLATE_AP_COST_SECTOR,
  CUSTOM_SLATE_AP_COST,
  CUSTOM_SLATE_CREDIT_COST,
  CUSTOM_SLATE_MAX_NOTES_LENGTH,
  getPhysicalCargoTotal,
} from '@void-sector/shared';
```

Replace cargo calculations:

Old:
```typescript
  const cargoCap = ship?.stats?.cargoCap ?? 5;
  const total = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
```

New:
```typescript
  const memory = ship?.stats?.memory ?? 2;
  const memoryFull = cargo.slates >= memory;
```

Replace header display:

Old:
```typescript
<div style={{ opacity: 0.6, letterSpacing: '0.1em', marginBottom: 3 }}>── KARTEN ──</div>
```

New:
```typescript
<div style={{ opacity: 0.6, letterSpacing: '0.1em', marginBottom: 3 }}>
  ── KARTEN ── MEMORY: {cargo.slates}/{memory}
  {cargo.slates > memory && <span style={{ color: '#FF3333' }}> !</span>}
</div>
```

Replace all `disabled={total >= cargoCap}` with `disabled={memoryFull}` (3 occurrences on the SEKTOR, GEBIET, DISK buttons).

- [ ] **Step 2: Update type indicators**

In the `mySlates.map` section, update the type indicator to include SC and JG:

Old:
```typescript
[{slate.slateType === 'sector' ? 'S' : slate.slateType === 'area' ? 'A' : 'C'}]
```

New:
```typescript
[{slate.slateType === 'sector' ? 'S'
  : slate.slateType === 'area' ? 'A'
  : slate.slateType === 'scan' ? 'SC'
  : slate.slateType === 'jumpgate' ? 'JG'
  : 'C'}]
```

- [ ] **Step 3: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/SlateControls.tsx
git commit -m "feat: SlateControls uses memory budget + updated type indicators (#276)"
```

---

## Chunk 6: Final Verification

### Task 8: Full test run + shared build

- [ ] **Step 1: Build shared**

Run: `cd packages/shared && npm run build`

- [ ] **Step 2: Run all tests**

Run:
```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

Expected: All tests pass across all packages.

- [ ] **Step 3: Fix any failing tests**

If tests fail due to missing `memory` in mocked `ShipStats` objects, add `memory: 2` (or appropriate value) to those mocks.

- [ ] **Step 4: Final commit if any fixes**

```bash
git commit -m "fix: update test mocks for memory stat (#276)"
```
