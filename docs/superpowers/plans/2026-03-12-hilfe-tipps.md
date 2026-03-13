# Hilfe-Tipps Implementation Plan (#258)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the help tip system with 24 first-action tips (12 program tips + 12 deep system tips) using Douglas Adams / Terry Pratchett tone, fired by a new `triggerTip(event)` function.

**Architecture:** Add `trigger?` field to `HelpTip` and a `triggerTip(event)` function to `helpSlice`. Populate `HELP_TIPS` with 24 new entries. Call `triggerTip()` at the right moments in `ProgramSelector.tsx` and `client.ts` message handlers.

**Tech Stack:** TypeScript, React, Zustand, Vitest

---

## Implementation Note: Actual Program IDs (Divergence from Spec)

The spec's brainstorming listed conceptual program names (`RADAR`, `SCAN`, `HANGAR`, `TV`) that do not exist in the actual codebase. The actual `COCKPIT_PROGRAMS` (from `packages/shared/src/constants.ts`) are:
`NAV-COM`, `MINING`, `CARGO`, `BASE-LINK`, `TRADE`, `FACTION`, `QUESTS`, `TECH`, `QUAD-MAP`, `NEWS`, `LOG`, `ACEP`

**Intentional replacements:**
- `RADAR` and `SCAN` → the radar canvas and sector scanning live inside `NAV-COM`; `NAV-COM` covers both
- `HANGAR` → the ACEP program (`ACEP`) contains the MODULE and SHOP tabs for ship management
- `TV` → the `NEWS` program is the galactic news / war ticker feed

The trigger key derivation uses the existing `progKey(id)` pattern already in `ProgramSelector.tsx`: `id.toLowerCase().replace(/-/g, '')`.

| Program | Trigger event |
|---------|--------------|
| `NAV-COM` | `program_open_navcom` |
| `MINING` | `program_open_mining` |
| `CARGO` | `program_open_cargo` |
| `BASE-LINK` | `program_open_baselink` |
| `TRADE` | `program_open_trade` |
| `FACTION` | `program_open_faction` |
| `QUESTS` | `program_open_quests` |
| `TECH` | `program_open_tech` |
| `QUAD-MAP` | `program_open_quadmap` |
| `NEWS` | `program_open_news` |
| `LOG` | `program_open_log` |
| `ACEP` | `program_open_acep` |

---

## Chunk 1: helpSlice — infrastructure + tip data

### Task 1: Add `trigger` field + `triggerTip()` to helpSlice

**Files:**
- Modify: `packages/client/src/state/helpSlice.ts`
- Modify: `packages/client/src/__tests__/helpSlice.test.ts`

- [ ] **Step 1: Write failing tests for `triggerTip`**

First, update the top-level `beforeEach` in `packages/client/src/__tests__/helpSlice.test.ts` to also clear `vs_first_run` (needed for the onboarding guard test to be deterministic):

```ts
beforeEach(() => {
  try {
    localStorage.removeItem('vs_seen_tips');
    localStorage.removeItem('vs_first_run'); // ensure onboardingStep starts at 0
  } catch {
    /* noop */
  }
});
```

Then add to `packages/client/src/__tests__/helpSlice.test.ts` inside the `describe('HelpSlice')` block:

```ts
describe('triggerTip', () => {
  it('fires a tip matching the event', () => {
    const store = createStore(createHelpSlice);
    // Add a tip with a trigger for testing via the store (HELP_TIPS is module-level)
    // We test indirectly: triggerTip on an event for which a tip exists
    // 'first_login' has no trigger — so use a known trigger from the real tips
    // Assume 'prog_navcom' has trigger 'program_open_navcom' after implementation
    store.getState().triggerTip('program_open_navcom');
    expect(store.getState().activeTip?.id).toBe('prog_navcom');
  });

  it('does nothing for unknown event', () => {
    const store = createStore(createHelpSlice);
    store.getState().triggerTip('nonexistent_event');
    expect(store.getState().activeTip).toBeNull();
  });

  it('does not fire if tip already seen', () => {
    const store = createStore(createHelpSlice);
    store.getState().showTip('prog_navcom'); // mark as seen
    store.getState().dismissTip();
    store.getState().triggerTip('program_open_navcom');
    expect(store.getState().activeTip).toBeNull();
  });

  it('does not fire during onboarding', () => {
    const store = createStore(createHelpSlice);
    // onboardingStep starts at 0 (vs_first_run not set in test env)
    expect(store.getState().onboardingStep).not.toBeNull();
    store.getState().triggerTip('program_open_navcom');
    expect(store.getState().activeTip).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/client && npx vitest run src/__tests__/helpSlice.test.ts
```

