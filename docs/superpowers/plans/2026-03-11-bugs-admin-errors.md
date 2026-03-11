# Bug-Sprint + Admin-Fehlermonitoring — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sechs offene Issues beheben: Jettison-UX (#240), Partial-Sell-Feedback (#237), Mining-Rate-Bug (#238), Mining+Cargo-UX (#232), Quest-Filter-Bug (#233), Admin-Fehlermonitoring (#252).

**Architecture:** Bottom-up — Bug-Fixes zuerst (server, dann client), dann das neue Admin-Feature (Migration → Transport → API → UI). Alle Tasks TDD, frequent commits.

**Tech Stack:** TypeScript · Vitest · React · PostgreSQL · ioredis · pino

**Spec:** `docs/superpowers/specs/2026-03-11-bugs-admin-errors-design.md`

**WICHTIG vor Start:**
```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run   # alle grün halten
cd /home/manuel/claude/voidSector/packages/client && npx vitest run   # alle grün halten
```

---

## Übersicht: Tasks

| # | Task | Paket | Issue |
|---|------|-------|-------|
| 1 | Mining-Rate-Bug fix | server | #238 |
| 2 | Jettison Single-Click | client | #240 |
| 3 | Partial-Sell-Feedback | client | #237 |
| 4 | Mining+Cargo UX | client | #232 |
| 5 | Quest-Filter nach Annahme | client | #233 |
| 6 | DB-Migration 055 — error_logs | server | #252 |
| 7 | captureError Transport | server | #252 |
| 8 | Admin-API — /errors Endpoints | server | #252 |
| 9 | Admin-Tab ERRORS | server/admin | #252 |

---

## Chunk 1: Server Bug-Fixes + Client Bug-Fixes

---

### Task 1: Mining-Rate-Bug fix (#238)

**Files:**
- Modify: `packages/server/src/rooms/services/MiningService.ts` (Zeile ~70)
- Test: `packages/server/src/__tests__/miningRate.test.ts` (neu)

**Kontext:** `MiningService.handleMine` setzt `result.state!.rate *= bonuses.miningRateMultiplier` (nur ACEP+Fraktions-Bonus). Der Ship-Modul-Bonus `ship.miningBonus` wird nicht einbezogen. Das `ship`-Objekt wird bereits vor `validateMine` via `this.ctx.getShipForClient(client.sessionId)` abgerufen.

- [ ] **Step 1: Failing test schreiben**

Datei `packages/server/src/__tests__/miningRate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

vi.mock('../engine/inventoryService.js', () => ({
  getResourceTotal: vi.fn().mockResolvedValue(0),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
  addToInventory: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../db/queries.js', () => ({
  getSector: vi.fn().mockResolvedValue({ resources: { ore: 50, gas: 0, crystal: 0 }, contents: [], type: 'asteroid_field', environment: 'normal' }),
}));
vi.mock('../engine/commands.js', () => ({
  validateMine: vi.fn().mockReturnValue({
    valid: true,
    state: { active: true, resource: 'ore', sectorX: 1, sectorY: 1, startedAt: Date.now(), rate: 1, sectorYield: 50 },
  }),
}));
vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getMiningState: vi.fn().mockResolvedValue({ active: false }),
  saveMiningState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../engine/acepXpService.js', () => ({
  addAcepXpForPlayer: vi.fn().mockResolvedValue(undefined),
}));

import { MiningService } from '../rooms/services/MiningService.js';

function makeClient(userId = 'u1'): Client {
  return {
    sessionId: 's1',
    auth: { userId, username: 'TestPilot', role: 'player' },
    send: vi.fn(),
  } as unknown as Client;
}

describe('MiningService mining rate includes miningBonus', () => {
  it('rate includes ship miningBonus (e.g. 0.5 from mining_mk3)', async () => {
    const ctx = {
      checkRate: vi.fn().mockReturnValue(true),
      _px: vi.fn().mockReturnValue(1),
      _py: vi.fn().mockReturnValue(1),
      _pst: vi.fn().mockReturnValue('asteroid_field'),
      getShipForClient: vi.fn().mockReturnValue({ cargoCap: 50, miningBonus: 0.5 }),
      getPlayerBonuses: vi.fn().mockResolvedValue({ miningRateMultiplier: 1 }),
    } as any;

    const svc = new MiningService(ctx);
    const client = makeClient();
    const { saveMiningState } = await import('../rooms/services/RedisAPStore.js');

    await svc.handleMine(client, { resource: 'ore' });

    // rate should be 1 * (1 + 0.5) * 1 = 1.5
    const savedState = vi.mocked(saveMiningState).mock.calls[0]?.[1];
    expect(savedState?.rate).toBeCloseTo(1.5);
  });

  it('rate is 1 when miningBonus is 0 (no module)', async () => {
    const ctx = {
      checkRate: vi.fn().mockReturnValue(true),
      _px: vi.fn().mockReturnValue(1),
      _py: vi.fn().mockReturnValue(1),
      _pst: vi.fn().mockReturnValue('asteroid_field'),
      getShipForClient: vi.fn().mockReturnValue({ cargoCap: 50, miningBonus: 0 }),
      getPlayerBonuses: vi.fn().mockResolvedValue({ miningRateMultiplier: 1 }),
    } as any;

    const svc = new MiningService(ctx);
    const client = makeClient();
    const { saveMiningState } = await import('../rooms/services/RedisAPStore.js');

    await svc.handleMine(client, { resource: 'ore' });

    const savedState = vi.mocked(saveMiningState).mock.calls[0]?.[1];
    expect(savedState?.rate).toBeCloseTo(1.0);
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss FAIL**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run src/__tests__/miningRate.test.ts
```
Erwartet: `FAIL — rate 1.0, expected 1.5`

