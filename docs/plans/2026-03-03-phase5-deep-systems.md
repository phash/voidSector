# Phase 5: Deep Systems — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add deep gameplay systems: fuel, JumpGates, multi-content sectors, faction upgrade tree, rescue missions, trade route automation, enhanced data disks, plus bug fixes for mining navigation and UI.

**Architecture:** 4 sequential blocks (A→D). Each block builds on previous. Server: new DB migrations, SectorRoom handlers, engine modules. Client: new screens, store extensions, canvas minigame. Shared: new types + constants.

**Tech Stack:** TypeScript strict, Colyseus, PostgreSQL, Redis, React + Zustand, Canvas API, Vitest

**Key patterns to follow:**
- Server imports use `.js` extension (ESM): `import { foo } from './bar.js';`
- All DB tables use `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`
- Message pattern: client sends command → server validates → server responds with result
- Store updates: `useStore.setState({ field: value })` for shallow merges
- Tests: Vitest everywhere. Server tests in `packages/server/src/**/__tests__/`. Client tests in `packages/client/src/**/__tests__/`.
- Conventional commits: `feat:`, `fix:`, `test:`

---

## Block A: Grundlagen

### Task 1: Server — Mining Navigation Lock (Bug #17)

**Files:**
- Modify: `packages/server/src/engine/commands.ts:18-35`
- Modify: `packages/server/src/rooms/SectorRoom.ts:380-454`
- Modify: `packages/server/src/engine/__tests__/commands.test.ts`

**Context:** `validateJump()` in `commands.ts` only checks range + AP. It does NOT check mining state. `handleJump()` in `SectorRoom.ts` auto-stops mining at lines 387-397 BEFORE calling validateJump — so mining is silently stopped on jump. The bug is that this should be blocked, not auto-stopped.

**Step 1: Write failing test**

In `packages/server/src/engine/__tests__/commands.test.ts`, add:

```typescript
describe('validateJump', () => {
  // ... existing tests ...

  it('should reject jump when mining is active', () => {
    const ap: APState = { current: 50, max: 100, lastTick: Date.now(), regenPerSecond: 0.5 };
    const result = validateJump(ap, 0, 0, 1, 0, 4, 1, true);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('mining');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/commands.test.ts`
Expected: FAIL — `validateJump` doesn't accept mining parameter yet

**Step 3: Update validateJump signature and add mining check**

In `packages/server/src/engine/commands.ts`, update `validateJump`:

```typescript
export function validateJump(
  ap: APState,
  currentX: number,
  currentY: number,
  targetX: number,
  targetY: number,
  jumpRange: number,
  apCost: number,
  isMining: boolean = false,
): JumpValidation {
  if (isMining) {
    return { valid: false, error: 'Cannot jump while mining — stop mining first' };
  }
  const dx = Math.abs(targetX - currentX);
  const dy = Math.abs(targetY - currentY);
  if (dx > jumpRange || dy > jumpRange || (dx === 0 && dy === 0)) {
    return { valid: false, error: 'Target out of range' };
  }
  const newAP = spendAP(ap, apCost);
  if (!newAP) return { valid: false, error: 'Not enough AP' };
  return { valid: true, newAP };
}
```

**Step 4: Update handleJump in SectorRoom.ts**

Remove the auto-stop mining block (lines 387-397) and instead pass mining state to validateJump:

```typescript
// In handleJump, replace auto-stop mining with validation
const miningState = await getMiningState(auth.userId);
const jumpResult = validateJump(currentAP, pos.x, pos.y, targetX, targetY, ship.jumpRange, ship.apCostJump, miningState?.active ?? false);
```

**Step 5: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/server/src/engine/commands.ts packages/server/src/rooms/SectorRoom.ts packages/server/src/engine/__tests__/commands.test.ts
git commit -m "fix: block navigation while mining instead of auto-stopping (#17)"
```

---

### Task 2: Client — Mining Navigation Lock UI

**Files:**
- Modify: `packages/client/src/components/NavControls.tsx`
- Modify: `packages/client/src/components/DetailPanel.tsx`

**Context:** NavControls renders the grid-based jump buttons. When mining is active, these should be visually disabled. DetailPanel should refresh when scan discoveries update.

**Step 1: Disable jump buttons when mining**

In `NavControls.tsx`, read mining state from store and disable buttons:

```typescript
const mining = useStore((s) => s.mining);
const isMining = mining?.active ?? false;

// In each direction button, add:
disabled={isMining}
style={{ opacity: isMining ? 0.3 : 1, cursor: isMining ? 'not-allowed' : 'pointer' }}
```

Add a visible indicator when mining blocks navigation:
```typescript
{isMining && <div style={{ color: '#FF3333', fontSize: '0.7em', textAlign: 'center' }}>MINING ACTIVE</div>}
```

**Step 2: Make DetailPanel reactive to scan discoveries**

In `DetailPanel.tsx`, ensure the component re-reads `discoveries` on every render (it already does via `useStore`). The issue is likely that `selectedSector` doesn't update after scan. Verify the store subscription includes discoveries:

```typescript
const discoveries = useStore((s) => s.discoveries);
const selectedSector = useStore((s) => s.selectedSector);
```

If the detail view is stale, add a key prop to force re-render:
```typescript
const sectorKey = selectedSector ? `${selectedSector.x}:${selectedSector.y}` : 'none';
const sector = discoveries[sectorKey];
```

**Step 3: Commit**

```bash
git add packages/client/src/components/NavControls.tsx packages/client/src/components/DetailPanel.tsx
git commit -m "fix: disable navigation during mining and refresh detail view on scan (#17)"
```

---

### Task 3: UI Fix — Custom Scrollbars + Fade Effect (Bug #16 partial)

**Files:**
- Modify: `packages/client/src/styles/global.css`
- Modify: `packages/client/src/styles/crt.css`

**Context:** No custom scrollbar CSS exists. Fade-out vignette effect at `.crt-vignette` (crt.css lines 73-81) is too strong at `rgba(0,0,0,0.7)`.

**Step 1: Add CRT-style scrollbar CSS**

In `packages/client/src/styles/global.css`, add at the end:

```css
/* CRT Amber Scrollbars */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #0a0a0a;
  border-left: 1px solid rgba(255, 176, 0, 0.1);
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 176, 0, 0.3);
  border: 1px solid rgba(255, 176, 0, 0.15);
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 176, 0, 0.5);
}
::-webkit-scrollbar-corner {
  background: #0a0a0a;
}

/* Firefox scrollbar */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 176, 0, 0.3) #0a0a0a;
}
```

**Step 2: Reduce vignette fade effect**

In `packages/client/src/styles/crt.css`, change the vignette (lines 73-81):

```css
.crt-vignette {
  background: radial-gradient(
    ellipse at center,
    transparent 65%,
    rgba(0, 0, 0, 0.3) 100%
  );
}
```

Changed: `transparent 60%` → `transparent 65%`, `rgba(0,0,0,0.7)` → `rgba(0,0,0,0.3)`.

**Step 3: Commit**

```bash
git add packages/client/src/styles/global.css packages/client/src/styles/crt.css
git commit -m "fix: add CRT amber scrollbars and reduce vignette fade (#16)"
```

---

### Task 4: UI Fix — Fixed Monitor Width + Detail Auto-Update (Bug #16 rest)

**Files:**
- Modify: `packages/client/src/styles/crt.css`
- Modify: `packages/client/src/components/DetailPanel.tsx`

**Context:** Sidebar monitors use `auto` width which causes layout jump on switch. Detail panel should have a toggle to auto-follow player position.

**Step 1: Fix sidebar monitor widths**

In `packages/client/src/styles/crt.css`, add fixed width to sidebar containers:

```css
.sidebar-left,
.sidebar-right {
  width: 320px;
  min-width: 320px;
  max-width: 320px;
}
```

This ensures monitors don't resize when switching between different content screens.

**Step 2: Add auto-follow toggle to DetailPanel**

In `packages/client/src/components/DetailPanel.tsx`, add a toggle state and button:

```typescript
const [autoFollow, setAutoFollow] = useState(false);
const position = useStore((s) => s.position);
const setSelectedSector = useStore((s) => s.setSelectedSector);

useEffect(() => {
  if (autoFollow && position) {
    setSelectedSector({ x: position.x, y: position.y });
  }
}, [autoFollow, position?.x, position?.y, setSelectedSector]);
```

Add a retro toggle button at the top of the detail panel:

```tsx
<button
  onClick={() => setAutoFollow(!autoFollow)}
  style={{
    background: autoFollow ? 'rgba(255, 176, 0, 0.2)' : 'transparent',
    border: `1px solid ${autoFollow ? '#FFB000' : 'rgba(255, 176, 0, 0.3)'}`,
    color: '#FFB000',
    fontFamily: 'inherit',
    fontSize: '0.7em',
    padding: '2px 8px',
    cursor: 'pointer',
  }}
>
  {autoFollow ? '● AUTO' : '○ AUTO'}
</button>
```

**Step 3: Commit**

```bash
git add packages/client/src/styles/crt.css packages/client/src/components/DetailPanel.tsx
git commit -m "fix: fixed sidebar width and detail auto-follow toggle (#16)"
```

---

### Task 5: Shared Types + Constants — Fuel & Phase 5

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

**Context:** Add all new types and constants needed for Phase 5 Block A (fuel) and prepare types for later blocks (jumpgates, rescue, faction upgrades, trade routes, custom slates).

**Step 1: Add new types to `packages/shared/src/types.ts`**

After the existing types (end of file, after line 519), add:

```typescript
// --- Phase 5: Deep Systems ---

// Fuel
export interface RefuelMessage { amount: number; }
export interface RefuelResultMessage { success: boolean; error?: string; fuel?: FuelState; credits?: number; }

// Faction Upgrades
export type FactionUpgradeChoice = 'A' | 'B';
export interface FactionUpgradeTier {
  tier: number;
  optionA: { name: string; effect: string; };
  optionB: { name: string; effect: string; };
  cost: number;
}
export interface FactionUpgradeState {
  tier: number;
  choice: FactionUpgradeChoice;
  chosenAt: number;
}
export interface FactionUpgradeMessage { tier: number; choice: FactionUpgradeChoice; }
export interface FactionUpgradeResultMessage { success: boolean; error?: string; upgrades?: FactionUpgradeState[]; }

// JumpGates
export type JumpGateType = 'bidirectional' | 'wormhole';
export interface JumpGate {
  id: string;
  sectorX: number;
  sectorY: number;
  targetX: number;
  targetY: number;
  gateType: JumpGateType;
  requiresCode: boolean;
  requiresMinigame: boolean;
}
export interface UseJumpGateMessage { gateId: string; accessCode?: string; }
export interface UseJumpGateResultMessage {
  success: boolean;
  error?: string;
  requiresMinigame?: boolean;
  targetX?: number;
  targetY?: number;
  fuel?: FuelState;
}
export interface FrequencyMatchResultMessage { gateId: string; matched: boolean; }