Expected: tests fail — `triggerTip is not a function` (or property missing)

- [ ] **Step 3: Add `trigger?` to `HelpTip` and `triggerTip` to `HelpSlice`**

In `packages/client/src/state/helpSlice.ts`:

```ts
export interface HelpTip {
  id: string;
  title: string;
  body: string;
  articleId?: string;
  trigger?: string;  // NEW
}
```

Add `triggerTip: (event: string) => void;` to `HelpSlice` interface.

Add implementation to `createHelpSlice`:

```ts
triggerTip: (event: string) => {
  if (get().onboardingStep !== null) return;
  const tip = HELP_TIPS.find((t) => t.trigger === event && !get().seenTips.has(t.id));
  if (tip) get().showTip(tip.id);
},
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/client && npx vitest run src/__tests__/helpSlice.test.ts
```

Expected: `triggerTip does nothing for unknown event` and `does not fire during onboarding` pass. The `fires a tip` and `does not fire if seen` tests will still fail because `prog_navcom` tip doesn't exist yet — that's expected.

- [ ] **Step 5: Commit**

```bash
cd packages/client && git add src/state/helpSlice.ts src/__tests__/helpSlice.test.ts
git commit -m "feat(help): add trigger field and triggerTip() to helpSlice"
```

---

### Task 2: Add 12 program tips to HELP_TIPS

**Files:**
- Modify: `packages/client/src/state/helpSlice.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/client/src/__tests__/helpSlice.test.ts`:

```ts
describe('program tips', () => {
  const EXPECTED_PROGRAM_TRIGGERS = [
    'program_open_navcom',
    'program_open_mining',
    'program_open_cargo',
    'program_open_baselink',
    'program_open_trade',
    'program_open_faction',
    'program_open_quests',
    'program_open_tech',
    'program_open_quadmap',
    'program_open_news',
    'program_open_log',
    'program_open_acep',
  ];

  it('has a tip for every cockpit program', () => {
    const triggers = HELP_TIPS.filter((t) => t.trigger).map((t) => t.trigger!);
    for (const ev of EXPECTED_PROGRAM_TRIGGERS) {
      expect(triggers).toContain(ev);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/helpSlice.test.ts
```

Expected: FAIL — missing program triggers

- [ ] **Step 3: Add program tips to HELP_TIPS**

Add the following 12 entries to the `HELP_TIPS` array in `packages/client/src/state/helpSlice.ts`:

```ts
  // ── Program tips: shown on first open of each cockpit program ──────────────
  {
    id: 'prog_navcom',
    trigger: 'program_open_navcom',
    title: 'NAVIGATIONSKONSOLE',
    body: 'You are here. The universe is very large. These two facts are not as reassuring as they should be. Use the D-Pad to move. The arrow shows which way is interesting.',
  },
  {
    id: 'prog_mining',
    trigger: 'program_open_mining',
    title: 'MINING-SYSTEM',
    body: 'Rocks. In space. You will hit them with a machine until they become money. Navigate to an asteroid sector, then press MINE. This is civilization.',
  },
  {
    id: 'prog_cargo',
    trigger: 'program_open_cargo',
    title: 'FRACHTLAGER',
    body: 'Everything you own fits in this hold. The hold has a capacity. When the capacity is reached, the mining stops. Sell things to make room for more things.',
  },
  {
    id: 'prog_baselink',
    trigger: 'program_open_baselink',
    title: 'BASIS-VERBINDUNG',
    body: 'Your base of operations. Structures can be built here to produce Wissen, store cargo, or defend your territory. It takes resources to build something worth having.',
  },
  {
    id: 'prog_trade',
    trigger: 'program_open_trade',
    title: 'HANDELSMODUL',
    body: 'Buy low, sell high, avoid pirates between the two steps. The spread between buy and sell price reflects a station\'s opinion of your desperation. The rest is commentary.',
  },
  {
    id: 'prog_faction',
    trigger: 'program_open_faction',
    title: 'FRAKTIONEN',
    body: 'Large organizations with strong opinions about you. You didn\'t ask for their opinions. They\'ll express them through prices, patrol behavior, and occasional hostility anyway.',
  },
  {
    id: 'prog_quests',
    trigger: 'program_open_quests',
    title: 'AUFTRAGS-SYSTEM',
    body: 'Someone wants something done. They\'re offering credits. Read the objectives carefully. Note the expiry date. Assume there\'s a catch. There is always a catch.',
  },
  {
    id: 'prog_tech',
    trigger: 'program_open_tech',
    title: 'TECHNOLOGIEBAUM',
    body: 'The research tree contains many nodes. Some are genuinely useful. Wissen (W) is the research currency — produced by labs. Hover nodes to read what they do before spending.',
  },
  {
    id: 'prog_quadmap',
    trigger: 'program_open_quadmap',
    title: 'QUADRANTEN-KARTE',
    body: 'You are in a quadrant. The quadrant is in a galaxy. Somewhere out there, factions are expanding. Some of them are not human. The map shows who controls what.',
  },
  {
    id: 'prog_news',
    trigger: 'program_open_news',
    title: 'GALAKTISCHER NACHRICHTENDIENST',
    body: 'This is the galactic news feed. Much of it is propaganda. Some of it is useful. Faction conflicts, conquest events, and war ticker items appear here. Good luck telling which is which.',
  },
  {
    id: 'prog_log',
    trigger: 'program_open_log',
    title: 'SCHIFFSLOG',
    body: 'The ship log records everything. Every jump, every trade, every combat. Somewhere in this log is the exact moment you made a decision you now regret.',
  },
  {
    id: 'prog_acep',
    trigger: 'program_open_acep',
    title: 'PILOTENAKTE',
    body: 'Your pilot profile. Experience accumulates across four paths: Kampf, Ausbau, Handel, Erkundung. Traits unlock as you advance. The MODULE and SHOP tabs handle ship hardware.',
  },
```

- [ ] **Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/helpSlice.test.ts
```

Expected: all program tip tests pass; the `triggerTip fires a tip` test now also passes

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/state/helpSlice.ts packages/client/src/__tests__/helpSlice.test.ts
git commit -m "feat(help): add 12 program tips to HELP_TIPS"
```

---

### Task 3: Add 12 deep system tips + migrate ap_low_first

**Files:**
- Modify: `packages/client/src/state/helpSlice.ts`

- [ ] **Step 1: Write failing tests**

Add to `packages/client/src/__tests__/helpSlice.test.ts`:

```ts
describe('deep system tips', () => {
  const EXPECTED_DEEP_TRIGGERS = [
    'mining_started',
    'mining_depleted',
    'cargo_full',
    'combat_started',
    'combat_won',
    'quest_accepted',
    'quest_completed',
    'acep_xp_gained',
    'scan_complete',
    'trade_sold',
    'ap_low',
    'faction_rep_change',
  ];

  it('has a deep tip for every core system event', () => {
    const triggers = HELP_TIPS.filter((t) => t.trigger).map((t) => t.trigger!);
    for (const ev of EXPECTED_DEEP_TRIGGERS) {
      expect(triggers).toContain(ev);
    }
  });

  it('ap_low_first tip exists with correct trigger', () => {
    const tip = HELP_TIPS.find((t) => t.id === 'ap_low_first');
    expect(tip).toBeDefined();
    expect(tip?.trigger).toBe('ap_low');
  });

  it('old ap-depleted-first id no longer exists', () => {
    const tip = HELP_TIPS.find((t) => t.id === 'ap-depleted-first');
    expect(tip).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/client && npx vitest run src/__tests__/helpSlice.test.ts
```

Expected: FAIL — deep triggers missing, old id still exists

- [ ] **Step 3: Migrate `ap-depleted-first` and add 11 deep tips**

In `HELP_TIPS`, replace the existing `ap-depleted-first` entry:

```ts
// REMOVE this:
  {
    id: 'ap-depleted-first',
    title: 'ACTION POINTS',
    body: 'AP powers all movement and actions. They regenerate automatically — watch the bar in the status panel.',
  },

// REPLACE WITH:
  {
    id: 'ap_low_first',
    trigger: 'ap_low',
    title: 'ACTION POINTS',
    body: 'AP powers all movement and actions. It regenerates automatically over time. The regen rate can be improved via ACEP traits and ship modules. Consider parking until it recovers.',
  },
```

