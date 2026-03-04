# VOID SECTOR

A 2D Space-Exploration Idle MMO with retro CRT terminal aesthetics. The UI is a **virtual hardware console** — every element looks like part of an analog high-performance computer from the 80s, complete with physical bezels, toggle switches, and LED indicators.

Amber monochrome (#FFB000 on #050505). Mobile-first. 4 color profiles available.

## Core Loop

Explore, mine, build, communicate: Players move sector by sector through an infinite 2D coordinate system. Every action costs Action Points (AP) that regenerate idle over time. Scan for resources, mine them, build relay networks, and communicate with other players. Discovered sectors remain persistent. Other players are visible in real-time.

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Game Server | [Colyseus](https://colyseus.io/) | Room abstraction, state sync, clustering-ready |
| Frontend | React 18 + Canvas | Terminal UI, radar rendering with CRT effects |
| State | Zustand | Client-side state management (game + UI slices) |
| Testing | Vitest + RTL | 102 tests (server, client, shared) |
| Database | PostgreSQL 16 | Persistent storage (players, sectors, discoveries) |
| Cache | Redis 7 | AP state, player positions, sessions |
| Shared Types | TypeScript Package | Shared interfaces between client and server |
| Build | Vite 5 | Client bundling and dev server |
| Monorepo | npm workspaces | `packages/shared`, `packages/server`, `packages/client` |

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm 9+

## Quick Start

```bash
# Clone and install
git clone https://github.com/phash/voidSector.git
cd voidSector
npm install

# Start infrastructure (PostgreSQL + Redis)
npm run docker:up

# Start server (runs migrations automatically)
cd packages/server
cp .env.example .env
cd ../..
npm run dev:server

# In a second terminal — start client
npm run dev:client
```

Open http://localhost:3000, register an account, and start exploring.

## Project Structure

```
void-sector/
├── packages/
│   ├── shared/          # Shared types, constants, symbols
│   │   └── src/
│   │       ├── types.ts
│   │       ├── constants.ts
│   │       └── index.ts
│   ├── server/          # Colyseus game server
│   │   └── src/
│   │       ├── auth.ts              # JWT auth (register/login) + spawn
│   │       ├── app.config.ts        # Colyseus + Express config
│   │       ├── index.ts             # Server entry point
│   │       ├── db/                  # PostgreSQL client, migrations (001-005), queries
│   │       ├── engine/              # AP, commands, comms, mining, spawn, worldgen
│   │       └── rooms/               # SectorRoom, schemas, Redis store
│   └── client/          # React frontend
│       └── src/
│           ├── canvas/              # RadarRenderer, JumpAnimation, useCanvas
│           ├── components/          # NavControls, MiningScreen, CargoScreen, CommsScreen, etc.
│           ├── network/             # Colyseus client network layer
│           ├── state/               # Zustand store (gameSlice + uiSlice)
│           ├── styles/              # CRT effects, global styles, color themes
│           └── test/                # Test mocks and setup
├── docker-compose.yml   # PostgreSQL + Redis
└── docs/plans/          # Design docs and implementation plan
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:server` | Start game server (port 2567) |
| `npm run dev:client` | Start Vite dev server (port 3000) |
| `npm run build` | Build all packages |
| `npm test` | Run all tests |
| `npm run docker:up` | Start PostgreSQL + Redis |
| `npm run docker:down` | Stop Docker services |

## Architecture

### Server

- **SectorRoom**: One Colyseus room per sector coordinate. Auto-created on first player entry, auto-disposed when empty.
- **World Generation**: Deterministic seed-based (`hashCoords(x, y, worldSeed)`). Sectors are generated on first visit and persisted to PostgreSQL.
- **AP System**: Lazy evaluation — no server tick loop. AP regeneration is calculated on each action based on elapsed time.
- **Auth**: bcrypt password hashing + JWT tokens.

### Client

- **CRT Theme**: CSS scanlines, flicker animation (with `prefers-reduced-motion` support), vignette, hardware bezel with draggable knobs. 4 color profiles (Amber Classic, Green Phosphor, Ice Blue, High Contrast).
- **Radar**: HTML5 Canvas renderer at 60fps, DPI-aware, 3 zoom levels, drag-to-pan, sector color accents, jump animation with CRT glitch effects.
- **Multi-Monitor System**: 5 tab-switchable virtual monitors (NAV-COM, SHIP-SYS, MINING, CARGO, COMMS).
- **Network**: Singleton `GameNetwork` class managing Colyseus room connections, state sync via Zustand.

## Features

### Core
- [x] Username/password authentication (bcrypt + JWT)
- [x] Terminal-style radar map with CRT effects
- [x] Sector jumping with 800ms CRT glitch animation
- [x] AP system with live regen timer, flash animation, cost tooltips
- [x] Procedural world generation (seed-based, persistent)
- [x] Multiplayer presence (see other players in sector)
- [x] Hardware bezel monitor UI with draggable knobs

### Exploration
- [x] Fog of war (undiscovered sectors)
- [x] Two-stage scanning: local scan (resources) + area scan (sectors by scanner level)
- [x] Radar zoom (3 levels) and pan (drag, ±3 sectors)
- [x] Sector color accents (asteroid=orange, nebula=cyan, station=green, anomaly=magenta, pirate=red)
- [x] Legend/help overlay

### Economy
- [x] Resource mining (ore, gas, crystal) with real-time progress
- [x] Cargo management with jettison
- [x] Structure building (comm relay, mining station, base)

### Social
- [x] Communication system with comm range + relay chain routing
- [x] COMMS monitor with channel tabs (direct, local, faction)
- [x] Message persistence and delayed delivery
- [x] Cluster spawn system (10M+ sectors from origin)
- [x] Origin race badges (first arrival + reached)

### Polish
- [x] 4 color profiles (Amber Classic, Green Phosphor, Ice Blue, High Contrast)
- [x] Brightness control knob
- [x] 102 automated tests (57 server, 40 client, 5 shared)

## License

MIT