// Rescue Missions
export interface RescueSurvivor {
  id: string;
  sectorX: number;
  sectorY: number;
  survivorCount: number;
  expiresAt: number;
}
export interface DistressCall {
  id: string;
  direction: string;  // 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
  estimatedDistance: number;
  receivedAt: number;
  expiresAt: number;
  actualX: number;
  actualY: number;
}
export interface RescueMessage { sectorX: number; sectorY: number; }
export interface RescueResultMessage {
  success: boolean;
  error?: string;
  survivorsRescued?: number;
  safeSlotsFree?: number;
}
export interface DeliverSurvivorsMessage { stationX: number; stationY: number; }
export interface DeliverSurvivorsResultMessage {
  success: boolean;
  error?: string;
  credits?: number;
  rep?: number;
  xp?: number;
}

// Trade Routes
export interface TradeRoute {
  id: string;
  ownerId: string;
  tradingPostId: string;
  targetX: number;
  targetY: number;
  sellResource: ResourceType | null;
  sellAmount: number;
  buyResource: ResourceType | null;
  buyAmount: number;
  cycleMinutes: number;
  active: boolean;
  lastCycleAt: number | null;
}
export interface ConfigureRouteMessage {
  tradingPostId: string;
  targetX: number;
  targetY: number;
  sellResource: ResourceType | null;
  sellAmount: number;
  buyResource: ResourceType | null;
  buyAmount: number;
  cycleMinutes: number;
}
export interface ConfigureRouteResultMessage {
  success: boolean;
  error?: string;
  route?: TradeRoute;
}
export interface ToggleRouteMessage { routeId: string; active: boolean; }
export interface DeleteRouteMessage { routeId: string; }

// Custom Data Slates (extends existing DataSlate)
export interface CustomSlateData {
  label: string;
  coordinates?: Coords[];
  codes?: string[];
  notes?: string;
}
export interface CreateCustomSlateMessage {
  label: string;
  coordinates?: Coords[];
  codes?: string[];
  notes?: string;
}
```

**Step 2: Add new constants to `packages/shared/src/constants.ts`**

After the existing constants (end of file, after line 302), add:

```typescript
// --- Phase 5: Deep Systems ---

// Fuel
export const FUEL_COST_PER_UNIT = 2;  // Credits per fuel unit when refueling

// Faction Upgrade Tree (binary choices per tier)
export const FACTION_UPGRADE_TIERS: Record<number, {
  optionA: { name: string; effect: string; };
  optionB: { name: string; effect: string; };
  cost: number;
}> = {
  1: {
    optionA: { name: 'MINING BOOST', effect: '+15% mining rate' },
    optionB: { name: 'CARGO EXPANSION', effect: '+3 cargo capacity' },
    cost: 500,
  },
  2: {
    optionA: { name: 'SCAN RANGE', effect: '+1 area scan radius' },
    optionB: { name: 'AP REGEN', effect: '+20% AP regeneration' },
    cost: 1500,
  },
  3: {
    optionA: { name: 'COMBAT BONUS', effect: '+15% combat bonus' },
    optionB: { name: 'TRADE DISCOUNT', effect: '-10% NPC trade prices' },
    cost: 5000,
  },
};

// JumpGates
export const JUMPGATE_CHANCE = 0.02;           // 2% of sectors have a gate
export const JUMPGATE_SALT = 777;
export const JUMPGATE_FUEL_COST = 1;           // Flat fuel per gate use
export const JUMPGATE_MIN_RANGE = 50;
export const JUMPGATE_MAX_RANGE = 10000;
export const JUMPGATE_CODE_LENGTH = 8;
export const JUMPGATE_MINIGAME_CHANCE = 0.3;   // 30% of gates require minigame
export const JUMPGATE_CODE_CHANCE = 0.5;        // 50% of gates require code
export const FREQUENCY_MATCH_THRESHOLD = 0.9;   // 90% match required

// Rescue Missions
export const RESCUE_AP_COST = 5;
export const RESCUE_DELIVER_AP_COST = 3;
export const RESCUE_EXPIRY_MINUTES = 30;
export const DISTRESS_CALL_CHANCE = 0.08;       // 8% per sector enter
export const DISTRESS_DIRECTION_VARIANCE = 0.3; // ±30% distance estimation
export const RESCUE_REWARDS = {
  scan_event: { credits: 50, rep: 10, xp: 25 },
  npc_quest: { credits: 80, rep: 15, xp: 40 },
  comm_distress: { credits: 100, rep: 20, xp: 50 },
} as const;

// Trade Routes
export const MAX_TRADE_ROUTES = 3;
export const TRADE_ROUTE_MIN_CYCLE = 15;   // minutes
export const TRADE_ROUTE_MAX_CYCLE = 120;  // minutes
export const TRADE_ROUTE_FUEL_PER_DISTANCE = 0.5;

// Custom Data Slates
export const CUSTOM_SLATE_AP_COST = 2;
export const CUSTOM_SLATE_CREDIT_COST = 5;
export const CUSTOM_SLATE_MAX_COORDS = 20;
export const CUSTOM_SLATE_MAX_CODES = 10;
export const CUSTOM_SLATE_MAX_NOTES_LENGTH = 500;

// Multi-content sectors
export const SECTOR_MAX_FEATURES = 3;
```

**Step 3: Run shared tests**

Run: `cd packages/shared && npx vitest run`
Expected: All 5 tests pass (types + constants are compile-time, no runtime breakage)

**Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat: add Phase 5 shared types and constants (fuel, gates, rescue, routes, upgrades)"
```

---

### Task 6: DB Migration 009 — Fuel Tracking in Redis (no SQL migration needed)

**Files:**
- Modify: `packages/server/src/rooms/services/RedisAPStore.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts:380-454`

**Context:** Fuel state is already defined in types (`FuelState`). AP is stored in Redis. Fuel should follow the same pattern. Ship fuel starts at `SHIP_CLASSES[shipClass].fuelMax`.

**Step 1: Add fuel Redis helpers to RedisAPStore.ts**

In `packages/server/src/rooms/services/RedisAPStore.ts`, add alongside existing AP helpers:

```typescript
export async function saveFuelState(userId: string, fuel: number): Promise<void> {
  await redis.set(`fuel:${userId}`, fuel.toString());
}

export async function getFuelState(userId: string): Promise<number | null> {
  const val = await redis.get(`fuel:${userId}`);
  return val !== null ? parseFloat(val) : null;
}
```

**Step 2: Add fuel deduction to handleJump**

In `packages/server/src/rooms/SectorRoom.ts`, in `handleJump()` after the AP deduction (around line 412):

```typescript
// Deduct fuel
const currentFuel = await getFuelState(auth.userId);
const fuelCost = ship.fuelPerJump;
if (currentFuel === null || currentFuel < fuelCost) {
  client.send('jumpResult', { success: false, error: 'Not enough fuel' });
  return;
}
const newFuel = currentFuel - fuelCost;
await saveFuelState(auth.userId, newFuel);
```

Move this BEFORE the AP deduction so fuel is checked first (no AP wasted on failed fuel check).

Also send fuel in the jumpResult message:
```typescript
client.send('jumpResult', {
  success: true,
  newSector: sectorData,
  apRemaining: jumpResult.newAP!.current,
  fuelRemaining: newFuel,
});
```

**Step 3: Initialize fuel on player join**

In `onJoin()`, after loading ship data, initialize fuel if not in Redis:

```typescript
const existingFuel = await getFuelState(auth.userId);
if (existingFuel === null) {
  await saveFuelState(auth.userId, ship.fuelMax);
}
const fuel = existingFuel ?? ship.fuelMax;
client.send('fuelUpdate', { current: fuel, max: ship.fuelMax });
```

**Step 4: Add refuel handler**

Register in `onCreate()`:
```typescript
this.onMessage('refuel', (client, data) => this.handleRefuel(client, data));
```

Add method:
```typescript
private async handleRefuel(client: Client, data: RefuelMessage): Promise<void> {
  const auth = this.getAuth(client);
  const ship = await getPlayerShip(auth.userId);
  if (!ship) return;

  const currentFuel = await getFuelState(auth.userId) ?? 0;
  const maxRefuel = ship.fuelMax - currentFuel;
  const amount = Math.min(data.amount, maxRefuel);
  if (amount <= 0) {
    client.send('refuelResult', { success: false, error: 'Fuel tank is full' });
    return;
  }

  // Must be at a station
  const sectorType = this.state.sector.type;
  if (sectorType !== 'station') {
    client.send('refuelResult', { success: false, error: 'Must be at a station to refuel' });
    return;
  }

  const cost = amount * FUEL_COST_PER_UNIT;
  const credits = await getPlayerCredits(auth.userId);
  if (credits < cost) {
    client.send('refuelResult', { success: false, error: 'Not enough credits' });
    return;
  }

  await deductCredits(auth.userId, cost);
  const newFuel = currentFuel + amount;
  await saveFuelState(auth.userId, newFuel);

  client.send('refuelResult', {
    success: true,
    fuel: { current: newFuel, max: ship.fuelMax },
    credits: credits - cost,
  });
}
```

