# BB1 — Background Universe Tick (living-universe keystone)

**Datum:** 2026-06-07 · **Branch:** `feat/living-universe-phase0`.

## Problem
NPC simulation only runs within ~200 sectors of an online player (SP10 lazy anchor tick). With ~2
players, 99.9% of the map is frozen. Raising the radius re-OOMs (the reason ticks were disabled). The
fix is a SECOND tick: slow, shallow, **chunked**, global — independent of anchors.

## Design — `engine/backgroundTickService.ts`
A bounded sweep over all civ ships, a small page per run, so per-tick work is constant regardless of
world size (OOM-safe by construction):

- Module-level `cursor` (last processed ship id; starts 0).
- `processBackgroundTick()`:
  1. `getShipsAfterId(cursor, BACKGROUND_CHUNK_SIZE)` — `SELECT * FROM civ_ships WHERE id > $1 ORDER BY id LIMIT $2`.
  2. If empty → wrap (`cursor = 0`) and return.
  3. For each ship: run `nextShipState` up to `BACKGROUND_CATCHUP_STEPS` times in-memory (logical-time
     catch-up so a long-unticked ship makes real progress), then ONE `updateShip` (persists
     patrol_state — Phase-0 fix). No broadcast (distant ships aren't visible to anyone).
  4. Advance `cursor` to the last id; if fewer than a full page returned, wrap to 0.
- Pure helper `advanceCursor(lastId, returned, chunkSize)` → next cursor (testable).

## Constants (`shared/constants.ts`, config-tunable later)
- `BACKGROUND_TICK_INTERVAL = 60` universe ticks (×5s = 5 min cadence).
- `BACKGROUND_CHUNK_SIZE = 300` ships/run.
- `BACKGROUND_CATCHUP_STEPS = 8` AI steps applied per ship per sweep.

## Wiring — `universeBootstrap.ts`
In the existing tick callback: `if (result.tickCount % BACKGROUND_TICK_INTERVAL === 0) await processBackgroundTick()`.
Reuses the existing engine loop (no new timer). Runs regardless of online players.

## Safety
Per-run work = `BACKGROUND_CHUNK_SIZE × BACKGROUND_CATCHUP_STEPS` in-memory steps + ≤`CHUNK_SIZE`
DB writes, every 5 min — constant, world-size-independent. No full-world materialization. This is the
deliberate opposite of "widen the anchor radius" (which OOM'd).

## Tests
`backgroundTickService.test.ts`: advanceCursor wrap/advance; processBackgroundTick with mocked
queries (chunk ticked, cursor advances, wraps on short page, catch-up applies multiple steps).

## Not in BB1 (later)
Station consume/restock + demand pricing + trader-to-low-stock routing = BB2, layered onto this same
sweep. BB1 only proves the safe global-tick framework + keeps distant NPC ships moving.
