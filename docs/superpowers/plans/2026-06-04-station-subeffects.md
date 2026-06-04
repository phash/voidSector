# Station Sub-Effects (refinery gas→fuel, sensor optional-pirate-combat) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the two deferred #548 expansion sub-effects: the Refinery converts a station's stored gas into fuel the owner can refuel from at their own station; the Sensor makes pirate_zone combat *optional* (engage or slip past) within the sensor station's quadrant.

**Architecture:** Pure helpers in `stationPassiveEffects.ts` + constants in shared. Refinery conversion runs in the existing Phase-1 refinery tick (`stationBuildTick.ts`) and stores fuel in the station's `cargo_contents.fuel`; the refuel handler (`EconomyService`) is extended so an owner refuels free from that fuel (and the `'station'`-sector gate is relaxed for owned stations). The sensor hooks the two pirate_zone auto-combat sites in `SectorRoom` — when the owner has a sensor station in-quadrant and a probability roll succeeds, the auto-combat is skipped and the player is told they may engage (`combatV3Start`) or move on.

**Tech Stack:** TypeScript (strict, ESM `.js` imports), PostgreSQL, Colyseus, Vitest.

> **Build rule:** after editing `packages/shared/src/constants.ts`, run `cd packages/shared && npm run build` before tests see the change. No DB migration needed (fuel lives in existing `cargo_contents` JSONB; sensor uses the existing `sensor_level` column).

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `packages/shared/src/constants.ts` | 5 new balance constants | Modify |
| `packages/server/src/engine/stationPassiveEffects.ts` | pure: `refineGasToFuel`, `pirateCombatAvoidable`, `stationRefuelAmount` | Modify |
| `packages/server/src/db/stationQueries.ts` | `getRefineryStationsWithCargo`, `getPlayerSensorLevelInQuadrant` | Modify |
| `packages/server/src/engine/stationBuildTick.ts` | refinery gas→fuel conversion in the existing refinery loop | Modify |
| `packages/server/src/rooms/services/EconomyService.ts` | refuel free from owned station fuel; relax `'station'` gate | Modify |
| `packages/server/src/rooms/SectorRoom.ts` | optional pirate combat via a shared helper at both pirate_zone sites | Modify |

---

## Task 1: Shared constants

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Test: `packages/shared/src/__tests__/stationSubEffects.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/__tests__/stationSubEffects.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  REFINERY_GAS_PER_TICK, REFINERY_FUEL_PER_GAS, REFINERY_FUEL_MAX,
  SENSOR_PIRATE_REDUCTION_PER_LEVEL, SENSOR_PIRATE_REDUCTION_MAX,
} from '../constants.js';

describe('station sub-effect constants', () => {
  it('has refinery conversion constants', () => {
    expect(REFINERY_GAS_PER_TICK).toBe(1);
    expect(REFINERY_FUEL_PER_GAS).toBe(100);
    expect(REFINERY_FUEL_MAX).toBe(20000);
  });
  it('has sensor pirate-reduction constants', () => {
    expect(SENSOR_PIRATE_REDUCTION_PER_LEVEL).toBe(0.15);
    expect(SENSOR_PIRATE_REDUCTION_MAX).toBe(0.9);
  });
});
```

- [ ] **Step 2: Run it — MUST FAIL**

Run: `cd packages/shared && npx vitest run src/__tests__/stationSubEffects.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Add the constants**

In `packages/shared/src/constants.ts`, immediately AFTER the existing line
`export const SENSOR_SCAN_BONUS_PER_LEVEL = 1;` add:

```typescript
// Refinery: passive gas → fuel conversion stored in the station's cargo_contents.fuel.
export const REFINERY_GAS_PER_TICK = 1;   // gas consumed per universe tick per refinery level
export const REFINERY_FUEL_PER_GAS = 100; // fuel produced per gas consumed
export const REFINERY_FUEL_MAX = 20000;   // cap on a station's stored fuel

