# Bug-Fix Batch Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4 unabhängige Bug-Fixes: Abwerfen-Button (#240), Mining-Anzeige (#238), Verkaufen auf 0 + Alles Verkaufen (#237), Quests nach Annahme (#233).

**Architecture:** Alle Fixes sind unabhängig voneinander. #240 und #238 sind reine Client-Fixes. #237 erfordert Server + Client. #233 ist Server only. Alle Fixes nutzen bestehende Infrastruktur — keine neuen Services, keine neuen Abstraktionen.

**Tech Stack:** TypeScript strict, React (Client), Colyseus (Server), Vitest (Tests). Server-Imports mit `.js`-Extension, Client ohne Extension.

---

## Chunk 1: #240 — Waren abwerfen

**Spec:** `docs/superpowers/specs/2026-03-10-bugfix-batch-design.md` → Abschnitt #240

### Task 1: Abwerfen-Button in CargoDetailPanel verdrahten

**Files:**
- Modify: `packages/client/src/components/CargoDetailPanel.tsx:60-71`
- Test: `packages/client/src/__tests__/CargoDetailPanel.test.tsx` (neu erstellen)

**Kontext:** `sendJettison(resource)` existiert in `client.ts:1739`. Der Server-Handler `handleJettison` liest die volle Menge selbst aus dem Inventory. Der Button braucht nur die Ressource (kein amount). `selectedCargoItem` enthält den Ressourcentyp (string).

- [ ] **Step 1: Failing test schreiben**

Erstelle `packages/client/src/__tests__/CargoDetailPanel.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CargoDetailPanel } from '../components/CargoDetailPanel';
import * as store from '../state/store';
import * as networkModule from '../network/client';

const mockNetwork = { sendJettison: vi.fn() };

vi.mock('../network/client', () => ({
  network: mockNetwork,
}));

vi.mock('../state/store', () => ({
  useStore: vi.fn(),
}));

describe('CargoDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing selected when selectedCargoItem is null', () => {
    vi.mocked(store.useStore).mockImplementation((sel: any) =>
      sel({ selectedCargoItem: null, cargo: {} }),
    );
    render(<CargoDetailPanel />);
    expect(screen.getByText('AUSWAHL TREFFEN')).toBeTruthy();
  });

  it('calls sendJettison when ABWERFEN button clicked', async () => {
    vi.mocked(store.useStore).mockImplementation((sel: any) =>
      sel({ selectedCargoItem: 'ore', cargo: { ore: 5 } }),
    );
    render(<CargoDetailPanel />);
    const btn = screen.getByText('[ABWERFEN]');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(mockNetwork.sendJettison).toHaveBeenCalledWith('ore');
  });

  it('ABWERFEN button is not disabled', () => {
    vi.mocked(store.useStore).mockImplementation((sel: any) =>
      sel({ selectedCargoItem: 'ore', cargo: { ore: 3 } }),
    );
    render(<CargoDetailPanel />);
    const btn = screen.getByText('[ABWERFEN]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Test ausführen — muss FAIL sein**

```bash
cd packages/client && npx vitest run src/__tests__/CargoDetailPanel.test.tsx
```

Expected: FAIL — Button ist `disabled`, kein onClick.

- [ ] **Step 3: Fix implementieren**

In `packages/client/src/components/CargoDetailPanel.tsx`, zwei separate Edits:

**Edit 1 — Import hinzufügen** (Zeile 1, nach dem bestehenden `import { useStore }` — dieser Import ist bereits da, NUR das hier hinzufügen):

```typescript
import { network } from '../network/client';
```

**Edit 2 — Button ersetzen** (Zeilen 60-71, `disabled`-Button durch aktiven Button ersetzen):

```typescript
// Alt:
<button
  className="vs-btn"
  style={{
    marginTop: 12,
    fontSize: '0.65rem',
    display: 'block',
    width: '100%',
  }}
  disabled
>
  [ABWERFEN]
</button>

