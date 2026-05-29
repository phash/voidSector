# XENO Framework + Common Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working XENO cockpit program (15th program) that lets a player, when in range of an alien faction, see which factions are reachable, make first contact, view reputation/tier, greet, and run common actions via a generic runner — making all 10 factions interactable at the common level.

**Architecture:** Server adds one new `xenoStatus` action to the existing `AlienInteractionService.handleAlienInteract` flow (early-return before the range gate), backed by a pure `buildXenoStatus()` helper and a new `getAlienFirstContacts` query. Client adds a `XENO` monitor program, store state (`xenoStatus` + `alienInteractResult`), network plumbing (`requestXenoStatus` + `xenoStatusUpdate` handler), and a `XenoScreen` that renders the faction list and a generic action runner. Shared types `XenoFactionStatus` + `AlienInteractResult` are the single source of truth used by both sides.

**Tech Stack:** TypeScript monorepo · Colyseus rooms (server) · React + Zustand (client) · Vitest + RTL/jsdom (tests) · PostgreSQL (`alien_reputation` table).

---

## Reference: verified codebase anchors

Server (`packages/server/src`):
- `rooms/services/AlienInteractionService.ts` — `handleAlienInteract(client, data)` starts at line 97; `const { factionId, action, payload } = data;` at line 99; `validFactions` guard 102–117; range check 119–128. Imports from `alienReputationService.js` at 24–30, from `db/queries.js` at 31–45.
- `engine/alienReputationService.ts` — has **no imports** at top (header comment lines 1–5, `export type AlienFactionId` at line 7). Contains `ALIEN_FIRST_CONTACT_DISTANCE` (31–42), `getRepTier` (73–80), `getRepTierLabel` (85–95), `isInFirstContactRange` (143–150), `getEncounterableFactions` (155–160).
- `db/queries.ts` — `getAllAlienReputations` (2542–2552), `setAlienFirstContact` (2578–2588). **No** first-contact getter exists.
- Server imports use the `.js` extension (ESM). Tests live in `engine/__tests__/`.

Shared (`packages/shared/src`):
- `constants.ts` — `MONITORS` (641–658), `COCKPIT_PROGRAMS` (663–678), `COCKPIT_PROGRAM_LABELS` (681–697). Build with `cd packages/shared && npm run build`.
- `types.ts` — append target for new interfaces.

Client (`packages/client/src`):
- `state/gameSlice.ts` — shared import block ends at line 61 (`} from '@void-sector/shared';`); `alienReputations: Record<string, number>;` field at 346; `alienCredits: 0,` init at 768; `alienReputations: {},` init at 769; setter impls region ~1100–1114.
- `network/client.ts` — `sendAlienInteract` at 2510–2516; `alienInteractResult` handler at 909–931; handlers registered inside `setupRoomListeners(room)`.
- `components/GameScreen.tsx` — `renderScreen()` switch 322–359; imports 1–39; `MONITORS` imported at 38.
- `hooks/useMobileTabs.ts` — `MEHR_MONITORS` hardcoded array 23–36.
- `state/helpSlice.ts` — `HELP_TIPS` array starts line 11; `first_login` entry 12–17.
- `components/InlineError.tsx` — `<InlineError codes={['...']} />` reads `actionError` from store, shows when `code` starts with a listed prefix.
- `test/mockStore.ts` — `mockStoreState(overrides)` builds a full default `StoreState`; does **not** currently include `actionError`/`setActionError`.

---

## File Structure

**Create:**
- `packages/client/src/components/XenoScreen.tsx` — the XENO program UI (faction list + generic action runner + result rendering).
- `packages/server/src/engine/__tests__/xenoStatus.test.ts` — unit test for the pure `buildXenoStatus` helper.
- `packages/client/src/__tests__/XenoScreen.test.tsx` — component test for XenoScreen.

**Modify:**
- `packages/shared/src/types.ts` — add `XenoFactionStatus` + `AlienInteractResult` interfaces.
- `packages/shared/src/constants.ts` — add `MONITORS.XENO`, `COCKPIT_PROGRAMS`, `COCKPIT_PROGRAM_LABELS`.
- `packages/server/src/engine/alienReputationService.ts` — add pure `buildXenoStatus()` helper.
- `packages/server/src/db/queries.ts` — add `getAlienFirstContacts()`.
- `packages/server/src/rooms/services/AlienInteractionService.ts` — add `xenoStatus` early-return branch + imports.
- `packages/client/src/state/gameSlice.ts` — add `xenoStatus` + `alienInteractResult` state and setters.
- `packages/client/src/network/client.ts` — add `requestXenoStatus()`, `xenoStatusUpdate` handler, augment `alienInteractResult` handler.
- `packages/client/src/state/helpSlice.ts` — add `first_xeno` tip.
- `packages/client/src/components/GameScreen.tsx` — route `MONITORS.XENO → <XenoScreen />`.
- `packages/client/src/hooks/useMobileTabs.ts` — add XENO to `MEHR_MONITORS`.
- `packages/client/src/test/mockStore.ts` — add `xenoStatus`, `alienInteractResult`, `actionError` defaults.