// Sensor: chance that pirate_zone auto-combat is made optional in the sensor station's quadrant.
export const SENSOR_PIRATE_REDUCTION_PER_LEVEL = 0.15; // per sensor level
export const SENSOR_PIRATE_REDUCTION_MAX = 0.9;        // cap
```

- [ ] **Step 4: Build shared + run test — MUST PASS**

Run: `cd packages/shared && npm run build && npx vitest run src/__tests__/stationSubEffects.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/dist packages/shared/src/__tests__/stationSubEffects.test.ts
git commit -m "feat: refinery + sensor sub-effect constants (#548)"
```

---

## Task 2: Pure helpers in `stationPassiveEffects.ts`

**Files:**
- Modify: `packages/server/src/engine/stationPassiveEffects.ts`
- Test: `packages/server/src/engine/__tests__/stationPassiveEffects.test.ts` (extend the existing file)

> The existing file already exports `refineryCreditsPerTick` and `sensorScanBonus` (Phase 1). Add three new pure helpers.

- [ ] **Step 1: Add failing tests to the existing test file**

In `packages/server/src/engine/__tests__/stationPassiveEffects.test.ts`, add these imports to the existing import from `'../stationPassiveEffects.js'`: `refineGasToFuel`, `pirateCombatAvoidable`, `stationRefuelAmount`. Then append:

```typescript
describe('refineGasToFuel', () => {
  it('is a no-op at refinery level 0', () => {
    const cargo = { gas: 50 };
    expect(refineGasToFuel(cargo, 0)).toEqual({ gas: 50 });
  });
  it('converts level*REFINERY_GAS_PER_TICK gas into fuel', () => {
    const r = refineGasToFuel({ gas: 10 }, 3); // consume 3 gas -> 300 fuel
    expect(r.gas).toBe(7);
    expect(r.fuel).toBe(300);
  });
  it('consumes only as much gas as is available', () => {
    const r = refineGasToFuel({ gas: 2 }, 5); // wants 5, only 2 available
    expect(r.gas).toBe(0);
    expect(r.fuel).toBe(200);
  });
  it('respects the fuel cap and never burns gas beyond what fits', () => {
    const r = refineGasToFuel({ gas: 100, fuel: 19950 }, 5); // room = 50 fuel = ceil(50/100)=1 gas
    expect(r.fuel).toBe(20000);
    expect(r.gas).toBe(99);
  });
  it('does not mutate the input', () => {
    const cargo = { gas: 10 };
    refineGasToFuel(cargo, 1);
    expect(cargo).toEqual({ gas: 10 });
  });
});

describe('pirateCombatAvoidable', () => {
  it('never avoidable at sensor level 0', () => {
    expect(pirateCombatAvoidable(0, 0)).toBe(false);
  });
  it('scales with level and is deterministic given the roll', () => {
    // level 3 -> chance 0.45
    expect(pirateCombatAvoidable(3, 0.4)).toBe(true);
    expect(pirateCombatAvoidable(3, 0.5)).toBe(false);
  });
  it('caps at SENSOR_PIRATE_REDUCTION_MAX (0.9)', () => {
    expect(pirateCombatAvoidable(10, 0.89)).toBe(true);  // chance capped at 0.9
    expect(pirateCombatAvoidable(10, 0.95)).toBe(false);
  });
});

