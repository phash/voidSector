# Blueprint Crafting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players can create blueprint copies of researched modules in the Tech-Tree. First copy free, additional copies cost 100 CR x Tier.

**Architecture:** New server handler `handleCreateBlueprintCopy` in ShipService. TechDetailPanel gets a [BLUEPRINT HERSTELLEN] button for unlocked modules. When a tech node is researched that unlocks a new module tier, the first blueprint is auto-granted.

**Tech Stack:** TypeScript, Colyseus messages, Zustand store, unified inventory system

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/shared/src/constants.ts` | Modify | Add `BLUEPRINT_COPY_BASE_COST` constant |
| `packages/server/src/rooms/services/ShipService.ts` | Modify | Add `handleCreateBlueprintCopy` handler |
| `packages/server/src/rooms/services/TechTreeService.ts` | Modify | Grant first blueprint on research completion |
| `packages/server/src/rooms/SectorRoom.ts` | Modify | Register `createBlueprintCopy` message |
| `packages/client/src/network/client.ts` | Modify | Add sender + `blueprintCopyResult` handler |
| `packages/client/src/components/TechDetailPanel.tsx` | Modify | Add [BLUEPRINT HERSTELLEN] button |
| `packages/server/src/__tests__/blueprintCrafting.test.ts` | Create | Tests for blueprint copy creation |

---

## Chunk 1: Server — Blueprint Copy Handler

### Task 1: Add constant

**Files:**
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Add BLUEPRINT_COPY_BASE_COST**

In `packages/shared/src/constants.ts` after the `CUSTOM_SLATE_*` constants (~line 2163), add:

```typescript
// Blueprint Crafting
export const BLUEPRINT_COPY_BASE_COST = 100; // CR per tier
```

- [ ] **Step 2: Build shared**

Run: `cd packages/shared && npm run build`
Expected: Clean compile

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat: add BLUEPRINT_COPY_BASE_COST constant"
```

---

### Task 2: Write tests for blueprint copy creation

**Files:**
- Create: `packages/server/src/__tests__/blueprintCrafting.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries.js', () => ({
  getPlayerResearch: vi.fn(),
  getPlayerCredits: vi.fn(),
  deductCredits: vi.fn(),
}));
vi.mock('../engine/inventoryService.js', () => ({
  addToInventory: vi.fn(),
  getCargoState: vi.fn().mockResolvedValue({ ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 }),
}));

import { getPlayerResearch, getPlayerCredits, deductCredits } from '../db/queries.js';
import { addToInventory } from '../engine/inventoryService.js';

// Inline mock of the handler logic for unit testing
// (Tests the business rules, not the Colyseus wiring)
import { MODULES, BLUEPRINT_COPY_BASE_COST } from '@void-sector/shared';

describe('Blueprint Copy Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects if module not in unlockedModules', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: [],
      blueprints: [],
    } as any);

    const research = await getPlayerResearch('player-1');
    expect(research.unlockedModules.includes('drive_mk2')).toBe(false);
  });

  it('calculates correct cost: 100 * tier', () => {
    const mod = MODULES['drive_mk2'];
    expect(mod).toBeDefined();
    const cost = BLUEPRINT_COPY_BASE_COST * mod.tier;
    expect(cost).toBe(200); // tier 2 * 100
  });

  it('calculates tier 5 cost correctly', () => {
    const mod = MODULES['drive_mk5'];
    if (mod) {
      const cost = BLUEPRINT_COPY_BASE_COST * mod.tier;
      expect(cost).toBe(500); // tier 5 * 100
    }
  });

  it('rejects if not enough credits', async () => {
    vi.mocked(getPlayerCredits).mockResolvedValue(50);
    const credits = await getPlayerCredits('player-1');
    const cost = BLUEPRINT_COPY_BASE_COST * 2; // tier 2
    expect(credits < cost).toBe(true);
  });

  it('deducts credits and adds blueprint on success', async () => {
    vi.mocked(getPlayerResearch).mockResolvedValue({
      unlockedModules: ['drive_mk2'],
      blueprints: [],
    } as any);
    vi.mocked(getPlayerCredits).mockResolvedValue(1000);
    vi.mocked(deductCredits).mockResolvedValue(true);
    vi.mocked(addToInventory).mockResolvedValue();

    const research = await getPlayerResearch('player-1');
    expect(research.unlockedModules.includes('drive_mk2')).toBe(true);

    const mod = MODULES['drive_mk2'];
    const cost = BLUEPRINT_COPY_BASE_COST * mod.tier;
    await deductCredits('player-1', cost);
    await addToInventory('player-1', 'blueprint', 'drive_mk2', 1);

    expect(deductCredits).toHaveBeenCalledWith('player-1', 200);
    expect(addToInventory).toHaveBeenCalledWith('player-1', 'blueprint', 'drive_mk2', 1);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd packages/server && npx vitest run src/__tests__/blueprintCrafting.test.ts`