---

## Task 1: Shared types + constants

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Append the two shared interfaces to the end of `packages/shared/src/types.ts`**

```typescript

/** Per-faction reachability + reputation snapshot for the XENO program (#534). */
export interface XenoFactionStatus {
  factionId: string;
  reachable: boolean;
  firstContacted: boolean;
  reputation: number;
  /** German reputation-tier label, e.g. 'NEUTRAL'. */
  tier: string;
}

/** Result of an alien interaction action, rendered by the XENO program (#534). */
export interface AlienInteractResult {
  success: boolean;
  factionId?: string;
  action?: string;
  message?: string;
  error?: string;
  repBefore?: number;
  repAfter?: number;
  repTier?: string;
  reputations?: Record<string, number>;
}
```

- [ ] **Step 2: Add `XENO` to `MONITORS` in `packages/shared/src/constants.ts`**

Replace:

```typescript
  FRIENDS: 'FRIENDS',
  FABRIK: 'FABRIK',
} as const;
```

with:

```typescript
  FRIENDS: 'FRIENDS',
  FABRIK: 'FABRIK',
  XENO: 'XENO',
} as const;
```

- [ ] **Step 3: Add `MONITORS.XENO` to `COCKPIT_PROGRAMS`**

Replace:

```typescript
  MONITORS.FRIENDS,
  MONITORS.FABRIK,
];
```

with:

```typescript
  MONITORS.FRIENDS,
  MONITORS.FABRIK,
  MONITORS.XENO,
];
```

- [ ] **Step 4: Add the XENO label to `COCKPIT_PROGRAM_LABELS`**

Replace:

```typescript
  FRIENDS: 'FRIENDS',
  FABRIK: 'FABRIK',
};
```

with:

```typescript
  FRIENDS: 'FRIENDS',
  FABRIK: 'FABRIK',
  XENO: 'XENO',
};
```

- [ ] **Step 5: Build shared (REQUIRED after changing shared)**

Run: `cd packages/shared && npm run build`
Expected: exits 0, no type errors, `dist/` updated.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/dist
git commit -m "feat: #534 shared XenoFactionStatus/AlienInteractResult types + XENO monitor program"
```

---

## Task 2: Server query `getAlienFirstContacts`

No unit test here — this function only issues a SQL query and there is no DB in unit tests (the existing `db/queries.ts` functions are not unit-tested in isolation). It is covered by the Docker E2E in Task 10.

**Files:**
- Modify: `packages/server/src/db/queries.ts`

- [ ] **Step 1: Add the getter directly after `setAlienFirstContact`**

In `packages/server/src/db/queries.ts`, find the end of `setAlienFirstContact` (the closing `}` after the `INSERT ... ON CONFLICT` for `setAlienFirstContact`, around line 2588) and insert after it:

```typescript