**Step 5: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/server/src/rooms/services/RedisAPStore.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: activate fuel system — deduction on jump, refuel at stations (#14)"
```

---

### Task 7: Client — Fuel UI

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/client/src/components/StatusBar.tsx`
- Modify: `packages/client/src/components/DetailPanel.tsx`

**Context:** Store already has `fuel: FuelState | null` (gameSlice line 29) and `setFuel` action. Network needs `fuelUpdate` handler and `sendRefuel` method. StatusBar should show fuel bar next to AP bar. DetailPanel shows refuel button at stations.

**Step 1: Add network handlers**

In `packages/client/src/network/client.ts`, in `setupRoomListeners()`:

```typescript
room.onMessage('fuelUpdate', (data: FuelState) => {
  useStore.setState({ fuel: data });
});

room.onMessage('refuelResult', (data: any) => {
  if (data.success && data.fuel) {
    useStore.setState({ fuel: data.fuel });
  }
  if (data.success && data.credits !== undefined) {
    useStore.setState({ credits: data.credits });
  }
  if (!data.success) {
    console.warn('[FUEL] Refuel failed:', data.error);
  }
});

// Update jumpResult handler to also set fuel
// In existing jumpResult handler, add:
if (data.fuelRemaining !== undefined) {
  const currentFuel = useStore.getState().fuel;
  if (currentFuel) {
    useStore.setState({ fuel: { ...currentFuel, current: data.fuelRemaining } });
  }
}
```

Add send method:
```typescript
sendRefuel(amount: number): void {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('refuel', { amount });
}
```

**Step 2: Add fuel bar to StatusBar**

In `packages/client/src/components/StatusBar.tsx`, read fuel from store and render a bar similar to AP:

```typescript
const fuel = useStore((s) => s.fuel);

// Render fuel bar after AP bar:
{fuel && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ fontSize: '0.75em', color: 'rgba(255,176,0,0.6)' }}>FUEL</span>
    <div style={{ width: 80, height: 8, background: '#1a1a1a', border: '1px solid rgba(255,176,0,0.3)' }}>
      <div style={{
        width: `${(fuel.current / fuel.max) * 100}%`,
        height: '100%',
        background: fuel.current < fuel.max * 0.2 ? '#FF3333' : '#FFB000',
        transition: 'width 0.3s',
      }} />
    </div>
    <span style={{ fontSize: '0.7em' }}>{Math.floor(fuel.current)}/{fuel.max}</span>
  </div>
)}
```

**Step 3: Add refuel button to DetailPanel**

In `packages/client/src/components/DetailPanel.tsx`, when player is at a station sector:

```typescript
const fuel = useStore((s) => s.fuel);
const sectorType = sector?.type;

{isPlayerHere && sectorType === 'station' && fuel && fuel.current < fuel.max && (
  <button
    onClick={() => gameNetwork.sendRefuel(fuel.max - fuel.current)}
    style={{
      background: 'transparent',
      border: '1px solid #FFB000',
      color: '#FFB000',
      fontFamily: 'inherit',
      padding: '4px 12px',
      cursor: 'pointer',
      marginTop: 8,
    }}
  >
    REFUEL ({Math.ceil((fuel.max - fuel.current) * FUEL_COST_PER_UNIT)} CR)
  </button>
)}
```

**Step 4: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts packages/client/src/components/StatusBar.tsx packages/client/src/components/DetailPanel.tsx
git commit -m "feat: fuel UI — status bar, refuel button at stations (#14)"
```

---

### Task 8: Server Tests — Fuel + Mining Lock

**Files:**
- Modify: `packages/server/src/engine/__tests__/commands.test.ts`
- Create: `packages/server/src/engine/__tests__/fuel.test.ts`

**Step 1: Write fuel tests**

Create `packages/server/src/engine/__tests__/fuel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { FUEL_COST_PER_UNIT, SHIP_CLASSES } from '@void-sector/shared';

describe('Fuel System', () => {
  const ship = SHIP_CLASSES.aegis_scout_mk1;

  it('should have fuel cost per unit defined', () => {
    expect(FUEL_COST_PER_UNIT).toBe(2);
  });

  it('should define fuelPerJump for all ship classes', () => {
    for (const [, shipClass] of Object.entries(SHIP_CLASSES)) {
      expect(shipClass.fuelPerJump).toBeGreaterThan(0);
      expect(shipClass.fuelMax).toBeGreaterThan(0);
    }
  });

  it('aegis scout should have 20 jumps worth of fuel', () => {
    expect(ship.fuelMax / ship.fuelPerJump).toBe(20);
  });

  it('refuel cost should be calculable', () => {
    const emptyAmount = ship.fuelMax;
    const cost = emptyAmount * FUEL_COST_PER_UNIT;
    expect(cost).toBe(200); // 100 fuel * 2 credits
  });
});
```

**Step 2: Run tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/server/src/engine/__tests__/fuel.test.ts packages/server/src/engine/__tests__/commands.test.ts
git commit -m "test: fuel system and mining lock validation tests"
```

---

### Task 9: DB Migration 009 — Faction Upgrades + JumpGates + Trade Routes + Rescue

**Files:**
- Create: `packages/server/src/db/migrations/009_phase5_deep_systems.sql`

**Context:** All Phase 5 tables in one migration. Follow existing pattern: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.

**Step 1: Write migration**

```sql
-- 009: Phase 5 Deep Systems

-- Faction upgrade choices (binary per tier)
CREATE TABLE IF NOT EXISTS faction_upgrades (
  faction_id TEXT NOT NULL,
  tier INTEGER NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('A', 'B')),
  chosen_by TEXT NOT NULL,
  chosen_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (faction_id, tier)
);

-- JumpGates (deterministically generated, cached)
CREATE TABLE IF NOT EXISTS jumpgates (
  id TEXT PRIMARY KEY,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  target_x INTEGER NOT NULL,
  target_y INTEGER NOT NULL,
  gate_type TEXT NOT NULL CHECK (gate_type IN ('bidirectional', 'wormhole')),
  requires_code BOOLEAN DEFAULT FALSE,
  requires_minigame BOOLEAN DEFAULT FALSE,
  access_code TEXT,
  UNIQUE(sector_x, sector_y)
);
CREATE INDEX IF NOT EXISTS idx_jumpgates_sector ON jumpgates(sector_x, sector_y);
CREATE INDEX IF NOT EXISTS idx_jumpgates_target ON jumpgates(target_x, target_y);

-- Player-discovered gate codes
CREATE TABLE IF NOT EXISTS gate_codes (
  player_id TEXT NOT NULL,
  gate_id TEXT NOT NULL REFERENCES jumpgates(id),
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, gate_id)
);

-- Rescued survivors (in transit on ship)
CREATE TABLE IF NOT EXISTS rescued_survivors (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  origin_x INTEGER NOT NULL,
  origin_y INTEGER NOT NULL,
  survivor_count INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL CHECK (source_type IN ('scan_event', 'npc_quest', 'comm_distress')),
  rescued_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rescued_survivors_player ON rescued_survivors(player_id);

-- Active distress calls (comm-range based)
CREATE TABLE IF NOT EXISTS distress_calls (
  id TEXT PRIMARY KEY,
  target_x INTEGER NOT NULL,
  target_y INTEGER NOT NULL,
  survivor_count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player received distress calls
CREATE TABLE IF NOT EXISTS player_distress_calls (
  player_id TEXT NOT NULL,
  distress_id TEXT NOT NULL REFERENCES distress_calls(id),
  direction TEXT NOT NULL,
  estimated_distance REAL NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  completed BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (player_id, distress_id)
);

-- Trade routes (auto-trading)
CREATE TABLE IF NOT EXISTS trade_routes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  trading_post_id TEXT NOT NULL,
  target_x INTEGER NOT NULL,
  target_y INTEGER NOT NULL,
  sell_resource TEXT,
  sell_amount INTEGER DEFAULT 0,
  buy_resource TEXT,
  buy_amount INTEGER DEFAULT 0,
  cycle_minutes INTEGER DEFAULT 30,
  active BOOLEAN DEFAULT TRUE,
  last_cycle_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trade_routes_owner ON trade_routes(owner_id);

-- Add custom_data column to slates table
DO $$ BEGIN
  ALTER TABLE slates ADD COLUMN IF NOT EXISTS custom_data JSONB;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
```

**Step 2: Verify migration runs**

Run: `npm run dev:server` (migrations auto-run on startup)
Expected: Server starts, migration 009 applied, no errors

**Step 3: Commit**

```bash
git add packages/server/src/db/migrations/009_phase5_deep_systems.sql
git commit -m "feat: add migration 009 — faction upgrades, jumpgates, rescue, trade routes"
```

---

### Task 10: Server Queries — Phase 5 DB Layer

**Files:**
- Modify: `packages/server/src/db/queries.ts`

**Context:** Add query functions for all new Phase 5 tables. Follow existing pattern: exported async functions, parameterized queries, return typed results.

**Step 1: Add faction upgrade queries**

After `setPlayerLevel()` (line 1101), add:

```typescript
// --- Phase 5: Deep Systems ---

// Faction Upgrades
export async function getFactionUpgrades(factionId: string): Promise<Array<{ tier: number; choice: string; chosenAt: string }>> {
  const { rows } = await query(
    `SELECT tier, choice, chosen_at as "chosenAt" FROM faction_upgrades WHERE faction_id = $1 ORDER BY tier`,
    [factionId]
  );
  return rows;
}

export async function setFactionUpgrade(factionId: string, tier: number, choice: string, chosenBy: string): Promise<void> {
  await query(
    `INSERT INTO faction_upgrades (faction_id, tier, choice, chosen_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (faction_id, tier) DO NOTHING`,
    [factionId, tier, choice, chosenBy]
  );
}

// JumpGates
export async function getJumpGate(sectorX: number, sectorY: number): Promise<any | null> {
  const { rows } = await query(
    `SELECT id, sector_x as "sectorX", sector_y as "sectorY", target_x as "targetX", target_y as "targetY",
     gate_type as "gateType", requires_code as "requiresCode", requires_minigame as "requiresMinigame", access_code as "accessCode"
     FROM jumpgates WHERE sector_x = $1 AND sector_y = $2`,
    [sectorX, sectorY]
  );
  return rows[0] ?? null;
}

export async function insertJumpGate(gate: {
  id: string; sectorX: number; sectorY: number; targetX: number; targetY: number;
  gateType: string; requiresCode: boolean; requiresMinigame: boolean; accessCode: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO jumpgates (id, sector_x, sector_y, target_x, target_y, gate_type, requires_code, requires_minigame, access_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (sector_x, sector_y) DO NOTHING`,
    [gate.id, gate.sectorX, gate.sectorY, gate.targetX, gate.targetY, gate.gateType, gate.requiresCode, gate.requiresMinigame, gate.accessCode]
  );
}

export async function playerHasGateCode(playerId: string, gateId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM gate_codes WHERE player_id = $1 AND gate_id = $2`,
    [playerId, gateId]
  );
  return rows.length > 0;
}

export async function addGateCode(playerId: string, gateId: string): Promise<void> {
  await query(
    `INSERT INTO gate_codes (player_id, gate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [playerId, gateId]
  );
}

// Rescued Survivors
export async function getPlayerSurvivors(playerId: string): Promise<Array<{ id: string; originX: number; originY: number; survivorCount: number; sourceType: string }>> {
  const { rows } = await query(
    `SELECT id, origin_x as "originX", origin_y as "originY", survivor_count as "survivorCount", source_type as "sourceType"
     FROM rescued_survivors WHERE player_id = $1`,
    [playerId]
  );
  return rows;
}

export async function insertRescuedSurvivor(id: string, playerId: string, originX: number, originY: number, count: number, sourceType: string): Promise<void> {
  await query(
    `INSERT INTO rescued_survivors (id, player_id, origin_x, origin_y, survivor_count, source_type) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, playerId, originX, originY, count, sourceType]
  );
}

export async function deletePlayerSurvivors(playerId: string): Promise<number> {
  const result = await query(`DELETE FROM rescued_survivors WHERE player_id = $1`, [playerId]);
  return result.rowCount ?? 0;
}

// Distress Calls
export async function insertDistressCall(id: string, targetX: number, targetY: number, survivorCount: number, expiresAt: Date): Promise<void> {
  await query(
    `INSERT INTO distress_calls (id, target_x, target_y, survivor_count, expires_at) VALUES ($1, $2, $3, $4, $5)`,
    [id, targetX, targetY, survivorCount, expiresAt]
  );
}

export async function insertPlayerDistressCall(playerId: string, distressId: string, direction: string, estimatedDistance: number): Promise<void> {
  await query(
    `INSERT INTO player_distress_calls (player_id, distress_id, direction, estimated_distance) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [playerId, distressId, direction, estimatedDistance]
  );
}

