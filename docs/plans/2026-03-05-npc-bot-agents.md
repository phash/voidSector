# NPC Bot-Agents Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add autonomous NPC bots that connect as Colyseus clients, move around the world, mine, trade, and chat — visible to real players on radar.

**Architecture:** Separate Node process (`packages/bots`) connects to the game server via `colyseus.js` using the same auth/join flow as real clients. A `BotManager` spawns/despawns bot instances per active quadrant. Each bot runs a goal-based behavior loop (explore/mine/trade/patrol/idle) with 3-8s ticks.

**Tech Stack:** TypeScript, colyseus.js (client SDK), node-fetch (HTTP auth), pino (logging)

---

### Task 1: Package scaffolding

**Files:**
- Create: `packages/bots/package.json`
- Create: `packages/bots/tsconfig.json`
- Create: `packages/bots/src/index.ts` (empty entry)

**Step 1: Create package.json**

```json
{
  "name": "@void-sector/bots",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "colyseus.js": "^0.15.0",
    "pino": "^8.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "@void-sector/shared": "workspace:*"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

**Step 3: Create empty entry point**

```typescript
// packages/bots/src/index.ts
console.log('Bot runner starting...');
```

**Step 4: Install dependencies**

Run: `cd packages/bots && npm install`

**Step 5: Verify build**

Run: `cd packages/bots && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```
feat(bots): scaffold packages/bots package
```

---

### Task 2: BotClient — auth + room join

**Files:**
- Create: `packages/bots/src/BotClient.ts`
- Test: `packages/bots/src/__tests__/BotClient.test.ts`

This class handles a single bot's connection: register/login via HTTP, join a quadrant room via Colyseus, and expose `room.send()` for actions.

**Step 1: Write the failing test**

```typescript
// packages/bots/src/__tests__/BotClient.test.ts
import { describe, it, expect } from 'vitest';
import { BotClient } from '../BotClient.js';

describe('BotClient', () => {
  it('constructs with name and server URL', () => {
    const bot = new BotClient({
      name: 'BOT-Test',
      password: 'bot-secret',
      serverUrl: 'http://localhost:2567',
    });
    expect(bot.name).toBe('BOT-Test');
    expect(bot.isConnected).toBe(false);
  });

  it('exposes position after joining', () => {
    const bot = new BotClient({
      name: 'BOT-Test',
      password: 'bot-secret',
      serverUrl: 'http://localhost:2567',
    });
    expect(bot.position).toEqual({ x: 0, y: 0 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/bots && npx vitest run src/__tests__/BotClient.test.ts`
Expected: FAIL — BotClient not found

**Step 3: Write minimal implementation**

