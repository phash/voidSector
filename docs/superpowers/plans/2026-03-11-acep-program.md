# ACEP Program + AUSBAU-Level Gating Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone ACEP monitor to the cockpit that shows module slots + XP development paths, and replace research-lab-tier gating with AUSBAU-level gating for research slots and the factory.

**Architecture:** Five tasks in dependency order — shared constants first (other packages import from it), server changes next, then new client component, then client wiring. Each task is independently testable.

**Tech Stack:** TypeScript, React, Zustand, Colyseus, Vitest, @testing-library/react

---

## Chunk 1: Shared Constants + Server Gating

### Task 1: Update shared/constants.ts

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Test: `packages/shared/src/__tests__/constants.test.ts` (add to existing file)

- [ ] **Step 1: Write the failing test**

Append to `packages/shared/src/__tests__/constants.test.ts`:

```typescript
import { MONITORS, COCKPIT_PROGRAMS, COCKPIT_PROGRAM_LABELS, RESEARCH_LAB_NAMES } from '../constants.js';

describe('ACEP constants', () => {
  it('MONITORS.ACEP exists', () => {
    expect(MONITORS.ACEP).toBe('ACEP');
  });
  it('ACEP is in COCKPIT_PROGRAMS', () => {
    expect(COCKPIT_PROGRAMS).toContain('ACEP');
  });
  it('COCKPIT_PROGRAM_LABELS has ACEP entry', () => {
    expect(COCKPIT_PROGRAM_LABELS['ACEP']).toBe('ACEP');
  });
  it('RESEARCH_LAB_NAMES use AUSBAU Level strings', () => {
    expect(RESEARCH_LAB_NAMES[1]).toBe('AUSBAU Level 1');
    expect(RESEARCH_LAB_NAMES[3]).toBe('AUSBAU Level 3');
    expect(RESEARCH_LAB_NAMES[5]).toBe('AUSBAU Level 5');
  });
});
```

If `constants.test.ts` does not exist yet, create a new file with the imports and `describe` block above.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/shared && npx vitest run src/__tests__/constants.test.ts
```

Expected: FAIL — `MONITORS.ACEP` undefined, etc.

- [ ] **Step 3: Apply four edits to constants.ts**

**Edit 1** — In the `MONITORS` object (around line 2182), add `ACEP` after `NEWS`:

Old:
```typescript
  NEWS: 'NEWS',
} as const;
```
New:
```typescript
  NEWS: 'NEWS',
  ACEP: 'ACEP',
} as const;
```

**Edit 2** — In `COCKPIT_PROGRAMS` array (around line 2201), add `MONITORS.ACEP` after `MONITORS.LOG`:

Old:
```typescript
  MONITORS.LOG,
];
```
New:
```typescript
  MONITORS.LOG,
  MONITORS.ACEP,
];
```

**Edit 3** — In `COCKPIT_PROGRAM_LABELS` (around line 2228), add `ACEP` entry after `HANGAR`:

Old:
```typescript
  HANGAR: 'HANGAR',
```
New:
```typescript
  HANGAR: 'HANGAR',
  ACEP: 'ACEP',
```

**Edit 4** — Replace `RESEARCH_LAB_NAMES` body (around line 122):

Old:
```typescript
export const RESEARCH_LAB_NAMES: Record<number, string> = {
  1: 'GRUNDLABOR',
  2: 'FORSCHUNGSLABOR',
  3: 'ANALYSESTATION',
  4: 'FORSCHUNGSTURM',
  5: 'OBSERVATORIUM',
};
```
New:
```typescript
export const RESEARCH_LAB_NAMES: Record<number, string> = {
  1: 'AUSBAU Level 1',
  2: 'AUSBAU Level 2',
  3: 'AUSBAU Level 3',
  4: 'AUSBAU Level 4',
  5: 'AUSBAU Level 5',
};
```

- [ ] **Step 4: Build shared**

```bash
cd packages/shared && npm run build
```

Expected: exits with code 0, no TypeScript errors.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/shared && npx vitest run src/__tests__/constants.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/__tests__/constants.test.ts
git commit -m "feat: add MONITORS.ACEP, COCKPIT_PROGRAMS entry, rename RESEARCH_LAB_NAMES to AUSBAU Level"
```

---

### Task 2: Server — Replace getResearchLabTier with AUSBAU Level

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Create: `packages/server/src/__tests__/ausbauResearchGating.test.ts`