Then add the remaining 11 deep system tips to `HELP_TIPS`:

```ts
  // ── Deep system tips: specific action moments ───────────────────────────────
  {
    id: 'mining_started_first',
    trigger: 'mining_started',
    title: 'BOHRKOPF AKTIV',
    body: 'The drill is running. It stops when the rock runs out, your hold fills, or you tell it to. The rock does not care which. Mine-All chains resources automatically.',
  },
  {
    id: 'mining_depleted_first',
    trigger: 'mining_depleted',
    title: 'SEKTOR ERSCHÖPFT',
    body: 'The sector is empty. Resources regenerate over time — the rate depends on how long you leave it alone. Space has more rocks than you can mine in a lifetime. Move on.',
  },
  {
    id: 'cargo_full_first',
    trigger: 'cargo_full',
    title: 'FRACHT VOLL',
    body: 'Hold is full. You can sell at any station, or jettison cargo if you\'re in a hurry. Jettisoned cargo returns to the void, which accepts donations without comment.',
  },
  {
    id: 'combat_started_first',
    trigger: 'combat_started',
    title: 'KAMPFKONTAKT',
    body: 'Someone has chosen violence. You may respond in kind, attempt to flee, or — if you\'re feeling optimistic — negotiate. The optimistic option is statistically underrated but occasionally correct.',
  },
  {
    id: 'combat_won_first',
    trigger: 'combat_won',
    title: 'GEFECHT GEWONNEN',
    body: 'You won. Your opponent is no longer a problem. Their wreckage might be worth scanning. Combat experience accrues to your ACEP pilot profile.',
  },
  {
    id: 'quest_accepted_first',
    trigger: 'quest_accepted',
    title: 'AUFTRAG ANGENOMMEN',
    body: 'You have accepted a contract. Read the objectives. Note the expiry date. Some quests place items in your cargo. The universe does not offer deadline extensions.',
  },
  {
    id: 'quest_completed_first',
    trigger: 'quest_completed',
    title: 'AUFTRAG ERFÜLLT',
    body: 'Delivered. Paid. The galaxy nods in its usual indifferent way and immediately generates another contract. Your reputation with the issuing faction has improved. Marginally.',
  },
  {
    id: 'acep_first_xp',
    trigger: 'acep_xp_gained',
    title: 'ERFAHRUNG GESAMMELT',
    body: 'Experience points. You have earned some. They accumulate in four paths: Kampf, Ausbau, Handel, Erkundung. Open the ACEP program to see your pilot profile and available traits.',
  },
  {
    id: 'scan_complete_first',
    trigger: 'scan_complete',
    title: 'SCAN ABGESCHLOSSEN',
    body: 'Scan complete. The sector has been documented, categorized, and added to a database nobody will read. Resources, POIs, and anomalies are now visible. You may proceed.',
  },
  {
    id: 'trade_first_sale',
    trigger: 'trade_sold',
    title: 'TRANSAKTION',
    body: 'Credits received. Note the spread between buy and sell prices. That spread is the station\'s fee for existing. Higher-tier stations generally offer better margins. Shop around.',
  },
  {
    id: 'faction_rep_first',
    trigger: 'faction_rep_change',
    title: 'REPUTATIONSÄNDERUNG',
    body: 'Your reputation with a faction has shifted. Reputation determines what they\'ll sell you, whether they\'ll shoot at you, and what prices they quote. It can be improved. Slowly.',
  },
```

- [ ] **Step 4: Run all client tests**

```bash
cd packages/client && npx vitest run src/__tests__/helpSlice.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/state/helpSlice.ts packages/client/src/__tests__/helpSlice.test.ts
git commit -m "feat(help): add 12 deep system tips, migrate ap-depleted-first to ap_low_first"
```

---

## Chunk 2: Trigger call sites

### Task 4: ProgramSelector — trigger on first program open

**Files:**
- Modify: `packages/client/src/components/ProgramSelector.tsx`
- Modify: `packages/client/src/__tests__/ProgramSelector.test.tsx` (or create if missing)

- [ ] **Step 1: Check if a ProgramSelector test file exists**