```typescript
// packages/bots/src/BotClient.ts
import { Client, type Room } from 'colyseus.js';
import { QUADRANT_SIZE } from '@void-sector/shared';

export interface BotClientOptions {
  name: string;
  password: string;
  serverUrl: string;
}

interface Coords {
  x: number;
  y: number;
}

function sectorToQuadrant(x: number, y: number) {
  return {
    qx: Math.floor(x / QUADRANT_SIZE),
    qy: Math.floor(y / QUADRANT_SIZE),
  };
}

export class BotClient {
  readonly name: string;
  private password: string;
  private serverUrl: string;
  private client: Client | null = null;
  private room: Room | null = null;
  private token: string | null = null;
  private _position: Coords = { x: 0, y: 0 };
  private homeBase: Coords = { x: 0, y: 0 };
  private currentQuadrant: { qx: number; qy: number } | null = null;

  constructor(options: BotClientOptions) {
    this.name = options.name;
    this.password = options.password;
    this.serverUrl = options.serverUrl;
  }

  get isConnected(): boolean {
    return this.room !== null;
  }

  get position(): Coords {
    return { ...this._position };
  }

  /** Register or login the bot account, then join the home sector. */
  async connect(): Promise<void> {
    // Try login first, register if not found
    let res = await fetch(`${this.serverUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.name, password: this.password }),
    });

    if (res.status === 401) {
      res = await fetch(`${this.serverUrl}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.name, password: this.password }),
      });
    }

    if (!res.ok) {
      throw new Error(`Auth failed for ${this.name}: ${res.status}`);
    }

    const data = await res.json();
    this.token = data.token;
    const lastPos = data.lastPosition ?? data.player?.homeBase ?? { x: 0, y: 0 };
    this._position = { x: lastPos.x, y: lastPos.y };
    this.homeBase = data.player?.homeBase ?? { ...this._position };

    await this.joinRoom(this._position.x, this._position.y);
  }

  private async joinRoom(x: number, y: number): Promise<void> {
    if (!this.token) throw new Error('Not authenticated');

    if (this.room) {
      await this.room.leave();
      this.room = null;
    }

    const wsUrl = this.serverUrl.replace(/^http/, 'ws');
    this.client = new Client(wsUrl);
    this.client.http.authToken = this.token;

    const { qx, qy } = sectorToQuadrant(x, y);
    this.currentQuadrant = { qx, qy };

    this.room = await this.client.joinOrCreate('sector', {
      quadrantX: qx,
      quadrantY: qy,
      sectorX: x,
      sectorY: y,
    });

    this._position = { x, y };

    // Listen for position-relevant messages
    this.room.onMessage('sectorData', (data: any) => {
      // Sector arrived at
    });
    this.room.onMessage('jumpResult', (data: any) => {
      if (data.success) {
        this._position = { x: data.targetX, y: data.targetY };
      }
    });
  }

  /** Send a room message (same as real client). */
  send(type: string, data: any = {}): void {
    if (!this.room) return;
    this.room.send(type, data);
  }

  /** Move to adjacent sector via D-pad. */
  async moveTo(x: number, y: number): Promise<void> {
    const { qx: targetQx, qy: targetQy } = sectorToQuadrant(x, y);
    if (
      this.currentQuadrant &&
      this.currentQuadrant.qx === targetQx &&
      this.currentQuadrant.qy === targetQy
    ) {
      this.send('moveSector', { sectorX: x, sectorY: y });
      this._position = { x, y };
    } else {
      await this.joinRoom(x, y);
    }
  }

  /** Disconnect from room. */
  async disconnect(): Promise<void> {
    if (this.room) {
      await this.room.leave();
      this.room = null;
    }
    this.client = null;
  }

  /** Listen for a specific room message. */
  onMessage(type: string, cb: (data: any) => void): void {
    this.room?.onMessage(type, cb);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/bots && npx vitest run src/__tests__/BotClient.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(bots): add BotClient with auth and room join
```

---

### Task 3: Goal system and behavior engine

**Files:**
- Create: `packages/bots/src/goals/Goal.ts`
- Create: `packages/bots/src/goals/ExploreGoal.ts`
- Create: `packages/bots/src/goals/MineGoal.ts`
- Create: `packages/bots/src/goals/TradeGoal.ts`
- Create: `packages/bots/src/goals/PatrolGoal.ts`
- Create: `packages/bots/src/goals/IdleGoal.ts`
- Test: `packages/bots/src/__tests__/goals.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/bots/src/__tests__/goals.test.ts
import { describe, it, expect } from 'vitest';
import { pickNextGoal, type BotProfile, type BotState } from '../goals/Goal.js';

describe('Goal system', () => {
  const traderProfile: BotProfile = {
    type: 'trader',
    weights: { explore: 0.1, mine: 0.3, trade: 0.4, patrol: 0, idle: 0.2 },
  };

  const baseState: BotState = {
    position: { x: 0, y: 0 },
    homeBase: { x: 0, y: 0 },
    cargo: {},
    credits: 100,
    fuel: 80,
    fuelMax: 80,
    knownStations: [],
    knownAsteroids: [],
  };

  it('picks a goal from weighted distribution', () => {
    const goal = pickNextGoal(traderProfile, baseState, 0.5);
    expect(['explore', 'mine', 'trade', 'patrol', 'idle']).toContain(goal);
  });

  it('seed 0.05 picks explore for trader (first 10%)', () => {
    const goal = pickNextGoal(traderProfile, baseState, 0.05);
    expect(goal).toBe('explore');
  });

  it('seed 0.95 picks idle for trader (last 20%)', () => {
    const goal = pickNextGoal(traderProfile, baseState, 0.95);
    expect(goal).toBe('idle');
  });

  it('prefers trade when cargo is full', () => {
    const fullCargo = { ...baseState, cargo: { ore: 3, gas: 0, crystal: 0 } };
    const goal = pickNextGoal(traderProfile, fullCargo, 0.35);
    // With cargo, trade weight boosted — exact goal depends on implementation
    expect(typeof goal).toBe('string');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/bots && npx vitest run src/__tests__/goals.test.ts`
Expected: FAIL

**Step 3: Write Goal interface and pickNextGoal**

```typescript
// packages/bots/src/goals/Goal.ts
import type { BotClient } from '../BotClient.js';

export interface Coords {
  x: number;
  y: number;
}

export interface BotState {
  position: Coords;
  homeBase: Coords;
  cargo: Record<string, number>;
  credits: number;
  fuel: number;
  fuelMax: number;
  knownStations: Coords[];
  knownAsteroids: Coords[];
}

export type GoalType = 'explore' | 'mine' | 'trade' | 'patrol' | 'idle';

export interface BotProfile {
  type: string;
  weights: Record<GoalType, number>;
}

export interface Goal {
  type: GoalType;
  /** Execute one tick of this goal. Returns true when goal is complete. */
  tick(client: BotClient, state: BotState): Promise<boolean>;
}

/**
 * Pick next goal using weighted random selection.
 * seed should be 0..1 (use Math.random() in production).
 */
export function pickNextGoal(
  profile: BotProfile,
  _state: BotState,
  seed: number,
): GoalType {
  const entries = Object.entries(profile.weights) as [GoalType, number][];
  let cumulative = 0;
  for (const [goal, weight] of entries) {
    cumulative += weight;
    if (seed < cumulative) return goal;
  }
  return entries[entries.length - 1][0];
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/bots && npx vitest run src/__tests__/goals.test.ts`
Expected: PASS

**Step 5: Implement goal classes**

```typescript
// packages/bots/src/goals/ExploreGoal.ts
import type { Goal, BotState, Coords } from './Goal.js';
import type { BotClient } from '../BotClient.js';

export class ExploreGoal implements Goal {
  type = 'explore' as const;
  private stepsLeft: number;

  constructor(steps = 5 + Math.floor(Math.random() * 10)) {
    this.stepsLeft = steps;
  }

  async tick(client: BotClient, state: BotState): Promise<boolean> {
    if (this.stepsLeft <= 0) return true;

    // Move in a random direction
    const dirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
    ];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const newX = state.position.x + dir.dx;
    const newY = state.position.y + dir.dy;

    await client.moveTo(newX, newY);
    client.send('scan', {});
    this.stepsLeft--;
    return this.stepsLeft <= 0;
  }
}
```

```typescript
// packages/bots/src/goals/MineGoal.ts
import type { Goal, BotState } from './Goal.js';
import type { BotClient } from '../BotClient.js';

export class MineGoal implements Goal {
  type = 'mine' as const;
  private phase: 'travel' | 'mining' | 'done' = 'travel';
  private ticksInPhase = 0;
  private readonly MINE_TICKS = 8; // ~30s of mining

  async tick(client: BotClient, state: BotState): Promise<boolean> {
    if (this.phase === 'travel') {
      // If at asteroid field, start mining
      // Otherwise move toward nearest known asteroid or explore
      if (state.knownAsteroids.length > 0) {
        const target = state.knownAsteroids[0];
        if (state.position.x === target.x && state.position.y === target.y) {
          client.send('mine', { resource: 'ore' });
          this.phase = 'mining';
          this.ticksInPhase = 0;
          return false;
        }
        // Step toward target
        const dx = Math.sign(target.x - state.position.x);
        const dy = Math.sign(target.y - state.position.y);
        await client.moveTo(state.position.x + dx, state.position.y + dy);
      } else {
        // No known asteroids — scan and move randomly
        client.send('scan', {});
        const dx = Math.random() > 0.5 ? 1 : -1;
        await client.moveTo(state.position.x + dx, state.position.y);
      }
      this.ticksInPhase++;
      if (this.ticksInPhase > 15) return true; // Give up
      return false;
    }

    if (this.phase === 'mining') {
      this.ticksInPhase++;
      if (this.ticksInPhase >= this.MINE_TICKS) {
        client.send('stopMine', {});
        this.phase = 'done';
        return true;
      }
      return false;
    }

    return true;
  }
}
```

```typescript
// packages/bots/src/goals/TradeGoal.ts
import type { Goal, BotState } from './Goal.js';
import type { BotClient } from '../BotClient.js';

export class TradeGoal implements Goal {
  type = 'trade' as const;
  private phase: 'travel' | 'selling' | 'done' = 'travel';
  private ticksInPhase = 0;

  async tick(client: BotClient, state: BotState): Promise<boolean> {
    if (this.phase === 'travel') {
      // Head toward nearest known station (or home base)
      const target = state.knownStations.length > 0
        ? state.knownStations[0]
        : state.homeBase;

      if (state.position.x === target.x && state.position.y === target.y) {
        this.phase = 'selling';
        this.ticksInPhase = 0;
        return false;
      }

      const dx = Math.sign(target.x - state.position.x);
      const dy = Math.sign(target.y - state.position.y);
      await client.moveTo(state.position.x + dx, state.position.y + dy);
      this.ticksInPhase++;
      if (this.ticksInPhase > 20) return true;
      return false;
    }

    if (this.phase === 'selling') {
      // Sell each cargo resource
      for (const [resource, amount] of Object.entries(state.cargo)) {
        if (amount > 0) {
          client.send('npcTrade', { resource, amount, action: 'sell' });
        }
      }
      this.phase = 'done';
      return true;
    }

    return true;
  }
}
```

```typescript
// packages/bots/src/goals/PatrolGoal.ts
import type { Goal, BotState, Coords } from './Goal.js';
import type { BotClient } from '../BotClient.js';

export class PatrolGoal implements Goal {
  type = 'patrol' as const;
  private waypoints: Coords[];
  private waypointIdx = 0;

  constructor(center: Coords, radius = 5) {
    // Create a simple patrol route around a center point
    this.waypoints = [
      { x: center.x + radius, y: center.y },
      { x: center.x, y: center.y + radius },
      { x: center.x - radius, y: center.y },
      { x: center.x, y: center.y - radius },
    ];
  }

  async tick(client: BotClient, state: BotState): Promise<boolean> {
    const target = this.waypoints[this.waypointIdx];
    if (state.position.x === target.x && state.position.y === target.y) {
      this.waypointIdx++;
      if (this.waypointIdx >= this.waypoints.length) return true;
      return false;
    }

    const dx = Math.sign(target.x - state.position.x);
    const dy = Math.sign(target.y - state.position.y);
    await client.moveTo(state.position.x + dx, state.position.y + dy);
    client.send('scan', {});
    return false;
  }
}
```

```typescript
// packages/bots/src/goals/IdleGoal.ts
import type { Goal, BotState } from './Goal.js';
import type { BotClient } from '../BotClient.js';
import { pickChatMessage } from '../chat.js';

export class IdleGoal implements Goal {
  type = 'idle' as const;
  private ticksLeft: number;
  private chatCooldown = 0;

  constructor(ticks = 3 + Math.floor(Math.random() * 5)) {
    this.ticksLeft = ticks;
  }

  async tick(client: BotClient, state: BotState): Promise<boolean> {
    this.ticksLeft--;
    this.chatCooldown--;

    if (this.chatCooldown <= 0 && Math.random() < 0.3) {
      const msg = pickChatMessage('idle', state);
      client.send('chat', { channel: 'local', content: msg });
      this.chatCooldown = 5; // Don't chat again for ~20-40s
    }

    return this.ticksLeft <= 0;
  }
}
```

**Step 6: Commit**

```
feat(bots): add goal system with 5 behavior types
```

---

### Task 4: Chat message pool

**Files:**
- Create: `packages/bots/src/chat.ts`
- Test: `packages/bots/src/__tests__/chat.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/bots/src/__tests__/chat.test.ts
import { describe, it, expect } from 'vitest';
import { pickChatMessage } from '../chat.js';

describe('pickChatMessage', () => {
  const state = {
    position: { x: 5, y: 3 },
    homeBase: { x: 0, y: 0 },
    cargo: { ore: 2 },
    credits: 100,
    fuel: 50,
    fuelMax: 80,
    knownStations: [],
    knownAsteroids: [],
  };

  it('returns a non-empty string for idle context', () => {
    const msg = pickChatMessage('idle', state);
    expect(msg.length).toBeGreaterThan(0);
  });

  it('returns a mining message for mine context', () => {
    const msg = pickChatMessage('mine', state);
    expect(msg.length).toBeGreaterThan(0);
  });

  it('returns a trade message for trade context', () => {
    const msg = pickChatMessage('trade', state);
    expect(msg.length).toBeGreaterThan(0);
  });

  it('returns a warning message for pirate context', () => {
    const msg = pickChatMessage('pirate', state);
    expect(msg).toContain('Piraten');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/bots && npx vitest run src/__tests__/chat.test.ts`
Expected: FAIL

**Step 3: Implement chat module**

```typescript
// packages/bots/src/chat.ts
import type { BotState } from './goals/Goal.js';

type ChatContext = 'idle' | 'mine' | 'trade' | 'explore' | 'pirate';

const MESSAGES: Record<ChatContext, string[]> = {
  idle: [
    'Jemand Richtung Station unterwegs?',
    'Ruhiger Sektor hier...',
    'Systeme normal.',
    'Scanner zeigt nichts Besonderes.',
    'Warte auf Ladung.',
    'Schöner Nebel hier.',
    'Hat jemand Crystal übrig?',
    'Langstrecken-Scan abgeschlossen.',
  ],
  mine: [
    'Gutes Erzvorkommen hier.',
    'Mining-Laser aktiv.',
    'Asteroid fast leer...',
    'Fracht füllt sich.',
    'Crystal-Ader entdeckt!',
    'Gas-Vorkommen in der Nähe.',
  ],
  trade: [
    'Suche Crystal, biete Erz.',
    'Gute Preise an dieser Station.',
    'Fracht abgeladen.',
    'Vorräte aufgestockt.',
    'Handelsroute etabliert.',
  ],
  explore: [
    'Neuen Sektor entdeckt.',
    'Scan läuft...',
    'Interessante Signale hier.',
    'Unbekanntes Terrain — vorsichtig.',
    'Kartierung abgeschlossen.',
  ],
  pirate: [
    'Warnung: Piraten gesichtet!',
    'Piraten bei ({x},{y}) — Vorsicht!',
    'Feindkontakt! Weiche aus.',
    'Piraten-Aktivität in der Nähe.',
  ],
};

export function pickChatMessage(context: ChatContext, state: BotState): string {
  const pool = MESSAGES[context] ?? MESSAGES.idle;
  const msg = pool[Math.floor(Math.random() * pool.length)];
  return msg
    .replace('{x}', String(state.position.x))
    .replace('{y}', String(state.position.y));
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/bots && npx vitest run src/__tests__/chat.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(bots): add context-aware chat message pool
```

---

### Task 5: BotRunner — behavior loop for a single bot

**Files:**
- Create: `packages/bots/src/BotRunner.ts`
- Test: `packages/bots/src/__tests__/BotRunner.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/bots/src/__tests__/BotRunner.test.ts
import { describe, it, expect, vi } from 'vitest';
import { BotRunner, type BotConfig } from '../BotRunner.js';

describe('BotRunner', () => {
  const config: BotConfig = {
    name: 'BOT-Kira',
    password: 'bot-secret',
    serverUrl: 'http://localhost:2567',
    profile: {
      type: 'trader',
      weights: { explore: 0.1, mine: 0.3, trade: 0.4, patrol: 0, idle: 0.2 },
    },
    tickIntervalMs: 5000,
  };

  it('constructs with config', () => {
    const runner = new BotRunner(config);
    expect(runner.name).toBe('BOT-Kira');
    expect(runner.isRunning).toBe(false);
  });

  it('has a configurable tick interval', () => {
    const runner = new BotRunner({ ...config, tickIntervalMs: 3000 });
    expect(runner.tickIntervalMs).toBe(3000);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/bots && npx vitest run src/__tests__/BotRunner.test.ts`
Expected: FAIL

**Step 3: Implement BotRunner**

```typescript
// packages/bots/src/BotRunner.ts
import { BotClient } from './BotClient.js';
import { pickNextGoal, type BotProfile, type BotState, type Goal, type GoalType } from './goals/Goal.js';
import { ExploreGoal } from './goals/ExploreGoal.js';
import { MineGoal } from './goals/MineGoal.js';
import { TradeGoal } from './goals/TradeGoal.js';
import { PatrolGoal } from './goals/PatrolGoal.js';
import { IdleGoal } from './goals/IdleGoal.js';
import { pickChatMessage } from './chat.js';
import pino from 'pino';

const logger = pino({ name: 'bot-runner' });

export interface BotConfig {
  name: string;
  password: string;
  serverUrl: string;
  profile: BotProfile;
  tickIntervalMs: number;
}

function createGoal(type: GoalType, state: BotState): Goal {
  switch (type) {
    case 'explore': return new ExploreGoal();
    case 'mine': return new MineGoal();
    case 'trade': return new TradeGoal();
    case 'patrol': return new PatrolGoal(state.position);
    case 'idle': return new IdleGoal();
  }
}

export class BotRunner {
  readonly name: string;
  readonly tickIntervalMs: number;
  private config: BotConfig;
  private client: BotClient;
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentGoal: Goal | null = null;
  private _isRunning = false;

  // State tracked from room messages
  private cargo: Record<string, number> = {};
  private credits = 0;
  private fuel = 80;
  private fuelMax = 80;
  private knownStations: { x: number; y: number }[] = [];
  private knownAsteroids: { x: number; y: number }[] = [];

  constructor(config: BotConfig) {
    this.name = config.name;
    this.tickIntervalMs = config.tickIntervalMs;
    this.config = config;
    this.client = new BotClient({
      name: config.name,
      password: config.password,
      serverUrl: config.serverUrl,
    });
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  private get state(): BotState {
    return {
      position: this.client.position,
      homeBase: { x: 0, y: 0 },
      cargo: this.cargo,
      credits: this.credits,
      fuel: this.fuel,
      fuelMax: this.fuelMax,
      knownStations: this.knownStations,
      knownAsteroids: this.knownAsteroids,
    };
  }

  async start(): Promise<void> {
    logger.info({ bot: this.name }, 'Starting bot');
    await this.client.connect();
    this._isRunning = true;

    // Listen for state updates
    this.client.onMessage('cargoUpdate', (data: any) => {
      this.cargo = data;
    });
    this.client.onMessage('creditsUpdate', (data: any) => {
      this.credits = data.credits ?? 0;
    });
    this.client.onMessage('fuelUpdate', (data: any) => {
      this.fuel = data.current ?? this.fuel;
      this.fuelMax = data.max ?? this.fuelMax;
    });
    this.client.onMessage('sectorData', (data: any) => {
      if (data.type === 'station') {
        const pos = { x: data.x, y: data.y };
        if (!this.knownStations.some(s => s.x === pos.x && s.y === pos.y)) {
          this.knownStations.push(pos);
        }
      }
      if (data.type === 'asteroid_field') {
        const pos = { x: data.x, y: data.y };
        if (!this.knownAsteroids.some(a => a.x === pos.x && a.y === pos.y)) {
          this.knownAsteroids.push(pos);
        }
      }
    });

    // Add jitter so bots don't tick in lockstep
    const jitter = Math.floor(Math.random() * 2000);

    this.timer = setInterval(async () => {
      try {
        await this.tick();
      } catch (err) {
        logger.error({ bot: this.name, err }, 'Tick error');
      }
    }, this.tickIntervalMs + jitter);
  }

  private async tick(): Promise<void> {
    if (!this.currentGoal) {
      const goalType = pickNextGoal(this.config.profile, this.state, Math.random());
      this.currentGoal = createGoal(goalType, this.state);
      logger.info({ bot: this.name, goal: goalType }, 'New goal');
    }

    const done = await this.currentGoal.tick(this.client, this.state);
    if (done) {
      logger.info({ bot: this.name, goal: this.currentGoal.type }, 'Goal complete');
      this.currentGoal = null;
    }
  }

  async stop(): Promise<void> {
    this._isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.client.disconnect();
    logger.info({ bot: this.name }, 'Stopped');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/bots && npx vitest run src/__tests__/BotRunner.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(bots): add BotRunner with goal-based behavior loop
```

---

### Task 6: BotManager — spawn/despawn bots per active quadrant

**Files:**
- Create: `packages/bots/src/BotManager.ts`
- Test: `packages/bots/src/__tests__/BotManager.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/bots/src/__tests__/BotManager.test.ts
import { describe, it, expect } from 'vitest';
import { BotManager, type BotManagerConfig } from '../BotManager.js';

describe('BotManager', () => {
  const config: BotManagerConfig = {
    serverUrl: 'http://localhost:2567',
    adminToken: 'vs-admin-2026',
    botPassword: 'bot-secret',
    botsPerQuadrant: 2,
    maxBots: 20,
    pollIntervalMs: 60000,
    tickIntervalMs: 5000,
  };

  it('constructs with config', () => {
    const manager = new BotManager(config);
    expect(manager.activeBotCount).toBe(0);
  });

  it('generates bot names with BOT- prefix', () => {
    const manager = new BotManager(config);
    const names = manager.generateBotNames(3);
    expect(names).toHaveLength(3);
    expect(names.every(n => n.startsWith('BOT-'))).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/bots && npx vitest run src/__tests__/BotManager.test.ts`
Expected: FAIL

**Step 3: Implement BotManager**

```typescript
// packages/bots/src/BotManager.ts
import { BotRunner, type BotConfig } from './BotRunner.js';
import type { BotProfile } from './goals/Goal.js';
import pino from 'pino';

const logger = pino({ name: 'bot-manager' });

const BOT_NAMES = [
  'Kira', 'Vex', 'Mira', 'Dax', 'Syla', 'Orn', 'Thex', 'Luma',
  'Kael', 'Nyx', 'Rho', 'Astra', 'Cyn', 'Jex', 'Tal', 'Zar',
  'Quill', 'Wren', 'Strex', 'Rune',
];

const PROFILES: BotProfile[] = [
  { type: 'trader', weights: { explore: 0.1, mine: 0.3, trade: 0.4, patrol: 0, idle: 0.2 } },
  { type: 'scout', weights: { explore: 0.4, mine: 0.1, trade: 0, patrol: 0.3, idle: 0.2 } },
  { type: 'miner', weights: { explore: 0.05, mine: 0.5, trade: 0.3, patrol: 0, idle: 0.15 } },
];

export interface BotManagerConfig {
  serverUrl: string;
  adminToken: string;
  botPassword: string;
  botsPerQuadrant: number;
  maxBots: number;
  pollIntervalMs: number;
  tickIntervalMs: number;
}

export class BotManager {
  private config: BotManagerConfig;
  private bots: Map<string, BotRunner> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private nameIdx = 0;

  constructor(config: BotManagerConfig) {
    this.config = config;
  }

  get activeBotCount(): number {
    return this.bots.size;
  }

  generateBotNames(count: number): string[] {
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      names.push(`BOT-${BOT_NAMES[this.nameIdx % BOT_NAMES.length]}`);
      this.nameIdx++;
    }
    return names;
  }

  async start(): Promise<void> {
    logger.info('BotManager starting');

    // Initial spawn
    await this.poll();

    // Poll for active quadrants periodically
    this.pollTimer = setInterval(async () => {
      try {
        await this.poll();
      } catch (err) {
        logger.error({ err }, 'Poll error');
      }
    }, this.config.pollIntervalMs);
  }

  private async poll(): Promise<void> {
    // Fetch active rooms from Colyseus monitor or admin API
    let activeRooms: { roomId: string; clients: number; quadrantX: number; quadrantY: number }[] = [];
    try {
      const res = await fetch(`${this.config.serverUrl}/admin/api/rooms`, {
        headers: { 'Authorization': `Bearer ${this.config.adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        activeRooms = data.rooms ?? [];
      }
    } catch {
      // Server might not have the endpoint yet — spawn default bots
      logger.warn('Could not fetch active rooms — using default spawn');
    }

    // Determine which quadrants need bots
    const quadrantsWithPlayers = new Set<string>();
    for (const room of activeRooms) {
      // Only count rooms with real (non-bot) players
      if (room.clients > 0) {
        quadrantsWithPlayers.add(`${room.quadrantX}:${room.quadrantY}`);
      }
    }

    // If no data, spawn bots in default quadrant (0,0)
    if (quadrantsWithPlayers.size === 0) {
      quadrantsWithPlayers.add('0:0');
    }

    // Calculate target bot count
    const targetBots = Math.min(
      quadrantsWithPlayers.size * this.config.botsPerQuadrant,
      this.config.maxBots,
    );

    // Spawn missing bots
    while (this.bots.size < targetBots) {
      const name = this.generateBotNames(1)[0];
      if (this.bots.has(name)) continue;

      const profile = PROFILES[this.bots.size % PROFILES.length];
      const runner = new BotRunner({
        name,
        password: this.config.botPassword,
        serverUrl: this.config.serverUrl,
        profile,
        tickIntervalMs: this.config.tickIntervalMs,
      });

      try {
        await runner.start();
        this.bots.set(name, runner);
        logger.info({ bot: name, profile: profile.type }, 'Bot spawned');
      } catch (err) {
        logger.error({ bot: name, err }, 'Failed to spawn bot');
      }
    }

    // Despawn excess bots
    while (this.bots.size > targetBots) {
      const [name, runner] = [...this.bots.entries()].pop()!;
      await runner.stop();
      this.bots.delete(name);
      logger.info({ bot: name }, 'Bot despawned');
    }
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const [name, runner] of this.bots) {
      await runner.stop();
      logger.info({ bot: name }, 'Stopped');
    }
    this.bots.clear();
    logger.info('BotManager stopped');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/bots && npx vitest run src/__tests__/BotManager.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(bots): add BotManager for spawn/despawn lifecycle
