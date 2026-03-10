# Ship UI Rework (#228) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `ShipStatusPanel` with ACEP progress bars, tabbed Cargo/Mining stats, click-to-rename ship name, and hyperdrive charge indicator.

**Architecture:** Full rewrite of `packages/client/src/components/ShipStatusPanel.tsx` (188 lines → ~280 lines). Add inline rename state. Pull ACEP XP from `ship.acepXp`, cargo from `store.cargo`, mining from `store.mining`, hyperdrive from `store.hyperdriveState`. Move `AcepPanel` display logic from `GameScreen.tsx` into the panel — the `AcepPanel` in GameScreen serves a different layout position; ShipStatusPanel gets its own compact ACEP bars. No backend changes needed.

**Tech Stack:** React, TypeScript, Zustand store, `packages/client/src/components/ShipStatusPanel.tsx`

---

### Task 1: Add click-to-rename ship name

**Files:**
- Modify: `packages/client/src/components/ShipStatusPanel.tsx`

**Step 1: Write the failing test**

Create or extend `packages/client/src/__tests__/ShipStatusPanel.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ShipStatusPanel } from '../components/ShipStatusPanel';
import { useStore } from '../state/store';

vi.mock('../state/store');
vi.mock('../network/client', () => ({
  network: { sendRenameShip: vi.fn() },
}));

const mockShip = {
  id: 'ship-1',
  name: 'VOID SCOUT I',
  hullType: 'scout',
  modules: [],
  stats: { hp: 50, cargoCap: 3, engineSpeed: 2, scannerLevel: 1, fuelMax: 80, jumpRange: 5 },
  acepXp: { ausbau: 5, intel: 10, kampf: 0, explorer: 20, total: 35 },
  acepEffects: { extraModuleSlots: 0, miningBonus: 0, scanRadiusBonus: 0, combatDamageBonus: 0, ancientDetection: false, helionDecoderEnabled: false },
};

describe('ShipStatusPanel', () => {
  beforeEach(() => {
    (useStore as any).mockImplementation((selector: any) => selector({
      ship: mockShip, fuel: { current: 60, max: 80 },
      cargo: { ore: 5, gas: 2, crystal: 1, slates: 0, artefact: 0 },
      mining: null, hyperdriveState: null,
      setActiveProgram: vi.fn(),
    }));
  });

  it('shows ship name and allows rename on click', async () => {
    render(<ShipStatusPanel />);
    expect(screen.getByText('VOID SCOUT I')).toBeInTheDocument();
    fireEvent.click(screen.getByText('VOID SCOUT I'));
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'NEW NAME' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const { network } = await import('../network/client');
    expect(network.sendRenameShip).toHaveBeenCalledWith('ship-1', 'NEW NAME');
  });

  it('shows ACEP bars', () => {
    render(<ShipStatusPanel />);
    expect(screen.getByText('AUSBAU')).toBeInTheDocument();
    expect(screen.getByText('EXPLORER')).toBeInTheDocument();
  });

  it('switches between CARGO and MINING tabs', () => {
    render(<ShipStatusPanel />);
    expect(screen.getByText('CARGO')).toBeInTheDocument();
    fireEvent.click(screen.getByText('MINING'));
    // mining tab shown (active is null → shows "INACTIVE")
    expect(screen.getByText(/INAKTIV|INACTIVE/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /e/claude/voidSector && npm run test -w packages/client -- --reporter=verbose ShipStatusPanel 2>&1 | head -30
```

Expected: FAIL (no rename, no tabs, no ACEP)

**Step 3: Rewrite ShipStatusPanel.tsx**

Replace the full content of `packages/client/src/components/ShipStatusPanel.tsx`:

```typescript
import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { HULLS } from '@void-sector/shared';

const ACEP_PATHS = [
  { key: 'ausbau',   label: 'AUSBAU',   color: '#ffaa00', max: 50 },
  { key: 'intel',    label: 'INTEL',    color: '#00ffcc', max: 50 },
  { key: 'kampf',    label: 'KAMPF',    color: '#ff4444', max: 50 },
  { key: 'explorer', label: 'EXPLORER', color: '#8888ff', max: 50 },
] as const;

const mono = { fontFamily: 'var(--font-mono)', fontSize: '0.55rem' };
const dim  = { ...mono, color: 'var(--color-dim)' };
const pri  = { ...mono, fontSize: '0.6rem', color: 'var(--color-primary)' };
const row  = { display: 'flex', justifyContent: 'space-between', padding: '1px 0' };
const hdr  = { ...dim, borderBottom: '1px solid var(--color-dim)', paddingBottom: 2, marginTop: 8, marginBottom: 4, letterSpacing: '0.15em' };
const linkBtn = { background: 'transparent', border: 'none', color: 'var(--color-primary)', ...mono, cursor: 'pointer', textDecoration: 'underline', padding: '2px 0' };

type Tab = 'cargo' | 'mining' | 'stats';

export function ShipStatusPanel() {
  const ship             = useStore((s) => s.ship);
  const fuel             = useStore((s) => s.fuel);
  const cargo            = useStore((s) => s.cargo);
  const mining           = useStore((s) => s.mining);
  const hyperdriveState  = useStore((s) => s.hyperdriveState);
  const setActiveProgram = useStore((s) => s.setActiveProgram);

  const [tab, setTab]         = useState<Tab>('cargo');
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState('');

  if (!ship) {
    return <div style={{ padding: '4px 8px', ...dim, opacity: 0.5 }}>NO SHIP DATA</div>;
  }

  const hull = HULLS[ship.hullType];
  const xp   = ship.acepXp;

  function startRename() {
    setNameInput(ship!.name);
    setRenaming(true);
  }
  function commitRename() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== ship!.name) {
      network.sendRenameShip(ship!.id, trimmed);
    }
    setRenaming(false);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  commitRename();
    if (e.key === 'Escape') setRenaming(false);
  }

  const hasHyperdrive = hyperdriveState && hyperdriveState.maxCharge > 0;
  const chargePercent = hasHyperdrive
    ? Math.round((hyperdriveState!.charge / hyperdriveState!.maxCharge) * 100)
    : 0;

  return (
    <div style={{ padding: '4px 8px', ...mono, color: 'var(--color-primary)' }}>

      {/* Ship name — click to rename */}
      {renaming ? (
        <input
          autoFocus
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={commitRename}
          onKeyDown={onKeyDown}
          style={{ ...mono, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', width: '100%', marginBottom: 2 }}
        />
      ) : (
        <div
          onClick={startRename}
          title="Klicken zum Umbenennen"
          style={{ fontSize: '0.6rem', letterSpacing: '0.15em', borderBottom: '1px solid var(--color-dim)', paddingBottom: 2, marginBottom: 2, cursor: 'text' }}
        >
          {ship.name}
        </div>
      )}
      <div style={{ ...dim, marginBottom: 6 }}>{hull?.name ?? ship.hullType.toUpperCase()}</div>

      {/* ACEP bars */}
      {xp && (
        <>
          <div style={hdr}>ACEP</div>
          {ACEP_PATHS.map(({ key, label, color, max }) => {
            const val = xp[key] ?? 0;
            const pct = Math.min(100, (val / max) * 100);
            return (
              <div key={key} style={{ marginBottom: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...dim }}>
                  <span style={{ color }}>{label}</span>
                  <span>{val}/{max}</span>
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
                </div>
              </div>
            );
          })}
          <div style={{ ...dim, marginTop: 2 }}>BUDGET: {xp.total ?? 0}/100</div>
        </>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {(['cargo', 'mining', 'stats'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...linkBtn,
            color: tab === t ? 'var(--color-primary)' : 'var(--color-dim)',
            fontWeight: tab === t ? 'bold' : 'normal',
          }}>
            [{t.toUpperCase()}]
          </button>
        ))}
      </div>

      {/* Cargo tab */}
      {tab === 'cargo' && cargo && (
        <div style={{ marginTop: 4 }}>
          {[
            ['ORE',      cargo.ore],
            ['GAS',      cargo.gas],
            ['CRYSTAL',  cargo.crystal],
            ['ARTEFAKT', cargo.artefact],
          ].map(([label, val]) => (
            <div key={label as string} style={row}>
              <span style={dim}>{label as string}</span>
              <span style={pri}>{val as number}</span>
            </div>
          ))}
          <div style={row}>
            <span style={dim}>KAPAZITÄT</span>
            <span style={pri}>{ship.stats.cargoCap}</span>
          </div>
        </div>
      )}

      {/* Mining tab */}
      {tab === 'mining' && (
        <div style={{ marginTop: 4 }}>
          {mining?.active ? (
            <>
              <div style={row}><span style={dim}>RESSOURCE</span><span style={pri}>{mining.resource?.toUpperCase() ?? '—'}</span></div>
              <div style={row}><span style={dim}>RATE</span><span style={pri}>{mining.rate}/tick</span></div>
              <div style={row}><span style={dim}>YIELD</span><span style={pri}>{mining.sectorYield}</span></div>
            </>
          ) : (
            <div style={{ ...dim, marginTop: 4, opacity: 0.5 }}>INAKTIV</div>
          )}
        </div>
      )}

      {/* Stats tab */}
      {tab === 'stats' && (
        <div style={{ marginTop: 4 }}>
          {[
            ['HP',          ship.stats.hp],
            ['SPEED',       ship.stats.engineSpeed],
            ['SCANNER',     ship.stats.scannerLevel],
            ['JUMP RANGE',  ship.stats.jumpRange],
            ['FUEL',        fuel ? `${fuel.current}/${fuel.max}` : `—/${ship.stats.fuelMax}`],
          ].map(([label, val]) => (
            <div key={label as string} style={row}>
              <span style={dim}>{label as string}</span>
              <span style={pri}>{val as string | number}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hyperdrive charge */}
      {hasHyperdrive && (
        <>
          <div style={hdr}>HYPERDRIVE</div>
          <div style={row}>
            <span style={dim}>LADUNG</span>
            <span style={pri}>{chargePercent}%</span>
          </div>
          <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', marginTop: 2 }}>
            <div style={{ height: '100%', width: `${chargePercent}%`, background: '#8888ff', transition: 'width 0.3s' }} />
          </div>
        </>
      )}

      {/* Quick nav */}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, borderTop: '1px solid var(--color-dim)', paddingTop: 4 }}>
        <button style={linkBtn} onClick={() => setActiveProgram('MODULES')}>[MODULES]</button>
        <button style={linkBtn} onClick={() => setActiveProgram('HANGAR')}>[HANGAR]</button>
      </div>
    </div>
  );
}
```

**Step 4: Run the tests**

```bash
cd /e/claude/voidSector && npm run test -w packages/client -- --reporter=verbose ShipStatusPanel 2>&1 | head -40
```

Expected: all 3 tests PASS

**Step 5: Check TypeScript**

```bash
cd /e/claude/voidSector && npm run typecheck -w packages/client 2>&1 | tail -10
```

Expected: no errors

**Step 6: Commit**

```bash
cd /e/claude/voidSector
git add packages/client/src/components/ShipStatusPanel.tsx packages/client/src/__tests__/ShipStatusPanel.test.tsx
git commit -m "feat(#228): rework ShipStatusPanel — ACEP bars, cargo/mining/stats tabs, rename, hyperdrive"
```