/** Get faction IDs the player has made first contact with (first_contact_at is set). */
export async function getAlienFirstContacts(playerId: string): Promise<string[]> {
  const { rows } = await query<{ alien_faction_id: string }>(
    'SELECT alien_faction_id FROM alien_reputation WHERE player_id = $1 AND first_contact_at IS NOT NULL',
    [playerId],
  );
  return rows.map((r) => r.alien_faction_id);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/server && npx tsc --noEmit`
Expected: exits 0 (no new errors referencing `getAlienFirstContacts`).

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat: #534 getAlienFirstContacts query"
```

---

## Task 3: Pure `buildXenoStatus` helper + unit test

**Files:**
- Modify: `packages/server/src/engine/alienReputationService.ts`
- Test: `packages/server/src/engine/__tests__/xenoStatus.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/engine/__tests__/xenoStatus.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildXenoStatus } from '../alienReputationService.js';

describe('buildXenoStatus', () => {
  it('returns one entry per known alien faction (10)', () => {
    const status = buildXenoStatus(0, 0, {}, []);
    expect(status).toHaveLength(10);
    const ids = status.map((s) => s.factionId);
    expect(ids).toContain('scrappers');
    expect(ids).toContain('axioms');
  });

  it('marks every faction out of range near origin (0,0)', () => {
    const status = buildXenoStatus(0, 0, {}, []);
    expect(status.every((s) => s.reachable === false)).toBe(true);
  });

  it('marks scrappers reachable at quadrant distance 60 but not axioms', () => {
    const status = buildXenoStatus(60, 0, {}, []);
    const scrappers = status.find((s) => s.factionId === 'scrappers')!;
    const axioms = status.find((s) => s.factionId === 'axioms')!;
    expect(scrappers.reachable).toBe(true); // ALIEN_FIRST_CONTACT_DISTANCE.scrappers = 60
    expect(axioms.reachable).toBe(false); // axioms distance = 2500
  });

  it('maps reputation to tier label and reflects first-contact state', () => {
    const status = buildXenoStatus(60, 0, { scrappers: 75 }, ['scrappers']);
    const scrappers = status.find((s) => s.factionId === 'scrappers')!;
    expect(scrappers.reputation).toBe(75);
    expect(scrappers.tier).toBe('GEEHRT'); // 75 > 70 => honored
    expect(scrappers.firstContacted).toBe(true);
  });

  it('defaults a missing reputation to 0 / NEUTRAL and firstContacted false', () => {
    const status = buildXenoStatus(60, 0, { scrappers: 75 }, ['scrappers']);
    const archivists = status.find((s) => s.factionId === 'archivists')!;
    expect(archivists.reputation).toBe(0);
    expect(archivists.tier).toBe('NEUTRAL');
    expect(archivists.firstContacted).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/server && npx vitest run src/engine/__tests__/xenoStatus.test.ts`
Expected: FAIL — `buildXenoStatus is not a function` / export not found.

- [ ] **Step 3: Add the shared type import at the top of `alienReputationService.ts`**

`packages/server/src/engine/alienReputationService.ts` currently has no imports. Insert this import immediately before the `export type AlienFactionId =` line (line 7):

```typescript
import type { XenoFactionStatus } from '@void-sector/shared';

```

- [ ] **Step 4: Implement `buildXenoStatus` at the end of `alienReputationService.ts`**

Append after `getEncounterableFactions` (the existing function ending around line 160):

```typescript

/**
 * Builds the per-faction reachability + reputation snapshot for the XENO program (#534).
 * Pure: given the player's quadrant, their reputation map, and the factions they have made
 * first contact with, returns one entry per known alien faction. Testable without DB/context.
 */
export function buildXenoStatus(
  playerQx: number,
  playerQy: number,
  reputations: Record<string, number>,
  firstContacted: string[],
): XenoFactionStatus[] {
  const contacted = new Set(firstContacted);
  return (Object.keys(ALIEN_FIRST_CONTACT_DISTANCE) as AlienFactionId[]).map((factionId) => {
    const reputation = reputations[factionId] ?? 0;
    return {
      factionId,
      reachable: isInFirstContactRange(playerQx, playerQy, factionId),
      firstContacted: contacted.has(factionId),
      reputation,
      tier: getRepTierLabel(getRepTier(reputation)),
    };
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/server && npx vitest run src/engine/__tests__/xenoStatus.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/engine/alienReputationService.ts packages/server/src/engine/__tests__/xenoStatus.test.ts
git commit -m "feat: #534 pure buildXenoStatus helper + unit test"
```

---

## Task 4: Server `xenoStatus` action in `handleAlienInteract`

The handler itself is exercised by the Docker E2E (Task 10); its logic delegates to the already-tested `buildXenoStatus`, so no separate handler unit test is added (testing it would require mocking `ServiceContext` + multiple DB queries for little additional coverage).

**Files:**
- Modify: `packages/server/src/rooms/services/AlienInteractionService.ts`

- [ ] **Step 1: Add `buildXenoStatus` to the `alienReputationService.js` import block**

Replace (lines 24–30):

```typescript
import {
  getRepTier,
  getRepTierLabel,
  getRepChangeForAction,
  isInFirstContactRange,
  ALIEN_FIRST_CONTACT_FLAVOR,
} from '../../engine/alienReputationService.js';
```

with:

```typescript
import {
  getRepTier,
  getRepTierLabel,
  getRepChangeForAction,
  isInFirstContactRange,
  buildXenoStatus,
  ALIEN_FIRST_CONTACT_FLAVOR,
} from '../../engine/alienReputationService.js';
```

- [ ] **Step 2: Add `getAlienFirstContacts` to the `db/queries.js` import block**

Replace (lines 31–33, the start of the queries import):

```typescript
import {
  getAlienReputation,
  getAllAlienReputations,
```

with:

```typescript
import {
  getAlienReputation,
  getAllAlienReputations,
  getAlienFirstContacts,
```

- [ ] **Step 3: Add the `xenoStatus` early-return at the top of `handleAlienInteract`**

In `handleAlienInteract`, replace (lines 99–101):

```typescript
    const { factionId, action, payload } = data;

    // Validate faction exists
```

with:

```typescript
    const { factionId, action, payload } = data;

    // XENO program status query (#534): per-faction reachability + reputation for the player's
    // quadrant. Handled first so it bypasses faction-validation + range gate (factionId may be a
    // placeholder like '_'), mirroring how getReputation is exempted from the range check.
    if (action === 'xenoStatus') {
      const [reputations, firstContacts] = await Promise.all([
        getAllAlienReputations(auth.userId),
        getAlienFirstContacts(auth.userId),
      ]);
      const factions = buildXenoStatus(
        this.ctx.quadrantX,
        this.ctx.quadrantY,
        reputations,
        firstContacts,
      );
      client.send('xenoStatusUpdate', { factions });
      return;
    }

    // Validate faction exists
```

- [ ] **Step 4: Verify the server compiles and existing alien tests still pass**

Run: `cd packages/server && npx tsc --noEmit && npx vitest run src/engine/__tests__/alienInteraction.test.ts src/engine/__tests__/alienSystem.test.ts src/engine/__tests__/xenoStatus.test.ts`
Expected: tsc exits 0; all listed test files PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/services/AlienInteractionService.ts
git commit -m "feat: #534 xenoStatus action — server-driven per-faction reachability"
```

---

## Task 5: Client store — `xenoStatus` + `alienInteractResult`

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/test/mockStore.ts`

- [ ] **Step 1: Import the shared types into `gameSlice.ts`**

In `packages/client/src/state/gameSlice.ts`, the shared import block ends at line 61 (`} from '@void-sector/shared';`). Add the two type names to that import. Replace:

```typescript
} from '@void-sector/shared';
```

(the one at line 61 — if ambiguous, it is the import block that includes the game types) with:

```typescript
  type XenoFactionStatus,
  type AlienInteractResult,
} from '@void-sector/shared';
```

> If that import block uses `import type { ... }` form, instead add `XenoFactionStatus, AlienInteractResult` to the type list without the inline `type` keyword. Verify the final import compiles in Step 5.

- [ ] **Step 2: Add fields + setter signatures to the `GameSlice` interface**

Replace (line 346–347):

```typescript
  alienReputations: Record<string, number>;
  humanityReps: Record<string, { repValue: number; tier: 'FEINDSELIG' | 'NEUTRAL' | 'FREUNDLICH' }> | null;
```

with:

```typescript
  alienReputations: Record<string, number>;
  humanityReps: Record<string, { repValue: number; tier: 'FEINDSELIG' | 'NEUTRAL' | 'FREUNDLICH' }> | null;
  // XENO alien-interaction program (#534)
  xenoStatus: XenoFactionStatus[];
  alienInteractResult: AlienInteractResult | null;
  setXenoStatus: (status: XenoFactionStatus[]) => void;
  setAlienInteractResult: (result: AlienInteractResult | null) => void;
```

- [ ] **Step 3: Add the initial values**

Replace (lines 768–769):

```typescript
  alienCredits: 0,
  alienReputations: {},
```

with:

```typescript
  alienCredits: 0,
  alienReputations: {},
  xenoStatus: [],
  alienInteractResult: null,
```

- [ ] **Step 4: Add the setter implementations**

Find the setter implementations region (near the existing `setHumanityReps: (reps) => set({ humanityReps: reps }),` at ~line 1111). Replace:

```typescript
  setHumanityReps: (reps) => set({ humanityReps: reps }),
```

with:

```typescript
  setHumanityReps: (reps) => set({ humanityReps: reps }),
  setXenoStatus: (status) => set({ xenoStatus: status }),
  setAlienInteractResult: (result) => set({ alienInteractResult: result }),
```

- [ ] **Step 5: Add defaults to `mockStore.ts` so component tests have these fields**

In `packages/client/src/test/mockStore.ts`, add the new fields (and the missing `actionError`/`setActionError` used by `InlineError`) to the default state. Replace:

```typescript
    alienReputations: {},
    humanityReps: {},
```

with:

```typescript
    alienReputations: {},
    humanityReps: {},
    xenoStatus: [],
    alienInteractResult: null,
    setXenoStatus: vi.fn(),
    setAlienInteractResult: vi.fn(),
    actionError: null,
    setActionError: vi.fn(),
```

- [ ] **Step 6: Typecheck the client**

Run: `cd packages/client && npx tsc --noEmit`
Expected: exits 0 (no errors about `xenoStatus`, `alienInteractResult`, or the shared imports).

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/test/mockStore.ts
git commit -m "feat: #534 client store xenoStatus + alienInteractResult state"
```

---

## Task 6: Client network — request + handlers

**Files:**
- Modify: `packages/client/src/network/client.ts`

- [ ] **Step 1: Import the shared types into `client.ts`**

Add `XenoFactionStatus` and `AlienInteractResult` to one of the `@void-sector/shared` type import blocks in `packages/client/src/network/client.ts` (the block ending at line 54 or 72). For example, replace:

```typescript
} from '@void-sector/shared';
```

(the type-import block ending at line 72) with:

```typescript
  XenoFactionStatus,
  AlienInteractResult,
} from '@void-sector/shared';
```

> Match the existing import style (with or without inline `type`). Verify in Step 5.

- [ ] **Step 2: Add `requestXenoStatus()` next to `sendAlienInteract`**

Immediately after the `sendAlienInteract` method (ends at line 2516), add:

```typescript
  /** Request the per-faction XENO status (reachability/rep) for the current quadrant (#534). */
  requestXenoStatus() {
    if (!this.sectorRoom) {
      useStore.getState().addLogEntry('NOT CONNECTED');
      return;
    }
    this.sectorRoom.send('alienInteract', { factionId: '_', action: 'xenoStatus' });
  }