export async function getPlayerDistressCalls(playerId: string): Promise<Array<{
  distressId: string; direction: string; estimatedDistance: number; receivedAt: string;
  targetX: number; targetY: number; expiresAt: string; completed: boolean;
}>> {
  const { rows } = await query(
    `SELECT pdc.distress_id as "distressId", pdc.direction, pdc.estimated_distance as "estimatedDistance",
     pdc.received_at as "receivedAt", pdc.completed,
     dc.target_x as "targetX", dc.target_y as "targetY", dc.expires_at as "expiresAt"
     FROM player_distress_calls pdc
     JOIN distress_calls dc ON dc.id = pdc.distress_id
     WHERE pdc.player_id = $1 AND pdc.completed = FALSE AND dc.expires_at > NOW()`,
    [playerId]
  );
  return rows;
}

export async function completeDistressCall(playerId: string, distressId: string): Promise<void> {
  await query(
    `UPDATE player_distress_calls SET completed = TRUE WHERE player_id = $1 AND distress_id = $2`,
    [playerId, distressId]
  );
}

// Trade Routes
export async function getPlayerTradeRoutes(playerId: string): Promise<TradeRoute[]> {
  const { rows } = await query(
    `SELECT id, owner_id as "ownerId", trading_post_id as "tradingPostId",
     target_x as "targetX", target_y as "targetY",
     sell_resource as "sellResource", sell_amount as "sellAmount",
     buy_resource as "buyResource", buy_amount as "buyAmount",
     cycle_minutes as "cycleMinutes", active, last_cycle_at as "lastCycleAt",
     created_at as "createdAt"
     FROM trade_routes WHERE owner_id = $1 ORDER BY created_at`,
    [playerId]
  );
  return rows;
}