// Neu:
<button
  className="vs-btn"
  style={{
    marginTop: 12,
    fontSize: '0.65rem',
    display: 'block',
    width: '100%',
  }}
  onClick={() => network.sendJettison(selectedCargoItem)}
>
  [ABWERFEN]
</button>
```

- [ ] **Step 4: Tests ausführen — müssen PASS sein**

```bash
cd packages/client && npx vitest run src/__tests__/CargoDetailPanel.test.tsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Alle Client-Tests grün**

```bash
cd packages/client && npx vitest run
```

Expected: alle Tests PASS (ca. 545).

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/CargoDetailPanel.tsx \
        packages/client/src/__tests__/CargoDetailPanel.test.tsx
git commit -m "fix(#240): enable ABWERFEN button in CargoDetailPanel

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Chunk 2: #238 — Mining-Anzeige

**Spec:** `docs/superpowers/specs/2026-03-10-bugfix-batch-design.md` → Abschnitt #238

### Task 2: Mining-Status-Anzeige verbessern

**Files:**
- Modify: `packages/client/src/components/MiningScreen.tsx:82-112`

**Kontext:** Die Berechnung ist korrekt (`MINING_RATE_PER_SECOND = 1`, Cap durch `sectorYield`). Die Anzeige zeigt bereits `X/Yu` in einem `<span>` (Zeile 106). Das Problem: Die Statuszeile sagt `STATUS: MINING ORE — 1u/s` direkt neben dem Fortschrittsbalken, der sich über `sectorYield` Sekunden füllt — Spieler lesen das als "die Rate variiert mit der Sektorgröße".

Fix: Statuszeile expliziter machen: `MINING ORE — RATE: 1u/s | AUSBEUTE: 12/50u` in einer Zeile, Fortschrittsbalken bleibt, bestehender `<span>` wird entfernt (Dopplung vermeiden).

- [ ] **Step 1: Änderung implementieren (kein Test nötig — reine Display-Änderung)**

In `packages/client/src/components/MiningScreen.tsx`, ersetze präzise nur den `{mining?.active ? ... : ...}`-Block (Zeilen 82–112, endet beim schließenden `)`):

```typescript
// Alt (Zeilen 82-112):
{mining?.active ? (
  <>
    <div style={{ marginBottom: '6px' }}>
      STATUS: MINING {mining.resource?.toUpperCase()} — {mining.rate}u/s
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <div
        style={{
          flex: 1,
          height: '6px',
          background: '#0a0a0a',
          border: '1px solid rgba(255,176,0,0.3)',
        }}
      >
        <div
          style={{
            width: `${miningProgress * 100}%`,
            height: '100%',
            background: 'var(--color-primary)',
            transition: 'width 0.2s linear',
          }}
        />
      </div>
      <span style={{ fontSize: '0.75rem', minWidth: '60px', textAlign: 'right' }}>
        {Math.round(miningProgress * mining.sectorYield)}/{mining.sectorYield}u
      </span>
    </div>
  </>
) : (
  <div>STATUS: IDLE</div>
)}

// Neu: Rate + Ausbeute in einer Zeile, kein Span-Duplikat
{mining?.active ? (
  <>
    <div style={{ marginBottom: '6px' }}>
      MINING {mining.resource?.toUpperCase()} — RATE: {mining.rate}u/s |{' '}
      AUSBEUTE: {Math.round(miningProgress * mining.sectorYield)}/{mining.sectorYield}u
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <div
        style={{
          flex: 1,
          height: '6px',
          background: '#0a0a0a',
          border: '1px solid rgba(255,176,0,0.3)',
        }}
      >
        <div
          style={{
            width: `${miningProgress * 100}%`,
            height: '100%',
            background: 'var(--color-primary)',
            transition: 'width 0.2s linear',
          }}
        />
      </div>
    </div>
  </>
) : (
  <div>STATUS: IDLE</div>
)}
```

**Hinweis:** Zeile 113-115 (die `CARGO:`-Zeile) liegt außerhalb des geänderten Blocks und bleibt unverändert.

