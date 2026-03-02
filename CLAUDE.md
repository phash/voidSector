# CLAUDE.md — voidSector

## Project
Multiplayer 2D space-exploration idle MMO with CRT terminal aesthetics. Monorepo with `packages/shared`, `packages/server`, `packages/client`.

## Commands
```bash
npm run dev:server          # Game server (port 2567)
npm run dev:client          # Vite dev server (port 3000)
npm run docker:up           # PostgreSQL + Redis
npm test                    # All tests

# Per-package tests
cd packages/server && npx vitest run    # 57 tests
cd packages/client && npx vitest run    # 40 tests
cd packages/shared && npx vitest run    # 5 tests
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
Files in `packages/server/src/db/migrations/` (001-005). Auto-run on startup.
All `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` for idempotency.

## Current State
Branch `feat/ux-comms-overhaul` (28 commits, not yet merged) adds:
jump animation, radar zoom/pan, visual overhaul, two-stage scan, AP improvements,
cluster spawn system, communication/relay routing, structure building, and 102 tests.