```

- [ ] **Step 3: Augment the `alienInteractResult` handler to store the result + surface errors**

Replace the existing handler (lines 909–931):

```typescript
    room.onMessage(
      'alienInteractResult',
      (data: {
        success: boolean;
        factionId?: string;
        action?: string;
        message?: string;
        error?: string;
        repAfter?: number;
        repTier?: string;
        reputations?: Record<string, number>;
      }) => {
        const store = useStore.getState();
        if (data.message) {
          store.addLogEntry(data.message);
        } else if (!data.success && data.error) {
          store.addLogEntry(`[${data.factionId?.toUpperCase() ?? 'ALIEN'}] ${data.error}`);
        }
        if (data.reputations) {
          useStore.setState({ alienReputations: data.reputations });
        }
      },
    );
```

with:

```typescript
    room.onMessage('alienInteractResult', (data: AlienInteractResult) => {
      const store = useStore.getState();
      store.setAlienInteractResult(data);
      if (data.message) {
        store.addLogEntry(data.message);
      } else if (!data.success && data.error) {
        store.addLogEntry(`[${data.factionId?.toUpperCase() ?? 'ALIEN'}] ${data.error}`);
      }
      // Surface failures via InlineError (alien errors come on this channel, not actionError).
      if (!data.success && data.error) {
        store.setActionError({ code: 'XENO_ERROR', message: data.error });
      }
      if (data.reputations) {
        useStore.setState({ alienReputations: data.reputations });
      }
    });