- [ ] **Step 2: Client-Tests grün**

```bash
cd packages/client && npx vitest run
```

Expected: alle Tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/MiningScreen.tsx
git commit -m "fix(#238): clarify mining rate vs total yield display

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Chunk 3: #237 — Verkaufen auf 0 + Alles Verkaufen

**Spec:** `docs/superpowers/specs/2026-03-10-bugfix-batch-design.md` → Abschnitt #237

**Root cause:** `canSellToStation` gibt `ok: false` zurück wenn `remainingCapacity < amount`. Die Station füllt sich durch `restockRate > consumptionRate`. Spieler kann die letzte Einheit nicht verkaufen wenn die Stationskapazität für diese Ressource voll ist. Außerdem: kein "ALLES"-Button, `amount`-Input hat kein `max`.

### Task 3a: Server — canSellToStation gibt effectiveAmount zurück

**Files:**
- Modify: `packages/server/src/engine/npcStationEngine.ts:223-246`
- Modify: `packages/server/src/rooms/services/EconomyService.ts:164-205`
- Test: `packages/server/src/engine/__tests__/npcStationEngine.test.ts` (vorhanden — erweitern)

- [ ] **Step 1: Failing test schreiben**

Öffne `packages/server/src/engine/__tests__/npcStationEngine.test.ts`. Füge am Ende des `describe('canSellToStation')` Blocks hinzu:

**Hinweis:** Die Datei nutzt `mockGetStationInventoryItem` als Alias für `vi.mocked(getStationInventoryItem)` und `mockResolvedValueOnce` (nicht `mockResolvedValue`). Sieh dir die bestehenden `describe('canSellToStation')` Tests für das Mock-Pattern an und folge exakt demselben Stil (`mockGetStationData.mockResolvedValueOnce(station)` + `mockGetStationInventoryItem.mockResolvedValueOnce(item)`).

```typescript
it('returns effectiveAmount = remainingCapacity when amount exceeds station capacity', async () => {
  const station = { /* copy from existing canSellToStation test setup */ };
  const item = {
    stationX: 5, stationY: 10, itemType: 'ore',
    stock: 9, maxStock: 10,
    restockRate: 0, consumptionRate: 0,
    lastUpdated: new Date().toISOString(),
  };
  mockGetStationData.mockResolvedValueOnce(station);
  mockGetStationInventoryItem.mockResolvedValueOnce(item);
  const result = await canSellToStation(5, 10, 'ore', 5);
  expect(result.ok).toBe(true);
  expect(result.effectiveAmount).toBe(1);
});

it('returns effectiveAmount = amount when station has sufficient capacity', async () => {
  const station = { /* copy from existing test setup */ };
  const item = {
    stationX: 5, stationY: 10, itemType: 'ore',
    stock: 5, maxStock: 10,
    restockRate: 0, consumptionRate: 0,
    lastUpdated: new Date().toISOString(),
  };
  mockGetStationData.mockResolvedValueOnce(station);
  mockGetStationInventoryItem.mockResolvedValueOnce(item);
  const result = await canSellToStation(5, 10, 'ore', 3);
  expect(result.ok).toBe(true);
  expect(result.effectiveAmount).toBe(3);
});

it('returns ok=false and effectiveAmount=0 when station is full', async () => {
  const station = { /* copy from existing test setup */ };
  const item = {
    stationX: 5, stationY: 10, itemType: 'ore',
    stock: 10, maxStock: 10,
    restockRate: 0, consumptionRate: 0,
    lastUpdated: new Date().toISOString(),
  };
  mockGetStationData.mockResolvedValueOnce(station);
  mockGetStationInventoryItem.mockResolvedValueOnce(item);
  const result = await canSellToStation(5, 10, 'ore', 1);
  expect(result.ok).toBe(false);
  expect(result.effectiveAmount).toBe(0);
});
```

- [ ] **Step 2: Tests ausführen — müssen FAIL sein**

