# XENO — Alien Interaction Framework (Sub-project 1 of #534)

**Issue:** #534 · **Date:** 2026-05-29 · **Status:** approved (design)

## Background

`AlienInteractionService` (server, ~1070 lines, 10 factions: scrappers, archivists, consortium, kthari, mycelians, mirror_minds, tourist_guild, silent_swarm, helions, axioms) is fully built but has **no client UI** — `sendAlienInteract` exists in the network layer, nothing calls it. Each faction has distinct mechanics (barter, library query, ranks, symbol puzzle, contracts, offerings…) plus common actions (`firstContact`, `getReputation`, `greet`). Interaction is gated by `isInFirstContactRange(quadrantX, quadrantY, factionId)` (Chebyshev quadrant distance ≥ per-faction `ALIEN_FIRST_CONTACT_DISTANCE`), so it is unreachable near the (0,0) spawn.

## Decisions (locked with user)

- Build the **full bespoke 10-faction UI**, but **decomposed**: this spec covers **sub-project 1 = the framework + common interactions**; bespoke per-faction panels are later sub-projects.
- **Entry point:** a new **XENO cockpit program** (15th program) listing in-range factions and opening interaction.
- **Reachability:** server-driven (single source of truth) — a new `xenoStatus` action returns per-faction reachable/rep/tier for the player's quadrant. Client does not duplicate the gating constant.
- **Testing reach:** use the existing admin endpoint `PATCH /players/:id/position` to teleport a test pilot into a faction's range (no new code).

## Goal

A working, testable XENO program that lets a player, when in range of an alien faction: see which factions are reachable, make first contact, view reputation/tier, `greet`, and run any currently-supported action via a generic runner that renders the `alienInteractResult`. This makes all 10 factions interactable at the common level and provides the shell for bespoke per-faction panels.

## Architecture

### Server — new `xenoStatus` action (AlienInteractionService)
- Reuse the existing `alienInteract` message with `action: 'xenoStatus'` (no real factionId needed — pass any/`'_'`). Handle it in `handleAlienInteract` **before** the faction-validation + range check (exactly like the existing `getReputation` early-return), so it bypasses the range gate. For each of the 10 factions compute `{ factionId, reachable: isInFirstContactRange(quadrantX, quadrantY, factionId), firstContacted, reputation, tier: getRepTierLabel(getRepTier(rep)) }` using `getAllAlienReputations(userId)` + first-contact state. Send `client.send('xenoStatusUpdate', { factions: [...] })`. (Add `action !== 'xenoStatus'` to the early valid/range guards so it isn't rejected.)
- `firstContacted` source: reuse the existing first-contact persistence (`setAlienFirstContact`/its getter). If only a setter exists, add a `getAlienFirstContacts(userId): string[]` query.
- No change to existing per-faction handlers; the framework just exposes the common actions already implemented.

### Client — XenoScreen + wiring
- **Shared:** add `MONITORS.XENO = 'XENO'`, add to `COCKPIT_PROGRAMS` + `COCKPIT_PROGRAM_LABELS` ('XENO').
- **Store:** `xenoStatus: Array<{factionId,reachable,firstContacted,reputation,tier}>` + `setXenoStatus`; `alienInteractResult` latest result for rendering.
- **Network:** `requestXenoStatus()` → send `alienInteract {factionId:'_', action:'xenoStatus'}` (or a dedicated `xenoStatus` message); handlers for `xenoStatusUpdate` → setXenoStatus and `alienInteractResult` → store + log/toast.
- **`XenoScreen.tsx`:** on mount `requestXenoStatus()`. Render the 10 factions (name, tier, reachable/locked). Selecting a reachable faction shows: rep/tier; `[ERSTKONTAKT]` if not firstContacted (sends `firstContact`); `[GREET]`; and a generic action area. The generic action runner sends `sendAlienInteract(faction, action, payload?)` and renders the returned `alienInteractResult` (message, repBefore→repAfter, tier, or error via InlineError). Faction-specific actions are out of scope here (added with each faction's bespoke panel) — the runner is built so they slot in.
- **GameScreen/ProgramSelector:** route `MONITORS.XENO → <XenoScreen />`; the program button appears automatically from `COCKPIT_PROGRAMS`.
- **HelpSlice:** add `first_xeno` tip (German, ≤6 lines) + a `[?]` button on the XENO header (CLAUDE.md onboarding rule).

### Data flow
XenoScreen mount → `requestXenoStatus` → server `xenoStatus` → `xenoStatusUpdate` → store → list renders. Faction action click → `sendAlienInteract` → server faction/common handler → `alienInteractResult` → store → result rendered; a rep-changing action is followed by a `requestXenoStatus` refresh.

## Components (isolation)
- `xenoStatus` server handler: pure-ish mapping (faction list → reachable/rep), testable with a mock context.
- `XenoScreen`: presentation + dispatch; no business logic beyond choosing which action button to show.
- Generic action runner: one function `runAlienAction(faction, action, payload?)` → network; result rendering is data-driven from `alienInteractResult`.

## Testing
- **Server unit:** `xenoStatus` returns correct reachable flags (mock `isInFirstContactRange`) + rep/tier mapping for in/out-of-range quadrants.
- **Client unit:** XenoScreen renders the faction list from store; locked factions show "außer Reichweite"; ERSTKONTAKT button sends `firstContact`; `alienInteractResult` with an error renders InlineError; result message renders on success.
- **Docker E2E:** register pilot → admin `PATCH /players/:id/position` to a sector whose quadrant is in a faction's first-contact range → open XENO → that faction shows reachable → ERSTKONTAKT succeeds (flavor shown) → GREET changes reputation → `xenoStatus` refresh reflects new tier. 0 console errors.

## Out of scope (later sub-projects, one per faction or grouped)
- Bespoke faction mechanics UIs: scrappers barter, archivists `queryLibrary`, consortium contracts (`getContracts`/`fulfillContract`), kthari `claimRank`, mycelians `getPuzzle`/`submitAnswer`, mirror_minds `observe`, tourist_guild `welcomeTourists`/`rejectTourists`, helions `offering`, axioms `submitData`/puzzle. Each slots into the generic runner / a faction sub-panel.
- Making alien content reachable by design (#533 — lowering distance gates / nearer seeding) — separate; testing here uses admin teleport.

## Risks
- `ALIEN_FIRST_CONTACT_DISTANCE` values are large → without admin teleport the feature is unreachable; the E2E depends on the admin position endpoint.
- Adding a 15th program must not break the mobile MEHR menu or the 6-section layout (add XENO to mobile `MEHR_MONITORS` too).
- First-contact state getter may need adding if only a setter exists.