export async function insertTradeRoute(route: {
  id: string; ownerId: string; tradingPostId: string;
  targetX: number; targetY: number;
  sellResource: string | null; sellAmount: number;
  buyResource: string | null; buyAmount: number;
  cycleMinutes: number;
}): Promise<void> {
  await query(
    `INSERT INTO trade_routes (id, owner_id, trading_post_id, target_x, target_y,
     sell_resource, sell_amount, buy_resource, buy_amount, cycle_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [route.id, route.ownerId, route.tradingPostId, route.targetX, route.targetY,
     route.sellResource, route.sellAmount, route.buyResource, route.buyAmount, route.cycleMinutes]
  );
}

export async function updateTradeRouteActive(routeId: string, active: boolean): Promise<void> {
  await query(`UPDATE trade_routes SET active = $2 WHERE id = $1`, [routeId, active]);
}

export async function updateTradeRouteLastCycle(routeId: string): Promise<void> {
  await query(`UPDATE trade_routes SET last_cycle_at = NOW() WHERE id = $1`, [routeId]);
}

export async function deleteTradeRoute(routeId: string, ownerId: string): Promise<boolean> {
  const result = await query(`DELETE FROM trade_routes WHERE id = $1 AND owner_id = $2`, [routeId, ownerId]);
  return (result.rowCount ?? 0) > 0;
}

export async function getActiveTradeRoutes(): Promise<TradeRoute[]> {
  const { rows } = await query(
    `SELECT id, owner_id as "ownerId", trading_post_id as "tradingPostId",
     target_x as "targetX", target_y as "targetY",
     sell_resource as "sellResource", sell_amount as "sellAmount",
     buy_resource as "buyResource", buy_amount as "buyAmount",
     cycle_minutes as "cycleMinutes", active, last_cycle_at as "lastCycleAt"
     FROM trade_routes WHERE active = TRUE`
  );
  return rows;
}
```

**Step 2: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat: add Phase 5 DB query functions (upgrades, gates, rescue, routes)"
```

---

### Task 11: Server Engine — JumpGate Generation

**Files:**
- Create: `packages/server/src/engine/jumpgates.ts`
- Create: `packages/server/src/engine/__tests__/jumpgates.test.ts`

**Context:** JumpGates are deterministically generated using world seed, similar to sector types. When a player scans or enters a sector, the server checks if a gate exists there.

**Step 1: Write tests**

Create `packages/server/src/engine/__tests__/jumpgates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { checkJumpGate, generateGateTarget, getDirectionFromAngle } from '../jumpgates.js';
import { JUMPGATE_CHANCE, JUMPGATE_SALT, WORLD_SEED } from '@void-sector/shared';

describe('JumpGate Generation', () => {
  it('should deterministically detect gates', () => {
    const result1 = checkJumpGate(100, 200);
    const result2 = checkJumpGate(100, 200);
    expect(result1).toEqual(result2);
  });

  it('should generate gate targets within range', () => {
    const target = generateGateTarget(50, 50);
    expect(target.targetX).toBeDefined();
    expect(target.targetY).toBeDefined();
    const dist = Math.sqrt((target.targetX - 50) ** 2 + (target.targetY - 50) ** 2);
    expect(dist).toBeGreaterThanOrEqual(50);
    expect(dist).toBeLessThanOrEqual(10000);
  });

  it('should convert angles to compass directions', () => {
    expect(getDirectionFromAngle(0)).toBe('E');
    expect(getDirectionFromAngle(90)).toBe('N');
    expect(getDirectionFromAngle(180)).toBe('W');
    expect(getDirectionFromAngle(270)).toBe('S');
    expect(getDirectionFromAngle(45)).toBe('NE');
  });

  it('should respect JUMPGATE_CHANCE probability', () => {
    let gateCount = 0;
    const total = 10000;
    for (let i = 0; i < total; i++) {
      if (checkJumpGate(i, i * 7)) gateCount++;
    }
    const ratio = gateCount / total;
    expect(ratio).toBeGreaterThan(0.01);
    expect(ratio).toBeLessThan(0.04);
  });
});
```

**Step 2: Write implementation**

Create `packages/server/src/engine/jumpgates.ts`:

```typescript
import { hashCoords } from './worldgen.js';
import {
  WORLD_SEED, JUMPGATE_SALT, JUMPGATE_CHANCE,
  JUMPGATE_MIN_RANGE, JUMPGATE_MAX_RANGE,
  JUMPGATE_CODE_CHANCE, JUMPGATE_MINIGAME_CHANCE,
  JUMPGATE_CODE_LENGTH,
} from '@void-sector/shared';
import type { JumpGateType } from '@void-sector/shared';

export function checkJumpGate(sectorX: number, sectorY: number): boolean {
  const hash = hashCoords(sectorX, sectorY, WORLD_SEED + JUMPGATE_SALT);
  return (hash % 10000) / 10000 < JUMPGATE_CHANCE;
}

export function generateGateTarget(sectorX: number, sectorY: number): {
  targetX: number; targetY: number; gateType: JumpGateType;
  requiresCode: boolean; requiresMinigame: boolean; accessCode: string | null;
} {
  const hash = hashCoords(sectorX, sectorY, WORLD_SEED + JUMPGATE_SALT + 1);
  const hash2 = hashCoords(sectorX, sectorY, WORLD_SEED + JUMPGATE_SALT + 2);
  const hash3 = hashCoords(sectorX, sectorY, WORLD_SEED + JUMPGATE_SALT + 3);

  // Distance: weighted toward shorter ranges
  const distNorm = (hash % 10000) / 10000;
  const distance = Math.floor(JUMPGATE_MIN_RANGE + (distNorm ** 2) * (JUMPGATE_MAX_RANGE - JUMPGATE_MIN_RANGE));

  // Angle
  const angle = ((hash2 % 3600) / 3600) * 2 * Math.PI;
  const targetX = sectorX + Math.round(Math.cos(angle) * distance);
  const targetY = sectorY + Math.round(Math.sin(angle) * distance);

  // Gate type: 60% bidirectional, 40% wormhole
  const gateType: JumpGateType = (hash3 % 100) < 60 ? 'bidirectional' : 'wormhole';

  // Code/minigame requirements
  const requiresCode = ((hash3 >>> 8) % 100) / 100 < JUMPGATE_CODE_CHANCE;
  const requiresMinigame = ((hash3 >>> 16) % 100) / 100 < JUMPGATE_MINIGAME_CHANCE;

  // Generate access code
  const accessCode = requiresCode ? generateAccessCode(hash3) : null;

  return { targetX, targetY, gateType, requiresCode, requiresMinigame, accessCode };
}

function generateAccessCode(seed: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  let s = seed;
  for (let i = 0; i < JUMPGATE_CODE_LENGTH; i++) {
    code += chars[Math.abs(s) % chars.length];
    s = (s * 1103515245 + 12345) | 0;
  }
  return code;
}

export function getDirectionFromAngle(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

export function calculateDirection(fromX: number, fromY: number, toX: number, toY: number): string {
  const angle = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);
  return getDirectionFromAngle(angle);
}

export function estimateDistance(actual: number, variance: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * variance;
  return Math.round(actual * factor);
}
```

**Step 3: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/jumpgates.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/server/src/engine/jumpgates.ts packages/server/src/engine/__tests__/jumpgates.test.ts
git commit -m "feat: jumpgate generation engine with deterministic placement"
```

---

### Task 12: Server Engine — Rescue & Distress Calls

**Files:**
- Create: `packages/server/src/engine/rescue.ts`
- Create: `packages/server/src/engine/__tests__/rescue.test.ts`

**Context:** Three rescue triggers: scan-event distress_signal (existing), NPC quest (existing quest type), comm-range distress calls (new). The new comm-range system generates distress calls when entering sectors, checks if any active calls are in comm range, and sends direction hints.

**Step 1: Write tests**

Create `packages/server/src/engine/__tests__/rescue.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { checkDistressCall, calculateRescueReward, canRescue } from '../rescue.js';
import { DISTRESS_CALL_CHANCE, RESCUE_REWARDS, SHIP_CLASSES } from '@void-sector/shared';

describe('Rescue System', () => {
  it('should check distress call chance', () => {
    let calls = 0;
    for (let i = 0; i < 10000; i++) {
      if (checkDistressCall(i, i * 3)) calls++;
    }
    const ratio = calls / 10000;
    expect(ratio).toBeGreaterThan(0.05);
    expect(ratio).toBeLessThan(0.12);
  });

  it('should calculate rewards by source type', () => {
    expect(calculateRescueReward('scan_event')).toEqual(RESCUE_REWARDS.scan_event);
    expect(calculateRescueReward('npc_quest')).toEqual(RESCUE_REWARDS.npc_quest);
    expect(calculateRescueReward('comm_distress')).toEqual(RESCUE_REWARDS.comm_distress);
  });

  it('should check if rescue is possible (safeSlots)', () => {
    const ship = SHIP_CLASSES.aegis_scout_mk1;
    expect(canRescue(ship.safeSlots, 0)).toBe(true);   // 1 slot, 0 used
    expect(canRescue(ship.safeSlots, 1)).toBe(false);   // 1 slot, 1 used
  });

  it('void_seeker should have more safe slots', () => {
    const ship = SHIP_CLASSES.void_seeker_mk2;
    expect(canRescue(ship.safeSlots, 2)).toBe(true);    // 3 slots, 2 used
    expect(canRescue(ship.safeSlots, 3)).toBe(false);   // 3 slots, 3 used
  });
});
```

**Step 2: Write implementation**

Create `packages/server/src/engine/rescue.ts`:

```typescript
import { hashCoords } from './worldgen.js';
import { calculateDirection, estimateDistance } from './jumpgates.js';
import {
  WORLD_SEED, DISTRESS_CALL_CHANCE,
  DISTRESS_DIRECTION_VARIANCE, RESCUE_REWARDS,
} from '@void-sector/shared';

const DISTRESS_SALT = 999;

export function checkDistressCall(sectorX: number, sectorY: number): boolean {
  const hash = hashCoords(sectorX, sectorY, WORLD_SEED + DISTRESS_SALT);
  return (hash % 10000) / 10000 < DISTRESS_CALL_CHANCE;
}

export function generateDistressCallData(
  playerX: number, playerY: number,
  targetX: number, targetY: number,
): { direction: string; estimatedDistance: number } {
  const actualDistance = Math.sqrt((targetX - playerX) ** 2 + (targetY - playerY) ** 2);
  const direction = calculateDirection(playerX, playerY, targetX, targetY);
  const estimated = estimateDistance(actualDistance, DISTRESS_DIRECTION_VARIANCE);
  return { direction, estimatedDistance: estimated };
}

export function calculateRescueReward(sourceType: 'scan_event' | 'npc_quest' | 'comm_distress'): {
  credits: number; rep: number; xp: number;
} {
  return RESCUE_REWARDS[sourceType];
}

export function canRescue(safeSlots: number, usedSlots: number): boolean {
  return usedSlots < safeSlots;
}
```

**Step 3: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/rescue.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/server/src/engine/rescue.ts packages/server/src/engine/__tests__/rescue.test.ts
git commit -m "feat: rescue mission engine — distress calls, rewards, safe slot validation"
```

---

### Task 13: Server Engine — Faction Upgrade Bonuses

**Files:**
- Create: `packages/server/src/engine/factionBonuses.ts`
- Create: `packages/server/src/engine/__tests__/factionBonuses.test.ts`

**Context:** Faction upgrades apply modifiers to member actions. Each tier's choice gives a specific bonus. The engine needs to look up a player's faction's upgrades and return applicable modifiers.

**Step 1: Write tests**

Create `packages/server/src/engine/__tests__/factionBonuses.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateBonuses } from '../factionBonuses.js';
import type { FactionUpgradeChoice } from '@void-sector/shared';

describe('Faction Bonuses', () => {
  it('should return no bonuses for empty upgrades', () => {
    const bonuses = calculateBonuses([]);
    expect(bonuses.miningRateMultiplier).toBe(1.0);
    expect(bonuses.cargoCapBonus).toBe(0);
    expect(bonuses.scanRadiusBonus).toBe(0);
    expect(bonuses.apRegenMultiplier).toBe(1.0);
    expect(bonuses.combatMultiplier).toBe(1.0);
    expect(bonuses.tradePriceMultiplier).toBe(1.0);
  });

  it('should apply tier 1 option A: mining boost', () => {
    const bonuses = calculateBonuses([{ tier: 1, choice: 'A' as FactionUpgradeChoice }]);
    expect(bonuses.miningRateMultiplier).toBe(1.15);
  });

  it('should apply tier 1 option B: cargo expansion', () => {
    const bonuses = calculateBonuses([{ tier: 1, choice: 'B' as FactionUpgradeChoice }]);
    expect(bonuses.cargoCapBonus).toBe(3);
  });

  it('should apply tier 2 option A: scan range', () => {
    const bonuses = calculateBonuses([
      { tier: 1, choice: 'A' as FactionUpgradeChoice },
      { tier: 2, choice: 'A' as FactionUpgradeChoice },
    ]);
    expect(bonuses.scanRadiusBonus).toBe(1);
  });

  it('should stack all three tiers', () => {
    const bonuses = calculateBonuses([
      { tier: 1, choice: 'A' as FactionUpgradeChoice },
      { tier: 2, choice: 'B' as FactionUpgradeChoice },
      { tier: 3, choice: 'B' as FactionUpgradeChoice },
    ]);
    expect(bonuses.miningRateMultiplier).toBe(1.15);
    expect(bonuses.apRegenMultiplier).toBe(1.2);
    expect(bonuses.tradePriceMultiplier).toBe(0.9);
  });
});
```

**Step 2: Write implementation**

Create `packages/server/src/engine/factionBonuses.ts`:

```typescript
import type { FactionUpgradeChoice } from '@void-sector/shared';

export interface FactionBonuses {
  miningRateMultiplier: number;
  cargoCapBonus: number;
  scanRadiusBonus: number;
  apRegenMultiplier: number;
  combatMultiplier: number;
  tradePriceMultiplier: number;
}

const DEFAULT_BONUSES: FactionBonuses = {
  miningRateMultiplier: 1.0,
  cargoCapBonus: 0,
  scanRadiusBonus: 0,
  apRegenMultiplier: 1.0,
  combatMultiplier: 1.0,
  tradePriceMultiplier: 1.0,
};

export function calculateBonuses(upgrades: Array<{ tier: number; choice: FactionUpgradeChoice }>): FactionBonuses {
  const bonuses = { ...DEFAULT_BONUSES };

  for (const u of upgrades) {
    switch (u.tier) {
      case 1:
        if (u.choice === 'A') bonuses.miningRateMultiplier = 1.15;
        if (u.choice === 'B') bonuses.cargoCapBonus = 3;
        break;
      case 2:
        if (u.choice === 'A') bonuses.scanRadiusBonus = 1;
        if (u.choice === 'B') bonuses.apRegenMultiplier = 1.2;
        break;
      case 3:
        if (u.choice === 'A') bonuses.combatMultiplier = 1.15;
        if (u.choice === 'B') bonuses.tradePriceMultiplier = 0.9;
        break;
    }
  }

  return bonuses;
}
```

**Step 3: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/factionBonuses.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/server/src/engine/factionBonuses.ts packages/server/src/engine/__tests__/factionBonuses.test.ts
git commit -m "feat: faction bonus calculation engine (3 tiers, binary choices)"
```

---

### Task 14: Server Engine — Trade Route Processor

**Files:**
- Create: `packages/server/src/engine/tradeRoutes.ts`
- Create: `packages/server/src/engine/__tests__/tradeRoutes.test.ts`

**Context:** Trade routes execute periodically. The processor checks all active routes, calculates if a cycle is due, executes sell/buy at NPC prices, deducts fuel. This runs as a server-side interval, not per-player.

**Step 1: Write tests**

Create `packages/server/src/engine/__tests__/tradeRoutes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isRouteCycleDue, calculateRouteFuelCost, validateRouteConfig } from '../tradeRoutes.js';
import { MAX_TRADE_ROUTES, TRADE_ROUTE_MIN_CYCLE, TRADE_ROUTE_MAX_CYCLE } from '@void-sector/shared';

describe('Trade Routes', () => {
  it('should detect cycle due when enough time has passed', () => {
    const lastCycle = Date.now() - 31 * 60 * 1000; // 31 min ago
    expect(isRouteCycleDue(lastCycle, 30)).toBe(true);
  });

  it('should not trigger cycle too early', () => {
    const lastCycle = Date.now() - 15 * 60 * 1000; // 15 min ago
    expect(isRouteCycleDue(lastCycle, 30)).toBe(false);
  });

  it('should calculate fuel cost from distance', () => {
    const cost = calculateRouteFuelCost(10, 20, 30, 40);
    const dist = Math.sqrt(20 ** 2 + 20 ** 2);
    expect(cost).toBe(Math.ceil(dist * 0.5));
  });

  it('should validate route config', () => {
    expect(validateRouteConfig({ cycleMinutes: 10 }).valid).toBe(false);
    expect(validateRouteConfig({ cycleMinutes: 30 }).valid).toBe(true);
    expect(validateRouteConfig({ cycleMinutes: 150 }).valid).toBe(false);
  });
});
```

**Step 2: Write implementation**

Create `packages/server/src/engine/tradeRoutes.ts`:

```typescript
import {
  TRADE_ROUTE_MIN_CYCLE, TRADE_ROUTE_MAX_CYCLE,
  TRADE_ROUTE_FUEL_PER_DISTANCE,
} from '@void-sector/shared';

export function isRouteCycleDue(lastCycleAt: number | null, cycleMinutes: number): boolean {
  if (!lastCycleAt) return true; // never run
  const elapsed = Date.now() - lastCycleAt;
  return elapsed >= cycleMinutes * 60 * 1000;
}

export function calculateRouteFuelCost(fromX: number, fromY: number, toX: number, toY: number): number {
  const dist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
  return Math.ceil(dist * TRADE_ROUTE_FUEL_PER_DISTANCE);
}

export function validateRouteConfig(config: { cycleMinutes: number }): { valid: boolean; error?: string } {
  if (config.cycleMinutes < TRADE_ROUTE_MIN_CYCLE) {
    return { valid: false, error: `Minimum cycle is ${TRADE_ROUTE_MIN_CYCLE} minutes` };
  }
  if (config.cycleMinutes > TRADE_ROUTE_MAX_CYCLE) {
    return { valid: false, error: `Maximum cycle is ${TRADE_ROUTE_MAX_CYCLE} minutes` };
  }
  return { valid: true };
}
```

**Step 3: Run tests**

Run: `cd packages/server && npx vitest run src/engine/__tests__/tradeRoutes.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/server/src/engine/tradeRoutes.ts packages/server/src/engine/__tests__/tradeRoutes.test.ts
git commit -m "feat: trade route processor engine (cycle check, fuel cost, validation)"
```

---

### Task 15: Server Handlers — JumpGates + Rescue + Faction Upgrades

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Context:** Register new message handlers in `onCreate()` and implement handler methods. This is the largest server task — adding handlers for: useJumpGate, frequencyMatchResult, rescue, deliverSurvivors, factionUpgrade, configureRoute, toggleRoute, deleteRoute.

**Step 1: Add imports**

At the top of SectorRoom.ts, add:

```typescript
import { checkJumpGate, generateGateTarget, calculateDirection, estimateDistance } from '../engine/jumpgates.js';
import { checkDistressCall, generateDistressCallData, calculateRescueReward, canRescue } from '../engine/rescue.js';
import { calculateBonuses } from '../engine/factionBonuses.js';
import { isRouteCycleDue, calculateRouteFuelCost, validateRouteConfig } from '../engine/tradeRoutes.js';
import {
  getJumpGate, insertJumpGate, playerHasGateCode, addGateCode,
  getPlayerSurvivors, insertRescuedSurvivor, deletePlayerSurvivors,
  insertDistressCall, insertPlayerDistressCall, getPlayerDistressCalls, completeDistressCall,
  getFactionUpgrades, setFactionUpgrade,
  getPlayerTradeRoutes, insertTradeRoute, updateTradeRouteActive, deleteTradeRoute, updateTradeRouteLastCycle,
} from '../db/queries.js';
import type {
  UseJumpGateMessage, FrequencyMatchResultMessage, RescueMessage,
  DeliverSurvivorsMessage, FactionUpgradeMessage,
  ConfigureRouteMessage, ToggleRouteMessage, DeleteRouteMessage, RefuelMessage,
} from '@void-sector/shared';
import {
  JUMPGATE_FUEL_COST, RESCUE_AP_COST, RESCUE_DELIVER_AP_COST,
  RESCUE_EXPIRY_MINUTES, FACTION_UPGRADE_TIERS, MAX_TRADE_ROUTES,
  FREQUENCY_MATCH_THRESHOLD,
} from '@void-sector/shared';
```

**Step 2: Register message handlers**

In `onCreate()`, add after existing handler registrations:

```typescript
// Phase 5: Deep Systems
this.onMessage('useJumpGate', (client, data) => this.handleUseJumpGate(client, data));
this.onMessage('frequencyMatch', (client, data) => this.handleFrequencyMatch(client, data));
this.onMessage('rescue', (client, data) => this.handleRescue(client, data));
this.onMessage('deliverSurvivors', (client, data) => this.handleDeliverSurvivors(client, data));
this.onMessage('factionUpgrade', (client, data) => this.handleFactionUpgrade(client, data));
this.onMessage('configureRoute', (client, data) => this.handleConfigureRoute(client, data));
this.onMessage('toggleRoute', (client, data) => this.handleToggleRoute(client, data));
this.onMessage('deleteRoute', (client, data) => this.handleDeleteRoute(client, data));
```

**Step 3: Implement handler methods**

Add the following private methods. Each handler follows the existing pattern: get auth, validate, execute, send result.

Key handlers (implement each):

- `handleUseJumpGate`: Check gate exists at player sector, verify code/minigame, deduct JUMPGATE_FUEL_COST, teleport player
- `handleFrequencyMatch`: Verify match percentage ≥ FREQUENCY_MATCH_THRESHOLD, complete gate use
- `handleRescue`: Check player at rescue sector, verify safeSlots available, deduct RESCUE_AP_COST, add survivor to DB
- `handleDeliverSurvivors`: Check player at station, delete survivors, award rewards by source type
- `handleFactionUpgrade`: Verify player is faction leader, check tier prerequisites, deduct credits, insert upgrade
- `handleConfigureRoute`: Verify Trading Post Tier 3, validate config, check MAX_TRADE_ROUTES, insert route
- `handleToggleRoute`: Toggle route active/inactive
- `handleDeleteRoute`: Remove route

Also modify `handleJump()` to check for distress calls in comm range after each jump (call `checkAndEmitDistressCalls`).

Add helper method `checkAndEmitDistressCalls(client, playerX, playerY, commRange)` that:
1. Scans nearby sectors for `checkDistressCall()` matches
2. If found within commRange, creates distress_call in DB
3. Sends `distressCallReceived` message with direction + estimated distance

**Step 4: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: All existing tests still pass

**Step 5: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: server handlers for jumpgates, rescue, faction upgrades, trade routes"
```

---

### Task 16: Server — JumpGate Info in Sector Data

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Context:** When a player enters or scans a sector, they should see if a JumpGate exists there. Add gate info to sector discovery data and detail panel data.

**Step 1: Add gate check to sector loading**

In `handleJump()`, after loading/generating the target sector, check for JumpGate:

```typescript
// After sector load, check for JumpGate
let gateInfo = null;
if (checkJumpGate(targetX, targetY)) {
  let gate = await getJumpGate(targetX, targetY);
  if (!gate) {
    const gateData = generateGateTarget(targetX, targetY);
    const gateId = `gate_${targetX}_${targetY}`;
    await insertJumpGate({ id: gateId, sectorX: targetX, sectorY: targetY, ...gateData });
    gate = { id: gateId, sectorX: targetX, sectorY: targetY, ...gateData };
  }
  const hasCode = gate.requiresCode ? await playerHasGateCode(auth.userId, gate.id) : true;
  gateInfo = {
    id: gate.id,
    gateType: gate.gateType,
    requiresCode: gate.requiresCode,
    requiresMinigame: gate.requiresMinigame,
    hasCode,
  };
}

// Include gateInfo in sector data sent to client
client.send('jumpResult', {
  success: true,
  newSector: sectorData,
  apRemaining: jumpResult.newAP!.current,
  fuelRemaining: newFuel,
  gateInfo,
});
```

**Step 2: Add gate check to scan results**

In `handleLocalScan()` and `handleAreaScan()`, for each discovered sector, check if it has a gate and include that info in the scan result metadata.

**Step 3: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: include jumpgate info in sector discovery and scan results"
```

---

### Task 17: Server — Trade Route Tick Interval

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Context:** Trade routes need periodic processing. Add a server interval that checks and executes active routes.

**Step 1: Add trade route interval in onCreate**

```typescript
// In onCreate(), add interval:
this.clock.setInterval(() => {
  this.processTradeRoutes();
}, 60000); // Check every 60 seconds
```

**Step 2: Implement processTradeRoutes**

```typescript
private async processTradeRoutes(): Promise<void> {
  const routes = await getActiveTradeRoutes();
  for (const route of routes) {
    if (!isRouteCycleDue(route.lastCycleAt ? new Date(route.lastCycleAt).getTime() : null, route.cycleMinutes)) {
      continue;
    }
    try {
      await this.executeTradeRouteCycle(route);
      await updateTradeRouteLastCycle(route.id);
    } catch (err) {
      console.error(`[TRADE ROUTE] Error processing route ${route.id}:`, err);
    }
  }
}

private async executeTradeRouteCycle(route: TradeRoute): Promise<void> {
  // 1. Check fuel
  const fuelCost = calculateRouteFuelCost(/* base coords from structure */, route.targetX, route.targetY);
  const currentFuel = await getFuelState(route.ownerId);
  if (!currentFuel || currentFuel < fuelCost) {
    await updateTradeRouteActive(route.id, false);
    return;
  }

  // 2. Sell resources from storage
  if (route.sellResource && route.sellAmount > 0) {
    // Get storage, check resource available, sell at NPC price with rep modifiers
    // Deduct from storage, add credits
  }

  // 3. Buy resources to storage
  if (route.buyResource && route.buyAmount > 0) {
    // Check credits, buy at NPC price, add to storage
  }

  // 4. Deduct fuel
  await saveFuelState(route.ownerId, currentFuel - fuelCost);
}
```

**Step 3: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: trade route periodic processor with fuel consumption"
```

---

### Task 18: Client Store — Phase 5 State

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/state/__tests__/mockStore.ts`

**Context:** Add new state fields for jumpgates, rescue survivors, distress calls, faction upgrades, trade routes.

**Step 1: Add state fields to gameSlice.ts**

In the GameSlice interface, add:

```typescript
// Phase 5 state
jumpGateInfo: JumpGate | null;
rescuedSurvivors: RescueSurvivor[];
distressCalls: DistressCall[];
factionUpgrades: FactionUpgradeState[];
tradeRoutes: TradeRoute[];

// Phase 5 setters
setJumpGateInfo: (gate: JumpGate | null) => void;
setRescuedSurvivors: (survivors: RescueSurvivor[]) => void;
addDistressCall: (call: DistressCall) => void;
setFactionUpgrades: (upgrades: FactionUpgradeState[]) => void;
setTradeRoutes: (routes: TradeRoute[]) => void;
```

Add initial values + setter implementations following the existing pattern.

**Step 2: Update mockStore.ts**

Add default values and vi.fn() mocks for all new fields/setters.

**Step 3: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/state/__tests__/mockStore.ts
git commit -m "feat: client store — Phase 5 state fields (gates, rescue, upgrades, routes)"
```

---

### Task 19: Client Network — Phase 5 Handlers

**Files:**
- Modify: `packages/client/src/network/client.ts`

**Context:** Add room.onMessage handlers for all Phase 5 server messages and send methods for client commands.

**Step 1: Add message handlers**

In `setupRoomListeners()`:

```typescript
// JumpGates
room.onMessage('jumpGateInfo', (data) => useStore.setState({ jumpGateInfo: data }));
room.onMessage('useJumpGateResult', (data) => {
  if (data.success) {
    useStore.setState({ jumpGateInfo: null });
    if (data.fuel) useStore.setState({ fuel: data.fuel });
  }
});

// Rescue
room.onMessage('rescueResult', (data) => {
  if (data.success) {
    // Update survivors list
  }
});
room.onMessage('deliverSurvivorsResult', (data) => {
  if (data.success) {
    useStore.setState({ rescuedSurvivors: [] });
    if (data.credits) useStore.setState({ credits: data.credits });
  }
});
room.onMessage('distressCallReceived', (data) => {
  const state = useStore.getState();
  useStore.setState({ distressCalls: [...state.distressCalls, data] });
});

// Faction Upgrades
room.onMessage('factionUpgradesUpdate', (data) => useStore.setState({ factionUpgrades: data }));
room.onMessage('factionUpgradeResult', (data) => {
  if (data.success && data.upgrades) {
    useStore.setState({ factionUpgrades: data.upgrades });
  }
});

// Trade Routes
room.onMessage('tradeRoutesUpdate', (data) => useStore.setState({ tradeRoutes: data }));
room.onMessage('configureRouteResult', (data) => {
  if (data.success && data.route) {
    const routes = useStore.getState().tradeRoutes;
    useStore.setState({ tradeRoutes: [...routes, data.route] });
  }
});
```

**Step 2: Add send methods**

```typescript
sendUseJumpGate(gateId: string, accessCode?: string): void {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('useJumpGate', { gateId, accessCode });
}

sendFrequencyMatch(gateId: string, matched: boolean): void {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('frequencyMatch', { gateId, matched });
}

sendRescue(sectorX: number, sectorY: number): void {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('rescue', { sectorX, sectorY });
}

sendDeliverSurvivors(stationX: number, stationY: number): void {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('deliverSurvivors', { stationX, stationY });
}

sendFactionUpgrade(tier: number, choice: string): void {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('factionUpgrade', { tier, choice });
}

sendConfigureRoute(config: ConfigureRouteMessage): void {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('configureRoute', config);
}

sendToggleRoute(routeId: string, active: boolean): void {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('toggleRoute', { routeId, active });
}

sendDeleteRoute(routeId: string): void {
  if (!this.sectorRoom) return;
  this.sectorRoom.send('deleteRoute', { routeId });
}
```

**Step 3: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat: client network — Phase 5 message handlers and send methods"
```

---

### Task 20: Client Component — JumpGate Panel + Frequency Minigame

**Files:**
- Create: `packages/client/src/components/JumpGatePanel.tsx`
- Create: `packages/client/src/components/FrequencyMinigame.tsx`
- Modify: `packages/client/src/components/DetailPanel.tsx`

**Context:** When player is in a sector with a JumpGate, the DetailPanel shows a JumpGatePanel with gate info and a "USE GATE" button. If the gate requires the frequency minigame, FrequencyMinigame renders a canvas with two sine waves.

**Step 1: Create FrequencyMinigame component**

Canvas-based: draws target frequency sine wave (green) and player-controlled sine wave (amber). Player adjusts frequency with ← → keys or mousewheel. Match ≥ 90% triggers success.

```typescript
// FrequencyMinigame.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FREQUENCY_MATCH_THRESHOLD } from '@void-sector/shared';

interface Props {
  onComplete: (matched: boolean) => void;
  onCancel: () => void;
}

export const FrequencyMinigame: React.FC<Props> = ({ onComplete, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerFreq, setPlayerFreq] = useState(2.0);
  const targetFreq = useRef(3.5 + Math.random() * 3); // 3.5-6.5
  const [matchPercent, setMatchPercent] = useState(0);

  // Draw waves on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Target wave (green/dim)
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
      ctx.lineWidth = 2;
      drawSineWave(ctx, canvas.width, canvas.height / 2 - 20, targetFreq.current, canvas.height / 4);

      // Player wave (amber)
      ctx.strokeStyle = '#FFB000';
      ctx.lineWidth = 2;
      drawSineWave(ctx, canvas.width, canvas.height / 2 + 20, playerFreq, canvas.height / 4);

      // Match indicator
      const match = 1 - Math.abs(playerFreq - targetFreq.current) / targetFreq.current;
      setMatchPercent(Math.max(0, Math.min(1, match)));
    };

    draw();
  }, [playerFreq]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setPlayerFreq(f => Math.max(0.5, f - 0.1));
      if (e.key === 'ArrowRight') setPlayerFreq(f => Math.min(10, f + 0.1));
      if (e.key === 'Enter' && matchPercent >= FREQUENCY_MATCH_THRESHOLD) onComplete(true);
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [matchPercent, onComplete, onCancel]);

  return (
    <div style={{ /* CRT overlay styling */ }}>
      <div style={{ color: '#FFB000', textAlign: 'center', marginBottom: 8 }}>
        GATE FREQUENCY LOCK
      </div>
      <canvas ref={canvasRef} width={280} height={120} style={{ border: '1px solid rgba(255,176,0,0.3)' }} />
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <span>MATCH: {Math.floor(matchPercent * 100)}%</span>
        {matchPercent >= FREQUENCY_MATCH_THRESHOLD && (
          <span style={{ color: '#00FF88' }}> — LOCK ACQUIRED [ENTER]</span>
        )}
      </div>
      <div style={{ fontSize: '0.7em', textAlign: 'center', opacity: 0.5 }}>
        ← → to tune | ESC to cancel
      </div>
    </div>
  );
};

function drawSineWave(ctx: CanvasRenderingContext2D, width: number, y: number, freq: number, amp: number) {
  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const val = Math.sin((x / width) * freq * Math.PI * 2) * amp * 0.4;
    if (x === 0) ctx.moveTo(x, y + val);
    else ctx.lineTo(x, y + val);
  }
  ctx.stroke();
}
```

**Step 2: Create JumpGatePanel**

Shows gate type, target info (hidden for wormholes), code input if needed, USE GATE button.

**Step 3: Integrate into DetailPanel**

When `jumpGateInfo` is set in store and player is in that sector, show JumpGatePanel below sector info.

**Step 4: Commit**

```bash
git add packages/client/src/components/JumpGatePanel.tsx packages/client/src/components/FrequencyMinigame.tsx packages/client/src/components/DetailPanel.tsx
git commit -m "feat: JumpGate panel with frequency matching minigame"
```

---

### Task 21: Client Component — Rescue & Distress UI

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx`
- Modify: `packages/client/src/components/QuestsScreen.tsx`

**Context:** DetailPanel shows RESCUE button when at a sector with distress signal/survivors. QuestsScreen gets a new "RETTUNG" tab showing active distress calls with direction hints and rescued survivors in transit.

**Step 1: Add rescue button to DetailPanel**

When player is at a sector with a distress_signal scan event and has free safeSlots:

```tsx
{isPlayerHere && hasDistressSignal && (
  <button onClick={() => gameNetwork.sendRescue(selectedSector.x, selectedSector.y)}
    style={{ /* CRT button style */ }}>
    BERGEN (5 AP)
  </button>
)}
```

When player is at a station and has survivors:

```tsx
{isPlayerHere && sectorType === 'station' && rescuedSurvivors.length > 0 && (
  <button onClick={() => gameNetwork.sendDeliverSurvivors(selectedSector.x, selectedSector.y)}
    style={{ /* CRT button style */ }}>
    DELIVER SURVIVORS ({rescuedSurvivors.length})
  </button>
)}
```

**Step 2: Add distress calls to QuestsScreen**

In QuestsScreen's EVENTS tab or a new RETTUNG tab, show:

```tsx
{distressCalls.map(call => (
  <div key={call.id} style={{ borderBottom: '1px solid rgba(255,176,0,0.2)', padding: 8 }}>
    <div>DISTRESS SIGNAL</div>
    <div>RICHTUNG: {call.direction}</div>
    <div>ENTFERNUNG: ~{call.estimatedDistance} SEKTOREN</div>
    <div style={{ fontSize: '0.7em', opacity: 0.5 }}>
      Verfällt in {Math.ceil((call.expiresAt - Date.now()) / 60000)} min
    </div>
  </div>
))}
```

**Step 3: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx packages/client/src/components/QuestsScreen.tsx
git commit -m "feat: rescue UI — bergen button, distress call display, survivor delivery"
```

---

### Task 22: Client Component — Faction Upgrade Tree

**Files:**
- Modify: `packages/client/src/components/FactionScreen.tsx`

**Context:** Add "UPGRADES" tab to existing FactionScreen. Shows 3 tiers with binary choices. Only faction leader can choose. Already-chosen tiers show the selected option highlighted.

**Step 1: Add upgrade tree UI**

In FactionScreen, add a new tab/section:

```tsx
// Upgrade tree section
<div style={{ padding: 8 }}>
  <div style={{ color: '#FFB000', marginBottom: 12 }}>VERBESSERUNGSBAUM</div>
  {[1, 2, 3].map(tier => {
    const tierDef = FACTION_UPGRADE_TIERS[tier];
    const chosen = factionUpgrades.find(u => u.tier === tier);
    const prevChosen = tier === 1 || factionUpgrades.some(u => u.tier === tier - 1);

    return (
      <div key={tier} style={{ marginBottom: 16, opacity: prevChosen ? 1 : 0.3 }}>
        <div style={{ fontSize: '0.8em', marginBottom: 4 }}>TIER {tier} — {tierDef.cost} CR</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            disabled={!!chosen || !isLeader || !prevChosen}
            onClick={() => gameNetwork.sendFactionUpgrade(tier, 'A')}
            style={{
              flex: 1,
              background: chosen?.choice === 'A' ? 'rgba(255,176,0,0.2)' : 'transparent',
              border: `1px solid ${chosen?.choice === 'A' ? '#FFB000' : 'rgba(255,176,0,0.3)'}`,
              color: '#FFB000',
              padding: 8,
              fontFamily: 'inherit',
              cursor: chosen || !isLeader ? 'default' : 'pointer',
            }}
          >
            <div>{tierDef.optionA.name}</div>
            <div style={{ fontSize: '0.7em', opacity: 0.6 }}>{tierDef.optionA.effect}</div>
          </button>
          <button
            disabled={!!chosen || !isLeader || !prevChosen}
            onClick={() => gameNetwork.sendFactionUpgrade(tier, 'B')}
            style={{
              flex: 1,
              background: chosen?.choice === 'B' ? 'rgba(255,176,0,0.2)' : 'transparent',
              border: `1px solid ${chosen?.choice === 'B' ? '#FFB000' : 'rgba(255,176,0,0.3)'}`,
              color: '#FFB000',
              padding: 8,
              fontFamily: 'inherit',
              cursor: chosen || !isLeader ? 'default' : 'pointer',
            }}
          >
            <div>{tierDef.optionB.name}</div>
            <div style={{ fontSize: '0.7em', opacity: 0.6 }}>{tierDef.optionB.effect}</div>
          </button>
        </div>
      </div>
    );
  })}
</div>
```

**Step 2: Commit**

```bash
git add packages/client/src/components/FactionScreen.tsx
git commit -m "feat: faction upgrade tree UI (3 tiers, binary choices, leader-only)"
```

---

### Task 23: Client Component — Trade Routes Screen

**Files:**
- Modify: `packages/client/src/components/TradeScreen.tsx`

**Context:** TradeScreen already has NPC trade and marketplace tabs. Add "ROUTEN" tab visible only when Trading Post is Tier 3. Shows existing routes with status + configure new route form.

**Step 1: Add routes tab to TradeScreen**

When trading post tier ≥ 3, show a "ROUTEN" tab:

```tsx
// Route list
{tradeRoutes.map(route => (
  <div key={route.id} style={{ borderBottom: '1px solid rgba(255,176,0,0.2)', padding: 8 }}>
    <div>ROUTE → [{route.targetX},{route.targetY}]</div>
    {route.sellResource && <div>SELL: {route.sellAmount} {route.sellResource}</div>}
    {route.buyResource && <div>BUY: {route.buyAmount} {route.buyResource}</div>}
    <div>ZYKLUS: {route.cycleMinutes}min</div>
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <button onClick={() => gameNetwork.sendToggleRoute(route.id, !route.active)}>
        {route.active ? 'PAUSE' : 'START'}
      </button>
      <button onClick={() => gameNetwork.sendDeleteRoute(route.id)}>
        LÖSCHEN
      </button>
    </div>
  </div>
))}

// New route form (when < MAX_TRADE_ROUTES)
{tradeRoutes.length < MAX_TRADE_ROUTES && (
  <div>
    {/* Form: target coords, sell resource/amount, buy resource/amount, cycle minutes */}
    <button onClick={() => gameNetwork.sendConfigureRoute(formData)}>
      ROUTE ERSTELLEN
    </button>
  </div>
)}
```

**Step 2: Commit**

```bash
git add packages/client/src/components/TradeScreen.tsx
git commit -m "feat: trade routes tab — configure, start/pause, delete routes"
```

---

### Task 24: Client Component — Custom Data Slates

**Files:**
- Modify: `packages/client/src/components/CargoScreen.tsx`

**Context:** Extend existing slate creation to support `custom` type. Add form for label + coordinates + codes + notes. Modify slate display to show custom data.

**Step 1: Add custom slate creation UI**

In CargoScreen, next to existing slate creation buttons, add:

```tsx
<button onClick={() => setShowCustomSlateForm(true)}>
  DATENDISK ERSTELLEN (2 AP, 5 CR)
</button>

{showCustomSlateForm && (
  <div style={{ padding: 8, border: '1px solid rgba(255,176,0,0.3)' }}>
    <input placeholder="Label (max 32)" value={label} onChange={e => setLabel(e.target.value.slice(0, 32))} />
    <textarea placeholder="Notizen (max 500)" value={notes} onChange={e => setNotes(e.target.value.slice(0, 500))} />
    {/* Coordinate list + code list editors */}
    <button onClick={() => { gameNetwork.sendCreateCustomSlate({ label, notes, coordinates, codes }); setShowCustomSlateForm(false); }}>
      ERSTELLEN
    </button>
  </div>
)}
```

**Step 2: Display custom data on slates**

When rendering slate list, if slate has `customData`, show label + preview of contents.

**Step 3: Commit**

```bash
git add packages/client/src/components/CargoScreen.tsx
git commit -m "feat: custom data slate creation and display in cargo screen"
```

---

### Task 25: Multi-Content Sector Display

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx`
- Modify: `packages/client/src/components/RadarRenderer.ts`

**Context:** DetailPanel should aggregate and display all features in a sector (type, structures, jumpgate, distress signals). RadarRenderer should show small marker icons for sectors with multiple features.

**Step 1: Aggregate sector features in DetailPanel**

```tsx
// After sector type display, show features list:
const structures = allStructures.filter(s => s.sectorX === selectedSector.x && s.sectorY === selectedSector.y);
const hasGate = jumpGateInfo && jumpGateInfo.sectorX === selectedSector.x && jumpGateInfo.sectorY === selectedSector.y;
const hasDistress = scanEvents.some(e => e.sectorX === selectedSector.x && e.sectorY === selectedSector.y && e.eventType === 'distress_signal');

{(structures.length > 0 || hasGate || hasDistress) && (
  <div style={{ marginTop: 8 }}>
    <div style={{ color: 'rgba(255,176,0,0.6)', fontSize: '0.7em' }}>FEATURES</div>
    {structures.map(s => <div key={s.id}>◆ {s.type.toUpperCase()}</div>)}
    {hasGate && <div>◆ JUMPGATE ({jumpGateInfo!.gateType})</div>}
    {hasDistress && <div style={{ color: '#FF3333' }}>◆ DISTRESS SIGNAL</div>}
  </div>
)}
```

**Step 2: Add multi-feature markers to radar**

In `RadarRenderer.ts`, when drawing discovered sectors, check for additional features and draw small colored dots:

```typescript
// After drawing main sector symbol, add feature markers
if (hasStructure) drawFeatureDot(ctx, screenX + 4, screenY - 4, '#00FF88'); // green
if (hasGate) drawFeatureDot(ctx, screenX - 4, screenY - 4, '#00BFFF');     // blue
if (hasDistress) drawFeatureDot(ctx, screenX, screenY + 4, '#FF3333');      // red
```

**Step 3: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx packages/client/src/components/RadarRenderer.ts
git commit -m "feat: multi-content sector display in detail panel and radar markers"
```

---

### Task 26: Client Tests — Phase 5

**Files:**
- Create: `packages/client/src/components/__tests__/JumpGatePanel.test.tsx`
- Create: `packages/client/src/components/__tests__/FrequencyMinigame.test.tsx`
- Modify: `packages/client/src/components/__tests__/FactionScreen.test.tsx` (if exists, or create)

**Step 1: JumpGatePanel tests**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JumpGatePanel } from '../JumpGatePanel';