- [ ] **Step 3: Fix implementieren**

In `packages/server/src/rooms/services/MiningService.ts`, Import ergänzen falls nicht vorhanden:
```typescript
import { MINING_RATE_PER_SECOND } from '@void-sector/shared';
```

Zeile ~70, **ersetzen**:
```typescript
result.state!.rate *= bonuses.miningRateMultiplier;
```
**durch:**
```typescript
result.state!.rate = MINING_RATE_PER_SECOND
  * (1 + (ship.miningBonus ?? 0))
  * bonuses.miningRateMultiplier;
```
`ship` ist bereits weiter oben in derselben Funktion deklariert (`const ship = this.ctx.getShipForClient(...)`).

- [ ] **Step 4: Test laufen lassen — muss PASS**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run src/__tests__/miningRate.test.ts
```

- [ ] **Step 5: Alle Server-Tests grün**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/rooms/services/MiningService.ts packages/server/src/__tests__/miningRate.test.ts
git commit -m "fix(mining): apply ship miningBonus to mining rate, closes #238"
```

---

### Task 2: Jettison Single-Click (#240)

**Files:**
- Modify: `packages/client/src/components/CargoScreen.tsx`
- Test: `packages/client/src/__tests__/CargoJettison.test.tsx` (neu)

**Kontext:** `useConfirm`-Hook entfernen. Zwei Codepfade beachten: (1) `RESOURCE_TYPES.map`-Loop, (2) eigenständiger `artefact`-Button. Ersatz: `jettisoning`-State (string | null) für 1s disabled nach Klick.

- [ ] **Step 1: Failing test schreiben**

Datei `packages/client/src/__tests__/CargoJettison.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CargoScreen } from '../components/CargoScreen';

vi.mock('../network/client', () => ({
  network: {
    sendJettison: vi.fn(),
    requestMySlates: vi.fn(),
    requestInventory: vi.fn(),
  },
}));

vi.mock('../state/store', () => ({
  useStore: vi.fn((selector) =>
    selector({
      cargo: { ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0,
        artefact_drive: 0, artefact_cargo: 0, artefact_scanner: 0,
        artefact_armor: 0, artefact_weapon: 0, artefact_shield: 0,
        artefact_defense: 0, artefact_special: 0, artefact_mining: 0 },
      ship: { name: 'Scout', stats: { cargoCap: 50 } },
      mySlates: [],
      inventory: [],
      credits: 100,
      alienCredits: 0,
      setActiveProgram: vi.fn(),
    })
  ),
}));

import { network } from '../network/client';

describe('CargoScreen jettison single-click', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls sendJettison on single click when cargo > 0', () => {
    render(<CargoScreen />);
    const btn = screen.getByRole('button', { name: /JETTISON ORE/i });
    fireEvent.click(btn);
    expect(network.sendJettison).toHaveBeenCalledWith('ore');
  });

  it('does NOT show SURE? after click (no two-click confirm)', () => {
    render(<CargoScreen />);
    const btn = screen.getByRole('button', { name: /JETTISON ORE/i });
    fireEvent.click(btn);
    expect(screen.queryByText(/SURE/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss FAIL**

```bash
cd /home/manuel/claude/voidSector/packages/client && npx vitest run src/__tests__/CargoJettison.test.tsx
```

- [ ] **Step 3: Fix in CargoScreen.tsx**

1. Import von `useConfirm` entfernen
2. `const { confirm, isArmed } = useConfirm()` entfernen
3. Neuen State + Handler hinzufügen (nach den bestehenden `useState`-Aufrufen):

```typescript
const [jettisoning, setJettisoning] = useState<string | null>(null);

const doJettison = (resource: string) => {
  if (jettisoning) return;
  setJettisoning(resource);
  network.sendJettison(resource);
  setTimeout(() => setJettisoning(null), 1000);
};
```

4. Im `RESOURCE_TYPES.map`-Block ersetzen:
```tsx
// ALT:
disabled={cargo[res] <= 0}
onClick={() => confirm(key, () => network.sendJettison(res))}
style={isArmed(key) ? { borderColor: '#ff4444', color: '#ff4444' } : undefined}
>
{isArmed(key) ? btnDisabled(`JETTISON ${res.toUpperCase()}`, 'SURE?') : btn(`JETTISON ${res.toUpperCase()}`)}

// NEU:
disabled={cargo[res] <= 0 || jettisoning === res}
onClick={() => doJettison(res)}
>
{btn(`JETTISON ${res.toUpperCase()}`)}
```

5. Eigenständigen `artefact`-Button ersetzen:
```tsx
// ALT:
disabled={cargo.artefact <= 0}
onClick={() => confirm('jettison-artefact', () => network.sendJettison('artefact'))}
style={isArmed('jettison-artefact') ? ... : undefined}
>
{isArmed('jettison-artefact') ? btnDisabled('JETTISON ARTEFACT', 'SURE?') : btn('JETTISON ARTEFACT')}