```

- [ ] **Step 4: Add the `xenoStatusUpdate` handler (right after the block from Step 3)**

```typescript
    // XENO status (#534): per-faction reachability + reputation snapshot
    room.onMessage('xenoStatusUpdate', (data: { factions: XenoFactionStatus[] }) => {
      useStore.getState().setXenoStatus(data.factions);
    });
```

- [ ] **Step 5: Typecheck the client**

Run: `cd packages/client && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat: #534 client network requestXenoStatus + xenoStatusUpdate handler"
```

---

## Task 7: HelpSlice `first_xeno` tip

**Files:**
- Modify: `packages/client/src/state/helpSlice.ts`

- [ ] **Step 1: Add the `first_xeno` tip to `HELP_TIPS`**

In `packages/client/src/state/helpSlice.ts`, replace the `first_login` entry (lines 12–17):

```typescript
  {
    id: 'first_login',
    title: 'WILLKOMMEN AN BORD',
    body: 'Klicke auf eine Zelle im Radar-Grid um einen Sektor auszuwählen. Doppelklick zentriert die Ansicht. Scroll-Rad ändert den Zoom-Level.',
    articleId: 'grundlagen-start',
  },
```

with (appending the new tip immediately after it):

```typescript
  {
    id: 'first_login',
    title: 'WILLKOMMEN AN BORD',
    body: 'Klicke auf eine Zelle im Radar-Grid um einen Sektor auszuwählen. Doppelklick zentriert die Ansicht. Scroll-Rad ändert den Zoom-Level.',
    articleId: 'grundlagen-start',
  },
  {
    id: 'first_xeno',
    title: '◈ XENO — FREMDE FRAKTIONEN',
    body: 'Hier kontaktierst du außerirdische Fraktionen.\n\n'
      + '→ Erreichbare Fraktionen sind aktiv, ferne zeigen "außer Reichweite"\n'
      + '→ [ERSTKONTAKT] startet die erste Begegnung\n'
      + '→ [GREET] grüßt und zeigt deinen Ruf-Status\n'
      + '→ Dein Ruf bestimmt, was eine Fraktion dir anbietet',
  },
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/client && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/state/helpSlice.ts
git commit -m "feat: #534 first_xeno HelpSlice tip"
```

---

## Task 8: `XenoScreen` component + test

**Files:**
- Create: `packages/client/src/components/XenoScreen.tsx`
- Test: `packages/client/src/__tests__/XenoScreen.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `packages/client/src/__tests__/XenoScreen.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { XenoScreen } from '../components/XenoScreen';
import { mockStoreState } from '../test/mockStore';
import { network } from '../network/client';

vi.mock('../network/client', () => ({
  network: {
    requestXenoStatus: vi.fn(),
    sendAlienInteract: vi.fn(),
  },
}));

const reachableScrappers = {
  factionId: 'scrappers',
  reachable: true,
  firstContacted: false,
  reputation: 0,
  tier: 'NEUTRAL',
};
const lockedAxioms = {
  factionId: 'axioms',
  reachable: false,
  firstContacted: false,
  reputation: 0,
  tier: 'NEUTRAL',
};

describe('XenoScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests xeno status on mount', () => {
    mockStoreState({ xenoStatus: [], alienInteractResult: null } as any);
    render(<XenoScreen />);
    expect(network.requestXenoStatus).toHaveBeenCalled();
  });

  it('renders reachable and locked factions from the store', () => {
    mockStoreState({ xenoStatus: [reachableScrappers, lockedAxioms], alienInteractResult: null } as any);
    render(<XenoScreen />);
    expect(screen.getByTestId('xeno-faction-scrappers')).toBeInTheDocument();
    expect(screen.getByText('außer Reichweite')).toBeInTheDocument();
  });

  it('disables a locked faction button', () => {
    mockStoreState({ xenoStatus: [lockedAxioms], alienInteractResult: null } as any);
    render(<XenoScreen />);
    expect(screen.getByTestId('xeno-faction-axioms')).toBeDisabled();
  });

  it('ERSTKONTAKT sends firstContact for a not-yet-contacted faction', async () => {
    mockStoreState({ xenoStatus: [reachableScrappers], alienInteractResult: null } as any);
    render(<XenoScreen />);
    await userEvent.click(screen.getByTestId('xeno-faction-scrappers'));
    await userEvent.click(screen.getByTestId('xeno-firstcontact-btn'));
    expect(network.sendAlienInteract).toHaveBeenCalledWith('scrappers', 'firstContact', undefined);
  });

  it('renders a successful result message', async () => {
    mockStoreState({
      xenoStatus: [{ ...reachableScrappers, firstContacted: true }],
      alienInteractResult: {
        success: true,
        factionId: 'scrappers',
        action: 'greet',
        message: 'SCRAPPER-FUNK: Hallo!',
        repTier: 'NEUTRAL',
      },
    } as any);
    render(<XenoScreen />);
    await userEvent.click(screen.getByTestId('xeno-faction-scrappers'));
    expect(screen.getByTestId('xeno-result')).toHaveTextContent('SCRAPPER-FUNK: Hallo!');
  });

  it('renders an error via InlineError', async () => {
    mockStoreState({
      xenoStatus: [reachableScrappers],
      alienInteractResult: null,
      actionError: { code: 'XENO_ERROR', message: 'Scrappers ignorieren dich.' },
    } as any);
    render(<XenoScreen />);
    await userEvent.click(screen.getByTestId('xeno-faction-scrappers'));
    expect(screen.getByText(/Scrappers ignorieren dich/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/client && npx vitest run src/__tests__/XenoScreen.test.tsx`