describe('JumpGatePanel', () => {
  it('should show gate type', () => {
    render(<JumpGatePanel gate={{ id: 'g1', gateType: 'bidirectional', requiresCode: false, requiresMinigame: false, hasCode: true }} />);
    expect(screen.getByText(/BIDIRECTIONAL/i)).toBeDefined();
  });

  it('should show USE GATE button when no requirements', () => {
    render(<JumpGatePanel gate={{ id: 'g1', gateType: 'wormhole', requiresCode: false, requiresMinigame: false, hasCode: true }} />);
    expect(screen.getByText(/USE GATE/i)).toBeDefined();
  });

  it('should show code input when code required', () => {
    render(<JumpGatePanel gate={{ id: 'g1', gateType: 'bidirectional', requiresCode: true, requiresMinigame: false, hasCode: false }} />);
    expect(screen.getByPlaceholderText(/CODE/i)).toBeDefined();
  });

  it('should show LOCKED when code required but not owned', () => {
    render(<JumpGatePanel gate={{ id: 'g1', gateType: 'bidirectional', requiresCode: true, requiresMinigame: false, hasCode: false }} />);
    expect(screen.getByText(/LOCKED/i)).toBeDefined();
  });
});
```

**Step 2: FrequencyMinigame tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FrequencyMinigame } from '../FrequencyMinigame';

describe('FrequencyMinigame', () => {
  it('should render canvas and controls', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    render(<FrequencyMinigame onComplete={onComplete} onCancel={onCancel} />);
    expect(screen.getByText(/GATE FREQUENCY LOCK/i)).toBeDefined();
    expect(screen.getByText(/MATCH/i)).toBeDefined();
  });

  it('should call onCancel when Escape pressed', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    render(<FrequencyMinigame onComplete={onComplete} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});
```

