# VOID SECTOR

A 2D Space-Exploration Idle MMO with retro CRT terminal aesthetics. The UI is a **virtual hardware console** — every element looks like part of an analog high-performance computer from the 80s, complete with physical bezels, toggle switches, and LED indicators.

Amber monochrome (#FFB000 on #050505). Mobile-first.

## Core Loop

Explore and discover: Players move sector by sector through an infinite 2D coordinate system. Every action costs Action Points (AP) that regenerate idle over time. Discovered sectors remain persistent. Other players are visible in real-time.

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Game Server | [Colyseus](https://colyseus.io/) | Room abstraction, state sync, clustering-ready |
| Frontend | React 18 + Canvas | Terminal UI, radar rendering with CRT effects |
| State | Zustand | Client-side state management |
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
│   │       ├── auth.ts              # JWT auth (register/login)
│   │       ├── app.config.ts        # Colyseus + Express config
│   │       ├── index.ts             # Server entry point
│   │       ├── db/                  # PostgreSQL client, migrations, queries
│   │       ├── engine/              # World generation, AP system
│   │       └── rooms/               # SectorRoom, schemas, Redis store
│   └── client/          # React frontend
│       └── src/
│           ├── canvas/              # useCanvas hook, RadarRenderer
│           ├── components/          # MonitorBezel, GameScreen, LoginScreen, HUD, etc.
│           ├── network/             # Colyseus client network layer
│           ├── state/               # Zustand store (game + UI slices)
│           └── styles/              # CRT effects, global styles
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

- **CRT Theme**: CSS scanlines, flicker animation (with `prefers-reduced-motion` support), vignette, hardware bezel frame with LED indicators.
- **Radar**: HTML5 Canvas renderer at 60fps, DPI-aware, with glow effects for the player ship.
- **Multi-Monitor System**: Tab-switchable virtual monitors (NAV-COM for navigation, SHIP-SYS for ship status).
- **Network**: Singleton `GameNetwork` class managing Colyseus room connections, state sync via Zustand.

## MVP Features

- [x] Username/password authentication
- [x] Terminal-style radar map with CRT effects
- [x] Sector jumping (costs AP)
- [x] AP system (consumption + time-based regeneration)
- [x] Procedural world generation (seed-based, persistent)
- [x] Multiplayer presence (see other players in sector)
- [x] Hardware bezel monitor UI with LEDs and toggles
- [x] Fog of war (undiscovered sectors)
- [x] Radar scanning (reveals surrounding sectors)

## License

MIT