```bash
cd packages/server && npx vitest run src/engine/__tests__/npcStationEngine.test.ts
```

Expected: FAIL — `effectiveAmount` existiert noch nicht im Return-Typ.

- [ ] **Step 3: canSellToStation erweitern**

In `packages/server/src/engine/npcStationEngine.ts`, ersetze `canSellToStation` (Zeilen 223-246):

```typescript
export async function canSellToStation(
  x: number,
  y: number,
  itemType: string,
  amount: number,
): Promise<{ ok: boolean; capacity: number; price: number; effectiveAmount: number }> {
  await getOrInitStation(x, y);
  const item = await getStationInventoryItem(x, y, itemType);
  if (!item) return { ok: false, capacity: 0, price: 0, effectiveAmount: 0 };

  const currentStock = calculateCurrentStock(item);
  const remainingCapacity = item.maxStock - currentStock;
  const effectiveAmount = Math.min(amount, remainingCapacity);
  const stockRatio = item.maxStock > 0 ? currentStock / item.maxStock : 0;
  const basePrice = NPC_PRICES[itemType as MineableResourceType] ?? 0;
  const dynamicPrice = calculatePrice(basePrice, stockRatio);
  const unitPrice = Math.round(dynamicPrice * NPC_SELL_SPREAD);
  const totalPrice = unitPrice * effectiveAmount;

  return {
    ok: effectiveAmount > 0,
    capacity: remainingCapacity,
    price: totalPrice,
    effectiveAmount,
  };
}
```

- [ ] **Step 4: Tests ausführen — müssen PASS sein**

```bash
cd packages/server && npx vitest run src/engine/__tests__/npcStationEngine.test.ts
```

Expected: alle Tests PASS.

### Task 3b: Server — EconomyService nutzt effectiveAmount

**Files:**
- Modify: `packages/server/src/rooms/services/EconomyService.ts:164-205`
- Test: `packages/server/src/__tests__/economyInventory.test.ts` (vorhanden — erweitern)

- [ ] **Step 5: Failing test schreiben**

Öffne `packages/server/src/__tests__/economyInventory.test.ts`. Schau dir die bestehenden `npcTrade sell`-Tests an — sie nutzen `svc.handleNpcTrade(client, ...)` auf einer `EconomyService`-Instanz und mocken `canSellToStation` global in der Datei.

**Wichtig vor dem neuen Test:** Aktualisiere den globalen `canSellToStation`-Mock (ca. Zeile 61) um `effectiveAmount` zu ergänzen, damit bestehende Tests nicht brechen:

```typescript
// Alt:
canSellToStation: vi.fn().mockResolvedValue({ ok: true, price: 80 }),

// Neu:
canSellToStation: vi.fn().mockResolvedValue({ ok: true, price: 80, capacity: 10, effectiveAmount: 1 }),
```

Dann füge den neuen Test in den bestehenden `describe`-Block für Station-Sells hinzu:

```typescript
it('sells partial amount when station capacity is lower than requested amount', async () => {
  // Player has 5 ore, station can only accept 2
  vi.mocked(getCargoState).mockResolvedValueOnce({ ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0 });
  vi.mocked(getResourceTotal).mockResolvedValueOnce(5);
  vi.mocked(canSellToStation).mockResolvedValueOnce({ ok: true, capacity: 2, price: 20, effectiveAmount: 2 });

  await svc.handleNpcTrade(client, { resource: 'ore', amount: 5, action: 'sell' });

  // Should remove only 2 units (effectiveAmount), not 5
  expect(removeFromInventory).toHaveBeenCalledWith(expect.any(String), 'resource', 'ore', 2);
  expect(client.send).toHaveBeenCalledWith('npcTradeResult', expect.objectContaining({
    success: true,
    partial: true,
    soldAmount: 2,
  }));
});
```

**Hinweis:** `price: 20` ist bereits der Preis für `effectiveAmount` (2 Einheiten) — `canSellToStation` berechnet den Preis intern für `effectiveAmount`. Der `EconomyService` übergibt `sellCheck.price` direkt an `addCredits` ohne weiteren Multiplikator.