Expected: FAIL — cannot resolve `../components/XenoScreen` (module does not exist).

- [ ] **Step 3: Implement `XenoScreen.tsx`**

Create `packages/client/src/components/XenoScreen.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { InlineError } from './InlineError';

const FACTION_LABELS: Record<string, string> = {
  scrappers: 'SCRAPPERS',
  archivists: 'ARCHIVISTS',
  consortium: 'KONSORTIUM',
  kthari: "K'THARI",
  mycelians: 'MYCELIANER',
  mirror_minds: 'MIRROR MINDS',
  tourist_guild: 'TOURIST GUILD',
  silent_swarm: 'SILENT SWARM',
  helions: 'HELIONS',
  axioms: 'AXIOMS',
};

function label(factionId: string): string {
  return FACTION_LABELS[factionId] ?? factionId.toUpperCase();
}

export function XenoScreen() {
  const xenoStatus = useStore((s) => s.xenoStatus);
  const result = useStore((s) => s.alienInteractResult);
  const showTip = useStore((s) => s.showTip);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    network.requestXenoStatus();
    showTip('first_xeno');
  }, [showTip]);

  const selected = xenoStatus.find((f) => f.factionId === selectedId) ?? null;

  // Generic action runner: dispatch then refresh status (server processes both in order).
  function runAction(factionId: string, action: string, payload?: Record<string, unknown>) {
    network.sendAlienInteract(factionId, action, payload);
    network.requestXenoStatus();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6 }}>
          XENO — FREMDE FRAKTIONEN
        </span>
        <button
          onClick={() => showTip('first_xeno')}
          style={{
            background: 'none',
            border: '1px solid var(--color-dim)',
            color: 'var(--color-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            padding: '0 4px',
            cursor: 'pointer',
          }}
          title="Hilfe"
        >
          [?]
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
        {/* Faction list */}
        <div
          data-testid="xeno-faction-list"
          style={{
            width: '45%',
            overflowY: 'auto',
            borderRight: '1px solid var(--color-dim)',
            paddingRight: 6,
          }}
        >
          {xenoStatus.length === 0 && (
            <div style={{ opacity: 0.5, fontSize: '0.75rem' }}>LADE FRAKTIONEN…</div>
          )}
          {xenoStatus.map((f) => (
            <button
              key={f.factionId}
              data-testid={`xeno-faction-${f.factionId}`}
              disabled={!f.reachable}
              onClick={() => setSelectedId(f.factionId)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                marginBottom: 2,
                background: selectedId === f.factionId ? 'var(--color-dim)' : 'none',
                color: f.reachable ? 'var(--color-primary)' : 'var(--color-dim)',
                border: '1px solid var(--color-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                padding: '2px 4px',
                cursor: f.reachable ? 'pointer' : 'default',
                opacity: f.reachable ? 1 : 0.5,
              }}
            >
              <span>{label(f.factionId)}</span>
              <span style={{ float: 'right', opacity: 0.7 }}>
                {f.reachable ? f.tier : 'außer Reichweite'}
              </span>
            </button>
          ))}
        </div>

        {/* Detail / action area */}
        <div style={{ flex: 1, overflowY: 'auto', fontSize: '0.8rem' }}>
          {!selected && <div style={{ opacity: 0.5 }}>Fraktion auswählen…</div>}
          {selected && (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{label(selected.factionId)}</div>
              <div style={{ opacity: 0.7, marginBottom: 6 }}>
                RUF: {selected.reputation} · {selected.tier}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {!selected.firstContacted && (
                  <button
                    className="vs-btn"
                    data-testid="xeno-firstcontact-btn"
                    onClick={() => runAction(selected.factionId, 'firstContact')}
                  >
                    [ERSTKONTAKT]
                  </button>
                )}
                <button
                  className="vs-btn"
                  data-testid="xeno-greet-btn"
                  onClick={() => runAction(selected.factionId, 'greet')}
                >
                  [GREET]
                </button>
              </div>
              <InlineError codes={['XENO_ERROR']} />
              {result && result.success && result.factionId === selected.factionId && (
                <div
                  data-testid="xeno-result"
                  style={{
                    marginTop: 6,
                    whiteSpace: 'pre-wrap',
                    borderTop: '1px solid var(--color-dim)',
                    paddingTop: 6,
                  }}
                >
                  {result.message}
                  {typeof result.repAfter === 'number' && (
                    <div style={{ opacity: 0.7, marginTop: 4 }}>
                      RUF: {result.repBefore ?? '—'} → {result.repAfter}
                      {result.repTier ? ` (${result.repTier})` : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/client && npx vitest run src/__tests__/XenoScreen.test.tsx`