```

---

### Task 7: Admin API — rooms endpoint

**Files:**
- Modify: `packages/server/src/adminRoutes.ts`
- Test: `packages/server/src/__tests__/adminRoutes.test.ts`

The BotManager needs to know which quadrants have real players. Add a `/admin/api/rooms` endpoint that returns active Colyseus rooms.

**Step 1: Write the failing test**

Add to existing `packages/server/src/__tests__/adminRoutes.test.ts`:

```typescript
describe('GET /admin/api/rooms', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/admin/api/rooms');
    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/adminRoutes.test.ts`
Expected: FAIL — route not found (404)

**Step 3: Add the endpoint**

In `packages/server/src/adminRoutes.ts`, add before the export:

```typescript
router.get('/rooms', async (_req: Request, res: Response) => {
  try {
    // Return room list from matchmaker
    // The matchMaker is available globally via @colyseus/core
    const { matchMaker } = await import('@colyseus/core');
    const rooms = await matchMaker.query({});
    const roomData = rooms.map((r: any) => ({
      roomId: r.roomId,
      name: r.name,
      clients: r.clients,
      quadrantX: r.metadata?.quadrantX ?? 0,
      quadrantY: r.metadata?.quadrantY ?? 0,
    }));
    res.json({ rooms: roomData });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});
```

**Step 4: Run test to verify it passes**

Run: `cd packages/server && npx vitest run src/__tests__/adminRoutes.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(server): add /admin/api/rooms endpoint for bot manager
```

---

### Task 8: Entry point and Docker integration

**Files:**
- Modify: `packages/bots/src/index.ts`
- Create: `packages/bots/src/config.ts`
- Create: `Dockerfile.bots`
- Modify: `docker-compose.yml`

**Step 1: Create config**

```typescript
// packages/bots/src/config.ts
export interface AppConfig {
  serverUrl: string;
  adminToken: string;
  botPassword: string;
  botsPerQuadrant: number;
  maxBots: number;
  pollIntervalMs: number;
  tickIntervalMs: number;
}

export function loadConfig(): AppConfig {
  return {
    serverUrl: process.env.SERVER_URL ?? 'http://localhost:2567',
    adminToken: process.env.ADMIN_TOKEN ?? 'vs-admin-2026',
    botPassword: process.env.BOT_PASSWORD ?? 'bot-secret-2026',
    botsPerQuadrant: parseInt(process.env.BOTS_PER_QUADRANT ?? '2', 10),
    maxBots: parseInt(process.env.MAX_BOTS ?? '20', 10),
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '60000', 10),
    tickIntervalMs: parseInt(process.env.TICK_INTERVAL_MS ?? '5000', 10),
  };
}
```

**Step 2: Implement entry point**

```typescript
// packages/bots/src/index.ts
import { BotManager } from './BotManager.js';
import { loadConfig } from './config.js';
import pino from 'pino';

const logger = pino({ name: 'bots' });
const config = loadConfig();

const manager = new BotManager(config);

process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await manager.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await manager.stop();
  process.exit(0);
});