- [ ] **Step 6: Tests ausführen — müssen FAIL sein**

```bash
cd packages/server && npx vitest run src/__tests__/economyInventory.test.ts
```

Expected: FAIL — kein `partial` in Response, `amount` nicht `effectiveAmount`.

- [ ] **Step 7: EconomyService sell-Pfad anpassen**

In `packages/server/src/rooms/services/EconomyService.ts`, ersetze den `if (action === 'sell')` Block für den Station-Pfad (Zeilen 164-205):

```typescript
if (action === 'sell') {
  // Check cargo has enough
  if (cargo[resource as MineableResourceType] < amount) {
    client.send('npcTradeResult', {
      success: false,
      error: `Not enough ${resource} in cargo`,
    });
    return;
  }
  // Check station capacity — use effectiveAmount (may be less than requested)
  const sellCheck = await canSellToStation(sx, sy, resource, amount);
  if (!sellCheck.ok) {
    client.send('npcTradeResult', {
      success: false,
      error: 'Station kann diese Ressource nicht mehr aufnehmen',
    });
    return;
  }
  const effectiveAmount = sellCheck.effectiveAmount;
  // Execute trade with effectiveAmount
  const deducted = await removeFromInventory(auth.userId, 'resource', resource, effectiveAmount)
    .then(() => true)
    .catch(() => false);
  if (!deducted) {
    client.send('npcTradeResult', { success: false, error: 'Cargo changed' });
    return;
  }
  // Update station stock
  const invItem = await getStationInventoryItem(sx, sy, resource);
  if (invItem) {
    invItem.stock = Math.min(invItem.stock + effectiveAmount, invItem.maxStock);
    invItem.lastUpdated = new Date().toISOString();
    await upsertInventoryItem(invItem);
  }
  const newCredits = await addCredits(auth.userId, sellCheck.price);
  await recordTrade(sx, sy, effectiveAmount);
  updatePlayerStationRep(auth.userId, sx, sy, STATION_REP_TRADE).catch(() => {});
  const updatedCargo = await getCargoState(auth.userId);
  const partial = effectiveAmount < amount;
  client.send('npcTradeResult', {
    success: true,
    credits: newCredits,
    ...(partial && { partial: true, soldAmount: effectiveAmount }),
  });
  client.send('creditsUpdate', { credits: newCredits });
  client.send('cargoUpdate', updatedCargo);
  await this.sendNpcStationUpdate(client, sx, sy);
```

- [ ] **Step 8: Tests ausführen — müssen PASS sein**

```bash
cd packages/server && npx vitest run src/__tests__/economyInventory.test.ts
```

Expected: alle Tests PASS.

- [ ] **Step 9: Alle Server-Tests grün**

```bash
cd packages/server && npx vitest run
```

Expected: alle Tests PASS (ca. 1100).

- [ ] **Step 10: Server-Commit**