**Context:**
- `getAcepXpSummary(shipId)` takes a ship ID (not userId). It is already imported in ShipService.ts from `'../../engine/acepXpService.js'`.
- `getActiveShip` is already imported in ShipService.ts from `'../../db/queries.js'`.
- `getAcepLevel` needs to be added to the `@void-sector/shared` import in ShipService.ts.
- In SectorRoom.ts join handler (~line 1270): `acepXp` is already in scope from line ~1160 (`getAcepXpSummary(shipRecord.id)`). Just call `getAcepLevel(acepXp.ausbau)`. Add `getAcepLevel` to the shared import block.
- `getResearchLabTier` must be removed from both files' import lists after replacement.

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/__tests__/ausbauResearchGating.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

// AUSBAU Level 3 = 18 XP (level requires >= 18 for slot 2 which needs labTier >= 3)
vi.mock('../engine/acepXpService.js', () => ({
  getAcepXpSummary: vi.fn().mockResolvedValue({ ausbau: 18, intel: 0, kampf: 0, explorer: 0 }),
  getAcepEffects: vi.fn().mockReturnValue({
    extraModuleSlots: 0, cargoMultiplier: 1, miningBonus: 0,
    scanRadiusBonus: 0, combatDamageBonus: 0,
    ancientDetection: false, helionDecoderEnabled: false,
  }),
  boostAcepPath: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../db/queries.js', () => ({
  getPlayerResearch: vi.fn().mockResolvedValue({ unlockedModules: ['laser_mk1'], blueprints: [] }),
  getActiveResearch: vi.fn().mockResolvedValue(null),
  getWissen: vi.fn().mockResolvedValue(100),
  getResearchLabTier: vi.fn().mockResolvedValue(1), // old fn — must NOT be called
  getTypedArtefacts: vi.fn().mockResolvedValue({}),
  getPlayerReputations: vi.fn().mockResolvedValue([]),
  getActiveShip: vi.fn().mockResolvedValue({ id: 'ship-1', hullType: 'scout', modules: [] }),
  getPlayerShips: vi.fn().mockResolvedValue([]),
  updateShipModules: vi.fn().mockResolvedValue(undefined),
  renameShip: vi.fn().mockResolvedValue(undefined),
  renameBase: vi.fn().mockResolvedValue(undefined),
  getInventory: vi.fn().mockResolvedValue([]),
  getPlayerHomeBase: vi.fn().mockResolvedValue(null),
  startActiveResearch: vi.fn().mockResolvedValue(undefined),
  deleteActiveResearch: vi.fn().mockResolvedValue(undefined),
  getPlayerCredits: vi.fn().mockResolvedValue(9999),
  deductCredits: vi.fn().mockResolvedValue(undefined),
  deductTypedArtefacts: vi.fn().mockResolvedValue(undefined),
  deductWissen: vi.fn().mockResolvedValue(undefined),
  addWissen: vi.fn().mockResolvedValue(undefined),
  addUnlockedModule: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn().mockResolvedValue(undefined),
  removeFromInventory: vi.fn().mockResolvedValue(undefined),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
  getInventoryItem: vi.fn().mockResolvedValue(null),
}));

vi.mock('../rooms/services/RedisAPStore.js', () => ({
  getFuelState: vi.fn().mockResolvedValue(100),
}));

import { ShipService } from '../rooms/services/ShipService.js';
import { getResearchLabTier } from '../db/queries.js';

function makeClient(userId = 'u1'): Client {
  return {
    sessionId: 's1',
    auth: { userId, username: 'Pilot', role: 'player' },
    send: vi.fn(),
  } as unknown as Client;
}

function makeCtx() {
  return {
    checkRate: vi.fn().mockReturnValue(true),
    getShipForClient: vi.fn().mockReturnValue({ cargoCap: 50 }),
    checkQuestProgress: vi.fn().mockResolvedValue(undefined),
  } as any;
}

beforeEach(() => vi.clearAllMocks());