```bash
ls packages/client/src/__tests__/ProgramSelector* 2>/dev/null || echo "no test file"
```

- [ ] **Step 2: Write a failing test**

If a test file exists, add to it. If not, create `packages/client/src/__tests__/ProgramSelector.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgramSelector } from '../components/ProgramSelector';
import { useStore } from '../state/store';

// Mock the store
vi.mock('../state/store', () => ({
  useStore: vi.fn(),
}));

// Mock shared
vi.mock('@void-sector/shared', () => ({
  COCKPIT_PROGRAMS: ['NAV-COM', 'MINING'],
  COCKPIT_PROGRAM_LABELS: { 'NAV-COM': 'NAV-COM', MINING: 'MINING' },
  MONITORS: { MINING: 'MINING' },
  getPhysicalCargoTotal: () => 0,
}));

describe('ProgramSelector', () => {
  const mockTriggerTip = vi.fn();
  const mockSetActiveProgram = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockImplementation((selector: any) =>
      selector({
        activeProgram: null,
        setActiveProgram: mockSetActiveProgram,
        alerts: {},
        mining: null,
        cargo: {},
        ship: { stats: { cargoCap: 10 } },
        triggerTip: mockTriggerTip,
      }),
    );
    localStorage.clear();
  });

  it('calls triggerTip with program_open_<key> on first click', () => {
    const { getByTestId } = render(<ProgramSelector />);
    fireEvent.click(getByTestId('program-btn-NAV-COM'));
    expect(mockTriggerTip).toHaveBeenCalledWith('program_open_navcom');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/ProgramSelector.test.tsx
```

Expected: FAIL — `triggerTip` not called

- [ ] **Step 4: Add `triggerTip` call to ProgramSelector**

In `packages/client/src/components/ProgramSelector.tsx`:

Add `triggerTip` to the store selectors:
```tsx
const triggerTip = useStore((s) => s.triggerTip);
```

In the `onClick` handler of the button, add after `setActiveProgram(id)`:
```tsx
onClick={() => {
  try { localStorage.setItem(`vs_prog_used_${progKey(id)}`, '1'); } catch {}
  setActiveProgram(id);
  triggerTip(`program_open_${progKey(id)}`);
}}
```

Note: `progKey(id)` is already defined in this file as `id.toLowerCase().replace(/-/g, '')`. This naturally produces `navcom`, `baselink`, `quadmap`, etc.

- [ ] **Step 5: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/ProgramSelector.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/ProgramSelector.tsx packages/client/src/__tests__/ProgramSelector.test.tsx
git commit -m "feat(help): trigger program tip on first cockpit button click"
```

---

### Task 5: client.ts — mining, cargo, AP, scan triggers

**Files:**
- Modify: `packages/client/src/network/client.ts`

These are fire-and-forget trigger calls added to existing message handlers. No new tests needed beyond the slice tests (the handler logic is trivial dispatch).

- [ ] **Step 1: `miningUpdate` handler — `mining_started`**

Find the `miningUpdate` handler (~line 456). Replace the entire handler body with this version (adds one new `if` block between `setMining` and the alert block):

```ts
room.onMessage('miningUpdate', (data: MiningState) => {
  const store = useStore.getState();
  const wasMining = store.mining?.active;
  store.setMining(data);
  // Tip: first time mining starts
  if (!wasMining && data.active) {
    store.triggerTip('mining_started');
  }
  // Alert when mining completes (was active, now not)
  if (wasMining && !data.active) {
    if (!isMonitorVisible('MINING')) {
      store.setAlert('MINING', true);
    }
  }
});
```

- [ ] **Step 2: `logEntry` handler — `mining_depleted`**

Find the `logEntry` handler (~line 1152). Add tip trigger for sector exhaustion:

```ts
room.onMessage('logEntry', (data) => {
  const msg = typeof data === 'string' ? data : (data.message ?? '');
  useStore.getState().addLogEntry(msg);
  // 'SEKTOR ERSCHÖPFT' is sent by server MiningService.ts handleAutoStop() when all
  // resources in mine-all mode are gone. String is internal and owned by this codebase.
  if (msg.includes('SEKTOR ERSCHÖPFT')) {
    useStore.getState().triggerTip('mining_depleted');
  }
});
```

- [ ] **Step 3: `cargoUpdate` handler — `cargo_full`**

Find the `cargoUpdate` handler (~line 469). After the existing auto-stop logic, add:

```ts
room.onMessage('cargoUpdate', (data: CargoState) => {
  useStore.getState().setCargo(data);
  const state = useStore.getState();
  if (state.mining?.active && state.ship) {
    const cargoTotal = getPhysicalCargoTotal(data);
    const cargoCap = state.ship.stats?.cargoCap ?? 0;
    if (cargoCap > 0 && cargoTotal >= cargoCap) {
      this.sendStopMine();
    }
  }
  // Cargo full tip
  const ship = useStore.getState().ship;
  const cargoCap = ship?.stats?.cargoCap ?? 0;
  if (cargoCap > 0 && getPhysicalCargoTotal(data) >= cargoCap) {
    useStore.getState().triggerTip('cargo_full');
  }
});
```

- [ ] **Step 4: `apUpdate` handler — `ap_low`**

Find the `apUpdate` handler (~line 258). Add after `store.setAP(ap)`:

```ts
room.onMessage('apUpdate', (ap: APState) => {
  useStore.getState().setAP(ap);
  if (ap.max > 0 && ap.current / ap.max < 0.2) {
    useStore.getState().triggerTip('ap_low');
  }
});
```

- [ ] **Step 5: `scanResult` handler — `scan_complete`**

Find the `scanResult` handler (~line 313). Add after `store.addLogEntry(...)`:

```ts
store.addLogEntry(`Scan complete: ${data.sectors.length} sectors revealed`);
useStore.getState().triggerTip('scan_complete');
```

- [ ] **Step 6: Run full client tests**

```bash
cd packages/client && npx vitest run
```

Expected: all existing tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat(help): add mining, cargo, AP, scan tip triggers to network handlers"
```