```bash
git add packages/server/src/engine/npcStationEngine.ts \
        packages/server/src/rooms/services/EconomyService.ts \
        packages/server/src/engine/__tests__/npcStationEngine.test.ts \
        packages/server/src/__tests__/economyInventory.test.ts
git commit -m "fix(#237): partial sell when station capacity < requested amount

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 3c: Client — ALLES-Button + Input max + Partial-Feedback

**Files:**
- Modify: `packages/client/src/components/TradeScreen.tsx`

**Kontext:** Im Station-Tab (isStation=true) gibt es für ore/gas/crystal je ein "K" (Kaufen) und "V" (Verkaufen) Button. Der amount-Input steht oben. Füge hinzu:
- `max={isStation ? cargo[selectedRes] : storage[selectedRes]}` am Input (verhindert Übereingabe)
- "ALLES"-Button, der amount auf den vollen Bestand setzt
- Bei `partial: true` in npcTradeResult: InlineError-ähnliche Meldung anzeigen

- [ ] **Step 11: ALLES-Button per Ressource + Partial-Feedback**

Schau dir `packages/client/src/components/TradeScreen.tsx` an. Finde den `ore/gas/crystal`-Zeilen-Block im Station-Tab (ca. Zeile 340-373). Ersetze das `.map()` durch diese Version, die je Ressource einen "ALLES"-Button ergänzt — direkt neben "V", nur sichtbar wenn Bestand > 0:

```typescript
{(['ore', 'gas', 'crystal'] as const).map((res) => {
  const buyPrice = Math.ceil(NPC_PRICES[res] * NPC_BUY_SPREAD * amount);
  const sellPrice = Math.floor(NPC_PRICES[res] * NPC_SELL_SPREAD * amount);
  const playerAmount = isStation ? cargo[res] : storage[res];
  return (
    <div
      key={res}
      style={{
        marginBottom: 8,
        borderBottom: '1px solid rgba(255,176,0,0.1)',
        paddingBottom: 6,
      }}
    >
      <div style={{ fontSize: '0.75rem', marginBottom: 3 }}>
        {res.toUpperCase()}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          style={{ ...btnStyle, fontSize: '0.6rem' }}
          onClick={() => network.sendNpcTrade(res, amount, 'buy')}
        >
          K ({buyPrice}CR)
        </button>
        <button
          style={{ ...btnStyle, fontSize: '0.6rem' }}
          onClick={() => network.sendNpcTrade(res, amount, 'sell')}
        >
          V ({sellPrice}CR)
        </button>
        {playerAmount > 0 && (
          <button
            style={{ ...btnStyle, fontSize: '0.55rem', opacity: 0.8 }}
            onClick={() => network.sendNpcTrade(res, playerAmount, 'sell')}
          >
            ALLES ({playerAmount})
          </button>
        )}
      </div>
    </div>
  );
})}
```

**Partial-Feedback** — füge lokalen State und Anzeige hinzu:

1. Füge State-Variable am Anfang der `TradeScreen`-Komponente hinzu (nach den bestehenden `useState`-Calls):
```typescript
const [tradeMessage, setTradeMessage] = useState<string | null>(null);
```

2. Suche den `npcTradeResult`-Handler (suche nach `'npcTradeResult'` in der Datei). Füge nach dem erfolgreichen Trade hinzu:
```typescript
if (result.partial) {
  setTradeMessage(`Nur ${result.soldAmount}x verkauft — Station ist fast voll`);
} else {
  setTradeMessage(null);
}
```

3. Füge die Anzeige direkt unter dem Amount-Input-Bereich ein:
```typescript
{tradeMessage && (
  <div style={{ fontSize: '0.65rem', color: 'var(--color-primary)', opacity: 0.7, marginTop: 4 }}>
    {tradeMessage}
  </div>
)}
```

- [ ] **Step 12: Client-Tests grün**

```bash
cd packages/client && npx vitest run
```

Expected: alle Tests PASS.

- [ ] **Step 13: Client-Commit**

```bash
git add packages/client/src/components/TradeScreen.tsx
git commit -m "fix(#237): add sell-all button and partial sell feedback

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Chunk 4: #233 — Quests verschwinden nicht nach Annahme

**Spec:** `docs/superpowers/specs/2026-03-10-bugfix-batch-design.md` → Abschnitt #233

**Root cause:** `handleGetStationNpcs` ruft `generateStationQuests` auf ohne Filter gegen aktive/accepted Quests des Spielers. Derselbe Spieler sieht dieselben tagesbasierten Quest-Templates wieder.

### Task 4a: DB-Query für aktive Template-IDs

**Files:**
- Modify: `packages/server/src/db/queries.ts` (neue Funktion nach `getActiveQuestCount`)
- Test: `packages/server/src/__tests__/questInventory.test.ts` (bestehende Datei — dort leben alle Quest-Tests mit vollem Mock-Setup)

- [ ] **Step 1: Failing test schreiben**

