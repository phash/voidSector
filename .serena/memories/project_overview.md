# VOID SECTOR - Project Overview

## Purpose
VOID SECTOR is a multiplayer sci-fi browser game. Players explore sectors, jump between them, scan for discoveries, mine resources, build structures, and communicate via relay networks. All actions cost Action Points (AP) that regenerate idle over time.

## Tech Stack
- **Monorepo** with npm workspaces: `packages/shared`, `packages/server`, `packages/client`
- **Client**: Vite, React 18, zustand (state management), colyseus.js v0.15 (networking), Canvas radar, CRT-style UI
- **Server**: Colyseus v0.15 (game server), PostgreSQL (database), Redis (AP state caching)
- **Shared**: TypeScript types and constants shared between client and server
- **Testing**: Vitest (server + shared), Vitest + jsdom + RTL + jest-canvas-mock (client)
- **Language**: TypeScript 5.4+, ES2022 target, ESNext modules, bundler module resolution

## Structure
```
packages/
  shared/src/    - types.ts, constants.ts (exported via index.ts)
  server/src/    - rooms/, engine/, db/, auth.ts
  client/src/    - state/ (zustand), network/ (colyseus.js), components/, canvas/, styles/, test/
```

## Key Patterns
- Client state: zustand store with slices (gameSlice, uiSlice)
- Network: singleton `GameNetwork` class exported as `network`
- Server rooms: Colyseus Room with Schema-based state sync
- Auth: JWT tokens, passed via `client.http.authToken` in colyseus.js
- DB: PostgreSQL with parameterized queries, migrations auto-run on startup
- Tests: 102 total (57 server, 40 client, 5 shared)

## Current Branch State (2026-03-02)
Branch `feat/ux-comms-overhaul` has 28 commits implementing 8 features (jump animation, zoom/pan, visual overhaul, two-stage scan, AP improvements, spawn system, comms, structures + tests). All tests pass. Not yet merged to master.