describe('ShipService.handleStartResearch — AUSBAU level gating', () => {
  it('does NOT call getResearchLabTier', async () => {
    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleStartResearch(client, { moduleId: 'laser_mk1', slot: 1 });
    expect(getResearchLabTier).not.toHaveBeenCalled();
  });

  it('slot 2 with AUSBAU level 3 (18 XP) does not produce AUSBAU tier error', async () => {
    const svc = new ShipService(makeCtx());
    const client = makeClient();
    await svc.handleStartResearch(client, { moduleId: 'laser_mk1', slot: 2 });
    const calls = (client.send as ReturnType<typeof vi.fn>).mock.calls;
    const tierErrors = calls.filter(
      ([msg, data]: [string, any]) =>
        msg === 'error' && typeof data?.message === 'string' && data.message.includes('AUSBAU Level 3'),
    );
    expect(tierErrors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/__tests__/ausbauResearchGating.test.ts
```

Expected: FAIL — `getResearchLabTier` is still being called.

- [ ] **Step 3: Update ShipService.ts**

**3a.** Add `getAcepLevel` to the `@void-sector/shared` import block (~line 6). Find the list and add `getAcepLevel,` to it:

Old (excerpt):
```typescript
import {
  calculateShipStats,
  validateModuleInstall,
  getActiveDrawbacks,
  isModuleUnlocked,
  canStartResearch,
  MODULES,
```
New:
```typescript
import {
  calculateShipStats,
  validateModuleInstall,
  getActiveDrawbacks,
  isModuleUnlocked,
  canStartResearch,
  getAcepLevel,
  MODULES,
```

**3b.** Remove `getResearchLabTier` from the `../../db/queries.js` import (~line 55):

Old:
```typescript
  getTypedArtefacts,
  deductTypedArtefacts,
  getResearchLabTier,
} from '../../db/queries.js';
```
New:
```typescript
  getTypedArtefacts,
  deductTypedArtefacts,
} from '../../db/queries.js';
```

**3c.** In `handleGetResearchState` (~line 241), replace:

Old:
```typescript
    const labTier = await getResearchLabTier(auth.userId);
```
New:
```typescript
    const shipForLabTier = await getActiveShip(auth.userId);
    const acepXpForTier = shipForLabTier ? await getAcepXpSummary(shipForLabTier.id) : { ausbau: 0 };
    const labTier = getAcepLevel(acepXpForTier.ausbau);
```

**3d.** In `handleStartResearch` (~line 266), replace:

Old:
```typescript
    const labTier = await getResearchLabTier(auth.userId);
```
New:
```typescript
    const shipForLabTier = await getActiveShip(auth.userId);
    const acepXpForTier = shipForLabTier ? await getAcepXpSummary(shipForLabTier.id) : { ausbau: 0 };
    const labTier = getAcepLevel(acepXpForTier.ausbau);
```

- [ ] **Step 4: Update SectorRoom.ts**

**4a.** Add `getAcepLevel` to the value import from `@void-sector/shared` (~line 75–84). Find the existing `} from '@void-sector/shared';` that closes the value imports block and add `getAcepLevel,` to the list.

Old (excerpt, last lines of value import):
```typescript
  STATION_REP_VISIT,
  COSMIC_FACTION_IDS,
} from '@void-sector/shared';
```
New:
```typescript
  STATION_REP_VISIT,
  COSMIC_FACTION_IDS,
  getAcepLevel,
} from '@void-sector/shared';
```

**4b.** In the join handler (~line 1270), `acepXp` is already in scope (computed a hundred lines earlier). Replace:

Old:
```typescript
      const labTier = await getResearchLabTier(auth.userId);
```
New:
```typescript
      const labTier = getAcepLevel(acepXp.ausbau);
```

**4c.** Remove `getResearchLabTier` from the `'../db/queries.js'` import block (~line 70):

Old:
```typescript
  getInventory,
  getResearchLabTier,
} from '../db/queries.js';
```
New:
```typescript
  getInventory,
} from '../db/queries.js';
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/server && npx vitest run src/__tests__/ausbauResearchGating.test.ts
```

Expected: PASS

- [ ] **Step 6: Run full server test suite**

```bash
cd packages/server && npx vitest run
```

Expected: all tests pass (no regression)

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/rooms/services/ShipService.ts \
        packages/server/src/rooms/SectorRoom.ts \
        packages/server/src/__tests__/ausbauResearchGating.test.ts
git commit -m "feat: replace getResearchLabTier with AUSBAU level in ShipService + SectorRoom"
```

---

### Task 3: Server — EconomyService Factory Gating

**Files:**
- Modify: `packages/server/src/rooms/services/EconomyService.ts`
- Create: `packages/server/src/__tests__/factoryGating.test.ts`

**Context:**
- `getAcepXpSummary(shipId)` takes ship ID. EconomyService needs `getActiveShip` from queries + `getAcepXpSummary` from acepXpService.
- `getAcepLevel` from `@void-sector/shared`.
- The gate goes after rate-limit/guest checks and after recipeId validation, before `getPlayerStructure`.

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/__tests__/factoryGating.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'colyseus';

vi.mock('../engine/acepXpService.js', () => ({
  getAcepXpSummary: vi.fn().mockResolvedValue({ ausbau: 0, intel: 0, kampf: 0, explorer: 0 }),
  addAcepXpForPlayer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/npcgen.js', () => ({
  getStationFaction: vi.fn().mockReturnValue(null),
}));

