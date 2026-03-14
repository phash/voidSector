# CLAUDE.md — voidSector

Multiplayer 2D space-exploration idle MMO · CRT terminal aesthetics · TypeScript monorepo

> **Programmierrichtlinien** → [`docs/programming-guidelines.md`](docs/programming-guidelines.md) — verbindlich für alle Implementierungen (Spec-Driven, TDD, Clean Code, UX, Fehlerbehandlung, Workflow)

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
cd packages/server && npx vitest run    # ~973 tests
cd packages/client && npx vitest run    # ~499 tests
cd packages/shared && npx vitest run    # ~205 tests

# After changing shared/: REQUIRED
cd packages/shared && npm run build
```

## Docker Stack (Production)

Full stack runs via `docker compose up -d` (postgres, redis, server, client, cloudflared).

```bash
sudo systemctl enable --now docker   # auto-start Docker on reboot (run once)
docker compose up -d                 # start all services
docker compose build <service>       # rebuild after code changes (e.g. client, server)
```

**Cloudflare Quick Tunnel** — URL changes on every restart:
```bash
docker compose logs cloudflared | grep trycloudflare   # get current public URL
```

**Admin API** — token is in `docker-compose.yml` env `ADMIN_TOKEN`:
```bash
# Default dev token: vs-admin-2026
curl -H "Authorization: Bearer vs-admin-2026" http://localhost:2567/admin/api/stories
```

**DB Migrations**: auto-run on server startup. Next migration: **061**.

**DB queries (Docker)**: `psql -U postgres` fails — use env vars:
```bash
docker exec voidsector-postgres-1 bash -c 'psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1"'
```

---

## Development Workflow

**Always develop in a feature branch — never commit directly to `master`.**

```bash
git checkout -b feat/<feature-name>   # start every feature here
# ... implement, test, commit ...
git push origin feat/<feature-name>
# then PR or merge back to master
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

**11 domain services**: NavigationService · ScanService · CombatService · MiningService · EconomyService · FactionService · QuestService · ChatService · ShipService · WorldService · FriendsService

---

## DB Migrations

`packages/server/src/db/migrations/` — **001–070**, auto-run on startup.
All `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` (idempotent).
Next: **071**.

---

## Cockpit Layout (6 Sections)

| Section | ID | Content |
|---------|-----|---------|
| Sec 1 | `cockpit-sec1` | Program Selector (13 programs: NAV-COM, MINING, CARGO, BASE-LINK, TRADE, FACTION, QUESTS, TECH, QUAD-MAP, NEWS, LOG, ACEP, FRIENDS) |
| Sec 2 | `cockpit-sec2` | Main Monitor — RadarCanvas or program content |
| Sec 3 | `cockpit-sec3` | Detail Monitor — context panel per program |
| Sec 4 | `cockpit-sec4` | Settings (ShipStatus + CombatStatus + Settings) |
| Sec 5 | `cockpit-sec5` | Navigation (SectorInfo + NavControls + HardwareControls) |
| Sec 6 | `cockpit-sec6` | Comms (CommsScreen) |

---

## Key Patterns

- **AP**: lazy evaluation, no tick loop — `calculateCurrentAP(state, Date.now())` on each action
- **World gen**: deterministic `hashCoords(x, y, seed)` — sectors generated on demand, saved to DB. Origin is **(0,0)** — world extends into positive x/y.
- **Spawn**: new players spawn within **radius 5 of (0,0)** — coords x∈[1,5], y∈[1,5] (`engine/spawn.ts`)
- **Rooms**: per-quadrant. Intra-quadrant: `moveSector` message. Cross-quadrant: full leave/join
- **Errors**: server sends `{ code, message }` → client logs + sets `actionError` for `InlineError`
  - Some services send plain string, others send `{ code, message }` — client handler must handle both
- **Tests**: Vitest everywhere. Client: jsdom + RTL + jest-canvas-mock (jest-shim.ts)
- **vitest EACCES** on `node_modules/.vite/vitest/results.json` after client tests — benign permission error, check `Test Files X passed` line instead

---

## Current State (2026-03-14)

**Branch:** `master`

### Merged (all on master)
- All phases 1–7: fuel, jumpgates, autopilot, ship designer, trade, factions, quests, combat v2
- Codebase review (#133): SectorRoom decomposed to 11 services, ESLint/Prettier, pino logging
- Admin console, quadrant system, QUAD-MAP, first-contact naming
- 6-section cockpit layout, bookmarks, staleness rendering, nav-grid overhaul
- All Quality Sprints (S0–S4), Phase 2, Phase LU, Phase D, Phase AQ (#170–175)
- **Humanity Rep System** ✅: server-wide aggregate alien rep, encounter chance modifier
- **Phase EW** ✅ (#206): frictionEngine, expansionEngine, warfareEngine, StrategicTickService
- **ACEP** ✅: XP engine, 4 paths, traits, personality, permadeath, radar icon, AUSBAU gating (lab/factory)
- **Forschung & Wissen** ✅: Wissen-Ressource, typisierte Artefakte (9 Typen), TechTreeCanvas
- **Hull-Legacy-Cleanup** ✅ (#291): BASE_* constants, hyperjump V2 permanent, fuel bar UI
- **Human Expansion** ✅ (#360): ConquestEngine, station conquest, QUAD-MAP mixed coloring, resource pool
- **Friends System** ✅ (#370): FriendsService, PlayerCard modal, FRIENDS program, chat block, cross-room via friendsBus
- **Game Config System** ✅ (#405): 256 balance constants in DB, Admin CONFIG tab, Redis Pub/Sub live-updates
- **Regelwerk-Review** ✅ (#379-393): AP rebalance, fuel/hyperdrive, module stats, sector symbols, autopilot 800ms
- **Smooth Hyperjump** ✅ (#448): straight-line flight animation, 200ms/sector, easeInOutCubic
- **Blueprint Quest Rewards** ✅ (#406): rewardBlueprint field, duplicate fallback, 3 elite quests
- **Per-Faction Expansion** ✅ (#434): individual expansion speeds via game_config DB

### Key recent changes
- `BASE_CARGO = 20`, `BASE_SCANNER_MEMORY = 10`, `FUEL_MIN_TANK = 10000`
- Generator AP/s: MK.I-V = 2/4/6/8/10 (was 0.2-1.0)
- Area-Scan radii: 4/8/12/16/20, costs: 3/5/8/14/18
- Hyperdrive regen per tier: MK.I=2, MK.II=4, MK.III=6, MK.IV=8, MK.V=10
- Mining without laser: 0.1/s + 1 AP, with laser: 1.0/s + 0 AP
- Natural jumpgates removed (only ancient), lab upgrade system removed (AUSBAU gating)
- Human starting territory: 9 quadrants (0:0 to 2:2)
- Legacy combat v1 removed, blueprint tier enforcement active

Full roadmap: `docs/plans/2026-03-09-master-roadmap.md`
Game rules: `docs/rulebook-spec.md` · `docs/rulebook-implementation.md` · `docs/rulebook-comparison.md`