describe('stationRefuelAmount', () => {
  it('is the min of tank space and station fuel', () => {
    expect(stationRefuelAmount(100, 40)).toBe(40);
    expect(stationRefuelAmount(30, 40)).toBe(30);
    expect(stationRefuelAmount(0, 40)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it — MUST FAIL**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationPassiveEffects.test.ts`
Expected: FAIL — new helpers missing.

- [ ] **Step 3: Implement the helpers**

In `packages/server/src/engine/stationPassiveEffects.ts`, extend the shared import to also import the new constants, and append the three functions:

```typescript
import {
  REFINERY_CREDITS_PER_TICK, SENSOR_SCAN_BONUS_PER_LEVEL,
  REFINERY_GAS_PER_TICK, REFINERY_FUEL_PER_GAS, REFINERY_FUEL_MAX,
  SENSOR_PIRATE_REDUCTION_PER_LEVEL, SENSOR_PIRATE_REDUCTION_MAX,
} from '@void-sector/shared';
```
(merge with the existing import line — keep `refineryCreditsPerTick`/`sensorScanBonus` as-is.)

```typescript
/**
 * Convert a station's stored gas into stored fuel (cargo_contents) for one tick.
 * Pure: returns a new cargo object, never mutates the input.
 */
export function refineGasToFuel(
  cargo: Record<string, number>,
  refineryLevel: number,
): Record<string, number> {
  if (refineryLevel <= 0) return { ...cargo };
  const gas = cargo.gas ?? 0;
  const fuel = cargo.fuel ?? 0;
  const fuelRoom = Math.max(0, REFINERY_FUEL_MAX - fuel);
  const gasWanted = Math.min(gas, REFINERY_GAS_PER_TICK * refineryLevel);
  const actualFuel = Math.min(gasWanted * REFINERY_FUEL_PER_GAS, fuelRoom);
  const actualGas = Math.ceil(actualFuel / REFINERY_FUEL_PER_GAS);
  if (actualFuel <= 0) return { ...cargo };
  return { ...cargo, gas: gas - actualGas, fuel: fuel + actualFuel };
}

/** True if the sensor array lets the player avoid (make optional) a pirate_zone fight this entry. */
export function pirateCombatAvoidable(sensorLevel: number, roll: number): boolean {
  if (sensorLevel <= 0) return false;
  const chance = Math.min(SENSOR_PIRATE_REDUCTION_MAX, SENSOR_PIRATE_REDUCTION_PER_LEVEL * sensorLevel);
  return roll < chance;
}

/** Fuel a ship can take from a station: min of remaining tank space and station fuel stock. */
export function stationRefuelAmount(tankSpace: number, stationFuel: number): number {
  return Math.max(0, Math.min(tankSpace, stationFuel));
}
```

- [ ] **Step 4: Run test — MUST PASS**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run src/engine/__tests__/stationPassiveEffects.test.ts`
Expected: PASS (the Phase-1 tests + the new ones).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/engine/stationPassiveEffects.ts packages/server/src/engine/__tests__/stationPassiveEffects.test.ts
git commit -m "feat: pure helpers refineGasToFuel / pirateCombatAvoidable / stationRefuelAmount (#548)"
```

---

## Task 3: Queries (`stationQueries.ts`)

**Files:**
- Modify: `packages/server/src/db/stationQueries.ts`

> These are thin parameterized SQL queries consumed by Tasks 4 & 6. No standalone unit test (consistent with the rest of this DB module); they are exercised via the consuming tasks' mocked tests.

- [ ] **Step 1: Add the two queries at the end of `stationQueries.ts`**

```typescript
/** Player stations with a refinery — id + cargo for the gas→fuel conversion tick. */
export async function getRefineryStationsWithCargo(): Promise<
  Pick<PlayerStationRow, 'id' | 'owner_id' | 'refinery_level' | 'cargo_contents'>[]
> {
  const result = await query<Pick<PlayerStationRow, 'id' | 'owner_id' | 'refinery_level' | 'cargo_contents'>>(
    `SELECT id, owner_id, refinery_level, cargo_contents
       FROM player_stations WHERE refinery_level > 0`,
  );
  return result.rows;
}

/**
 * Highest sensor_level among the owner's stations located in quadrant (qx,qy).
 * QUADRANT_SIZE-based: a sector s belongs to quadrant floor((s+half)/size) (matches sectorToQuadrant).
 */
export async function getPlayerSensorLevelInQuadrant(
  ownerId: string,
  qx: number,
  qy: number,
): Promise<number> {
  const result = await query<{ max: number | null }>(
    `SELECT MAX(sensor_level) AS max FROM player_stations
       WHERE owner_id = $1
         AND FLOOR((sector_x + $4) / $5) = $2
         AND FLOOR((sector_y + $4) / $5) = $3`,
    [ownerId, qx, qy, QUADRANT_SIZE_HALF, QUADRANT_SIZE_VALUE],
  );
  return result.rows[0]?.max ?? 0;
}
```

Add the needed import at the top of the file (next to the existing `@void-sector/shared` import):

```typescript
import { QUADRANT_SIZE } from '@void-sector/shared';
const QUADRANT_SIZE_VALUE = QUADRANT_SIZE;
const QUADRANT_SIZE_HALF = Math.floor(QUADRANT_SIZE / 2);
```

(If `stationQueries.ts` has no `@void-sector/shared` import yet, add one; it already imports the `StationExpansionType` type — merge `QUADRANT_SIZE` as a value import: `import { QUADRANT_SIZE, type StationExpansionType } from '@void-sector/shared';`.)

- [ ] **Step 2: Build + typecheck**

Run: `cd packages/shared && npm run build && cd ../server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "stationQueries" || echo clean`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/stationQueries.ts
git commit -m "feat: refinery-cargo + in-quadrant sensor-level queries (#548)"
```

---

## Task 4: Refinery gas→fuel conversion in the tick

**Files:**
- Modify: `packages/server/src/engine/stationBuildTick.ts`
- Test: `packages/server/src/engine/__tests__/stationBuildTick.test.ts` (extend)

> Phase 1's refinery loop pays a credits trickle using `getAllPlayerStationsWithRefinery`. Add the gas→fuel conversion using the new `getRefineryStationsWithCargo` + `refineGasToFuel` + `updateStationCargo`. Keep the credits trickle.

- [ ] **Step 1: Add a failing test**

In `packages/server/src/engine/__tests__/stationBuildTick.test.ts`, extend the `../../db/stationQueries.js` mock to also export `getRefineryStationsWithCargo` and `updateStationCargo`, and mock `../stationPassiveEffects.js` is NOT needed (use the real pure helper). Add to the mock factory object: `getRefineryStationsWithCargo: vi.fn().mockResolvedValue([])` and `updateStationCargo: vi.fn().mockResolvedValue(undefined)`. Reset them in `beforeEach`. Then add:

```typescript
  it('refines gas into fuel for stations with a refinery', async () => {
    getDueStationBuilds.mockResolvedValue([]);
    getAllPlayerStationsWithRefinery.mockResolvedValue([]); // credits trickle: none
    getRefineryStationsWithCargo.mockResolvedValue([
      { id: 'st1', owner_id: 'o1', refinery_level: 2, cargo_contents: { gas: 10 } },
    ]);
    await processStationBuildTick();
    // level 2 -> consume 2 gas -> 200 fuel
    expect(updateStationCargo).toHaveBeenCalledWith('st1', expect.objectContaining({ gas: 8, fuel: 200 }));
  });

  it('skips stations whose cargo is unchanged by refining', async () => {
    getDueStationBuilds.mockResolvedValue([]);
    getAllPlayerStationsWithRefinery.mockResolvedValue([]);
    getRefineryStationsWithCargo.mockResolvedValue([
      { id: 'st1', owner_id: 'o1', refinery_level: 2, cargo_contents: { gas: 0 } }, // no gas -> no change
    ]);
    await processStationBuildTick();
    expect(updateStationCargo).not.toHaveBeenCalled();
  });
```

> Note: the existing test file mocks `../../db/stationQueries.js` and `../../db/queries.js`. Ensure `getAllPlayerStationsWithRefinery`, `getRefineryStationsWithCargo`, `updateStationCargo` are all named mocks accessible in the test scope (declare them with the other mocked fns and include in the `vi.mock` factory + `beforeEach` resets, following the file's existing pattern).

- [ ] **Step 2: Run it — MUST FAIL**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationBuildTick.test.ts`
Expected: FAIL — refining not implemented / mock not wired.

- [ ] **Step 3: Implement the conversion in `stationBuildTick.ts`**

Add imports:
```typescript
import { getRefineryStationsWithCargo, updateStationCargo } from '../db/stationQueries.js';
import { refineGasToFuel } from './stationPassiveEffects.js';
```
(merge `getRefineryStationsWithCargo`/`updateStationCargo` into the existing `../db/stationQueries.js` import; `refineGasToFuel` into the existing `./stationPassiveEffects.js` import.)

In `processStationBuildTick`, AFTER the existing refinery credits-trickle block, add:

```typescript
  // Refinery: convert stored gas into stored fuel (cargo_contents.fuel).
  try {
    const refineryCargoStations = await getRefineryStationsWithCargo();
    for (const r of refineryCargoStations) {
      const newCargo = refineGasToFuel(r.cargo_contents ?? {}, r.refinery_level);
      const before = r.cargo_contents ?? {};
      if ((newCargo.fuel ?? 0) !== (before.fuel ?? 0)) {
        await updateStationCargo(r.id, newCargo);
      }
    }
  } catch (err) {
    logger.error({ err }, 'Refinery gas->fuel conversion failed');
  }
```

- [ ] **Step 4: Build + run test — MUST PASS**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run src/engine/__tests__/stationBuildTick.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `cd packages/server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "stationBuildTick" || echo clean`
```bash
git add packages/server/src/engine/stationBuildTick.ts packages/server/src/engine/__tests__/stationBuildTick.test.ts
git commit -m "feat: refinery converts station gas into fuel each tick (#548)"
```

---

## Task 5: Refuel free from owned station fuel

**Files:**
- Modify: `packages/server/src/rooms/services/EconomyService.ts`
- Test: `packages/server/src/rooms/services/__tests__/stationRefuel.test.ts` (new — pure-decision test)

> The refuel handler `handleRefuel` gates on `_pst === 'station'` (player-station sectors are NOT type 'station') and refuels only from NPC fuel. Add an own-station fuel path BEFORE the NPC path, and relax the gate. The branch decision is extracted to a pure function for testing; the handler wiring is verified by typecheck + the broader suite.

- [ ] **Step 1: Write the failing pure-decision test**

Create `packages/server/src/rooms/services/__tests__/stationRefuel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveOwnStationRefuel } from '../stationRefuelDecision.js';

describe('resolveOwnStationRefuel', () => {
  it('refuels from owned station fuel, capped by tank space', () => {
    const r = resolveOwnStationRefuel(
      { owner_id: 'o1', cargo_contents: { fuel: 500 } },
      'o1', /*tankSpace*/ 200,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.amount).toBe(200);
      expect(r.newStationFuel).toBe(300);
    }
  });
  it('caps at the station fuel when less than tank space', () => {
    const r = resolveOwnStationRefuel({ owner_id: 'o1', cargo_contents: { fuel: 40 } }, 'o1', 200);
    expect(r.ok && r.amount).toBe(40);
  });
  it('is not applicable for a non-owner', () => {
    const r = resolveOwnStationRefuel({ owner_id: 'o2', cargo_contents: { fuel: 500 } }, 'o1', 200);
    expect(r.ok).toBe(false);
  });
  it('is not applicable when the station has no fuel', () => {
    const r = resolveOwnStationRefuel({ owner_id: 'o1', cargo_contents: {} }, 'o1', 200);
    expect(r.ok).toBe(false);
  });
  it('is not applicable when there is no station', () => {
    expect(resolveOwnStationRefuel(null, 'o1', 200).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — MUST FAIL**

Run: `cd packages/server && npx vitest run src/rooms/services/__tests__/stationRefuel.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create the pure decision `packages/server/src/rooms/services/stationRefuelDecision.ts`**

```typescript
import { stationRefuelAmount } from '../../engine/stationPassiveEffects.js';

export interface RefuelStation {
  owner_id: string;
  cargo_contents: Record<string, number>;
}

export type OwnStationRefuel =
  | { ok: true; amount: number; newStationFuel: number }
  | { ok: false };

/**
 * If the requester owns this station and it has stored fuel, compute a free refuel
 * (capped by tank space). Returns ok:false to fall through to the normal NPC refuel path.
 */
export function resolveOwnStationRefuel(
  station: RefuelStation | null,
  requesterId: string,
  tankSpace: number,
): OwnStationRefuel {
  if (!station || station.owner_id !== requesterId) return { ok: false };
  const stationFuel = station.cargo_contents.fuel ?? 0;
  const amount = stationRefuelAmount(tankSpace, stationFuel);
  if (amount <= 0) return { ok: false };
  return { ok: true, amount, newStationFuel: stationFuel - amount };
}
```

- [ ] **Step 4: Run test — MUST PASS**

Run: `cd packages/server && npx vitest run src/rooms/services/__tests__/stationRefuel.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire into `handleRefuel` in `EconomyService.ts`**

Add imports (merge with existing):
```typescript
import { getPlayerStationAt, updateStationCargo } from '../../db/stationQueries.js';
import { resolveOwnStationRefuel } from './stationRefuelDecision.js';
```
(`getPlayerStationAt` / `updateStationCargo` may already be imported in this file from Task-related work — merge, don't duplicate.)

In `handleRefuel`, the current gate is:
```typescript
    // Must be at a station
    const isStation = this.ctx._pst(client.sessionId) === 'station';
    if (!isStation) {
      client.send('refuelResult', {
        success: false,
        error: 'Must be at a station to refuel',
      });
      return;
    }
```
Replace it with a version that also accepts an owned station at the sector, and handles the own-station free-refuel path before the NPC logic. Insert AFTER `const auth = client.auth as AuthPayload;` (and compute sx/sy here):

```typescript
    const sx = this.ctx._px(client.sessionId);
    const sy = this.ctx._py(client.sessionId);
    const ownStation = await getPlayerStationAt(sx, sy);
    const atOwnStation = !!ownStation && ownStation.owner_id === auth.userId;
    const isStation = this.ctx._pst(client.sessionId) === 'station' || atOwnStation;
    if (!isStation) {
      client.send('refuelResult', { success: false, error: 'Must be at a station to refuel' });
      return;
    }

    const shipForRefuel = this.ctx.getShipForClient(client.sessionId);
    const fuelNow = (await getFuelState(auth.userId)) ?? 0;
    const tankSpaceNow = shipForRefuel.fuelMax - fuelNow;
    if (tankSpaceNow <= 0) {
      client.send('refuelResult', { success: false, error: 'Fuel tank is full' });
      return;
    }

    // Free refuel from the owner's own station fuel (refinery output), if available.
    if (atOwnStation) {
      const own = resolveOwnStationRefuel(
        { owner_id: ownStation!.owner_id, cargo_contents: ownStation!.cargo_contents },
        auth.userId,
        Math.min(data.amount, tankSpaceNow),
      );
      if (own.ok) {
        const newFuel = fuelNow + own.amount;
        await saveFuelState(auth.userId, newFuel);
        await updateStationCargo(ownStation!.id, { ...ownStation!.cargo_contents, fuel: own.newStationFuel });
        client.send('refuelResult', {
          success: true,
          fuel: { current: newFuel, max: shipForRefuel.fuelMax },
          credits: await getPlayerCredits(auth.userId),
        });
        return;
      }
    }
```

Then REMOVE the now-duplicated original gate + the original `const ship = ...; const currentFuel = ...; const tankSpace = ...; if (tankSpace <= 0)` block that followed it (the NPC path below continues to use `sx`/`sy` already defined here — delete the later duplicate `const sx = ...; const sy = ...` lines in the NPC path to avoid redeclaration). The NPC path (getStationFuelAndGas → price → deduct → saveFuelState → deductStationFuelStock) stays unchanged otherwise, but reuse the `sx`/`sy`/`shipForRefuel`/`fuelNow`/`tankSpaceNow` already computed (rename references as needed so there are no duplicate declarations).

> IMPORTANT: this edit must not leave duplicate `const sx`/`const sy`/`const ship`/`const currentFuel`/`const tankSpace` declarations. Read the full `handleRefuel` body first and refactor so each is declared once. If the refactor of the NPC path is unclear, keep the own-station block self-contained (it `return`s on success) and leave the NPC path's existing local declarations intact by NOT hoisting sx/sy — i.e. only add the own-station block using its own locals — whichever yields a clean compile. Verify with tsc.

- [ ] **Step 6: Build + typecheck + run tests**

Run: `cd packages/shared && npm run build && cd ../server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "EconomyService|stationRefuelDecision" || echo clean`
Then: `npx vitest run src/rooms/services/__tests__/stationRefuel.test.ts`
Expected: clean; 5 pass. If tsc shows a redeclaration error in EconomyService, fix the duplicate `const` as noted above.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/rooms/services/EconomyService.ts packages/server/src/rooms/services/stationRefuelDecision.ts packages/server/src/rooms/services/__tests__/stationRefuel.test.ts
git commit -m "feat: refuel free from your own station's refined fuel (#548)"
```

---

## Task 6: Sensor — optional pirate combat in the station's quadrant

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Test: covered by Task 2's `pirateCombatAvoidable` pure test (the SectorRoom hook is integration glue verified by typecheck + suite)

> Two identical pirate_zone auto-combat sites exist (moveSector ~line 428, jump ~line 482). Extract a shared private method so the sensor logic lives in one place, then call it at both sites.

- [ ] **Step 1: Add the shared helper method to `SectorRoom`**

Add imports near the top of `SectorRoom.ts` (merge with existing):
```typescript
import { pirateCombatAvoidable } from '../engine/stationPassiveEffects.js';
import { getPlayerSensorLevelInQuadrant } from '../db/stationQueries.js';
```

Add this private method to the `SectorRoom` class (near the other helpers):
```typescript
  /**
   * Auto-start pirate_zone combat on sector entry — UNLESS the player owns a sensor
   * station in this quadrant and the sensor lets them avoid it, in which case the
   * fight is made optional (the player may still engage via combatV3Start).
   */
  private async maybeStartPirateCombat(client: Client, sectorX: number, sectorY: number): Promise<void> {
    const auth = client.auth as AuthPayload | undefined;
    const pirateLevel = Math.min(10, Math.floor(
      Math.sqrt(sectorX * sectorX + sectorY * sectorY) / 50,
    ) + 1);
    if (auth?.userId) {
      const sensorLevel = await getPlayerSensorLevelInQuadrant(
        auth.userId, this.quadrantX, this.quadrantY,
      ).catch(() => 0);
      if (pirateCombatAvoidable(sensorLevel, Math.random())) {
        client.send('logEntry', 'SENSOR-ARRAY: Piratenzone früh erkannt — du kannst angreifen oder ausweichen.');
        return;
      }
    }
    await this.combatV3.handleCombatV3Start(client, { npcLevel: pirateLevel });
  }
```
(Use whatever the room's own quadrant accessors are — `this.quadrantX`/`this.quadrantY` are used elsewhere in this file, e.g. around the quadrantInfo send. If they are instead `this.serviceCtx.quadrantX`, use that. Verify by reading the file.)

- [ ] **Step 2: Replace both pirate_zone auto-combat sites with the helper call**

At the moveSector site (~line 428), replace:
```typescript
        // Auto-start combat v3 if pirate_zone sector
        if (sectorData?.contents?.includes('pirate_zone')) {
          const pirateLevel = Math.min(10, Math.floor(
            Math.sqrt(data.sectorX * data.sectorX + data.sectorY * data.sectorY) / 50,
          ) + 1);
          await this.combatV3.handleCombatV3Start(client, { npcLevel: pirateLevel });
        }
```
with:
```typescript
        // Auto-start combat v3 if pirate_zone sector (sensor may make it optional)
        if (sectorData?.contents?.includes('pirate_zone')) {
          await this.maybeStartPirateCombat(client, data.sectorX, data.sectorY);
        }
```

At the jump site (~line 482), replace the analogous block (uses `data.targetX`/`data.targetY`):
```typescript
        // Auto-start combat v3 if pirate_zone sector
        if (sectorData?.contents?.includes('pirate_zone')) {
          const pirateLevel = Math.min(10, Math.floor(
            Math.sqrt(data.targetX * data.targetX + data.targetY * data.targetY) / 50,
          ) + 1);
          await this.combatV3.handleCombatV3Start(client, { npcLevel: pirateLevel });
        }
```
with:
```typescript
        // Auto-start combat v3 if pirate_zone sector (sensor may make it optional)
        if (sectorData?.contents?.includes('pirate_zone')) {
          await this.maybeStartPirateCombat(client, data.targetX, data.targetY);
        }
```

- [ ] **Step 3: Build + typecheck**

Run: `cd packages/shared && npm run build && cd ../server && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "SectorRoom" || echo clean`
Expected: clean. (If `AuthPayload` / `Client` aren't imported in SectorRoom, they are — they're used throughout; reuse them.)

- [ ] **Step 4: Run the pure helper test (already covers the decision)**

Run: `cd packages/server && npx vitest run src/engine/__tests__/stationPassiveEffects.test.ts`
Expected: PASS (`pirateCombatAvoidable` cases).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: sensor station makes pirate_zone combat optional in its quadrant (#548)"
```

---

## Task 7: Full regression

**Files:** none (verification)

- [ ] **Step 1: Build shared + run all suites**

Run:
```bash
cd packages/shared && npm run build && npx vitest run
cd ../server && npx vitest run
cd ../client && npx vitest run
```
Expected: all pass (shared, server, client; 2 pre-existing server skips). Investigate and fix any failure caused by these changes (esp. the EconomyService refuel refactor — check no other test asserts the old "Must be at a station" gate behavior).

- [ ] **Step 2: Commit any fixups**

```bash
git add -A
git commit -m "test: align suites with station sub-effects (#548)"
```

---

## Self-Review (by plan author)

**Spec coverage:**
- Part 1.1 constants → Task 1 ✓
- Part 1.2 `refineGasToFuel` → Task 2 ✓
- Part 1.3 refinery tick conversion → Task 4 ✓ (query in Task 3)
- Part 1.4 refuel free from own station + relax `'station'` gate → Task 5 ✓
- Part 2.1 sensor constants → Task 1 ✓
- Part 2.2 `pirateCombatAvoidable` → Task 2 ✓
- Part 2.3 `getPlayerSensorLevelInQuadrant` → Task 3 ✓
- Part 2.4 SectorRoom optional-combat hook (both sites) → Task 6 ✓
- Tests → each task TDD ✓

**Placeholder scan:** none. The two judgment-required edits (EconomyService refuel refactor to avoid duplicate `const`; confirming the room's quadrant accessor name) carry explicit "read first, verify with tsc" instructions and fallbacks — not placeholders.

**Type consistency:** `refineGasToFuel`, `pirateCombatAvoidable`, `stationRefuelAmount`, `resolveOwnStationRefuel`, `getRefineryStationsWithCargo`, `getPlayerSensorLevelInQuadrant`, `maybeStartPirateCombat` are each defined once and consumed consistently. Constants names match the spec. No migration (fuel in `cargo_contents`; sensor uses existing column).