vi.mock('../engine/npcStationEngine.js', () => ({
  getOrInitStation: vi.fn().mockResolvedValue({}),
  recordTrade: vi.fn().mockResolvedValue(undefined),
  canBuyFromStation: vi.fn().mockReturnValue({ canBuy: false, effectiveAmount: 0 }),
  canSellToStation: vi.fn().mockReturnValue({ canSell: false, effectiveAmount: 0 }),
  calculateCurrentStock: vi.fn().mockReturnValue(0),
  getStationLevel: vi.fn().mockReturnValue(1),
  calculatePrice: vi.fn().mockReturnValue(10),
}));

vi.mock('../db/npcStationQueries.js', () => ({
  getStationInventoryItem: vi.fn().mockResolvedValue(null),
  upsertInventoryItem: vi.fn().mockResolvedValue(undefined),
  getStationInventory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../db/queries.js', () => ({
  getActiveShip: vi.fn().mockResolvedValue({ id: 'ship-1', hullType: 'scout', modules: [] }),
  getPlayerStructure: vi.fn().mockResolvedValue({ id: 'factory-1', type: 'factory' }),
  getOrCreateFactoryState: vi.fn().mockResolvedValue(undefined),
  getPlayerResearch: vi.fn().mockResolvedValue({ unlockedModules: [], blueprints: [] }),
  getFactoryStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
  getPlayerCredits: vi.fn().mockResolvedValue(1000),
  deductCredits: vi.fn().mockResolvedValue(undefined),
  getPlayerReputations: vi.fn().mockResolvedValue([]),
  getInventory: vi.fn().mockResolvedValue([]),
  addCredits: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn().mockResolvedValue(undefined),
  removeFromInventory: vi.fn().mockResolvedValue(undefined),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
  getResourceTotal: vi.fn().mockResolvedValue(0),
  canAddResource: vi.fn().mockResolvedValue(true),
}));

vi.mock('../engine/factoryEngine.js', () => ({
  setActiveRecipe: vi.fn().mockResolvedValue({ success: false, error: 'No blueprint' }),
}));

vi.mock('../engine/commands.js', () => ({
  validateNpcTrade: vi.fn().mockReturnValue({ valid: false }),
  validateTransfer: vi.fn().mockReturnValue({ valid: false }),
  getReputationTier: vi.fn().mockReturnValue('neutral'),
}));

import { EconomyService } from '../rooms/services/EconomyService.js';
import { getAcepXpSummary } from '../engine/acepXpService.js';

function makeClient(userId = 'u1'): Client {
  return {
    sessionId: 's1',
    auth: { userId, username: 'Pilot', role: 'player' },
    send: vi.fn(),
  } as unknown as Client;
}

function makeCtx() {
  return {
    checkRate: vi.fn().mockReturnValue(true),
    getShipForClient: vi.fn().mockReturnValue({ cargoCap: 50 }),
    checkQuestProgress: vi.fn().mockResolvedValue(undefined),
    applyXpGain: vi.fn().mockResolvedValue(undefined),
    applyReputationChange: vi.fn().mockResolvedValue(undefined),
    sendToPlayer: vi.fn(),
    send: vi.fn(),
    _px: vi.fn().mockReturnValue(0),
    _py: vi.fn().mockReturnValue(0),
  } as any;
}

beforeEach(() => vi.clearAllMocks());