**Step 3: Faction upgrade tree tests**

Test that upgrade buttons render, that non-leaders can't click, and chosen upgrades are highlighted.

**Step 4: Run all client tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/client/src/components/__tests__/
git commit -m "test: Phase 5 client tests — JumpGate, FrequencyMinigame, FactionUpgrades"
```

---

### Task 27: Server Tests — Phase 5 Integration

**Files:**
- Create: `packages/server/src/engine/__tests__/factionUpgradeIntegration.test.ts`

**Step 1: Write integration-style tests for faction bonus application**

```typescript
import { describe, it, expect } from 'vitest';
import { calculateBonuses } from '../factionBonuses.js';
import { MINING_RATE_PER_SECOND } from '@void-sector/shared';

describe('Faction Bonus Application', () => {
  it('should increase mining rate with tier 1A', () => {
    const bonuses = calculateBonuses([{ tier: 1, choice: 'A' }]);
    const boostedRate = MINING_RATE_PER_SECOND * bonuses.miningRateMultiplier;
    expect(boostedRate).toBeCloseTo(0.115);
  });

  it('should reduce NPC trade prices with tier 3B', () => {
    const bonuses = calculateBonuses([
      { tier: 1, choice: 'A' },
      { tier: 2, choice: 'A' },
      { tier: 3, choice: 'B' },
    ]);
    const basePrice = 100;
    const discounted = basePrice * bonuses.tradePriceMultiplier;
    expect(discounted).toBe(90);
  });
});
```

**Step 2: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/server/src/engine/__tests__/factionUpgradeIntegration.test.ts
git commit -m "test: Phase 5 server integration tests — faction bonuses"
```