---

### Task 6: client.ts — combat, quest, ACEP, trade, faction triggers

**Files:**
- Modify: `packages/client/src/network/client.ts`

- [ ] **Step 1: `pirateAmbush` handler — `combat_started`**

Find the `pirateAmbush` handler (~line 951). Add trigger:

```ts
room.onMessage('pirateAmbush', (data) => {
  const store = useStore.getState();
  store.setActiveBattle(data.encounter);
  store.addLogEntry(`PIRATEN-HINTERHALT bei (${data.sectorX}, ${data.sectorY})!`);
  store.triggerTip('combat_started');
});
```

Also add to `combatInitResult` handler (~line 982) for the v1 combat system:

```ts
room.onMessage('combatInitResult', (data: { success: boolean; state?: any; error?: string }) => {
  if (data.success && data.state) {
    useStore.getState().setActiveCombat(data.state);
    useStore.getState().triggerTip('combat_started');
  }
});
```

- [ ] **Step 2: `battleResult` handler — `combat_won`**

Find the `battleResult` handler (~line 942). Add trigger on success:

```ts
room.onMessage('battleResult', (data) => {
  const store = useStore.getState();
  const encounter = store.activeBattle;
  store.setActiveBattle(null);
  if (data.success && data.result && encounter) {
    store.setLastBattleResult({ encounter, result: data.result });
    store.triggerTip('combat_won');
  }
});
```

- [ ] **Step 3: `acceptQuestResult` handler — `quest_accepted`**

Find the `acceptQuestResult` handler (~line 893). Add trigger on success:

```ts
room.onMessage('acceptQuestResult', (data) => {
  const store = useStore.getState();
  if (data.success && data.quest) {
    store.setActiveQuests([...store.activeQuests, data.quest]);
    store.addLogEntry(`Quest angenommen: ${data.quest.title}`);
    store.triggerTip('quest_accepted');
  } else {
    store.addLogEntry(`Quest-Fehler: ${data.error}`);
  }
});
```

- [ ] **Step 4: `questComplete` handler — `quest_completed`**

Find the `questComplete` handler (~line 922). Add trigger:

```ts
room.onMessage('questComplete', (data: { id: string; title: string; rewards: any }) => {
  useStore.getState().addQuestComplete({ id: data.id, title: data.title, rewards: data.rewards });
  useStore.getState().triggerTip('quest_completed');
});
```

- [ ] **Step 5: `shipList` handler — `acep_xp_gained`**

Find the `shipList` handler (~line 505). After the existing ACEP XP update, add XP comparison.

