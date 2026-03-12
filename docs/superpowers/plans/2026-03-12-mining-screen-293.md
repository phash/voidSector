# Mining Screen Improvements (#293) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live-updating resource bars during mining + persistent Douglas-Adams story system with CRT artwork in the detail panel.

**Architecture:** Client-side countdown for resource bars using existing 200ms tick. Server tracks story progress (DB index + Redis partial counter) as a side-effect of mining stop. Story fragments stored client-side, sent index on join/stop. Three new components: MiningArtwork (animated ASCII), rewritten MiningDetailPanel, miningStory data file.

**Tech Stack:** TypeScript, React, Zustand, Colyseus, PostgreSQL, Redis, Vitest

**Spec:** `docs/superpowers/specs/2026-03-12-mining-screen-293-design.md`

---

## Chunk 1: Shared Types + DB Migration + Server Queries

### Task 1: Add MiningStoryUpdate type to shared

**Files:**
- Modify: `packages/shared/src/types.ts:221-230` (near MiningState)

- [ ] **Step 1: Add the type**

After the `MiningState` interface (line 230), add:

```typescript
export interface MiningStoryUpdate {
  storyIndex: number;
}
```

- [ ] **Step 2: Export from index**

Check `packages/shared/src/index.ts` — types.ts is likely re-exported via wildcard. If not, add the export.

- [ ] **Step 3: Build shared**

Run: `cd packages/shared && npm run build`
Expected: Clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add MiningStoryUpdate type"
```

---

### Task 2: Database migration 058 — mining_story_index

**Files:**
- Create: `packages/server/src/db/migrations/058_mining_story.sql`

- [ ] **Step 1: Create migration file**

```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS mining_story_index INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Verify it runs on Docker**

Restart the server container and check logs for `058_mining_story.sql` applied.

Run: `docker compose up --build server -d && sleep 3 && docker compose logs server | grep 058`
Expected: `Migration applied` log line.

- [ ] **Step 3: Verify column exists**

Run: `docker compose exec postgres psql -U voidsector -c "\d players" | grep mining_story`
Expected: `mining_story_index | integer | not null | 0`

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/db/migrations/058_mining_story.sql
git commit -m "feat(db): migration 058 — add mining_story_index to players"
```

---

### Task 3: Server queries for story index

**Files:**
- Modify: `packages/server/src/db/queries.ts`
- Create: `packages/server/src/__tests__/miningStoryQueries.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries.js', async () => {
  const actual = await vi.importActual('../db/queries.js');
  return actual;
});

// These test the query function signatures and return types.
// Use mock DB or import from queries directly.

import { getMiningStoryIndex, updateMiningStoryIndex } from '../db/queries.js';

// Note: These require a real DB connection in integration tests.
// For unit tests, mock the query function.
```

Since queries are thin DB wrappers, write them directly and test via integration in Task 6.

- [ ] **Step 2: Add getMiningStoryIndex query**

In `packages/server/src/db/queries.ts`, add near other player queries (after `getPlayerHomeBase` ~line 115):

```typescript
export async function getMiningStoryIndex(playerId: string): Promise<number> {
  const { rows } = await query<{ mining_story_index: number }>(
    'SELECT mining_story_index FROM players WHERE id = $1',
    [playerId],
  );
  return rows[0]?.mining_story_index ?? 0;
}

export async function updateMiningStoryIndex(playerId: string, index: number): Promise<void> {
  await query(
    'UPDATE players SET mining_story_index = $1 WHERE id = $2',
    [index, playerId],
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat(server): add getMiningStoryIndex/updateMiningStoryIndex queries"
```

---

## Chunk 2: Server Story Progress Logic

### Task 4: Story progress helper in MiningService

**Files:**
- Modify: `packages/server/src/rooms/services/MiningService.ts`
- Modify: `packages/server/src/rooms/services/RedisAPStore.ts` (for Redis story counter)
- Create: `packages/server/src/__tests__/miningStoryProgress.test.ts`

- [ ] **Step 1: Add Redis story counter helpers**

In `packages/server/src/rooms/services/RedisAPStore.ts`, add two functions:

```typescript
export async function getMiningStoryCounter(playerId: string): Promise<number> {
  const val = await redis.get(`mining:story:${playerId}`);
  return val ? parseInt(val, 10) : 0;
}

export async function setMiningStoryCounter(playerId: string, value: number): Promise<void> {
  await redis.set(`mining:story:${playerId}`, String(value));
}
```

Check the file first — `redis` is the Redis client instance imported at top of RedisAPStore.ts.

- [ ] **Step 2: Write failing test for updateStoryProgress**

File: `packages/server/src/__tests__/miningStoryProgress.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries.js', () => ({
  getMiningStoryIndex: vi.fn(),
  updateMiningStoryIndex: vi.fn(),
}));

vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getMiningStoryCounter: vi.fn(),
  setMiningStoryCounter: vi.fn(),
}));

import { getMiningStoryIndex, updateMiningStoryIndex } from '../db/queries.js';
import { getMiningStoryCounter, setMiningStoryCounter } from '../rooms/services/RedisAPStore.js';
import { updateStoryProgress } from '../rooms/services/MiningService.js';

const mockGetIndex = vi.mocked(getMiningStoryIndex);
const mockUpdateIndex = vi.mocked(updateMiningStoryIndex);
const mockGetCounter = vi.mocked(getMiningStoryCounter);
const mockSetCounter = vi.mocked(setMiningStoryCounter);

beforeEach(() => vi.resetAllMocks());

describe('updateStoryProgress', () => {
  it('does not advance when mined < threshold remainder', async () => {
    mockGetCounter.mockResolvedValue(0);
    mockGetIndex.mockResolvedValue(5);

    const result = await updateStoryProgress('player1', 7);

    expect(mockSetCounter).toHaveBeenCalledWith('player1', 7);
    expect(mockUpdateIndex).not.toHaveBeenCalled();
    expect(result).toBeNull(); // no update
  });

  it('advances one fragment when counter crosses 10', async () => {
    mockGetCounter.mockResolvedValue(5);
    mockGetIndex.mockResolvedValue(3);
    mockUpdateIndex.mockResolvedValue(undefined);

    const result = await updateStoryProgress('player1', 8);
    // 5 + 8 = 13, floor(13/10) = 1 advancement, remainder = 3

    expect(mockUpdateIndex).toHaveBeenCalledWith('player1', 4);
    expect(mockSetCounter).toHaveBeenCalledWith('player1', 3);
    expect(result).toBe(4);
  });

  it('advances multiple fragments for large mined amounts', async () => {
    mockGetCounter.mockResolvedValue(2);
    mockGetIndex.mockResolvedValue(0);
    mockUpdateIndex.mockResolvedValue(undefined);

    const result = await updateStoryProgress('player1', 25);
    // 2 + 25 = 27, floor(27/10) = 2 advancements, remainder = 7

    expect(mockUpdateIndex).toHaveBeenCalledWith('player1', 2);
    expect(mockSetCounter).toHaveBeenCalledWith('player1', 7);
    expect(result).toBe(2);
  });

  it('does nothing when mined is 0', async () => {
    const result = await updateStoryProgress('player1', 0);

    expect(mockGetCounter).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run test — verify it fails**

Run: `docker compose exec server sh -c "cd /app && npx vitest run packages/server/src/__tests__/miningStoryProgress.test.ts"`
Expected: FAIL — `updateStoryProgress` not exported from MiningService.

- [ ] **Step 4: Implement updateStoryProgress**

In `packages/server/src/rooms/services/MiningService.ts`, add imports and the exported function:

At top, add imports:
```typescript
import { getMiningStoryIndex, updateMiningStoryIndex } from '../../db/queries.js';
import { getMiningStoryCounter, setMiningStoryCounter } from './RedisAPStore.js';
```

**IMPORTANT:** This must be a module-level exported function, NOT a class method. Place it BEFORE the `MiningService` class definition so it can be imported directly:

```typescript
const STORY_THRESHOLD = 10;

/**
 * Update mining story progress. Returns new storyIndex if advanced, null otherwise.
 */
export async function updateStoryProgress(
  playerId: string,
  minedAmount: number,
): Promise<number | null> {
  if (minedAmount <= 0) return null;

  const counter = await getMiningStoryCounter(playerId);
  const total = counter + minedAmount;
  const advancements = Math.floor(total / STORY_THRESHOLD);
  const remainder = total % STORY_THRESHOLD;

  if (advancements > 0) {
    const currentIndex = await getMiningStoryIndex(playerId);
    const newIndex = currentIndex + advancements;
    // Note: server index is uncapped — client clamps to STORY_FRAGMENT_COUNT.
    // This is intentional to avoid sharing fragment count as a server constant.
    await updateMiningStoryIndex(playerId, newIndex);
    await setMiningStoryCounter(playerId, remainder);
    return newIndex;
  }

  await setMiningStoryCounter(playerId, total);
  return null;
}
```

- [ ] **Step 5: Run test — verify it passes**

Run: `docker compose exec server sh -c "cd /app && npx vitest run packages/server/src/__tests__/miningStoryProgress.test.ts"`
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/rooms/services/MiningService.ts packages/server/src/rooms/services/RedisAPStore.ts packages/server/src/__tests__/miningStoryProgress.test.ts
git commit -m "feat(server): add updateStoryProgress helper with Redis counter"
```

---

### Task 5: Wire story progress into all three mining-stop paths

**Files:**
- Modify: `packages/server/src/rooms/services/MiningService.ts` (handleAutoStop, handleStopMine)
- Modify: `packages/server/src/rooms/SectorRoom.ts` (onLeave, onJoin)

- [ ] **Step 1: Add story progress to handleStopMine**

In `MiningService.handleStopMine()` (line 225), after the `cargoUpdate` send (line 257), add:

```typescript
    // Story progress
    const newIndex = await updateStoryProgress(auth.userId, result.mined);
    if (newIndex !== null) {
      client.send('miningStoryUpdate', { storyIndex: newIndex });
    }
```

- [ ] **Step 2: Add story progress to handleAutoStop**

In `MiningService.handleAutoStop()`, at two places:

a) Before the mine-all chaining section (after line 100, before line 104), add:

```typescript
    // Story progress (before potential chain — this segment's mined amount counts)
    const newStoryIndex = await updateStoryProgress(playerId, result.mined);
    if (newStoryIndex !== null) {
      client.send('miningStoryUpdate', { storyIndex: newStoryIndex });
    }
```

b) No change needed in the chain success path (line 134 return) — the next segment will trigger its own story update when it stops.

- [ ] **Step 3: Add story progress to SectorRoom.onLeave**

In `SectorRoom.ts` onLeave (line 1428), **inside** the `if (result.mined > 0 && result.resource)` block (line 1438), after `addToInventory` (line 1439):

```typescript
          // Story progress (fire and forget — player is leaving)
          updateStoryProgress(auth.userId, result.mined).catch(() => {});
```

Import `updateStoryProgress` from `'./services/MiningService.js'` at the top of SectorRoom.ts.

- [ ] **Step 4: Send story index on join**

In `SectorRoom.onJoin()`, after the `client.send('fuelUpdate', ...)` (line 1194) and before `addDiscovery` (line 1197), add:

```typescript
      // Send mining story progress
      const storyIndex = await getMiningStoryIndex(auth.userId);
      client.send('miningStoryUpdate', { storyIndex });
```

Import `getMiningStoryIndex` from `'../db/queries.js'` at the top.

- [ ] **Step 5: Send sectorData after mining stop**

In `MiningService.handleStopMine()`, after cargoUpdate send (line 257), add:

```typescript
    // Send updated sector resources so client bars sync
    const updatedSector = await getSector(mining.sectorX, mining.sectorY);
    if (updatedSector) {
      client.send('sectorData', updatedSector);
    }
```

Do the same in `handleAutoStop()`, but **only when mining fully stops** (not during mine-all chain). Place it just before the final `client.send('miningUpdate', ...)` block at line 147 — this code only runs when the function falls through past the mine-all chain section:

```typescript
    const updatedSector = await getSector(mining.sectorX, mining.sectorY);
    if (updatedSector) {
      client.send('sectorData', updatedSector);
    }
```

Do NOT place this inside the mine-all chain success path (the `return` at line 134) — the chained segment's start would overwrite it immediately.

`getSector` is already imported in MiningService.ts (line 16).

- [ ] **Step 6: Copy files to Docker and run all server tests**

```bash
docker cp packages/server/src/rooms/services/MiningService.ts voidsector-server-1:/app/packages/server/src/rooms/services/MiningService.ts
docker cp packages/server/src/rooms/SectorRoom.ts voidsector-server-1:/app/packages/server/src/rooms/SectorRoom.ts
docker cp packages/server/src/rooms/services/RedisAPStore.ts voidsector-server-1:/app/packages/server/src/rooms/services/RedisAPStore.ts
docker cp packages/server/src/__tests__/miningStoryProgress.test.ts voidsector-server-1:/app/packages/server/src/__tests__/miningStoryProgress.test.ts
docker compose exec server sh -c "cd /app && npx vitest run"
```

Expected: All tests pass (including the 4 new story progress tests).

- [ ] **Step 7: Commit**

```bash
git add packages/server/
git commit -m "feat(server): wire story progress into all mining-stop paths + send sectorData after stop"
```

---

## Chunk 3: Client Store + Network + Live Resource Bars

### Task 6: Add miningStoryIndex to Zustand store

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts:300,568,687,865`

- [ ] **Step 1: Add state and action**

In the GameSlice interface (near line 300, after `mining`):
```typescript
  miningStoryIndex: number;
```

In the actions section (near line 568, after `setMining`):
```typescript
  setMiningStoryIndex: (index: number) => void;
```

In the default state (near line 687, after `mining: null`):
```typescript
  miningStoryIndex: 0,
```

In the action implementations (near line 865, after `setMining`):
```typescript
  setMiningStoryIndex: (index) => set({ miningStoryIndex: index }),
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/state/gameSlice.ts
git commit -m "feat(client): add miningStoryIndex to Zustand store"
```

---

### Task 7: Handle miningStoryUpdate message in network client

**Files:**
- Modify: `packages/client/src/network/client.ts:456` (near mining handlers)

- [ ] **Step 1: Add message handler**

After the `cargoUpdate` handler (around line 474), add:

```typescript
      room.onMessage('miningStoryUpdate', (data: { storyIndex: number }) => {
        store.setMiningStoryIndex(data.storyIndex);
      });
```

Import `MiningStoryUpdate` from shared if you want type safety, or use inline type as shown.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat(client): handle miningStoryUpdate message"
```

---

### Task 8: Live resource bar countdown in MiningScreen

**Files:**
- Modify: `packages/client/src/components/MiningScreen.tsx:9-19,86-90`
- Create: `packages/client/src/__tests__/MiningScreenLive.test.tsx`

- [ ] **Step 1: Write failing test**

File: `packages/client/src/__tests__/MiningScreenLive.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useStore } from '../state/store';

// Mock network
vi.mock('../network/client', () => ({
  network: {
    sendMine: vi.fn(),
    sendStopMine: vi.fn(),
    sendToggleMineAll: vi.fn(),
  },
}));

import { MiningScreen } from '../components/MiningScreen';

describe('MiningScreen live resource bars', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useStore.setState({
      currentSector: {
        x: 5, y: 5, type: 'asteroid', seed: 1,
        resources: { ore: 50, gas: 0, crystal: 0, maxOre: 100 },
      } as any,
      position: { x: 5, y: 5 },
      mining: {
        active: true,
        resource: 'ore',
        sectorX: 5, sectorY: 5,
        startedAt: Date.now() - 5000, // 5 seconds ago
        rate: 2, // 2 units/sec
        sectorYield: 50,
        mineAll: false,
      },
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      ship: { stats: { cargoCap: 100 } } as any,
      ap: { current: 10, max: 20, regenPerSecond: 0.01 } as any,
    });
  });

  it('shows decreased ore value during active mining', () => {
    render(<MiningScreen />);
    // 5 seconds at 2/sec = 10 mined, 50 - 10 = 40
    // The ResourceBar should show 40 not 50
    const oreBar = screen.getByText(/ORE/);
    expect(oreBar.textContent).toContain('40');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run test in Docker or locally. Expected: FAIL — ResourceBar still shows 50 (stale value).

- [ ] **Step 3: Implement live countdown in MiningScreen**

Modify the ResourceBar section (lines 86-90). Add a computed `liveResources` object:

```typescript
  // Live resource countdown during active mining
  const liveResources = { ...resources };
  if (mining?.active && mining.startedAt !== null && mining.resource) {
    const elapsed = (Date.now() - mining.startedAt) / 1000;
    const mined = Math.floor(elapsed * mining.rate);
    const remainingCargoSpace = Math.max(0, cargoCap - cargoTotal);
    const capped = Math.min(mined, mining.sectorYield, remainingCargoSpace);
    const res = mining.resource as keyof typeof liveResources;
    if (res in liveResources) {
      liveResources[res] = Math.max(0, (liveResources[res] ?? 0) - capped);
    }
  }
```

Add this after `cargoPercent` (line 60) and before the return. Then replace the ResourceBar values:

```tsx
<ResourceBar label="ORE" value={liveResources.ore} max={maxYield} maxResource={resources.maxOre} />
<ResourceBar label="GAS" value={liveResources.gas} max={maxYield} maxResource={resources.maxGas} />
<ResourceBar label="CRYSTAL" value={liveResources.crystal} max={maxYield} maxResource={resources.maxCrystal} />
```

The existing 200ms `useEffect` interval (lines 33-46) already triggers re-renders via `setMiningProgress`, which will cause `liveResources` to recalculate on each tick.

**Note:** The spec mentions optional CSS blink/flash on ResourceBar value changes. Deferred to a follow-up — the countdown itself is the main improvement.

- [ ] **Step 4: Run test — verify it passes**

Expected: PASS — ore bar now shows 40.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/MiningScreen.tsx packages/client/src/__tests__/MiningScreenLive.test.tsx
git commit -m "feat(client): live resource bar countdown during mining"
```

---

## Chunk 4: Story Content + Mining Artwork + Detail Panel

### Task 9: Create mining story fragments

**Files:**
- Create: `packages/client/src/data/miningStory.ts`

- [ ] **Step 1: Create the story data file**

```typescript
export interface StoryFragment {
  chapter?: string;
  text: string;
}

export const MINING_STORY: StoryFragment[] = [
  // Kapitel 1: Die Einführung
  {
    chapter: 'KAPITEL 1 — DAS HANDBUCH',
    text: 'Der Anhalter-Leitfaden für den galaktischen Bergbau beginnt mit den Worten: "KEINE PANIK." Dies ist, wie sich herausstellen wird, ein äußerst schlechter Ratschlag.',
  },
  {
    text: 'Abschnitt 1, Paragraph 2 merkt an, dass Bergbau im Weltraum "im Wesentlichen harmlos" sei. Der Verfasser dieser Zeile wurde später von einem herabfallenden Asteroiden erschlagen.',
  },
  {
    text: 'Der durchschnittliche galaktische Bergarbeiter verbringt 87% seiner Zeit damit, Formulare auszufüllen. Die restlichen 13% entfallen auf das Suchen nach dem Stift.',
  },
  {
    text: 'Interessanterweise ist das galaktische Wort für "Bergbau" in 47 Sprachen identisch mit dem Wort für "hoffnungsloser Optimismus".',
  },
  {
    text: 'Der Bohrer summt eine Melodie, die verdächtig nach dem Lied klingt, das die Delphine sangen, bevor sie die Erde verließen.',
  },
  // Kapitel 2: Die Bürokratie
  {
    chapter: 'KAPITEL 2 — DER VOGONE',
    text: 'Ein vogonischer Inspektor erscheint auf dem Bildschirm. Er möchte wissen, ob du Formular 27B/6 für die Asteroidenbearbeitung in dreifacher Ausführung eingereicht hast.',
  },
  {
    text: '"Die Formulare", erklärt der Vogone geduldig, "waren seit fünfzig Jahren im Planungsamt auf Alpha Centauri ausgelegt." Du hattest keine Ahnung, dass es ein Planungsamt auf Alpha Centauri gibt.',
  },
  {
    text: 'Der Vogone liest dir zur Strafe seine Poesie vor. Dein Schiff nimmt drei Punkte Hüllenschaden.',
  },
  {
    text: 'Die vogonische Bürokratie hat kürzlich beschlossen, dass alle Asteroiden einen Vornamen brauchen. Deiner heißt jetzt Gerald.',
  },
  {
    text: 'Gerald, so stellt sich heraus, hat Gefühle. Er ist leicht verärgert über die ganze Bohrerei.',
  },
  // Kapitel 3: Die Maschine
  {
    chapter: 'KAPITEL 3 — MARVIN',
    text: 'Der Bordcomputer seufzt elektronisch. "Ich habe ein Gehirn von der Größe eines Planeten, und ihr lasst mich Steine sortieren."',
  },
  {
    text: '"Nennt ihr das Erz?", fragt der Bordcomputer. "Ich habe besseres Erz auf dem Parkplatz des Restaurants am Ende des Universums gesehen."',
  },
  {
    text: 'Der Bordcomputer weigert sich, die Daten zu speichern. Er findet die Kristalle "ästhetisch unbefriedigend."',
  },
  {
    text: '"Ihr wisst schon", sagt der Computer, "dass die Wahrscheinlichkeit, hier etwas Wertvolles zu finden, exakt 1 zu 42.000.000 beträgt?"',
  },
  {
    text: 'Er hat nachgerechnet. Die Antwort auf die Frage nach dem Bergbau, dem Universum und dem ganzen Rest ist — wenig überraschend — 42 Einheiten Erz pro Stunde.',
  },
  // Kapitel 4: Die Entdeckung
  {
    chapter: 'KAPITEL 4 — DIE UNWAHRSCHEINLICHKEIT',
    text: 'Der Unendliche Unwahrscheinlichkeitsdrive springt kurz an. Für einen Moment werden alle Kristalle zu Petunien.',
  },
  {
    text: 'Die Petunien verwandeln sich zurück in Kristalle, aber sie sehen jetzt leicht beleidigt aus.',
  },
  {
    text: 'Ein Wal materialisiert sich kurz im Laderaum. Er hat keine Zeit für existenzielle Fragen, da er bereits wieder verschwindet.',
  },
  {
    text: 'Die Sensoren entdecken eine Nachricht, eingeritzt in den Asteroiden: "Wir entschuldigen uns für die Unannehmlichkeiten."',
  },
  {
    text: 'Laut Handbuch ist dies die Standardentschuldigung des Universums. Sie wird üblicherweise kurz vor dem Ende von Dingen angebracht.',
  },
  // Kapitel 5: Die Philosophie
  {
    chapter: 'KAPITEL 5 — DEEP THOUGHT',
    text: 'Tief im Asteroiden entdeckst du einen winzigen Computer, der seit 7,5 Millionen Jahren über eine Frage nachdenkt.',
  },
  {
    text: '"Die Antwort", sagt der kleine Computer, "lautet 42. Aber ich habe die Frage vergessen. Irgendwas mit Erz."',
  },
  {
    text: 'Du fragst ihn, ob sich der Bergbau lohnt. Er rechnet 0,3 Nanosekunden. "Kommt darauf an, ob du Steine magst."',
  },
  {
    text: 'Der Computer empfiehlt, stattdessen ein Restaurant zu eröffnen. Vorzugsweise am Ende des Universums. Die Aussicht sei besser.',
  },
  {
    text: 'Du beschließt, trotzdem weiterzumachen. Der Computer seufzt und nennt dich einen "hoffnungslosen Fall mit Bohrer."',
  },
  // Kapitel 6: Die Mäuse
  {
    chapter: 'KAPITEL 6 — DIE MÄUSE',
    text: 'Zwei weiße Mäuse beobachten dich beim Mining. Sie machen sich Notizen.',
  },
  {
    text: '"Faszinierend", sagt Frankie Mouse zu Benjy. "Die Menschen bohren tatsächlich freiwillig in Steine. Kein Wunder, dass ihr Planet für eine Umgehungsstraße abgerissen wurde."',
  },
  {
    text: 'Die Mäuse bieten dir an, dein Gehirn zu kaufen. Als Alternative bieten sie zwei Einheiten Kristall.',
  },
  {
    text: 'Du lehnst ab. Die Mäuse zucken mit den Schultern. "Wir hätten ohnehin nicht viel dafür gezahlt."',
  },
  {
    text: 'Frankie notiert in sein Buch: "Versuchsperson #2.498.713 — weiterhin resistent gegen Vernunft. Bergbau fortgesetzt."',
  },
  // Kapitel 7: Das Ende
  {
    chapter: 'KAPITEL 7 — SO LONG',
    text: 'Der Anhalter-Leitfaden hat einen letzten Eintrag zum Thema Bergbau: "Hör auf damit und geh einen Pangalaktischen Donnergurgler trinken."',
  },
  {
    text: 'Du ignorierst den Rat. Der Leitfaden aktualisiert deinen Eintrag auf "Meistens harmlos, aber erstaunlich stur."',
  },
  {
    text: 'Gerald der Asteroid hat sich inzwischen damit abgefunden. Er hat sogar angefangen, die Vibrationen zu genießen.',
  },
  {
    text: 'Der Vogone kommt zurück. Diesmal mit Formular 27B/7. Es betrifft die emotionale Betreuung von Asteroiden.',
  },
  {
    text: 'Du füllst das Formular aus. Gerald dankt dir. Der Bordcomputer ist immer noch deprimiert. Alles ist normal im Universum.',
  },
  {
    text: 'ENDE. — Oder wie der Anhalter sagt: "So long, and thanks for all the ore."',
  },
];

export const STORY_FRAGMENT_COUNT = MINING_STORY.length;
```

**Note:** This is 36 fragments for v1. The spec mentions ~80-100 — more fragments can be added later without any code changes (just append to the array). The system is designed for this.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/data/miningStory.ts
git commit -m "feat(client): add mining story fragments — Hitchhiker's Guide to Mining"
```

---

### Task 10: Create MiningArtwork component

**Files:**
- Create: `packages/client/src/components/MiningArtwork.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from 'react';

const ORE_FRAMES = [
  [
    '    ╔══════╗',
    '    ║⛏ ORE ║',
    '    ╚══╦═══╝',
    '   ┌───╨───┐',
    '   │▓▓▒▒░░ │',
    '   │░▓▓▒▒░ │',
    '   │░░▓▓▒▒ │',
    '   └───────┘',
    '   /// /// ///',
  ],
  [
    '    ╔══════╗',
    '    ║⛏ ORE ║',
    '    ╚══╦═══╝',
    '   ┌───╨───┐',
    '   │▒▒░░▓▓ │',
    '   │▒▒░░░▓ │',
    '   │▓▒▒░░░ │',
    '   └───────┘',
    '   // /// ///',
  ],
  [
    '    ╔══════╗',
    '    ║⛏ ORE ║',
    '    ╚══╦═══╝',
    '   ┌───╨───┐',
    '   │░░▓▓▒▒ │',
    '   │░▓▒▒░░ │',
    '   │▒▒░░▓▓ │',
    '   └───────┘',
    '   /// // ///',
  ],
];

const GAS_FRAMES = [
  [
    '    ╔══════╗',
    '    ║♨ GAS ║',
    '    ╚══╦═══╝',
    '   ┌───╨───┐',
    '   │ ░ ░ ░ │',
    '   │░ ∙ ░ ∙│',
    '   │ ∙ ░ ∙ │',
    '   └───────┘',
    '   ~ ~~ ~ ~~',
  ],
  [
    '    ╔══════╗',
    '    ║♨ GAS ║',
    '    ╚══╦═══╝',
    '   ┌───╨───┐',
    '   │∙ ░ ∙ ░│',
    '   │ ░ ∙ ░ │',
    '   │░ ∙ ░ ∙│',
    '   └───────┘',
    '   ~~ ~ ~~ ~',
  ],
  [
    '    ╔══════╗',
    '    ║♨ GAS ║',
    '    ╚══╦═══╝',
    '   ┌───╨───┐',
    '   │ ∙ ░ ∙ │',
    '   │∙ ░ ∙ ░│',
    '   │ ░ ∙ ░ │',
    '   └───────┘',
    '   ~ ~ ~~ ~~',
  ],
];

const CRYSTAL_FRAMES = [
  [
    '    ╔══════╗',
    '    ║◆ CRY ║',
    '    ╚══╦═══╝',
    '   ┌───╨───┐',
    '   │ ◇ ◆ ◇ │',
    '   │◆ ◇ ◆ ◇│',
    '   │ ◇ ◆ ◇ │',
    '   └───────┘',
    '   *  **  * *',
  ],
  [
    '    ╔══════╗',
    '    ║◆ CRY ║',
    '    ╚══╦═══╝',
    '   ┌───╨───┐',
    '   │◇ ◆ ◇ ◆│',
    '   │ ◆ ◇ ◆ │',
    '   │◇ ◆ ◇ ◆│',
    '   └───────┘',
    '   **  * * **',
  ],
  [
    '    ╔══════╗',
    '    ║◆ CRY ║',
    '    ╚══╦═══╝',
    '   ┌───╨───┐',
    '   │◆ ◇ ◆ ◇│',
    '   │ ◇ ◆ ◇ │',
    '   │◆ ◇ ◆ ◇│',
    '   └───────┘',
    '   * **  ** *',
  ],
];

const IDLE_ART = [
  '    ╔══════╗',
  '    ║ IDLE ║',
  '    ╚══════╝',
  '   ┌───────┐',
  '   │ · · · │',
  '   │ · · · │',
  '   │ · · · │',
  '   └───────┘',
  '   . . . . . ',
];

const FRAMES: Record<string, string[][]> = {
  ore: ORE_FRAMES,
  gas: GAS_FRAMES,
  crystal: CRYSTAL_FRAMES,
};

export function MiningArtwork({ resource }: { resource: string | null }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!resource) return;
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % 3);
    }, 500);
    return () => clearInterval(id);
  }, [resource]);

  const frames = resource ? FRAMES[resource] : null;
  const lines = frames ? frames[frame % frames.length] : IDLE_ART;

  return (
    <div style={{ marginBottom: 8 }}>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '0.6rem',
            lineHeight: 1.3,
            color: 'var(--color-primary)',
            opacity: 0.7,
            whiteSpace: 'pre',
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/MiningArtwork.tsx
git commit -m "feat(client): add MiningArtwork component with animated ASCII per resource"
```

---

### Task 11: Rewrite MiningDetailPanel

**Files:**
- Rewrite: `packages/client/src/components/MiningDetailPanel.tsx`

- [ ] **Step 1: Write the new component**

```tsx
import { useStore } from '../state/store';
import { MiningArtwork } from './MiningArtwork';
import { MINING_STORY, STORY_FRAGMENT_COUNT } from '../data/miningStory';

const panelStyle: React.CSSProperties = {
  padding: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-primary)',
  fontSize: '0.7rem',
  height: '100%',
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

export function MiningDetailPanel() {
  const mining = useStore((s) => s.mining);
  const storyIndex = useStore((s) => s.miningStoryIndex);

  const isActive = mining?.active === true;
  const resource = isActive ? mining.resource : null;

  // Show the latest unlocked fragment
  const displayIndex = Math.min(storyIndex, STORY_FRAGMENT_COUNT) - 1;
  const fragment = displayIndex >= 0 ? MINING_STORY[displayIndex] : null;
  const isComplete = storyIndex >= STORY_FRAGMENT_COUNT;

  return (
    <div style={panelStyle}>
      <MiningArtwork resource={resource} />

      {fragment ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {fragment.chapter && (
            <div
              style={{
                fontSize: '0.65rem',
                letterSpacing: '0.15em',
                opacity: 0.5,
                marginBottom: 8,
              }}
            >
              {fragment.chapter}
            </div>
          )}
          <div
            key={displayIndex}
            style={{
              fontSize: '0.75rem',
              lineHeight: 1.6,
              color: 'var(--color-primary)',
              opacity: 0.85,
              animation: 'fadeIn 0.8s ease-in',
            }}
          >
            {fragment.text}
          </div>

          <div
            style={{
              marginTop: 'auto',
              paddingTop: 12,
              fontSize: '0.55rem',
              opacity: 0.3,
              letterSpacing: '0.1em',
            }}
          >
            {isComplete
              ? 'THE END — SO LONG, AND THANKS FOR ALL THE ORE.'
              : `[FRAGMENT ${storyIndex}/${STORY_FRAGMENT_COUNT}]`}
          </div>
        </div>
      ) : (
        <div style={{ opacity: 0.4, fontSize: '0.65rem', textAlign: 'center', marginTop: 16 }}>
          {isActive
            ? 'INITIALIZING STORY DATABASE...'
            : 'MINE TO BEGIN THE STORY...'}
        </div>
      )}

      {!isActive && fragment && !isComplete && (
        <div
          style={{
            fontSize: '0.6rem',
            opacity: 0.35,
            textAlign: 'center',
            marginTop: 8,
            letterSpacing: '0.1em',
          }}
        >
          MINE TO CONTINUE...
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write a render test for MiningDetailPanel**

File: `packages/client/src/__tests__/MiningDetailPanel.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useStore } from '../state/store';

vi.mock('../network/client', () => ({ network: {} }));

import { MiningDetailPanel } from '../components/MiningDetailPanel';

describe('MiningDetailPanel', () => {
  it('shows "MINE TO BEGIN" when storyIndex is 0', () => {
    useStore.setState({ mining: null, miningStoryIndex: 0 });
    render(<MiningDetailPanel />);
    expect(screen.getByText(/MINE TO BEGIN/)).toBeTruthy();
  });

  it('shows the correct story fragment for storyIndex', () => {
    useStore.setState({
      mining: { active: true, resource: 'ore', sectorX: 0, sectorY: 0, startedAt: Date.now(), rate: 1, sectorYield: 50, mineAll: false },
      miningStoryIndex: 1,
    });
    render(<MiningDetailPanel />);
    expect(screen.getByText(/KEINE PANIK/)).toBeTruthy();
    expect(screen.getByText(/FRAGMENT 1/)).toBeTruthy();
  });

  it('shows THE END when story is complete', () => {
    useStore.setState({ mining: null, miningStoryIndex: 999 });
    render(<MiningDetailPanel />);
    expect(screen.getByText(/THE END/)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Add fadeIn CSS keyframe**

`fadeIn` does not exist in the codebase. Add to `packages/client/src/styles/global.css`:

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 0.85; }
}
```

- [ ] **Step 4: Run MiningDetailPanel tests**

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/MiningDetailPanel.tsx packages/client/src/__tests__/MiningDetailPanel.test.tsx packages/client/src/styles/global.css
git commit -m "feat(client): rewrite MiningDetailPanel with story + CRT artwork"
```

---

## Chunk 5: Integration Test + Docker Rebuild

### Task 12: End-to-end verification

- [ ] **Step 1: Run all client tests**

```bash
docker run --rm -v $(pwd):/app -w /app node:20-alpine sh -c "cd packages/client && npx vitest run"
```

Expected: All tests pass.

- [ ] **Step 2: Run all server tests**

```bash
docker cp packages/server/src voidsector-server-1:/app/packages/server/src
docker compose exec server sh -c "cd /app && npx vitest run"
```

Expected: All tests pass.

- [ ] **Step 3: Rebuild and restart Docker stack (without cloudflare)**

```bash
docker compose stop cloudflared
docker compose up --build server client -d
```

- [ ] **Step 4: Manual test**

1. Open `localhost:3201`, log in as phash
2. Navigate to an asteroid sector with resources
3. Open MINING program
4. Click MINE ORE — verify:
   - ResourceBar for ORE counts down live
   - Detail panel shows animated ore ASCII art
5. Mine 10+ units total, then stop — verify:
   - Story fragment appears in detail panel
   - `[FRAGMENT 1/36]` counter shows
6. Mine more — verify subsequent fragments appear
7. Stop mining — verify "MINE TO CONTINUE..." idle state

- [ ] **Step 5: Final commit (if any uncommitted changes remain)**

```bash
git add packages/client/src packages/server/src packages/shared/src
git commit -m "feat: mining screen improvements — live bars, story system, CRT artwork (#293)"
```