// NEU:
disabled={cargo.artefact <= 0 || jettisoning === 'artefact'}
onClick={() => doJettison('artefact')}
>
{btn('JETTISON ARTEFACT')}
```

- [ ] **Step 4: Test laufen lassen — muss PASS**

```bash
cd /home/manuel/claude/voidSector/packages/client && npx vitest run src/__tests__/CargoJettison.test.tsx
```

- [ ] **Step 5: Alle Client-Tests grün**

```bash
cd /home/manuel/claude/voidSector/packages/client && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/CargoScreen.tsx packages/client/src/__tests__/CargoJettison.test.tsx
git commit -m "fix(cargo): single-click jettison, remove two-click confirm, closes #240"
```

---

### Task 3: Partial-Sell-Feedback (#237)

**Files:**
- Modify: `packages/client/src/components/TradeScreen.tsx`

**Kontext:** `tradeMessage` wird bereits gesetzt und angezeigt, aber mit zu unauffälligem Styling. Verbesserung: amber-Border, prominente Darstellung.

- [ ] **Step 1: Test schreiben**

`packages/client/src/__tests__/TradeScreenPartial.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TradeScreen } from '../components/TradeScreen';

vi.mock('../network/client', () => ({
  network: { sendNpcTrade: vi.fn(), requestNpcStation: vi.fn(), requestKontorStatus: vi.fn() },
}));
vi.mock('../state/store', () => ({
  useStore: vi.fn((selector) =>
    selector({
      cargo: { ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      storage: { ore: 0, gas: 0, crystal: 0 },
      currentSector: { type: 'station' },
      ship: { stats: { cargoCap: 50 } },
      credits: 100,
      npcStationData: { items: [] },
      tradeMessage: 'Nur 2x verkauft — Station ist fast voll',
      kontorStatus: null,
      position: { x: 5, y: 5 },
      setActiveProgram: vi.fn(),
      alienCredits: 0,
      factoryState: null,
    })
  ),
}));

describe('TradeScreen partial sell feedback', () => {
  it('shows tradeMessage when set', () => {
    render(<TradeScreen />);
    expect(screen.getByText(/Nur 2x verkauft/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Test laufen lassen**

```bash
cd /home/manuel/claude/voidSector/packages/client && npx vitest run src/__tests__/TradeScreenPartial.test.tsx
```
Falls PASS → Message existiert bereits, weiter mit Styling-Verbesserung.

- [ ] **Step 3: Styling in TradeScreen.tsx verbessern**

In `packages/client/src/components/TradeScreen.tsx`, die bestehende `tradeMessage`-Anzeige (ca. Zeile 176) auf:

```tsx
{tab === 'npc' && tradeMessage && (
  <div style={{
    color: '#FFB000',
    background: 'rgba(255,176,0,0.08)',
    border: '1px solid rgba(255,176,0,0.4)',
    padding: '4px 8px',
    fontSize: '0.8rem',
    marginBottom: '8px',
    fontFamily: 'monospace',
  }}>
    {tradeMessage}
  </div>
)}
```

- [ ] **Step 4: Alle Client-Tests grün**

```bash
cd /home/manuel/claude/voidSector/packages/client && npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/TradeScreen.tsx packages/client/src/__tests__/TradeScreenPartial.test.tsx
git commit -m "fix(trade): improve partial-sell feedback visibility, closes #237"
```

---

### Task 4: Mining+Cargo UX (#232)

**Files:**
- Modify: `packages/client/src/components/MiningScreen.tsx`
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/client/src/components/MiningDetailPanel.tsx`

- [ ] **Step 1: Test für Auto-Stop-Logik**

`packages/client/src/__tests__/MiningAutoStop.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Mining auto-stop logic', () => {
  const shouldAutoStop = (miningActive: boolean, cargoTotal: number, cargoCap: number) =>
    miningActive && cargoTotal >= cargoCap;

  it('stops when cargo full and mining active', () => {
    expect(shouldAutoStop(true, 50, 50)).toBe(true);
  });
  it('does not stop when cargo not full', () => {
    expect(shouldAutoStop(true, 49, 50)).toBe(false);
  });
  it('does not stop when not mining', () => {
    expect(shouldAutoStop(false, 50, 50)).toBe(false);
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss PASS** (reine Logik)

```bash
cd /home/manuel/claude/voidSector/packages/client && npx vitest run src/__tests__/MiningAutoStop.test.ts
```

- [ ] **Step 3: Auto-Stop in client.ts**

In `packages/client/src/network/client.ts`, im `cargoUpdate`-Handler (~Zeile 459) nach `setCargo`:

```typescript
room.onMessage('cargoUpdate', (data: CargoState) => {
  useStore.getState().setCargo(data);
  // Auto-stop mining when cargo is full
  const state = useStore.getState();
  if (state.mining?.active && state.ship) {
    const cargoTotal = (data.ore ?? 0) + (data.gas ?? 0) + (data.crystal ?? 0)
      + (data.slates ?? 0) + (data.artefact ?? 0);
    const cargoCap = state.ship.stats?.cargoCap ?? 0;
    if (cargoCap > 0 && cargoTotal >= cargoCap) {
      this.sendStopMine();
    }
  }
});
```

- [ ] **Step 4: Cargo-Anzeige in MiningScreen.tsx verbessern**

In `packages/client/src/components/MiningScreen.tsx`, nach der bestehenden `cargoFull`-Berechnung (ca. Zeile 51):

```typescript
const cargoPercent = cargoCap > 0 ? cargoTotal / cargoCap : 0;
const cargoBarColor = cargoPercent >= 1 ? '#ff4444' : cargoPercent >= 0.8 ? '#FFB000' : '#4a9';
```

Die plaintext-Zeile `CARGO: {cargoTotal}/{cargoCap}` (ca. Zeile 121) ersetzen durch:

```tsx
<div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
  <span style={{ color: cargoBarColor }}>
    CARGO: {cargoTotal}/{cargoCap} ({Math.round(cargoPercent * 100)}%)
  </span>
  {' — '}ORE:{cargo.ore} GAS:{cargo.gas} CRYSTAL:{cargo.crystal}
</div>
```

- [ ] **Step 5: Link zu MINING in MiningDetailPanel.tsx**

In `packages/client/src/components/MiningDetailPanel.tsx` lesen, dann am Ende des Panels (wenn Sektor Ressourcen hat) einen Button hinzufügen:

```typescript
const setActiveProgram = useStore((s) => s.setActiveProgram);
// ...
{(resources.ore > 0 || resources.gas > 0 || resources.crystal > 0) && !mining?.active && (
  <button
    className="vs-btn"
    style={{ fontSize: '0.75rem', marginTop: '8px' }}
    onClick={() => setActiveProgram('MINING')}
  >
    {btn('MINING ÖFFNEN')}
  </button>
)}
```

- [ ] **Step 6: Alle Client-Tests grün**

```bash
cd /home/manuel/claude/voidSector/packages/client && npx vitest run
```

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/components/MiningScreen.tsx packages/client/src/network/client.ts packages/client/src/components/MiningDetailPanel.tsx packages/client/src/__tests__/MiningAutoStop.test.ts
git commit -m "fix(mining): auto-stop when cargo full, colored cargo bar, detail→mining link, closes #232"
```

---

### Task 5: Quest-Filter nach Annahme (#233)

**Files:**
- Modify: `packages/client/src/components/QuestsScreen.tsx`
- Test: `packages/client/src/__tests__/QuestAcceptFilter.test.tsx` (neu)

**Kontext:** `availableQuests` (lokaler React-State) wird nicht gefiltert wenn eine Quest angenommen wird. Fix: `useEffect` auf `activeQuests` aus Store filtert `availableQuests` nach `templateId`. Server-seitig filtert `getAcceptedQuestTemplateIds` bereits korrekt — kein Server-Change nötig.

- [ ] **Step 1: Failing test schreiben**

`packages/client/src/__tests__/QuestAcceptFilter.test.tsx`:

```typescript
import { describe, it, expect, vi, act } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../network/client', () => ({
  network: {
    requestActiveQuests: vi.fn(),
    requestReputation: vi.fn(),
  },
}));

let mockActiveQuests: any[] = [];
vi.mock('../state/store', () => ({
  useStore: vi.fn((selector: any) =>
    selector({
      activeQuests: mockActiveQuests,
      currentSector: { type: 'station', x: 5, y: 5 },
      position: { x: 5, y: 5 },
      alienCredits: 0,
    })
  ),
}));

import { QuestsScreen } from '../components/QuestsScreen';

describe('QuestsScreen quest filter after accept', () => {
  it('removes accepted quest templateId from availableQuests', async () => {
    mockActiveQuests = [];
    const { rerender } = render(<QuestsScreen />);

    // Populate available quests via event
    act(() => {
      window.dispatchEvent(new CustomEvent('stationNpcsResult', {
        detail: {
          npcs: [],
          quests: [
            { templateId: 'tpl-1', title: 'Quest Alpha', description: '', objectives: [], rewards: {} },
            { templateId: 'tpl-2', title: 'Quest Beta', description: '', objectives: [], rewards: {} },
          ],
        },
      }));
    });

    // Simulate quest acceptance by updating activeQuests
    mockActiveQuests = [{ id: 'q1', templateId: 'tpl-1', title: 'Quest Alpha', status: 'active', objectives: [], rewards: {} }];
    const { useStore } = await import('../state/store');
    vi.mocked(useStore).mockImplementation((selector: any) => selector({ activeQuests: mockActiveQuests, currentSector: { type: 'station' }, position: { x: 5, y: 5 }, alienCredits: 0 }));
    rerender(<QuestsScreen />);

    expect(screen.queryByText('Quest Alpha')).toBeNull();
    expect(screen.getByText('Quest Beta')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss FAIL**

```bash
cd /home/manuel/claude/voidSector/packages/client && npx vitest run src/__tests__/QuestAcceptFilter.test.tsx
```

- [ ] **Step 3: Fix in QuestsScreen.tsx**

`activeQuests` aus dem Store lesen (falls nicht vorhanden):
```typescript
const activeQuests = useStore((s) => s.activeQuests);
```

Neuen `useEffect` nach dem bestehenden `stationNpcsResult`-Handler hinzufügen:
```typescript
useEffect(() => {
  if (activeQuests.length === 0) return;
  const acceptedIds = new Set(activeQuests.map((q) => q.templateId).filter(Boolean));
  setAvailableQuests((prev) => prev.filter((q) => !acceptedIds.has(q.templateId)));
}, [activeQuests]);
```

- [ ] **Step 4: Test laufen lassen — muss PASS**

```bash
cd /home/manuel/claude/voidSector/packages/client && npx vitest run src/__tests__/QuestAcceptFilter.test.tsx
```

- [ ] **Step 5: Alle Client-Tests grün**

```bash
cd /home/manuel/claude/voidSector/packages/client && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/QuestsScreen.tsx packages/client/src/__tests__/QuestAcceptFilter.test.tsx
git commit -m "fix(quests): remove accepted quest from available list, closes #233"
```

---

## Chunk 2: Admin-Fehlermonitoring (#252)

---

### Task 6: DB-Migration 055 + adminQueries

**Files:**
- Create: `packages/server/src/db/migrations/055_error_logs.sql`
- Modify: `packages/server/src/db/adminQueries.ts`
- Test: `packages/server/src/__tests__/adminErrorQueries.test.ts` (neu)

**Vorbedingung:** Aktuelle höchste Migration prüfen:
```bash
ls /home/manuel/claude/voidSector/packages/server/src/db/migrations/ | sort | tail -3
```
Erwartet: `054_combat_log.sql` als höchste. Falls höher → Nummer anpassen.

- [ ] **Step 1: Migration erstellen**

`packages/server/src/db/migrations/055_error_logs.sql`:
```sql
-- 055_error_logs.sql
CREATE TABLE IF NOT EXISTS error_logs (
  id            SERIAL PRIMARY KEY,
  fingerprint   VARCHAR(64) UNIQUE NOT NULL,
  message       TEXT NOT NULL,
  location      TEXT,
  stack         TEXT,
  count         INTEGER NOT NULL DEFAULT 1,
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        VARCHAR(16) NOT NULL DEFAULT 'new',
  github_issue_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_error_logs_status ON error_logs(status);
CREATE INDEX IF NOT EXISTS idx_error_logs_last_seen ON error_logs(last_seen DESC);
```

- [ ] **Step 2: Queries in adminQueries.ts ergänzen**

Den korrekten `query`-Import in `adminQueries.ts` prüfen (oben in der Datei). Am Ende der Datei ergänzen:

```typescript
export interface ErrorLog {
  id: number;
  fingerprint: string;
  message: string;
  location: string | null;
  stack: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
  status: 'new' | 'ignored' | 'resolved';
  github_issue_url: string | null;
}

export async function upsertErrorLog(
  fingerprint: string,
  message: string,
  location: string | null,
  stack: string | null,
): Promise<void> {
  await query(
    `INSERT INTO error_logs (fingerprint, message, location, stack)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (fingerprint)
     DO UPDATE SET count = error_logs.count + 1, last_seen = NOW()`,
    [fingerprint, message, location, stack],
  );
}

export async function getErrorLogs(status?: string): Promise<ErrorLog[]> {
  const filterByStatus = status && status !== 'all';
  const res = await query<ErrorLog>(
    filterByStatus
      ? `SELECT * FROM error_logs WHERE status = $1 ORDER BY last_seen DESC LIMIT 200`
      : `SELECT * FROM error_logs ORDER BY last_seen DESC LIMIT 200`,
    filterByStatus ? [status] : [],
  );
  return res.rows;
}

export async function updateErrorLogStatus(
  id: number,
  status: 'new' | 'ignored' | 'resolved',
): Promise<boolean> {
  const res = await query(
    `UPDATE error_logs SET status = $1 WHERE id = $2 RETURNING id`,
    [status, id],
  );
  return res.rows.length > 0;
}

export async function deleteErrorLog(id: number): Promise<boolean> {
  const res = await query(
    `DELETE FROM error_logs WHERE id = $1 RETURNING id`,
    [id],
  );
  return res.rows.length > 0;
}
```

- [ ] **Step 3: Failing test schreiben**

`packages/server/src/__tests__/adminErrorQueries.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../db/pool.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

describe('adminQueries error_logs functions', () => {
  it('upsertErrorLog is a function', async () => {
    const { upsertErrorLog } = await import('../db/adminQueries.js');
    expect(typeof upsertErrorLog).toBe('function');
  });

  it('getErrorLogs is a function', async () => {
    const { getErrorLogs } = await import('../db/adminQueries.js');
    expect(typeof getErrorLogs).toBe('function');
  });

  it('updateErrorLogStatus is a function', async () => {
    const { updateErrorLogStatus } = await import('../db/adminQueries.js');
    expect(typeof updateErrorLogStatus).toBe('function');
  });

  it('deleteErrorLog is a function', async () => {
    const { deleteErrorLog } = await import('../db/adminQueries.js');
    expect(typeof deleteErrorLog).toBe('function');
  });
});
```

**Hinweis:** Falls `adminQueries.ts` den `query`-Helper anders importiert (z.B. `from '../db/queries.js'` oder `from './pool.js'`), den Mock-Pfad entsprechend anpassen. Bestehende Imports in `adminQueries.ts` prüfen.

- [ ] **Step 4: Test laufen lassen — muss PASS**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run src/__tests__/adminErrorQueries.test.ts
```

- [ ] **Step 5: Alle Server-Tests grün**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/db/migrations/055_error_logs.sql packages/server/src/db/adminQueries.ts packages/server/src/__tests__/adminErrorQueries.test.ts
git commit -m "feat(admin): migration 055 error_logs table + DB queries, refs #252"
```

---

### Task 7: captureError Transport

**Files:**
- Create: `packages/server/src/utils/errorLogTransport.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Test: `packages/server/src/__tests__/captureError.test.ts` (neu)

- [ ] **Step 1: Failing test schreiben**

`packages/server/src/__tests__/captureError.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpsert = vi.fn().mockResolvedValue(undefined);
vi.mock('../db/adminQueries.js', () => ({
  upsertErrorLog: mockUpsert,
}));

import { captureError } from '../utils/errorLogTransport.js';

describe('captureError', () => {
  beforeEach(() => mockUpsert.mockClear());

  it('calls upsertErrorLog with 64-char fingerprint', async () => {
    const err = new Error('test error');
    err.stack = 'Error: test error\n    at handleJump (src/rooms/SectorRoom.ts:123:5)\n    at node_modules/colyseus/Room.js:45:10';
    await captureError(err, 'handleJump');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [fingerprint, message, location] = mockUpsert.mock.calls[0];
    expect(fingerprint).toHaveLength(64);
    expect(message).toBe('test error');
    expect(location).toContain('SectorRoom.ts');
  });

  it('same error → same fingerprint', async () => {
    const make = () => {
      const e = new Error('dup');
      e.stack = 'Error: dup\n    at foo (src/foo.ts:1:1)';
      return e;
    };
    await captureError(make(), 'foo');
    await captureError(make(), 'foo');
    expect(mockUpsert.mock.calls[0][0]).toBe(mockUpsert.mock.calls[1][0]);
  });

  it('does not throw if upsertErrorLog fails', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('DB down'));
    await expect(captureError(new Error('x'), 'ctx')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss FAIL**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run src/__tests__/captureError.test.ts
```

- [ ] **Step 3: errorLogTransport.ts implementieren**

`packages/server/src/utils/errorLogTransport.ts`:

```typescript
import { createHash } from 'crypto';
import { upsertErrorLog } from '../db/adminQueries.js';

function extractLocation(stack: string | undefined): string | null {
  if (!stack) return null;
  for (const line of stack.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('at ') && !trimmed.includes('node_modules')) {
      return trimmed.replace(/^at /, '');
    }
  }
  return null;
}

export async function captureError(err: Error, _context: string): Promise<void> {
  try {
    const location = extractLocation(err.stack);
    const fingerprint = createHash('sha256')
      .update((err.message ?? '') + (location ?? ''))
      .digest('hex');
    await upsertErrorLog(fingerprint, err.message ?? 'Unknown error', location, err.stack ?? null);
  } catch {
    // Never propagate — fire-and-forget
  }
}
```

- [ ] **Step 4: Test laufen lassen — muss PASS**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run src/__tests__/captureError.test.ts
```

- [ ] **Step 5: captureError in SectorRoom.ts einbauen**

Import hinzufügen:
```typescript
import { captureError } from '../utils/errorLogTransport.js';
```

Die 5–8 wichtigsten unhandled-error `catch`-Blöcke in SectorRoom ergänzen, z.B.:
```typescript
} catch (err) {
  logger.error({ err }, 'moveSector error');
  captureError(err as Error, 'moveSector').catch(() => {});
}
```
Nur in `catch`-Blöcken mit `logger.error`, nicht bei Validation-Fehlern.

- [ ] **Step 6: Alle Server-Tests grün**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run
```

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/utils/errorLogTransport.ts packages/server/src/__tests__/captureError.test.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat(admin): captureError transport with fingerprint dedup, refs #252"
```

---

### Task 8: Admin-API — /errors Endpoints

**Files:**
- Modify: `packages/server/src/adminRoutes.ts`
- Test: `packages/server/src/__tests__/adminErrorRoutes.test.ts` (neu)

- [ ] **Step 1: Failing test schreiben**

`packages/server/src/__tests__/adminErrorRoutes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../db/adminQueries.js', () => ({
  getErrorLogs: vi.fn().mockResolvedValue([
    { id: 1, fingerprint: 'abc123', message: 'Test error', location: 'foo.ts:1',
      stack: null, count: 3, first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(), status: 'new', github_issue_url: null },
  ]),
  updateErrorLogStatus: vi.fn().mockResolvedValue(true),
  deleteErrorLog: vi.fn().mockResolvedValue(true),
  logAdminEvent: vi.fn().mockResolvedValue(undefined),
  // keep existing mocks the route file needs:
  getAllPlayers: vi.fn().mockResolvedValue([]),
  getServerStats: vi.fn().mockResolvedValue({}),
}));
vi.mock('../engine/universeBootstrap.js', () => ({ getUniverseTickCount: vi.fn().mockReturnValue(0) }));
vi.mock('../rooms/services/RedisAPStore.js', () => ({ getPlayerPosition: vi.fn(), savePlayerPosition: vi.fn() }));
vi.mock('../adminBus.js', () => ({ adminBus: { broadcast: vi.fn(), questCreated: vi.fn(), playerUpdated: vi.fn() } }));
vi.mock('../constructionBus.js', () => ({ constructionBus: { emit: vi.fn() } }));
vi.mock('../db/constructionQueries.js', () => ({ getAllConstructionSites: vi.fn().mockResolvedValue([]) }));
vi.mock('../db/queries.js', () => ({ createStructure: vi.fn() }));

process.env.ADMIN_TOKEN = 'test-token';

import { adminRouter } from '../adminRoutes.js';

const app = express();
app.use(express.json());
app.use('/admin', adminRouter);
const auth = { Authorization: 'Bearer test-token' };

describe('Admin /errors routes', () => {
  it('GET /admin/errors returns errors', async () => {
    const res = await request(app).get('/admin/errors').set(auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors[0].message).toBe('Test error');
  });

  it('POST /admin/errors/1/ignore → success', async () => {
    const res = await request(app).post('/admin/errors/1/ignore').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /admin/errors/1/resolve → success', async () => {
    const res = await request(app).post('/admin/errors/1/resolve').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE /admin/errors/1 → success', async () => {
    const res = await request(app).delete('/admin/errors/1').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss FAIL**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run src/__tests__/adminErrorRoutes.test.ts
```

- [ ] **Step 3: Endpoints in adminRoutes.ts hinzufügen**

Imports ergänzen:
```typescript
import {
  getErrorLogs,
  updateErrorLogStatus,
  deleteErrorLog,
} from './db/adminQueries.js';
```

Vor dem Ende der Datei 4 neue Routes:

```typescript
// ── Error Logs ──────────────────────────────────────────────────────

adminRouter.get('/errors', async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'new';
    const errors = await getErrorLogs(status);
    await logAdminEvent('list_errors', { status, count: errors.length });
    res.json({ errors });
  } catch (err) {
    logger.error({ err }, 'Admin list errors');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/errors/:id/ignore', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ok = await updateErrorLogStatus(id, 'ignored');
    await logAdminEvent('ignore_error', { id });
    res.json({ success: ok });
  } catch (err) {
    logger.error({ err }, 'Admin ignore error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.post('/errors/:id/resolve', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ok = await updateErrorLogStatus(id, 'resolved');
    await logAdminEvent('resolve_error', { id });
    res.json({ success: ok });
  } catch (err) {
    logger.error({ err }, 'Admin resolve error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

adminRouter.delete('/errors/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ok = await deleteErrorLog(id);
    await logAdminEvent('delete_error', { id });
    res.json({ success: ok });
  } catch (err) {
    logger.error({ err }, 'Admin delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 4: Test laufen lassen — muss PASS**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run src/__tests__/adminErrorRoutes.test.ts
```

- [ ] **Step 5: Alle Server-Tests grün**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/adminRoutes.ts packages/server/src/__tests__/adminErrorRoutes.test.ts
git commit -m "feat(admin): /errors API endpoints — list, ignore, resolve, delete, refs #252"
```

---

### Task 9: Admin-Tab ERRORS

**Files:**
- Modify: `packages/server/src/admin/console.html`

**Kontext:** Neuer Tab in der bestehenden Tab-Bar. Alle Strings via DOM-Methoden setzen — kein unsicheres `innerHTML` mit User-Daten. `escapeHtml`-Helper für alle Serverdaten verwenden.

- [ ] **Step 1: Tab-Bar-Eintrag hinzufügen**

In `console.html`, Tab-Bar (ca. Zeile 568), nach `BAUSTELLEN`:
```html
<div class="tab" data-tab="errors">ERRORS <span id="errors-badge" style="display:none;background:#ff4444;color:#fff;border-radius:10px;padding:0 5px;font-size:10px;margin-left:4px;vertical-align:middle"></span></div>
```

- [ ] **Step 2: Panel HTML hinzufügen**

Nach dem letzten `tab-panel`-Block:
```html
<div class="tab-panel" id="panel-errors">
  <div style="margin-bottom:8px;display:flex;gap:6px;">
    <button class="btn" onclick="loadErrors('new')">NEW</button>
    <button class="btn" onclick="loadErrors('all')">ALL</button>
    <button class="btn" onclick="loadErrors('ignored')">IGNORED</button>
  </div>
  <table class="data-table" id="errors-table">
    <thead>
      <tr>
        <th>LAST SEEN</th><th>COUNT</th><th>MESSAGE</th>
        <th>LOCATION</th><th>STATUS</th><th>ACTIONS</th>
      </tr>
    </thead>
    <tbody id="errors-tbody"></tbody>
  </table>
</div>
```

- [ ] **Step 3: JavaScript ergänzen**

Im `<script>`-Block. Wichtig: alle Serverdaten via `textContent` oder `escapeHtml` setzen, nie rohe Server-Strings in HTML-Attributen oder `innerHTML` ohne Escaping:

```javascript
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

var currentErrorFilter = 'new';

async function loadErrors(status) {
  currentErrorFilter = status || 'new';
  var res = await fetch('/admin/errors?status=' + encodeURIComponent(currentErrorFilter), {
    headers: { 'Authorization': 'Bearer ' + adminToken }
  });
  var data = await res.json();
  var tbody = document.getElementById('errors-tbody');
  tbody.textContent = '';  // safe clear

  var newCount = 0;
  (data.errors || []).forEach(function(e) {
    if (e.status === 'new') newCount++;

    var tr = document.createElement('tr');
    tr.style.cursor = 'pointer';

    // Build cells with textContent (safe)
    var cells = [
      new Date(e.last_seen).toLocaleString(),
      String(e.count),
      (e.message || '').substring(0, 60) + (e.message && e.message.length > 60 ? '…' : ''),
      e.location || '—',
    ];
    cells.forEach(function(text) {
      var td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    });

    // Status cell
    var statusTd = document.createElement('td');
    var statusSpan = document.createElement('span');
    statusSpan.textContent = e.status;
    statusSpan.style.color = e.status === 'new' ? '#ff4444' : e.status === 'ignored' ? '#888' : '#4a9';
    statusTd.appendChild(statusSpan);
    tr.appendChild(statusTd);

    // Actions cell
    var actionsTd = document.createElement('td');
    actionsTd.style.whiteSpace = 'nowrap';

    [
      { label: 'IGNORE', fn: function() { ignoreError(e.id); } },
      { label: 'RESOLVED', fn: function() { resolveError(e.id); } },
      { label: 'DEL', fn: function() { deleteError(e.id); }, color: '#ff4444' },
    ].forEach(function(action) {
      var btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = action.label;
      btn.style.cssText = 'font-size:9px;padding:2px 4px;margin:1px';
      if (action.color) btn.style.color = action.color;
      btn.onclick = action.fn;
      actionsTd.appendChild(btn);
    });

    // GitHub link — URL params encoded
    var ghTitle = encodeURIComponent('[ERROR] ' + (e.message || ''));
    var ghBody = encodeURIComponent(
      'Fingerprint: ' + (e.fingerprint || '') + '\nCount: ' + e.count +
      '\n\n' + (e.stack || 'no stack')
    );
    var ghHref = 'https://github.com/phash/voidSector/issues/new?title=' + ghTitle + '&body=' + ghBody;
    var ghLink = document.createElement('a');
    ghLink.href = ghHref;
    ghLink.target = '_blank';
    var ghBtn = document.createElement('button');
    ghBtn.className = 'btn';
    ghBtn.textContent = '→ GH';
    ghBtn.style.cssText = 'font-size:9px;padding:2px 4px;margin:1px';
    ghLink.appendChild(ghBtn);
    actionsTd.appendChild(ghLink);

    tr.appendChild(actionsTd);

    // Stack expand on row click
    tr.addEventListener('click', function(ev) {
      if (ev.target.tagName === 'BUTTON' || ev.target.tagName === 'A') return;
      var next = tr.nextSibling;
      if (next && next.classList && next.classList.contains('stack-row')) {
        next.remove(); return;
      }
      var stackRow = document.createElement('tr');
      stackRow.className = 'stack-row';
      var stackTd = document.createElement('td');
      stackTd.colSpan = 6;
      var pre = document.createElement('pre');
      pre.style.cssText = 'font-size:9px;opacity:0.7;margin:4px;white-space:pre-wrap';
      pre.textContent = e.stack || 'no stack';  // textContent = safe
      stackTd.appendChild(pre);
      stackRow.appendChild(stackTd);
      tr.parentNode.insertBefore(stackRow, tr.nextSibling);
    });

    tbody.appendChild(tr);
  });

  // Update badge
  var badge = document.getElementById('errors-badge');
  if (newCount > 0) {
    badge.textContent = String(newCount);
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

async function ignoreError(id) {
  await fetch('/admin/errors/' + encodeURIComponent(id) + '/ignore', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + adminToken }
  });
  loadErrors(currentErrorFilter);
}
async function resolveError(id) {
  await fetch('/admin/errors/' + encodeURIComponent(id) + '/resolve', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + adminToken }
  });
  loadErrors(currentErrorFilter);
}
async function deleteError(id) {
  if (!confirm('Error löschen?')) return;
  await fetch('/admin/errors/' + encodeURIComponent(id), {
    method: 'DELETE', headers: { 'Authorization': 'Bearer ' + adminToken }
  });
  loadErrors(currentErrorFilter);
}
```

- [ ] **Step 4: Tab-Switch ergänzen**

Im bestehenden Tab-Switch-Handler, nach den anderen `if (name === '...')` Blöcken:
```javascript
if (name === 'errors') loadErrors('new');
```

- [ ] **Step 5: Manuell testen**

```bash
cd /home/manuel/claude/voidSector && npm run dev:server
```
Browser: `http://localhost:3000/admin` (oder localhost:2567/admin je nach Config)
→ Tab "ERRORS" erscheint, Klick lädt leere Tabelle, Buttons reagieren.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/admin/console.html
git commit -m "feat(admin): ERRORS tab — list, filter, ignore/resolve/delete, github link, closes #252"
```

---

## Abschluss

- [ ] **Alle Tests final grün**

```bash
cd /home/manuel/claude/voidSector/packages/server && npx vitest run
cd /home/manuel/claude/voidSector/packages/client && npx vitest run
```

- [ ] **Issues schließen**

```bash
gh issue close 240 --comment "Gefixt in diesem Sprint: Single-Click Jettison"
gh issue close 237 --comment "Gefixt in diesem Sprint: Partial-Sell-Meldung prominenter"
gh issue close 238 --comment "Gefixt in diesem Sprint: miningBonus wird auf Rate angewendet"
gh issue close 232 --comment "Gefixt in diesem Sprint: Auto-Stop, Cargo-Bar, Detail-Link"
gh issue close 233 --comment "Gefixt in diesem Sprint: Quest verschwindet nach Annahme aus VERFÜGBAR"
gh issue close 252 --comment "Implementiert: Admin-Tab ERRORS mit Aggregation, ignore/resolve/delete/github"
```

- [ ] **Push**

```bash
git push origin master
```