describe('EconomyService.handleFactorySetRecipe — AUSBAU gate', () => {
  it('sends FACTORY_LOCKED when AUSBAU level is 1 (0 XP)', async () => {
    vi.mocked(getAcepXpSummary).mockResolvedValue({ ausbau: 0, intel: 0, kampf: 0, explorer: 0 });
    const svc = new EconomyService(makeCtx());
    const client = makeClient();
    await svc.handleFactorySetRecipe(client, { recipeId: 'ore_plate' });
    const calls = (client.send as ReturnType<typeof vi.fn>).mock.calls;
    const errorCall = calls.find(([msg]: [string]) => msg === 'error');
    expect(errorCall).toBeDefined();
    expect(errorCall![1].code).toBe('FACTORY_LOCKED');
  });

  it('does NOT send FACTORY_LOCKED when AUSBAU level is 2 (8 XP)', async () => {
    vi.mocked(getAcepXpSummary).mockResolvedValue({ ausbau: 8, intel: 0, kampf: 0, explorer: 0 });
    const svc = new EconomyService(makeCtx());
    const client = makeClient();
    await svc.handleFactorySetRecipe(client, { recipeId: 'ore_plate' });
    const calls = (client.send as ReturnType<typeof vi.fn>).mock.calls;
    const factoryLocked = calls.find(
      ([msg, data]: [string, any]) => msg === 'error' && data?.code === 'FACTORY_LOCKED',
    );
    expect(factoryLocked).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/server && npx vitest run src/__tests__/factoryGating.test.ts
```

Expected: FAIL — no FACTORY_LOCKED is sent yet.

- [ ] **Step 3: Update EconomyService.ts imports**

**3a.** Add `getAcepXpSummary` to the existing `acepXpService.js` import. Find:

Old:
```typescript
import { addAcepXpForPlayer } from '../../engine/acepXpService.js';
```
New:
```typescript
import { addAcepXpForPlayer, getAcepXpSummary } from '../../engine/acepXpService.js';
```

**3b.** Add `getActiveShip` to the queries import. Find the existing `../../db/queries.js` import block and add `getActiveShip,` to the list.

**3c.** Add `getAcepLevel` import from shared. If there is no `@void-sector/shared` import yet in EconomyService.ts, add one at the top:

```typescript
import { getAcepLevel } from '@void-sector/shared';
```

If a `@void-sector/shared` import block already exists, add `getAcepLevel,` to it.

- [ ] **Step 4: Add the AUSBAU gate in handleFactorySetRecipe**

Find the block after `data.recipeId` validation and before `getPlayerStructure` (~line 596):

Old:
```typescript
    if (!data?.recipeId || typeof data.recipeId !== 'string') {
      client.send('factoryUpdate', { error: 'Invalid recipe ID' });
      return;
    }

    const factoryStruct = await getPlayerStructure(auth.userId, 'factory');
```
New:
```typescript
    if (!data?.recipeId || typeof data.recipeId !== 'string') {
      client.send('factoryUpdate', { error: 'Invalid recipe ID' });
      return;
    }

    const shipForFactory = await getActiveShip(auth.userId);
    const acepXpFactory = shipForFactory ? await getAcepXpSummary(shipForFactory.id) : { ausbau: 0 };
    if (getAcepLevel(acepXpFactory.ausbau) < 2) {
      client.send('error', { code: 'FACTORY_LOCKED', message: 'Fabrik erfordert AUSBAU Level 2' });
      return;
    }

    const factoryStruct = await getPlayerStructure(auth.userId, 'factory');
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/server && npx vitest run src/__tests__/factoryGating.test.ts
```

Expected: PASS

- [ ] **Step 6: Run full server test suite**

```bash
cd packages/server && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/rooms/services/EconomyService.ts \
        packages/server/src/__tests__/factoryGating.test.ts
git commit -m "feat: AUSBAU Level 2 gate in EconomyService.handleFactorySetRecipe"
```

---

## Chunk 2: Client — ACEP Monitor

### Task 4: Create AcepProgram.tsx

**Files:**
- Create: `packages/client/src/components/AcepProgram.tsx`
- Create: `packages/client/src/__tests__/AcepProgram.test.tsx`

**Context:**
- Store data: `ship.modules` (array of `{slotIndex, moduleId, currentHp, maxHp}`), `ship.acepXp` (`{ausbau, intel, kampf, explorer, total}`), `ship.acepEffects`, `ship.acepTraits` (string[])
- `SPECIALIZED_SLOT_CATEGORIES` from `@void-sector/shared` — 8 entries: `['generator','drive','weapon','armor','shield','scanner','miner','cargo']`
- `getExtraSlotCount(ausbauXp)` from `@void-sector/shared` — returns count of extra slots unlocked
- `MODULES` from `@void-sector/shared` — lookup moduleId → `{name, category, ...}`
- `getModuleSourceColor(source)` from `'./moduleUtils'` — returns green/amber/blue
- `getAcepLevel(xp)` from `@void-sector/shared`
- Clicking an empty slot calls `setActiveProgram('MODULES')` from the store
- Clicking an occupied slot shows an uninstall button that calls `network.sendUninstallModule(slotIndex)`
- Left column uses a fixed 3-character HP bar: `█░` proportional to currentHp/maxHp, e.g. `██░` means 2/3 HP
- Category short-codes: `generator→GEN, drive→DRV, weapon→WPN, armor→ARM, shield→SHD, scanner→SCN, miner→MIN, cargo→CGO`
- Extra slots are labeled `+1`, `+2`, etc.
- HP bar for empty slots: `───`
- Re-use `AcepPanel` from `./AcepPanel` for the right column (XP bars + traits)

- [ ] **Step 1: Write the failing tests**

Create `packages/client/src/__tests__/AcepProgram.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetActiveProgram = vi.fn();
const mockSendUninstallModule = vi.fn();

vi.mock('../state/store', () => ({
  useStore: vi.fn((selector) =>
    selector({
      ship: {
        modules: [
          { slotIndex: 0, moduleId: 'fusion_mk2', currentHp: 2, maxHp: 3, source: 'standard' },
        ],
        acepXp: { ausbau: 18, intel: 8, kampf: 4, explorer: 0, total: 30 },
        acepEffects: {
          extraModuleSlots: 1, cargoMultiplier: 1, miningBonus: 0,
          scanRadiusBonus: 0, combatDamageBonus: 0,
          ancientDetection: false, helionDecoderEnabled: false,
        },
        acepTraits: ['VETERAN'],
      },
      setActiveProgram: mockSetActiveProgram,
    }),
  ),
}));

vi.mock('../network/client', () => ({
  network: {
    sendUninstallModule: mockSendUninstallModule,
    sendGetShips: vi.fn(),
  },
}));

import { AcepProgram } from '../components/AcepProgram.js';

beforeEach(() => {
  vi.clearAllMocks();
  // Reset useStore mock to default
  const { useStore } = require('../state/store');
  vi.mocked(useStore).mockImplementation((selector: any) =>
    selector({
      ship: {
        modules: [
          { slotIndex: 0, moduleId: 'fusion_mk2', currentHp: 2, maxHp: 3, source: 'standard' },
        ],
        acepXp: { ausbau: 18, intel: 8, kampf: 4, explorer: 0, total: 30 },
        acepEffects: {
          extraModuleSlots: 1, cargoMultiplier: 1, miningBonus: 0,
          scanRadiusBonus: 0, combatDamageBonus: 0,
          ancientDetection: false, helionDecoderEnabled: false,
        },
        acepTraits: ['VETERAN'],
      },
      setActiveProgram: mockSetActiveProgram,
    }),
  );
});

describe('AcepProgram', () => {
  it('renders the header', () => {
    render(<AcepProgram />);
    expect(screen.getByText(/ACEP/i)).toBeInTheDocument();
  });

  it('shows occupied slot with module name', () => {
    render(<AcepProgram />);
    // GEN is the category code for slot 0 (generator)
    expect(screen.getByText(/GEN/i)).toBeInTheDocument();
  });

  it('shows empty slot with dash', () => {
    render(<AcepProgram />);
    // Slots 1-7 are empty — should show at least one "—"
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('clicking empty slot calls setActiveProgram(MODULES)', () => {
    render(<AcepProgram />);
    // Click DRV slot (slot 1, empty)
    const drvSlot = screen.getByTestId('acep-slot-1');
    fireEvent.click(drvSlot);
    expect(mockSetActiveProgram).toHaveBeenCalledWith('MODULES');
  });

  it('clicking occupied slot shows UNINSTALL button', () => {
    render(<AcepProgram />);
    const genSlot = screen.getByTestId('acep-slot-0');
    fireEvent.click(genSlot);
    expect(screen.getByText(/UNINSTALL/i)).toBeInTheDocument();
  });

  it('UNINSTALL button calls sendUninstallModule', () => {
    render(<AcepProgram />);
    fireEvent.click(screen.getByTestId('acep-slot-0'));
    fireEvent.click(screen.getByText(/UNINSTALL/i));
    expect(mockSendUninstallModule).toHaveBeenCalledWith(0);
  });

  it('renders AUSBAU XP bar', () => {
    render(<AcepProgram />);
    expect(screen.getByText(/AUSBAU/i)).toBeInTheDocument();
  });

  it('shows extra slot when extraModuleSlots > 0', () => {
    render(<AcepProgram />);
    // Extra slot label: +1
    expect(screen.getByTestId('acep-slot-8')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/AcepProgram.test.tsx
```

Expected: FAIL — `AcepProgram` not found.

- [ ] **Step 3: Implement AcepProgram.tsx**

Create `packages/client/src/components/AcepProgram.tsx`:

```tsx
import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import {
  SPECIALIZED_SLOT_CATEGORIES,
  getExtraSlotCount,
  getAcepLevel,
  MODULES,
} from '@void-sector/shared';
import { AcepPanel } from './AcepPanel';
import { getModuleSourceColor } from './moduleUtils';

const CAT_LABELS: Record<string, string> = {
  generator: 'GEN',
  drive: 'DRV',
  weapon: 'WPN',
  armor: 'ARM',
  shield: 'SHD',
  scanner: 'SCN',
  miner: 'MIN',
  cargo: 'CGO',
};

function hpBar(current: number, max: number): string {
  if (max <= 0) return '███';
  const filled = Math.round((current / max) * 3);
  return '█'.repeat(filled) + '░'.repeat(3 - filled);
}

export function AcepProgram() {
  const ship = useStore((s) => s.ship);
  const setActiveProgram = useStore((s) => s.setActiveProgram);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  if (!ship) {
    return (
      <div style={{ padding: 12, fontFamily: 'var(--font-mono)', fontSize: '0.65rem', opacity: 0.5 }}>
        NO ACTIVE SHIP
      </div>
    );
  }

  const { acepXp, acepEffects, acepTraits, modules } = ship;
  const ausbauXp = acepXp?.ausbau ?? 0;
  const extraSlotCount = getExtraSlotCount(ausbauXp);
  const moduleBySlot = new Map(modules.map((m) => [m.slotIndex, m]));

  const specializedSlots = SPECIALIZED_SLOT_CATEGORIES.map((cat, idx) => ({
    index: idx,
    cat,
    label: CAT_LABELS[cat] ?? cat.toUpperCase().slice(0, 3),
    module: moduleBySlot.get(idx) ?? null,
  }));

  const extraSlots = Array.from({ length: extraSlotCount }, (_, i) => ({
    index: SPECIALIZED_SLOT_CATEGORIES.length + i,
    label: `+${i + 1}`,
    module: moduleBySlot.get(SPECIALIZED_SLOT_CATEGORIES.length + i) ?? null,
  }));

  const handleSlotClick = (idx: number) => {
    const mod = moduleBySlot.get(idx);
    if (!mod) {
      setActiveProgram('MODULES');
    } else {
      setSelectedSlot(selectedSlot === idx ? null : idx);
    }
  };

  const acepForPanel = acepXp && acepTraits
    ? { ...acepXp, traits: acepTraits }
    : null;

  const colStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    overflow: 'auto',
    padding: '8px 10px',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.6rem',
    padding: '2px 4px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    lineHeight: 1.6,
  };

  const renderSlotRow = (
    idx: number,
    catLabel: string,
    mod: (typeof modules)[number] | null,
  ) => {
    const isSelected = selectedSlot === idx;
    const modDef = mod ? MODULES[mod.moduleId] : null;
    const color = mod ? getModuleSourceColor(mod.source) : 'var(--color-dim)';
    const name = modDef ? modDef.name : '—';
    const bar = mod ? hpBar(mod.currentHp, mod.maxHp) : '───';

    return (
      <div key={idx}>
        <div
          data-testid={`acep-slot-${idx}`}
          style={{ ...rowStyle, color: mod ? color : 'var(--color-dim)' }}
          onClick={() => handleSlotClick(idx)}
        >
          <span style={{ opacity: 0.6, minWidth: 28 }}>[{catLabel}]</span>
          <span style={{ flex: 1, paddingLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          <span style={{ fontFamily: 'monospace', letterSpacing: 0, opacity: 0.7 }}>{bar}</span>
        </div>
        {isSelected && mod && (
          <div style={{ padding: '2px 4px 4px', display: 'flex', gap: 4 }}>
            <button
              style={{
                background: 'transparent',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.55rem',
                padding: '1px 6px',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                network.sendUninstallModule(idx);
                setSelectedSlot(null);
              }}
            >
              UNINSTALL
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--font-mono)' }}>
      {/* Left column: module slots */}
      <div style={{ ...colStyle, borderRight: '1px solid var(--color-dim)' }}>
        <div style={{ fontSize: '0.6rem', opacity: 0.5, letterSpacing: '0.1em', marginBottom: 6 }}>
          MODUL-SLOTS
        </div>
        {specializedSlots.map(({ index, label, module }) =>
          renderSlotRow(index, label, module),
        )}
        {extraSlots.length > 0 && (
          <>
            <div style={{ fontSize: '0.55rem', opacity: 0.4, marginTop: 6, marginBottom: 2, letterSpacing: '0.1em' }}>
              ─── EXTRA SLOTS ───
            </div>
            {extraSlots.map(({ index, label, module }) =>
              renderSlotRow(index, label, module),
            )}
          </>
        )}
      </div>

      {/* Right column: XP paths + effects + traits */}
      <div style={colStyle}>
        <div style={{ fontSize: '0.6rem', opacity: 0.5, letterSpacing: '0.1em', marginBottom: 6 }}>
          ENTWICKLUNGSPFADE
        </div>
        {acepForPanel ? (
          <AcepPanel acep={acepForPanel} />
        ) : (
          <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>NO ACEP DATA</div>
        )}
        {acepEffects && (
          <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
            <div style={{ fontSize: '0.55rem', opacity: 0.4, marginBottom: 4, letterSpacing: '0.1em' }}>
              AKTIVE EFFEKTE
            </div>
            {acepEffects.extraModuleSlots > 0 && (
              <div style={{ fontSize: '0.58rem', color: '#00FF88' }}>+{acepEffects.extraModuleSlots} Modul-Slots</div>
            )}
            {acepEffects.scanRadiusBonus > 0 && (
              <div style={{ fontSize: '0.58rem', color: '#00FF88' }}>+{acepEffects.scanRadiusBonus} Scan-Radius</div>
            )}
            {acepEffects.miningBonus > 0 && (
              <div style={{ fontSize: '0.58rem', color: '#00FF88' }}>+{Math.round(acepEffects.miningBonus * 100)}% Mining</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/client && npx vitest run src/__tests__/AcepProgram.test.tsx
```

Expected: PASS

- [ ] **Step 5: Run full client test suite**

```bash
cd packages/client && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/AcepProgram.tsx \
        packages/client/src/__tests__/AcepProgram.test.tsx
git commit -m "feat: create AcepProgram — two-column module slots + XP paths monitor"
```

---

### Task 5: Wire AcepProgram into GameScreen

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx`
- Test: `packages/client/src/__tests__/ProgramSelector.test.tsx` (check ACEP appears)

**Context:**
- `renderScreen` is a switch at ~line 330 handling `MONITORS.*` IDs. Add `case MONITORS.ACEP: return <AcepProgram />;`
- `renderCockpitScreen` at ~line 395 delegates to `renderScreen` for unrecognized monitors. No special case needed.
- `ShipSysScreen` at ~line 237 has `view === 'acep' && <div>ACEP — COMING SOON</div>`. Remove this branch and the 'acep' type.

- [ ] **Step 1: Verify the test state**

The `ProgramSelector.test.tsx` already tests that the program selector renders all programs from `COCKPIT_PROGRAMS`. Since Task 1 added `ACEP` to `COCKPIT_PROGRAMS`, that test should now expect ACEP to appear. Run it first to check current state:

```bash
cd packages/client && npx vitest run src/__tests__/ProgramSelector.test.tsx
```

Note the output — the test may already fail or pass depending on how it checks the list.

- [ ] **Step 2: Implement the GameScreen wiring**

**2a.** Add `AcepProgram` to the imports at the top of `GameScreen.tsx`:

Find the existing component imports (around line 19 — ModulePanel):
```typescript
import { ModulePanel } from './ModulePanel';
```
Add after it:
```typescript
import { AcepProgram } from './AcepProgram';
```

**2b.** In `renderScreen` (~line 358), add the ACEP case before the default:

Old:
```typescript
    case 'MODULES':
      return <ModulePanel />;
    default:
      return <div style={{ padding: 12 }}>UNKNOWN MONITOR</div>;
```
New:
```typescript
    case 'MODULES':
      return <ModulePanel />;
    case MONITORS.ACEP:
      return <AcepProgram />;
    default:
      return <div style={{ padding: 12 }}>UNKNOWN MONITOR</div>;
```

**2c.** In `ShipSysScreen` (~line 249), remove the COMING SOON branch:

Old:
```typescript
        {view === 'acep' && (
          <div style={{ padding: '12px', color: '#555', fontSize: '0.8rem' }}>
            ACEP — COMING SOON
          </div>
        )}
```
New: (delete those lines entirely)

**2d.** Clean up the `ShipSysView` type — remove `'acep'` from it since it's no longer used in `ShipSysScreen`:

Old:
```typescript
type ShipSysView = 'settings' | 'modules' | 'acep';
```
New:
```typescript
type ShipSysView = 'settings' | 'modules';
```

- [ ] **Step 3: Run client test suite**

```bash
cd packages/client && npx vitest run
```

Expected: all tests pass. If `ProgramSelector.test.tsx` now fails because it expects a specific count or doesn't expect ACEP, update that test to include ACEP.

- [ ] **Step 4: Run full test suite across all packages**

```bash
cd packages/shared && npx vitest run && cd ../server && npx vitest run && cd ../client && npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/GameScreen.tsx
git commit -m "feat: wire AcepProgram into renderScreen, remove SHIP-SYS COMING SOON placeholder"
```

---

## Final Verification

- [ ] **Run complete test suite**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

All three must pass before finishing the branch.

- [ ] **Use superpowers:finishing-a-development-branch to complete**