Öffne `packages/server/src/__tests__/questInventory.test.ts`. Die Datei mockt `../db/client.js` via `vi.mock` — schau dir an wie `query` gemockt wird (typischerweise via `mockResolvedValueOnce`). Füge einen neuen `describe`-Block hinzu:

```typescript
describe('getAcceptedQuestTemplateIds', () => {
  it('returns template_ids of active quests at given station', async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [{ template_id: 'delivery_ore_basic' }, { template_id: 'scan_sector' }],
      rowCount: 2,
    } as any);

    const result = await getAcceptedQuestTemplateIds('player-1', 5, 10);

    expect(result).toEqual(['delivery_ore_basic', 'scan_sector']);
  });

  it('returns empty array when player has no active quests at station', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const result = await getAcceptedQuestTemplateIds('player-1', 5, 10);

    expect(result).toEqual([]);
  });
});
```

Füge den Import von `getAcceptedQuestTemplateIds` am Dateianfang hinzu (neben den anderen Query-Importen).

- [ ] **Step 2: Tests ausführen — müssen FAIL sein**

```bash
cd packages/server && npx vitest run src/__tests__/questInventory.test.ts
```

Expected: FAIL — `getAcceptedQuestTemplateIds` existiert noch nicht in `queries.ts`.

- [ ] **Step 3: Query implementieren**

In `packages/server/src/db/queries.ts`, füge nach `getActiveQuestCount` (ca. Zeile 1146) ein:

```typescript
/**
 * Returns template_ids of quests the player currently has active at a station.
 * Used to filter out already-accepted quests from the available quest list.
 * Only filters 'active' status — completed quests can be offered again.
 */
export async function getAcceptedQuestTemplateIds(
  playerId: string,
  stationX: number,
  stationY: number,
): Promise<string[]> {
  const { rows } = await query<{ template_id: string }>(
    `SELECT template_id FROM player_quests
     WHERE player_id = $1
       AND station_x = $2
       AND station_y = $3
       AND status = 'active'`,
    [playerId, stationX, stationY],
  );
  return rows.map((r) => r.template_id);
}
```

**Hinweis:** Nur `status = 'active'` filtern (nicht 'completed') — abgeschlossene Quests können erneut angeboten werden. Das entspricht dem Issue-Ziel: Quest verschwindet nach Annahme, erscheint wieder nach Abschluss.

- [ ] **Step 4: Tests ausführen — müssen PASS sein**

```bash
cd packages/server && npx vitest run src/__tests__/questInventory.test.ts
```

Expected: alle Tests PASS.

### Task 4b: QuestService filtert akzeptierte Quests

**Files:**
- Modify: `packages/server/src/rooms/services/QuestService.ts:42-52`

- [ ] **Step 5: Failing test schreiben**

Öffne `packages/server/src/__tests__/questInventory.test.ts`. Die Datei hat ein vollständiges Mock-Setup für `QuestService` mit `ctx`, `client`, und `svc` (oder ähnlich). Schau dir an wie `handleGetStationNpcs` in bestehenden Tests aufgerufen wird. Füge hinzu:

```typescript
describe('handleGetStationNpcs — quest filtering', () => {
  it('filters out quests the player already has active at this station', async () => {
    // Mock: Spieler hat template 'delivery_ore_basic' bereits aktiv
    vi.mocked(getAcceptedQuestTemplateIds).mockResolvedValueOnce(['delivery_ore_basic']);
    // Mock: Station bietet 2 Quests an (inkl. delivery_ore_basic)
    vi.mocked(generateStationQuests).mockReturnValueOnce([
      { templateId: 'delivery_ore_basic', title: 'Lieferquest', npcName: 'NPC1', npcFactionId: 'terran', description: '', objectives: [], rewards: [] },
      { templateId: 'scan_sector',        title: 'Scan-Quest',  npcName: 'NPC2', npcFactionId: 'terran', description: '', objectives: [], rewards: [] },
    ]);

    await svc.handleGetStationNpcs(client, { sectorX: 5, sectorY: 10 });

    // Nur 'scan_sector' darf im Result sein
    const sentQuests = client.send.mock.calls.find(
      ([msg]: [string]) => msg === 'stationNpcsResult'
    )?.[1]?.quests as Array<{ templateId: string }>;
    expect(sentQuests).toBeDefined();
    expect(sentQuests.map((q) => q.templateId)).not.toContain('delivery_ore_basic');
    expect(sentQuests.map((q) => q.templateId)).toContain('scan_sector');
  });
});
```