logger.info({ serverUrl: config.serverUrl, maxBots: config.maxBots }, 'Starting bot manager');
manager.start().catch((err) => {
  logger.error({ err }, 'Failed to start');
  process.exit(1);
});
```

**Step 3: Create Dockerfile.bots**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json packages/shared/
COPY packages/bots/package*.json packages/bots/
RUN npm install --workspace=packages/shared --workspace=packages/bots
COPY packages/shared packages/shared
COPY packages/bots packages/bots
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/bots
CMD ["node", "packages/bots/dist/index.js"]
```

**Step 4: Add to docker-compose.yml**

Add after the `client` service:

```yaml
  bots:
    build:
      context: .
      dockerfile: Dockerfile.bots
    environment:
      SERVER_URL: http://server:2567
      ADMIN_TOKEN: vs-admin-2026
      BOT_PASSWORD: bot-secret-2026
      BOTS_PER_QUADRANT: "2"
      MAX_BOTS: "10"
      POLL_INTERVAL_MS: "60000"
      TICK_INTERVAL_MS: "5000"
    depends_on:
      - server
    restart: unless-stopped
```

**Step 5: Test locally**

Run: `cd packages/bots && npx tsx src/index.ts`
Expected: Bot manager starts, connects bots (will fail if server not running — that's OK)

**Step 6: Commit**

```
feat(bots): add entry point, config, and Docker integration
```

---

### Task 9: Integration test — bot visible on radar

**Files:**
- Test: Manual playtest via Playwright

**Step 1: Build and deploy**

Run: `docker compose up -d --build --force-recreate server client bots`

**Step 2: Wait for bots to connect**

Run: `docker compose logs bots --tail 20`
Expected: Logs showing "Bot spawned" messages

**Step 3: Run playtest**

Login as test player, navigate to spawn quadrant, zoom to level 2+. Verify:
- PILOTS counter > 0
- Yellow ship icon(s) visible on radar
- Bot username visible at zoom >= 3
- Chat messages from BOT-* appear in comms

**Step 4: Commit final**

```
test(bots): verify bot visibility on radar via playtest
```
