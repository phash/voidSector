# Mining Redesign (#279)

## Summary

Resources in sectors are finite and deplete when mined. Mining auto-stops server-side when the resource is exhausted or cargo is full. A "mine all" mode chains through available resources. Resources regenerate tick-based after a delay. Display shows current/max values.

## Changes

### 1. Resource Depletion

After `stopMining`, decrement `sectors.metadata.resources[resource]` by the mined amount in the DB. Multiple players mining the same sector see the same pool.

**DB update in `handleStopMine`:**
```
UPDATE sectors SET metadata = jsonb_set(metadata, '{resources,<resource>}', (current - mined)::text::jsonb)
WHERE x = $1 AND y = $2
```

Also update `last_mined` (timestamp) and store `last_mined_tick` (universe tick number) for regen calculation.

### 2. Server-Side Auto-Stop

When mining starts, calculate completion time: `timeout = Math.ceil(sectorYield / rate) * 1000` ms. Set a `setTimeout` that calls the stop logic when the resource is exhausted.

Also calculate cargo-full time: `cargoTimeout = Math.ceil(cargoSpace / rate) * 1000` ms. Use `Math.min(timeout, cargoTimeout)` for the actual timer.

Store the timer reference so it can be cleared on manual stop or disconnect.

**Timer storage:** Map of `playerId → NodeJS.Timeout` on the MiningService instance. Cleared on stopMine, disconnect, or room dispose.

### 3. Mine-All Mode

New field `mineAll: boolean` in `MiningState` (default `false`).

When auto-stop fires and `mineAll === true`:
1. Check remaining resources in sector (ore → gas → crystal order)
2. If another resource is available AND cargo has space: start mining that resource automatically
3. Send `miningUpdate` to client with new resource
4. Set new auto-stop timer
5. If no resources left or cargo full: stop completely

**Client:** New checkbox "[x] ALLES ABBAUEN" in MiningScreen. Sends `mineAll: true/false` with the `startMine` message. Also a toggle to change it while mining is active.

### 4. Display: Current/Max Resources

Sector data must include both current (after depletion + regen) and max values.

**Server:** `getSector` already reads `max_ore, max_gas, max_crystal` columns. Ensure both current and max are sent to the client in sector data.

**Wire format change:** Sector resources become:
```typescript
resources: {
  ore: number;      // current (after depletion + regen)
  gas: number;
  crystal: number;
  maxOre: number;   // maximum (for display)
  maxGas: number;
  maxCrystal: number;
}
```

**Client MiningScreen:** Display changes from `CRYSTAL: 7` to `CRYSTAL 3/7` where 3 is current and 7 is max.

**Client DetailPanel/SectorInfo:** Show `ore: 3/7` format in sector details.

### 5. Regeneration (Tick-Based)

Replace current time-based regen with tick-based:

**Constants (replace existing regen constants):**
```typescript
export const RESOURCE_REGEN_DELAY_TICKS = 50;
export const RESOURCE_REGEN_INTERVAL_TICKS = 12; // 1 unit per 12 ticks
```

**Regen formula in `getSector`:**
```
ticksSinceMined = currentTick - last_mined_tick
if ticksSinceMined <= RESOURCE_REGEN_DELAY_TICKS:
  current = depleted_value
else:
  regen = floor((ticksSinceMined - RESOURCE_REGEN_DELAY_TICKS) / RESOURCE_REGEN_INTERVAL_TICKS)
  current = min(max, depleted + regen)
```

**New DB column:** `last_mined_tick BIGINT` on sectors table (migration). Used instead of `last_mined` timestamp for regen calculation.

**Per-resource tracking:** Need to track depletion per resource independently. Add columns or store in metadata:
```json
{
  "resources": { "ore": 3, "gas": 0, "crystal": 7 },
  "lastMinedTick": { "ore": null, "gas": 1200, "crystal": null }
}
```

This allows ore, gas, crystal to regenerate independently.

### 6. MiningState Type Change

```typescript
export interface MiningState {
  active: boolean;
  resource: ResourceType | null;
  sectorX: number;
  sectorY: number;
  startedAt: number | null;
  rate: number;
  sectorYield: number;
  mineAll: boolean;        // NEW
}
```

### 7. startMine Message Change

Add `mineAll` flag to the startMine message:
```typescript
{ resource: ResourceType; mineAll?: boolean }
```

Add `toggleMineAll` message to toggle while mining:
```typescript
room.onMessage('toggleMineAll', (client, data: { mineAll: boolean }) => { ... })
```

## Files to Change

| File | Changes |
|------|---------|
| `packages/shared/src/types.ts` | Add `mineAll` to MiningState |
| `packages/shared/src/constants.ts` | Replace regen constants with tick-based; add RESOURCE_REGEN_DELAY_TICKS, RESOURCE_REGEN_INTERVAL_TICKS |
| `packages/server/src/engine/mining.ts` | Add `mineAll` param to startMining |
| `packages/server/src/rooms/services/MiningService.ts` | Auto-stop timer, mine-all chaining, depletion DB write, toggleMineAll handler |
| `packages/server/src/rooms/SectorRoom.ts` | Register toggleMineAll message handler |
| `packages/server/src/db/queries.ts` | getSector regen: tick-based formula, return max values; new updateSectorResource query |
| `packages/server/src/db/migrations/045_mining_ticks.sql` | Add last_mined_tick column, ensure per-resource metadata |
| `packages/server/src/rooms/services/RedisAPStore.ts` | Add mineAll to mining state persistence |
| `packages/client/src/components/MiningScreen.tsx` | Current/max display, mineAll checkbox, resource format X/Y |
| `packages/client/src/components/DetailPanel.tsx` | Show current/max in sector resource display |
| `packages/client/src/components/SectorInfo.tsx` | Show current/max resources (if separate from DetailPanel) |

## Out of Scope

- Per-player resource instances (all players share same pool)
- Mining speed changes
- New resource types
- Mining animation changes beyond display format