**Edge case:** On the very first `shipList` message, `current.acepXp` may be undefined. The guard `if (prevXp && newXp)` silently skips the tip in that case — this is acceptable: the tip fires on the *next* XP gain, not the very first shipList refresh. First XP actually comes from an in-game action (mining, combat, etc.) so by then `ship` will have been populated with the prior XP value.

```ts
room.onMessage('shipList', (data: { ships: any[] }) => {
  useStore.setState({ shipList: data.ships });
  const activeShip = data.ships.find((s: any) => s.active);
  if (activeShip) {
    const current = useStore.getState().ship;
    if (current) {
      // Detect first ACEP XP gain
      const prevXp = current.acepXp;
      const newXp = activeShip.acepXp;
      if (prevXp && newXp) {
        const prevTotal = Object.values(prevXp as Record<string, number>).reduce((a, b) => a + b, 0);
        const newTotal = Object.values(newXp as Record<string, number>).reduce((a, b) => a + b, 0);
        if (newTotal > prevTotal) {
          useStore.getState().triggerTip('acep_xp_gained');
        }
      }
      useStore.setState({
        ship: {
          ...current,
          acepXp: activeShip.acepXp,
          acepEffects: activeShip.acepEffects,
          acepGeneration: activeShip.acepGeneration,
          acepTraits: activeShip.acepTraits,
        },
      });
    }
  }
});
```

- [ ] **Step 6: `npcTradeResult` handler — `trade_sold`**

Find the `npcTradeResult` handler (~line 739). Add trigger on success:

```ts
room.onMessage('npcTradeResult', (data: NpcTradeResultMessage) => {
  const store = useStore.getState();
  if (data.success) {
    store.addLogEntry('Trade complete');
    store.triggerTip('trade_sold');
    if (data.partial) {
      store.setTradeMessage(`Nur ${data.soldAmount}x verkauft — Station ist fast voll`);
    } else {
      store.setTradeMessage(null);
    }
  } else {
    store.addLogEntry(`Trade failed: ${data.error}`);
    store.setTradeMessage(null);
  }
});
```

- [ ] **Step 7: `reputationUpdate` handler — `faction_rep_change`**

Find the `reputationUpdate` handler (~line 936). Add trigger:

```ts
room.onMessage('reputationUpdate', (data) => {
  const store = useStore.getState();
  store.setReputations(data.reputations);
  store.setPlayerUpgrades(data.upgrades);
  store.triggerTip('faction_rep_change');
});
```

- [ ] **Step 8: Run full client tests**

```bash
cd packages/client && npx vitest run
```

Expected: all tests pass

- [ ] **Step 9: Run full test suite**

```bash
cd packages/server && npx vitest run
cd packages/shared && npx vitest run
```

Expected: all pass (no server changes were made)

- [ ] **Step 10: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat(help): add combat, quest, ACEP, trade, faction tip triggers"
```

---

## Final: branch + PR

- [ ] **Create PR**

```bash
git push origin HEAD
gh pr create --title "feat: Hilfe-Tipps (#258) — first-action popup tips Adams/Pratchett" \
  --body "$(cat <<'EOF'
## Summary
- Adds `triggerTip(event)` to helpSlice with onboarding guard
- 12 program tips: one per cockpit program, shown on first open
- 12 deep system tips: mining, cargo, combat, quests, ACEP, scan, trade, faction, AP
- Tone: Douglas Adams (cosmic/existential) + Terry Pratchett (dry/practical)
- All tips fire once per pilot via existing localStorage persistence

## Test plan
- [ ] Open each cockpit program for the first time — tip should appear
- [ ] Dismiss tip — should not appear again on re-open
- [ ] Start mining — BOHRKOPF AKTIV tip
- [ ] Let sector deplete — SEKTOR ERSCHÖPFT tip
- [ ] Fill cargo — FRACHT VOLL tip
- [ ] Get into combat — KAMPFKONTAKT tip
- [ ] Win combat — GEFECHT GEWONNEN tip
- [ ] Accept quest — AUFTRAG ANGENOMMEN tip
- [ ] AP below 20% — ACTION POINTS tip
- [ ] Sell item at station — TRANSAKTION tip
- [ ] All tips dismissable with click or ESC
- [ ] No tips fire during onboarding

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