Expected: PASS — all 6 tests green. (Ignore the benign `EACCES` on `node_modules/.vite/...results.json`; check the `Test Files ... passed` line.)

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/XenoScreen.tsx packages/client/src/__tests__/XenoScreen.test.tsx
git commit -m "feat: #534 XenoScreen — faction list + generic action runner"
```

---

## Task 9: Wire routing (desktop + mobile)

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx`
- Modify: `packages/client/src/hooks/useMobileTabs.ts`

- [ ] **Step 1: Import `XenoScreen` into `GameScreen.tsx`**

Replace (line 18):

```typescript
import { FabrikPanel } from './FabrikPanel';
```

with:

```typescript
import { FabrikPanel } from './FabrikPanel';
import { XenoScreen } from './XenoScreen';
```

- [ ] **Step 2: Add the route in `renderScreen()`**

Replace (lines 354–355):

```typescript
    case MONITORS.FABRIK:
      return <FabrikPanel />;
```

with:

```typescript
    case MONITORS.FABRIK:
      return <FabrikPanel />;
    case MONITORS.XENO:
      return <XenoScreen />;
```

(`renderMobileScreen` and `renderCockpitScreen` both fall through to `renderScreen` for unlisted monitors, so XENO is covered on mobile and in the cockpit detail with no further routing change.)

- [ ] **Step 3: Add XENO to the mobile MEHR grid**

In `packages/client/src/hooks/useMobileTabs.ts`, replace (line 35):

```typescript
  { id: MONITORS.FRIENDS, icon: '☺', label: 'FREUNDE' },
```

with:

```typescript
  { id: MONITORS.FRIENDS, icon: '☺', label: 'FREUNDE' },
  { id: MONITORS.XENO, icon: '✴', label: 'XENO' },
```

- [ ] **Step 4: Typecheck the client**