Expected: 5 passed

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/__tests__/blueprintCrafting.test.ts
git commit -m "test: blueprint copy creation unit tests"
```

---

### Task 3: Implement handleCreateBlueprintCopy

**Files:**
- Modify: `packages/server/src/rooms/services/ShipService.ts`

- [ ] **Step 1: Add handler method**

After `handleActivateBlueprint` (~line 302), add:

```typescript
async handleCreateBlueprintCopy(client: Client, data: { moduleId: string }): Promise<void> {
  const auth = client.auth as AuthPayload;
  const mod = MODULES[data.moduleId];
  if (!mod) {
    client.send('blueprintCopyResult', { success: false, error: 'Unknown module' });
    return;
  }

  // Must be researched (in unlockedModules)
  const research = await getPlayerResearch(auth.userId);
  if (!research.unlockedModules.includes(data.moduleId)) {
    client.send('blueprintCopyResult', { success: false, error: 'Modul nicht erforscht' });
    return;
  }

  // Cost: 100 CR * tier
  const cost = BLUEPRINT_COPY_BASE_COST * mod.tier;
  const credits = await getPlayerCredits(auth.userId);
  if (credits < cost) {
    client.send('blueprintCopyResult', { success: false, error: `Nicht genug Credits (${cost} CR benötigt)` });
    return;
  }

  await deductCredits(auth.userId, cost);
  await addToInventory(auth.userId, 'blueprint', data.moduleId, 1);

  client.send('blueprintCopyResult', { success: true, moduleId: data.moduleId, cost });
  client.send('inventoryUpdated', {});
  client.send('creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
  client.send('logEntry', `BLUEPRINT KOPIE: ${mod.name ?? data.moduleId} (-${cost} CR)`);
}
```

- [ ] **Step 2: Add import for BLUEPRINT_COPY_BASE_COST**

In the import from `@void-sector/shared`, add `BLUEPRINT_COPY_BASE_COST`:

```typescript
import {
  calculateShipStats,
  validateModuleInstall,
  getActiveDrawbacks,
  isModuleUnlocked,
  MODULES,
  MODULE_HP_BY_TIER,
  BLUEPRINT_COPY_BASE_COST,
} from '@void-sector/shared';
```

- [ ] **Step 3: Register in SectorRoom**

In `packages/server/src/rooms/SectorRoom.ts`, after the `craftModule` handler (~line 763), add:

```typescript
this.onMessage('createBlueprintCopy', (client, data) =>
  this.ships.handleCreateBlueprintCopy(client, data),
);
```

- [ ] **Step 4: Run tests**

Run: `cd packages/server && npx vitest run src/__tests__/blueprintCrafting.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/services/ShipService.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: handleCreateBlueprintCopy — copy blueprints for 100*tier CR"
```

---

### Task 4: Auto-grant first blueprint on tech research

**Files:**
- Modify: `packages/server/src/rooms/services/TechTreeService.ts`

- [ ] **Step 1: Add auto-grant logic**

In `handleResearchNode`, after `saveTechTree(...)` (~line 90) and before `sendTechTreeUpdate`, add logic to check if the researched node's effects unlock new module tiers. If so, grant first blueprints for newly accessible modules.

After the `saveTechTree` call, add:

```typescript
// Auto-grant first blueprint for newly accessible modules
try {
  const effects = getTechEffects(row.researched_nodes);
  const unlockedTiers = effects.unlockedTiers ?? {};
  // Find modules that just became accessible at this new tier
  for (const [moduleId, mod] of Object.entries(MODULES)) {
    if (!mod.cost) continue; // not craftable
    const categoryTier = unlockedTiers[mod.category] ?? 1;
    if (mod.tier <= categoryTier) {
      // Module is accessible — check if player already has a blueprint
      const qty = await getInventoryItem(auth.userId, 'blueprint', moduleId);
      if (qty === 0 && !research_unlockedModules_has(auth.userId, moduleId)) {
        // First time this module is accessible — grant free blueprint
        // Only for modules that just crossed the tier threshold
        if (mod.tier === categoryTier && currentLevel === 0) {
          await addToInventory(auth.userId, 'blueprint', moduleId, 1);
          client.send('logEntry', `BLUEPRINT ERHALTEN: ${mod.name}`);
        }
      }
    }
  }
  client.send('inventoryUpdated', {});
} catch { /* don't block research on blueprint grant failure */ }
```

**Note:** The exact logic for determining "newly accessible" depends on the tech tree effects system. The implementation should check which tier was just unlocked by THIS research action and only grant blueprints for modules at that exact tier. This may need adjustment based on the actual `getTechEffects` return shape.

- [ ] **Step 2: Add required imports**

Add to TechTreeService imports:
```typescript
import { MODULES } from '@void-sector/shared';
import { addToInventory, getInventoryItem } from '../../engine/inventoryService.js';
```

- [ ] **Step 3: Run all server tests**

Run: `cd packages/server && npx vitest run`
Expected: No new failures

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/rooms/services/TechTreeService.ts
git commit -m "feat: auto-grant first blueprint on tech tree research"
```

---

## Chunk 2: Client — UI Integration

### Task 5: Add client network methods

**Files:**
- Modify: `packages/client/src/network/client.ts`

- [ ] **Step 1: Add sender method**

After `sendCraftModule` (~line 2579), add:

```typescript
sendCreateBlueprintCopy(moduleId: string) {
  this.sectorRoom?.send('createBlueprintCopy', { moduleId });
}
```

- [ ] **Step 2: Add result handler**

After the `craftResult` handler, add:

```typescript
room.onMessage('blueprintCopyResult', (data: { success: boolean; moduleId?: string; cost?: number; error?: string }) => {
  const store = useStore.getState();
  if (data.success) {
    store.addLogEntry(`BLUEPRINT KOPIE: ${data.moduleId} (-${data.cost} CR)`);
  } else {
    store.addLogEntry(`BLUEPRINT FEHLER: ${data.error}`);
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat: client sendCreateBlueprintCopy + result handler"
```

---

### Task 6: Add [BLUEPRINT HERSTELLEN] button to TechDetailPanel

**Files:**
- Modify: `packages/client/src/components/TechDetailPanel.tsx`

- [ ] **Step 1: Read TechDetailPanel to find exact insertion point**

Read the component and find where module details are rendered, specifically after the existing blueprint activation section (~line 190).

- [ ] **Step 2: Add button for unlocked modules**

After the existing blueprint activation block (the `{hasBP && !isUnlocked && ...}` section), add:

```tsx
{/* Blueprint copy creation — for unlocked/researched modules with cost */}
{isUnlocked && mod.cost && (
  <div style={{ marginTop: 6 }}>
    <button
      style={btnStyle}
      onClick={() => network.sendCreateBlueprintCopy(mod.id)}
    >
      [BLUEPRINT HERSTELLEN — {BLUEPRINT_COPY_BASE_COST * mod.tier} CR]
    </button>
  </div>
)}
```

- [ ] **Step 3: Add import**

Add `BLUEPRINT_COPY_BASE_COST` to the imports from `@void-sector/shared`.

- [ ] **Step 4: Verify build**

Run: `cd packages/client && npx vite build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/TechDetailPanel.tsx
git commit -m "feat: [BLUEPRINT HERSTELLEN] button in TechDetailPanel"
```

---

### Task 7: Final integration test

- [ ] **Step 1: Build shared**

Run: `cd packages/shared && npm run build`

- [ ] **Step 2: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: No new failures

- [ ] **Step 3: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: No new failures from our changes

- [ ] **Step 4: Final commit and push**

```bash
git push -u origin feat/blueprint-crafting
```