**Hinweis:** Passe die Variablennamen (`svc`, `client`, Mock-Typen) ans bestehende Test-Setup an. Füge `getAcceptedQuestTemplateIds` und `generateStationQuests` zu den vi.mock-Importen hinzu.

- [ ] **Step 6: Tests ausführen — müssen FAIL sein**

```bash
cd packages/server && npx vitest run src/__tests__/questInventory.test.ts
```

Expected: FAIL — `handleGetStationNpcs` filtert noch nicht.

- [ ] **Step 7: QuestService anpassen**

In `packages/server/src/rooms/services/QuestService.ts`, passe `handleGetStationNpcs` an:

```typescript
// Alt:
async handleGetStationNpcs(client: Client, data: GetStationNpcsMessage): Promise<void> {
  const auth = client.auth as AuthPayload;
  const npcs = generateStationNpcs(data.sectorX, data.sectorY);
  const reps = await getPlayerReputations(auth.userId);
  const faction = getStationFaction(data.sectorX, data.sectorY);
  const factionRep = reps.find((r) => r.faction_id === faction)?.reputation ?? 0;
  const tier = getReputationTier(factionRep) as ReputationTier;
  const dayOfYear = Math.floor(Date.now() / 86400000);
  const quests = generateStationQuests(data.sectorX, data.sectorY, dayOfYear, tier);
  this.ctx.send(client, 'stationNpcsResult', { npcs, quests });
}

// Neu:
async handleGetStationNpcs(client: Client, data: GetStationNpcsMessage): Promise<void> {
  const auth = client.auth as AuthPayload;
  const npcs = generateStationNpcs(data.sectorX, data.sectorY);
  const reps = await getPlayerReputations(auth.userId);
  const faction = getStationFaction(data.sectorX, data.sectorY);
  const factionRep = reps.find((r) => r.faction_id === faction)?.reputation ?? 0;
  const tier = getReputationTier(factionRep) as ReputationTier;
  const dayOfYear = Math.floor(Date.now() / 86400000);
  const allQuests = generateStationQuests(data.sectorX, data.sectorY, dayOfYear, tier);
  // Filter out quests the player has already accepted at this station
  const acceptedIds = await getAcceptedQuestTemplateIds(
    auth.userId,
    data.sectorX,
    data.sectorY,
  );
  const quests = acceptedIds.length > 0
    ? allQuests.filter((q) => !acceptedIds.includes(q.templateId))
    : allQuests;
  this.ctx.send(client, 'stationNpcsResult', { npcs, quests });
}
```

Füge den Import am Dateianfang hinzu:

```typescript
import { getAcceptedQuestTemplateIds } from '../../db/queries.js';
```

- [ ] **Step 8: Alle Server-Tests grün**

```bash
cd packages/server && npx vitest run
```

Expected: alle Tests PASS (ca. 1100).

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/db/queries.ts \
        packages/server/src/rooms/services/QuestService.ts \
        packages/server/src/__tests__/questInventory.test.ts
git commit -m "fix(#233): filter accepted quests from station quest list

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Abschluss

- [ ] **Alle Tests final prüfen**

```bash
cd packages/server && npx vitest run
cd packages/client && npx vitest run
cd packages/shared && npx vitest run
```

Expected: Server ~1100, Client ~545, Shared ~205 — alle grün.

- [ ] **Superpowers Verification**

Invoke skill: `superpowers:verification-before-completion`

- [ ] **Issues schließen:** #240, #238, #237, #233 auf GitHub als Fixed markieren