Run: `cd packages/client && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/GameScreen.tsx packages/client/src/hooks/useMobileTabs.ts
git commit -m "feat: #534 route XENO program (desktop + mobile MEHR)"
```

---

## Task 10: Full verification + Docker E2E

**Files:** none (verification only).

- [ ] **Step 1: Run the full server test suite**

Run: `cd packages/server && npx vitest run`
Expected: all pass (~1495+ tests including the new `xenoStatus.test.ts`).

- [ ] **Step 2: Run the full client test suite**

Run: `cd packages/client && npx vitest run`
Expected: all pass (~559+ including `XenoScreen.test.tsx`). Confirm via the `Test Files ... passed` line; the `.vite/...results.json` `EACCES` warning is benign.

- [ ] **Step 3: Confirm shared is built**

Run: `cd packages/shared && npm run build && npx vitest run`
Expected: build exits 0; shared tests pass.

- [ ] **Step 4: Lint the changed files**

Run: `cd packages/client && npx eslint src/components/XenoScreen.tsx src/hooks/useMobileTabs.ts` and `cd packages/server && npx eslint src/engine/alienReputationService.ts src/rooms/services/AlienInteractionService.ts`
Expected: 0 errors.

- [ ] **Step 5: Docker E2E — reachability + first contact + greet**

```bash
docker compose up -d
docker compose build client server && docker compose up -d client server
```

Then, using the admin token from `docker-compose.yml` (`vs-admin-2026`):

1. Register/log in a fresh test pilot in the browser (get the current public URL via `docker compose logs cloudflared | grep trycloudflare`, or use `http://localhost:3201`).
2. Find the pilot's player id (admin API) and teleport into scrappers' range — scrappers' `ALIEN_FIRST_CONTACT_DISTANCE` is 60, so a sector whose quadrant Chebyshev distance ≥ 60 (e.g. quadrant 60:0). Compute the sector coords for that quadrant (`QUADRANT_SIZE` from shared) and PATCH:
   ```bash
   curl -X PATCH -H "Authorization: Bearer vs-admin-2026" -H "Content-Type: application/json" \
     -d '{"x": <sectorX>, "y": <sectorY>}' \
     http://localhost:2567/admin/api/players/<playerId>/position
   ```
3. Reload the client so it joins the quadrant_60_0 room. Open the **XENO** program.
   - Expected: SCRAPPERS shows reachable with a tier; distant factions (e.g. AXIOMS) show **"außer Reichweite"** and are disabled.
4. Select SCRAPPERS → click **[ERSTKONTAKT]**.
   - Expected: flavor message appears (`xeno-result`), no error.
5. Click **[GREET]**.
   - Expected: a greet message renders; the status list refreshes (rep/tier reflect any change). For an out-of-reach action the `XENO_ERROR` InlineError shows instead.
6. Confirm **0 console errors** in the browser devtools throughout.

- [ ] **Step 6: Final integration commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "test: #534 XENO framework verification fixups"
```

If no fixups were required, skip this commit.

---

## Self-Review

**Spec coverage:**
- Server `xenoStatus` action bypassing the range gate, computing `{factionId, reachable, firstContacted, reputation, tier}` for all 10 factions → Tasks 3 + 4.
- `firstContacted` source / new getter → Task 2.
- Shared `MONITORS.XENO` + `COCKPIT_PROGRAMS` + `COCKPIT_PROGRAM_LABELS` → Task 1.
- Store `xenoStatus` + `alienInteractResult` + setters → Task 5.
- Network `requestXenoStatus()` + `xenoStatusUpdate`/`alienInteractResult` handlers → Task 6.
- `XenoScreen` (mount request, faction list, ERSTKONTAKT/GREET, generic runner, result + InlineError) → Task 8.
- GameScreen routing → Task 9.
- `first_xeno` HelpSlice tip + `[?]` button → Task 7 (tip) + Task 8 (button in header).
- Mobile MEHR risk (add to `MEHR_MONITORS`) → Task 9.
- Testing: server unit (Task 3), client unit (Task 8), Docker E2E (Task 10).
- Out-of-scope bespoke per-faction panels are intentionally excluded; the generic runner is the slot-in point.

**Type consistency:** `XenoFactionStatus` and `AlienInteractResult` are defined once in shared (Task 1) and imported by server engine (Task 3), server handler payload (Task 4 sends `{ factions: XenoFactionStatus[] }`), client store (Task 5), client network (Task 6), and consumed by `XenoScreen` (Task 8). Method names: `buildXenoStatus`, `getAlienFirstContacts`, `requestXenoStatus`, `setXenoStatus`, `setAlienInteractResult` are used identically across tasks. Message names `alienInteract` (with `action:'xenoStatus'`) and `xenoStatusUpdate` match between server send and client handler.

**Placeholder scan:** No TBD/TODO/"handle edge cases" placeholders; every code step contains complete code.
