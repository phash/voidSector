# CLAUDE.md — voidSector

Multiplayer 2D space-exploration idle MMO · CRT terminal aesthetics · TypeScript monorepo

> **Memory files** (in `~/.claude/projects/E--claude-voidSector/memory/`):
> - Architecture, services, patterns → read **architecture.md** before touching server/client code
> - DB schema, migrations, Redis → read **database-schema.md** before DB work
> - Sprint status, open issues, roadmap → read **roadmap.md** before planning/feature work
> - Git, commits, Docker, tests → read **workflow.md** before dev operations

---

## Commands

```bash
npm run dev:server          # Game server (port 2567)
npm run dev:client          # Vite dev server (port 3201)
npm run docker:up           # PostgreSQL + Redis
npm test                    # All tests (run per-package, see below)

# Tests — always run from package directory
cd packages/server && npx vitest run    # ~640 tests
cd packages/client && npx vitest run    # 491 tests
cd packages/shared && npx vitest run    # ~191 tests

# After changing shared/: REQUIRED
cd packages/shared && npm run build
```

---

## Code Style

- TypeScript strict mode · 2-space indent · single quotes · semicolons
- `import type { ... }` for type-only imports
- Server: `.js` extension on imports (ESM) · Client: no extension (bundler)
- Naming: PascalCase interfaces · camelCase functions/vars · UPPER_SNAKE_CASE constants
- Files: camelCase modules · PascalCase React components
- Commits: `feat:` `fix:` `test:` `docs:` `chore:` + Co-Author line

---

## Architecture (summary — see architecture.md for full detail)

- **Server**: Colyseus rooms per quadrant (`quadrant_qx_qy`), SectorRoom → 10 domain services via ServiceContext DI. PostgreSQL (all queries in `queries.ts`), Redis (AP/fuel/mining/position state). Structured logging via pino.
- **Client**: React + Zustand (`gameSlice` + `uiSlice` + `helpSlice`), Canvas radar (`RadarRenderer`), singleton `GameNetwork`
- **Shared**: `types.ts` + `constants.ts` → compiled to `dist/`, re-exported from `index.ts`

**10 domain services**: NavigationService · ScanService · CombatService · MiningService · EconomyService · FactionService · QuestService · ChatService · ShipService · WorldService

---

## DB Migrations

`packages/server/src/db/migrations/` — **001–027**, auto-run on startup.
All `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` (idempotent).
Next: **028** (Phase 2 Sektor-Rebuild).

---

## Cockpit Layout (6 Sections)

| Section | ID | Content |
|---------|-----|---------|
| Sec 1 | `cockpit-sec1` | Program Selector (12 programs: NAV-COM, RADAR, SCAN, MINING, TRADE, CARGO, QUESTS, FACTION, HANGAR, TECH, QUAD-MAP, TV) |
| Sec 2 | `cockpit-sec2` | Main Monitor — RadarCanvas or program content |
| Sec 3 | `cockpit-sec3` | Detail Monitor — context panel per program |
| Sec 4 | `cockpit-sec4` | Settings (ShipStatus + CombatStatus + Settings) |
| Sec 5 | `cockpit-sec5` | Navigation (SectorInfo + NavControls + HardwareControls) |
| Sec 6 | `cockpit-sec6` | Comms (CommsScreen) |

---

## Key Patterns

- **AP**: lazy evaluation, no tick loop — `calculateCurrentAP(state, Date.now())` on each action
- **World gen**: deterministic `hashCoords(x, y, seed)` — sectors generated on demand, saved to DB
- **Rooms**: per-quadrant. Intra-quadrant: `moveSector` message. Cross-quadrant: full leave/join
- **Errors**: server sends `{ code, message }` → client logs + sets `actionError` for `InlineError`
- **Tests**: Vitest everywhere. Client: jsdom + RTL + jest-canvas-mock (jest-shim.ts)

---

## Current State (2026-03-09)

**Branch:** `fix/quality-sprint`

### Merged Branches (all on master)
- All phases 1–7: fuel, jumpgates, autopilot, ship designer, trade, factions, quests, combat v2
- Codebase review (#133): SectorRoom decomposed to 10 services, ESLint/Prettier, pino logging
- Admin console, quadrant system, QUAD-MAP, first-contact naming
- 6-section cockpit layout, bookmarks, staleness rendering, nav-grid overhaul

### Active Sprint: fix/quality-sprint
- **Sprint 0** ✅: Bugfixes #143, #144, #154
- **Sprint 1** 🔄: UI quick wins — 3 done (#160, #153, #158), 3 remaining (#161/#147, #152, #155)

### Upcoming (in order)
1. Sprint 1 remaining → Sprint 2 (nav/map) → Sprint 3 (mining/trade) → Sprint 4 (station)
2. Phase 2: Sektor-System Rebuild (#162–168) — full sector type system rewrite
3. Phase LU: Lebendiges Universum (#177–184) — NPC faction expansion, territory system
4. Phase AQ: Alien Quest System (#170–175) — 5 alien races, story quests
5. ACEP: Adaptive Craft Evolution Protocol — ship XP/personality/permadeath

Full roadmap: `docs/plans/2026-03-09-master-roadmap.md`