---

### Task 28: Apply Faction Bonuses to Game Logic

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Context:** Faction bonuses from `calculateBonuses()` need to be applied at relevant points: mining rate, cargo cap, scan radius, AP regen, combat, NPC trade prices.

**Step 1: Create helper method to get player's bonuses**

```typescript
private async getPlayerBonuses(playerId: string): Promise<FactionBonuses> {
  const faction = await getPlayerFaction(playerId);
  if (!faction) return calculateBonuses([]);
  const upgrades = await getFactionUpgrades(faction.id);
  return calculateBonuses(upgrades.map(u => ({ tier: u.tier, choice: u.choice as FactionUpgradeChoice })));
}
```

**Step 2: Apply bonuses to each system**

- `handleMine()`: Multiply mining rate by `bonuses.miningRateMultiplier`
- `handleAreaScan()`: Add `bonuses.scanRadiusBonus` to scanner radius
- `handleNpcTrade()`: Multiply NPC prices by `bonuses.tradePriceMultiplier`
- `handleBattleAction()`: Multiply player damage by `bonuses.combatMultiplier`
- Cargo validation: Add `bonuses.cargoCapBonus` to ship's cargoCap
- AP regen: Multiply `regenPerSecond` by `bonuses.apRegenMultiplier` when saving AP state

**Step 3: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: apply faction upgrade bonuses to mining, scan, trade, combat, cargo, AP"
```

---

### Task 29: Documentation Update

**Files:**
- Modify: `packages/server/src/db/migrations/` (verify 009 exists)
- Modify: `CLAUDE.md`
- Modify: `planung/ROADMAP.md`

**Step 1: Update CLAUDE.md**

- Update test counts
- Update migration range (001-009)
- Add Phase 5 feature list to Current State

**Step 2: Update ROADMAP.md**

Mark Phase 5 items as complete:
```markdown
## Phase 5: Deep Systems
- [x] Fraktions-Verbesserungsbaum (Boni/Malus Entscheidungen).
- [x] Rettungsmissionen-System.
- [x] Automatisierung: Handelsrouten vom Raumhafen aus.
- [x] Fuel-System (Verbrauch + Tanken).
- [x] JumpGates (bidirektional + Wurmlöcher + Frequenz-Minispiel).
- [x] DatenDisks erweitert (Custom Slates).
- [x] Multi-Content-Sektoren.
- [x] Bug-Fixes: Mining-Nav-Lock (#17), UI-Anpassungen (#16).
```

**Step 3: Commit**

```bash
git add CLAUDE.md planung/ROADMAP.md
git commit -m "docs: update CLAUDE.md and ROADMAP.md for Phase 5 completion"
```

---

## Summary

**29 Tasks across 4 Blocks:**

| Block | Tasks | Focus |
|-------|-------|-------|
| A: Grundlagen | 1-8 | Bug fixes, fuel system, types/constants |
| Engine | 9-14 | DB migration, queries, jumpgates, rescue, faction bonuses, trade routes |
| Server | 15-17 | SectorRoom handlers, gate info, trade route tick |
| Client | 18-26 | Store, network, UI components (gate panel, minigame, rescue, upgrades, routes, slates, multi-content) |
| Tests + Docs | 26-29 | Client tests, server tests, bonus application, documentation |

**New files created:** ~15
**Files modified:** ~20
**New DB tables:** 6 (faction_upgrades, jumpgates, gate_codes, rescued_survivors, distress_calls, player_distress_calls, trade_routes)
**New engine modules:** 4 (jumpgates.ts, rescue.ts, factionBonuses.ts, tradeRoutes.ts)
