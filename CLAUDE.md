# CLAUDE.md — voidSector

## Project
Multiplayer 2D space-exploration idle MMO with CRT terminal aesthetics. Monorepo with `packages/shared`, `packages/server`, `packages/client`.

## Commands
```bash
npm run dev:server          # Game server (port 2567)
npm run dev:client          # Vite dev server (port 3201)
npm run docker:up           # PostgreSQL + Redis
npm test                    # All tests

# Per-package tests
cd packages/server && npx vitest run    # 198 tests
cd packages/client && npx vitest run    # 132 tests
cd packages/shared && npx vitest run    # 25 tests
```

## Code Style
- TypeScript strict mode, 2-space indent, single quotes, semicolons
- `import type { ... }` for type-only imports
- Server imports use `.js` extension (ESM); client imports don't (bundler)
- Interfaces: PascalCase. Functions/variables: camelCase. Constants: UPPER_SNAKE_CASE
- Files: camelCase for modules, PascalCase for React components
- Conventional commits: `feat:`, `fix:`, `test:`, `docs:`

## Architecture
- **Server**: Colyseus rooms (SectorRoom per sector), PostgreSQL (queries.ts), Redis (AP state)
- **Client**: React + Zustand (gameSlice + uiSlice), Canvas radar (RadarRenderer), singleton GameNetwork
- **Shared**: types.ts + constants.ts, consumed by both packages

## Key Patterns
- AP system: lazy evaluation, no server tick loop — calculated on each action
- World gen: deterministic seed-based (`hashCoords(x, y, worldSeed)`)
- Network: message-based (client sends command, server responds with result)
- State: Zustand with `useStore.setState()` for shallow merges
- Tests: Vitest everywhere. Client uses jsdom + RTL + jest-canvas-mock (via jest-shim.ts)

## DB Migrations
Files in `packages/server/src/db/migrations/` (001-015). Auto-run on startup.
All `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` for idempotency.

## Current State
Branch `feat/ux-comms-overhaul` (28 commits, merged) adds:
jump animation, radar zoom/pan, visual overhaul, two-stage scan, AP improvements,
cluster spawn system, communication/relay routing, structure building.

Branch `feat/storage-trading` (merged) adds:
Credits currency, Storage building (3 tiers, transfer model), Trading Post (NPC trade + player market),
TRADE monitor, DetailPanel scan bugfix.

Branch `feat/dataslates-factions` (merged) adds:
Data Slates (sector/area maps, create/activate/trade/NPC buyback), Factions (create/join/invite/ranks/chat),
FACTION monitor, CARGO slate UI, TRADE slate marketplace.

Branch `feat/npc-ecosystem` (merged) adds:
NPC Ecosystem Phase 4: Seed-based NPC generation at stations, 4 NPC factions (Traders/Scientists/Pirates/Ancients + Independent),
reputation system (-100..+100 per faction), procedural quest system (fetch/delivery/scan/bounty with daily rotation),
auto-battle (flee/fight/negotiate), scan events (pirate ambush/distress/anomaly/artifact),
faction upgrades at honored tier, QUESTS monitor, BattleDialog overlay.

Branch `feat/phase5-deep-systems` (merged) adds:
Phase 5 Deep Systems: Fuel system (consumption + refueling), JumpGates (bidirectional + wormholes + frequency minigame),
rescue missions (distress calls + survivor delivery), faction upgrade tree (3 tiers, A/B choices with bonuses applied to
mining/scan/trade/combat), trade route automation, custom data slates, multi-content sectors,
mining nav-lock bugfix (#17), UI fixes (#16).

Branch `feat/nav-grid-overhaul` (merged) adds:
Nav-Grid Overhaul: Dynamic grid sizing (fills canvas based on zoom), CSS overflow fix (page no longer scrolls),
status LEDs on monitor bezels, bookmark system (5 custom slots + HOME/SHIP), far-navigation with autopilot
(travel to discovered sectors), staleness rendering (dim old discoveries), relog position fix (centers on last position).
Issues addressed: #21, #22, #23, #24, #25.

Quality Sprint (PR #67, merged): Cheat protection (coord bounds, rate limiting, anomaly logging),
edge case coverage for comms and scanEvents, context-sensitive help system (HelpSlice, HelpOverlay, 8 tips).

Branch `feat/combat-v2` (PR #72, merged) adds:
Combat System v2: 5-round tactical combat with weapon types (laser/railgun/missile/EMP), shield system,
tactic choices (assault/balanced/defensive), special actions (aim/evade), 13 new ship modules (8 weapons,
3 shields, point defense, ECM suite), station defense system (turrets/shields/ion cannon with auto-combat),
CombatV2Dialog UI, DB migration 015, feature-flagged via FEATURE_COMBAT_V2. 355 total tests.
